import {
  formatGrade,
  normalizeCourseGradeSystem,
  storedGradeStringToClassic,
} from './calculator';

function studentNameById(students, studentId) {
  const st = (students ?? []).find((s) => s.id === studentId);
  if (!st) return `Schüler #${studentId}`;
  return `${st.lastName ?? ''}, ${st.firstName ?? ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
}

/**
 * GFS-Tabelle als AOA (ohne Aktion-Spalte).
 * @returns {{ headers: string[], rows: (string|number)[][] }}
 */
export function buildGfsTableExportData({ gfsEntries, students, config }) {
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const npSuffix = gradeSys === 'points' ? ' (NP)' : '';

  const headers = ['Nr.', 'Name', 'Thema', 'Art', 'Datum', 'Gehalten', 'Halbjahr', `Note${npSuffix}`];

  const rows = (gfsEntries ?? []).map((row, idx) => {
    const noteNum = storedGradeStringToClassic(row.note, gradeSys);
    const noteDisplay = noteNum !== null ? formatGrade(noteNum, gradeSys) : '';
    return [
      idx + 1,
      studentNameById(students, row.studentId),
      row.thema ?? '',
      row.art ?? '',
      row.date ?? '',
      row.gehalten === true ? 'Ja' : 'Nein',
      row.halbjahr === '2' ? 'HJ 2' : 'HJ 1',
      noteDisplay,
    ];
  });

  return { headers, rows };
}

export function gfsExportSheetName() {
  return 'GFS';
}
