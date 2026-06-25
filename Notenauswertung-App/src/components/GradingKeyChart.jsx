import React, { useMemo } from 'react';
import {
  buildGradingKeyChartModel,
  gradeValueToPlotY,
  GRADING_KEY_CHART_PAD_L,
  GRADING_KEY_CHART_PAD_T,
  GRADING_KEY_CHART_PLOT_H,
  GRADING_KEY_CHART_PLOT_W,
  GRADING_KEY_CHART_VB_H,
  GRADING_KEY_CHART_VB_W,
} from '../utils/gradingKeyChartModel';

export default function GradingKeyChart({
  type,
  maxPoints,
  thresholdsOverride,
  customBands,
  showNotenpunkte = false,
}) {
  const max = Number(maxPoints);
  const valid = Number.isFinite(max) && max > 0;

  const chart = useMemo(
    () => buildGradingKeyChartModel({
      type,
      maxPoints,
      thresholdsOverride,
      customBands,
      showNotenpunkte,
    }),
    [type, maxPoints, thresholdsOverride, customBands, showNotenpunkte],
  );

  if (!valid) {
    return (
      <div className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem 0' }}>
        Diagramm: bitte gültige Maximalpunkte (&gt; 0) einstellen.
      </div>
    );
  }

  if (!chart?.polylinePoints) {
    return null;
  }

  const { polylinePoints, yMin, ySpan, yTicks, xPointTicks, showNotenpunkte: npMode } = chart;
  const yAxisLabel = npMode ? 'Notenpunkte' : 'Note';

  return (
    <div className="grading-key-chart">
      <svg
        viewBox={`0 0 ${GRADING_KEY_CHART_VB_W} ${GRADING_KEY_CHART_VB_H}`}
        width="100%"
        height="200"
        style={{ display: 'block', maxWidth: '100%' }}
        role="img"
        aria-label={npMode ? `Notenschlüssel: Notenpunkte je Punkte bis ${max}` : `Notenschlüssel: Note je Punkte bis ${max} Punkte`}
      >
        <rect
          x={GRADING_KEY_CHART_PAD_L}
          y={GRADING_KEY_CHART_PAD_T}
          width={GRADING_KEY_CHART_PLOT_W}
          height={GRADING_KEY_CHART_PLOT_H}
          fill="hsl(var(--background))"
          stroke="var(--border)"
          strokeWidth="1"
          rx="4"
        />
        {xPointTicks.map((tick) => {
          const x = GRADING_KEY_CHART_PAD_L + tick.t * GRADING_KEY_CHART_PLOT_W;
          return (
            <g key={tick.t}>
              <line
                x1={x}
                x2={x}
                y1={GRADING_KEY_CHART_PAD_T}
                y2={GRADING_KEY_CHART_PAD_T + GRADING_KEY_CHART_PLOT_H}
                stroke="hsl(var(--foreground) / 0.07)"
                strokeWidth="1"
              />
              <text x={x} y={GRADING_KEY_CHART_VB_H - 8} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
                {tick.label}
              </text>
            </g>
          );
        })}
        {yTicks.map((g) => {
          const y = gradeValueToPlotY(g, yMin, ySpan, npMode);
          const label = npMode
            ? String(g)
            : Number.isInteger(g)
              ? String(g)
              : g.toFixed(2).replace('.', ',');
          return (
            <g key={g}>
              <line x1={GRADING_KEY_CHART_PAD_L - 4} x2={GRADING_KEY_CHART_PAD_L} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={GRADING_KEY_CHART_PAD_L - 5} y={y + 4} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">
                {label}
              </text>
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polylinePoints}
        />
        <text x={GRADING_KEY_CHART_PAD_L + GRADING_KEY_CHART_PLOT_W / 2} y={GRADING_KEY_CHART_VB_H - 1} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">
          Punkte
        </text>
        <text
          x={10}
          y={GRADING_KEY_CHART_PAD_T + GRADING_KEY_CHART_PLOT_H / 2}
          textAnchor="middle"
          fontSize="11"
          fill="hsl(var(--muted-foreground))"
          transform={`rotate(-90 10 ${GRADING_KEY_CHART_PAD_T + GRADING_KEY_CHART_PLOT_H / 2})`}
        >
          {yAxisLabel}
        </text>
      </svg>
    </div>
  );
}
