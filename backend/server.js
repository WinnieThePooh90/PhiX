const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const BCRYPT_ROUNDS = 10;

/** Nur dieser Name (kleingeschrieben verglichen) darf alle Kurse sehen/bearbeiten. */
const ADMIN_USERNAME = 'admin';

function getActingUser(req) {
  return String(req.get('X-Acting-User') || '').trim();
}

function isAdminUser(username) {
  return String(username || '').toLowerCase() === ADMIN_USERNAME;
}

function canAccessCourse(course, actingUser) {
  if (!course || !actingUser) return false;
  if (isAdminUser(actingUser)) return true;
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
    where: { username: { equals: acting, mode: 'insensitive' } },
    select: { username: true },
  });
  if (!row) {
    res.status(401).json({ error: 'Unbekannter Benutzer' });
    return null;
  }
  return row.username;
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
  const user = await prisma.appUser.findFirst({
    where: { username: { equals: usernameIn, mode: 'insensitive' } },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Anmeldung fehlgeschlagen.' });
  }
  res.json({ id: String(user.id), username: user.username });
});

app.get('/api/auth/session', async (req, res) => {
  const acting = getActingUser(req);
  if (!acting) return res.status(401).json({ error: 'Nicht angemeldet' });
  const user = await prisma.appUser.findFirst({
    where: { username: { equals: acting, mode: 'insensitive' } },
    select: { id: true, username: true },
  });
  if (!user) return res.status(401).json({ error: 'Unbekannter Benutzer' });
  res.json({ id: String(user.id), username: user.username });
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
      where: { username: { equals: username, mode: 'insensitive' } },
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
    where: { username: { equals: username, mode: 'insensitive' } },
  });
  if (clash) return res.status(409).json({ error: 'Dieser Benutzername ist bereits vergeben.' });
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.appUser.create({
    data: { username, passwordHash },
    select: { id: true, username: true },
  });
  res.status(201).json({ id: String(user.id), username: user.username });
});

app.patch('/api/users/:id/password', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
  const newPassword = String(req.body?.newPassword ?? '');
  if (!newPassword) return res.status(400).json({ error: 'Neues Passwort eingeben.' });

  const target = await prisma.appUser.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

  if (isAdminUser(target.username) && !isAdminUser(acting)) {
    return res.status(403).json({ error: 'Nur der Administrator darf das Passwort von „admin“ ändern.' });
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
  const where = isAdminUser(acting) ? {} : { ownerUsername: acting };
  const courses = await prisma.course.findMany({ where, orderBy: { id: 'asc' } });
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
  if (!isAdminUser(acting)) delete raw.ownerUsername;
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

// Schuljahre (Schülerverwaltung)
app.get('/api/school-roster-years', async (req, res) => {
  const rows = await prisma.schoolRosterYear.findMany({
    include: { _count: { select: { students: true } } },
  });
  const out = sortSchoolRosterYears(
    rows.map(({ _count, ...y }) => ({ ...y, studentCount: _count.students })),
  );
  res.json(out);
});

app.post('/api/school-roster-years', async (req, res) => {
  const norm = normalizeSchoolYearLabel(req.body?.label);
  if (norm.error) return res.status(400).json({ error: norm.error });
  try {
    const row = await prisma.schoolRosterYear.create({ data: { label: norm.label } });
    res.json({ ...row, studentCount: 0 });
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Dieses Schuljahr existiert bereits.' });
    throw e;
  }
});

app.put('/api/school-roster-years/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
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
  const rows = await prisma.schoolRosterStudent.findMany({
    where: { schoolYearId },
    orderBy: [{ gradeLevel: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  });
  res.json(rows);
});

app.post('/api/school-roster-students', async (req, res) => {
  const norm = normalizeSchoolRosterPayload(req.body);
  if (norm.error) return res.status(400).json({ error: norm.error });
  const year = await prisma.schoolRosterYear.findUnique({ where: { id: norm.schoolYearId } });
  if (!year) return res.status(400).json({ error: 'Schuljahr nicht gefunden.' });
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
  // Wichtig: Nicht alle Felder zurückgeben (z.B. kann während Migration `studentNumber` noch fehlen).
  const students = await prisma.student.findMany({
    where: { courseId },
    select: {
      id: true,
      frontendId: true,
      firstName: true,
      lastName: true,
      summaryEndNote: true,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await migrateData();
  await ensureAppUsers();
  console.log(`Server running on port ${PORT}`);
});
