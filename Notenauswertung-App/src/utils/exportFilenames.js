/** Dateiname für Export (ohne Pfad). @param {string} [ext] z. B. xlsx oder pdf */
export function buildExportFilename(segments, ext = 'xlsx') {
  const safeExt = String(ext || 'xlsx').replace(/^\./, '');
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
  return `${base}.${safeExt}`;
}

export function summaryOverviewExportFilename(course, ext = 'xlsx') {
  return buildExportFilename(['Uebersicht', course?.subject, course?.className, course?.year], ext);
}

export function examExportFilename(course, examId, ext = 'xlsx') {
  return buildExportFilename(['Klausur', `KA-${examId}`, course?.subject, course?.className, course?.year], ext);
}

export function testExportFilename(course, testId, testName, ext = 'xlsx') {
  const label = testName?.trim() ? testName.trim() : `Test-${testId}`;
  return buildExportFilename(['Test', label, course?.subject, course?.className, course?.year], ext);
}

export function oralExportFilename(course, oralId, oralName, ext = 'xlsx') {
  const label = oralName?.trim() ? oralName.trim() : `Muendlich-${oralId}`;
  return buildExportFilename(['Muendlich', label, course?.subject, course?.className, course?.year], ext);
}

export function oralExtendedExportFilename(course, oralId, oralName, ext = 'xlsx') {
  const label = oralName?.trim() ? oralName.trim() : `Muendlich-${oralId}`;
  return buildExportFilename(
    ['Muendlich-erweitert', label, course?.subject, course?.className, course?.year],
    ext,
  );
}

/** Gesamtexport des aktuellen Kurses (alle Blätter in einer Datei). */
export function courseFullExportFilename(course, ext = 'xlsx') {
  return buildExportFilename(['Klasse', course?.subject, course?.className, course?.year], ext);
}
