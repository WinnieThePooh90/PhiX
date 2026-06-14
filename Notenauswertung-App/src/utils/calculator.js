/**
 * Grade Calculator Utility
 * Implements typical German grading logic based on points/errors
 */

import { ABI_BAWUE_2026_120_BE_BANDS } from '../data/kmBwAbiPhysik2026GradingKey';

const EXAM_SCORE_META_KEYS = new Set([
  '_counted',
  '_nachschreiber',
  '_nachschreiberFields',
  '_manualGrade',
  '_manualGradeValue',
]);

/** Obergrenze für Aufgabenfelder (global + Nachschreiber-Erweiterung) */
export const EXAM_ABS_MAX_FIELDS = 100;

const isExamFieldIndexKey = (k) => /^\d+$/.test(String(k));

/**
 * @param {unknown} scoreData
 * @param {number|null|undefined} maxFieldCount — nur Felder 0 .. maxFieldCount-1 in die Summe (Nachschreiber); weglassen = alle numerischen Feldschlüssel wie bisher
 */
export const getNormalizedExamScore = (scoreData, maxFieldCount = null) => {
  if (scoreData === undefined || scoreData === null || scoreData === '') return { fields: {}, counted: true, total: 0 };
  if (typeof scoreData === 'object') {
    const counted = scoreData._counted !== false;
    const total = Object.entries(scoreData)
      .filter(([k]) => !EXAM_SCORE_META_KEYS.has(k))
      .filter(([k]) => isExamFieldIndexKey(k))
      .filter(([k]) => {
        if (maxFieldCount == null || maxFieldCount === undefined) return true;
        return parseInt(k, 10) < maxFieldCount;
      })
      .reduce((sum, [_, v]) => sum + (parseFloat(v) || 0), 0);
    return { fields: scoreData, counted, total };
  }
  return { fields: { 0: scoreData }, counted: true, total: parseFloat(scoreData) || 0 };
};

/** Anzahl Aufgabenfelder für die Berechnung (Nachschreiber kann über exam.numFields hinausgehen) */
export const getStudentEffectiveExamFieldCount = (exam, studentId) => {
  const baseN = Math.max(1, Math.min(EXAM_ABS_MAX_FIELDS, exam.numFields || 1));
  const sc = exam.scores?.[studentId];
  if (sc && typeof sc === 'object' && sc._nachschreiber) {
    const n = parseInt(sc._nachschreiberFields, 10);
    if (!Number.isNaN(n)) return Math.max(1, Math.min(EXAM_ABS_MAX_FIELDS, n));
    return baseN;
  }
  return baseN;
};

/** Tabellenbreite: genug Spalten für jeden Schüler (inkl. Nachschreiber mit mehr Feldern) */
export const getExamDisplayFieldCount = (exam, studentsList) => {
  let m = Math.max(1, Math.min(EXAM_ABS_MAX_FIELDS, exam.numFields || 1));
  (studentsList || []).forEach((s) => {
    m = Math.max(m, getStudentEffectiveExamFieldCount(exam, s.id));
  });
  return Math.min(EXAM_ABS_MAX_FIELDS, m);
};

/** Projekt-Themenfelder: 0 … EXAM_ABS_MAX_FIELDS (im Gegensatz zu Klausuren mindestens 1). */
export const getProjectNumFields = (project) =>
  Math.max(0, Math.min(EXAM_ABS_MAX_FIELDS, Number(project?.numFields) || 0));

export const isProjectGroupGradeMode = (project) => project?.gradeScope === 'group';

export const getProjectGroups = (project) => {
  const g = project?.groups;
  if (!g || typeof g !== 'object' || Array.isArray(g)) return {};
  return g;
};

export const getStudentProjectGroupId = (project, studentId) => {
  if (!isProjectGroupGradeMode(project)) return null;
  const sid = Number(studentId);
  for (const [gid, grp] of Object.entries(getProjectGroups(project))) {
    const ids = Array.isArray(grp?.studentIds) ? grp.studentIds : [];
    if (ids.some((id) => Number(id) === sid)) return gid;
  }
  return null;
};

/** Schlüssel in project.scores: bei Gruppennoten die Gruppen-ID, sonst die Schüler-ID. */
export const getProjectScoreKeyForStudent = (project, studentId) => {
  if (isProjectGroupGradeMode(project)) {
    return getStudentProjectGroupId(project, studentId);
  }
  return studentId;
};

export const getStudentEffectiveProjectFieldCount = (project, _studentId) =>
  getProjectNumFields(project);

export const getProjectEffectiveFieldCountForScoreKey = (project, _scoreKey) =>
  getProjectNumFields(project);

export const getProjectDisplayFieldCount = (project, studentsList) => {
  let m = getProjectNumFields(project);
  if (isProjectGroupGradeMode(project)) {
    Object.keys(getProjectGroups(project)).forEach((gid) => {
      m = Math.max(m, getProjectEffectiveFieldCountForScoreKey(project, gid));
    });
  } else {
    (studentsList || []).forEach((s) => {
      m = Math.max(m, getStudentEffectiveProjectFieldCount(project, s.id));
    });
  }
  return Math.min(EXAM_ABS_MAX_FIELDS, m);
};

const getProjectMaxPointsForFieldCount = (project, n) => {
  const baseN = getProjectNumFields(project);
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += parseFloat(project.fieldMaxPoints?.[i]) || 0;
  }
  if (sum <= 0) {
    if (n <= baseN) return parseFloat(project.maxPoints) || 0;
    return 0;
  }
  return sum;
};

export const getStudentProjectMaxPointsForGrade = (project, studentId) => {
  const n = getStudentEffectiveProjectFieldCount(project, studentId);
  return getProjectMaxPointsForFieldCount(project, n);
};

export const getProjectMaxPointsForScoreKey = (project, scoreKey) => {
  const n = getProjectEffectiveFieldCountForScoreKey(project, scoreKey);
  return getProjectMaxPointsForFieldCount(project, n);
};

/** Summe der Maximalpunkte nur für die für diesen Schüler gültigen Aufgabenfelder */
export const getStudentExamMaxPointsForGrade = (exam, studentId) => {
  const n = getStudentEffectiveExamFieldCount(exam, studentId);
  const baseN = Math.max(1, Math.min(EXAM_ABS_MAX_FIELDS, exam.numFields || 1));
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += parseFloat(exam.fieldMaxPoints?.[i]) || 0;
  }
  if (sum <= 0) {
    if (n <= baseN) return parseFloat(exam.maxPoints) || 0;
    return 0;
  }
  return sum;
};

export const isExamManualGradeActive = (scoreData) =>
  Boolean(scoreData && typeof scoreData === 'object' && scoreData._manualGrade === true);

export const getExamManualGradeStoredValue = (scoreData) => {
  if (!scoreData || typeof scoreData !== 'object') return '';
  const v = scoreData._manualGradeValue;
  if (v === undefined || v === null) return '';
  return String(v);
};

/** Manuell gespeicherte Klausurnote → klassische Skala 1–6 (für Mittelwerte / Anzeige). */
export const parseExamManualGradeToClassic = (raw, gradeSystem = 'classic') =>
  storedGradeStringToClassic(raw, gradeSystem);

/**
 * Klausurnote eines Schülers: manuell (wenn aktiv) oder aus Punkten / Schlüssel berechnet.
 */
export const getExamGradeForStudent = (exam, studentId, customGradingKeys = null) => {
  const rawScoreData = exam.scores?.[studentId];
  const effN = getStudentEffectiveExamFieldCount(exam, studentId);
  const { counted, total } = getNormalizedExamScore(rawScoreData, effN);
  if (!counted) return null;

  if (isExamManualGradeActive(rawScoreData)) {
    return parseExamManualGradeToClassic(getExamManualGradeStoredValue(rawScoreData));
  }

  const maxPts = getStudentExamMaxPointsForGrade(exam, studentId);
  const customDef = getCustomKeyDefinition(customGradingKeys, exam.keyType || '1');
  const calculatedGrade = calculateGradeFromThresholds(total, maxPts, exam.keyType || '1', null, customDef);
  return Number.isFinite(calculatedGrade) ? calculatedGrade : null;
};

export const getNormalizedOralGrade = (gradeData) => {
  if (gradeData === undefined || gradeData === null || gradeData === '') return { value: '', counted: true };
  if (typeof gradeData === 'object') {
    return { value: gradeData.value ?? '', counted: gradeData._counted !== false };
  }
  return { value: gradeData, counted: true };
};

const ORAL_WEEK_PT_MIN = -2;
const ORAL_WEEK_PT_MAX = 2;

const clampOralWeekPt = (raw) => {
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(ORAL_WEEK_PT_MAX, Math.max(ORAL_WEEK_PT_MIN, n));
};

/**
 * Normalisierte Wochenpunkte (-2 … +2) als Array der Länge `weekCount` (mit 0 aufgefüllt).
 * Unterstützt `weekPoints: number[]` sowie ältere Einträge mit nur `week1`.
 */
export const getNormalizedOralWeekPointsArray = (gradeData, weekCount) => {
  const n = Math.max(0, Number(weekCount) || 0);
  let arr = [];
  if (gradeData && typeof gradeData === 'object') {
    if (Array.isArray(gradeData.weekPoints) && gradeData.weekPoints.length > 0) {
      arr = gradeData.weekPoints.map((v) => clampOralWeekPt(v));
    } else if (gradeData.week1 !== undefined && gradeData.week1 !== null && gradeData.week1 !== '') {
      arr = [clampOralWeekPt(gradeData.week1)];
    }
  }
  while (arr.length < n) arr.push(0);
  if (arr.length > n) arr = arr.slice(0, n);
  return arr;
};

/** Summe aller Wochenpunkte (innerhalb `weekCount`) */
export const getOralTotalWeekPoints = (gradeData, weekCount) =>
  getNormalizedOralWeekPointsArray(gradeData, weekCount).reduce((a, b) => a + b, 0);

/** Faktor BY aus «Beste Note α» (Vorlage PA, Zelle BY1 bei Notenpunkte „Nein“) */
const ORAL_BY_FROM_ALPHA = {
  1: 1,
  1.25: 1.11,
  1.5: 1.235,
  1.75: 1.385,
  2: 1.56,
};

export const ORAL_BEST_NOTE_ALPHA_OPTIONS = [1, 1.25, 1.5, 1.75, 2];

export const normalizeOralBestNoteAlpha = (raw) => {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (Number.isNaN(n)) return ORAL_BEST_NOTE_ALPHA_OPTIONS[0];
  let closest = ORAL_BEST_NOTE_ALPHA_OPTIONS[0];
  let bestD = Math.abs(n - closest);
  for (const v of ORAL_BEST_NOTE_ALPHA_OPTIONS) {
    const d = Math.abs(n - v);
    if (d < bestD) {
      bestD = d;
      closest = v;
    }
  }
  return closest;
};

export const oralBestNoteAlphaToByFactor = (alpha) => ORAL_BY_FROM_ALPHA[normalizeOralBestNoteAlpha(alpha)] ?? 1;

/** Streuung β: 0 … 1, Schritt 0,1 (wie Vorlage C2) */
export const normalizeOralSpreadBeta = (raw) => {
  let n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (Number.isNaN(n)) return 0.5;
  n = Math.min(1, Math.max(0, n));
  return Math.round(n * 10) / 10;
};

/** Schlechteste Note: 4,00 … 6,00 in 0,25-Schritten */
export const ORAL_WORST_NOTE_OPTIONS = Array.from({ length: 9 }, (_, i) => 4 + i * 0.25);

export const normalizeOralWorstNote = (raw) => {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (Number.isNaN(n)) return 6;
  const q = Math.round(n * 4) / 4;
  return Math.min(6, Math.max(4, q));
};

/** Punktesystem (erweiterte mündliche): beste Ausgangslage = hohe Notenpunkte (11 … 15). */
export const ORAL_POINTS_BEST_OPTIONS = [11, 12, 13, 14, 15];

/** Punktesystem: schlechteste Ausgangslage = niedrige Notenpunkte (0 … 5). */
export const ORAL_POINTS_WORST_OPTIONS = [0, 1, 2, 3, 4, 5];

/**
 * Gespeicherten Wert → beste NP (11–15). Legacy: klassische „Beste Note“ α (1 … 2) → 15.
 */
export const normalizeOralBestNotePoints = (raw) => {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) return 15;
  const ri = Math.round(n);
  if (ri >= 11 && ri <= 15) return ri;
  if (n >= 1 && n <= 2.25) return 15;
  return Math.min(15, Math.max(11, ri));
};

/**
 * Gespeicherten Wert → schlechteste NP (0–5). Legacy: klassische Note 4–6 → 0 (Minimum der NP-Skala).
 */
export const normalizeOralWorstNotePoints = (raw) => {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  const ri = Math.round(n);
  if (ri >= 0 && ri <= 5) return ri;
  if (n >= 4 && n <= 6) return 0;
  return Math.min(5, Math.max(0, ri));
};

/**
 * Punkte → Note (1,00 … 6,00 in ¼-Schritten).
 *
 * 1. Normierung q in [0, 1]: `q = (punkte - punkteMin) / (punkteMax - punkteMin)` — 0 = schlecht, 1 = gut;
 *    Werte außerhalb werden auf [0, 1] gekappt.
 * 2. Umkehr für die Notenskala: `t = 1 - q` — hohe Punkte → kleines t (gute Note).
 * 3. Note: `besteNote + (schlechtesteNote - besteNote) * t ** (1 + streuung)` — zwischen bester und
 *    schlechtester Note; Exponent 1 + streuung: streuung 0 → gleichmäßig in t, streuung 1 → stärkere
 *    Krümmung (Kompression in der Mitte der t-Skala, ausgeprägtere Ränder).
 * 4. Runden: `Math.round(note * 4) / 4`, dann auf den Bereich 1 … 6 begrenzen.
 */
export function berechneNote(punkte, punkteMin, punkteMax, besteNote, schlechtesteNote, streuung) {
  const p = Number(punkte);
  const pMin = Number(punkteMin);
  const pMax = Number(punkteMax);
  const bN = Number(besteNote);
  const sN = Number(schlechtesteNote);
  const str = Number(streuung);
  if (![p, pMin, pMax, bN, sN, str].every(Number.isFinite)) return null;
  const denom = pMax - pMin;
  if (denom <= 0) return null;
  let q = (p - pMin) / denom;
  if (q < 0) q = 0;
  if (q > 1) q = 1;
  const t = 1 - q;
  const exp = 1 + str;
  const powT = t <= 0 ? 0 : t ** exp;
  const note = bN + (sN - bN) * powT;
  const rounded = Math.round(note * 4) / 4;
  return Math.min(6, Math.max(1, rounded));
}

/**
 * Wochenpunktsummen → Notenpunkte 0 … 15 (ganz), gleiche Normierung wie {@link berechneNote},
 * aber auf der NP-Skala: hohe Summe → hohe NP (beste Einstellung), niedrige Summe → niedrige NP.
 */
export function berechneNotenpunkte(punkte, punkteMin, punkteMax, bestNp, worstNp, streuung) {
  const p = Number(punkte);
  const pMin = Number(punkteMin);
  const pMax = Number(punkteMax);
  let bNp = Number(bestNp);
  let wNp = Number(worstNp);
  const str = Number(streuung);
  if (![p, pMin, pMax, bNp, wNp, str].every(Number.isFinite)) return null;
  if (wNp > bNp) [wNp, bNp] = [bNp, wNp];
  const denom = pMax - pMin;
  if (denom <= 0) return null;
  let q = (p - pMin) / denom;
  if (q < 0) q = 0;
  if (q > 1) q = 1;
  const t = 1 - q;
  const exp = 1 + str;
  const powT = t <= 0 ? 0 : t ** exp;
  const np = bNp + (wNp - bNp) * powT;
  const rounded = Math.round(np);
  return Math.min(15, Math.max(0, rounded));
}

/**
 * Endnote exakt (Vorlage PA «Mündlich», Spalte G):
 * I = Summe Wochenpunkte, F = max(I) über die Klasse, BY = Faktor(α), H = max(0, I/(F·BY)),
 * bei Notenpunkte „Nein“: G = D·(6 − 5·H^β), sonst (Abitur-Notenpunkte): G = D·(15·H^β),
 * D = 1, wenn Wochenbereich gewertet wird (hier: erweiterter Modus aktiv).
 */
export const computeOralEndnoteExakt = ({
  studentSumWeekPoints,
  maxSumWeekPointsInClass,
  bestNoteAlpha,
  spreadBeta,
  counted,
  /** Entspricht Excel I1 ≠ „Nein“ (Abitur-Notenpunkte) */
  useAbiNotenpunkte = false,
}) => {
  if (!counted) return null;
  const D = 1;
  const beta = normalizeOralSpreadBeta(spreadBeta);
  const by = oralBestNoteAlphaToByFactor(bestNoteAlpha);
  const fMax = Math.max(1, Number(maxSumWeekPointsInClass) || 0);
  const I = Number(studentSumWeekPoints) || 0;
  let H = I / (fMax * by);
  if (H < 0) H = 0;
  if (H > 1) H = 1;
  /* Excel: POWER(H,0)=1; 0^β mit β>0 → 0 */
  const pow = beta === 0 ? 1 : Math.pow(H, beta);
  let G;
  if (useAbiNotenpunkte) {
    G = D * (15 * pow);
  } else {
    G = D * (6 - 5 * pow);
  }
  if (!Number.isFinite(G)) return null;
  if (useAbiNotenpunkte) {
    return Math.min(15, Math.max(0, G));
  }
  return Math.min(6, Math.max(1, G));
};

/**
 * Erweiterte mündliche Berechnung: bei Abitur-Notenpunkten weiter Vorlage PA (H aus Klassenspitze),
 * bei **Punktesystem** ohne ABI: {@link berechneNotenpunkte} mit einstellbarer Spanne (beste NP 11–15,
 * schlechteste NP 0–5); sonst klassisch {@link berechneNote} mit Min/Max der Klasse.
 */
export const computeOralExtendedCalculatedGrade = ({
  studentSumWeekPoints,
  weekCount: _weekCount,
  maxSumWeekPointsInClass,
  /** Minimum der Summen-Wochenpunkte über alle Schüler dieser Liste */
  classMinWeekSum,
  /** Maximum der Summen-Wochenpunkte über alle Schüler dieser Liste */
  classMaxWeekSum,
  bestNoteAlpha,
  weekSpread,
  worstNote,
  counted,
  useAbiNotenpunkte = false,
  gradeSystem = 'classic',
}) => {
  if (!counted) return null;
  if (useAbiNotenpunkte) {
    return computeOralEndnoteExakt({
      studentSumWeekPoints,
      maxSumWeekPointsInClass,
      bestNoteAlpha,
      spreadBeta: weekSpread,
      counted: true,
      useAbiNotenpunkte: true,
    });
  }
  const pMin = Number(classMinWeekSum);
  const pMax = Number(classMaxWeekSum);
  if (!Number.isFinite(pMin) || !Number.isFinite(pMax)) return null;
  const spread = normalizeOralSpreadBeta(weekSpread);
  const gs = normalizeCourseGradeSystem(gradeSystem);

  if (gs === 'points') {
    let bestNp = normalizeOralBestNotePoints(bestNoteAlpha);
    let worstNp = normalizeOralWorstNotePoints(worstNote);
    if (worstNp > bestNp) [worstNp, bestNp] = [bestNp, worstNp];
    if (pMax === pMin) {
      const mid = Math.round((bestNp + worstNp) / 2);
      return Math.min(15, Math.max(0, mid));
    }
    return berechneNotenpunkte(studentSumWeekPoints, pMin, pMax, bestNp, worstNp, spread);
  }

  const b = normalizeOralBestNoteAlpha(bestNoteAlpha);
  const s = normalizeOralWorstNote(worstNote);
  if (pMax === pMin) {
    const mid = (b + s) / 2;
    return Math.min(6, Math.max(1, Math.round(mid * 4) / 4));
  }
  return berechneNote(studentSumWeekPoints, pMin, pMax, b, s, spread);
};

/** Mündliche Note auf ¼-Schritte runden (1,0 … 6,0) */
export const roundOralNoteToQuarter = (grade) => {
  const g = typeof grade === 'number' ? grade : parseFloat(String(grade).replace(',', '.'));
  if (Number.isNaN(g)) return null;
  const q = Math.round(g * 4) / 4;
  return Math.min(6, Math.max(1, q));
};

/** @param {unknown} scoreData — Zahl/Text oder `{ value, _counted?, _nachschreiber?, _nachschreiberMaxPoints? }` */
export const getNormalizedTestScore = (scoreData) => {
  if (scoreData === undefined || scoreData === null || scoreData === '') return { value: '', counted: true };
  if (typeof scoreData === 'object') {
    return { value: scoreData.value ?? '', counted: scoreData._counted !== false };
  }
  return { value: scoreData, counted: true };
};

// Notenschlüssel Parameter: Note 1, 2 und 4 Grenzen in Prozent
export const getThresholds = (type) => {
  switch (type) {
    case '1': return { percent1: 95, percent2: 75, percent4: 45 };
    case '2': return { percent1: 95, percent2: 77, percent4: 47 };
    case '3': return { percent1: 95, percent2: 80, percent4: 50 };
    case '4':
      return {
        goodPlateauMin: 90,
        badPlateauMax: 14,
        percent1: 90,
        percent2: 74,
        percent4: 42,
      };
    case '5':
      return {
        goodPlateauMin: 88,
        badPlateauMax: 18,
        percent1: 88,
        percent2: 76,
        percent4: 44,
      };
    case '6':
      return {
        goodPlateauMin: 85,
        badPlateauMax: 22,
        percent1: 85,
        percent2: 78,
        percent4: 46,
      };
    case 'abi':
      return { percent1: 95, percent2: 75, percent4: 45 };
    default: return { percent1: 95, percent2: 75, percent4: 45 };
  }
};

/**
 * Benutzerdefinierte Schwellen (wie Schlüssel 1–3) mit optionalen Plateaus (wie 4–6).
 * @param {{ percent1: unknown, percent2: unknown, percent4: unknown, goodPlateauMin?: unknown, badPlateauMax?: unknown }} raw
 * @returns {{ percent1: number, percent2: number, percent4: number, goodPlateauMin?: number, badPlateauMax?: number } | null}
 */
export const normalizeGradeKeyThresholds = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const p1 = parseFloat(String(raw.percent1).replace(',', '.'));
  const p2 = parseFloat(String(raw.percent2).replace(',', '.'));
  const p4 = parseFloat(String(raw.percent4).replace(',', '.'));
  if (![p1, p2, p4].every((x) => Number.isFinite(x))) return null;

  let percent1 = Math.min(100, Math.max(0.01, p1));
  let percent4 = Math.min(percent1 - 0.02, Math.max(0, p4));
  let percent2 = Math.max(percent4 + 0.01, Math.min(percent1 - 0.01, p2));

  const out = { percent1, percent2, percent4 };

  if (raw.goodPlateauMin !== undefined && raw.goodPlateauMin !== null && raw.goodPlateauMin !== '') {
    const gp = parseFloat(String(raw.goodPlateauMin).replace(',', '.'));
    if (Number.isFinite(gp)) out.goodPlateauMin = Math.min(100, Math.max(0, gp));
  }
  if (raw.badPlateauMax !== undefined && raw.badPlateauMax !== null && raw.badPlateauMax !== '') {
    const bp = parseFloat(String(raw.badPlateauMax).replace(',', '.'));
    if (Number.isFinite(bp)) out.badPlateauMax = Math.min(100, Math.max(0, bp));
  }
  return out;
};

export const resolveGradingThresholds = (type, overrideThresholds) => {
  const normalized =
    overrideThresholds != null && typeof overrideThresholds === 'object'
      ? normalizeGradeKeyThresholds(overrideThresholds)
      : null;
  return normalized ?? getThresholds(type);
};

export const CUSTOM_KEY_PREFIX = 'custom:';

/** @param {unknown} customGradingKeys */
export const getCustomKeyDefinition = (customGradingKeys, keyType) => {
  if (!keyType || typeof keyType !== 'string' || !keyType.startsWith(CUSTOM_KEY_PREFIX)) return null;
  const id = keyType.slice(CUSTOM_KEY_PREFIX.length);
  const list = Array.isArray(customGradingKeys) ? customGradingKeys : [];
  return list.find((k) => String(k?.id) === id) ?? null;
};

/**
 * Note aus Prozent-Bändern (jeweils inkl. lo und hi, 0–100).
 * @param {number} percent
 * @param {{ g: number, lo: number, hi: number }[]} bands
 */
export const gradeFromPercentBands = (percent, bands) => {
  const p = Number(percent);
  if (!Number.isFinite(p)) return null;
  if (!bands?.length) return null;
  const sorted = [...bands].sort((a, b) => Number(b.lo) - Number(a.lo));
  for (let i = 0; i < sorted.length; i += 1) {
    const b = sorted[i];
    const lo = Number(b.lo);
    const hi = Number(b.hi);
    const g = Number(b.g);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(g)) continue;
    if (p >= lo - 1e-9 && p <= hi + 1e-9) return g;
  }
  return 6.0;
};

/** Punkte aus Prozent der Maximalpunktzahl, gerundet auf halbe Punkte (Anzeige eigener Schlüssel). */
export const pointsFromPercentHalfStep = (maxPoints, percent) => {
  const max = Number(maxPoints);
  const pct = Number(percent);
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(pct)) return 0;
  return Math.round(((max * pct) / 100) * 2) / 2;
};

export const normalizeQuarterGrade = (g) => Math.round(Number(g) * 4) / 4;

/**
 * Lückenlose Punktintervalle in 0,5er-Schritten: jede Punktzahl k·0,5 (0 … max) gehört genau einer Note.
 * Grenzen zwischen benachbarten Noten sind eindeutig (kein doppeltes 45,5 als Max und Min).
 * Entspricht `gradeFromPercentBands((pts/max)*100, bands)` auf dem Raster halber Punkte.
 */
export const displayPointIntervalsHalfSteps = (maxPoints, bands) => {
  const max = Number(maxPoints);
  if (!Number.isFinite(max) || max <= 0 || !bands?.length) return [];
  const steps = Math.max(0, Math.round(max * 2));
  const runs = [];
  let curG = null;
  let runStart = null;
  for (let hi = 0; hi <= steps; hi += 1) {
    const pts = hi / 2;
    const pct = (pts / max) * 100;
    const gRaw = gradeFromPercentBands(pct, bands);
    const gKey = normalizeQuarterGrade(gRaw);
    if (curG === null) {
      curG = gKey;
      runStart = pts;
    } else if (gKey !== curG) {
      runs.push({ g: curG, pktLo: runStart, pktHi: (hi - 1) / 2 });
      curG = gKey;
      runStart = pts;
    }
  }
  if (curG !== null) runs.push({ g: curG, pktLo: runStart, pktHi: steps / 2 });
  const merged = [];
  for (const r of runs) {
    if (merged.length && merged[merged.length - 1].g === r.g) {
      merged[merged.length - 1].pktHi = r.pktHi;
    } else {
      merged.push({ ...r });
    }
  }
  return merged.sort((a, b) => a.g - b.g);
};

/**
 * Erzeugt Prozent-Bänder aus Anker-Schwellen (Sampling), gleiche Stufenlogik wie Schlüssel 1–6.
 * @param {object} overrideThresholds Rohdaten für normalizeGradeKeyThresholds
 * @param {number} refMaxPoints Referenz-Maximalpunkte für die Simulation
 */
export const buildBandsFromAnchorThresholds = (overrideThresholds, refMaxPoints = 50, samples = 8000) => {
  const norm = normalizeGradeKeyThresholds(overrideThresholds);
  if (!norm) return null;
  const ref = Math.max(1, Number(refMaxPoints) || 50);
  const steps = Math.max(200, Math.floor(samples));
  let prevG = null;
  let startPct = 0;
  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    const pct = (i / steps) * 100;
    const pts = (pct / 100) * ref;
    const g = calculateGradeFromThresholds(pts, ref, '1', norm, null);
    const gq = Math.round(Number(g) * 4) / 4;
    if (prevG === null) {
      prevG = gq;
      startPct = 0;
    } else if (gq !== prevG) {
      const boundary = ((i - 0.5) / steps) * 100;
      out.push({ g: prevG, lo: startPct, hi: boundary });
      prevG = gq;
      startPct = boundary;
    }
  }
  out.push({ g: prevG, lo: startPct, hi: 100 });
  return out;
};

/** Kernlogik Schlüssel 1–3 und Mittelbereich 4–6 (ohne Plateau-Ränder). */
function gradeFromThreeAnchors(percent, percent1, percent2, percent4) {
  if (percent >= percent1) return 1.0;

  if (percent >= percent2) {
    const stepSize = (percent1 - percent2) / 4;
    if (percent >= percent1 - stepSize * 1) return 1.25;
    if (percent >= percent1 - stepSize * 2) return 1.5;
    if (percent >= percent1 - stepSize * 3) return 1.75;
    return 2.0;
  }

  if (percent >= percent4) {
    const stepSize = (percent2 - percent4) / 8;
    if (percent >= percent2 - stepSize * 1) return 2.25;
    if (percent >= percent2 - stepSize * 2) return 2.5;
    if (percent >= percent2 - stepSize * 3) return 2.75;
    if (percent >= percent2 - stepSize * 4) return 3.0;
    if (percent >= percent2 - stepSize * 5) return 3.25;
    if (percent >= percent2 - stepSize * 6) return 3.5;
    if (percent >= percent2 - stepSize * 7) return 3.75;
    return 4.0;
  }

  const stepSize = percent4 / 8;
  if (percent >= percent4 - stepSize * 1) return 4.25;
  if (percent >= percent4 - stepSize * 2) return 4.5;
  if (percent >= percent4 - stepSize * 3) return 4.75;
  if (percent >= percent4 - stepSize * 4) return 5.0;
  if (percent >= percent4 - stepSize * 5) return 5.25;
  if (percent >= percent4 - stepSize * 6) return 5.5;
  if (percent >= percent4 - stepSize * 7) return 5.75;

  return 6.0;
}

// Berechnet die Note anhand von 3 Stufen: 1.0, 2.0, und 4.0
// Z.b. Key 1: 1.0=95%, 2.0=75%, 4.0=45%
// optional customKey: { bands: [{ g, lo, hi }] } — überschreibt type/override für die Umrechnung
export const calculateGradeFromThresholds = (points, maxPoints, type, overrideThresholds = null, customKey = null) => {
  if (points === null || points === undefined || points === '') return null;
  const p = parseFloat(points);
  const max = parseFloat(maxPoints);
  // Kein gültiger Maßstab: bei gültiger Punktzahl (z. B. 0) Note 6 — sonst keine Note.
  if (max <= 0) {
    return Number.isFinite(p) ? 6.0 : null;
  }
  const percent = (p / max) * 100;

  if (typeof type === 'string' && type.startsWith(CUSTOM_KEY_PREFIX) && (!customKey || !customKey.bands?.length)) {
    return calculateGradeFromThresholds(points, maxPoints, '1', null, null);
  }

  if (customKey?.bands?.length) {
    return gradeFromPercentBands(percent, customKey.bands);
  }
  
  if (type === 'abi') {
    return gradeFromPercentBands(percent, ABI_BAWUE_2026_120_BE_BANDS);
  }

  const th = resolveGradingThresholds(type, overrideThresholds);
  if (th.badPlateauMax != null && percent <= th.badPlateauMax) return 6.0;
  if (th.goodPlateauMin != null && percent >= th.goodPlateauMin) return 1.0;

  return gradeFromThreeAnchors(percent, th.percent1, th.percent2, th.percent4);
};

/**
 * Effektive Maximalpunktzahl für einen Schüler-Testeintrag (global oder bei Nachschreiber `_nachschreiberMaxPoints`).
 * @param {object} test
 * @param {unknown} scoreData
 */
export const getEffectiveTestMaxPoints = (test, scoreData) => {
  const fallback = () => {
    const maxRaw = parseFloat(test?.maxPoints);
    return Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 10;
  };
  if (typeof scoreData === 'object' && scoreData !== null && scoreData._nachschreiber === true) {
    const o = parseFloat(String(scoreData._nachschreiberMaxPoints).replace(',', '.'));
    if (Number.isFinite(o) && o > 0) return o;
  }
  return fallback();
};

/**
 * Note aus erreichten Punkten und effektivem Maximum (global oder Nachschreiber-Maximum pro Schüler).
 * @param {object} test
 * @param {unknown} pointsRaw
 * @param {unknown} customGradingKeys
 * @param {unknown} [scoreData] — Rohdaten aus `scores[studentId]` für Nachschreiber-Maximum
 */
export const calculateTestGradeForStudentEntry = (test, pointsRaw, customGradingKeys, scoreData = undefined) => {
  if (pointsRaw === null || pointsRaw === undefined || pointsRaw === '') return null;
  const rawKt = String(test?.keyType ?? '1');
  const kt = rawKt === '10' ? '1' : rawKt || '1';
  const max = getEffectiveTestMaxPoints(test, scoreData);
  const p = parseFloat(String(pointsRaw).replace(',', '.'));
  if (!Number.isFinite(p)) return null;
  const pts = Math.min(max, Math.max(0, p));
  const customDef = getCustomKeyDefinition(customGradingKeys, kt);
  const calculated = calculateGradeFromThresholds(pts, max, kt, null, customDef);
  return Number.isFinite(calculated) ? calculated : null;
};

/** Testnote eines Schülers: manuell (wenn aktiv) oder aus Punkten / Schlüssel berechnet. */
export const getTestGradeForStudent = (test, studentId, customGradingKeys = null, gradeSystem = 'classic') => {
  const scoreMap = test.scores ?? test.errors;
  const raw = scoreMap?.[studentId];
  const { value, counted } = getNormalizedTestScore(raw);
  if (!counted) return null;

  if (isExamManualGradeActive(raw)) {
    return parseExamManualGradeToClassic(getExamManualGradeStoredValue(raw), gradeSystem);
  }

  const pointsForGrade = value === '' ? '0' : value;
  if (value === '' && test?.active === false) return null;
  return calculateTestGradeForStudentEntry(test, pointsForGrade, customGradingKeys, raw);
};

/** GFS-Notentext wie mündlich (z. B. 1,25); Komma als Dezimaltrenner erlaubt. */
export const parseGfsNoteValue = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const g = parseFloat(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(g)) return null;
  return g;
};

/**
 * GFS-Einträge für den schriftlichen Teil: nur wenn „gehalten“ und gültige Note; Halbjahr-Filter wie bei Klausuren.
 * @param {Array<{ studentId: number, gehalten?: boolean, halbjahr?: string, note?: string }>} gfsEntries
 */
const getGfsGradeStatsForStudent = (studentId, gfsEntries, halbjahrFilter, gradeSystem = 'classic') => {
  const gs = normalizeCourseGradeSystem(gradeSystem);
  let sum = 0;
  let count = 0;
  (gfsEntries || []).forEach((entry) => {
    if (entry.studentId !== studentId) return;
    if (entry.gehalten !== true) return;
    if (halbjahrFilter && entry.halbjahr !== halbjahrFilter) return;
    const g = storedGradeStringToClassic(entry.note, gs);
    if (g === null) return;
    sum += g;
    count += 1;
  });
  if (count === 0) return { gfsAvg: null, gfsSum: 0, gfsCount: 0 };
  return { gfsAvg: sum / count, gfsSum: sum, gfsCount: count };
};

export const isProjectManualGradeMode = (project) => project?.gradeMode === 'manual';

/** Projekt-Note: bei gradeMode manual nur handschriftlich, sonst über Notenschlüssel (0 Themenfelder möglich). */
export const getProjectGradeForStudent = (project, studentId, customGradingKeys = null, gradeSystem = 'classic') => {
  const scoreKey = getProjectScoreKeyForStudent(project, studentId);
  if (isProjectGroupGradeMode(project) && !scoreKey) return null;
  const rawScoreData = project.scores?.[scoreKey];
  const effN = getStudentEffectiveProjectFieldCount(project, studentId);
  const { counted, total } = getNormalizedExamScore(rawScoreData, effN);
  if (!counted) return null;

  const gs = normalizeCourseGradeSystem(gradeSystem);
  if (isProjectManualGradeMode(project)) {
    return parseExamManualGradeToClassic(getExamManualGradeStoredValue(rawScoreData), gs);
  }

  if (isExamManualGradeActive(rawScoreData)) {
    return parseExamManualGradeToClassic(getExamManualGradeStoredValue(rawScoreData), gs);
  }

  const maxPts = getStudentProjectMaxPointsForGrade(project, studentId);
  const customDef = getCustomKeyDefinition(customGradingKeys, project.keyType || '1');
  const calculatedGrade = calculateGradeFromThresholds(total, maxPts, project.keyType || '1', null, customDef);
  return Number.isFinite(calculatedGrade) ? calculatedGrade : null;
};

/** Projekt-Note für einen direkten Score-Schlüssel (Schüler- oder Gruppen-ID in project.scores). */
export const getProjectGradeForScoreKey = (project, scoreKey, customGradingKeys = null, gradeSystem = 'classic') => {
  const rawScoreData = project.scores?.[scoreKey];
  const effN = getProjectEffectiveFieldCountForScoreKey(project, scoreKey);
  const { counted, total } = getNormalizedExamScore(rawScoreData, effN);
  if (!counted) return null;

  const gs = normalizeCourseGradeSystem(gradeSystem);
  if (isProjectManualGradeMode(project)) {
    return parseExamManualGradeToClassic(getExamManualGradeStoredValue(rawScoreData), gs);
  }

  if (isExamManualGradeActive(rawScoreData)) {
    return parseExamManualGradeToClassic(getExamManualGradeStoredValue(rawScoreData), gs);
  }

  const maxPts = (() => {
    const baseN = getProjectNumFields(project);
    let sum = 0;
    for (let i = 0; i < effN; i += 1) {
      sum += parseFloat(project.fieldMaxPoints?.[i]) || 0;
    }
    if (sum <= 0) {
      if (effN <= baseN) return parseFloat(project.maxPoints) || 0;
      return 0;
    }
    return sum;
  })();
  const customDef = getCustomKeyDefinition(customGradingKeys, project.keyType || '1');
  const calculatedGrade = calculateGradeFromThresholds(total, maxPts, project.keyType || '1', null, customDef);
  return Number.isFinite(calculatedGrade) ? calculatedGrade : null;
};

/** Klausur-ähnliche Bewertung (Klausur, Projekt) für Teilmittelwerte. */
const getExamLikeGradeContribution = (item, studentId, halbjahrFilter, customGradingKeys, gradeSystem = 'classic') => {
  if (!item?.active) return null;
  if (halbjahrFilter && item.halbjahr !== halbjahrFilter) return null;

  const isProject = item?.projectNumber !== undefined;
  const scoreKey = isProject && isProjectGroupGradeMode(item)
    ? getStudentProjectGroupId(item, studentId)
    : studentId;
  if (isProject && isProjectGroupGradeMode(item) && !scoreKey) return null;

  const rawScoreData = item.scores?.[scoreKey];
  const explicitlyNotCounted =
    rawScoreData &&
    typeof rawScoreData === 'object' &&
    rawScoreData._counted === false;
  if (explicitlyNotCounted) return null;

  const effN = isProject
    ? getStudentEffectiveProjectFieldCount(item, studentId)
    : getStudentEffectiveExamFieldCount(item, studentId);
  const { counted } = getNormalizedExamScore(rawScoreData, effN);
  if (!counted) return null;

  if (isProject) {
    const g = getProjectGradeForStudent(item, studentId, customGradingKeys, gradeSystem);
    if (isProjectManualGradeMode(item)) return g;
    return Number.isFinite(g) ? g : 6.0;
  }

  const gManual = getExamGradeForStudent(item, studentId, customGradingKeys);
  return Number.isFinite(gManual) ? gManual : 6.0;
};

export const calculateStudentGrades = (
  studentId,
  exams,
  orals,
  tests,
  weighting,
  halbjahrFilter = null,
  gfsEntries = [],
  customGradingKeys = null,
  gradeSystem = 'classic',
  testsWritten = true,
  projects = {},
) => {
  const gs = normalizeCourseGradeSystem(gradeSystem);
  let examSum = 0;
  let examCount = 0;
  
  Object.values(exams).forEach((exam) => {
    const g = getExamLikeGradeContribution(exam, studentId, halbjahrFilter, customGradingKeys, gs);
    if (g === null) return;
    examSum += g;
    examCount++;
  });

  Object.values(projects || {}).forEach((project) => {
    if (project.weightingMode !== 'written') return;
    const g = getExamLikeGradeContribution(project, studentId, halbjahrFilter, customGradingKeys, gs);
    if (g === null) return;
    examSum += g;
    examCount++;
  });
  
  const examAvgPure = examCount > 0 ? examSum / examCount : null;

  let oralSum = 0;
  let oralCount = 0;
  Object.values(orals).forEach(oral => {
    if (oral.active === false) return;
    if (oral.grades[studentId]) {
      if (halbjahrFilter && oral.halbjahr !== halbjahrFilter) return;
      const { value, counted } = getNormalizedOralGrade(oral.grades[studentId]);
      if (counted) {
        const g = storedGradeStringToClassic(value, gs);
        if (g !== null) {
          oralSum += g;
          oralCount++;
        }
      }
    }
  });

  Object.values(projects || {}).forEach((project) => {
    if (project.weightingMode !== 'oral') return;
    const g = getExamLikeGradeContribution(project, studentId, halbjahrFilter, customGradingKeys, gs);
    if (g === null) return;
    oralSum += g;
    oralCount++;
  });

  const oralAvg = oralCount > 0 ? oralSum / oralCount : null;
  
  let testAvg = null;
  if (testsWritten) {
    let testSum = 0;
    let testCount = 0;
    Object.values(tests).forEach((test) => {
      const scoreMap = test.scores ?? test.errors;
      if (test.active && scoreMap[studentId] !== undefined) {
        if (halbjahrFilter && test.halbjahr !== halbjahrFilter) return;
        const { counted } = getNormalizedTestScore(scoreMap[studentId]);
        if (counted) {
          const g = getTestGradeForStudent(test, studentId, customGradingKeys, gs);
          if (g !== null) {
            testSum += g;
            testCount++;
          }
        }
      }
    });
    testAvg = testCount > 0 ? testSum / testCount : null;
  }

  const { gfsAvg, gfsSum, gfsCount } = getGfsGradeStatsForStudent(studentId, gfsEntries, halbjahrFilter, gs);

  /** Schriftlich: Klausur-Noten + GFS; jede zählende GFS-Note wie eine Klausur im Durchschnitt. */
  let examAvg = null;
  if (examCount > 0 && gfsCount > 0) {
    examAvg = (examSum + gfsSum) / (examCount + gfsCount);
  } else if (examCount > 0) {
    examAvg = examAvgPure;
  } else if (gfsCount > 0) {
    examAvg = gfsAvg;
  }

  // Endnote (Exakt): gewichtetes arithmetisches Mittel der Teildurchschnitte.
  // Klassisch: Mittelwert in der Notenskala 1–6 (kontinuierlich).
  // Punktesystem: Mittelwert in der Notenpunkteskala 0–15 (pro Säule NP aus dem
  // Teildurchschnitt wie in der Anzeige), danach Rundung und Abbild auf Schulnote.
  const rawWritten = Number(weighting?.written);
  const rawOral = Number(weighting?.oral);
  const rawTests = Number(weighting?.tests);
  const hasAnyValidWeight = Number.isFinite(rawWritten) || Number.isFinite(rawOral) || Number.isFinite(rawTests);
  const written = Number.isFinite(rawWritten) ? rawWritten : (hasAnyValidWeight ? 0 : 2);
  const oral = Number.isFinite(rawOral) ? rawOral : (hasAnyValidWeight ? 0 : 1);
  const wTest = Number.isFinite(rawTests) ? rawTests : (hasAnyValidWeight ? 0 : 1);

  let percentClassicAcc = 0;
  let percentNpAcc = 0;
  let totalPercentWeight = 0;
  Object.values(projects || {}).forEach((project) => {
    if (project.weightingMode !== 'percent') return;
    const pct = Number(project.weightPercent);
    if (!Number.isFinite(pct) || pct <= 0) return;
    const g = getExamLikeGradeContribution(project, studentId, halbjahrFilter, customGradingKeys, gs);
    if (g === null) return;
    totalPercentWeight += pct;
    percentClassicAcc += g * (pct / 100);
    const np = gradeToNotenpunkte(g);
    if (np !== null) percentNpAcc += np * (pct / 100);
  });
  const remainingFactor = Math.max(0, (100 - totalPercentWeight) / 100);

  let finalGrade = null;

  if (gs === 'points') {
    let npAcc = 0;
    let wSum = 0;
    if (examAvg !== null && Number.isFinite(examAvg)) {
      const np = gradeToNotenpunkte(examAvg);
      if (np !== null) {
        npAcc += np * written;
        wSum += written;
      }
    }
    if (oralAvg !== null && Number.isFinite(oralAvg)) {
      const np = gradeToNotenpunkte(oralAvg);
      if (np !== null) {
        npAcc += np * oral;
        wSum += oral;
      }
    }
    if (testAvg !== null && Number.isFinite(testAvg)) {
      const np = gradeToNotenpunkte(testAvg);
      if (np !== null) {
        npAcc += np * wTest;
        wSum += wTest;
      }
    }
    if (wSum > 0) {
      const standardNp = (npAcc / wSum) * remainingFactor;
      const avgNp = standardNp + percentNpAcc;
      const roundedNp = Math.round(Math.min(15, Math.max(0, avgNp)));
      finalGrade = notenpunkteToGrade(roundedNp);
    } else if (percentNpAcc > 0) {
      const roundedNp = Math.round(Math.min(15, Math.max(0, percentNpAcc)));
      finalGrade = notenpunkteToGrade(roundedNp);
    }
  } else {
    let classicAcc = 0;
    let wSum = 0;
    if (examAvg !== null) {
      classicAcc += examAvg * written;
      wSum += written;
    }
    if (oralAvg !== null) {
      classicAcc += oralAvg * oral;
      wSum += oral;
    }
    if (testAvg !== null) {
      classicAcc += testAvg * wTest;
      wSum += wTest;
    }
    if (wSum > 0) {
      finalGrade = (classicAcc / wSum) * remainingFactor + percentClassicAcc;
    } else if (percentClassicAcc > 0) {
      finalGrade = percentClassicAcc;
    }
  }

  if (finalGrade === null) return { examAvg, oralAvg, gfsAvg, testAvg, finalGrade: null };

  return {
    examAvg,
    oralAvg,
    gfsAvg,
    testAvg,
    finalGrade,
  };
};

/** Abitur-übliche Zuordnung Notenpunkte (0–15) → Viertelnote (Anzeige Punktesystem). */
export const NOTENPUNKTE_TO_GRADE = Object.freeze({
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
});

/** Notenpunkte (ganze Zahl 0–15) → Viertelnote */
export const notenpunkteToGrade = (np) => {
  const n = Math.round(Number(np));
  if (!Number.isFinite(n) || n < 0 || n > 15) return null;
  const g = NOTENPUNKTE_TO_GRADE[n];
  return g === undefined ? null : g;
};

/** Viertelnote → nächstliegende Notenpunkte (0–15) für die Anzeige */
export const gradeToNotenpunkte = (grade) => {
  const g = Number(grade);
  if (!Number.isFinite(g)) return null;
  const gq = normalizeQuarterGrade(g);
  let bestNp = null;
  let bestDiff = Infinity;
  for (let np = 0; np <= 15; np += 1) {
    const gg = NOTENPUNKTE_TO_GRADE[np];
    if (gg === undefined) continue;
    const diff = Math.abs(gg - gq);
    if (diff < bestDiff - 1e-12) {
      bestDiff = diff;
      bestNp = np;
    }
  }
  return bestNp;
};

function fmtCalcNum(value, maxFractionDigits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('de-DE', { maximumFractionDigits: maxFractionDigits });
}

function collectWrittenGradeItems(studentId, exams, projects, gfsEntries, halbjahrFilter, customGradingKeys, gs) {
  const items = [];
  Object.entries(exams || {}).forEach(([id, exam]) => {
    const grade = getExamLikeGradeContribution(exam, studentId, halbjahrFilter, customGradingKeys, gs);
    if (grade !== null) items.push({ label: `KA ${id}`, grade });
  });
  (gfsEntries || []).forEach((entry) => {
    if (entry.studentId !== studentId) return;
    if (halbjahrFilter && entry.halbjahr !== halbjahrFilter) return;
    if (entry.gehalten !== true) return;
    const grade = storedGradeStringToClassic(entry.note, gs);
    if (grade === null) return;
    const label = [entry.thema, entry.art].filter(Boolean).join(' · ') || 'GFS';
    items.push({ label: `GFS ${label}`, grade });
  });
  Object.entries(projects || {}).forEach(([id, project]) => {
    if (project.weightingMode !== 'written') return;
    const grade = getExamLikeGradeContribution(project, studentId, halbjahrFilter, customGradingKeys, gs);
    if (grade !== null) items.push({ label: project.name || `Projekt ${id}`, grade });
  });
  return items;
}

function collectOralGradeItems(studentId, orals, projects, halbjahrFilter, customGradingKeys, gs) {
  const items = [];
  Object.values(orals || {}).forEach((oral) => {
    if (oral.active === false) return;
    if (halbjahrFilter && oral.halbjahr !== halbjahrFilter) return;
    const { value, counted } = getNormalizedOralGrade(oral.grades?.[studentId]);
    if (!counted) return;
    const grade = storedGradeStringToClassic(value, gs);
    if (grade === null) return;
    items.push({ label: oral.name || 'Mündlich', grade });
  });
  Object.entries(projects || {}).forEach(([id, project]) => {
    if (project.weightingMode !== 'oral') return;
    const grade = getExamLikeGradeContribution(project, studentId, halbjahrFilter, customGradingKeys, gs);
    if (grade !== null) items.push({ label: project.name || `Projekt ${id}`, grade });
  });
  return items;
}

function collectTestGradeItems(studentId, tests, halbjahrFilter, customGradingKeys, gs) {
  const items = [];
  Object.values(tests || {}).forEach((test) => {
    if (!test.active) return;
    if (halbjahrFilter && test.halbjahr !== halbjahrFilter) return;
    const scoreMap = test.scores ?? test.errors;
    if (scoreMap?.[studentId] === undefined) return;
    const { counted } = getNormalizedTestScore(scoreMap[studentId]);
    if (!counted) return;
    const grade = getTestGradeForStudent(test, studentId, customGradingKeys, gs);
    if (grade !== null) items.push({ label: test.name || 'Test', grade });
  });
  return items;
}

function averageLine(label, key, items) {
  if (items.length === 0) return null;
  const sum = items.reduce((acc, item) => acc + item.grade, 0);
  const avg = sum / items.length;
  const gradesPart = items.map((item) => fmtCalcNum(item.grade)).join(' + ');
  return {
    key,
    label,
    items,
    average: avg,
    steps: [
      {
        type: 'sources',
        label,
        key,
        items: items.map((item) => ({ label: item.label, grade: fmtCalcNum(item.grade) })),
      },
      {
        type: 'fraction',
        label: key,
        numerator: gradesPart,
        denominator: String(items.length),
        result: fmtCalcNum(avg),
      },
    ],
  };
}

/**
 * Konkrete Berechnungsschritte für die Gesamtübersicht (ein Schüler, optional Halbjahr-Filter).
 */
export function getStudentGradeCalculationBreakdown(
  studentId,
  exams,
  orals,
  tests,
  weighting,
  halbjahrFilter = null,
  gfsEntries = [],
  customGradingKeys = null,
  gradeSystem = 'classic',
  testsWritten = true,
  projects = {},
) {
  const gs = normalizeCourseGradeSystem(gradeSystem);
  const { examAvg, oralAvg, testAvg, finalGrade } = calculateStudentGrades(
    studentId,
    exams,
    orals,
    tests,
    weighting,
    halbjahrFilter,
    gfsEntries,
    customGradingKeys,
    gs,
    testsWritten,
    projects,
  );

  const rawWritten = Number(weighting?.written);
  const rawOral = Number(weighting?.oral);
  const rawTests = Number(weighting?.tests);
  const hasAnyValidWeight = Number.isFinite(rawWritten) || Number.isFinite(rawOral) || Number.isFinite(rawTests);
  const written = Number.isFinite(rawWritten) ? rawWritten : (hasAnyValidWeight ? 0 : 2);
  const oral = Number.isFinite(rawOral) ? rawOral : (hasAnyValidWeight ? 0 : 1);
  const wTest = Number.isFinite(rawTests) ? rawTests : (hasAnyValidWeight ? 0 : 1);

  const writtenDetail = averageLine('Schriftlich', 'S', collectWrittenGradeItems(
    studentId, exams, projects, gfsEntries, halbjahrFilter, customGradingKeys, gs,
  ));
  const oralDetail = averageLine('Mündlich', 'M', collectOralGradeItems(
    studentId, orals, projects, halbjahrFilter, customGradingKeys, gs,
  ));
  const testDetail = testsWritten
    ? averageLine('Tests', 'T', collectTestGradeItems(studentId, tests, halbjahrFilter, customGradingKeys, gs))
    : null;

  const pillars = [];
  if (examAvg !== null && Number.isFinite(examAvg)) {
    pillars.push({ key: 'S', label: 'Schriftlich', value: examAvg, weight: written });
  }
  if (oralAvg !== null && Number.isFinite(oralAvg)) {
    pillars.push({ key: 'M', label: 'Mündlich', value: oralAvg, weight: oral });
  }
  if (testsWritten && testAvg !== null && Number.isFinite(testAvg)) {
    pillars.push({ key: 'T', label: 'Tests', value: testAvg, weight: wTest });
  }

  const percentContributions = [];
  let totalPercentWeight = 0;
  let percentClassicAcc = 0;
  let percentNpAcc = 0;
  Object.entries(projects || {}).forEach(([id, project]) => {
    if (!project.active || project.weightingMode !== 'percent') return;
    if (halbjahrFilter && project.halbjahr !== halbjahrFilter) return;
    const pct = Number(project.weightPercent);
    if (!Number.isFinite(pct) || pct <= 0) return;
    const grade = getExamLikeGradeContribution(project, studentId, halbjahrFilter, customGradingKeys, gs);
    if (grade === null) return;
    totalPercentWeight += pct;
    const classicContribution = grade * (pct / 100);
    percentClassicAcc += classicContribution;
    const np = gradeToNotenpunkte(grade);
    const npContribution = np !== null ? np * (pct / 100) : null;
    if (np !== null) percentNpAcc += npContribution;
    percentContributions.push({
      id,
      name: project.name || `Projekt ${id}`,
      percent: pct,
      grade,
      classicContribution,
      np,
      npContribution,
    });
  });

  const remainingFactor = Math.max(0, (100 - totalPercentWeight) / 100);
  const wSum = pillars.reduce((sum, pillar) => sum + pillar.weight, 0);
  const steps = [];

  if (writtenDetail) steps.push(...writtenDetail.steps);
  if (oralDetail) steps.push(...oralDetail.steps);
  if (testDetail) steps.push(...testDetail.steps);

  if (percentContributions.length > 0) {
    steps.push({
      type: 'restFactor',
      totalPercent: fmtCalcNum(totalPercentWeight, 0),
      result: fmtCalcNum(remainingFactor),
    });
  }

  steps.push({
    type: 'text',
    text: `Gewichte: w_S = ${fmtCalcNum(written, 0)}, w_M = ${fmtCalcNum(oral, 0)}${
      testsWritten ? `, w_T = ${fmtCalcNum(wTest, 0)}` : ' (Tests fließen nicht ein)'
    }`,
  });

  if (gs === 'points') {
    const npPillars = pillars.map((pillar) => ({
      ...pillar,
      np: gradeToNotenpunkte(pillar.value),
    })).filter((pillar) => pillar.np !== null);

    if (npPillars.length > 0) {
      npPillars.forEach((pillar) => {
        steps.push({
          type: 'npNote',
          key: pillar.key,
          np: fmtCalcNum(pillar.np, 0),
          from: fmtCalcNum(pillar.value),
        });
      });
    }

    if (wSum > 0 && npPillars.length > 0) {
      const npAcc = npPillars.reduce((sum, pillar) => sum + pillar.np * pillar.weight, 0);
      const numeratorTerms = npPillars.map((pillar) => `${fmtCalcNum(pillar.weight, 0)} · ${fmtCalcNum(pillar.np, 0)}`).join(' + ');
      const denomTerms = npPillars.map((pillar) => fmtCalcNum(pillar.weight, 0)).join(' + ');
      const standardNp = (npAcc / wSum) * remainingFactor;
      const avgNp = standardNp + percentNpAcc;
      const roundedNp = Math.round(Math.min(15, Math.max(0, avgNp)));

      if (percentContributions.length > 0) {
        steps.push({
          type: 'fraction',
          label: 'NP_standard',
          numerator: numeratorTerms,
          denominator: denomTerms,
          factor: fmtCalcNum(remainingFactor),
          result: fmtCalcNum(standardNp),
        });
        percentContributions.forEach((entry) => {
          steps.push({
            type: 'mulFraction',
            prefix: `${entry.name} (NP = ${fmtCalcNum(entry.np, 0)}, Anteil ${fmtCalcNum(entry.percent, 0)} %)`,
            left: fmtCalcNum(entry.np, 0),
            percent: fmtCalcNum(entry.percent, 0),
            result: fmtCalcNum(entry.npContribution),
          });
        });
        steps.push({
          type: 'sum',
          label: 'NP_end',
          parts: [fmtCalcNum(standardNp), fmtCalcNum(percentNpAcc)],
          result: fmtCalcNum(avgNp),
        });
      } else {
        steps.push({
          type: 'fraction',
          label: 'NP_end',
          numerator: numeratorTerms,
          denominator: denomTerms,
          result: fmtCalcNum(avgNp),
        });
      }
      steps.push({ type: 'text', text: `NP_end (gerundet) = ${fmtCalcNum(roundedNp, 0)}` });
      if (finalGrade !== null) {
        steps.push({
          type: 'mapping',
          label: 'Endnote (Exakt)',
          from: `NP ${fmtCalcNum(roundedNp, 0)}`,
          to: fmtCalcNum(finalGrade),
        });
      }
    } else if (percentNpAcc > 0) {
      const roundedNp = Math.round(Math.min(15, Math.max(0, percentNpAcc)));
      percentContributions.forEach((entry) => {
        steps.push({
          type: 'mulFraction',
          prefix: entry.name,
          left: fmtCalcNum(entry.grade),
          percent: fmtCalcNum(entry.percent, 0),
          result: fmtCalcNum(entry.npContribution),
        });
      });
      steps.push({
        type: 'text',
        text: `NP_end = ${fmtCalcNum(percentNpAcc)} → gerundet ${fmtCalcNum(roundedNp, 0)}`,
      });
      if (finalGrade !== null) {
        steps.push({
          type: 'mapping',
          label: 'Endnote (Exakt)',
          from: `NP ${fmtCalcNum(roundedNp, 0)}`,
          to: fmtCalcNum(finalGrade),
        });
      }
    } else {
      steps.push({ type: 'text', text: 'Keine zählenden Noten für die Endnote in dieser Auswahl.' });
    }
  } else if (wSum > 0) {
    const weightedSum = pillars.reduce((sum, pillar) => sum + pillar.weight * pillar.value, 0);
    const numeratorTerms = pillars.map((pillar) => `${fmtCalcNum(pillar.weight, 0)} · ${fmtCalcNum(pillar.value)}`).join(' + ');
    const denomTerms = pillars.map((pillar) => fmtCalcNum(pillar.weight, 0)).join(' + ');
    const standardPart = (weightedSum / wSum) * remainingFactor;

    if (percentContributions.length > 0) {
      steps.push({
        type: 'fraction',
        label: 'Standardanteil',
        numerator: numeratorTerms,
        denominator: denomTerms,
        factor: fmtCalcNum(remainingFactor),
        result: fmtCalcNum(standardPart),
      });
      percentContributions.forEach((entry) => {
        steps.push({
          type: 'mulFraction',
          prefix: entry.name,
          left: fmtCalcNum(entry.grade),
          percent: fmtCalcNum(entry.percent, 0),
          result: fmtCalcNum(entry.classicContribution),
        });
      });
      steps.push({
        type: 'sum',
        label: 'Endnote (Exakt)',
        parts: [fmtCalcNum(standardPart), fmtCalcNum(percentClassicAcc)],
        result: fmtCalcNum(finalGrade),
      });
    } else {
      steps.push({
        type: 'fraction',
        label: 'Endnote (Exakt)',
        numerator: numeratorTerms,
        denominator: denomTerms,
        result: fmtCalcNum(finalGrade),
      });
    }
  } else if (percentClassicAcc > 0) {
    percentContributions.forEach((entry) => {
      steps.push({
        type: 'mulFraction',
        prefix: entry.name,
        left: fmtCalcNum(entry.grade),
        percent: fmtCalcNum(entry.percent, 0),
        result: fmtCalcNum(entry.classicContribution),
      });
    });
    steps.push({ type: 'text', text: `Endnote (Exakt) = ${fmtCalcNum(percentClassicAcc)}` });
  } else {
    steps.push({ type: 'text', text: 'Keine zählenden Noten für die Endnote in dieser Auswahl.' });
  }

  return {
    examAvg,
    oralAvg,
    testAvg,
    finalGrade,
    weights: { written, oral, tests: wTest },
    testsWritten,
    remainingFactor,
    totalPercentWeight,
    wSum,
    percentContributions,
    pillars,
    writtenDetail,
    oralDetail,
    testDetail,
    steps,
    gradeSystem: gs,
  };
}

/** Kurs-Notensystem aus API/State robust als `classic` | `points` erkennen. */
export const normalizeCourseGradeSystem = (raw) => {
  const s = String(raw ?? 'classic').trim().toLowerCase();
  if (s === 'points' || s === 'punkte' || s === 'punktesystem' || s === 'notenpunkte' || s === 'np') return 'points';
  return 'classic';
};

/**
 * Gespeicherter Noten-String je nach Kurs-Notensystem → klassische Viertelnote (für Mittelwerte / Farben).
 * Punktesystem in der DB: ganze Zahlen 0–15; klassisch: Viertelnote als Text.
 */
export const storedGradeStringToClassic = (raw, gradeSystem = 'classic') => {
  const gs = normalizeCourseGradeSystem(gradeSystem);
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim().replace(',', '.');
  if (gs === 'points') {
    // Legacy: früher wurden hier noch Viertelnoten als Text gespeichert (z. B. "3,25")
    if (s.includes('.')) {
      const g = parseFloat(s);
      return Number.isFinite(g) ? g : null;
    }
    const np = Math.round(parseFloat(s));
    if (!Number.isFinite(np) || np < 0 || np > 15) return null;
    return notenpunkteToGrade(np);
  }
  const g = parseFloat(s);
  if (!Number.isFinite(g)) return null;
  return g;
};

/** Klassische Viertelnote → Speicherstring für das gewählte Notensystem (Datenbank). */
export const classicGradeToStoredString = (classic, gradeSystem = 'classic') => {
  const gs = normalizeCourseGradeSystem(gradeSystem);
  if (classic === null || classic === undefined) return '';
  const g = normalizeQuarterGrade(Number(classic));
  if (!Number.isFinite(g)) return '';
  if (gs === 'points') {
    const np = gradeToNotenpunkte(g);
    return np === null ? '' : String(np);
  }
  return g.toFixed(2);
};

/** Beim Wechsel des Kurs-Notensystems: einen gespeicherten Wert in die andere Kodierung überführen. */
export const migrateStoredGradeString = (raw, fromSystem, toSystem) => {
  const from = normalizeCourseGradeSystem(fromSystem);
  const to = normalizeCourseGradeSystem(toSystem);
  if (from === to) return raw === undefined || raw === null ? '' : String(raw).trim();
  if (raw === undefined || raw === null || String(raw).trim() === '') return '';
  const classic = storedGradeStringToClassic(raw, from);
  if (classic === null) return String(raw).trim();
  return classicGradeToStoredString(classic, to);
};

/** Ein mündlicher Noteneintrag (`grades[sid]`) zwischen Notensystemen migrieren. */
export const migrateOralGradeEntry = (prevData, fromSystem, toSystem) => {
  const from = normalizeCourseGradeSystem(fromSystem);
  const to = normalizeCourseGradeSystem(toSystem);
  if (from === to) return prevData;
  if (prevData === undefined || prevData === null) return prevData;
  if (typeof prevData === 'object') {
    const v = prevData.value;
    if (v === '' || v === undefined || v === null) return prevData;
    const nv = migrateStoredGradeString(String(v), from, to);
    if (nv === String(v)) return prevData;
    return { ...prevData, value: nv };
  }
  const nv = migrateStoredGradeString(String(prevData), from, to);
  if (nv === String(prevData)) return prevData;
  return nv;
};

/** Note schlechter als 4.0 (nicht „4 schlecht“, sondern strikt &gt; 4) → für rote Zahlenfarbe. */
export const isGradeWorseThan4 = (grade) => {
  if (grade === null || grade === undefined) return false;
  const g = typeof grade === 'number' ? grade : parseFloat(grade);
  if (Number.isNaN(g)) return false;
  return g > 4;
};

/** Undurchsichtige Pastell-Hintergründe für Notenzellen (1–3 grün, 3,25–4 gelb, &gt;4 rot). */
export const getGradeCellBackground = (grade) => {
  if (grade === null || grade === undefined) return undefined;
  const g = typeof grade === 'number' ? grade : parseFloat(grade);
  if (Number.isNaN(g)) return undefined;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) return undefined;
  if (g >= 1 && g <= 3) return '#dcfce7';
  if (g > 4) return '#fee2e2';
  if (g >= 3.25 && g <= 4) return '#fef9c3';
  if (g > 3 && g < 3.25) return '#fefce8';
  return undefined;
};

export const getGradeTextColor = (grade) => {
  if (grade === null || grade === undefined) return undefined;
  const g = typeof grade === 'number' ? grade : parseFloat(grade);
  if (Number.isNaN(g)) return undefined;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (!isDark) return undefined;
  if (g >= 1 && g <= 3) return '#4ade80';
  if (g > 4) return '#f87171';
  if (g >= 3.25 && g <= 4) return '#facc15';
  if (g > 3 && g < 3.25) return '#fde047';
  return undefined;
};

/**
 * @param {unknown} grade — Note 1–6 (Viertel), oder bei `opts.inputScale === 'notenpunkte'` bereits 0–15
 * @param {'classic'|'points'} [gradeSystem] — bei `points` Anzeige als Notenpunkte 0–15
 * @param {{ inputScale?: 'classic'|'notenpunkte' }} [opts] — `notenpunkte`: Wert ist schon NP-Skala (z. B. Abitur-Mündlich)
 */
export const formatGrade = (grade, gradeSystem = 'classic', opts) => {
  const o = opts ?? {};
  const gs = normalizeCourseGradeSystem(gradeSystem);
  if (grade === null || grade === undefined) return '-';
  const g = typeof grade === 'number' ? grade : parseFloat(String(grade).replace(',', '.'));
  if (Number.isNaN(g)) return '-';
  const inputScale = o.inputScale === 'notenpunkte' ? 'notenpunkte' : 'classic';
  if (gs === 'points') {
    if (inputScale === 'notenpunkte') {
      const n = Math.round(Math.min(15, Math.max(0, g)));
      return String(n);
    }
    const np = gradeToNotenpunkte(g);
    return np === null ? '-' : String(np);
  }
  if (inputScale === 'notenpunkte') {
    const npr = Math.round(Math.min(15, Math.max(0, g)));
    const gg = notenpunkteToGrade(npr);
    return gg === null ? '-' : gg.toFixed(2);
  }
  return g.toFixed(2);
};
