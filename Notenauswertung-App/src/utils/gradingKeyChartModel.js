import { calculateGradeFromThresholds, gradeFromPercentBands, classicGradeToGradingKeyNotenpunkte } from './calculator';
import { getFormulaKeyIntercept, gradeFromFormulaPoints } from '../data/formulaGradingKey';

export const GRADING_KEY_CHART_VB_W = 320;
export const GRADING_KEY_CHART_VB_H = 200;
export const GRADING_KEY_CHART_PAD_L = 42;
export const GRADING_KEY_CHART_PAD_R = 12;
export const GRADING_KEY_CHART_PAD_T = 14;
export const GRADING_KEY_CHART_PAD_B = 30;
export const GRADING_KEY_CHART_PLOT_W = GRADING_KEY_CHART_VB_W - GRADING_KEY_CHART_PAD_L - GRADING_KEY_CHART_PAD_R;
export const GRADING_KEY_CHART_PLOT_H = GRADING_KEY_CHART_VB_H - GRADING_KEY_CHART_PAD_T - GRADING_KEY_CHART_PAD_B;

const NOTE_TICK_CANDIDATES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
const NP_TICK_CANDIDATES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export function gradeValueToPlotY(value, yMin, ySpan, notenpunkteMode) {
  const t = (value - yMin) / ySpan;
  return notenpunkteMode
    ? GRADING_KEY_CHART_PAD_T + GRADING_KEY_CHART_PLOT_H - t * GRADING_KEY_CHART_PLOT_H
    : GRADING_KEY_CHART_PAD_T + t * GRADING_KEY_CHART_PLOT_H;
}

/**
 * @param {{ type?: string, maxPoints?: number|string, thresholdsOverride?: object, customBands?: object[], showNotenpunkte?: boolean }} params
 */
export function buildGradingKeyChartModel({
  type,
  maxPoints,
  thresholdsOverride,
  customBands,
  showNotenpunkte = false,
}) {
  const max = Number(maxPoints);
  if (!Number.isFinite(max) || max <= 0) return null;

  const formulaIntercept = getFormulaKeyIntercept(type);

  const gradeAtPoints = (p) => {
    if (formulaIntercept != null) {
      return gradeFromFormulaPoints(p, max, formulaIntercept);
    }
    if (customBands?.length) {
      return gradeFromPercentBands((p / max) * 100, customBands);
    }
    return calculateGradeFromThresholds(p, max, type, thresholdsOverride);
  };

  const valueAtPoints = (p) => {
    const g = gradeAtPoints(p);
    if (g === null || !Number.isFinite(g)) return null;
    if (!showNotenpunkte) return g;
    const np = classicGradeToGradingKeyNotenpunkte(g);
    return np !== null ? np : null;
  };

  const samples = Math.min(400, Math.max(80, Math.ceil(max * 4)));
  const yMin = showNotenpunkte ? 0 : 1;
  const yMax = showNotenpunkte ? 15 : 6;
  const ySpan = yMax - yMin;

  const polylinePoints = [];
  const xPointTicks = [];
  for (let i = 0; i <= samples; i += 1) {
    const p = Math.round(((max * i) / samples) * 2) / 2;
    const v = valueAtPoints(p);
    if (v === null || !Number.isFinite(v)) continue;
    const x = GRADING_KEY_CHART_PAD_L + (p / max) * GRADING_KEY_CHART_PLOT_W;
    const y = gradeValueToPlotY(v, yMin, ySpan, showNotenpunkte);
    polylinePoints.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  if (polylinePoints.length === 0) return null;

  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const p = t * max;
    xPointTicks.push({
      t,
      p,
      label:
        max >= 20 || Number.isInteger(p)
          ? String(Math.round(p))
          : String(Math.round(p * 10) / 10).replace('.', ','),
    });
  }

  const tickCandidates = showNotenpunkte ? NP_TICK_CANDIDATES : NOTE_TICK_CANDIDATES;
  const yTicks = tickCandidates.filter((g) => g >= yMin - 0.001 && g <= yMax + 0.001);

  return {
    max,
    polylinePoints: polylinePoints.join(' '),
    yMin,
    yMax,
    ySpan,
    yTicks,
    xPointTicks,
    showNotenpunkte,
  };
}
