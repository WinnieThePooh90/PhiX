/**
 * ABI Baden-Württemberg 2026, Mathematik, 100 Bewertungseinheiten → Noten (Viertelnoten).
 * Referenz: 100 BE = 100 %; Klausur-Maximalpunkte sollten 100 sein, damit BE = erreichter Punktwert.
 *
 * Grenzen: inkl. untere/obere BE je Zeile; Prozent hi = (BE_oben+1)/100·100 − ε (oberste Zeile hi = 100).
 */

const REF = 100;

const NP_TO_GRADE = {
  15: 0.75,
  14: 1.0,
  13: 1.25,
  12: 1.5,
  11: 1.75,
  10: 2.0,
  9: 2.25,
  8: 2.5,
  7: 2.75,
  6: 3.0,
  5: 3.25,
  4: 3.5,
  3: 3.75,
  2: 4.0,
  1: 5.25,
  0: 6.0,
};

/** [BE_min, BE_max, Notenpunkte] — Tabelle sehr gut … ungenügend. */
const BE_ROWS = [
  [95, 100, 15],
  [90, 94, 14],
  [85, 89, 13],
  [80, 84, 12],
  [75, 79, 11],
  [70, 74, 10],
  [65, 69, 9],
  [60, 64, 8],
  [55, 59, 7],
  [50, 54, 6],
  [45, 49, 5],
  [40, 44, 4],
  [33, 39, 3],
  [27, 32, 2],
  [20, 26, 1],
  [0, 19, 0],
];

function buildBandsFromBeRows() {
  const EPS = 1e-6;
  return BE_ROWS.map(([beLo, beHi, np]) => {
    const g = NP_TO_GRADE[np];
    const lo = (beLo / REF) * 100;
    const hi = beHi >= REF ? 100 : ((beHi + 1) / REF) * 100 - EPS;
    return { g, lo, hi };
  }).sort((a, b) => a.lo - b.lo);
}

/** Vollständige Definition für `Course.customGradingKeys`. */
export const ABI_BAWUE_2026_100_BE_MATHEMATIK_KEY = {
  id: 'abi-bawue-2026-100-be-mathematik',
  name: 'ABI BaWü 2026 100 BE Mathematik',
  referenceMaxPoints: 100,
  pktIntegerDisplay: true,
  bands: buildBandsFromBeRows(),
};

/** Canonische ID oder Klone `…~1`, `…~2`. */
export function isAbiBaWue2026Mathematik100BeFamilyId(id) {
  return (
    typeof id === 'string' &&
    (id === ABI_BAWUE_2026_100_BE_MATHEMATIK_KEY.id || id.startsWith(`${ABI_BAWUE_2026_100_BE_MATHEMATIK_KEY.id}~`))
  );
}

/**
 * Nächste freie id/name für eine weitere Vorlage „ABI BaWü 2026 100 BE Mathematik“ im Kurs.
 */
export function nextAbiBaWue2026Mathematik100BeTemplateCloneIdentity(existingKeys) {
  const baseId = ABI_BAWUE_2026_100_BE_MATHEMATIK_KEY.id;
  const baseName = ABI_BAWUE_2026_100_BE_MATHEMATIK_KEY.name;
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
