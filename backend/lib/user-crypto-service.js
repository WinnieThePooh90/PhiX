/**
 * UserCrypto anlegen, Klartext-Daten eines Benutzers verschlüsseln.
 */
const {
  createUserCryptoWraps,
  unwrapDekFromPassword,
  rewrapPassword,
  CRYPTO_VERSION,
} = require('./phix-crypto');
const { encryptRow } = require('./encrypted-fields');
const { getEncryptedFields } = require('./encryption-registry');
const { isEncryptedValue } = require('./phix-crypto');

async function createUserCryptoRecord(prisma, userId, password) {
  const wraps = await createUserCryptoWraps(password);
  await prisma.userCrypto.create({
    data: {
      userId,
      cryptoVersion: CRYPTO_VERSION,
      kdfSaltPassword: wraps.kdfSaltPassword,
      kdfSaltRecovery: wraps.kdfSaltRecovery,
      dekWrappedPassword: wraps.dekWrappedPassword,
      dekWrappedRecovery: wraps.dekWrappedRecovery,
    },
  });
  return { recoveryKey: wraps.recoveryKeyDisplay, dek: wraps.dek };
}

async function getUserCryptoForUsername(prisma, username) {
  return prisma.userCrypto.findFirst({
    where: { user: { username } },
    include: { user: { select: { id: true, username: true } } },
  });
}

async function unlockDekWithPassword(prisma, userId, password) {
  const row = await prisma.userCrypto.findUnique({ where: { userId } });
  if (!row) return null;
  return unwrapDekFromPassword(row, password);
}

function rowNeedsEncryption(modelName, row) {
  const fields = getEncryptedFields(modelName);
  if (!fields) return false;
  for (const f of fields) {
    const v = row[f];
    if (v != null && v !== '' && typeof v === 'string' && !isEncryptedValue(v)) return true;
    if (v != null && v !== '' && typeof v !== 'string' && !isEncryptedValue(String(v))) return true;
  }
  return false;
}

async function encryptModelRows(prisma, modelName, rows, dek) {
  const delegate = prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
  if (!delegate?.update) return 0;
  let n = 0;
  for (const row of rows) {
    if (!rowNeedsEncryption(modelName, row)) continue;
    const data = encryptRow(dek, modelName, row);
    const { id, ...rest } = data;
    const fields = getEncryptedFields(modelName);
    const patch = {};
    for (const f of fields) {
      if (rest[f] !== row[f]) patch[f] = rest[f];
    }
    if (Object.keys(patch).length === 0) continue;
    await delegate.update({ where: { id: row.id }, data: patch });
    n += 1;
  }
  return n;
}

async function migratePlaintextForOwner(prisma, dek, ownerUsername) {
  const courses = await prisma.course.findMany({ where: { ownerUsername } });
  const courseIds = courses.map((c) => c.id);
  let updated = 0;
  updated += await encryptModelRows(prisma, 'Course', courses, dek);

  if (courseIds.length) {
    const inCourses = { courseId: { in: courseIds } };
    const [
      students,
      exams,
      projects,
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
      albumPhotos,
    ] = await Promise.all([
      prisma.student.findMany({ where: inCourses }),
      prisma.exam.findMany({ where: inCourses }),
      prisma.project.findMany({ where: inCourses }),
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
      prisma.albumPhoto.findMany({ where: inCourses }),
    ]);
    updated += await encryptModelRows(prisma, 'Student', students, dek);
    updated += await encryptModelRows(prisma, 'Exam', exams, dek);
    updated += await encryptModelRows(prisma, 'Project', projects, dek);
    updated += await encryptModelRows(prisma, 'Oral', orals, dek);
    updated += await encryptModelRows(prisma, 'Test', tests, dek);
    updated += await encryptModelRows(prisma, 'GfsEntry', gfsEntries, dek);
    updated += await encryptModelRows(prisma, 'MoneyList', moneyLists, dek);
    updated += await encryptModelRows(prisma, 'MoneyListEntry', moneyListEntries, dek);
    updated += await encryptModelRows(prisma, 'AttendanceList', attendanceLists, dek);
    updated += await encryptModelRows(prisma, 'AttendanceListEntry', attendanceListEntries, dek);
    updated += await encryptModelRows(prisma, 'CollectionList', collectionLists, dek);
    updated += await encryptModelRows(prisma, 'CollectionListEntry', collectionListEntries, dek);
    updated += await encryptModelRows(prisma, 'NotesList', notesLists, dek);
    updated += await encryptModelRows(prisma, 'NotesListEntry', notesListEntries, dek);
    updated += await encryptModelRows(prisma, 'AlbumPhoto', albumPhotos, dek);
  }

  const years = await prisma.schoolRosterYear.findMany({ where: { ownerUsername } });
  updated += await encryptModelRows(prisma, 'SchoolRosterYear', years, dek);
  const yearIds = years.map((y) => y.id);
  if (yearIds.length) {
    const rosterStudents = await prisma.schoolRosterStudent.findMany({
      where: { schoolYearId: { in: yearIds } },
    });
    updated += await encryptModelRows(prisma, 'SchoolRosterStudent', rosterStudents, dek);
  }

  return { updated };
}

async function changeUserPasswordCrypto(prisma, userId, oldPassword, newPassword) {
  const row = await prisma.userCrypto.findUnique({ where: { userId } });
  if (!row) return false;
  const dek = await unwrapDekFromPassword(row, oldPassword);
  const rewrap = await rewrapPassword(row, dek, newPassword);
  await prisma.userCrypto.update({
    where: { userId },
    data: rewrap,
  });
  return true;
}

module.exports = {
  createUserCryptoRecord,
  getUserCryptoForUsername,
  unlockDekWithPassword,
  migratePlaintextForOwner,
  changeUserPasswordCrypto,
};
