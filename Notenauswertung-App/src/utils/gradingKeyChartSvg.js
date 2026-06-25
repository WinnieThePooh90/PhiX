import {
  GRADING_KEY_CHART_PAD_B,
  GRADING_KEY_CHART_PAD_L,
  GRADING_KEY_CHART_PAD_T,
  GRADING_KEY_CHART_PLOT_H,
  GRADING_KEY_CHART_PLOT_W,
  GRADING_KEY_CHART_VB_H,
  GRADING_KEY_CHART_VB_W,
  gradeValueToPlotY,
} from './gradingKeyChartModel';

const EXPORT_CHART_COLORS = {
  background: '#ffffff',
  border: '#e2e8f0',
  grid: 'rgba(15, 23, 42, 0.07)',
  foreground: '#0f172a',
  muted: '#64748b',
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {ReturnType<typeof import('./gradingKeyChartModel').buildGradingKeyChartModel>} model
 * @param {{ width?: number, height?: number, colors?: Partial<typeof EXPORT_CHART_COLORS> }} [opts]
 */
export function buildGradingKeyChartSvg(model, opts = {}) {
  if (!model?.polylinePoints) return '';

  const {
    width = GRADING_KEY_CHART_VB_W,
    height = GRADING_KEY_CHART_VB_H,
    colors: colorOverrides = {},
  } = opts;
  const colors = { ...EXPORT_CHART_COLORS, ...colorOverrides };
  const scaleX = width / GRADING_KEY_CHART_VB_W;
  const scaleY = height / GRADING_KEY_CHART_VB_H;
  const {
    max,
    polylinePoints,
    yMin,
    ySpan,
    yTicks,
    xPointTicks,
    showNotenpunkte: npMode,
  } = model;
  const yAxisLabel = npMode ? 'Notenpunkte' : 'Note';

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRADING_KEY_CHART_VB_W} ${GRADING_KEY_CHART_VB_H}" width="${width}" height="${height}">`,
    `<rect x="${GRADING_KEY_CHART_PAD_L}" y="${GRADING_KEY_CHART_PAD_T}" width="${GRADING_KEY_CHART_PLOT_W}" height="${GRADING_KEY_CHART_PLOT_H}" fill="${colors.background}" stroke="${colors.border}" stroke-width="1" rx="4"/>`,
  ];

  for (const tick of xPointTicks) {
    const x = GRADING_KEY_CHART_PAD_L + tick.t * GRADING_KEY_CHART_PLOT_W;
    parts.push(
      `<line x1="${x}" x2="${x}" y1="${GRADING_KEY_CHART_PAD_T}" y2="${GRADING_KEY_CHART_PAD_T + GRADING_KEY_CHART_PLOT_H}" stroke="${colors.grid}" stroke-width="1"/>`,
      `<text x="${x}" y="${GRADING_KEY_CHART_VB_H - 8}" text-anchor="middle" font-size="10" font-family="Helvetica, Arial, sans-serif" fill="${colors.muted}">${escapeXml(tick.label)}</text>`,
    );
  }

  for (const g of yTicks) {
    const y = gradeValueToPlotY(g, yMin, ySpan, npMode);
    const label = npMode
      ? String(g)
      : Number.isInteger(g)
        ? String(g)
        : g.toFixed(2).replace('.', ',');
    parts.push(
      `<line x1="${GRADING_KEY_CHART_PAD_L - 4}" x2="${GRADING_KEY_CHART_PAD_L}" y1="${y}" y2="${y}" stroke="${colors.border}" stroke-width="1"/>`,
      `<text x="${GRADING_KEY_CHART_PAD_L - 5}" y="${y + 4}" text-anchor="end" font-size="10" font-family="Helvetica, Arial, sans-serif" fill="${colors.muted}">${escapeXml(label)}</text>`,
    );
  }

  parts.push(
    `<polyline fill="none" stroke="${colors.foreground}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${polylinePoints}"/>`,
    `<text x="${GRADING_KEY_CHART_PAD_L + GRADING_KEY_CHART_PLOT_W / 2}" y="${GRADING_KEY_CHART_VB_H - 1}" text-anchor="middle" font-size="11" font-family="Helvetica, Arial, sans-serif" fill="${colors.muted}">Punkte</text>`,
    `<text x="10" y="${GRADING_KEY_CHART_PAD_T + GRADING_KEY_CHART_PLOT_H / 2}" text-anchor="middle" font-size="11" font-family="Helvetica, Arial, sans-serif" fill="${colors.muted}" transform="rotate(-90 10 ${GRADING_KEY_CHART_PAD_T + GRADING_KEY_CHART_PLOT_H / 2})">${escapeXml(yAxisLabel)}</text>`,
    '</svg>',
  );

  return parts.join('');
}

export const GRADING_KEY_CHART_EXPORT_WIDTH = 640;
export const GRADING_KEY_CHART_EXPORT_HEIGHT = 400;
