import {
  formatGrade,
  getExamDisplayFieldCount,
  getExamGradeForStudent,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getStudentExamMaxPointsForGrade,
  normalizeCourseGradeSystem,
} from './calculator';

function studentNameCell(s) {
  return `${s.lastName ?? ''}, ${s.firstName ?? ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
}

/**
 * Klausur-Tabelle (Standardansicht) als AOA — zwei Kopfzeilen wie in ExamsView.
 * @returns {(string|number)[][]}
 */
export function buildExamTableExportAoa({ exam, examId, students, config }) {
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const displayFieldCount = getExamDisplayFieldCount(exam, students);

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
    '',
  ];

  const dataRows = (students ?? []).map((s, idx) => {
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
  });

  return [header1, maxRow, ...dataRows];
}

export function examExportSheetName(examId) {
  return `KA ${examId}`;
}
