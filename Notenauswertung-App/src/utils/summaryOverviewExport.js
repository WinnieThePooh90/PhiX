import {
  calculateStudentGrades,
  formatGrade,
  normalizeCourseGradeSystem,
  storedGradeStringToClassic,
} from './calculator';

/**
 * Tabellendaten der Gesamtübersicht (Übersicht) für Export — gleiche Spalten wie in SummaryView.
 * @returns {{ headers: string[], rows: (string|number)[][] }}
 */
export function buildSummaryOverviewExportData({
  students,
  exams,
  orals,
  tests,
  gfsEntries,
  config,
}) {
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const npSuffix = gradeSys === 'points' ? ' (NP)' : '';
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const weighting = config?.weighting;

  const headers = [
    '#',
    'Name',
    'Vorname',
    `Schriftlich${npSuffix}`,
    `Mündlich${npSuffix}`,
    `Tests${npSuffix}`,
    `Endnote (Exakt)${npSuffix}`,
    `Endnote${npSuffix}`,
  ];

  const fmt = (g) => (g === null || g === undefined ? '' : formatGrade(g, gradeSys));

  const rows = (students ?? []).map((s, idx) => {
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
    );
    const manualEndNum = storedGradeStringToClassic(s.summaryEndNote, gradeSys);
    const manualDisplay = manualEndNum !== null ? formatGrade(manualEndNum, gradeSys) : '';

    return [
      s.studentNumber ?? idx + 1,
      s.lastName ?? '',
      s.firstName ?? '',
      fmt(examAvg),
      fmt(oralAvg),
      fmt(testAvg),
      fmt(finalGrade),
      manualDisplay,
    ];
  });

  return { headers, rows };
}

/** Dateiname für Übersicht-Export (ohne Pfad). */
export function summaryOverviewExportFilename(course) {
  const parts = [
    'Uebersicht',
    course?.subject,
    course?.className,
    course?.year,
  ]
    .filter((p) => p != null && String(p).trim() !== '')
    .map((p) =>
      String(p)
        .trim()
        .replace(/[^\wäöüÄÖÜß.-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean);
  const base = parts.length ? parts.join('-') : 'Uebersicht';
  return `${base}.xlsx`;
}
