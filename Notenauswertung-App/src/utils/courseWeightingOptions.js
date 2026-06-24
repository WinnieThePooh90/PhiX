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

/** x Tests = 1 Klausur: Tests-Gewicht wird aus Klausuranzahl und Testanzahl berechnet. */
export function usesTestsPerKlausurRatio(config) {
  if (!config || config.testsWritten === false) return false;
  return config.advancedWeightingEnabled === true && config.testsPerKlausurEnabled === true;
}

/** Tests-Spalte im Gewichtungs-Verhältnis (3. Feld) anzeigen. */
export function showTestsInWeightingRatio(config) {
  return config?.testsWritten !== false && !usesTestsAsHalfExam(config) && !usesTestsAsOral(config);
}

/** Tests-Gewicht in der Gewichtungszeile wird automatisch berechnet (nicht manuell). */
export function isTestsWeightComputed(config) {
  return usesTestsPerKlausurRatio(config);
}

/** Tests als eigene Säule in der Endnote gewichten. */
export function includeTestsInFinalWeight(config) {
  if (!config || config.testsWritten === false) return false;
  return !usesTestsAsHalfExam(config) && !usesTestsAsOral(config);
}

/** Gehaltene Referate zählen im Schriftlich-Durchschnitt wie Klausuren. */
export function usesReferatAsExam(config) {
  if (!config || config.referateAccepted !== true) return false;
  return config.referatAsExam === true;
}

/** Gehaltene Referate zählen im Mündlich-Durchschnitt wie mündliche Noten. */
export function usesReferatAsOral(config) {
  if (!config || config.referateAccepted !== true) return false;
  return config.referatAsOral === true;
}

/** Referat-Einträge für Schriftlich (leer, wenn nicht als Klausur gewertet). */
export function effectiveReferatEntriesForGrading(config, referatEntries) {
  if (!usesReferatAsExam(config)) return [];
  return Array.isArray(referatEntries) ? referatEntries : [];
}

/** Referat-Einträge für Mündlich (leer, wenn nicht mündlich gewertet). */
export function effectiveReferatEntriesForOralGrading(config, referatEntries) {
  if (!usesReferatAsOral(config)) return [];
  return Array.isArray(referatEntries) ? referatEntries : [];
}

/** Gehaltene Referate zählen anteilig im Schriftlich-Durchschnitt (x % einer Klausur). */
export function usesReferatWrittenPercent(config) {
  if (!config || config.referateAccepted !== true) return false;
  return config.referatWrittenPercentEnabled === true;
}

export function getReferatWrittenPercent(config) {
  const pct = Number(config?.referatWrittenPercent);
  if (!Number.isFinite(pct)) return 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Anteil einer Klausur (0–1) für anteilig schriftliche Referate. */
export function getReferatWrittenUnitWeight(config) {
  if (!usesReferatWrittenPercent(config)) return 0;
  return getReferatWrittenPercent(config) / 100;
}

/** Referat-Einträge für anteilig schriftliche Gewichtung. */
export function effectiveReferatEntriesForPartialWrittenGrading(config, referatEntries) {
  if (!usesReferatWrittenPercent(config)) return [];
  return Array.isArray(referatEntries) ? referatEntries : [];
}

/** Gehaltene Referate zählen anteilig im Mündlich-Durchschnitt (x % einer mündlichen Note). */
export function usesReferatOralPercent(config) {
  if (!config || config.referateAccepted !== true) return false;
  return config.referatOralPercentEnabled === true;
}

export function getReferatOralPercent(config) {
  const pct = Number(config?.referatOralPercent);
  if (!Number.isFinite(pct)) return 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Anteil einer mündlichen Note (0–1) für anteilig mündliche Referate. */
export function getReferatOralUnitWeight(config) {
  if (!usesReferatOralPercent(config)) return 0;
  return getReferatOralPercent(config) / 100;
}

/** Referat-Einträge für anteilig mündliche Gewichtung. */
export function effectiveReferatEntriesForPartialOralGrading(config, referatEntries) {
  if (!usesReferatOralPercent(config)) return [];
  return Array.isArray(referatEntries) ? referatEntries : [];
}

/** Gehaltene Referate zählen anteilig direkt in die Gesamtnote. */
export function usesReferatFinalPercent(config) {
  if (!config || config.referateAccepted !== true) return false;
  return config.referatFinalPercentEnabled === true;
}

export function getReferatFinalPercent(config) {
  const pct = Number(config?.referatFinalPercent);
  if (!Number.isFinite(pct)) return 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Referat-Einträge für prozentualen Anteil an der Gesamtnote. */
export function effectiveReferatEntriesForFinalPercentGrading(config, referatEntries) {
  if (!usesReferatFinalPercent(config)) return [];
  return Array.isArray(referatEntries) ? referatEntries : [];
}

/** Für Berechnungsfunktionen mit Einzelflags statt Config-Objekt. */
export function includeTestsInFinalWeightFromFlags(testsWritten, testsAsHalfExam, testsAsOral) {
  return testsWritten && !testsAsHalfExam && !testsAsOral;
}

export function getTestsPerKlausurX(config) {
  const x = Number(config?.testsPerKlausur);
  if (!Number.isFinite(x) || x < 1) return 10;
  return Math.min(99, Math.round(x));
}

export function countActiveCourseExams(exams) {
  return Object.values(exams || {}).filter((exam) => exam?.active !== false).length;
}

export function countActiveCourseTests(tests) {
  return Object.values(tests || {}).filter((test) => test?.active !== false).length;
}

/**
 * Tests-Gewicht aus Schriftlich-Gewicht, x (Tests pro Klausur) und Anzahl aktiver Klausuren/Tests.
 * n Tests entsprechen n/x Klausuren → w_T : w_S = (n/x) : k.
 */
export function computeDynamicTestsWeight(written, examCount, testCount, testsPerKlausur) {
  const wWritten = Number(written);
  if (!Number.isFinite(wWritten) || wWritten < 0) return 0;
  const k = Math.max(1, examCount);
  const n = Math.max(0, testCount);
  const x = Math.max(1, testsPerKlausur);
  if (n === 0) return 0;
  return wWritten * n / (x * k);
}

export function formatComputedTestsWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, '') || '0';
}

export function resolveCourseWeighting(weighting, config, exams, tests) {
  if (!weighting || !usesTestsPerKlausurRatio(config)) return weighting;
  const written = Number(weighting.written);
  const oral = Number(weighting.oral);
  const k = countActiveCourseExams(exams);
  const n = countActiveCourseTests(tests);
  const testsWeight = computeDynamicTestsWeight(written, k, n, getTestsPerKlausurX(config));
  return {
    ...weighting,
    written: Number.isFinite(written) ? written : weighting.written,
    oral: Number.isFinite(oral) ? oral : weighting.oral,
    tests: testsWeight,
  };
}

export function describeTestsPerKlausurWeighting(config, exams, tests) {
  if (!usesTestsPerKlausurRatio(config)) return null;
  const k = countActiveCourseExams(exams);
  const n = countActiveCourseTests(tests);
  const x = getTestsPerKlausurX(config);
  return `${x} Tests = 1 Klausur. Momentan angelegt: ${n} Test${n === 1 ? '' : 's'} und ${k} Klausur${k === 1 ? '' : 'en'}`;
}

/** Aktuelle erweiterte Gewichtungsoptionen für späteres Wiederherstellen sichern. */
export function snapshotAdvancedWeightingOptions(config) {
  return {
    testsAsHalfExam: config?.testsAsHalfExam === true,
    testsAsOral: config?.testsAsOral === true,
    testsPerKlausurEnabled: config?.testsPerKlausurEnabled === true,
    testsPerKlausur: getTestsPerKlausurX(config),
    referatAsExam: config?.referatAsExam === true,
    referatAsOral: config?.referatAsOral === true,
    referatWrittenPercentEnabled: config?.referatWrittenPercentEnabled === true,
    referatWrittenPercent: getReferatWrittenPercent(config),
    referatOralPercentEnabled: config?.referatOralPercentEnabled === true,
    referatOralPercent: getReferatOralPercent(config),
    referatFinalPercentEnabled: config?.referatFinalPercentEnabled === true,
    referatFinalPercent: getReferatFinalPercent(config),
  };
}

/** Gesicherte Optionen nach erneutem Einschalten der erweiterten Gewichtung anwenden. */
export function restoreAdvancedWeightingFromStash(stash) {
  if (!stash || typeof stash !== 'object') {
    return {
      testsAsHalfExam: false,
      testsAsOral: false,
      testsPerKlausurEnabled: false,
      testsPerKlausur: 10,
      referatAsExam: false,
      referatAsOral: false,
      referatWrittenPercentEnabled: false,
      referatWrittenPercent: 100,
      referatOralPercentEnabled: false,
      referatOralPercent: 100,
      referatFinalPercentEnabled: false,
      referatFinalPercent: 100,
    };
  }
  const x = Number(stash.testsPerKlausur);
  return {
    testsAsHalfExam: stash.testsAsHalfExam === true,
    testsAsOral: stash.testsAsOral === true,
    testsPerKlausurEnabled: stash.testsPerKlausurEnabled === true,
    testsPerKlausur: Number.isFinite(x) && x >= 1 ? Math.min(99, Math.round(x)) : 10,
    referatAsExam: stash.referatAsExam === true,
    referatAsOral: stash.referatAsOral === true,
    referatWrittenPercentEnabled: stash.referatWrittenPercentEnabled === true,
    referatWrittenPercent: (() => {
      const pct = Number(stash.referatWrittenPercent);
      if (!Number.isFinite(pct)) return 100;
      return Math.min(100, Math.max(0, Math.round(pct)));
    })(),
    referatOralPercentEnabled: stash.referatOralPercentEnabled === true,
    referatOralPercent: (() => {
      const pct = Number(stash.referatOralPercent);
      if (!Number.isFinite(pct)) return 100;
      return Math.min(100, Math.max(0, Math.round(pct)));
    })(),
    referatFinalPercentEnabled: stash.referatFinalPercentEnabled === true,
    referatFinalPercent: (() => {
      const pct = Number(stash.referatFinalPercent);
      if (!Number.isFinite(pct)) return 100;
      return Math.min(100, Math.max(0, Math.round(pct)));
    })(),
  };
}

/**
 * Schalter „Erweiterte Gewichtungseinstellungen“: beim Aus → Optionen löschen und sichern;
 * beim Ein → zuvor gesicherte Optionen wiederherstellen.
 */
export function patchAdvancedWeightingToggle(enabled, config) {
  if (enabled) {
    return {
      advancedWeightingEnabled: true,
      ...restoreAdvancedWeightingFromStash(config?.advancedWeightingStash),
    };
  }
  return {
    advancedWeightingEnabled: false,
    advancedWeightingStash: snapshotAdvancedWeightingOptions(config),
    testsAsHalfExam: false,
    testsAsOral: false,
    testsPerKlausurEnabled: false,
  };
}
