/** Tests zählen als halbe Klausur im Schriftlich-Durchschnitt (ohne eigene Gewichtungssäule). */
export function usesTestsAsHalfExam(config) {
  if (!config || config.testsWritten === false) return false;
  return config.advancedWeightingEnabled === true && config.testsAsHalfExam === true;
}

/** Tests-Spalte im Gewichtungs-Verhältnis (3. Feld) anzeigen. */
export function showTestsInWeightingRatio(config) {
  return config?.testsWritten !== false && !usesTestsAsHalfExam(config);
}
