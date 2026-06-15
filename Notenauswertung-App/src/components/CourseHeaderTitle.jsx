import React from 'react';
import AppLogo from './AppLogo';

export function formatCourseWeightingRatio(weighting, testsWritten = true) {
  if (weighting == null) return '';
  const w = weighting.written ?? '';
  const m = weighting.oral ?? '';
  if (testsWritten === false) return `${w}:${m}`;
  return `${w}:${m}:${weighting.tests ?? ''}`;
}

function formatWeighting(weighting, testsWritten = true) {
  const ratio = formatCourseWeightingRatio(weighting, testsWritten);
  if (!ratio) return null;
  return `Gewichtung: ${ratio}`;
}

export default function CourseHeaderTitle({ config, className = '' }) {
  if (!config) return null;

  const classLabel = config.className || config.class;
  const weightingText = formatWeighting(config.weighting, config.testsWritten !== false);

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
