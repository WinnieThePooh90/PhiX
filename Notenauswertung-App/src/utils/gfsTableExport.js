import {
  formatGrade,
  normalizeCourseGradeSystem,
  isPointsBasedGradeSystem,
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
  const npSuffix = isPointsBasedGradeSystem(gradeSys) ? ' (NP)' : '';
  const isKursstufe = config?.kursstufe === true;

  const headers = isKursstufe
    ? ['Nr.', 'Name', 'Thema', 'Art', 'Datum', 'Gehalten', `Note${npSuffix}`]
    : ['Nr.', 'Name', 'Thema', 'Art', 'Datum', 'Gehalten', 'Halbjahr', `Note${npSuffix}`];

  const rows = (gfsEntries ?? []).map((row, idx) => {
    const noteNum = storedGradeStringToClassic(row.note, gradeSys);
    const noteDisplay = noteNum !== null ? formatGrade(noteNum, gradeSys) : '';
    const base = [
      idx + 1,
      studentNameById(students, row.studentId),
      row.thema ?? '',
      row.art ?? '',
      row.date ?? '',
      row.gehalten === true ? 'Ja' : 'Nein',
    ];
    if (!isKursstufe) base.push(row.halbjahr === '2' ? 'HJ 2' : 'HJ 1');
    base.push(noteDisplay);
    return base;
  });

  return { headers, rows, layout: buildGfsTableExportLayout(config) };
}

export function buildGfsTableExportLayout(config) {
  const isKursstufe = config?.kursstufe === true;
  const headers = isKursstufe
    ? ['Nr.', 'Name', 'Thema', 'Art', 'Datum', 'Gehalten', 'Note']
    : ['Nr.', 'Name', 'Thema', 'Art', 'Datum', 'Gehalten', 'Halbjahr', 'Note'];
  const colWidths = isKursstufe
    ? [6, 32, 28, 14, 12, 10, 10]
    : [6, 32, 28, 14, 12, 10, 10, 10];
  const centerColumnIndexes = isKursstufe ? [0, 5, 6] : [0, 5, 6, 7];
  return { colWidths, centerColumnIndexes, nameColumnIndex: 1, colCount: headers.length };
}

export function gfsExportSheetName() {
  return 'GFS';
}
