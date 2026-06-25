import React from 'react';
import PhixCheckboxOption from './PhixCheckboxOption';
import { REFERAT_WEIGHTING_MODES, getReferatWeightingMode } from '../utils/courseWeightingOptions';

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
  referatAsOral = false,
  referatWrittenPercentEnabled = false,
  referatWrittenPercent = 100,
  onReferatWrittenPercentChange,
  referatOralPercentEnabled = false,
  referatOralPercent = 100,
  onReferatOralPercentChange,
  referatFinalPercentEnabled = false,
  referatFinalPercent = 100,
  onReferatFinalPercentChange,
  onReferatModeChange,
}) {
  const testsOptionsDisabled = testsWritten === false;
  const referateOptionsDisabled = referateAccepted === false;

  const referatMode = getReferatWeightingMode({
    referatAsExam,
    referatAsOral,
    referatWrittenPercentEnabled,
    referatOralPercentEnabled,
    referatFinalPercentEnabled,
  });

  const handleReferatModeToggle = (mode) => (e) => {
    onReferatModeChange?.(mode, e.target.checked);
  };

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
        <div className="settings-advanced-weighting-panel settings-advanced-weighting-panel--columns">
          <div className="settings-advanced-weighting-column">
            <h4 className="settings-advanced-weighting-column__title">Tests</h4>
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
          </div>
          <div className="settings-advanced-weighting-column">
            <h4 className="settings-advanced-weighting-column__title">Referate</h4>
            <PhixCheckboxOption
              checked={referatMode === REFERAT_WEIGHTING_MODES.EXAM}
              onChange={handleReferatModeToggle(REFERAT_WEIGHTING_MODES.EXAM)}
              disabled={referateOptionsDisabled}
              className="settings-advanced-weighting-option"
            >
              Referat als Klausur werten
            </PhixCheckboxOption>
            <PhixCheckboxOption
              checked={referatMode === REFERAT_WEIGHTING_MODES.ORAL}
              onChange={handleReferatModeToggle(REFERAT_WEIGHTING_MODES.ORAL)}
              disabled={referateOptionsDisabled}
              className="settings-advanced-weighting-option"
            >
              Referat wie mündlich werten
            </PhixCheckboxOption>
            <PhixCheckboxOption
              checked={referatMode === REFERAT_WEIGHTING_MODES.WRITTEN_PERCENT}
              onChange={handleReferatModeToggle(REFERAT_WEIGHTING_MODES.WRITTEN_PERCENT)}
              disabled={referateOptionsDisabled}
              className="settings-advanced-weighting-option settings-tests-per-klausur-checkbox"
            >
              {referatMode === REFERAT_WEIGHTING_MODES.WRITTEN_PERCENT ? (
                <span className="settings-tests-per-klausur-inline-label">
                  Referat zählt zu
                  {' '}
                  <input
                    type="number"
                    className="course-meta-control settings-tests-per-klausur-x"
                    min="0"
                    max="100"
                    step="1"
                    value={referatWrittenPercent ?? 100}
                    onChange={(e) => onReferatWrittenPercentChange?.(e.target.value)}
                    onMouseDown={stopCheckboxToggle}
                    onClick={stopCheckboxToggle}
                    disabled={referateOptionsDisabled}
                    aria-label="Prozentualer Anteil des Referats in Schriftlich"
                  />
                  {' '}
                  % in schriftlich
                </span>
              ) : (
                'Referat zählt zu x % in schriftlich'
              )}
            </PhixCheckboxOption>
            <PhixCheckboxOption
              checked={referatMode === REFERAT_WEIGHTING_MODES.ORAL_PERCENT}
              onChange={handleReferatModeToggle(REFERAT_WEIGHTING_MODES.ORAL_PERCENT)}
              disabled={referateOptionsDisabled}
              className="settings-advanced-weighting-option settings-tests-per-klausur-checkbox"
            >
              {referatMode === REFERAT_WEIGHTING_MODES.ORAL_PERCENT ? (
                <span className="settings-tests-per-klausur-inline-label">
                  Referat zählt zu
                  {' '}
                  <input
                    type="number"
                    className="course-meta-control settings-tests-per-klausur-x"
                    min="0"
                    max="100"
                    step="1"
                    value={referatOralPercent ?? 100}
                    onChange={(e) => onReferatOralPercentChange?.(e.target.value)}
                    onMouseDown={stopCheckboxToggle}
                    onClick={stopCheckboxToggle}
                    disabled={referateOptionsDisabled}
                    aria-label="Prozentualer Anteil des Referats in Mündlich"
                  />
                  {' '}
                  % in mündlich
                </span>
              ) : (
                'Referat zählt zu x % in mündlich'
              )}
            </PhixCheckboxOption>
            <PhixCheckboxOption
              checked={referatMode === REFERAT_WEIGHTING_MODES.FINAL_PERCENT}
              onChange={handleReferatModeToggle(REFERAT_WEIGHTING_MODES.FINAL_PERCENT)}
              disabled={referateOptionsDisabled}
              className="settings-advanced-weighting-option settings-tests-per-klausur-checkbox"
            >
              {referatMode === REFERAT_WEIGHTING_MODES.FINAL_PERCENT ? (
                <span className="settings-tests-per-klausur-inline-label">
                  Referat zählt zu
                  {' '}
                  <input
                    type="number"
                    className="course-meta-control settings-tests-per-klausur-x"
                    min="0"
                    max="100"
                    step="1"
                    value={referatFinalPercent ?? 100}
                    onChange={(e) => onReferatFinalPercentChange?.(e.target.value)}
                    onMouseDown={stopCheckboxToggle}
                    onClick={stopCheckboxToggle}
                    disabled={referateOptionsDisabled}
                    aria-label="Prozentualer Anteil des Referats an der Gesamtnote"
                  />
                  {' '}
                  % in die Gesamtnote
                </span>
              ) : (
                'Referat zählt zu x % in die Gesamtnote'
              )}
            </PhixCheckboxOption>
          </div>
        </div>
      ) : null}
    </div>
  );
}
