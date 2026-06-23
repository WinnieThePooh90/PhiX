import {
  computeOralExtendedCalculatedGrade,
  computeOralExtendedGradesAverage,
  formatGrade,
  getNormalizedOralGrade,
  getNormalizedOralWeekGradesArray,
  getNormalizedOralWeekPointsArray,
  getOralTotalWeekPoints,
  getOralWeekColumnLabel,
  normalizeCourseGradeSystem,
  normalizeOralSpreadBeta,
  storedGradeStringToClassic,
} from './calculator';
import {
  getOralExtendedMode,
  isOralExtendedActive,
  isOralExtendedGrades,
  isOralExtendedPoints,
} from './oralExtendedMode';
import { expandRowsWithStudentNotes } from './studentNotesExport';

function studentNameCell(s) {
  return `${s.lastName ?? ''}, ${s.firstName ?? ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
}

function oralWeekColumnLabel(oral, weekIndex) {
  return getOralWeekColumnLabel(oral?.weekDates, weekIndex);
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

function formatOralWeekGradeExport(raw, gradeSys) {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const classic = storedGradeStringToClassic(t, gradeSys);
  return classic !== null ? formatGrade(classic, gradeSys) : '';
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
  if (!oral || isOralExtendedActive(oral)) return null;

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

/** Excel-Layout: erweiterte Tabelle (#, Name, Wochen, optional Gesamt, Berechnet, Note). */
export function buildOralExtendedExportLayout(weekCount, includeTotalColumn = true) {
  const colCount = (includeTotalColumn ? 5 : 4) + weekCount;
  const centerColumnIndexes = [0];
  for (let i = 2; i < colCount; i += 1) centerColumnIndexes.push(i);
  const colWidths = Array.from({ length: colCount }, () => 10);
  colWidths[0] = 6;
  colWidths[1] = 28;
  for (let i = 2; i < 2 + weekCount; i += 1) colWidths[i] = 9;
  if (colCount >= 3) colWidths[colCount - 3] = 12;
  if (colCount >= 2) colWidths[colCount - 2] = 12;
  if (colCount >= 1) colWidths[colCount - 1] = 10;
  return { colWidths, centerColumnIndexes, nameColumnIndex: 1 };
}

function resolveOralExtendedCalculated(oral, gradeRaw, weekCount, gradeSys, context) {
  const { counted } = getNormalizedOralGrade(gradeRaw);
  if (isOralExtendedGrades(oral)) {
    return computeOralExtendedGradesAverage(gradeRaw, weekCount, gradeSys, counted);
  }
  const useAbiNotenpunkte = oral.notenpunkteAbi === true;
  const totalWeekPts = getOralTotalWeekPoints(gradeRaw, weekCount);
  return computeOralExtendedCalculatedGrade({
    studentSumWeekPoints: totalWeekPts,
    weekCount,
    maxSumWeekPointsInClass: context.maxWeekSumAll,
    classMinWeekSum: context.classWeekMin,
    classMaxWeekSum: context.classWeekMax,
    bestNoteAlpha: oral.bestNote,
    weekSpread: context.weekSpreadValue,
    worstNote: oral.worstNote,
    counted,
    useAbiNotenpunkte,
    gradeSystem: gradeSys,
  });
}

/**
 * Mündliche Noten — Erweiterte Ansicht (Punkte oder Noten pro Woche, Berechnet, Note).
 * @returns {{ headers: string[], rows: (string|number)[][], layout: ReturnType<typeof buildOralExtendedExportLayout> } | null}
 */
export function buildOralExtendedTableExportData({ oral, students, config }) {
  if (!oral || !isOralExtendedActive(oral)) return null;

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const npSuffix = gradeSys === 'points' ? ' (NP)' : '';
  const weekCount = Math.max(0, Number(oral.weekCount) || 0);
  const gradesMode = isOralExtendedGrades(oral);
  const useAbiNotenpunkte = oral.notenpunkteAbi === true;
  const weekSpreadValue = normalizeOralSpreadBeta(oral.weekSpread);

  const weekTotals = (students ?? []).map((st) => getOralTotalWeekPoints(oral.grades?.[st.id], weekCount));
  const classWeekMin = weekTotals.length ? Math.min(...weekTotals) : 0;
  const classWeekMax = weekTotals.length ? Math.max(...weekTotals) : 0;
  const maxWeekSumAll = Math.max(1, classWeekMax);
  const calcContext = { classWeekMin, classWeekMax, maxWeekSumAll, weekSpreadValue };

  const headers = [
    '#',
    'Name',
    ...Array.from({ length: weekCount }, (_, wi) => oralWeekColumnLabel(oral, wi)),
    ...(gradesMode ? [] : ['Gesamt']),
    `Berechnet${npSuffix}`,
    `Note${npSuffix}`,
  ];

  const rows = expandRowsWithStudentNotes(
    students,
    (s, idx) => {
      const gradeRaw = oral.grades?.[s.id];
      const { value: gradeInput, counted } = getNormalizedOralGrade(gradeRaw);
      const weekPointsArr = getNormalizedOralWeekPointsArray(gradeRaw, weekCount);
      const weekGradesArr = getNormalizedOralWeekGradesArray(gradeRaw, weekCount);
      const totalWeekPts = getOralTotalWeekPoints(gradeRaw, weekCount);
      const calculatedGrade = resolveOralExtendedCalculated(oral, gradeRaw, weekCount, gradeSys, calcContext);

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
              !gradesMode && (useAbiNotenpunkte || gradeSys === 'points')
                ? { inputScale: 'notenpunkte' }
                : undefined,
            )
          : '—';

      const weekCells = gradesMode
        ? weekGradesArr.map((g) => formatOralWeekGradeExport(g, gradeSys))
        : weekPointsArr.map(formatOralWeekPointExport);

      return [
        s.studentNumber ?? idx + 1,
        studentNameCell(s),
        ...weekCells,
        ...(gradesMode ? [] : [formatOralTotalExport(totalWeekPts)]),
        berechnet,
        note,
      ];
    },
    headers.length,
    { textColumnIndex: 1 },
  );

  return {
    headers,
    rows,
    layout: buildOralExtendedExportLayout(weekCount, !gradesMode),
  };
}

export function oralExtendedExportSheetName(oralId, oralName) {
  const n = oralName?.trim();
  if (n) return `M ${n}`.slice(0, 31);
  return `Mündl ${oralId} E`.slice(0, 31);
}
