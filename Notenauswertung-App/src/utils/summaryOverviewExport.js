import {
  calculateStudentGrades,
  formatGrade,
  normalizeCourseGradeSystem,
  storedGradeStringToClassic,
} from './calculator';
import { expandRowsWithStudentNotes } from './studentNotesExport';

/**
 * Tabellendaten der Gesamtübersicht (Übersicht) für Export — gleiche Spalten wie in SummaryView.
 * @returns {{ headers: string[], rows: (string|number)[][] }}
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

  const fmt = (g) => (g === null || g === undefined ? '' : formatGrade(g, gradeSys));

  const rows = expandRowsWithStudentNotes(
    students,
    (s, idx) => {
      const { examAvg, oralAvg, testAvg, finalGrade } = calculateStudentGrades(
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
        fmt(examAvg),
        fmt(oralAvg),
        ...(showTests ? [fmt(testAvg)] : []),
        fmt(finalGrade),
        hj1Display,
        manualDisplay,
      ];
    },
    headers.length,
    { textColumnIndex: 1 },
  );

  return { headers, rows };
}

export { summaryOverviewExportFilename } from './exportFilenames';
