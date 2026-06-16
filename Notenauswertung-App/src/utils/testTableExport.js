import {
  formatGrade,
  computeTestClassAverage,
  formatExamClassAverageDisplay,
  getEffectiveTestMaxPoints,
  getNormalizedTestScore,
  getTestGradeForStudent,
  normalizeCourseGradeSystem,
} from './calculator';
import { expandRowsWithStudentNotes } from './studentNotesExport';

function studentNameCell(s) {
  return `${s.lastName ?? ''}, ${s.firstName ?? ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
}

/**
 * Test-Tabelle (Standardansicht) als AOA.
 * @returns {(string|number)[][]}
 */
export function buildTestTableExportAoa({ test, testId, students, config }) {
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const maxPtsDisplay =
    Number.isFinite(parseFloat(test?.maxPoints)) && parseFloat(test.maxPoints) > 0
      ? parseFloat(test.maxPoints)
      : 10;

  const classAverage = computeTestClassAverage(test, students, customGradingKeys, gradeSys);
  const avgDisplay = formatExamClassAverageDisplay(classAverage, gradeSys);
  const noteMaxCell = avgDisplay ? `Ø\n${avgDisplay}` : 'Ø';

  const header1 = ['#', 'NAME', 'PUNKTE', 'GESAMT', 'NOTE'];
  const maxRow = ['Max', 'Maximalpunkte', '', maxPtsDisplay, noteMaxCell];

  const dataRows = expandRowsWithStudentNotes(
    students,
    (s, idx) => {
      const scoreMap = test.scores ?? test.errors;
      const rawSc = scoreMap?.[s.id];
      const { value: pointsStr, counted } = getNormalizedTestScore(rawSc);
      const grade = counted ? getTestGradeForStudent(test, s.id, customGradingKeys, gradeSys) : null;
      const effectiveMax = getEffectiveTestMaxPoints(test, rawSc);
      const ptsNum = parseFloat(String(pointsStr).replace(',', '.'));

      const punkte =
        pointsStr !== '' && pointsStr !== undefined && pointsStr !== null ? String(pointsStr) : '';
      const gesamt =
        pointsStr !== '' && Number.isFinite(ptsNum) ? `${ptsNum} / ${effectiveMax}` : '—';

      let note = '-';
      if (counted && grade !== null) {
        note = formatGrade(grade, gradeSys);
      }

      return [s.studentNumber ?? idx + 1, studentNameCell(s), punkte, gesamt, note];
    },
    header1.length,
    { textColumnIndex: 1 },
  );

  return [header1, maxRow, ...dataRows];
}

export function testExportSheetName(testId, testName) {
  const n = testName?.trim();
  return n ? n.slice(0, 31) : `Test ${testId}`;
}
