/**
 * ABI Baden-Württemberg 2026, 120 Bewertungseinheiten → Noten (Viertelnoten).
 * Referenz: 120 BE = 100 %; Klausur-Maximalpunkte sollten 120 sein, damit BE = erreichter Punktwert.
 *
 * Grenzen: inkl. untere/ obere BE je Zeile; Prozent hi = (BE_oben+1)/120·100 − ε (letzte Zeile hi = 100).
 */

const NP_TO_GRADE = {
  15: 1.0,
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

/** [BE_min, BE_max, Notenpunkte] — Zeilen wie in der offiziellen Tabelle (oben sehr gut … unten ungenügend). */
const BE_ROWS = [
  [115, 120, 15],
  [108, 114, 14],
  [102, 107, 13],
  [96, 101, 12],
  [90, 95, 11],
  [84, 89, 10],
  [78, 83, 9],
  [72, 77, 8],
  [66, 71, 7],
  [60, 65, 6],
  [54, 59, 5],
  [48, 53, 4],
  [40, 47, 3],
  [32, 39, 2],
  [24, 31, 1],
  [0, 23, 0],
];

function buildBandsFromBeRows() {
  const EPS = 1e-6;
  const TOP_14_HI = 95 - EPS;
  const TOP_15_LO = 95;
  return BE_ROWS.map(([beLo, beHi, np]) => {
    const g = NP_TO_GRADE[np];
    let lo = (beLo / 120) * 100;
    let hi = beHi >= 120 ? 100 : ((beHi + 1) / 120) * 100 - EPS;
    if (np === 14) hi = TOP_14_HI;
    if (np === 15) {
      lo = TOP_15_LO;
      hi = 100;
    }
    return { g, lo, hi, np };
  }).sort((a, b) => a.lo - b.lo);
}

/** Vollständige Definition für `Course.customGradingKeys`. */
export const ABI_BAWUE_2026_120_BE_KEY = {
  id: 'km-bw-abi-physik-2026',
  name: 'ABI BaWü 2026 120 BE',
  referenceMaxPoints: 120,
  /** Pkt-Spalte in Tabellen/Modal als ganze Zahlen (BE-Raster), nicht 0,5-Schritte. */
  pktIntegerDisplay: true,
  bands: buildBandsFromBeRows(),
};

/** Früher eingebauter Schlüsseltyp — nur noch für Bestandsdaten; Auswahl nur noch als Kurs-Vorlage. */
export const LEGACY_BUILTIN_ABI_KEY_TYPE = 'abi';

/** Gleiche Bänder wie {@link ABI_BAWUE_2026_120_BE_KEY} — für eingebauten Schlüsseltyp `abi` (Bestand). */
export const ABI_BAWUE_2026_120_BE_BANDS = ABI_BAWUE_2026_120_BE_KEY.bands;

/** @deprecated gleiche Definition wie {@link ABI_BAWUE_2026_120_BE_KEY} */
export const KM_BW_ABI_PHYSIK_2026_KEY = ABI_BAWUE_2026_120_BE_KEY;

/** Canonische ID oder Klone `…~1`, `…~2` (Klausuren: `custom:…`). */
export function isAbiBaWue2026KeyFamilyId(id) {
  return typeof id === 'string' && (id === ABI_BAWUE_2026_120_BE_KEY.id || id.startsWith(`${ABI_BAWUE_2026_120_BE_KEY.id}~`));
}

/**
 * Nächste freie id/name für eine weitere Vorlage „ABI BaWü 2026 120 BE“ im Kurs.
 * Erste Instanz: canonischer id/name; weitere: Name „… (1)“, „… (2)“, id mit `~n`.
 */
export function nextAbiBaWue2026TemplateCloneIdentity(existingKeys) {
  const baseId = ABI_BAWUE_2026_120_BE_KEY.id;
  const baseName = ABI_BAWUE_2026_120_BE_KEY.name;
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
