/**
 * Standard-Klausuren und -mündliche Bereiche bei Kurs-Neuanlage.
 * @param {{ id: number, hours?: number|null, kursstufe?: boolean|null }} course
 */
function buildDefaultExamAndOralRecords(course) {
  const hours = Number(course.hours) || 0;
  const kursstufe = course.kursstufe === true;
  const defaultExamKeyType = '1';

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
    weekCount: 0,
    weekDates: [],
    bestNote: 1,
    worstNote: 6,
    weekSpread: 0.5,
    grades: {},
    courseId: course.id,
  });

  const exams = hours >= 4
    ? [examBase(1, '1'), examBase(2, '2')]
    : [examBase(1, '1')];

  let orals;
  if (kursstufe) {
    orals = [oralBase(1, '1'), oralBase(2, '2')];
  } else if (hours > 2) {
    orals = [oralBase(1, '1'), oralBase(2, '1'), oralBase(3, '2'), oralBase(4, '2')];
  } else {
    orals = [oralBase(1, '1'), oralBase(2, '2')];
  }

  return { exams, orals };
}

module.exports = { buildDefaultExamAndOralRecords };
