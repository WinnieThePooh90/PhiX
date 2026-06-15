import {
  computeOralExtendedCalculatedGrade,
  formatGrade,
  getNormalizedOralGrade,
  getNormalizedOralWeekPointsArray,
  getOralTotalWeekPoints,
  normalizeCourseGradeSystem,
  normalizeOralSpreadBeta,
  storedGradeStringToClassic,
} from './calculator';
import { expandRowsWithStudentNotes } from './studentNotesExport';

function studentNameCell(s) {
  return `${s.lastName ?? ''}, ${s.firstName ?? ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
}

function oralWeekColumnLabel(oral, weekIndex) {
  const dateStr = (oral?.weekDates || [])[weekIndex];
  if (dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }
  return `Woche ${weekIndex + 1}`;
}

function formatOralWeekPointExport(wp) {
  const v = Number(wp);
  if (!Number.isFinite(v)) return '';
  return v > 0 ? `+${v}` : String(v);
}

function formatOralTotalExport(total) {
  const v = Number(total);
  if (!Number.isFinite(v)) return '0';
  return v > 0 ? `+${v}` : String(v);
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

/** Excel-Layout: erweiterte Tabelle (#, Name, Wochen, Gesamt, Berechnet, Note). */
export function buildOralExtendedExportLayout(weekCount) {
  const colCount = 5 + weekCount;
  const centerColumnIndexes = [0];
  for (let i = 2; i < colCount; i += 1) centerColumnIndexes.push(i);
  const colWidths = Array.from({ length: colCount }, () => 10);
  colWidths[0] = 6;
  colWidths[1] = 28;
  for (let i = 2; i < 2 + weekCount; i += 1) colWidths[i] = 9;
  if (colCount >= 3) colWidths[colCount - 3] = 10;
  if (colCount >= 2) colWidths[colCount - 2] = 12;
  if (colCount >= 1) colWidths[colCount - 1] = 10;
  return { colWidths, centerColumnIndexes, nameColumnIndex: 1 };
}

/**
 * Mündliche Noten — Erweiterte Ansicht (Wochenpunkte, Gesamt, Berechnet, Note).
 * @returns {{ headers: string[], rows: (string|number)[][], layout: ReturnType<typeof buildOralExtendedExportLayout> } | null}
 */
export function buildOralExtendedTableExportData({ oral, students, config }) {
  if (!oral || !oral.extended) return null;

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const npSuffix = gradeSys === 'points' ? ' (NP)' : '';
  const weekCount = Math.max(0, Number(oral.weekCount) || 0);
  const useAbiNotenpunkte = oral.notenpunkteAbi === true;
  const weekSpreadValue = normalizeOralSpreadBeta(oral.weekSpread);

  const weekTotals = (students ?? []).map((st) => getOralTotalWeekPoints(oral.grades?.[st.id], weekCount));
  const classWeekMin = weekTotals.length ? Math.min(...weekTotals) : 0;
  const classWeekMax = weekTotals.length ? Math.max(...weekTotals) : 0;
  const maxWeekSumAll = Math.max(1, classWeekMax);

  const headers = [
    '#',
    'Name',
    ...Array.from({ length: weekCount }, (_, wi) => oralWeekColumnLabel(oral, wi)),
    'Gesamt',
    `Berechnet${npSuffix}`,
    `Note${npSuffix}`,
  ];

  const rows = expandRowsWithStudentNotes(
    students,
    (s, idx) => {
      const gradeRaw = oral.grades?.[s.id];
      const { value: gradeInput, counted } = getNormalizedOralGrade(gradeRaw);
      const weekPointsArr = getNormalizedOralWeekPointsArray(gradeRaw, weekCount);
      const totalWeekPts = getOralTotalWeekPoints(gradeRaw, weekCount);
      const calculatedGrade = computeOralExtendedCalculatedGrade({
        studentSumWeekPoints: totalWeekPts,
        weekCount,
        maxSumWeekPointsInClass: maxWeekSumAll,
        classMinWeekSum: classWeekMin,
        classMaxWeekSum: classWeekMax,
        bestNoteAlpha: oral.bestNote,
        weekSpread: weekSpreadValue,
        worstNote: oral.worstNote,
        counted,
        useAbiNotenpunkte,
        gradeSystem: gradeSys,
      });

      let note = '—';
      if (counted) {
        const classic = storedGradeStringToClassic(String(gradeInput ?? ''), gradeSys);
        note = classic !== null ? formatGrade(classic, gradeSys) : '';
      }

      const berechnet =
        calculatedGrade !== null
          ? formatGrade(
              calculatedGrade,
              gradeSys,
              useAbiNotenpunkte || gradeSys === 'points' ? { inputScale: 'notenpunkte' } : undefined,
            )
          : '—';

      return [
        s.studentNumber ?? idx + 1,
        studentNameCell(s),
        ...weekPointsArr.map(formatOralWeekPointExport),
        formatOralTotalExport(totalWeekPts),
        berechnet,
        note,
      ];
    },
    headers.length,
    { textColumnIndex: 1 },
  );

  return { headers, rows, layout: buildOralExtendedExportLayout(weekCount) };
}

export function oralExtendedExportSheetName(oralId, oralName) {
  const n = oralName?.trim();
  if (n) return `M ${n}`.slice(0, 31);
  return `Mündl ${oralId} E`.slice(0, 31);
}
