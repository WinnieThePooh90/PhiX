import {
  formatGrade,
  getNormalizedOralGrade,
  normalizeCourseGradeSystem,
  storedGradeStringToClassic,
} from './calculator';
import { expandRowsWithStudentNotes } from './studentNotesExport';

function studentNameCell(s) {
  return `${s.lastName ?? ''}, ${s.firstName ?? ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
}

/** Excel-Layout: # und Note zentriert, Name links. */
export function buildOralStandardExportLayout() {
  return {
    colWidths: [6, 32, 12],
    centerColumnIndexes: [0, 2],
    nameColumnIndex: 1,
  };
}

/**
 * Mündliche Noten — nur Standardtabelle (#, Name, Note), ohne Erweitert-Modus.
 * @returns {{ headers: string[], rows: (string|number)[][], layout: ReturnType<typeof buildOralStandardExportLayout> } | null}
 */
export function buildOralStandardTableExportData({ oral, students, config }) {
  if (!oral || oral.extended) return null;

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const npSuffix = gradeSys === 'points' ? ' (NP)' : '';
  const headers = ['#', 'Name', `Note${npSuffix}`];

  const rows = expandRowsWithStudentNotes(
    students,
    (s, idx) => {
      const gradeRaw = oral.grades?.[s.id];
      const { value: gradeInput, counted } = getNormalizedOralGrade(gradeRaw);
      let note = '';
      if (counted) {
        const classic = storedGradeStringToClassic(String(gradeInput ?? ''), gradeSys);
        note = classic !== null ? formatGrade(classic, gradeSys) : '';
      } else {
        note = '—';
      }
      return [s.studentNumber ?? idx + 1, studentNameCell(s), note];
    },
    headers.length,
    { textColumnIndex: 1 },
  );

  return { headers, rows, layout: buildOralStandardExportLayout() };
}

export function oralExportSheetName(oralId, oralName) {
  const n = oralName?.trim();
  return n ? n.slice(0, 31) : `Mündlich ${oralId}`;
}
