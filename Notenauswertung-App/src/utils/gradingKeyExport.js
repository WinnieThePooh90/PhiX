import { ABI_BAWUE_2026_120_BE_KEY, isAbiBaWue2026KeyFamilyId } from '../data/kmBwAbiPhysik2026GradingKey';
import { isAbiBaWue2026Mathematik100BeFamilyId } from '../data/abiBaWu2026Mathematik100BeGradingKey';
import { buildVorlage1Bands, isVorlage1KeyFamilyId } from '../data/vorlage1GradingKey';
import {
  getBuiltinGradingKeyShortDesc,
  getBuiltinGradingKeyTitle,
  getPlateauKeyShortDesc,
  PLATEAU_KEY_TYPES,
  LINEAR_KEY_TYPES,
} from '../data/gradingKeyDisplay';
import { buildFormulaBands, getFormulaKeyIntercept } from '../data/formulaGradingKey';
import {
  displayPointIntervalsHalfSteps,
  getCustomKeyDefinition,
  normalizeCourseGradeSystem,
  normalizeQuarterGrade,
  pointsFromPercentHalfStep,
  resolveGradingThresholds,
} from './calculator';

function formatPointsHalfStepDisplay(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '–';
  const s = Math.abs(x % 1) < 1e-9 ? String(Math.round(x)) : x.toFixed(1);
  return s.replace('.', ',');
}

function formatGradeDisplay(grade) {
  return parseFloat(String(grade)).toFixed(2).replace('.00', '.0');
}

/**
 * @param {{ type: string, maxPoints: number|string, thresholdsOverride?: object, customBands?: object[], pktIntegerDisplay?: boolean }} params
 * @returns {{ pkt: string, grade: string, pct: string }[]}
 */
export function buildGradingKeyTableRows({
  type,
  maxPoints,
  thresholdsOverride,
  customBands,
  pktIntegerDisplay = false,
}) {
  const t = resolveGradingThresholds(type, thresholdsOverride);
  const max = parseFloat(maxPoints) || 0;
  const formulaIntercept = getFormulaKeyIntercept(type);

  let effectiveBands = customBands;
  if (!effectiveBands?.length) {
    if (formulaIntercept != null && max > 0) {
      effectiveBands = buildFormulaBands(max, formulaIntercept);
    } else if (type === 'abi') {
      effectiveBands = ABI_BAWUE_2026_120_BE_KEY.bands;
    }
  }

  const pktInt = pktIntegerDisplay || type === 'abi';

  const customPktByGrade = new Map();
  if (effectiveBands?.length && max > 0 && !pktInt) {
    for (const r of displayPointIntervalsHalfSteps(max, effectiveBands)) {
      customPktByGrade.set(normalizeQuarterGrade(r.g), r);
    }
  }

  if (effectiveBands?.length) {
    const sorted = [...effectiveBands].sort((a, b) => Number(a.g) - Number(b.g));
    return sorted.map((s) => {
      const lo = Number(s.lo);
      const hi = Number(s.hi);
      const pct = `${Math.round(lo)}–${Math.round(hi)}%`;
      const gq = normalizeQuarterGrade(s.g);
      const part = customPktByGrade.get(gq);
      let pkt = '–';
      if (max > 0) {
        if (pktInt) {
          const pktLoInt = Math.max(0, Math.min(max, Math.ceil((max * lo) / 100 - 1e-9)));
          const pktHiInt = Math.max(0, Math.min(max, Math.floor((max * hi) / 100 + 1e-9)));
          pkt = pktLoInt === pktHiInt ? String(pktLoInt) : `${pktLoInt}–${pktHiInt}`;
        } else if (part) {
          const { pktLo, pktHi } = part;
          pkt =
            pktLo === pktHi
              ? formatPointsHalfStepDisplay(pktLo)
              : `${formatPointsHalfStepDisplay(pktLo)}–${formatPointsHalfStepDisplay(pktHi)}`;
        } else {
          const rawLo = pointsFromPercentHalfStep(max, lo);
          const rawHi = pointsFromPercentHalfStep(max, hi);
          const pkLo = Math.min(rawLo, rawHi);
          const pkHi = Math.max(rawLo, rawHi);
          pkt =
            pkLo === pkHi
              ? formatPointsHalfStepDisplay(pkLo)
              : `${formatPointsHalfStepDisplay(pkLo)}–${formatPointsHalfStepDisplay(pkHi)}`;
        }
      }
      return { pkt, grade: formatGradeDisplay(s.g), pct };
    });
  }

  const { percent1, percent2, percent4 } = t;
  const grades = [];
  const step1to2 = (percent1 - percent2) / 4;
  grades.push({ g: '1.0', p: percent1 });
  grades.push({ g: '1.25', p: percent1 - step1to2 * 1 });
  grades.push({ g: '1.5', p: percent1 - step1to2 * 2 });
  grades.push({ g: '1.75', p: percent1 - step1to2 * 3 });
  grades.push({ g: '2.0', p: percent2 });

  const step2to4 = (percent2 - percent4) / 8;
  for (let i = 1; i <= 8; i += 1) {
    grades.push({ g: (2.0 + i * 0.25).toFixed(2), p: percent2 - step2to4 * i });
  }

  const step4to6 = percent4 / 8;
  for (let i = 1; i <= 8; i += 1) {
    grades.push({ g: (4.0 + i * 0.25).toFixed(2), p: Math.max(0, percent4 - step4to6 * i) });
  }

  if (t.goodPlateauMin != null && t.badPlateauMax != null) {
    grades[0] = { ...grades[0], pLabel: `≥ ${t.goodPlateauMin}% … 100%` };
    grades[grades.length - 1] = {
      ...grades[grades.length - 1],
      pLabel: `0% … ≤ ${t.badPlateauMax}%`,
    };
  }

  return grades.map((s) => {
    const pct = s.pLabel ?? `${s.p.toFixed(1)}%`;
    let pkt = Math.ceil((max * s.p) / 100);
    if (s.pLabel && t.goodPlateauMin != null && s.g === '1.0') {
      pkt = `${Math.ceil((max * t.goodPlateauMin) / 100)}+`;
    } else if (s.pLabel && t.badPlateauMax != null && parseFloat(s.g) === 6) {
      pkt = `≤ ${Math.ceil((max * t.badPlateauMax) / 100)}`;
    }
    return { pkt: String(pkt), grade: formatGradeDisplay(s.g), pct };
  });
}

/**
 * @param {{ pkt: string, grade: string, pct: string }[]} rows
 * @returns {(string|number)[][]}
 */
export function buildGradingKeyExportAoa(rows) {
  return [['PKT', 'Note', '%'], ...rows.map((r) => [r.pkt, r.grade, r.pct])];
}

/**
 * Notenschlüssel einer Klausur — gleiche Logik wie GradingKeyTable in ExamsView.
 * @returns {{ title: string, desc: string, aoa: (string|number)[][] }}
 */
export function resolveExamGradingKeyForExport(exam, config) {
  const customKeysList = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const customDef = getCustomKeyDefinition(customKeysList, exam?.keyType || '1');
  const type = customDef ? '1' : (exam?.keyType || '1');
  const maxPoints = exam?.maxPoints;

  const title = customDef
    ? customDef.name
    : getBuiltinGradingKeyTitle(exam?.keyType) || 'Aktueller Schlüssel';

  const desc = customDef
    ? (isVorlage1KeyFamilyId(customDef.id)
        ? getPlateauKeyShortDesc('1', maxPoints)
        : customDef.name)
    : exam?.keyType === 'abi'
      ? 'ABI BaWü 2026 120 BE'
      : getBuiltinGradingKeyShortDesc(exam?.keyType, maxPoints) || `Schlüssel ${exam?.keyType || '1'}`;

  const customBands = customDef
    ? (isVorlage1KeyFamilyId(customDef.id) ? buildVorlage1Bands(maxPoints) : customDef.bands)
    : (exam?.keyType === 'abi' ? ABI_BAWUE_2026_120_BE_KEY.bands : undefined);

  const pktIntegerDisplay =
    !!customDef?.pktIntegerDisplay ||
    exam?.keyType === 'abi' ||
    (customDef?.id &&
      (isAbiBaWue2026KeyFamilyId(customDef.id) || isAbiBaWue2026Mathematik100BeFamilyId(customDef.id)));

  const rows = buildGradingKeyTableRows({
    type,
    maxPoints,
    customBands,
    pktIntegerDisplay,
  });

  return {
    title,
    desc,
    aoa: buildGradingKeyExportAoa(rows),
    chart: {
      type,
      maxPoints,
      customBands,
    },
  };
}

function getCustomKeyReferenceMaxPoints(customKey) {
  const ref = Number(customKey?.referenceMaxPoints);
  if (Number.isFinite(ref) && ref > 0) return ref;
  if (isAbiBaWue2026KeyFamilyId(customKey?.id)) return 120;
  if (isAbiBaWue2026Mathematik100BeFamilyId(customKey?.id)) return 100;
  return 50;
}

/**
 * Ein im Kurs angelegter (eigener/Vorlagen-)Notenschlüssel für den Export.
 * @returns {{ id: string, name: string, maxPoints: number, gradingKey: { title: string, desc: string, aoa: (string|number)[][], maxPoints: number } } | null}
 */
export function resolveCustomGradingKeyForExport(customKey) {
  if (!customKey?.id) return null;
  if (!customKey.bands?.length && !isVorlage1KeyFamilyId(customKey.id)) return null;

  const maxPoints = getCustomKeyReferenceMaxPoints(customKey);
  const title = customKey.name || 'Notenschlüssel';

  const desc = isVorlage1KeyFamilyId(customKey.id)
    ? getPlateauKeyShortDesc('1', maxPoints)
    : 'Benutzerdefinierter Schlüssel (Intervalle in % der Klausur-Maximalpunkte)';

  const customBands = isVorlage1KeyFamilyId(customKey.id)
    ? buildVorlage1Bands(maxPoints)
    : customKey.bands;

  const pktIntegerDisplay =
    !!customKey.pktIntegerDisplay ||
    isAbiBaWue2026KeyFamilyId(customKey.id) ||
    isAbiBaWue2026Mathematik100BeFamilyId(customKey.id);

  const rows = buildGradingKeyTableRows({
    type: '1',
    maxPoints,
    customBands,
    pktIntegerDisplay,
  });

  return {
    id: customKey.id,
    name: title,
    maxPoints,
    preset: false,
    gradingKey: {
      title,
      desc,
      maxPoints,
      aoa: buildGradingKeyExportAoa(rows),
      chart: {
        type: '1',
        maxPoints,
        customBands,
      },
    },
  };
}

/** Voreingestellte Schlüssel (Plateau 1–3, Linear 1–3) — gleiche Reihenfolge wie im Reiter Notenschlüssel. */
export const BUILTIN_GRADING_KEY_TYPES = [...PLATEAU_KEY_TYPES, ...LINEAR_KEY_TYPES];

/** Standard-Maximalpunkte für Export (entspricht Vorgabe in Notenschlüssel-Ansicht). */
export const DEFAULT_GRADING_KEY_EXPORT_MAX_POINTS = 50;

/**
 * Voreingestellten Notenschlüssel für den Export aufbereiten.
 * @returns {{ id: string, name: string, maxPoints: number, preset: boolean, gradingKey: object } | null}
 */
export function resolveBuiltinGradingKeyForExport(type, maxPoints = DEFAULT_GRADING_KEY_EXPORT_MAX_POINTS) {
  const keyType = String(type ?? '');
  const title = getBuiltinGradingKeyTitle(keyType);
  if (!title) return null;

  const pts = Number(maxPoints);
  const effectiveMax = Number.isFinite(pts) && pts > 0 ? pts : DEFAULT_GRADING_KEY_EXPORT_MAX_POINTS;
  const desc = getBuiltinGradingKeyShortDesc(keyType, effectiveMax);

  const rows = buildGradingKeyTableRows({
    type: keyType,
    maxPoints: effectiveMax,
  });

  return {
    id: `builtin:${keyType}`,
    name: title,
    maxPoints: effectiveMax,
    preset: true,
    gradingKey: {
      title,
      desc,
      maxPoints: effectiveMax,
      aoa: buildGradingKeyExportAoa(rows),
      chart: {
        type: keyType,
        maxPoints: effectiveMax,
      },
    },
  };
}

/** Voreingestellte und im Kurs angelegte Notenschlüssel für den Export. */
export function buildCourseGradingKeysExportList(
  config,
  maxPoints = DEFAULT_GRADING_KEY_EXPORT_MAX_POINTS,
) {
  const showNotenpunkte = normalizeCourseGradeSystem(config?.gradeSystem) === 'points';
  const withChartMode = (entry) => {
    if (!entry?.gradingKey?.chart) return entry;
    return {
      ...entry,
      gradingKey: {
        ...entry.gradingKey,
        chart: {
          ...entry.gradingKey.chart,
          showNotenpunkte,
        },
      },
    };
  };

  const builtins = BUILTIN_GRADING_KEY_TYPES
    .map((type) => resolveBuiltinGradingKeyForExport(type, maxPoints))
    .filter(Boolean)
    .map(withChartMode);

  const customKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const custom = customKeys
    .map((key) => resolveCustomGradingKeyForExport(key))
    .filter(Boolean)
    .map(withChartMode);

  return [...builtins, ...custom];
}

/**
 * Tabellenblatt-Inhalt für einen Notenschlüssel (Titel, Beschreibung, Tabelle).
 * @returns {(string|number)[][]}
 */
export function buildGradingKeySheetAoa(entry) {
  const { gradingKey, maxPoints } = entry;
  const aoa = [[gradingKey.title || 'Notenschlüssel']];
  if (gradingKey.desc) aoa.push([gradingKey.desc]);
  if (maxPoints > 0) aoa.push([`Maximalpunkte: ${maxPoints}`]);
  aoa.push([]);
  aoa.push(...(gradingKey.aoa ?? []));
  return aoa;
}

/**
 * @param {(string|number)[][]} mainAoa
 * @param {{ title?: string, desc?: string, aoa?: (string|number)[][] }} gradingKey
 */
export function mergeAoaWithGradingKey(mainAoa, gradingKey) {
  if (!gradingKey?.aoa?.length) return mainAoa ?? [];
  const width = Math.max(mainAoa?.[0]?.length ?? 0, 3);
  const pad = (cells) => {
    const row = Array.isArray(cells) ? [...cells] : [cells];
    while (row.length < width) row.push('');
    return row.slice(0, width);
  };

  const out = [...(mainAoa ?? [])];
  out.push(pad([]));
  out.push(pad([`Notenschlüssel: ${gradingKey.title || 'Aktueller Schlüssel'}`]));
  if (gradingKey.desc) out.push(pad([gradingKey.desc]));
  out.push(pad([]));
  for (const row of gradingKey.aoa) {
    out.push(pad(row));
  }
  return out;
}
