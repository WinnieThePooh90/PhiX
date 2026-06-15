/**
 * Formel-Notenschlüssel (eingebaut 1–3 und Vorlage 1):
 * Linke Punktgrenze je Note g (1,0 … 6,0 in 0,25er-Schritten):
 *   RUNDEN(2 · (−0,15·g + K) · MAX) / 2  (RUNDEN = auf ganze Zahl → 0,5er-Punkte)
 * Rechte Grenze: bei 1,0 = MAX; sonst linke Grenze der vorigen Note − 0,5.
 */

export const FORMULA_GRADING_KEY_INTERCEPTS = {
  1: 1.05,
  2: 1.07,
  3: 1.1,
};

export const FORMULA_QUARTER_GRADES = Array.from({ length: 21 }, (_, i) => Math.round((1 + i * 0.25) * 4) / 4);

/** RUNDEN auf 0,5er-Punkte für erreichte Punktzahl: ROUND(2·x)/2 */
export function roundPointsHalfStep(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 2) / 2;
}

export function getFormulaKeyIntercept(type) {
  const key = String(type ?? '');
  return Object.prototype.hasOwnProperty.call(FORMULA_GRADING_KEY_INTERCEPTS, key)
    ? FORMULA_GRADING_KEY_INTERCEPTS[key]
    : null;
}

export function isFormulaGradingKeyType(type) {
  return getFormulaKeyIntercept(type) != null;
}

/**
 * Linke Punktgrenze für Note g bei Konstante K und Maximalpunktzahl max.
 */
export function formulaLeftBoundary(grade, maxPoints, intercept) {
  const g = Number(grade);
  const max = Number(maxPoints);
  const k = Number(intercept);
  if (!Number.isFinite(g) || !Number.isFinite(max) || max <= 0 || !Number.isFinite(k)) return null;
  const inner = 2 * (-0.15 * g + k) * max;
  return Math.round(inner) / 2;
}

/**
 * @returns {{ g: number, pktLo: number, pktHi: number }[]}
 */
export function buildFormulaPointIntervals(maxPoints, intercept) {
  const max = Number(maxPoints);
  const k = Number(intercept);
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(k)) return [];

  return FORMULA_QUARTER_GRADES.map((g, index) => {
    const pktLo = formulaLeftBoundary(g, max, k);
    const pktHi = index === 0 ? max : formulaLeftBoundary(FORMULA_QUARTER_GRADES[index - 1], max, k) - 0.5;
    return {
      g,
      pktLo: Math.min(pktLo, pktHi),
      pktHi: Math.max(pktLo, pktHi),
    };
  });
}

export function buildFormulaBands(maxPoints, intercept) {
  const max = Number(maxPoints);
  return buildFormulaPointIntervals(max, intercept).map(({ g, pktLo, pktHi }) => ({
    g,
    lo: (pktLo / max) * 100,
    hi: (pktHi / max) * 100,
  }));
}

export function gradeFromFormulaPoints(points, maxPoints, intercept) {
  const p = Number(points);
  const max = Number(maxPoints);
  if (!Number.isFinite(p)) return null;
  if (max <= 0) return Number.isFinite(p) ? 6.0 : null;
  const pts = roundPointsHalfStep(Math.min(max, Math.max(0, p)));
  const intervals = buildFormulaPointIntervals(max, intercept);
  for (const { g, pktLo, pktHi } of intervals) {
    if (pts >= pktLo - 1e-9 && pts <= pktHi + 1e-9) return g;
  }
  return 6.0;
}

/** Anzeige-Konstante mit deutschem Dezimalkomma (z. B. 1,05). */
export function formatFormulaInterceptDe(intercept) {
  return Number(intercept).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getFormulaKeyDesc(type) {
  const k = getFormulaKeyIntercept(type);
  if (k == null) return '';
  return `Formel: linke Grenze = RUNDEN(2·(−0,15·Note+${formatFormulaInterceptDe(k)})·Max)/2 (0,5er-Punkte); rechte Grenze bei 1,0 = Max, sonst vorige linke Grenze − 0,5.`;
}
