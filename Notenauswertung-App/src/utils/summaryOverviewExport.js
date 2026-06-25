import {
  calculateStudentGrades,
  formatGrade,
  formatCalculatedGradeValue,
  formatOverviewCalculatedGrade,
  normalizeCourseGradeSystem,
  storedGradeStringToClassic,
} from './calculator';
import { usesTestsAsHalfExam, usesTestsAsOral, resolveCourseWeighting, effectiveReferatEntriesForGrading, effectiveReferatEntriesForOralGrading, effectiveReferatEntriesForPartialWrittenGrading, effectiveReferatEntriesForPartialOralGrading, effectiveReferatEntriesForFinalPercentGrading, getReferatWrittenUnitWeight, getReferatOralUnitWeight, getReferatFinalPercent } from './courseWeightingOptions';
import { buildStudentNoteExportRows } from './studentNotesExport';
import {
  buildStudentGradesOverviewDetailExportRows,
  buildStudentGradesOverviewDetailSections,
  buildSummaryOverviewDetailContext,
} from './studentGradesOverviewExport';

/** Excel-Layout: # und Notenspalten zentriert, Name/Vorname links. */
export function buildSummaryOverviewExportLayout(showTests) {
  const colCount = showTests ? 9 : 8;
  const centerColumnIndexes = [0];
  for (let c = 3; c < colCount; c += 1) centerColumnIndexes.push(c);
  const colWidths = Array.from({ length: colCount }, () => 12);
  colWidths[0] = 6;
  colWidths[1] = 18;
  colWidths[2] = 14;
  return { colWidths, centerColumnIndexes, nameColumnIndex: 1 };
}

function buildSummaryOverviewStudentRow(s, idx, {
  gradeSys,
  showTests,
  weighting,
  customGradingKeys,
  exams,
  orals,
  tests,
  projects,
  gfsEntries,
  referatEntries,
  config,
}) {
  const fmt = (g, valuesAreNotenpunkte = false) =>
    g === null || g === undefined ? '' : formatCalculatedGradeValue(g, gradeSys, valuesAreNotenpunkte);
  const fmtOverview = (g, valuesAreNotenpunkte = false) =>
    g === null || g === undefined ? '' : formatOverviewCalculatedGrade(g, gradeSys, valuesAreNotenpunkte);

  const { examAvg, oralAvg, testAvg, finalGrade, valuesAreNotenpunkte } = calculateStudentGrades(
    s.id,
    exams,
    orals,
    tests,
    weighting,
    null,
    gfsEntries,
    customGradingKeys,
    gradeSys,
    config?.testsWritten !== false,
    projects,
    usesTestsAsHalfExam(config),
    usesTestsAsOral(config),
    effectiveReferatEntriesForGrading(config, referatEntries),
    effectiveReferatEntriesForOralGrading(config, referatEntries),
    effectiveReferatEntriesForPartialWrittenGrading(config, referatEntries),
    getReferatWrittenUnitWeight(config),
    effectiveReferatEntriesForPartialOralGrading(config, referatEntries),
    getReferatOralUnitWeight(config),
    effectiveReferatEntriesForFinalPercentGrading(config, referatEntries),
    getReferatFinalPercent(config),
  );
  const manualEndNum = storedGradeStringToClassic(s.summaryEndNote, gradeSys);
  const manualDisplay = manualEndNum !== null ? formatGrade(manualEndNum, gradeSys) : '';
  const hj1Num = storedGradeStringToClassic(s.summaryHJ1Note, gradeSys);
  const hj1Display = hj1Num !== null ? formatGrade(hj1Num, gradeSys) : '';

  return [
    s.studentNumber ?? idx + 1,
    s.lastName ?? '',
    s.firstName ?? '',
    fmtOverview(examAvg, valuesAreNotenpunkte),
    fmtOverview(oralAvg, valuesAreNotenpunkte),
    ...(showTests ? [fmt(testAvg, valuesAreNotenpunkte)] : []),
    fmtOverview(finalGrade, valuesAreNotenpunkte),
    hj1Display,
    manualDisplay,
  ];
}

function buildSummaryOverviewRows(students, ctx, { withDetails = false } = {}) {
  const { headers, showTests, detailContext } = ctx;
  const colCount = headers.length;
  const rows = [];

  for (let idx = 0; idx < (students ?? []).length; idx += 1) {
    const student = students[idx];
    rows.push(buildSummaryOverviewStudentRow(student, idx, ctx));
    const noteLines = String(student?.summaryNotes ?? '').trim()
      ? String(student.summaryNotes).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : [];
    if (noteLines.length) {
      rows.push(...buildStudentNoteExportRows(noteLines, colCount, { textColumnIndex: 1 }));
    }
    if (withDetails && detailContext) {
      const sections = buildStudentGradesOverviewDetailSections(student, detailContext);
      rows.push(...buildStudentGradesOverviewDetailExportRows(student, sections, colCount));
    }
  }

  return rows;
}

/**
 * Tabellendaten der Gesamtübersicht (Übersicht) für Export — gleiche Spalten wie in SummaryView.
 * @returns {{ headers: string[], rows: (string|number)[][], layout: ReturnType<typeof buildSummaryOverviewExportLayout> }}
 */
export function buildSummaryOverviewExportData(exportArgs) {
  const data = buildSummaryOverviewExportDataInternal(exportArgs, false);
  return data;
}

/**
 * Übersicht inkl. aufklappbarer Schülerdetails (Halbjahr 1, Halbjahr 2, Gesamt).
 */
export function buildSummaryOverviewWithDetailsExportData(exportArgs) {
  return buildSummaryOverviewExportDataInternal(exportArgs, true);
}

function buildSummaryOverviewExportDataInternal({
  students,
  exams,
  orals,
  tests,
  projects = {},
  gfsEntries,
  referatEntries = [],
  config,
}, withDetails) {
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const npSuffix = gradeSys === 'points' ? ' (NP)' : '';
  const showTests = config?.testsWritten !== false;
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const weighting = resolveCourseWeighting(config?.weighting, config, exams, tests);

  const headers = [
    '#',
    'Name',
    'Vorname',
    `Schriftlich${npSuffix}`,
    `Mündlich${npSuffix}`,
    ...(showTests ? [`Tests${npSuffix}`] : []),
    `Endnote (Exakt)${npSuffix}`,
    `Note HJ1${npSuffix}`,
    `Endnote${npSuffix}`,
  ];

  const ctx = {
    headers,
    showTests,
    gradeSys,
    weighting,
    customGradingKeys,
    exams,
    orals,
    tests,
    projects,
    gfsEntries,
    referatEntries,
    config,
    detailContext: withDetails
      ? buildSummaryOverviewDetailContext({
        exams,
        orals,
        tests,
        projects,
        gfsEntries,
        referatEntries,
        config,
        gradeSys,
        weighting,
        customGradingKeys,
      })
      : null,
  };

  const rows = buildSummaryOverviewRows(students, ctx, { withDetails });
  const layout = buildSummaryOverviewExportLayout(showTests);
  if (withDetails) {
    layout.colWidths[1] = 28;
  }
  return { headers, rows, layout };
}

export { summaryOverviewExportFilename } from './exportFilenames';
