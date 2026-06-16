import React, { useMemo } from 'react';
import { calculateGradeFromThresholds, gradeFromPercentBands, gradeToNotenpunkte } from '../utils/calculator';
import { getFormulaKeyIntercept, gradeFromFormulaPoints } from '../data/formulaGradingKey';

const VB_W = 320;
const VB_H = 200;
const PAD_L = 42;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 30;
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;

const NOTE_TICK_CANDIDATES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
const NP_TICK_CANDIDATES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export default function GradingKeyChart({
  type,
  maxPoints,
  thresholdsOverride,
  customBands,
  showNotenpunkte = false,
}) {
  const max = Number(maxPoints);
  const valid = Number.isFinite(max) && max > 0;
  const formulaIntercept = getFormulaKeyIntercept(type);

  const chart = useMemo(() => {
    if (!valid) return null;

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
      const np = gradeToNotenpunkte(g);
      return np !== null ? np : null;
    };

    const samples = Math.min(400, Math.max(80, Math.ceil(max * 4)));
    const pts = [];
    let gLo = Infinity;
    let gHi = -Infinity;
    for (let i = 0; i <= samples; i += 1) {
      const p = Math.round(((max * i) / samples) * 2) / 2;
      const v = valueAtPoints(p);
      if (v === null || !Number.isFinite(v)) continue;
      gLo = Math.min(gLo, v);
      gHi = Math.max(gHi, v);
    }
    if (!Number.isFinite(gLo) || !Number.isFinite(gHi)) return null;
    const pad = Math.max(0.1, (gHi - gLo) * 0.06);
    const yMin = showNotenpunkte ? Math.max(0, Math.min(gLo - pad, 0)) : Math.min(gLo - pad, 1);
    const yMax = showNotenpunkte ? Math.min(15, Math.max(gHi + pad, 15)) : Math.max(gHi + pad, 6);
    const span = yMax - yMin || 1;

    for (let i = 0; i <= samples; i += 1) {
      const p = Math.round(((max * i) / samples) * 2) / 2;
      const v = valueAtPoints(p);
      if (v === null || !Number.isFinite(v)) continue;
      const x = PAD_L + (p / max) * PLOT_W;
      const y = PAD_T + ((yMax - v) / span) * PLOT_H;
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    const tickCandidates = showNotenpunkte ? NP_TICK_CANDIDATES : NOTE_TICK_CANDIDATES;
    const yTicks = tickCandidates.filter((g) => g >= yMin - 0.001 && g <= yMax + 0.001);
    return { polylinePoints: pts.join(' '), yMin, yMax, yTicks, span, showNotenpunkte };
  }, [type, max, valid, thresholdsOverride, customBands, formulaIntercept, showNotenpunkte]);

  if (!valid) {
    return (
      <div className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem 0' }}>
        Diagramm: bitte gültige Maximalpunkte (&gt; 0) einstellen.
      </div>
    );
  }

  if (!chart || !chart.polylinePoints) {
    return null;
  }

  const { polylinePoints, yMin, yMax, yTicks, span, showNotenpunkte: npMode } = chart;

  return (
    <div className="grading-key-chart">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="200"
        style={{ display: 'block', maxWidth: '100%' }}
        role="img"
        aria-label={npMode ? `Notenschlüssel: Notenpunkte je Punktzahl bis ${max}` : `Notenschlüssel: Note je Punktzahl bis ${max}`}
      >
        <rect
          x={PAD_L}
          y={PAD_T}
          width={PLOT_W}
          height={PLOT_H}
          fill="hsl(var(--background))"
          stroke="var(--border)"
          strokeWidth="1"
          rx="4"
        />
        {yTicks.map((g) => {
          const y = PAD_T + ((yMax - g) / span) * PLOT_H;
          const label = npMode
            ? String(g)
            : Number.isInteger(g)
              ? String(g)
              : g.toFixed(2).replace('.', ',');
          return (
            <g key={g}>
              <line
                x1={PAD_L}
                x2={PAD_L + PLOT_W}
                y1={y}
                y2={y}
                stroke="hsl(var(--foreground) / 0.07)"
                strokeWidth="1"
              />
              <text x={PAD_L - 5} y={y + 4} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">
                {label}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const p = t * max;
          const x = PAD_L + t * PLOT_W;
          const lbl =
            max >= 20 || Number.isInteger(p)
              ? String(Math.round(p))
              : String(Math.round(p * 10) / 10).replace('.', ',');
          return (
            <g key={t}>
              <line x1={x} x2={x} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H + 4} stroke="var(--border)" strokeWidth="1" />
              <text x={x} y={VB_H - 8} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
                {lbl}
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
        <text x={PAD_L + PLOT_W / 2} y={VB_H - 1} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">
          Punkte
        </text>
      </svg>
    </div>
  );
}
