/**
 * Vollständiges PhiX-Datenbank-Backup (Export / Wiederherstellung).
 */

const BACKUP_FORMAT = 'phix-backup';
const BACKUP_FORMAT_VERSION = 1;

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

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    database: detectDatabaseKind(),
    appBuild: meta.appBuild ?? null,
    data: {
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
  };
}

function serializeBackupPayload(payload) {
  return `${JSON.stringify(payload, jsonReplacer, 2)}\n`;
}

function parseBackupPayload(raw) {
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

async function restorePhixDatabase(prisma, rawPayload) {
  const payload = parseBackupPayload(rawPayload);
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
    restoredAt: new Date().toISOString(),
    backupCreatedAt: payload.createdAt ?? null,
    counts: {
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
    },
  };
}

function backupFilenameFromDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    return `phix-backup-${Date.now()}.json`;
  }
  const stamp = d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `phix-backup-${stamp}Z.json`;
}

module.exports = {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  exportPhixDatabase,
  serializeBackupPayload,
  parseBackupPayload,
  restorePhixDatabase,
  backupFilenameFromDate,
};
