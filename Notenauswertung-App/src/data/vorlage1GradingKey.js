/**
 * Notenschlüssel „Vorlage 1“:
 * Linke Punktgrenze je Note g (1,0 … 6,0 in 0,25er-Schritten):
 *   RUNDEN(2 · (−0,15·g + 1,05) · MAX) / 2  (RUNDEN = auf 0,5er-Punkte)
 * Rechte Grenze: bei 1,0 = MAX; sonst linke Grenze der vorigen Note − 0,5.
 */

export const VORLAGE_1_GRADES = Array.from({ length: 21 }, (_, i) => Math.round((1 + i * 0.25) * 4) / 4);

/** RUNDEN auf 0,5er-Punkte für erreichte Punktzahl: ROUND(2·x)/2 */
export function roundPointsHalfStep(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 2) / 2;
}

/**
 * Linke Punktgrenze für Note g.
 * Formel: RUNDEN(2·(−0,15·g+1,05)·max) / 2 — RUNDEN = auf ganze Zahl, Ergebnis in 0,5er-Schritten.
 */
export function vorlage1LeftBoundary(grade, maxPoints) {
  const g = Number(grade);
  const max = Number(maxPoints);
  if (!Number.isFinite(g) || !Number.isFinite(max) || max <= 0) return null;
  const inner = 2 * (-0.15 * g + 1.05) * max;
  return Math.round(inner) / 2;
}

/**
 * Punktintervalle je Note (pktLo … pktHi, inkl.).
 * @returns {{ g: number, pktLo: number, pktHi: number }[]}
 */
export function buildVorlage1PointIntervals(maxPoints) {
  const max = Number(maxPoints);
  if (!Number.isFinite(max) || max <= 0) return [];

  return VORLAGE_1_GRADES.map((g, index) => {
    const pktLo = vorlage1LeftBoundary(g, max);
    const pktHi = index === 0 ? max : vorlage1LeftBoundary(VORLAGE_1_GRADES[index - 1], max) - 0.5;
    return {
      g,
      pktLo: Math.min(pktLo, pktHi),
      pktHi: Math.max(pktLo, pktHi),
    };
  });
}

/** Prozent-Bänder für gradeFromPercentBands / Diagramme. */
export function buildVorlage1Bands(maxPoints) {
  return buildVorlage1PointIntervals(maxPoints).map(({ g, pktLo, pktHi }) => ({
    g,
    lo: (pktLo / maxPoints) * 100,
    hi: (pktHi / maxPoints) * 100,
  }));
}

/** Note aus erreichten Punkten (Raster 0,5). */
export function gradeFromVorlage1Points(points, maxPoints) {
  const p = Number(points);
  const max = Number(maxPoints);
  if (!Number.isFinite(p)) return null;
  if (max <= 0) return Number.isFinite(p) ? 6.0 : null;
  const pts = roundPointsHalfStep(Math.min(max, Math.max(0, p)));
  const intervals = buildVorlage1PointIntervals(max);
  for (const { g, pktLo, pktHi } of intervals) {
    if (pts >= pktLo - 1e-9 && pts <= pktHi + 1e-9) return g;
  }
  return 6.0;
}

export const VORLAGE_1_KEY = {
  id: 'vorlage-1',
  name: 'Vorlage 1',
  template: 'vorlage1',
  referenceMaxPoints: 50,
  bands: [],
};

export const VORLAGE_1_DESC =
  'Formel: linke Grenze = RUNDEN(2·(−0,15·Note+1,05)·Max)/2 (0,5er-Punkte); rechte Grenze bei 1,0 = Max, sonst vorige linke Grenze − 0,5.';

export function isVorlage1KeyFamilyId(id) {
  return typeof id === 'string' && (id === VORLAGE_1_KEY.id || id.startsWith(`${VORLAGE_1_KEY.id}~`));
}

/** Nächste freie id/name für eine weitere Vorlage „Vorlage 1“ im Kurs. */
export function nextVorlage1TemplateCloneIdentity(existingKeys) {
  const baseId = VORLAGE_1_KEY.id;
  const baseName = VORLAGE_1_KEY.name;
  const list = Array.isArray(existingKeys) ? existingKeys : [];
  const names = new Set(list.map((k) => k.name));
  const ids = new Set(list.map((k) => k.id));

  if (!ids.has(baseId)) {
    let name = baseName;
    if (names.has(baseName)) {
      let n = 1;
      while (names.has(`${baseName} (${n})`)) n += 1;
      name = `${baseName} (${n})`;
    }
    return { id: baseId, name };
  }

  let n = 1;
  for (;;) {
    const name = `${baseName} (${n})`;
    const id = `${baseId}~${n}`;
    if (!names.has(name) && !ids.has(id)) return { id, name };
    n += 1;
  }
}
