import React from 'react';
import { formatWeightingPercentHint } from './CourseHeaderTitle';

export default function WeightingPercentHint({
  weighting,
  showTestsColumn = true,
  testsWeightAuto = false,
}) {
  const hint = formatWeightingPercentHint(weighting, showTestsColumn);
  const autoNote = testsWeightAuto ? 'Test-Gewichtung wird automatisch ermittelt' : null;

  if (!hint && !autoNote) return null;

  return (
    <p className="weighting-percent-hint" role="note">
      {hint ? <>Entspricht in Prozent: {hint}</> : null}
      {hint && autoNote ? ' - ' : null}
      {autoNote}
    </p>
  );
}
