import React from 'react';
import { formatWeightingPercentHint } from './CourseHeaderTitle';

export default function WeightingPercentHint({ weighting, testsWritten = true }) {
  const hint = formatWeightingPercentHint(weighting, testsWritten);
  if (!hint) return null;

  return (
    <p className="weighting-percent-hint" role="note">
      Entspricht in Prozent: {hint}
    </p>
  );
}
