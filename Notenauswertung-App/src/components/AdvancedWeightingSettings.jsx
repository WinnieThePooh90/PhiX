import React from 'react';
import PhixCheckboxOption from './PhixCheckboxOption';

export default function AdvancedWeightingSettings({
  advancedEnabled,
  onAdvancedEnabledChange,
  testsAsHalfExam,
  onTestsAsHalfExamChange,
  testsAsOral,
  onTestsAsOralChange,
  testsWritten = true,
}) {
  const testsOptionsDisabled = testsWritten === false;

  return (
    <div className="settings-advanced-weighting">
      <div className="course-meta-settings-row settings-advanced-weighting__toggle-row">
        <div className="course-meta-field">
          <span className="course-meta-field__label">Erweiterte Gewichtungseinstellungen</span>
          <div className="course-meta-field__row">
            <label className="switch" title="Erweiterte Gewichtungseinstellungen ein-/ausblenden">
              <input
                type="checkbox"
                checked={advancedEnabled === true}
                onChange={(e) => onAdvancedEnabledChange(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>
        </div>
      </div>
      {advancedEnabled ? (
        <div className="settings-advanced-weighting-panel">
          <PhixCheckboxOption
            checked={testsAsHalfExam === true}
            onChange={(e) => onTestsAsHalfExamChange(e.target.checked)}
            disabled={testsOptionsDisabled}
          >
            Tests als halbe Klausur werten
          </PhixCheckboxOption>
          <PhixCheckboxOption
            checked={testsAsOral === true}
            onChange={(e) => onTestsAsOralChange(e.target.checked)}
            disabled={testsOptionsDisabled}
          >
            Tests wie mündlich
          </PhixCheckboxOption>
          {testsOptionsDisabled ? (
            <p className="settings-advanced-weighting-hint text-muted">
              Nur verfügbar, wenn Tests geschrieben werden.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
