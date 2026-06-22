import React from 'react';
import AppLogo from './AppLogo';

export function formatCourseWeightingRatio(weighting, showTestsColumn = true) {
  if (weighting == null) return '';
  const w = weighting.written ?? '';
  const m = weighting.oral ?? '';
  if (showTestsColumn === false) return `${w}:${m}`;
  return `${w}:${m}:${weighting.tests ?? ''}`;
}

/** Verhältnis in Prozent (nur wenn Summe ≠ 100), z. B. „75 % : 25 %“. */
export function formatWeightingPercentHint(weighting, showTestsColumn = true) {
  const written = Number(weighting?.written);
  const oral = Number(weighting?.oral);
  const tests = Number(weighting?.tests);
  const values = showTestsColumn === false ? [written, oral] : [written, oral, tests];

  if (!values.every((v) => Number.isFinite(v))) return null;

  const sum = values.reduce((acc, v) => acc + v, 0);
  if (sum <= 0 || Math.abs(sum - 100) < 1e-6) return null;

  const formatPct = (value) => {
    const pct = (value / sum) * 100;
    const rounded = Math.round(pct * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  return values.map((v) => `${formatPct(v)} %`).join(' : ');
}

function formatWeighting(weighting, showTestsColumn = true) {
  const ratio = formatCourseWeightingRatio(weighting, showTestsColumn);
  if (!ratio) return null;
  return `Gewichtung: ${ratio}`;
}

export default function CourseHeaderTitle({ config, className = '' }) {
  if (!config) return null;

  const classLabel = config.className || config.class;
  const showTestsColumn = config.testsWritten !== false
    && !(config.advancedWeightingEnabled === true && config.testsAsHalfExam === true);
  const weightingText = formatWeighting(config.weighting, showTestsColumn);

  return (
    <header className={['course-header-title', className].filter(Boolean).join(' ')}>
      <div className="course-header-title__brand">
        <AppLogo className="course-header-title__logo" />
        <div className="course-header-title__text">
          <h1 className="course-header-title__name">
            {config.subject} {classLabel}
          </h1>
          <p className="course-header-title__meta">
            Schuljahr: {config.year}
            {weightingText ? ` · ${weightingText}` : ''}
          </p>
        </div>
      </div>
    </header>
  );
}
