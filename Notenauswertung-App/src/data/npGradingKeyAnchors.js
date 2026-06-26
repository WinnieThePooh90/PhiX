/**
 * Notenpunkte aus Prozent: feste Anker pro eingebautem Schlüssel 1–6.
 * 0 NP im unteren Plateau, 5 NP bei Note-4-Schwelle, 11 NP bei Note-2-Schwelle,
 * 15 NP ab 95 %; dazwischen linear.
 */

/** @type {Record<string, { badPlateauMax: number, at5: number, at11: number, topPlateauMin: number }>} */
export const BUILTIN_NP_PERCENT_ANCHORS = Object.freeze({
  1: { badPlateauMax: 18, at5: 45, at11: 75, topPlateauMin: 95 },
  2: { badPlateauMax: 20, at5: 47, at11: 77, topPlateauMin: 95 },
  3: { badPlateauMax: 23, at5: 50, at11: 80, topPlateauMin: 95 },
  4: { badPlateauMax: 18, at5: 45, at11: 75, topPlateauMin: 95 },
  5: { badPlateauMax: 20, at5: 47, at11: 77, topPlateauMin: 95 },
  6: { badPlateauMax: 23, at5: 50, at11: 80, topPlateauMin: 95 },
});

/**
 * @param {unknown} type
 * @param {{ percent1?: unknown, percent2?: unknown, percent4?: unknown, goodPlateauMin?: unknown, badPlateauMax?: unknown } | null} [thresholdsOverride]
 */
export function getBuiltinNpPercentAnchors(type, thresholdsOverride = null) {
  const key = String(type ?? '');
  const base = BUILTIN_NP_PERCENT_ANCHORS[key];
  if (!base) return null;

  if (!thresholdsOverride || typeof thresholdsOverride !== 'object') {
    return { ...base };
  }

  const parsePct = (raw) => {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = parseFloat(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const p2 = parsePct(thresholdsOverride.percent2);
  const p4 = parsePct(thresholdsOverride.percent4);
  const gp = parsePct(thresholdsOverride.goodPlateauMin);
  const bp = parsePct(thresholdsOverride.badPlateauMax);

  return {
    badPlateauMax: bp ?? base.badPlateauMax,
    at5: p4 ?? base.at5,
    at11: p2 ?? base.at11,
    topPlateauMin: gp ?? base.topPlateauMin,
  };
}

function lerp(x, x0, y0, x1, y1) {
  if (Math.abs(x1 - x0) < 1e-12) return y0;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/**
 * Notenpunkte (0–15) aus Prozent über lineare Anker.
 * @param {number} percent
 * @param {{ badPlateauMax: number, at5: number, at11: number, topPlateauMin: number }} anchors
 */
export function notenpunkteFromLinearNpAnchors(percent, anchors) {
  const p = Number(percent);
  if (!Number.isFinite(p) || !anchors) return null;

  const bad = Number(anchors.badPlateauMax);
  const at5 = Number(anchors.at5);
  const at11 = Number(anchors.at11);
  const top = Number(anchors.topPlateauMin);
  if (![bad, at5, at11, top].every((x) => Number.isFinite(x))) return null;

  if (p >= top) return 15;
  if (p <= bad) return 0;

  let np;
  if (p < at5) {
    np = lerp(p, bad, 0, at5, 5);
  } else if (p < at11) {
    np = lerp(p, at5, 5, at11, 11);
  } else {
    np = lerp(p, at11, 11, top, 15);
  }

  return Math.round(Math.min(15, Math.max(0, np)));
}

/**
 * Anker aus klassischen Prozent-Bändern (eigene Schlüssel, Vorlage 1).
 * @param {{ g: number, lo: number, hi: number }[]} bands
 * @param {(g: number) => number} normalizeGrade
 */
export function deriveNpAnchorsFromClassicBands(bands, normalizeGrade) {
  if (!bands?.length) return null;
  const byG = (g) =>
    bands.find((b) => Math.abs(normalizeGrade(b.g) - g) < 1e-9);
  const g6 = byG(6);
  const g4 = byG(4);
  const g2 = byG(2);
  const g1 = byG(1);
  const fallback = BUILTIN_NP_PERCENT_ANCHORS['1'];

  return {
    badPlateauMax: g6 ? Number(g6.hi) : fallback.badPlateauMax,
    at5: g4 ? Number(g4.lo) : fallback.at5,
    at11: g2 ? Number(g2.lo) : fallback.at11,
    topPlateauMin: g1 ? Number(g1.lo) : fallback.topPlateauMin,
  };
}

function mergeAdjacentNpBands(bands) {
  if (!bands?.length) return [];
  const sorted = [...bands].sort((a, b) => Number(a.lo) - Number(b.lo));
  const merged = [];
  for (const b of sorted) {
    const np = Math.round(Number(b.np));
    const lo = Number(b.lo);
    const hi = Number(b.hi);
    if (!Number.isFinite(np) || !Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    const last = merged[merged.length - 1];
    if (last && last.np === np && hi >= last.hi - 0.02) {
      last.hi = Math.max(last.hi, hi);
    } else {
      merged.push({ np, lo, hi });
    }
  }
  return merged;
}

/**
 * NP-Bänder für Anzeige und Lookup (ganzzahlige NP je Intervall).
 * @param {{ badPlateauMax: number, at5: number, at11: number, topPlateauMin: number }} anchors
 * @param {(np: number) => number|null} notenpunkteToGrade
 * @returns {{ np: number, g: number, lo: number, hi: number }[]}
 */
export function buildNpBandsFromLinearAnchors(anchors, notenpunkteToGrade, samples = 10000) {
  if (!anchors) return [];
  const steps = Math.max(200, Math.floor(samples));
  let prevNp = null;
  let startPct = 0;
  const raw = [];

  for (let i = 0; i <= steps; i += 1) {
    const pct = (i / steps) * 100;
    const np = notenpunkteFromLinearNpAnchors(pct, anchors);
    if (np === null) continue;
    if (prevNp === null) {
      prevNp = np;
      startPct = 0;
    } else if (np !== prevNp) {
      const boundary = ((i - 0.5) / steps) * 100;
      raw.push({ np: prevNp, lo: startPct, hi: boundary });
      prevNp = np;
      startPct = boundary;
    }
  }
  if (prevNp !== null) {
    raw.push({ np: prevNp, lo: startPct, hi: 100 });
  }

  return mergeAdjacentNpBands(raw)
    .map(({ np, lo, hi }) => ({
      np,
      g: notenpunkteToGrade(np) ?? 6,
      lo,
      hi,
    }))
    .sort((a, b) => Number(b.np) - Number(a.np));
}
