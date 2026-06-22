import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { useDialog } from './PhixDialog';
import NotensystemHelpButton from './NotensystemHelpButton';
import PhixCheckboxOption from './PhixCheckboxOption';
import WeightingPercentHint from './WeightingPercentHint';
import AdvancedWeightingSettings from './AdvancedWeightingSettings';
import { showTestsInWeightingRatio } from '../utils/courseWeightingOptions';
import { selectInputOnFocus } from '../utils/selectOnFocus';

function defaultSchoolYear() {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

export default function NewCourseForm() {
  const { createCourse, config } = useData();
  const { showAlert } = useDialog();
  const navigate = useNavigate();
  const [newCourse, setNewCourse] = useState({
    year: config?.year || defaultSchoolYear(),
    className: '',
    subject: '',
    hours: 4,
    weighting: { written: 2, oral: 1, tests: 1 },
    gradeSystem: 'classic',
    testsWritten: false,
    gfsAccepted: true,
    projectsAccepted: false,
    klassenlehrerEnabled: false,
    albumEnabled: false,
    advancedWeightingEnabled: false,
    testsAsHalfExam: false,
    testsAsOral: false,
    kursstufe: false,
  });

  const handleKursstufeChange = (checked) => {
    setNewCourse((prev) => ({
      ...prev,
      kursstufe: checked,
      ...(checked ? { gradeSystem: 'points' } : { gradeSystem: 'classic' }),
    }));
  };

  const handleNewCourseGradeSystemChange = (e) => {
    setNewCourse((prev) => ({ ...prev, gradeSystem: e.target.value }));
  };

  const handleNewCourseChange = (e) => {
    const { name, value } = e.target;
    setNewCourse((prev) => ({ ...prev, [name]: name === 'hours' ? parseInt(value, 10) || 0 : value }));
  };

  const handleNewCourseWeightingChange = (e) => {
    const { name, value } = e.target;
    setNewCourse((prev) => ({
      ...prev,
      weighting: { ...prev.weighting, [name]: parseFloat(value) || 0 },
    }));
  };

  const handleCreateCourse = async () => {
    if (!newCourse.className || !newCourse.subject) {
      await showAlert('Bitte Klasse und Fach angeben.', { title: 'Hinweis' });
      return;
    }
    const created = await createCourse(newCourse);
    if (created) {
      navigate('/', { replace: true });
    } else {
      await showAlert('Das Fach konnte nicht angelegt werden. Bitte prüfe die Verbindung zum Server und versuche es erneut.', { title: 'Fehler' });
    }
  };

  return (
    <div
      className="view-generic-scroll"
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '2.25rem',
      }}
    >
      <section aria-labelledby="new-course-class-data-heading">
        <h3 id="new-course-class-data-heading" className="mb-4">
          Klassen & Fachdaten
        </h3>
        <div className="course-class-data-grid">
          <div className="course-meta-field">
            <label className="text-muted course-meta-label" htmlFor="new-course-year">
              Schuljahr
            </label>
            <input
              id="new-course-year"
              name="year"
              value={newCourse.year}
              onChange={handleNewCourseChange}
              onFocus={selectInputOnFocus}
              className="course-meta-input w-full"
            />
          </div>
          <div className="course-meta-field">
            <label className="text-muted course-meta-label" htmlFor="new-course-class">
              Klasse
            </label>
            <div className="course-meta-class-kursstufe-row">
              <input
                id="new-course-class"
                name="className"
                value={newCourse.className}
                onChange={handleNewCourseChange}
                onFocus={selectInputOnFocus}
                placeholder="10a"
                className="course-meta-input course-meta-input--class"
              />
              <PhixCheckboxOption
                checked={newCourse.kursstufe === true}
                onChange={(e) => handleKursstufeChange(e.target.checked)}
                className="course-meta-kursstufe-checkbox"
              >
                Kursstufe
              </PhixCheckboxOption>
            </div>
          </div>
          <div className="course-meta-field">
            <label className="text-muted course-meta-label" htmlFor="new-course-subject">
              Fach
            </label>
            <input
              id="new-course-subject"
              name="subject"
              value={newCourse.subject}
              onChange={handleNewCourseChange}
              onFocus={selectInputOnFocus}
              placeholder="z.B. NWT"
              className="w-full"
            />
          </div>
          <div className="course-meta-field">
            <label className="text-muted course-meta-label" htmlFor="new-course-hours">
              Wochenstunden
            </label>
            <input
              id="new-course-hours"
              type="number"
              name="hours"
              value={newCourse.hours}
              onChange={handleNewCourseChange}
              onFocus={selectInputOnFocus}
              className="w-full"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="new-course-weight-heading">
        <h3 id="new-course-weight-heading" className="mb-2">
          Gewichtung
        </h3>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Gib hier die Gewichtung der Noten im Verhältnis an, z. B. 3:1 oder 75:25 oder 3:2:1 oder 75:33:17.
        </p>
        {showTestsInWeightingRatio(newCourse) ? (
          <div className="weighting-ratio-grid">
            <label className="text-muted" style={{ display: 'block' }}>Schriftlich</label>
            <span className="weighting-ratio-grid__sep-slot" aria-hidden />
            <label className="text-muted" style={{ display: 'block' }}>Mündlich</label>
            <span className="weighting-ratio-grid__sep-slot" aria-hidden />
            <label className="text-muted" style={{ display: 'block' }}>Tests</label>
            <input type="number" name="written" value={newCourse.weighting.written} onChange={handleNewCourseWeightingChange} onFocus={selectInputOnFocus} className="w-full" />
            <span className="weighting-ratio-grid__colon" aria-hidden>
              :
            </span>
            <input type="number" name="oral" value={newCourse.weighting.oral} onChange={handleNewCourseWeightingChange} onFocus={selectInputOnFocus} className="w-full" />
            <span className="weighting-ratio-grid__colon" aria-hidden>
              :
            </span>
            <input type="number" name="tests" value={newCourse.weighting.tests} onChange={handleNewCourseWeightingChange} onFocus={selectInputOnFocus} className="w-full" />
          </div>
        ) : (
          <div
            className="weighting-ratio-grid"
            style={{ gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }}
          >
            <label className="text-muted" style={{ display: 'block' }}>Schriftlich</label>
            <span className="weighting-ratio-grid__sep-slot" aria-hidden />
            <label className="text-muted" style={{ display: 'block' }}>Mündlich</label>
            <input type="number" name="written" value={newCourse.weighting.written} onChange={handleNewCourseWeightingChange} onFocus={selectInputOnFocus} className="w-full" />
            <span className="weighting-ratio-grid__colon" aria-hidden>
              :
            </span>
            <input type="number" name="oral" value={newCourse.weighting.oral} onChange={handleNewCourseWeightingChange} onFocus={selectInputOnFocus} className="w-full" />
          </div>
        )}
        <WeightingPercentHint
          weighting={newCourse.weighting}
          showTestsColumn={showTestsInWeightingRatio(newCourse)}
        />
        <AdvancedWeightingSettings
          advancedEnabled={newCourse.advancedWeightingEnabled === true}
          onAdvancedEnabledChange={(checked) => setNewCourse((p) => ({ ...p, advancedWeightingEnabled: checked }))}
          testsAsHalfExam={newCourse.testsAsHalfExam === true}
          onTestsAsHalfExamChange={(checked) => setNewCourse((p) => ({
            ...p,
            testsAsHalfExam: checked,
            testsAsOral: checked ? false : p.testsAsOral,
          }))}
          testsAsOral={newCourse.testsAsOral === true}
          onTestsAsOralChange={(checked) => setNewCourse((p) => ({
            ...p,
            testsAsOral: checked,
            testsAsHalfExam: checked ? false : p.testsAsHalfExam,
          }))}
          testsWritten={newCourse.testsWritten !== false}
        />
      </section>

      <section aria-labelledby="new-course-options-heading">
        <h3 id="new-course-options-heading" className="mb-2">
          Facheinstellungen
        </h3>
        <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Notensystem</label>
        <div className="flex flex-wrap items-center gap-2" style={{ width: '100%' }}>
          <select
            value={newCourse.gradeSystem ?? 'classic'}
            onChange={handleNewCourseGradeSystemChange}
            style={{
              flex: '1 1 14rem',
              minWidth: 0,
              width: '100%',
              maxWidth: '100%',
              padding: '0.45rem 0.5rem',
            }}
          >
            <option value="classic">Klassisches Notensystem</option>
            <option value="points">Punktesystem</option>
          </select>
          <NotensystemHelpButton />
        </div>
        <div className="settings-course-check-options">
          <PhixCheckboxOption
            checked={newCourse.testsWritten !== false}
            onChange={(e) => setNewCourse((p) => ({ ...p, testsWritten: e.target.checked }))}
          >
            Tests werden geschrieben
          </PhixCheckboxOption>
          <PhixCheckboxOption
            checked={newCourse.gfsAccepted !== false}
            onChange={(e) => setNewCourse((p) => ({ ...p, gfsAccepted: e.target.checked }))}
          >
            GFS werden angenommen
          </PhixCheckboxOption>
          <PhixCheckboxOption
            checked={newCourse.projectsAccepted === true}
            onChange={(e) => setNewCourse((p) => ({ ...p, projectsAccepted: e.target.checked }))}
          >
            Projekte werden durchgeführt
          </PhixCheckboxOption>
          <PhixCheckboxOption
            checked={newCourse.klassenlehrerEnabled === true}
            onChange={(e) => setNewCourse((p) => ({ ...p, klassenlehrerEnabled: e.target.checked }))}
          >
            Klassenlehrer
          </PhixCheckboxOption>
          <PhixCheckboxOption
            checked={newCourse.albumEnabled === true}
            onChange={(e) => setNewCourse((p) => ({ ...p, albumEnabled: e.target.checked }))}
          >
            Album erstellen
          </PhixCheckboxOption>
        </div>
      </section>

      <div
        style={{
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button type="button" onClick={handleCreateCourse}>
          Fach jetzt anlegen
        </button>
      </div>
    </div>
  );
}
