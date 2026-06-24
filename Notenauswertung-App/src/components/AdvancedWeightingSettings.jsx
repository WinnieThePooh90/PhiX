import React from 'react';
import PhixCheckboxOption from './PhixCheckboxOption';

export default function AdvancedWeightingSettings({
  advancedEnabled,
  onAdvancedEnabledChange,
  testsAsHalfExam,
  onTestsAsHalfExamChange,
  testsAsOral,
  onTestsAsOralChange,
  testsPerKlausurEnabled,
  onTestsPerKlausurEnabledChange,
  testsPerKlausur,
  onTestsPerKlausurChange,
  testsWritten = true,
  referateAccepted = false,
  referatAsExam = false,
  onReferatAsExamChange,
}) {
  const testsOptionsDisabled = testsWritten === false;

  const stopCheckboxToggle = (e) => {
    e.stopPropagation();
  };

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
            className="settings-advanced-weighting-option"
          >
            Tests als halbe Klausur werten
          </PhixCheckboxOption>
          <PhixCheckboxOption
            checked={testsAsOral === true}
            onChange={(e) => onTestsAsOralChange(e.target.checked)}
            disabled={testsOptionsDisabled}
            className="settings-advanced-weighting-option"
          >
            Tests wie mündlich werten
          </PhixCheckboxOption>
          <PhixCheckboxOption
            checked={testsPerKlausurEnabled === true}
            onChange={(e) => onTestsPerKlausurEnabledChange(e.target.checked)}
            disabled={testsOptionsDisabled}
            className="settings-advanced-weighting-option settings-tests-per-klausur-checkbox"
          >
            {testsPerKlausurEnabled ? (
              <span className="settings-tests-per-klausur-inline-label">
                <input
                  type="number"
                  className="course-meta-control settings-tests-per-klausur-x"
                  min="1"
                  max="99"
                  step="1"
                  value={testsPerKlausur ?? 10}
                  onChange={(e) => onTestsPerKlausurChange(e.target.value)}
                  onMouseDown={stopCheckboxToggle}
                  onClick={stopCheckboxToggle}
                  aria-label="Anzahl Tests pro Klausur"
                />
                {' '}
                Tests zählen wie 1 Klausur
              </span>
            ) : (
              'x Tests zählen wie 1 Klausur'
            )}
          </PhixCheckboxOption>
          {referateAccepted ? (
            <PhixCheckboxOption
              checked={referatAsExam === true}
              onChange={(e) => onReferatAsExamChange?.(e.target.checked)}
              className="settings-advanced-weighting-option"
            >
              Referat als Klausur werten
            </PhixCheckboxOption>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
