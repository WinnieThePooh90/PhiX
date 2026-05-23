/**
 * PhiX-Backup: vollständige Datenbank (Admin) und benutzerbezogene Kurse/Noten.
 */

const { usernameWhere } = require('./username-filter');

const BACKUP_FORMAT = 'phix-backup';
const BACKUP_FORMAT_VERSION = 1;
const BACKUP_SCOPE_FULL = 'full';
const BACKUP_SCOPE_USER = 'user';

const DATE_FIELDS_BY_MODEL = {
  AppUser: ['createdAt'],
  SchoolRosterYear: ['createdAt'],
  SchoolRosterStudent: ['createdAt'],
  MoneyList: ['dueDate', 'createdAt'],
  AttendanceList: ['sessionDate', 'createdAt'],
  CollectionList: ['sessionDate', 'createdAt'],
  NotesList: ['sessionDate', 'createdAt'],
};

const PG_SEQUENCE_TABLES = [
  'AppUser',
  'Config',
  'Course',
  'SchoolRosterYear',
  'SchoolRosterStudent',
  'Student',
  'MoneyList',
  'MoneyListEntry',
  'AttendanceList',
  'AttendanceListEntry',
  'CollectionList',
  'CollectionListEntry',
  'NotesList',
  'NotesListEntry',
  'GfsEntry',
  'Exam',
  'Oral',
  'Test',
];

const EMPTY_DATA = {
  appUsers: [],
  config: [],
  courses: [],
  students: [],
  schoolRosterYears: [],
  schoolRosterStudents: [],
  exams: [],
  orals: [],
  tests: [],
  gfsEntries: [],
  moneyLists: [],
  moneyListEntries: [],
  attendanceLists: [],
  attendanceListEntries: [],
  collectionLists: [],
  collectionListEntries: [],
  notesLists: [],
  notesListEntries: [],
};

function jsonReplacer(_key, value) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function reviveRow(modelName, row) {
  const out = { ...row };
  for (const field of DATE_FIELDS_BY_MODEL[modelName] || []) {
    if (out[field] != null && typeof out[field] === 'string') {
      out[field] = new Date(out[field]);
    }
  }
  if (modelName === 'Student' && out.frontendId != null && out.frontendId !== '') {
    out.frontendId = BigInt(out.frontendId);
  } else if (modelName === 'Student' && out.frontendId === '') {
    out.frontendId = null;
  }
  return out;
}

function detectDatabaseKind() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (url.startsWith('file:') || url.startsWith('sqlite:')) return 'sqlite';
  return 'postgresql';
}

async function resolveStoredUsername(prisma, username) {
  const row = await prisma.appUser.findFirst({
    where: usernameWhere(username),
    select: { username: true },
  });
  return row?.username ?? null;
}

async function fetchCourseScopedRelations(prisma, courseIds) {
  if (!courseIds.length) {
    return {
      students: [],
      exams: [],
      orals: [],
      tests: [],
      gfsEntries: [],
      moneyLists: [],
      moneyListEntries: [],
      attendanceLists: [],
      attendanceListEntries: [],
      collectionLists: [],
      collectionListEntries: [],
      notesLists: [],
      notesListEntries: [],
    };
  }
  const inCourses = { courseId: { in: courseIds } };
  const [
    students,
    exams,
    orals,
    tests,
    gfsEntries,
    moneyLists,
    moneyListEntries,
    attendanceLists,
    attendanceListEntries,
    collectionLists,
    collectionListEntries,
    notesLists,
    notesListEntries,
  ] = await Promise.all([
    prisma.student.findMany({ where: inCourses }),
    prisma.exam.findMany({ where: inCourses }),
    prisma.oral.findMany({ where: inCourses }),
    prisma.test.findMany({ where: inCourses }),
    prisma.gfsEntry.findMany({ where: inCourses }),
    prisma.moneyList.findMany({ where: inCourses }),
    prisma.moneyListEntry.findMany({ where: { moneyList: { courseId: { in: courseIds } } } }),
    prisma.attendanceList.findMany({ where: inCourses }),
    prisma.attendanceListEntry.findMany({
      where: { attendanceList: { courseId: { in: courseIds } } },
    }),
    prisma.collectionList.findMany({ where: inCourses }),
    prisma.collectionListEntry.findMany({
      where: { collectionList: { courseId: { in: courseIds } } },
    }),
    prisma.notesList.findMany({ where: inCourses }),
    prisma.notesListEntry.findMany({ where: { notesList: { courseId: { in: courseIds } } } }),
  ]);
  return {
    students,
    exams,
    orals,
    tests,
    gfsEntries,
    moneyLists,
    moneyListEntries,
    attendanceLists,
    attendanceListEntries,
    collectionLists,
    collectionListEntries,
    notesLists,
    notesListEntries,
  };
}

function buildBackupEnvelope(scope, ownerUsername, data, meta = {}) {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    scope,
    ownerUsername: ownerUsername ?? null,
    createdAt: new Date().toISOString(),
    database: detectDatabaseKind(),
    appBuild: meta.appBuild ?? null,
    data,
  };
}

async function exportPhixDatabase(prisma, meta = {}) {
  const [
    appUsers,
    config,
    courses,
    students,
    schoolRosterYears,
    schoolRosterStudents,
    exams,
    orals,
    tests,
    gfsEntries,
    moneyLists,
    moneyListEntries,
    attendanceLists,
    attendanceListEntries,
    collectionLists,
    collectionListEntries,
    notesLists,
    notesListEntries,
  ] = await Promise.all([
    prisma.appUser.findMany(),
    prisma.config.findMany(),
    prisma.course.findMany(),
    prisma.student.findMany(),
    prisma.schoolRosterYear.findMany(),
    prisma.schoolRosterStudent.findMany(),
    prisma.exam.findMany(),
    prisma.oral.findMany(),
    prisma.test.findMany(),
    prisma.gfsEntry.findMany(),
    prisma.moneyList.findMany(),
    prisma.moneyListEntry.findMany(),
    prisma.attendanceList.findMany(),
    prisma.attendanceListEntry.findMany(),
    prisma.collectionList.findMany(),
    prisma.collectionListEntry.findMany(),
    prisma.notesList.findMany(),
    prisma.notesListEntry.findMany(),
  ]);

  return buildBackupEnvelope(
    BACKUP_SCOPE_FULL,
    null,
    {
      appUsers,
      config,
      courses,
      students,
      schoolRosterYears,
      schoolRosterStudents,
      exams,
      orals,
      tests,
      gfsEntries,
      moneyLists,
      moneyListEntries,
      attendanceLists,
      attendanceListEntries,
      collectionLists,
      collectionListEntries,
      notesLists,
      notesListEntries,
    },
    meta,
  );
}

async function exportPhixUserDatabase(prisma, ownerUsernameInput, meta = {}) {
  const ownerUsername = await resolveStoredUsername(prisma, ownerUsernameInput);
  if (!ownerUsername) {
    throw new Error('Benutzer nicht gefunden.');
  }

  const courses = await prisma.course.findMany({ where: { ownerUsername } });
  const courseIds = courses.map((c) => c.id);
  const scoped = await fetchCourseScopedRelations(prisma, courseIds);
  const userRow = await prisma.appUser.findFirst({
    where: { username: ownerUsername },
    select: { id: true, username: true },
  });

  return buildBackupEnvelope(
    BACKUP_SCOPE_USER,
    ownerUsername,
    {
      ...EMPTY_DATA,
      appUsers: userRow ? [{ id: userRow.id, username: userRow.username }] : [],
      courses,
      ...scoped,
    },
    meta,
  );
}

function serializeBackupPayload(payload) {
  return `${JSON.stringify(payload, jsonReplacer, 2)}\n`;
}

function getBackupScope(parsed) {
  if (parsed?.scope === BACKUP_SCOPE_USER) return BACKUP_SCOPE_USER;
  return BACKUP_SCOPE_FULL;
}

function parseBackupPayload(raw, { expectedScope } = {}) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('Die Datei ist keine gültige JSON-Datei.');
  }
  if (!parsed || parsed.format !== BACKUP_FORMAT) {
    throw new Error('Ungültiges PhiX-Backup-Format.');
  }
  if (Number(parsed.formatVersion) !== BACKUP_FORMAT_VERSION) {
    throw new Error(`Nicht unterstützte Backup-Version (${parsed.formatVersion}).`);
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Backup enthält keine Daten.');
  }
  const scope = getBackupScope(parsed);
  if (expectedScope && scope !== expectedScope) {
    throw new Error(
      expectedScope === BACKUP_SCOPE_USER
        ? 'Diese Datei ist kein benutzerbezogenes Backup.'
        : 'Diese Datei ist kein vollständiges Datenbank-Backup.',
    );
  }
  if (scope === BACKUP_SCOPE_USER && !String(parsed.ownerUsername ?? '').trim()) {
    throw new Error('Benutzer-Backup enthält keinen Benutzernamen.');
  }
  return parsed;
}

async function clearAllPhixData(tx) {
  await tx.notesListEntry.deleteMany();
  await tx.notesList.deleteMany();
  await tx.collectionListEntry.deleteMany();
  await tx.collectionList.deleteMany();
  await tx.attendanceListEntry.deleteMany();
  await tx.attendanceList.deleteMany();
  await tx.moneyListEntry.deleteMany();
  await tx.moneyList.deleteMany();
  await tx.gfsEntry.deleteMany();
  await tx.test.deleteMany();
  await tx.oral.deleteMany();
  await tx.exam.deleteMany();
  await tx.student.deleteMany();
  await tx.course.deleteMany();
  await tx.schoolRosterStudent.deleteMany();
  await tx.schoolRosterYear.deleteMany();
  await tx.config.deleteMany();
  await tx.appUser.deleteMany();
}

async function clearUserPhixData(tx, ownerUsername) {
  const courses = await tx.course.findMany({
    where: { ownerUsername },
    select: { id: true },
  });
  const courseIds = courses.map((c) => c.id);
  if (!courseIds.length) return;

  await tx.notesListEntry.deleteMany({ where: { notesList: { courseId: { in: courseIds } } } });
  await tx.notesList.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.collectionListEntry.deleteMany({
    where: { collectionList: { courseId: { in: courseIds } } },
  });
  await tx.collectionList.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.attendanceListEntry.deleteMany({
    where: { attendanceList: { courseId: { in: courseIds } } },
  });
  await tx.attendanceList.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.moneyListEntry.deleteMany({ where: { moneyList: { courseId: { in: courseIds } } } });
  await tx.moneyList.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.gfsEntry.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.test.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.oral.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.exam.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.student.deleteMany({ where: { courseId: { in: courseIds } } });
  await tx.course.deleteMany({ where: { ownerUsername } });
}

async function insertMany(tx, model, rows) {
  if (!rows?.length) return;
  const name = model.charAt(0).toLowerCase() + model.slice(1);
  const delegate = tx[name];
  if (!delegate?.createMany) {
    throw new Error(`Unbekanntes Modell: ${model}`);
  }
  const data = rows.map((row) => reviveRow(model, row));
  await delegate.createMany({ data });
}

async function resetPostgresSequences(prisma) {
  for (const table of PG_SEQUENCE_TABLES) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX("id") FROM "${table}"), 1), true);`,
    );
  }
}

function countDataSummary(d) {
  return {
    appUsers: d.appUsers?.length ?? 0,
    courses: d.courses?.length ?? 0,
    students: d.students?.length ?? 0,
    exams: d.exams?.length ?? 0,
    orals: d.orals?.length ?? 0,
    tests: d.tests?.length ?? 0,
    gfsEntries: d.gfsEntries?.length ?? 0,
    moneyLists: d.moneyLists?.length ?? 0,
    attendanceLists: d.attendanceLists?.length ?? 0,
    collectionLists: d.collectionLists?.length ?? 0,
    notesLists: d.notesLists?.length ?? 0,
    schoolRosterYears: d.schoolRosterYears?.length ?? 0,
    schoolRosterStudents: d.schoolRosterStudents?.length ?? 0,
  };
}

async function restorePhixDatabase(prisma, rawPayload) {
  const payload = parseBackupPayload(rawPayload, { expectedScope: BACKUP_SCOPE_FULL });
  const d = payload.data;

  await prisma.$transaction(
    async (tx) => {
      await clearAllPhixData(tx);

      await insertMany(tx, 'AppUser', d.appUsers);
      await insertMany(tx, 'Config', d.config);
      await insertMany(tx, 'Course', d.courses);
      await insertMany(tx, 'SchoolRosterYear', d.schoolRosterYears);
      await insertMany(tx, 'SchoolRosterStudent', d.schoolRosterStudents);
      await insertMany(tx, 'Student', d.students);
      await insertMany(tx, 'Exam', d.exams);
      await insertMany(tx, 'Oral', d.orals);
      await insertMany(tx, 'Test', d.tests);
      await insertMany(tx, 'GfsEntry', d.gfsEntries);
      await insertMany(tx, 'MoneyList', d.moneyLists);
      await insertMany(tx, 'MoneyListEntry', d.moneyListEntries);
      await insertMany(tx, 'AttendanceList', d.attendanceLists);
      await insertMany(tx, 'AttendanceListEntry', d.attendanceListEntries);
      await insertMany(tx, 'CollectionList', d.collectionLists);
      await insertMany(tx, 'CollectionListEntry', d.collectionListEntries);
      await insertMany(tx, 'NotesList', d.notesLists);
      await insertMany(tx, 'NotesListEntry', d.notesListEntries);
    },
    { maxWait: 60_000, timeout: 300_000 },
  );

  if (detectDatabaseKind() === 'postgresql') {
    await resetPostgresSequences(prisma);
  }

  return {
    scope: BACKUP_SCOPE_FULL,
    restoredAt: new Date().toISOString(),
    backupCreatedAt: payload.createdAt ?? null,
    counts: countDataSummary(d),
  };
}

async function restorePhixUserDatabase(prisma, rawPayload, targetUsernameInput) {
  const payload = parseBackupPayload(rawPayload, { expectedScope: BACKUP_SCOPE_USER });
  const targetUsername = await resolveStoredUsername(prisma, targetUsernameInput);
  if (!targetUsername) {
    throw new Error('Ziel-Benutzer nicht gefunden.');
  }
  const backupOwner = String(payload.ownerUsername ?? '').trim();
  if (backupOwner.toLowerCase() !== targetUsername.toLowerCase()) {
    throw new Error('Backup gehört nicht zu diesem Benutzer.');
  }

  const d = payload.data;
  const courses = (d.courses ?? []).map((c) => ({ ...c, ownerUsername: targetUsername }));

  await prisma.$transaction(
    async (tx) => {
      await clearUserPhixData(tx, targetUsername);

      await insertMany(tx, 'Course', courses);
      await insertMany(tx, 'Student', d.students);
      await insertMany(tx, 'Exam', d.exams);
      await insertMany(tx, 'Oral', d.orals);
      await insertMany(tx, 'Test', d.tests);
      await insertMany(tx, 'GfsEntry', d.gfsEntries);
      await insertMany(tx, 'MoneyList', d.moneyLists);
      await insertMany(tx, 'MoneyListEntry', d.moneyListEntries);
      await insertMany(tx, 'AttendanceList', d.attendanceLists);
      await insertMany(tx, 'AttendanceListEntry', d.attendanceListEntries);
      await insertMany(tx, 'CollectionList', d.collectionLists);
      await insertMany(tx, 'CollectionListEntry', d.collectionListEntries);
      await insertMany(tx, 'NotesList', d.notesLists);
      await insertMany(tx, 'NotesListEntry', d.notesListEntries);
    },
    { maxWait: 60_000, timeout: 300_000 },
  );

  if (detectDatabaseKind() === 'postgresql') {
    await resetPostgresSequences(prisma);
  }

  return {
    scope: BACKUP_SCOPE_USER,
    ownerUsername: targetUsername,
    restoredAt: new Date().toISOString(),
    backupCreatedAt: payload.createdAt ?? null,
    counts: countDataSummary({ ...d, courses }),
  };
}

function sanitizeFilenamePart(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/[^\wäöüÄÖÜß.-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function backupFilenameFromPayload(payload) {
  const d = payload?.createdAt ? new Date(payload.createdAt) : new Date();
  const stamp = Number.isNaN(d.getTime())
    ? String(Date.now())
    : d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const scope = getBackupScope(payload);
  if (scope === BACKUP_SCOPE_USER) {
    const user = sanitizeFilenamePart(payload.ownerUsername) || 'benutzer';
    return `phix-user-backup-${user}-${stamp}Z.json`;
  }
  return `phix-full-backup-${stamp}Z.json`;
}

/** @deprecated Nutze backupFilenameFromPayload */
function backupFilenameFromDate(iso) {
  return backupFilenameFromPayload({ createdAt: iso, scope: BACKUP_SCOPE_FULL });
}

module.exports = {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCOPE_FULL,
  BACKUP_SCOPE_USER,
  exportPhixDatabase,
  exportPhixUserDatabase,
  serializeBackupPayload,
  parseBackupPayload,
  getBackupScope,
  restorePhixDatabase,
  restorePhixUserDatabase,
  backupFilenameFromPayload,
  backupFilenameFromDate,
  resolveStoredUsername,
};
