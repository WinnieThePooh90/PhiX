/** Dateiname für Excel-Export (ohne Pfad). */
export function buildExportFilename(segments) {
  const parts = (segments ?? [])
    .filter((p) => p != null && String(p).trim() !== '')
    .map((p) =>
      String(p)
        .trim()
        .replace(/[^\wäöüÄÖÜß.-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean);
  const base = parts.length ? parts.join('-') : 'Export';
  return `${base}.xlsx`;
}

export function summaryOverviewExportFilename(course) {
  return buildExportFilename(['Uebersicht', course?.subject, course?.className, course?.year]);
}

export function examExportFilename(course, examId) {
  return buildExportFilename(['Klausur', `KA-${examId}`, course?.subject, course?.className, course?.year]);
}

export function testExportFilename(course, testId, testName) {
  const label = testName?.trim() ? testName.trim() : `Test-${testId}`;
  return buildExportFilename(['Test', label, course?.subject, course?.className, course?.year]);
}

export function oralExportFilename(course, oralId, oralName) {
  const label = oralName?.trim() ? oralName.trim() : `Muendlich-${oralId}`;
  return buildExportFilename(['Muendlich', label, course?.subject, course?.className, course?.year]);
}
