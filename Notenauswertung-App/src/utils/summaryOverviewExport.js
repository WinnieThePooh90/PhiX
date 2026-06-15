import {
  calculateStudentGrades,
  formatGrade,
  formatCalculatedGradeValue,
  normalizeCourseGradeSystem,
  storedGradeStringToClassic,
} from './calculator';
import { expandRowsWithStudentNotes } from './studentNotesExport';

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

/**
 * Tabellendaten der Gesamtübersicht (Übersicht) für Export — gleiche Spalten wie in SummaryView.
 * @returns {{ headers: string[], rows: (string|number)[][], layout: ReturnType<typeof buildSummaryOverviewExportLayout> }}
 */
export function buildSummaryOverviewExportData({
  students,
  exams,
  orals,
  tests,
  projects = {},
  gfsEntries,
  config,
}) {
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const npSuffix = gradeSys === 'points' ? ' (NP)' : '';
  const showTests = config?.testsWritten !== false;
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const weighting = config?.weighting;

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

  const fmt = (g, valuesAreNotenpunkte = false) =>
    g === null || g === undefined ? '' : formatCalculatedGradeValue(g, gradeSys, valuesAreNotenpunkte);

  const rows = expandRowsWithStudentNotes(
    students,
    (s, idx) => {
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
      );
      const manualEndNum = storedGradeStringToClassic(s.summaryEndNote, gradeSys);
      const manualDisplay = manualEndNum !== null ? formatGrade(manualEndNum, gradeSys) : '';
      const hj1Num = storedGradeStringToClassic(s.summaryHJ1Note, gradeSys);
      const hj1Display = hj1Num !== null ? formatGrade(hj1Num, gradeSys) : '';

      return [
        s.studentNumber ?? idx + 1,
        s.lastName ?? '',
        s.firstName ?? '',
        fmt(examAvg, valuesAreNotenpunkte),
        fmt(oralAvg, valuesAreNotenpunkte),
        ...(showTests ? [fmt(testAvg, valuesAreNotenpunkte)] : []),
        fmt(finalGrade, valuesAreNotenpunkte),
        hj1Display,
        manualDisplay,
      ];
    },
    headers.length,
    { textColumnIndex: 1 },
  );

  return { headers, rows, layout: buildSummaryOverviewExportLayout(showTests) };
}

export { summaryOverviewExportFilename } from './exportFilenames';
