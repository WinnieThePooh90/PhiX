const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { shutdownPhix } = require('./lib/phix-shutdown');
const { createPrismaClient } = require('./lib/prisma-factory');
const { usernameWhere } = require('./lib/username-filter');
const {
  exportPhixDatabase,
  exportPhixUserDatabaseDecrypted,
  exportPhixUserDatabaseRaw,
  serializeBackupPayload,
  restorePhixDatabase,
  restorePhixUserDatabase,
  backupFilenameFromPayload,
  resolveStoredUsername,
} = require('./lib/phix-backup');
const { createCryptoSession, destroyCryptoSession, getCryptoSession } = require('./lib/crypto-session');
const { createCryptoMiddleware } = require('./lib/crypto-middleware');
const { runWithCryptoContext } = require('./lib/crypto-context');
const { getDekFromContext } = require('./lib/crypto-context');
const {
  createUserCryptoRecord,
  migratePlaintextForOwner,
  changeUserPasswordCrypto,
  unlockDekWithPassword,
} = require('./lib/user-crypto-service');
const { unwrapDekFromRecovery } = require('./lib/phix-crypto');

function createApp() {
const app = express();
const prisma = createPrismaClient();
/** gesetzt via attachHttpServer() nach app.listen() — für /api/shutdown */
let getShutdownServer = () => null;

app.use(cors());
app.use(express.json({ limit: '64mb' }));

app.use(
  createCryptoMiddleware({
    prisma,
    getActingUser,
  }),
);

const BCRYPT_ROUNDS = 10;

/** Systemadministrator (Benutzerverwaltung, Backup, Dependencies) — kein Zugriff auf fremde Kurse. */
const ADMIN_USERNAME = 'admin';

function getActingUser(req) {
  return String(req.get('X-Acting-User') || '').trim();
}

function isAdminUser(username) {
  return String(username || '').toLowerCase() === ADMIN_USERNAME;
}

function canAccessCourse(course, actingUser) {
  if (!course || !actingUser) return false;
  return course.ownerUsername === actingUser;
}

/** Liefert den in der DB gespeicherten Benutzernamen (Schreibweise) oder null. */
async function assertActingUser(req, res) {
  const acting = getActingUser(req);
  if (!acting) {
    res.status(401).json({ error: 'X-Acting-User erforderlich' });
    return null;
  }
  const row = await prisma.appUser.findFirst({
    where: usernameWhere(acting),
    select: { username: true },
  });
  if (!row) {
    res.status(401).json({ error: 'Unbekannter Benutzer' });
    return null;
  }
  return row.username;
}

async function assertAdminUser(req, res) {
  const acting = await assertActingUser(req, res);
  if (!acting) return null;
  if (!isAdminUser(acting)) {
    res.status(403).json({ error: 'Nur der Administrator darf diese Aktion ausführen.' });
    return null;
  }
  return acting;
}

async function assertCourseAccess(req, res, courseId) {
  const acting = await assertActingUser(req, res);
  if (!acting) return null;
  const cid = Number(courseId);
  if (!Number.isFinite(cid)) {
    res.status(400).json({ error: 'Ungültige Kurs-ID' });
    return null;
  }
  const course = await prisma.course.findUnique({ where: { id: cid } });
  if (!course) {
    res.status(404).json({ error: 'Kurs nicht gefunden' });
    return null;
  }
  if (!canAccessCourse(course, acting)) {
    res.status(403).json({ error: 'Kein Zugriff auf diesen Kurs' });
    return null;
  }
  return course;
}

// ——— App-Benutzer (Passwort-Hashes in der DB) ———

app.post('/api/auth/login', async (req, res) => {
  const usernameIn = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  if (!usernameIn || !password) {
    return res.status(400).json({ error: 'Benutzername und Passwort eingeben.' });
  }
  const { usernameWhere } = require('./lib/username-filter');
  const user = await prisma.appUser.findFirst({
    where: usernameWhere(usernameIn),
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Anmeldung fehlgeschlagen.' });
  }

  const userCrypto = await prisma.userCrypto.findUnique({ where: { userId: user.id } });
  let cryptoSessionToken = null;
  let requiresCryptoSetup = false;
  if (!userCrypto) {
    requiresCryptoSetup = true;
  } else {
    try {
      const dek = await unlockDekWithPassword(prisma, user.id, password);
      cryptoSessionToken = createCryptoSession(user.id, dek);
    } catch (err) {
      console.error('[auth] DEK-Entschlüsselung fehlgeschlagen:', err);
      return res.status(401).json({ error: 'Anmeldung fehlgeschlagen.' });
    }
  }

  res.json({
    id: String(user.id),
    username: user.username,
    cryptoSessionToken,
    requiresCryptoSetup,
  });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = String(req.get('X-Phix-Crypto-Token') || '').trim();
  destroyCryptoSession(token);
  res.status(204).send();
});

app.post('/api/auth/crypto/setup', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const password = String(req.body?.password ?? '');
  if (!password) return res.status(400).json({ error: 'Passwort eingeben.' });

  const user = await prisma.appUser.findFirst({ where: usernameWhere(acting) });
  if (!user) return res.status(401).json({ error: 'Unbekannter Benutzer' });

  const existing = await prisma.userCrypto.findUnique({ where: { userId: user.id } });
  if (existing) {
    return res.status(409).json({ error: 'Verschlüsselung ist bereits eingerichtet.' });
  }

  try {
    const { recoveryKey, dek } = await createUserCryptoRecord(prisma, user.id, password);
    const cryptoSessionToken = createCryptoSession(user.id, dek);
    const { updated } = await runWithCryptoContext({ dek, userId: user.id }, () =>
      migratePlaintextForOwner(prisma, dek, acting),
    );
    res.json({ cryptoSessionToken, recoveryKey, migratedRows: updated });
  } catch (err) {
    console.error('[crypto] Setup fehlgeschlagen:', err);
    res.status(500).json({ error: 'Verschlüsselung konnte nicht eingerichtet werden.' });
  }
});

app.post('/api/auth/crypto/unlock-recovery', async (req, res) => {
  const usernameIn = String(req.body?.username ?? '').trim();
  const recoveryKey = String(req.body?.recoveryKey ?? '');
  const newPassword = String(req.body?.newPassword ?? '');
  if (!usernameIn || !recoveryKey || !newPassword) {
    return res.status(400).json({ error: 'Benutzername, Recovery-Key und neues Passwort eingeben.' });
  }

  const user = await prisma.appUser.findFirst({ where: usernameWhere(usernameIn) });
  if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden.' });

  const userCrypto = await prisma.userCrypto.findUnique({ where: { userId: user.id } });
  if (!userCrypto) {
    return res.status(400).json({ error: 'Für diesen Benutzer ist keine Verschlüsselung eingerichtet.' });
  }

  try {
    const dek = await unwrapDekFromRecovery(userCrypto, recoveryKey);
    const rewrap = await require('./lib/phix-crypto').rewrapPassword(userCrypto, dek, newPassword);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.$transaction(async (tx) => {
      await tx.userCrypto.update({ where: { userId: user.id }, data: rewrap });
      await tx.appUser.update({ where: { id: user.id }, data: { passwordHash } });
    });
    const cryptoSessionToken = createCryptoSession(user.id, dek);
    res.json({ id: String(user.id), username: user.username, cryptoSessionToken });
  } catch (err) {
    console.error('[crypto] Recovery-Unlock fehlgeschlagen:', err);
    res.status(401).json({ error: 'Recovery-Key oder Daten ungültig.' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  const acting = getActingUser(req);
  if (!acting) return res.status(401).json({ error: 'Nicht angemeldet' });
  const user = await prisma.appUser.findFirst({
    where: usernameWhere(acting),
    select: { id: true, username: true },
  });
  if (!user) return res.status(401).json({ error: 'Unbekannter Benutzer' });
  res.json({ id: String(user.id), username: user.username });
});

/** Krypto-Status ohne gültige DEK-Session (für App-Start / Token-Prüfung). */
app.get('/api/auth/crypto/status', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const user = await prisma.appUser.findFirst({
    where: usernameWhere(acting),
    select: { id: true, username: true },
  });
  if (!user) return res.status(401).json({ error: 'Unbekannter Benutzer' });

  const userCrypto = await prisma.userCrypto.findUnique({ where: { userId: user.id } });
  if (!userCrypto) {
    return res.json({ ok: false, needsSetup: true });
  }

  const token = String(req.get('X-Phix-Crypto-Token') || '').trim();
  const session = getCryptoSession(token);
  if (!session || session.userId !== user.id) {
    return res.status(423).json({
      ok: false,
      needsRelogin: true,
      error: 'Bitte erneut anmelden (Verschlüsselung).',
    });
  }

  return res.json({ ok: true, needsSetup: false, needsRelogin: false });
});

/** Einmalige Übernahme alter Klartext-Benutzer aus localStorage (nur fehlende Namen anlegen). */
app.post('/api/users/migrate-from-localstorage', async (req, res) => {
  const rawUsers = req.body?.users;
  if (!Array.isArray(rawUsers)) {
    return res.status(400).json({ error: 'Ungültiger Body' });
  }
  let created = 0;
  for (const row of rawUsers) {
    const username = String(row?.username ?? '').trim();
    const password = String(row?.password ?? '');
    if (!username || !password) continue;
    const existing = await prisma.appUser.findFirst({
      where: usernameWhere(username),
    });
    if (existing) continue;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.appUser.create({ data: { username, passwordHash } });
    created += 1;
  }
  res.json({ ok: true, created });
});

app.get('/api/users', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const users = await prisma.appUser.findMany({
    orderBy: { username: 'asc' },
    select: { id: true, username: true },
  });
  res.json(users.map((u) => ({ id: String(u.id), username: u.username })));
});

app.post('/api/users', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  if (!username) return res.status(400).json({ error: 'Benutzername eingeben.' });
  if (!password) return res.status(400).json({ error: 'Passwort eingeben.' });
  const clash = await prisma.appUser.findFirst({
    where: usernameWhere(username),
  });
  if (clash) return res.status(409).json({ error: 'Dieser Benutzername ist bereits vergeben.' });
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.appUser.create({
    data: { username, passwordHash },
    select: { id: true, username: true },
  });
  // Verschlüsselung + Recovery-Key erst beim ersten Login des neuen Benutzers (POST /api/auth/crypto/setup).
  res.status(201).json({ id: String(user.id), username: user.username });
});

app.patch('/api/users/:id/password', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
  const newPassword = String(req.body?.newPassword ?? '');
  const oldPassword = String(req.body?.oldPassword ?? '');
  if (!newPassword) return res.status(400).json({ error: 'Neues Passwort eingeben.' });

  const target = await prisma.appUser.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

  if (isAdminUser(target.username) && !isAdminUser(acting)) {
    return res.status(403).json({ error: 'Nur der Administrator darf das Passwort von „admin“ ändern.' });
  }

  const userCrypto = await prisma.userCrypto.findUnique({ where: { userId: target.id } });
  if (userCrypto) {
    if (!oldPassword) {
      return res.status(400).json({ error: 'Aktuelles Passwort zur Entschlüsselung eingeben.' });
    }
    try {
      await changeUserPasswordCrypto(prisma, target.id, oldPassword, newPassword);
    } catch {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch.' });
    }
    destroyCryptoSession(String(req.get('X-Phix-Crypto-Token') || '').trim());
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.appUser.update({
    where: { id },
    data: { passwordHash },
  });
  res.status(204).send();
});

app.delete('/api/users/:id', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Ungültige Benutzer-ID' });

  const total = await prisma.appUser.count();
  if (total <= 1) {
    return res.status(400).json({ error: 'Der letzte Benutzer kann nicht gelöscht werden.' });
  }

  const target = await prisma.appUser.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  if (isAdminUser(target.username)) {
    return res.status(400).json({ error: 'Der Benutzer „admin“ kann nicht gelöscht werden.' });
  }

  await prisma.appUser.delete({ where: { id } });
  res.status(204).send();
});

async function ensureAppUsers() {
  const n = await prisma.appUser.count();
  if (n > 0) {
    console.log(`[auth] ${n} App-Benutzer in der Datenbank (Login mit gespeicherten Zugangsdaten).`);
    return;
  }
  const bootstrapPwd = String(process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '').trim() || 'admin';
  const passwordHash = await bcrypt.hash(bootstrapPwd, BCRYPT_ROUNDS);
  await prisma.appUser.create({
    data: { username: 'admin', passwordHash },
  });
  const src = process.env.BOOTSTRAP_ADMIN_PASSWORD ? 'BOOTSTRAP_ADMIN_PASSWORD' : 'Standard';
  console.log(
    `[auth] Erster Start: Benutzer "admin" angelegt (Passwort aus ${src}). ` +
      'Passwort in der App unter Benutzerverwaltung ändern oder mit npm run set-admin-password setzen.',
  );
}

// REGISTRATION (global, für alle Benutzer)
const VALID_REGISTRATION_KEY = 'test';

app.get('/api/registration', async (req, res) => {
  const row = await prisma.appRegistration.findUnique({ where: { id: 1 } });
  res.json({ registered: !!row });
});

app.post('/api/registration', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const { key } = req.body || {};
  const k = String(key ?? '').trim().toLowerCase();
  if (k !== VALID_REGISTRATION_KEY) {
    return res.status(400).json({ error: 'Ungültiger Registrierungsschlüssel.' });
  }
  await prisma.appRegistration.upsert({
    where: { id: 1 },
    update: { registeredAt: new Date(), registeredBy: acting },
    create: { id: 1, registeredAt: new Date(), registeredBy: acting },
  });
  res.json({ registered: true });
});

app.delete('/api/registration', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  await prisma.appRegistration.deleteMany({ where: { id: 1 } });
  res.json({ registered: false });
});

// MIGRATION ON STARTUP
const migrateData = async () => {
  const configs = await prisma.config.findMany();
  if (configs.length > 0) {
    console.log(`Found ${configs.length} old Configs. Migrating to Courses...`);
    for (const conf of configs) {
      // Create course
      const course = await prisma.course.create({
        data: {
          year: conf.year,
          className: conf.className,
          subject: conf.subject,
          hours: conf.hours,
          weighting: conf.weighting,
          ownerUsername: ADMIN_USERNAME,
        }
      });
      // Assign existing unassigned data to this new course
      await prisma.student.updateMany({ where: { courseId: null }, data: { courseId: course.id } });
      await prisma.exam.updateMany({ where: { courseId: null }, data: { courseId: course.id } });
      await prisma.oral.updateMany({ where: { courseId: null }, data: { courseId: course.id } });
      await prisma.test.updateMany({ where: { courseId: null }, data: { courseId: course.id } });
      
      // Delete config
      await prisma.config.delete({ where: { id: conf.id } });
    }
    console.log("Migration complete.");
  }
};

// COURSES
app.get('/api/courses', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const courses = await prisma.course.findMany({
    where: { ownerUsername: acting },
    orderBy: { id: 'asc' },
  });
  res.json(courses);
});

app.post('/api/courses', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const { ownerUsername: _ignoreOwner, ...rest } = req.body;
  const course = await prisma.course.create({
    data: { ...rest, ownerUsername: acting },
  });
  const hours = Number(course.hours) || 0;
  const manyWeeklyHours = hours > 2;
  const defaultExamKeyType = course.gradeSystem === 'points' ? 'abi' : '1';

  const examBase = (examNumber, halbjahr) => ({
    examNumber,
    active: false,
    maxPoints: 50,
    numFields: 1,
    fieldMaxPoints: {},
    keyType: defaultExamKeyType,
    date: '',
    halbjahr,
    name: `Klausur ${examNumber}`,
    scores: {},
    courseId: course.id,
  });

  const oralBase = (oralNumber, halbjahr) => ({
    oralNumber,
    active: false,
    name: `Mündlich ${oralNumber}`,
    date: '',
    halbjahr,
    extended: false,
    weekCount: 1,
    bestNote: 1,
    worstNote: 6,
    weekSpread: 0.5,
    grades: {},
    courseId: course.id,
  });

  if (manyWeeklyHours) {
    // 4 KAs: KA1–2 Hj.1, KA3–4 Hj.2; 4 mündliche: gleiche Hj.-Aufteilung
    await prisma.exam.createMany({
      data: [
        examBase(1, '1'),
        examBase(2, '1'),
        examBase(3, '2'),
        examBase(4, '2'),
      ],
    });
    await prisma.oral.createMany({
      data: [oralBase(1, '1'), oralBase(2, '1'), oralBase(3, '2'), oralBase(4, '2')],
    });
  } else {
    // 2 KAs: KA1 Hj.1, KA2 Hj.2; 2 mündliche (Halbjahr unverändert Standard 1)
    await prisma.exam.createMany({
      data: [examBase(1, '1'), examBase(2, '2')],
    });
    await prisma.oral.createMany({
      data: [oralBase(1, '1'), oralBase(2, '2')],
    });
  }

  await prisma.test.create({
    data: {
      testNumber: 1,
      active: false,
      maxPoints: 10,
      keyType: '1',
      date: '',
      halbjahr: '1',
      name: `Test 1`,
      scores: {},
      courseId: course.id,
    },
  });
  res.json(course);
});

app.put('/api/courses/:id', async (req, res) => {
  const existing = await assertCourseAccess(req, res, req.params.id);
  if (!existing) return;
  const acting = getActingUser(req);
  const raw = { ...req.body };
  delete raw.id;
  delete raw.ownerUsername;
  const course = await prisma.course.update({
    where: { id: existing.id },
    data: raw,
  });
  res.json(course);
});

app.delete('/api/courses/:id', async (req, res) => {
  const existing = await assertCourseAccess(req, res, req.params.id);
  if (!existing) return;
  const courseId = existing.id;
  await prisma.student.deleteMany({ where: { courseId } });
  await prisma.exam.deleteMany({ where: { courseId } });
  await prisma.oral.deleteMany({ where: { courseId } });
  await prisma.test.deleteMany({ where: { courseId } });
  await prisma.gfsEntry.deleteMany({ where: { courseId } });
  await prisma.moneyList.deleteMany({ where: { courseId } });
  await prisma.attendanceList.deleteMany({ where: { courseId } });
  await prisma.collectionList.deleteMany({ where: { courseId } });
  await prisma.notesList.deleteMany({ where: { courseId } });

  await prisma.course.delete({ where: { id: courseId } });
  res.status(204).send();
});

// For backward compatibility during migration from local storage
// Because frontend migration might call PUT /api/config. We map it to creating a new course if none exists.
app.put('/api/config', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const course = await prisma.course.create({
    data: { ...req.body, ownerUsername: acting },
  });
  res.json(course);
});

function normalizeSchoolYearLabel(raw) {
  const label = String(raw ?? '').trim();
  if (!label) return { error: 'Bitte ein Schuljahr eintragen (z. B. 2026/2027).' };
  if (label.length > 32) return { error: 'Schuljahr ist zu lang (max. 32 Zeichen).' };
  return { label };
}

function schoolYearStartForSort(yearRaw) {
  const m = String(yearRaw ?? '').trim().match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function sortSchoolRosterYears(rows) {
  return [...rows].sort((a, b) => schoolYearStartForSort(b.label) - schoolYearStartForSort(a.label));
}

function parseSchoolYearId(raw) {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeSchoolRosterPayload(body) {
  const gradeLevel = parseInt(String(body?.gradeLevel ?? ''), 10);
  const firstName = String(body?.firstName ?? '').trim();
  const lastName = String(body?.lastName ?? '').trim();
  const schoolYearId = parseSchoolYearId(body?.schoolYearId);
  if (!schoolYearId) return { error: 'Schuljahr fehlt oder ist ungültig.' };
  if (!Number.isFinite(gradeLevel) || gradeLevel < 5 || gradeLevel > 13) {
    return { error: 'Klassenstufe muss zwischen 5 und 13 liegen.' };
  }
  if (!lastName) return { error: 'Nachname fehlt.' };
  if (!firstName) return { error: 'Vorname fehlt.' };
  return { gradeLevel, firstName, lastName, schoolYearId };
}

async function assertRosterYearAccess(req, res, yearId) {
  const acting = await assertActingUser(req, res);
  if (!acting) return null;
  const id = Number(yearId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Ungültige Schuljahr-ID' });
    return null;
  }
  const year = await prisma.schoolRosterYear.findUnique({ where: { id } });
  if (!year || year.ownerUsername !== acting) {
    res.status(403).json({ error: 'Kein Zugriff auf dieses Schuljahr.' });
    return null;
  }
  return { acting, year };
}

// Schuljahre (Schülerverwaltung)
app.get('/api/school-roster-years', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const rows = await prisma.schoolRosterYear.findMany({
    where: { ownerUsername: acting },
    include: { _count: { select: { students: true } } },
  });
  const out = sortSchoolRosterYears(
    rows.map(({ _count, ...y }) => ({ ...y, studentCount: _count.students })),
  );
  res.json(out);
});

app.post('/api/school-roster-years', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const norm = normalizeSchoolYearLabel(req.body?.label);
  if (norm.error) return res.status(400).json({ error: norm.error });
  try {
    const row = await prisma.schoolRosterYear.create({
      data: { label: norm.label, ownerUsername: acting },
    });
    res.json({ ...row, studentCount: 0 });
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Dieses Schuljahr existiert bereits.' });
    throw e;
  }
});

app.put('/api/school-roster-years/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const access = await assertRosterYearAccess(req, res, id);
  if (!access) return;
  const norm = normalizeSchoolYearLabel(req.body?.label);
  if (norm.error) return res.status(400).json({ error: norm.error });
  try {
    const row = await prisma.schoolRosterYear.update({
      where: { id },
      data: { label: norm.label },
      include: { _count: { select: { students: true } } },
    });
    const { _count, ...y } = row;
    res.json({ ...y, studentCount: _count.students });
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Dieses Schuljahr existiert bereits.' });
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Schuljahr nicht gefunden.' });
    throw e;
  }
});

app.delete('/api/school-roster-years/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const access = await assertRosterYearAccess(req, res, id);
  if (!access) return;
  try {
    await prisma.schoolRosterYear.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Schuljahr nicht gefunden.' });
    throw e;
  }
});

// Schulweite Schülerliste (Klassenstufe 5–13), je Schuljahr
app.get('/api/school-roster-students', async (req, res) => {
  const schoolYearId = parseSchoolYearId(req.query.schoolYearId);
  if (!schoolYearId) return res.json([]);
  const access = await assertRosterYearAccess(req, res, schoolYearId);
  if (!access) return;
  const rows = await prisma.schoolRosterStudent.findMany({
    where: { schoolYearId },
    orderBy: [{ gradeLevel: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  });
  res.json(rows);
});

app.post('/api/school-roster-students', async (req, res) => {
  const norm = normalizeSchoolRosterPayload(req.body);
  if (norm.error) return res.status(400).json({ error: norm.error });
  const access = await assertRosterYearAccess(req, res, norm.schoolYearId);
  if (!access) return;
  const row = await prisma.schoolRosterStudent.create({
    data: {
      gradeLevel: norm.gradeLevel,
      firstName: norm.firstName,
      lastName: norm.lastName,
      schoolYearId: norm.schoolYearId,
    },
  });
  res.json(row);
});

app.put('/api/school-roster-students/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const norm = normalizeSchoolRosterPayload(req.body);
  if (norm.error) return res.status(400).json({ error: norm.error });
  const access = await assertRosterYearAccess(req, res, norm.schoolYearId);
  if (!access) return;
  const row = await prisma.schoolRosterStudent.update({
    where: { id },
    data: {
      gradeLevel: norm.gradeLevel,
      firstName: norm.firstName,
      lastName: norm.lastName,
      schoolYearId: norm.schoolYearId,
    },
  });
  res.json(row);
});

/** Alle Schüler eines Schuljahres löschen (Query: schoolYearId). */
app.delete('/api/school-roster-students', async (req, res) => {
  const schoolYearId = parseSchoolYearId(req.query.schoolYearId);
  if (!schoolYearId) return res.status(400).json({ error: 'schoolYearId fehlt.' });
  const access = await assertRosterYearAccess(req, res, schoolYearId);
  if (!access) return;
  await prisma.schoolRosterStudent.deleteMany({ where: { schoolYearId } });
  res.status(204).send();
});

app.delete('/api/school-roster-students/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  await prisma.schoolRosterStudent.delete({ where: { id } });
  res.status(204).send();
});


// STUDENTS
app.get('/api/students', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json([]);
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const students = await prisma.student.findMany({
    where: { courseId },
    select: {
      id: true,
      frontendId: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      summaryEndNote: true,
      summaryHJ1Note: true,
      courseId: true,
    },
  });
  res.json(
    students.map((s) => ({
      ...s,
      frontendId: s.frontendId ? s.frontendId.toString() : null,
    })),
  );
});

/** Alle Schüler eines Kurses löschen (Kurs-Schülerliste leeren). */
app.delete('/api/students', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  await prisma.student.deleteMany({ where: { courseId } });
  await syncMoneyListEntriesForCourse(courseId);
  await syncAttendanceListEntriesForCourse(courseId);
  await syncCollectionListEntriesForCourse(courseId);
  await syncNotesListEntriesForCourse(courseId);
  res.status(204).send();
});

app.post('/api/students', async (req, res) => {
  const { id, frontendId, courseId, ...data } = req.body;
  const targetCourseId = Number(courseId);
  if (!Number.isFinite(targetCourseId)) {
    return res.status(400).json({ error: 'courseId required' });
  }
  const ok = await assertCourseAccess(req, res, targetCourseId);
  if (!ok) return;

  const last = await prisma.student.findFirst({
    where: { courseId: targetCourseId },
    orderBy: { studentNumber: 'desc' },
    select: { studentNumber: true },
  });
  const nextStudentNumber = (last?.studentNumber || 0) + 1;

  const student = await prisma.student.create({
    data: {
      ...data,
      courseId: targetCourseId,
      studentNumber: nextStudentNumber,
      frontendId: frontendId ? BigInt(frontendId) : null,
    }
  });
  await syncMoneyListEntriesForCourse(targetCourseId);
  await syncAttendanceListEntriesForCourse(targetCourseId);
  await syncCollectionListEntriesForCourse(targetCourseId);
  await syncNotesListEntriesForCourse(targetCourseId);
  res.json({ ...student, frontendId: student.frontendId ? student.frontendId.toString() : null });
});

app.put('/api/students/:id', async (req, res) => {
  const sid = Number(req.params.id);
  const existingStudent = await prisma.student.findUnique({
    where: { id: sid },
    include: { course: true },
  });
  if (!existingStudent) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existingStudent.course || !canAccessCourse(existingStudent.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  const { frontendId, id, courseId: newCourseIdRaw, ...data } = req.body;
  if (newCourseIdRaw !== undefined && Number(newCourseIdRaw) !== existingStudent.courseId) {
    const nc = await prisma.course.findUnique({ where: { id: Number(newCourseIdRaw) } });
    if (!nc || !canAccessCourse(nc, acting)) {
      return res.status(403).json({ error: 'Kein Zugriff' });
    }
  }
  const payload = { ...data };
  if (frontendId !== undefined) payload.frontendId = frontendId ? BigInt(frontendId) : null;
  if (newCourseIdRaw !== undefined) payload.courseId = Number(newCourseIdRaw);
  const student = await prisma.student.update({
    where: { id: sid },
    data: payload,
  });
  res.json({ ...student, frontendId: student.frontendId ? student.frontendId.toString() : null });
});

app.delete('/api/students/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const existing = await prisma.student.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (existing.course && !canAccessCourse(existing.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  const courseId = existing.courseId;

  await prisma.student.delete({ where: { id } });

  if (courseId != null) {
    const remaining = await prisma.student.findMany({
      where: { courseId },
      orderBy: [{ studentNumber: 'asc' }, { id: 'asc' }],
    });
    await prisma.$transaction(
      remaining.map((s, index) =>
        prisma.student.update({
          where: { id: s.id },
          data: { studentNumber: index + 1 },
        }),
      ),
    );
    await syncMoneyListEntriesForCourse(courseId);
    await syncAttendanceListEntriesForCourse(courseId);
    await syncCollectionListEntriesForCourse(courseId);
    await syncNotesListEntriesForCourse(courseId);
  }

  res.status(204).send();
});

// EXAMS
app.get('/api/exams', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json({});
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const exams = await prisma.exam.findMany({ where: { courseId } });
  const result = {};
  exams.forEach(e => result[e.examNumber] = e);
  res.json(result);
});

app.put('/api/exams/:id', async (req, res) => {
  const examNumber = Number(req.params.id);
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'courseId required' });
  }
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;

  const existingExam = await prisma.exam.findFirst({ where: { examNumber, courseId } });
  if (existingExam) {
    const { id, examNumber: en, courseId: cid, ...data } = req.body;
    const exam = await prisma.exam.update({
      where: { id: existingExam.id },
      data
    });
    res.json(exam);
  } else {
    // Should not happen for new courses since we initialize them, but for migration it might.
    const { id, examNumber: en, ...data } = req.body;
    const exam = await prisma.exam.create({
      data: { ...data, examNumber, courseId }
    });
    res.json(exam);
  }
});

app.delete('/api/exams/:id', async (req, res) => {
  const examNumber = Number(req.params.id);
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const existing = await prisma.exam.findFirst({ where: { examNumber, courseId } });
  if (!existing) return res.status(404).json({ error: 'not found' });
  await prisma.exam.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// ORALS
app.get('/api/orals', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json({});
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const orals = await prisma.oral.findMany({ where: { courseId } });
  const result = {};
  orals.forEach(o => result[o.oralNumber] = o);
  res.json(result);
});

app.put('/api/orals/:id', async (req, res) => {
  const oralNumber = Number(req.params.id);
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'courseId required' });
  }
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;

  const existingOral = await prisma.oral.findFirst({ where: { oralNumber, courseId } });
  if (existingOral) {
    const { id, oralNumber: on, courseId: cid, ...data } = req.body;
    const oral = await prisma.oral.update({
      where: { id: existingOral.id },
      data
    });
    res.json(oral);
  } else {
    const { id, oralNumber: on, ...data } = req.body;
    const oral = await prisma.oral.create({
      data: { ...data, oralNumber, courseId }
    });
    res.json(oral);
  }
});

app.delete('/api/orals/:id', async (req, res) => {
  const oralNumber = Number(req.params.id);
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const existing = await prisma.oral.findFirst({ where: { oralNumber, courseId } });
  if (!existing) return res.status(404).json({ error: 'not found' });
  await prisma.oral.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// TESTS
app.get('/api/tests', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json({});
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const tests = await prisma.test.findMany({ where: { courseId } });
  const result = {};
  tests.forEach(t => result[t.testNumber] = t);
  res.json(result);
});

app.put('/api/tests/:id', async (req, res) => {
  const testNumber = Number(req.params.id);
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'courseId required' });
  }
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;

  const existingTest = await prisma.test.findFirst({ where: { testNumber, courseId } });
  if (existingTest) {
    const { id, testNumber: tn, courseId: cid, ...data } = req.body;
    const test = await prisma.test.update({
      where: { id: existingTest.id },
      data
    });
    res.json(test);
  } else {
    const { id, testNumber: tn, ...data } = req.body;
    const test = await prisma.test.create({
      data: { ...data, testNumber, courseId }
    });
    res.json(test);
  }
});

// GFS (Gleichwertige Feststellung der Schülerleistungen)
app.get('/api/gfs', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json([]);
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const rows = await prisma.gfsEntry.findMany({
    where: { courseId },
    orderBy: { id: 'asc' },
  });
  res.json(rows);
});

app.post('/api/gfs', async (req, res) => {
  const courseId = Number(req.body.courseId);
  const studentId = Number(req.body.studentId);
  if (!studentId) return res.status(400).json({ error: 'studentId required' });
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;

  const thema = req.body.thema ?? '';
  const art = req.body.art ?? '';
  const date = req.body.date ?? '';
  const gehalten = Boolean(req.body.gehalten);
  const halbjahr = req.body.halbjahr != null ? String(req.body.halbjahr) : '1';
  const note = req.body.note != null ? String(req.body.note) : '';

  const entry = await prisma.gfsEntry.create({
    data: {
      courseId,
      studentId,
      thema: String(thema),
      art: String(art),
      date: String(date),
      gehalten,
      halbjahr: halbjahr === '2' ? '2' : '1',
      note: String(note),
    },
  });
  res.json(entry);
});

app.put('/api/gfs/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existingEntry = await prisma.gfsEntry.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existingEntry) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existingEntry.course || !canAccessCourse(existingEntry.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }

  const { thema, art, date, gehalten, halbjahr, note, studentId, courseId: bodyCourseId } = req.body;
  const data = {};
  if (thema !== undefined) data.thema = String(thema);
  if (art !== undefined) data.art = String(art);
  if (date !== undefined) data.date = String(date);
  if (gehalten !== undefined) data.gehalten = Boolean(gehalten);
  if (halbjahr !== undefined) data.halbjahr = String(halbjahr) === '2' ? '2' : '1';
  if (note !== undefined) data.note = String(note);
  if (Number.isFinite(Number(studentId))) data.studentId = Number(studentId);
  if (bodyCourseId !== undefined && Number.isFinite(Number(bodyCourseId))) {
    const nc = await prisma.course.findUnique({ where: { id: Number(bodyCourseId) } });
    if (!nc || !canAccessCourse(nc, acting)) {
      return res.status(403).json({ error: 'Kein Zugriff' });
    }
    data.courseId = Number(bodyCourseId);
  }

  const entry = await prisma.gfsEntry.update({
    where: { id },
    data,
  });
  res.json(entry);
});

app.delete('/api/gfs/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existingEntry = await prisma.gfsEntry.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existingEntry) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existingEntry.course || !canAccessCourse(existingEntry.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  await prisma.gfsEntry.delete({ where: { id } });
  res.status(204).send();
});

/** Geldlisten-Zeilen an die aktuelle Kurs-Schülerliste anpassen (hinzufügen / entfernen). */
async function syncCollectionListEntriesForCourse(courseId) {
  const [lists, students] = await Promise.all([
    prisma.collectionList.findMany({ where: { courseId, externalOnly: false }, select: { id: true } }),
    prisma.student.findMany({ where: { courseId }, select: { id: true } }),
  ]);
  const studentIds = new Set(students.map((s) => s.id));

  for (const list of lists) {
    const existing = await prisma.collectionListEntry.findMany({
      where: { collectionListId: list.id, studentId: { not: null } },
      select: { id: true, studentId: true },
    });
    const existingStudentIds = new Set(existing.map((e) => e.studentId));
    const toAdd = [...studentIds].filter((sid) => !existingStudentIds.has(sid));
    const orphanIds = existing.filter((e) => !studentIds.has(e.studentId)).map((e) => e.id);

    if (toAdd.length > 0) {
      await prisma.collectionListEntry.createMany({
        data: toAdd.map((studentId) => ({
          collectionListId: list.id,
          studentId,
          collected: false,
        })),
      });
    }
    if (orphanIds.length > 0) {
      await prisma.collectionListEntry.deleteMany({ where: { id: { in: orphanIds } } });
    }
  }
}

async function syncAttendanceListEntriesForCourse(courseId) {
  const [lists, students] = await Promise.all([
    prisma.attendanceList.findMany({ where: { courseId, externalOnly: false }, select: { id: true } }),
    prisma.student.findMany({ where: { courseId }, select: { id: true } }),
  ]);
  const studentIds = new Set(students.map((s) => s.id));

  for (const list of lists) {
    const existing = await prisma.attendanceListEntry.findMany({
      where: { attendanceListId: list.id, studentId: { not: null } },
      select: { id: true, studentId: true },
    });
    const existingStudentIds = new Set(existing.map((e) => e.studentId));
    const toAdd = [...studentIds].filter((sid) => !existingStudentIds.has(sid));
    const orphanIds = existing.filter((e) => !studentIds.has(e.studentId)).map((e) => e.id);

    if (toAdd.length > 0) {
      await prisma.attendanceListEntry.createMany({
        data: toAdd.map((studentId) => ({
          attendanceListId: list.id,
          studentId,
          present: false,
        })),
      });
    }
    if (orphanIds.length > 0) {
      await prisma.attendanceListEntry.deleteMany({ where: { id: { in: orphanIds } } });
    }
  }
}

async function syncNotesListEntriesForCourse(courseId) {
  const [lists, students] = await Promise.all([
    prisma.notesList.findMany({ where: { courseId, externalOnly: false }, select: { id: true } }),
    prisma.student.findMany({ where: { courseId }, select: { id: true } }),
  ]);
  const studentIds = new Set(students.map((s) => s.id));

  for (const list of lists) {
    const existing = await prisma.notesListEntry.findMany({
      where: { notesListId: list.id, studentId: { not: null } },
      select: { id: true, studentId: true },
    });
    const existingStudentIds = new Set(existing.map((e) => e.studentId));
    const toAdd = [...studentIds].filter((sid) => !existingStudentIds.has(sid));
    const orphanIds = existing.filter((e) => !studentIds.has(e.studentId)).map((e) => e.id);

    if (toAdd.length > 0) {
      await prisma.notesListEntry.createMany({
        data: toAdd.map((studentId) => ({
          notesListId: list.id,
          studentId,
          remark: '',
        })),
      });
    }
    if (orphanIds.length > 0) {
      await prisma.notesListEntry.deleteMany({ where: { id: { in: orphanIds } } });
    }
  }
}

async function syncMoneyListEntriesForCourse(courseId) {
  if (!Number.isFinite(courseId)) return;

  const [lists, students] = await Promise.all([
    prisma.moneyList.findMany({ where: { courseId, externalOnly: false }, select: { id: true } }),
    prisma.student.findMany({ where: { courseId }, select: { id: true } }),
  ]);
  if (lists.length === 0) return;

  const studentIds = new Set(students.map((s) => s.id));

  for (const list of lists) {
    const existing = await prisma.moneyListEntry.findMany({
      where: { moneyListId: list.id, studentId: { not: null } },
      select: { id: true, studentId: true },
    });
    const existingStudentIds = new Set(existing.map((e) => e.studentId));

    const missingStudentIds = students
      .map((s) => s.id)
      .filter((sid) => !existingStudentIds.has(sid));
    if (missingStudentIds.length > 0) {
      await prisma.moneyListEntry.createMany({
        data: missingStudentIds.map((studentId) => ({
          moneyListId: list.id,
          studentId,
          paid: false,
        })),
      });
    }

    const orphanIds = existing.filter((e) => !studentIds.has(e.studentId)).map((e) => e.id);
    if (orphanIds.length > 0) {
      await prisma.moneyListEntry.deleteMany({ where: { id: { in: orphanIds } } });
    }
  }
}

function parseListExternalFlags(body) {
  const externalOnly = Boolean(body.externalOnly);
  const includeExternal = externalOnly || Boolean(body.includeExternal);
  return { includeExternal, externalOnly };
}

function parseExternalPersonNames(body) {
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  if (!firstName || !lastName) return { error: 'Vor- und Nachname erforderlich' };
  return { firstName, lastName };
}

function mapSerializedListEntry(e, statusField) {
  const isExternal = e.studentId == null;
  const row = {
    id: e.id,
    isExternal,
    studentId: e.studentId ?? null,
    studentNumber: isExternal ? null : (e.student?.studentNumber ?? null),
    firstName: isExternal ? (e.externalFirstName ?? '') : (e.student?.firstName ?? ''),
    lastName: isExternal ? (e.externalLastName ?? '') : (e.student?.lastName ?? ''),
  };
  row[statusField] = Boolean(e[statusField]);
  return row;
}

function mapSerializedNotesListEntry(e) {
  const isExternal = e.studentId == null;
  return {
    id: e.id,
    isExternal,
    studentId: e.studentId ?? null,
    studentNumber: isExternal ? null : (e.student?.studentNumber ?? null),
    firstName: isExternal ? (e.externalFirstName ?? '') : (e.student?.firstName ?? ''),
    lastName: isExternal ? (e.externalLastName ?? '') : (e.student?.lastName ?? ''),
    remark: e.remark ?? '',
  };
}

function sortSerializedListEntries(entries) {
  return entries.sort((a, b) => {
    if (a.isExternal !== b.isExternal) return a.isExternal ? 1 : -1;
    const an = a.studentNumber;
    const bn = b.studentNumber;
    const anOk = an !== undefined && an !== null;
    const bnOk = bn !== undefined && bn !== null;
    if (anOk && bnOk) return an - bn;
    if (anOk && !bnOk) return -1;
    if (!anOk && bnOk) return 1;
    return a.id - b.id;
  });
}

function parseMoneyListDueDate(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { value: null };
  const s = String(raw).trim();
  const d = new Date(s.includes('T') ? s : `${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { error: 'Ungültiges Fälligkeitsdatum' };
  return { value: d };
}

function parseOptionalSessionDate(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { value: null };
  const s = String(raw).trim();
  if (!s) return { value: null };
  const d = new Date(s.includes('T') ? s : `${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { error: 'Ungültiges Datum' };
  return { value: d };
}

function serializeMoneyList(list) {
  const entries = sortSerializedListEntries(
    (list.entries || []).map((e) => mapSerializedListEntry(e, 'paid')),
  );
  return {
    id: list.id,
    subject: list.subject,
    amountPerStudent: list.amountPerStudent,
    notes: list.notes ?? '',
    dueDate: list.dueDate ?? null,
    includeExternal: Boolean(list.includeExternal),
    externalOnly: Boolean(list.externalOnly),
    courseId: list.courseId,
    createdAt: list.createdAt,
    entries,
  };
}

// Geldlisten (Klassenlehrer)
app.get('/api/money-lists', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json([]);
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const lists = await prisma.moneyList.findMany({
    where: { courseId },
    orderBy: { id: 'asc' },
    include: {
      entries: {
        include: { student: true },
      },
    },
  });
  res.json(lists.map(serializeMoneyList));
});

app.post('/api/money-lists', async (req, res) => {
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;

  const subject = String(req.body.subject ?? '').trim();
  if (!subject) return res.status(400).json({ error: 'Betreff erforderlich' });

  const amountRaw = req.body.amountPerStudent;
  const amountPerStudent = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw).replace(',', '.'));
  if (!Number.isFinite(amountPerStudent) || amountPerStudent < 0) {
    return res.status(400).json({ error: 'Ungültiger Betrag' });
  }

  const notes = req.body.notes != null ? String(req.body.notes).trim() : '';

  const dueParsed = parseMoneyListDueDate(req.body.dueDate);
  if (dueParsed.error) return res.status(400).json({ error: dueParsed.error });

  const { includeExternal, externalOnly } = parseListExternalFlags(req.body);

  const courseStudents = externalOnly
    ? []
    : await prisma.student.findMany({
        where: { courseId },
        orderBy: [{ studentNumber: 'asc' }, { id: 'asc' }],
      });

  const list = await prisma.moneyList.create({
    data: {
      courseId,
      subject,
      amountPerStudent,
      notes,
      dueDate: dueParsed.skip ? null : dueParsed.value,
      includeExternal,
      externalOnly,
      ...(courseStudents.length > 0
        ? {
            entries: {
              create: courseStudents.map((s) => ({
                studentId: s.id,
                paid: false,
              })),
            },
          }
        : {}),
    },
    include: {
      entries: { include: { student: true } },
    },
  });

  res.status(201).json(serializeMoneyList(list));
});

app.put('/api/money-lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.moneyList.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, existing.courseId);
  if (!ok) return;

  const data = {};

  if (req.body.subject !== undefined) {
    const subject = String(req.body.subject ?? '').trim();
    if (!subject) return res.status(400).json({ error: 'Betreff erforderlich' });
    data.subject = subject;
  }

  if (req.body.amountPerStudent !== undefined) {
    const amountRaw = req.body.amountPerStudent;
    const amountPerStudent =
      typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw).replace(',', '.'));
    if (!Number.isFinite(amountPerStudent) || amountPerStudent < 0) {
      return res.status(400).json({ error: 'Ungültiger Betrag' });
    }
    data.amountPerStudent = amountPerStudent;
  }

  if (req.body.notes !== undefined) {
    data.notes = req.body.notes != null ? String(req.body.notes).trim() : '';
  }

  if (req.body.dueDate !== undefined) {
    const dueParsed = parseMoneyListDueDate(req.body.dueDate);
    if (dueParsed.error) return res.status(400).json({ error: dueParsed.error });
    data.dueDate = dueParsed.value;
  }

  if (req.body.includeExternal !== undefined || req.body.externalOnly !== undefined) {
    const flags = parseListExternalFlags({
      includeExternal: req.body.includeExternal ?? existing.includeExternal,
      externalOnly: req.body.externalOnly ?? existing.externalOnly,
    });
    data.includeExternal = flags.includeExternal;
    data.externalOnly = flags.externalOnly;
  }

  const list = await prisma.moneyList.update({
    where: { id },
    data,
    include: {
      entries: { include: { student: true } },
    },
  });

  res.json(serializeMoneyList(list));
});

app.delete('/api/money-lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.moneyList.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, existing.courseId);
  if (!ok) return;

  await prisma.moneyList.delete({ where: { id } });
  res.status(204).end();
});

app.put('/api/money-list-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.moneyListEntry.findUnique({
    where: { id },
    include: { moneyList: { include: { course: true } }, student: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.moneyList?.course || !canAccessCourse(existing.moneyList.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }

  const data = {};
  if (req.body.paid !== undefined) data.paid = Boolean(req.body.paid);

  const updated = await prisma.moneyListEntry.update({
    where: { id },
    data,
    include: { student: true },
  });

  res.json({ ...mapSerializedListEntry(updated, 'paid'), moneyListId: updated.moneyListId });
});

app.post('/api/money-lists/:id/external-entries', async (req, res) => {
  const listId = Number(req.params.id);
  const list = await prisma.moneyList.findUnique({
    where: { id: listId },
    include: { course: true },
  });
  if (!list) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, list.courseId);
  if (!ok) return;
  if (!list.includeExternal && !list.externalOnly) {
    return res.status(400).json({ error: 'Externe Personen sind für diese Liste nicht aktiviert' });
  }

  const names = parseExternalPersonNames(req.body);
  if (names.error) return res.status(400).json({ error: names.error });

  const entry = await prisma.moneyListEntry.create({
    data: {
      moneyListId: listId,
      externalFirstName: names.firstName,
      externalLastName: names.lastName,
      paid: false,
    },
    include: { student: true },
  });

  res.status(201).json({ ...mapSerializedListEntry(entry, 'paid'), moneyListId: entry.moneyListId });
});

app.delete('/api/money-list-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.moneyListEntry.findUnique({
    where: { id },
    include: { moneyList: { include: { course: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.moneyList?.course || !canAccessCourse(existing.moneyList.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  if (existing.studentId != null) {
    return res.status(400).json({ error: 'Kurs-Schüler können hier nicht entfernt werden' });
  }
  await prisma.moneyListEntry.delete({ where: { id } });
  res.status(204).end();
});

function serializeAttendanceList(list) {
  const entries = sortSerializedListEntries(
    (list.entries || []).map((e) => mapSerializedListEntry(e, 'present')),
  );
  return {
    id: list.id,
    subject: list.subject,
    sessionDate: list.sessionDate ?? null,
    notes: list.notes ?? '',
    includeExternal: Boolean(list.includeExternal),
    externalOnly: Boolean(list.externalOnly),
    courseId: list.courseId,
    createdAt: list.createdAt,
    entries,
  };
}

// Anwesenheitslisten (Klassenlehrer)
app.get('/api/attendance-lists', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json([]);
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const lists = await prisma.attendanceList.findMany({
    where: { courseId },
    orderBy: { id: 'asc' },
    include: {
      entries: {
        include: { student: true },
      },
    },
  });
  res.json(lists.map(serializeAttendanceList));
});

app.post('/api/attendance-lists', async (req, res) => {
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;

  const subject = String(req.body.subject ?? '').trim();
  if (!subject) return res.status(400).json({ error: 'Betreff erforderlich' });

  const dateParsed = parseOptionalSessionDate(req.body.sessionDate);
  if (dateParsed.error) return res.status(400).json({ error: dateParsed.error });

  const notes = req.body.notes != null ? String(req.body.notes).trim() : '';
  const { includeExternal, externalOnly } = parseListExternalFlags(req.body);

  const courseStudents = externalOnly
    ? []
    : await prisma.student.findMany({
        where: { courseId },
        orderBy: [{ studentNumber: 'asc' }, { id: 'asc' }],
      });

  const list = await prisma.attendanceList.create({
    data: {
      courseId,
      subject,
      sessionDate: dateParsed.skip ? null : dateParsed.value,
      notes,
      includeExternal,
      externalOnly,
      ...(courseStudents.length > 0
        ? {
            entries: {
              create: courseStudents.map((s) => ({
                studentId: s.id,
                present: false,
              })),
            },
          }
        : {}),
    },
    include: {
      entries: { include: { student: true } },
    },
  });

  res.status(201).json(serializeAttendanceList(list));
});

app.put('/api/attendance-lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.attendanceList.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, existing.courseId);
  if (!ok) return;

  const data = {};

  if (req.body.subject !== undefined) {
    const subject = String(req.body.subject ?? '').trim();
    if (!subject) return res.status(400).json({ error: 'Betreff erforderlich' });
    data.subject = subject;
  }

  if (req.body.sessionDate !== undefined) {
    const dateParsed = parseOptionalSessionDate(req.body.sessionDate);
    if (dateParsed.error) return res.status(400).json({ error: dateParsed.error });
    data.sessionDate = dateParsed.value;
  }

  if (req.body.notes !== undefined) {
    data.notes = req.body.notes != null ? String(req.body.notes).trim() : '';
  }

  if (req.body.includeExternal !== undefined || req.body.externalOnly !== undefined) {
    const flags = parseListExternalFlags({
      includeExternal: req.body.includeExternal ?? existing.includeExternal,
      externalOnly: req.body.externalOnly ?? existing.externalOnly,
    });
    data.includeExternal = flags.includeExternal;
    data.externalOnly = flags.externalOnly;
  }

  const list = await prisma.attendanceList.update({
    where: { id },
    data,
    include: {
      entries: { include: { student: true } },
    },
  });

  res.json(serializeAttendanceList(list));
});

app.delete('/api/attendance-lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.attendanceList.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, existing.courseId);
  if (!ok) return;

  await prisma.attendanceList.delete({ where: { id } });
  res.status(204).end();
});

app.put('/api/attendance-list-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.attendanceListEntry.findUnique({
    where: { id },
    include: { attendanceList: { include: { course: true } }, student: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.attendanceList?.course || !canAccessCourse(existing.attendanceList.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }

  const data = {};
  if (req.body.present !== undefined) data.present = Boolean(req.body.present);

  const updated = await prisma.attendanceListEntry.update({
    where: { id },
    data,
    include: { student: true },
  });

  res.json({ ...mapSerializedListEntry(updated, 'present'), attendanceListId: updated.attendanceListId });
});

app.post('/api/attendance-lists/:id/external-entries', async (req, res) => {
  const listId = Number(req.params.id);
  const list = await prisma.attendanceList.findUnique({
    where: { id: listId },
    include: { course: true },
  });
  if (!list) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, list.courseId);
  if (!ok) return;
  if (!list.includeExternal && !list.externalOnly) {
    return res.status(400).json({ error: 'Externe Personen sind für diese Liste nicht aktiviert' });
  }

  const names = parseExternalPersonNames(req.body);
  if (names.error) return res.status(400).json({ error: names.error });

  const entry = await prisma.attendanceListEntry.create({
    data: {
      attendanceListId: listId,
      externalFirstName: names.firstName,
      externalLastName: names.lastName,
      present: false,
    },
    include: { student: true },
  });

  res.status(201).json({ ...mapSerializedListEntry(entry, 'present'), attendanceListId: entry.attendanceListId });
});

app.delete('/api/attendance-list-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.attendanceListEntry.findUnique({
    where: { id },
    include: { attendanceList: { include: { course: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.attendanceList?.course || !canAccessCourse(existing.attendanceList.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  if (existing.studentId != null) {
    return res.status(400).json({ error: 'Kurs-Schüler können hier nicht entfernt werden' });
  }
  await prisma.attendanceListEntry.delete({ where: { id } });
  res.status(204).end();
});

function serializeCollectionList(list) {
  const entries = sortSerializedListEntries(
    (list.entries || []).map((e) => mapSerializedListEntry(e, 'collected')),
  );
  return {
    id: list.id,
    subject: list.subject,
    sessionDate: list.sessionDate ?? null,
    notes: list.notes ?? '',
    includeExternal: Boolean(list.includeExternal),
    externalOnly: Boolean(list.externalOnly),
    courseId: list.courseId,
    createdAt: list.createdAt,
    entries,
  };
}

// Sammellisten (Klassenlehrer)
app.get('/api/collection-lists', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json([]);
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const lists = await prisma.collectionList.findMany({
    where: { courseId },
    orderBy: { id: 'asc' },
    include: {
      entries: {
        include: { student: true },
      },
    },
  });
  res.json(lists.map(serializeCollectionList));
});

app.post('/api/collection-lists', async (req, res) => {
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;

  const subject = String(req.body.subject ?? '').trim();
  if (!subject) return res.status(400).json({ error: 'Betreff erforderlich' });

  const dateParsed = parseOptionalSessionDate(req.body.sessionDate);
  if (dateParsed.error) return res.status(400).json({ error: dateParsed.error });

  const notes = req.body.notes != null ? String(req.body.notes).trim() : '';
  const { includeExternal, externalOnly } = parseListExternalFlags(req.body);

  const courseStudents = externalOnly
    ? []
    : await prisma.student.findMany({
        where: { courseId },
        orderBy: [{ studentNumber: 'asc' }, { id: 'asc' }],
      });

  const list = await prisma.collectionList.create({
    data: {
      courseId,
      subject,
      sessionDate: dateParsed.skip ? null : dateParsed.value,
      notes,
      includeExternal,
      externalOnly,
      ...(courseStudents.length > 0
        ? {
            entries: {
              create: courseStudents.map((s) => ({
                studentId: s.id,
                collected: false,
              })),
            },
          }
        : {}),
    },
    include: {
      entries: { include: { student: true } },
    },
  });

  res.status(201).json(serializeCollectionList(list));
});

app.put('/api/collection-lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.collectionList.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, existing.courseId);
  if (!ok) return;

  const data = {};

  if (req.body.subject !== undefined) {
    const subject = String(req.body.subject ?? '').trim();
    if (!subject) return res.status(400).json({ error: 'Betreff erforderlich' });
    data.subject = subject;
  }

  if (req.body.sessionDate !== undefined) {
    const dateParsed = parseOptionalSessionDate(req.body.sessionDate);
    if (dateParsed.error) return res.status(400).json({ error: dateParsed.error });
    data.sessionDate = dateParsed.value;
  }

  if (req.body.notes !== undefined) {
    data.notes = req.body.notes != null ? String(req.body.notes).trim() : '';
  }

  if (req.body.includeExternal !== undefined || req.body.externalOnly !== undefined) {
    const flags = parseListExternalFlags({
      includeExternal: req.body.includeExternal ?? existing.includeExternal,
      externalOnly: req.body.externalOnly ?? existing.externalOnly,
    });
    data.includeExternal = flags.includeExternal;
    data.externalOnly = flags.externalOnly;
  }

  const list = await prisma.collectionList.update({
    where: { id },
    data,
    include: {
      entries: { include: { student: true } },
    },
  });

  res.json(serializeCollectionList(list));
});

app.delete('/api/collection-lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.collectionList.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, existing.courseId);
  if (!ok) return;

  await prisma.collectionList.delete({ where: { id } });
  res.status(204).end();
});

app.put('/api/collection-list-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.collectionListEntry.findUnique({
    where: { id },
    include: { collectionList: { include: { course: true } }, student: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.collectionList?.course || !canAccessCourse(existing.collectionList.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }

  const data = {};
  if (req.body.collected !== undefined) data.collected = Boolean(req.body.collected);

  const updated = await prisma.collectionListEntry.update({
    where: { id },
    data,
    include: { student: true },
  });

  res.json({ ...mapSerializedListEntry(updated, 'collected'), collectionListId: updated.collectionListId });
});

app.post('/api/collection-lists/:id/external-entries', async (req, res) => {
  const listId = Number(req.params.id);
  const list = await prisma.collectionList.findUnique({
    where: { id: listId },
    include: { course: true },
  });
  if (!list) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, list.courseId);
  if (!ok) return;
  if (!list.includeExternal && !list.externalOnly) {
    return res.status(400).json({ error: 'Externe Personen sind für diese Liste nicht aktiviert' });
  }

  const names = parseExternalPersonNames(req.body);
  if (names.error) return res.status(400).json({ error: names.error });

  const entry = await prisma.collectionListEntry.create({
    data: {
      collectionListId: listId,
      externalFirstName: names.firstName,
      externalLastName: names.lastName,
      collected: false,
    },
    include: { student: true },
  });

  res.status(201).json({ ...mapSerializedListEntry(entry, 'collected'), collectionListId: entry.collectionListId });
});

app.delete('/api/collection-list-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.collectionListEntry.findUnique({
    where: { id },
    include: { collectionList: { include: { course: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.collectionList?.course || !canAccessCourse(existing.collectionList.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  if (existing.studentId != null) {
    return res.status(400).json({ error: 'Kurs-Schüler können hier nicht entfernt werden' });
  }
  await prisma.collectionListEntry.delete({ where: { id } });
  res.status(204).end();
});

function serializeNotesList(list) {
  const entries = sortSerializedListEntries((list.entries || []).map(mapSerializedNotesListEntry));
  return {
    id: list.id,
    subject: list.subject,
    sessionDate: list.sessionDate ?? null,
    notes: list.notes ?? '',
    includeExternal: Boolean(list.includeExternal),
    externalOnly: Boolean(list.externalOnly),
    courseId: list.courseId,
    createdAt: list.createdAt,
    entries,
  };
}

// Notizenlisten (Klassenlehrer)
app.get('/api/notes-lists', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json([]);
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const lists = await prisma.notesList.findMany({
    where: { courseId },
    orderBy: { id: 'asc' },
    include: {
      entries: {
        include: { student: true },
      },
    },
  });
  res.json(lists.map(serializeNotesList));
});

app.post('/api/notes-lists', async (req, res) => {
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;

  const subject = String(req.body.subject ?? '').trim();
  if (!subject) return res.status(400).json({ error: 'Betreff erforderlich' });

  const dateParsed = parseOptionalSessionDate(req.body.sessionDate);
  if (dateParsed.error) return res.status(400).json({ error: dateParsed.error });

  const notes = req.body.notes != null ? String(req.body.notes).trim() : '';
  const { includeExternal, externalOnly } = parseListExternalFlags(req.body);

  const courseStudents = externalOnly
    ? []
    : await prisma.student.findMany({
        where: { courseId },
        orderBy: [{ studentNumber: 'asc' }, { id: 'asc' }],
      });

  const list = await prisma.notesList.create({
    data: {
      courseId,
      subject,
      sessionDate: dateParsed.skip ? null : dateParsed.value,
      notes,
      includeExternal,
      externalOnly,
      ...(courseStudents.length > 0
        ? {
            entries: {
              create: courseStudents.map((s) => ({
                studentId: s.id,
                remark: '',
              })),
            },
          }
        : {}),
    },
    include: {
      entries: { include: { student: true } },
    },
  });

  res.status(201).json(serializeNotesList(list));
});

app.put('/api/notes-lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.notesList.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, existing.courseId);
  if (!ok) return;

  const data = {};

  if (req.body.subject !== undefined) {
    const subject = String(req.body.subject ?? '').trim();
    if (!subject) return res.status(400).json({ error: 'Betreff erforderlich' });
    data.subject = subject;
  }

  if (req.body.sessionDate !== undefined) {
    const dateParsed = parseOptionalSessionDate(req.body.sessionDate);
    if (dateParsed.error) return res.status(400).json({ error: dateParsed.error });
    data.sessionDate = dateParsed.value;
  }

  if (req.body.notes !== undefined) {
    data.notes = req.body.notes != null ? String(req.body.notes).trim() : '';
  }

  if (req.body.includeExternal !== undefined || req.body.externalOnly !== undefined) {
    const flags = parseListExternalFlags({
      includeExternal: req.body.includeExternal ?? existing.includeExternal,
      externalOnly: req.body.externalOnly ?? existing.externalOnly,
    });
    data.includeExternal = flags.includeExternal;
    data.externalOnly = flags.externalOnly;
  }

  const list = await prisma.notesList.update({
    where: { id },
    data,
    include: {
      entries: { include: { student: true } },
    },
  });

  res.json(serializeNotesList(list));
});

app.delete('/api/notes-lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.notesList.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, existing.courseId);
  if (!ok) return;

  await prisma.notesList.delete({ where: { id } });
  res.status(204).end();
});

app.put('/api/notes-list-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.notesListEntry.findUnique({
    where: { id },
    include: { notesList: { include: { course: true } }, student: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.notesList?.course || !canAccessCourse(existing.notesList.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }

  const data = {};
  if (req.body.remark !== undefined) {
    data.remark = req.body.remark != null ? String(req.body.remark) : '';
  }

  const updated = await prisma.notesListEntry.update({
    where: { id },
    data,
    include: { student: true },
  });

  res.json({ ...mapSerializedNotesListEntry(updated), notesListId: updated.notesListId });
});

app.post('/api/notes-lists/:id/external-entries', async (req, res) => {
  const listId = Number(req.params.id);
  const list = await prisma.notesList.findUnique({
    where: { id: listId },
    include: { course: true },
  });
  if (!list) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseAccess(req, res, list.courseId);
  if (!ok) return;
  if (!list.includeExternal && !list.externalOnly) {
    return res.status(400).json({ error: 'Externe Personen sind für diese Liste nicht aktiviert' });
  }

  const names = parseExternalPersonNames(req.body);
  if (names.error) return res.status(400).json({ error: names.error });

  const entry = await prisma.notesListEntry.create({
    data: {
      notesListId: listId,
      externalFirstName: names.firstName,
      externalLastName: names.lastName,
      remark: '',
    },
    include: { student: true },
  });

  res.status(201).json({ ...mapSerializedNotesListEntry(entry), notesListId: entry.notesListId });
});

app.delete('/api/notes-list-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.notesListEntry.findUnique({
    where: { id },
    include: { notesList: { include: { course: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.notesList?.course || !canAccessCourse(existing.notesList.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  if (existing.studentId != null) {
    return res.status(400).json({ error: 'Kurs-Schüler können hier nicht entfernt werden' });
  }
  await prisma.notesListEntry.delete({ where: { id } });
  res.status(204).end();
});

// ——— Backup: benutzerbezogen (eigene Kurse) / vollständig (Admin) ———

function backupPkgBuildMeta() {
  return { appBuild: String(require('./package.json').version || '').split('.')[0] || null };
}

function sendBackupDownload(res, payload) {
  const body = serializeBackupPayload(payload);
  const filename = backupFilenameFromPayload(payload);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

function readBackupBody(req) {
  const raw = req.body?.backup != null ? req.body.backup : req.body;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw;
}

/** Eigenes Backup: nur Kurse/Noten des angemeldeten Benutzers. */
app.get('/api/backup/me/download', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const mode = String(req.query.mode || 'decrypted').toLowerCase();
  try {
    const payload =
      mode === 'raw'
        ? await runWithCryptoContext({ bypassCrypto: true }, () =>
            exportPhixUserDatabaseRaw(prisma, acting, backupPkgBuildMeta()),
          )
        : await exportPhixUserDatabaseDecrypted(prisma, acting, backupPkgBuildMeta());
    sendBackupDownload(res, payload);
  } catch (err) {
    console.error('[backup] Benutzer-Export fehlgeschlagen:', err);
    res.status(500).json({ error: err?.message || 'Backup konnte nicht erstellt werden.' });
  }
});

app.post('/api/backup/me/restore', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const raw = readBackupBody(req);
  if (!raw) return res.status(400).json({ error: 'Keine Backup-Daten im Request-Body.' });
  try {
    const dek = getDekFromContext();
    const result = await restorePhixUserDatabase(prisma, raw, acting, { dek });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[backup] Benutzer-Wiederherstellung fehlgeschlagen:', err);
    res.status(400).json({ error: err?.message || 'Wiederherstellung fehlgeschlagen.' });
  }
});

/** Vollständiges Datenbank-Backup (nur Administrator). */
app.get('/api/backup/full/download', async (req, res) => {
  const acting = await assertAdminUser(req, res);
  if (!acting) return;
  try {
    const payload = await runWithCryptoContext({ bypassCrypto: true }, () =>
      exportPhixDatabase(prisma, backupPkgBuildMeta()),
    );
    sendBackupDownload(res, payload);
  } catch (err) {
    console.error('[backup] Voll-Export fehlgeschlagen:', err);
    res.status(500).json({ error: 'Backup konnte nicht erstellt werden.' });
  }
});

app.post('/api/backup/full/restore', async (req, res) => {
  const acting = await assertAdminUser(req, res);
  if (!acting) return;
  const raw = readBackupBody(req);
  if (!raw) return res.status(400).json({ error: 'Keine Backup-Daten im Request-Body.' });
  try {
    const result = await runWithCryptoContext({ bypassCrypto: true }, () =>
      restorePhixDatabase(prisma, raw),
    );
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[backup] Voll-Wiederherstellung fehlgeschlagen:', err);
    res.status(400).json({ error: err?.message || 'Wiederherstellung fehlgeschlagen.' });
  }
});

/** Backup eines bestimmten Benutzers (nur Administrator). */
app.get('/api/backup/users/:username/download', async (req, res) => {
  const acting = await assertAdminUser(req, res);
  if (!acting) return;
  const target = String(req.params.username ?? '').trim();
  if (!target) return res.status(400).json({ error: 'Benutzername fehlt.' });
  const mode = String(req.query.mode || 'raw').toLowerCase();
  try {
    const stored = await resolveStoredUsername(prisma, target);
    if (!stored) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    let payload;
    if (mode === 'decrypted') {
      const recoveryKey = String(req.get('X-Phix-Recovery-Key') || req.body?.recoveryKey || '').trim();
      if (!recoveryKey) {
        return res.status(400).json({
          error: 'Für lesbares Backup Recovery-Key im Header X-Phix-Recovery-Key übergeben.',
        });
      }
      const targetUser = await prisma.appUser.findFirst({ where: usernameWhere(stored) });
      const uc = await prisma.userCrypto.findUnique({ where: { userId: targetUser.id } });
      if (!uc) return res.status(400).json({ error: 'Zielbenutzer hat keine Verschlüsselung.' });
      const dek = await unwrapDekFromRecovery(uc, recoveryKey);
      payload = await runWithCryptoContext({ dek, userId: targetUser.id }, () =>
        exportPhixUserDatabaseDecrypted(prisma, stored, backupPkgBuildMeta()),
      );
    } else {
      payload = await runWithCryptoContext({ bypassCrypto: true }, () =>
        exportPhixUserDatabaseRaw(prisma, stored, backupPkgBuildMeta()),
      );
    }
    sendBackupDownload(res, payload);
  } catch (err) {
    console.error('[backup] Benutzer-Export (Admin) fehlgeschlagen:', err);
    res.status(500).json({ error: err?.message || 'Backup konnte nicht erstellt werden.' });
  }
});

app.post('/api/backup/users/:username/restore', async (req, res) => {
  const acting = await assertAdminUser(req, res);
  if (!acting) return;
  const target = String(req.params.username ?? '').trim();
  if (!target) return res.status(400).json({ error: 'Benutzername fehlt.' });
  const raw = readBackupBody(req);
  if (!raw) return res.status(400).json({ error: 'Keine Backup-Daten im Request-Body.' });
  try {
    const stored = await resolveStoredUsername(prisma, target);
    if (!stored) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    let dek = getDekFromContext();
    const recoveryKey = String(req.body?.recoveryKey || req.get('X-Phix-Recovery-Key') || '').trim();
    if (!dek && recoveryKey) {
      const targetUser = await prisma.appUser.findFirst({ where: usernameWhere(stored) });
      const uc = await prisma.userCrypto.findUnique({ where: { userId: targetUser.id } });
      if (uc) dek = await unwrapDekFromRecovery(uc, recoveryKey);
    }
    const result = await restorePhixUserDatabase(prisma, raw, stored, { dek });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[backup] Benutzer-Wiederherstellung (Admin) fehlgeschlagen:', err);
    res.status(400).json({ error: err?.message || 'Wiederherstellung fehlgeschlagen.' });
  }
});

app.post('/api/shutdown', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;

  res.json({ ok: true, message: 'PhiX wird heruntergefahren.' });

  setImmediate(() => {
    shutdownPhix({ prisma, server: getShutdownServer() }).catch((err) => {
      console.error('[shutdown] Fehler:', err);
      process.exit(1);
    });
  });
});

/** Standalone-Windows: gebautes Frontend vom Backend ausliefern (ein Prozess, Port 3000). */
function setupStandaloneFrontend() {
  const standalone =
    process.env.PHIX_STANDALONE === '1' || process.env.NODE_ENV === 'production';
  if (!standalone) return;

  const distCandidates = [
    process.env.PHIX_FRONTEND_DIST,
    path.join(__dirname, '..', 'frontend-dist'),
    path.join(__dirname, '..', 'Notenauswertung-App', 'dist'),
  ].filter(Boolean);

  const distDir = distCandidates.find((dir) =>
    fs.existsSync(path.join(dir, 'index.html')),
  );
  if (!distDir) {
    console.warn('[standalone] Kein Frontend-build (dist/index.html) gefunden.');
    return;
  }

  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`[standalone] Frontend: ${distDir}`);
}

setupStandaloneFrontend();

  const appMode = String(process.env.APP_MODE || 'web').trim().toLowerCase();
  if (appMode !== 'web' && appMode !== 'desktop') {
    console.warn(`[config] Unbekanntes APP_MODE="${process.env.APP_MODE}" — verwende "web".`);
  } else {
    console.log(`[config] APP_MODE=${appMode}`);
  }
  const dbUrl = String(process.env.DATABASE_URL || '').trim();
  const dbKind = dbUrl.startsWith('file:') || dbUrl.startsWith('sqlite:') ? 'sqlite' : 'postgresql';
  console.log(`[config] Datenbank: ${dbKind}`);

  return {
    app,
    prisma,
    migrateData,
    ensureAppUsers,
    attachHttpServer(server) {
      getShutdownServer = () => server;
    },
  };
}

module.exports = { createApp };
