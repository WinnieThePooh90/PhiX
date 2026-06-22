import React from 'react';
import PhixCheckboxOption from './PhixCheckboxOption';

export default function AdvancedWeightingSettings({
  advancedEnabled,
  onAdvancedEnabledChange,
  testsAsHalfExam,
  onTestsAsHalfExamChange,
  testsWritten = true,
}) {
  return (
    <div className="settings-advanced-weighting">
      <PhixCheckboxOption
        checked={advancedEnabled === true}
        onChange={(e) => onAdvancedEnabledChange(e.target.checked)}
      >
        Erweiterte Gewichtungseinstellungen
      </PhixCheckboxOption>
      {advancedEnabled ? (
        <div className="settings-advanced-weighting-panel">
          <PhixCheckboxOption
            checked={testsAsHalfExam === true}
            onChange={(e) => onTestsAsHalfExamChange(e.target.checked)}
            disabled={testsWritten === false}
          >
            Tests als halbe Klausur werten
          </PhixCheckboxOption>
          {testsWritten === false ? (
            <p className="settings-advanced-weighting-hint text-muted">
              Nur verfügbar, wenn Tests geschrieben werden.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
