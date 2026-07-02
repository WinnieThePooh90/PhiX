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
const { createCryptoSession, destroyCryptoSession, getCryptoSession, peekCryptoSession, updateSessionTtl } = require('./lib/crypto-session');
const { createCryptoMiddleware } = require('./lib/crypto-middleware');
const { runWithCryptoContext } = require('./lib/crypto-context');
const { getDekFromContext } = require('./lib/crypto-context');
const { decryptKlassenlehrerListEntry } = require('./lib/encrypted-fields');
const {
  createUserCryptoRecord,
  migratePlaintextForOwner,
  changeUserPasswordCrypto,
  unlockDekWithPassword,
} = require('./lib/user-crypto-service');
const { unwrapDekFromRecovery } = require('./lib/phix-crypto');
const { placeholderPasswordHash, BCRYPT_ROUNDS } = require('./lib/app-user-password');
const { createInitialSetupToken, verifyInitialSetupToken } = require('./lib/initial-setup-token');
const { clientIp, checkRateLimit } = require('./lib/rate-limit');
const {
  needsSetupWizard,
  ensureBootstrapAdmin,
  createWorkUser,
} = require('./lib/setup-wizard');
const {
  attachAuthSession,
  createAuthSession,
  destroyAuthSession,
  getActingUserFromRequest,
  readSessionTokenFromRequest,
  setAuthSessionCookie,
  clearAuthSessionCookie,
} = require('./lib/auth-session');
const { buildDefaultExamAndOralRecords } = require('./lib/course-defaults');

function createCorsOptions() {
  const raw = String(process.env.PHIX_CORS_ORIGINS || '').trim();
  const credentials = true;
  if (!raw || raw === '*') {
    const defaults = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:1990',
      'http://127.0.0.1:1990',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];
    return {
      credentials,
      origin(origin, callback) {
        if (!origin || defaults.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    };
  }
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    credentials,
    origin: allowed,
  };
}

function createApp() {
const app = express();
const prisma = createPrismaClient();
/** gesetzt via attachHttpServer() nach app.listen() — für /api/shutdown */
let getShutdownServer = () => null;

app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '64mb' }));
app.use(attachAuthSession);

app.use(
  createCryptoMiddleware({
    prisma,
    getActingUser: getActingUserFromRequest,
  }),
);

const {
  isReservedAdminUsername,
  resolveAdminRights,
  toPublicAppUser,
} = require('./lib/user-admin');

/** Systemadministrator (Benutzerverwaltung, Backup, Dependencies) — kein Zugriff auf fremde Kurse. */
const ADMIN_USERNAME = 'admin';

function getActingUser(req) {
  return getActingUserFromRequest(req);
}

function issueAuthSession(res, user) {
  const authToken = createAuthSession(user.id, user.username);
  setAuthSessionCookie(res, authToken);
  return authToken;
}

function canAccessCourse(course, actingUser) {
  if (!course || !actingUser) return false;
  return course.ownerUsername === actingUser;
}

/** Liefert den in der DB gespeicherten Benutzernamen (Schreibweise) oder null. */
async function assertActingUser(req, res) {
  const acting = getActingUser(req);
  if (!acting) {
    res.status(401).json({ error: 'Nicht angemeldet' });
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
  if (!(await resolveAdminRights(prisma, acting))) {
    res.status(403).json({ error: 'Nur Administratoren dürfen diese Aktion ausführen.' });
    return null;
  }
  return acting;
}

async function assertCourseAccess(req, res, courseId, { writable = false } = {}) {
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
  if (writable && course.archived === true) {
    res.status(403).json({ error: 'Dieses Fach ist archiviert und kann nicht mehr bearbeitet werden.' });
    return null;
  }
  return course;
}

async function assertCourseWritable(req, res, courseId) {
  return assertCourseAccess(req, res, courseId, { writable: true });
}

function rejectIfArchivedCourse(res, course) {
  if (course?.archived === true) {
    res.status(403).json({ error: 'Dieses Fach ist archiviert und kann nicht mehr bearbeitet werden.' });
    return true;
  }
  return false;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/setup/wizard-status', async (_req, res) => {
  await ensureBootstrapAdmin(prisma);
  res.json({ needsWizard: await needsSetupWizard(prisma) });
});

app.post('/api/setup/work-user', async (req, res) => {
  const rate = checkRateLimit(`setup-work-user:${clientIp(req)}`);
  if (!rate.allowed) {
    return res.status(429).json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' });
  }
  const result = await createWorkUser(prisma, {
    username: req.body?.username,
    password: req.body?.password,
    isAdmin: req.body?.isAdmin === true,
  });
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  res.status(result.status).json(result.user);
});

// ——— App-Benutzer (Passwort-Hashes in der DB) ———

app.post('/api/auth/login', async (req, res) => {
  const usernameIn = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  if (!usernameIn) {
    return res.status(400).json({ error: 'Benutzername eingeben.' });
  }
  const user = await prisma.appUser.findFirst({
    where: usernameWhere(usernameIn),
  });
  if (!user) {
    return res.status(401).json({ error: 'Anmeldung fehlgeschlagen.' });
  }
  if (user.mustSetPassword) {
    return res.status(403).json({
      error: 'Du hast noch kein Passwort festgelegt.',
      requiresInitialPassword: true,
      username: user.username,
    });
  }
  if (!password) {
    return res.status(400).json({ error: 'Benutzername und Passwort eingeben.' });
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
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
      const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
      const ttlMs = ((settings?.inactivityTimeoutMin) || 5) * 60 * 1000;
      cryptoSessionToken = createCryptoSession(user.id, dek, ttlMs);
    } catch (err) {
      console.error('[auth] DEK-Entschlüsselung fehlgeschlagen:', err);
      return res.status(401).json({ error: 'Anmeldung fehlgeschlagen.' });
    }
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });

  const prevAuth = readSessionTokenFromRequest(req);
  destroyAuthSession(prevAuth);
  issueAuthSession(res, user);

  res.json({
    ...toPublicAppUser(user),
    cryptoSessionToken,
    requiresCryptoSetup,
    settings: settings || { inactivityTimeoutMin: 5, darkMode: false, colorScheme: 'standard' },
  });
});

app.post('/api/auth/initial-password', async (req, res) => {
  const rate = checkRateLimit(`initial-password:${clientIp(req)}`);
  if (!rate.allowed) {
    return res.status(429).json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' });
  }

  const usernameIn = String(req.body?.username ?? '').trim();
  const newPassword = String(req.body?.newPassword ?? '');
  const setupToken = String(req.body?.setupToken ?? '').trim();
  if (!usernameIn || !newPassword) {
    return res.status(400).json({ error: 'Benutzername und neues Passwort eingeben.' });
  }
  const user = await prisma.appUser.findFirst({ where: usernameWhere(usernameIn) });
  if (!user) {
    return res.status(401).json({ error: 'Benutzer nicht gefunden.' });
  }
  if (!user.mustSetPassword) {
    return res.status(403).json({ error: 'Das Passwort wurde bereits festgelegt. Bitte melde dich an oder nutze den Recovery-Key.' });
  }
  if (!(await verifyInitialSetupToken(setupToken, user.initialSetupTokenHash))) {
    return res.status(401).json({ error: 'Einrichtungs-Token ungültig oder fehlt. Bitte den Administrator kontaktieren.' });
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.appUser.update({
    where: { id: user.id },
    data: { passwordHash, mustSetPassword: false, initialSetupTokenHash: null },
  });
  res.status(204).send();
});

app.post('/api/auth/logout', async (req, res) => {
  const token = String(req.get('X-Phix-Crypto-Token') || '').trim();
  destroyCryptoSession(token);
  const authToken = readSessionTokenFromRequest(req);
  destroyAuthSession(authToken);
  clearAuthSessionCookie(res);
  res.status(204).send();
});

app.post('/api/auth/crypto/setup', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const password = String(req.body?.password ?? '');
  if (!password) return res.status(400).json({ error: 'Passwort eingeben.' });

  const user = await prisma.appUser.findFirst({ where: usernameWhere(acting) });
  if (!user) return res.status(401).json({ error: 'Unbekannter Benutzer' });

  if (user.mustSetPassword) {
    return res.status(403).json({ error: 'Bitte zuerst das Passwort festlegen.' });
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Passwort falsch.' });
  }

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
    const prevAuth = readSessionTokenFromRequest(req);
    destroyAuthSession(prevAuth);
    issueAuthSession(res, user);
    res.json({ ...toPublicAppUser(user), cryptoSessionToken });
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
    select: { id: true, username: true, isAdmin: true },
  });
  if (!user) return res.status(401).json({ error: 'Unbekannter Benutzer' });
  res.json(toPublicAppUser(user));
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
  const session = peekCryptoSession(token);
  if (!session || session.userId !== user.id) {
    return res.status(423).json({
      ok: false,
      needsRelogin: true,
      error: 'Bitte melde dich erneut an (Verschlüsselung).',
    });
  }

  return res.json({ ok: true, needsSetup: false, needsRelogin: false });
});

app.get('/api/users', async (req, res) => {
  const acting = await assertAdminUser(req, res);
  if (!acting) return;
  const users = await prisma.appUser.findMany({
    orderBy: { username: 'asc' },
    select: { id: true, username: true, isAdmin: true },
  });
  res.json(users.map((u) => toPublicAppUser(u)));
});

app.post('/api/users', async (req, res) => {
  const acting = await assertAdminUser(req, res);
  if (!acting) return;
  const username = String(req.body?.username ?? '').trim();
  if (!username) return res.status(400).json({ error: 'Benutzername eingeben.' });
  if (String(req.body?.password ?? '').trim()) {
    return res.status(400).json({
      error:
        'Passwörter anderer Benutzer können nicht vergeben werden. Der neue Benutzer legt sein Passwort beim ersten Login selbst fest.',
    });
  }
  const clash = await prisma.appUser.findFirst({
    where: usernameWhere(username),
  });
  if (clash) return res.status(409).json({ error: 'Dieser Benutzername ist bereits vergeben.' });
  const passwordHash = await placeholderPasswordHash();
  const { token: setupToken, hash: initialSetupTokenHash } = await createInitialSetupToken();
  const user = await prisma.appUser.create({
    data: { username, passwordHash, mustSetPassword: true, initialSetupTokenHash },
    select: { id: true, username: true, isAdmin: true },
  });
  // Verschlüsselung + Recovery-Key erst beim ersten Login des neuen Benutzers (POST /api/auth/crypto/setup).
  res.status(201).json({ ...toPublicAppUser(user), setupToken });
});

app.patch('/api/users/:id/password', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
  const newPassword = String(req.body?.newPassword ?? '');
  const oldPassword = String(req.body?.oldPassword ?? '');
  if (!newPassword) return res.status(400).json({ error: 'Neues Passwort eingeben.' });

  const actingRow = await prisma.appUser.findFirst({
    where: usernameWhere(acting),
    select: { id: true },
  });
  if (!actingRow) return res.status(401).json({ error: 'Unbekannter Benutzer' });

  const target = await prisma.appUser.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

  if (target.id !== actingRow.id) {
    return res.status(403).json({ error: 'Sie dürfen nur Ihr eigenes Passwort ändern.' });
  }
  if (target.mustSetPassword) {
    return res.status(400).json({
      error: 'Bitte legen Sie zuerst Ihr Passwort über „Erstes Passwort festlegen“ auf der Anmeldeseite fest.',
    });
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

  const actingRow = await prisma.appUser.findFirst({
    where: usernameWhere(acting),
    select: { id: true },
  });
  const isSelfDelete = actingRow?.id === target.id;
  if (!(await resolveAdminRights(prisma, acting)) && !isSelfDelete) {
    return res.status(403).json({ error: 'Nur Administratoren dürfen andere Benutzer löschen.' });
  }

  if (isReservedAdminUsername(target.username)) {
    return res.status(400).json({ error: 'Der Benutzer „admin“ kann nicht gelöscht werden.' });
  }

  const username = target.username;

  await prisma.course.deleteMany({ where: { ownerUsername: username } });
  await prisma.schoolRosterYear.deleteMany({ where: { ownerUsername: username } });
  await prisma.appUser.delete({ where: { id } });

  res.status(204).send();
});

app.patch('/api/users/:id/admin', async (req, res) => {
  const acting = await assertAdminUser(req, res);
  if (!acting) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Ungültige Benutzer-ID' });

  const target = await prisma.appUser.findUnique({
    where: { id },
    select: { id: true, username: true, isAdmin: true },
  });
  if (!target) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

  if (isReservedAdminUsername(target.username)) {
    return res.status(400).json({ error: 'Dem Benutzer „admin“ können Admin-Rechte nicht entzogen werden.' });
  }

  const wantAdmin = req.body?.isAdmin === true;
  const updated = await prisma.appUser.update({
    where: { id },
    data: { isAdmin: wantAdmin },
    select: { id: true, username: true, isAdmin: true },
  });
  res.json(toPublicAppUser(updated));
});

async function ensureAppUsers() {
  const n = await prisma.appUser.count();
  if (n > 0) {
    console.log(`[auth] ${n} App-Benutzer in der Datenbank (Login mit gespeicherten Zugangsdaten).`);
    return;
  }
  const passwordHash = await placeholderPasswordHash();
  await prisma.appUser.create({
    data: { username: 'admin', passwordHash, isAdmin: true, mustSetPassword: true },
  });
  console.log(
    '[auth] Erster Start: Benutzer "admin" angelegt. Auf der Anmeldeseite „Erstes Passwort festlegen“ wählen und Passwort für admin setzen.',
  );
}

// USER SETTINGS
app.get('/api/user-settings', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const user = await prisma.appUser.findFirst({ where: usernameWhere(acting), select: { id: true } });
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  res.json(settings || { inactivityTimeoutMin: 5, darkMode: false, colorScheme: 'standard' });
});

app.put('/api/user-settings', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const user = await prisma.appUser.findFirst({ where: usernameWhere(acting), select: { id: true } });
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  const { inactivityTimeoutMin, darkMode, colorScheme } = req.body || {};
  const data = {};
  if (inactivityTimeoutMin !== undefined) {
    const t = Number(inactivityTimeoutMin);
    if (!Number.isFinite(t) || t < 5 || t > 60) {
      return res.status(400).json({ error: 'inactivityTimeoutMin muss zwischen 5 und 60 liegen.' });
    }
    data.inactivityTimeoutMin = t;
  }
  if (darkMode !== undefined) data.darkMode = Boolean(darkMode);
  if (colorScheme !== undefined) data.colorScheme = String(colorScheme || 'standard');
  const row = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
  if (data.inactivityTimeoutMin !== undefined) {
    const token = String(req.get('X-Phix-Crypto-Token') || '').trim();
    updateSessionTtl(token, data.inactivityTimeoutMin * 60 * 1000);
  }
  res.json(row);
});

const AUSWERTUNGSHILFE_ALLOWED_EXT = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.rtf',
  '.odt',
]);
const AUSWERTUNGSHILFE_ALLOWED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
  'application/vnd.oasis.opendocument.text',
]);
const AUSWERTUNGSHILFE_MAX_BYTES = 10 * 1024 * 1024;

function mimeFromFileName(fileName) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.rtf')) return 'application/rtf';
  if (lower.endsWith('.odt')) return 'application/vnd.oasis.opendocument.text';
  return '';
}

function normalizeAuswertungshilfePayload(body) {
  const fileName = String(body?.fileName ?? '').trim();
  if (!fileName) return { error: 'Dateiname erforderlich.' };
  const ext = fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : '';
  if (!AUSWERTUNGSHILFE_ALLOWED_EXT.has(ext)) {
    return { error: 'Ungültiges Dateiformat (PDF, DOC, DOCX, TXT, RTF, ODT).' };
  }
  let mimeType = String(body?.mimeType ?? '').trim().toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = mimeFromFileName(fileName);
  }
  if (!AUSWERTUNGSHILFE_ALLOWED_MIME.has(mimeType)) {
    return { error: 'Ungültiges Dateiformat (PDF, DOC, DOCX, TXT, RTF, ODT).' };
  }
  let raw = String(body?.fileData ?? '').trim();
  const dataUrlMatch = /^data:[^;]+;base64,(.+)$/i.exec(raw);
  if (dataUrlMatch) raw = dataUrlMatch[1];
  if (!raw) return { error: 'Keine Dateidaten.' };
  let buf;
  try {
    buf = Buffer.from(raw, 'base64');
  } catch {
    return { error: 'Dateidaten ungültig.' };
  }
  if (!buf.length) return { error: 'Keine Dateidaten.' };
  if (buf.length > AUSWERTUNGSHILFE_MAX_BYTES) {
    return { error: `Datei zu groß (max. ${AUSWERTUNGSHILFE_MAX_BYTES / (1024 * 1024)} MB).` };
  }
  return { fileName, mimeType, fileData: raw };
}

async function resolveActingUserId(req, res) {
  const acting = await assertActingUser(req, res);
  if (!acting) return null;
  const user = await prisma.appUser.findFirst({
    where: usernameWhere(acting),
    select: { id: true },
  });
  if (!user) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return null;
  }
  return user.id;
}

app.get('/api/user-auswertungshilfe', async (req, res) => {
  const userId = await resolveActingUserId(req, res);
  if (!userId) return;
  const row = await prisma.userAuswertungshilfe.findUnique({
    where: { userId },
    select: { fileName: true, mimeType: true, updatedAt: true },
  });
  if (!row) return res.json({ uploaded: false });
  res.json({
    uploaded: true,
    fileName: row.fileName,
    mimeType: row.mimeType,
    updatedAt: row.updatedAt,
  });
});

app.get('/api/user-auswertungshilfe/file', async (req, res) => {
  const userId = await resolveActingUserId(req, res);
  if (!userId) return;
  const row = await prisma.userAuswertungshilfe.findUnique({ where: { userId } });
  if (!row?.fileData) return res.status(404).json({ error: 'Keine Auswertungshilfe hinterlegt.' });
  let buf;
  try {
    buf = Buffer.from(String(row.fileData), 'base64');
  } catch {
    return res.status(500).json({ error: 'Datei konnte nicht gelesen werden.' });
  }
  const safeName = String(row.fileName || 'auswertungshilfe').replace(/[^\wäöüÄÖÜß .()-]+/gi, '_');
  res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`);
  res.send(buf);
});

app.delete('/api/user-auswertungshilfe', async (req, res) => {
  const userId = await resolveActingUserId(req, res);
  if (!userId) return;
  await prisma.userAuswertungshilfe.deleteMany({ where: { userId } });
  res.status(204).send();
});

app.put('/api/user-auswertungshilfe', async (req, res) => {
  const userId = await resolveActingUserId(req, res);
  if (!userId) return;
  const normalized = normalizeAuswertungshilfePayload(req.body);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const row = await prisma.userAuswertungshilfe.upsert({
    where: { userId },
    create: {
      userId,
      fileName: normalized.fileName,
      mimeType: normalized.mimeType,
      fileData: normalized.fileData,
    },
    update: {
      fileName: normalized.fileName,
      mimeType: normalized.mimeType,
      fileData: normalized.fileData,
    },
    select: { fileName: true, mimeType: true, updatedAt: true },
  });
  res.json({
    uploaded: true,
    fileName: row.fileName,
    mimeType: row.mimeType,
    updatedAt: row.updatedAt,
  });
});

// REGISTRATION (global, für alle Benutzer)
/** PHIX-Marker je 4er-Block: Position im Block (1-basiert) 4-3-1-2. */
const REGISTRATION_KEY_MARKERS = [
  { blockIndex: 0, posInBlock: 4, char: 'P' },
  { blockIndex: 1, posInBlock: 3, char: 'H' },
  { blockIndex: 2, posInBlock: 1, char: 'I' },
  { blockIndex: 3, posInBlock: 2, char: 'X' },
];

function isValidRegistrationKey(raw) {
  const k = String(raw ?? '').replace(/-/g, '').toUpperCase();
  if (k.length !== 16 || !/^[A-Z]{16}$/.test(k)) return false;
  return REGISTRATION_KEY_MARKERS.every(
    ({ blockIndex, posInBlock, char }) => k[blockIndex * 4 + posInBlock - 1] === char
  );
}

app.get('/api/registration', async (req, res) => {
  const row = await prisma.appRegistration.findUnique({ where: { id: 1 } });
  res.json({ registered: !!row });
});

app.post('/api/registration', async (req, res) => {
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  const { key } = req.body || {};
  if (!isValidRegistrationKey(key)) {
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
  const kursstufe = rest.kursstufe === true || rest.kursstufe === 'true';
  const gradeSystem = kursstufe ? 'points' : (rest.gradeSystem || 'classic');
  const course = await prisma.course.create({
    data: { ...rest, kursstufe, gradeSystem, ownerUsername: acting },
  });
  const { exams, orals } = buildDefaultExamAndOralRecords(course);
  await prisma.exam.createMany({ data: exams });
  await prisma.oral.createMany({ data: orals });

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
  const raw = { ...req.body };
  delete raw.id;
  delete raw.ownerUsername;
  if (existing.archived === true) {
    if (raw.archived !== false) {
      return res.status(403).json({ error: 'Archiviertes Fach kann nicht bearbeitet werden.' });
    }
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: {
        archived: false,
        archivedGradingKeys: [],
      },
    });
    return res.json(course);
  }
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
  await prisma.referatEntry.deleteMany({ where: { courseId } });
  await prisma.albumPhoto.deleteMany({ where: { courseId } });
  await prisma.moneyList.deleteMany({ where: { courseId } });
  await prisma.attendanceList.deleteMany({ where: { courseId } });
  await prisma.collectionList.deleteMany({ where: { courseId } });
  await prisma.notesList.deleteMany({ where: { courseId } });

  await prisma.course.delete({ where: { id: courseId } });
  res.status(204).send();
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
  const classSectionRaw = body?.classSection;
  const classSection =
    classSectionRaw === undefined || classSectionRaw === null
      ? ''
      : normalizeClassSection(classSectionRaw);
  if (!schoolYearId) return { error: 'Schuljahr fehlt oder ist ungültig.' };
  if (!Number.isFinite(gradeLevel) || gradeLevel < 5 || gradeLevel > 13) {
    return { error: 'Klassenstufe muss zwischen 5 und 13 liegen.' };
  }
  if (classSection === null) {
    return { error: 'Teilklasse ungültig (z. B. a, b, c oder leer).' };
  }
  if (!lastName) return { error: 'Nachname fehlt.' };
  if (!firstName) return { error: 'Vorname fehlt.' };
  return { gradeLevel, classSection, firstName, lastName, schoolYearId };
}

function normalizeClassSection(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === '-') return '';
  if (!/^[a-z]{1,4}$/.test(s)) return null;
  return s;
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
    orderBy: [{ gradeLevel: 'asc' }, { classSection: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
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
      classSection: norm.classSection,
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
      classSection: norm.classSection,
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

function compareCourseStudentsByName(a, b) {
  const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
  if (ln !== 0) return ln;
  const fn = String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
  if (fn !== 0) return fn;
  return (a.id ?? 0) - (b.id ?? 0);
}

/** Schülernummern 1…n nach Nachname, Vorname (de-DE) vergeben. */
async function syncCourseStudentNumbers(courseId) {
  const rows = await prisma.student.findMany({ where: { courseId } });
  const sorted = [...rows].sort(compareCourseStudentsByName);
  if (sorted.length === 0) return;

  await prisma.$transaction(
    sorted.map((s, index) =>
      prisma.student.update({
        where: { id: s.id },
        data: { studentNumber: -(index + 1) },
      }),
    ),
  );
  await prisma.$transaction(
    sorted.map((s, index) =>
      prisma.student.update({
        where: { id: s.id },
        data: { studentNumber: index + 1 },
      }),
    ),
  );
}

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
      summaryNotes: true,
      courseId: true,
    },
  });
  const sorted = [...students].sort(compareCourseStudentsByName);
  res.json(
    sorted.map((s) => ({
      ...s,
      frontendId: s.frontendId ? s.frontendId.toString() : null,
    })),
  );
});

/** Alle Schüler eines Kurses löschen (Kurs-Schülerliste leeren). */
app.delete('/api/students', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, targetCourseId);
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
  await syncCourseStudentNumbers(targetCourseId);
  const refreshed = await prisma.student.findUnique({ where: { id: student.id } });
  await syncMoneyListEntriesForCourse(targetCourseId);
  await syncAttendanceListEntriesForCourse(targetCourseId);
  await syncCollectionListEntriesForCourse(targetCourseId);
  await syncNotesListEntriesForCourse(targetCourseId);
  res.json({
    ...refreshed,
    frontendId: refreshed.frontendId ? refreshed.frontendId.toString() : null,
  });
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
  if (rejectIfArchivedCourse(res, existingStudent.course)) return;
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
  const courseIdForSync = student.courseId ?? existingStudent.courseId;
  const nameTouched = data.firstName !== undefined || data.lastName !== undefined;
  if (nameTouched && courseIdForSync != null) {
    await syncCourseStudentNumbers(courseIdForSync);
    const refreshed = await prisma.student.findUnique({ where: { id: sid } });
    return res.json({
      ...refreshed,
      frontendId: refreshed.frontendId ? refreshed.frontendId.toString() : null,
    });
  }
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
  if (rejectIfArchivedCourse(res, existing.course)) return;
  const courseId = existing.courseId;

  await prisma.student.delete({ where: { id } });

  if (courseId != null) {
    await syncCourseStudentNumbers(courseId);
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
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, courseId);
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

// PROJECTS
app.get('/api/projects', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json({});
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const projects = await prisma.project.findMany({ where: { courseId } });
  const result = {};
  projects.forEach((p) => { result[p.projectNumber] = p; });
  res.json(result);
});

app.put('/api/projects/:id', async (req, res) => {
  const projectNumber = Number(req.params.id);
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'courseId required' });
  }
  const ok = await assertCourseWritable(req, res, courseId);
  if (!ok) return;

  const existing = await prisma.project.findFirst({ where: { projectNumber, courseId } });
  if (existing) {
    const { id, projectNumber: pn, courseId: cid, ...data } = req.body;
    const project = await prisma.project.update({
      where: { id: existing.id },
      data,
    });
    res.json(project);
  } else {
    const { id, projectNumber: pn, ...data } = req.body;
    const project = await prisma.project.create({
      data: { ...data, projectNumber, courseId },
    });
    res.json(project);
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  const projectNumber = Number(req.params.id);
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseWritable(req, res, courseId);
  if (!ok) return;
  const existing = await prisma.project.findFirst({ where: { projectNumber, courseId } });
  if (!existing) return res.status(404).json({ error: 'not found' });
  await prisma.project.delete({ where: { id: existing.id } });
  res.status(204).send();
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
  const ok = await assertCourseWritable(req, res, courseId);
  if (!ok) return;

  const thema = req.body.thema ?? '';
  const art = req.body.art ?? '';
  const date = req.body.date ?? '';
  const gehalten = Boolean(req.body.gehalten);
  const halbjahr = req.body.halbjahr != null ? String(req.body.halbjahr) : '1';
  const note = req.body.note != null ? String(req.body.note) : '';
  const auswertungHilfe = req.body.auswertungHilfe != null && typeof req.body.auswertungHilfe === 'object'
    ? req.body.auswertungHilfe
    : {};

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
      auswertungHilfe,
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
  if (rejectIfArchivedCourse(res, existingEntry.course)) return;

  const { thema, art, date, gehalten, halbjahr, note, studentId, courseId: bodyCourseId, auswertungHilfe } = req.body;
  const data = {};
  if (thema !== undefined) data.thema = String(thema);
  if (art !== undefined) data.art = String(art);
  if (date !== undefined) data.date = String(date);
  if (gehalten !== undefined) data.gehalten = Boolean(gehalten);
  if (halbjahr !== undefined) data.halbjahr = String(halbjahr) === '2' ? '2' : '1';
  if (note !== undefined) data.note = String(note);
  if (auswertungHilfe !== undefined && typeof auswertungHilfe === 'object' && !Array.isArray(auswertungHilfe)) {
    data.auswertungHilfe = auswertungHilfe;
  }
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
  if (rejectIfArchivedCourse(res, existingEntry.course)) return;
  await prisma.gfsEntry.delete({ where: { id } });
  res.status(204).send();
});

// REFERATE (analog GFS)
app.get('/api/referate', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json([]);
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const rows = await prisma.referatEntry.findMany({
    where: { courseId },
    orderBy: { id: 'asc' },
  });
  res.json(rows);
});

app.post('/api/referate', async (req, res) => {
  const courseId = Number(req.body.courseId);
  const studentId = Number(req.body.studentId);
  if (!studentId) return res.status(400).json({ error: 'studentId required' });
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseWritable(req, res, courseId);
  if (!ok) return;

  const thema = req.body.thema ?? '';
  const art = req.body.art ?? '';
  const date = req.body.date ?? '';
  const gehalten = Boolean(req.body.gehalten);
  const halbjahr = req.body.halbjahr != null ? String(req.body.halbjahr) : '1';
  const note = req.body.note != null ? String(req.body.note) : '';
  const auswertungHilfe = req.body.auswertungHilfe != null && typeof req.body.auswertungHilfe === 'object'
    ? req.body.auswertungHilfe
    : {};

  const entry = await prisma.referatEntry.create({
    data: {
      courseId,
      studentId,
      thema: String(thema),
      art: String(art),
      date: String(date),
      gehalten,
      halbjahr: halbjahr === '2' ? '2' : '1',
      note: String(note),
      auswertungHilfe,
    },
  });
  res.json(entry);
});

app.put('/api/referate/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existingEntry = await prisma.referatEntry.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existingEntry) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existingEntry.course || !canAccessCourse(existingEntry.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  if (rejectIfArchivedCourse(res, existingEntry.course)) return;

  const { thema, art, date, gehalten, halbjahr, note, studentId, courseId: bodyCourseId, auswertungHilfe } = req.body;
  const data = {};
  if (thema !== undefined) data.thema = String(thema);
  if (art !== undefined) data.art = String(art);
  if (date !== undefined) data.date = String(date);
  if (gehalten !== undefined) data.gehalten = Boolean(gehalten);
  if (halbjahr !== undefined) data.halbjahr = String(halbjahr) === '2' ? '2' : '1';
  if (note !== undefined) data.note = String(note);
  if (auswertungHilfe !== undefined && typeof auswertungHilfe === 'object' && !Array.isArray(auswertungHilfe)) {
    data.auswertungHilfe = auswertungHilfe;
  }
  if (Number.isFinite(Number(studentId))) data.studentId = Number(studentId);
  if (bodyCourseId !== undefined && Number.isFinite(Number(bodyCourseId))) {
    const nc = await prisma.course.findUnique({ where: { id: Number(bodyCourseId) } });
    if (!nc || !canAccessCourse(nc, acting)) {
      return res.status(403).json({ error: 'Kein Zugriff' });
    }
    data.courseId = Number(bodyCourseId);
  }

  const entry = await prisma.referatEntry.update({
    where: { id },
    data,
  });
  res.json(entry);
});

app.delete('/api/referate/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existingEntry = await prisma.referatEntry.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existingEntry) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existingEntry.course || !canAccessCourse(existingEntry.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  if (rejectIfArchivedCourse(res, existingEntry.course)) return;
  await prisma.referatEntry.delete({ where: { id } });
  res.status(204).send();
});

const ALBUM_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALBUM_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function normalizeAlbumImagePayload(imageData, mimeType) {
  const mime = String(mimeType || '').trim().toLowerCase();
  if (!ALBUM_ALLOWED_MIME.has(mime)) {
    return { error: 'Ungültiges Bildformat (JPEG, PNG, GIF, WebP).' };
  }
  let raw = String(imageData || '').trim();
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (dataUrlMatch) {
    raw = dataUrlMatch[2];
  }
  if (!raw) return { error: 'Keine Bilddaten.' };
  let buf;
  try {
    buf = Buffer.from(raw, 'base64');
  } catch {
    return { error: 'Bilddaten ungültig.' };
  }
  if (!buf.length) return { error: 'Keine Bilddaten.' };
  if (buf.length > ALBUM_MAX_IMAGE_BYTES) {
    return { error: `Bild zu groß (max. ${ALBUM_MAX_IMAGE_BYTES / (1024 * 1024)} MB).` };
  }
  return { mimeType: mime, imageData: raw };
}

app.get('/api/album-photos', async (req, res) => {
  const courseId = Number(req.query.courseId);
  if (!courseId) return res.json([]);
  const ok = await assertCourseAccess(req, res, courseId);
  if (!ok) return;
  const rows = await prisma.albumPhoto.findMany({
    where: { courseId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(rows);
});

app.post('/api/album-photos', async (req, res) => {
  const courseId = Number(req.body.courseId);
  if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'courseId required' });
  const ok = await assertCourseWritable(req, res, courseId);
  if (!ok) return;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course?.albumEnabled) {
    return res.status(403).json({ error: 'Album ist für diesen Kurs nicht aktiviert.' });
  }

  const title = String(req.body.title ?? '').trim();
  if (!title) return res.status(400).json({ error: 'Titel erforderlich.' });

  const normalized = normalizeAlbumImagePayload(req.body.imageData, req.body.mimeType);
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  const description = String(req.body.description ?? '');
  const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;

  const photo = await prisma.albumPhoto.create({
    data: {
      courseId,
      title,
      description,
      mimeType: normalized.mimeType,
      imageData: normalized.imageData,
      sortOrder,
    },
  });
  res.json(photo);
});

app.put('/api/album-photos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.albumPhoto.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.course || !canAccessCourse(existing.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  if (rejectIfArchivedCourse(res, existing.course)) return;

  const data = {};
  if (req.body.title !== undefined) {
    const title = String(req.body.title ?? '').trim();
    if (!title) return res.status(400).json({ error: 'Titel erforderlich.' });
    data.title = title;
  }
  if (req.body.description !== undefined) {
    data.description = String(req.body.description ?? '');
  }

  const photo = await prisma.albumPhoto.update({
    where: { id },
    data,
  });
  res.json(photo);
});

app.delete('/api/album-photos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.albumPhoto.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const acting = await assertActingUser(req, res);
  if (!acting) return;
  if (!existing.course || !canAccessCourse(existing.course, acting)) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  if (rejectIfArchivedCourse(res, existing.course)) return;
  await prisma.albumPhoto.delete({ where: { id } });
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

function prepareListEntry(entry, entryModelName) {
  return decryptKlassenlehrerListEntry(getDekFromContext(), entry, entryModelName);
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
    (list.entries || []).map((e) => mapSerializedListEntry(prepareListEntry(e, 'MoneyListEntry'), 'paid')),
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
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, existing.courseId);
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
  const ok = await assertCourseWritable(req, res, existing.courseId);
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

  res.json({ ...mapSerializedListEntry(prepareListEntry(updated, 'MoneyListEntry'), 'paid'), moneyListId: updated.moneyListId });
});

app.post('/api/money-lists/:id/external-entries', async (req, res) => {
  const listId = Number(req.params.id);
  const list = await prisma.moneyList.findUnique({
    where: { id: listId },
    include: { course: true },
  });
  if (!list) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseWritable(req, res, list.courseId);
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

  res.status(201).json({ ...mapSerializedListEntry(prepareListEntry(entry, 'MoneyListEntry'), 'paid'), moneyListId: entry.moneyListId });
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
    (list.entries || []).map((e) => mapSerializedListEntry(prepareListEntry(e, 'AttendanceListEntry'), 'present')),
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
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, existing.courseId);
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
  const ok = await assertCourseWritable(req, res, existing.courseId);
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

  res.json({ ...mapSerializedListEntry(prepareListEntry(updated, 'AttendanceListEntry'), 'present'), attendanceListId: updated.attendanceListId });
});

app.post('/api/attendance-lists/:id/external-entries', async (req, res) => {
  const listId = Number(req.params.id);
  const list = await prisma.attendanceList.findUnique({
    where: { id: listId },
    include: { course: true },
  });
  if (!list) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseWritable(req, res, list.courseId);
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

  res.status(201).json({ ...mapSerializedListEntry(prepareListEntry(entry, 'AttendanceListEntry'), 'present'), attendanceListId: entry.attendanceListId });
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
    (list.entries || []).map((e) => mapSerializedListEntry(prepareListEntry(e, 'CollectionListEntry'), 'collected')),
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
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, existing.courseId);
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
  const ok = await assertCourseWritable(req, res, existing.courseId);
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

  res.json({ ...mapSerializedListEntry(prepareListEntry(updated, 'CollectionListEntry'), 'collected'), collectionListId: updated.collectionListId });
});

app.post('/api/collection-lists/:id/external-entries', async (req, res) => {
  const listId = Number(req.params.id);
  const list = await prisma.collectionList.findUnique({
    where: { id: listId },
    include: { course: true },
  });
  if (!list) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseWritable(req, res, list.courseId);
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

  res.status(201).json({ ...mapSerializedListEntry(prepareListEntry(entry, 'CollectionListEntry'), 'collected'), collectionListId: entry.collectionListId });
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
  const entries = sortSerializedListEntries(
    (list.entries || []).map((e) => mapSerializedNotesListEntry(prepareListEntry(e, 'NotesListEntry'))),
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
  const ok = await assertCourseWritable(req, res, courseId);
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
  const ok = await assertCourseWritable(req, res, existing.courseId);
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
  const ok = await assertCourseWritable(req, res, existing.courseId);
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

  res.json({ ...mapSerializedNotesListEntry(prepareListEntry(updated, 'NotesListEntry')), notesListId: updated.notesListId });
});

app.post('/api/notes-lists/:id/external-entries', async (req, res) => {
  const listId = Number(req.params.id);
  const list = await prisma.notesList.findUnique({
    where: { id: listId },
    include: { course: true },
  });
  if (!list) return res.status(404).json({ error: 'not found' });
  const ok = await assertCourseWritable(req, res, list.courseId);
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

  res.status(201).json({ ...mapSerializedNotesListEntry(prepareListEntry(entry, 'NotesListEntry')), notesListId: entry.notesListId });
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
  const acting = await assertAdminUser(req, res);
  if (!acting) return;

  res.json({ ok: true, message: 'PhiX wird heruntergefahren.' });

  setImmediate(() => {
    shutdownPhix({ prisma, server: getShutdownServer() }).catch((err) => {
      console.error('[shutdown] Fehler:', err);
      process.exit(1);
    });
  });
});

/** Electron-Desktop: gebautes Frontend vom Backend ausliefern (ein Prozess, Port 3000). */
function setupStandaloneFrontend() {
  if (process.env.PHIX_STANDALONE !== '1') return;

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

  const dbUrl = String(process.env.DATABASE_URL || '').trim();
  const dbKind = dbUrl.startsWith('file:') || dbUrl.startsWith('sqlite:') ? 'sqlite' : 'postgresql';
  console.log(`[config] Datenbank: ${dbKind}`);

  return {
    app,
    prisma,
    ensureAppUsers,
    attachHttpServer(server) {
      getShutdownServer = () => server;
    },
  };
}

module.exports = { createApp };
