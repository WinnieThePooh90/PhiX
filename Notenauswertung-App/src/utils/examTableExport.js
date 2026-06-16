import {
  computeExamClassAverage,
  formatExamClassAverageDisplay,
  formatGrade,
  getExamDisplayFieldCount,
  getExamGradeForStudent,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getStudentExamMaxPointsForGrade,
  normalizeCourseGradeSystem,
} from './calculator';
import { expandRowsWithStudentNotes } from './studentNotesExport';
import { resolveExamGradingKeyForExport } from './gradingKeyExport';

function studentNameCell(s) {
  return `${s.lastName ?? ''}, ${s.firstName ?? ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
}

/**
 * Excel-Layout: breite NAME-Spalte, Zahlen zentriert.
 * @param {number} displayFieldCount
 */
export function buildExamTableExportLayout(displayFieldCount) {
  const colCount = 4 + displayFieldCount;
  const centerColumnIndexes = [0];
  for (let i = 2; i < colCount; i += 1) centerColumnIndexes.push(i);
  const colWidths = Array.from({ length: colCount }, () => 10);
  colWidths[0] = 6;
  colWidths[1] = 32;
  if (colCount >= 2) colWidths[colCount - 2] = 14;
  if (colCount >= 1) colWidths[colCount - 1] = 12;
  for (let i = 2; i < colCount - 2; i += 1) colWidths[i] = 8;
  return { colWidths, centerColumnIndexes, nameColumnIndex: 1 };
}

/**
 * Klausur-Tabelle (Standardansicht) als AOA — zwei Kopfzeilen wie in ExamsView.
 * @returns {{ aoa: (string|number)[][], layout: ReturnType<typeof buildExamTableExportLayout>, gradingKey: ReturnType<typeof resolveExamGradingKeyForExport> }}
 */
export function buildExamTableExport({ exam, examId, students, config }) {
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const displayFieldCount = getExamDisplayFieldCount(exam, students);
  const classAverage = computeExamClassAverage(exam, students, customGradingKeys, gradeSys);
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
      const v = exam?.fieldMaxPoints?.[i];
      return v !== undefined && v !== null && v !== '' ? v : '';
    }),
    exam?.maxPoints ?? '',
    noteMaxCell,
  ];

  const dataRows = expandRowsWithStudentNotes(
    students,
    (s, idx) => {
      const rawSc = exam.scores?.[s.id];
      const effN = getStudentEffectiveExamFieldCount(exam, s.id);
      const { fields, counted, total } = getNormalizedExamScore(rawSc, effN);
      const maxPts = getStudentExamMaxPointsForGrade(exam, s.id);
      const grade = counted ? getExamGradeForStudent(exam, s.id, customGradingKeys) : null;

      const taskCells = Array.from({ length: displayFieldCount }, (_, fieldIndex) => {
        if (fieldIndex >= effN) return '—';
        const val = fields[fieldIndex];
        return val !== undefined && val !== null && val !== '' ? val : '';
      });

      const gesamt = counted ? `${total} / ${maxPts}` : '—';
      let note = '-';
      if (counted && grade !== null) {
        note = formatGrade(grade, gradeSys);
      }

      return [s.studentNumber ?? idx + 1, studentNameCell(s), ...taskCells, gesamt, note];
    },
    header1.length,
    { textColumnIndex: 1 },
  );

  const examAoa = [header1, maxRow, ...dataRows];
  const gradingKey = resolveExamGradingKeyForExport(exam, config);

  return {
    aoa: examAoa,
    layout: buildExamTableExportLayout(displayFieldCount),
    gradingKey,
  };
}

/** @deprecated Nutze buildExamTableExport — liefert nur AOA für Abwärtskompatibilität. */
export function buildExamTableExportAoa(params) {
  return buildExamTableExport(params).aoa;
}

export function examExportSheetName(examId) {
  return `KA ${examId}`;
}
