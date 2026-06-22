/** Tests zählen als halbe Klausur im Schriftlich-Durchschnitt (ohne eigene Gewichtungssäule). */
export function usesTestsAsHalfExam(config) {
  if (!config || config.testsWritten === false) return false;
  return config.advancedWeightingEnabled === true && config.testsAsHalfExam === true;
}

/** Tests zählen wie eine mündliche Note im Mündlich-Durchschnitt (ohne eigene Gewichtungssäule). */
export function usesTestsAsOral(config) {
  if (!config || config.testsWritten === false) return false;
  return config.advancedWeightingEnabled === true && config.testsAsOral === true;
}

/** Tests-Spalte im Gewichtungs-Verhältnis (3. Feld) anzeigen. */
export function showTestsInWeightingRatio(config) {
  return config?.testsWritten !== false && !usesTestsAsHalfExam(config) && !usesTestsAsOral(config);
}

/** Tests als eigene Säule in der Endnote gewichten. */
export function includeTestsInFinalWeight(config) {
  if (!config || config.testsWritten === false) return false;
  return !usesTestsAsHalfExam(config) && !usesTestsAsOral(config);
}

/** Für Berechnungsfunktionen mit Einzelflags statt Config-Objekt. */
export function includeTestsInFinalWeightFromFlags(testsWritten, testsAsHalfExam, testsAsOral) {
  return testsWritten && !testsAsHalfExam && !testsAsOral;
}
