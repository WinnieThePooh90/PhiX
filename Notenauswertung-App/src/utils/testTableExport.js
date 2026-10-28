import {
  computeTestClassAverage,
  formatExamClassAverageDisplay,
  formatGrade,
  getExamDisplayFieldCount,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getStudentExamMaxPointsForGrade,
  getTestGradeForStudent,
  gradingKeyResultDisplayOpts,
  normalizeCourseGradeSystem,
} from './calculator';
import { expandRowsWithStudentNotes } from './studentNotesExport';
import { buildExamTableExportLayout } from './examTableExport';
import { resolveExamGradingKeyForExport } from './gradingKeyExport';

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
  const displayFieldCount = getExamDisplayFieldCount(test, students);
  const classAverage = computeTestClassAverage(test, students, customGradingKeys, gradeSys);
  const avgDisplay = formatExamClassAverageDisplay(classAverage, gradeSys);
  const noteMaxCell = avgDisplay ? `Ø\n${avgDisplay}` : 'Ø';

  const header1 = [
    '#',
    'NAME',
    ...Array.from({ length: displayFieldCount }, (_, i) => `A${i + 1}`),
    'GESAMT',
    'NOTE',
  ];

  const maxRow = [
    'Max',
    'Maximalpunkte',
    ...Array.from({ length: displayFieldCount }, (_, i) => {
      const v = test?.fieldMaxPoints?.[i];
      return v !== undefined && v !== null && v !== '' ? v : (displayFieldCount === 1 && test?.maxPoints ? test.maxPoints : '');
    }),
    test?.maxPoints ?? '',
    noteMaxCell,
  ];

  const dataRows = expandRowsWithStudentNotes(
    students,
    (s, idx) => {
      const rawSc = test?.scores?.[s.id] ?? test?.errors?.[s.id];
      const effN = getStudentEffectiveExamFieldCount(test, s.id);
      const { fields, counted, total } = getNormalizedExamScore(rawSc, effN);
      const maxPts = getStudentExamMaxPointsForGrade(test, s.id);
      const grade = counted ? getTestGradeForStudent(test, s.id, customGradingKeys, gradeSys) : null;

      const taskCells = Array.from({ length: displayFieldCount }, (_, fieldIndex) => {
        if (fieldIndex >= effN) return '—';
        const val = fields[fieldIndex];
        return val !== undefined && val !== null && val !== '' ? val : '';
      });

      const gesamt = counted ? `${total} / ${maxPts}` : '—';
      let note = '-';
      if (counted && grade !== null) {
        note = formatGrade(grade, gradeSys, gradingKeyResultDisplayOpts(gradeSys));
      }

      return [s.studentNumber ?? idx + 1, studentNameCell(s), ...taskCells, gesamt, note];
    },
    header1.length,
    { textColumnIndex: 1 },
  );

  return [header1, maxRow, ...dataRows];
}

export function buildTestTableExport({ test, testId, students, config }) {
  const aoa = buildTestTableExportAoa({ test, testId, students, config });
  const displayFieldCount = getExamDisplayFieldCount(test, students);
  const layout = buildExamTableExportLayout(displayFieldCount);
  const gradingKey = resolveExamGradingKeyForExport(test, config);
  return { aoa, layout, gradingKey };
}

export function testExportSheetName(testId, testName) {
  const n = testName?.trim();
  return n ? n.slice(0, 31) : `Test ${testId}`;
}
