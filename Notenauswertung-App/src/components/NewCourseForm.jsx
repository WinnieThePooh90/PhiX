import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import NotensystemHelpButton from './NotensystemHelpButton';

function defaultSchoolYear() {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

export default function NewCourseForm() {
  const { createCourse, config } = useData();
  const navigate = useNavigate();
  const [newCourse, setNewCourse] = useState({
    year: config?.year || defaultSchoolYear(),
    className: '',
    subject: '',
    hours: 4,
    weighting: { written: 2, oral: 1, tests: 1 },
    gradeSystem: 'classic',
    testsWritten: true,
    gfsAccepted: true,
    klassenlehrerEnabled: false,
  });

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
      window.alert('Bitte Klasse und Fach angeben.');
      return;
    }
    const created = await createCourse(newCourse);
    if (created) {
      navigate('/', { replace: true });
    } else {
      window.alert('Das Fach konnte nicht angelegt werden. Bitte prüfe die Verbindung zum Server und versuche es erneut.');
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
        <div className="grid-2 mb-0">
          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Schuljahr</label>
            <input name="year" value={newCourse.year} onChange={handleNewCourseChange} className="w-full" />
          </div>
          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Klasse</label>
            <input name="className" value={newCourse.className} onChange={handleNewCourseChange} placeholder="z.B. 10a" className="w-full" />
          </div>
          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Fach</label>
            <input name="subject" value={newCourse.subject} onChange={handleNewCourseChange} placeholder="z.B. NWT" className="w-full" />
          </div>
          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Wochenstunden</label>
            <input type="number" name="hours" value={newCourse.hours} onChange={handleNewCourseChange} className="w-full" />
          </div>
        </div>
      </section>

      <section aria-labelledby="new-course-weight-heading">
        <h3 id="new-course-weight-heading" className="mb-2">
          Gewichtung
        </h3>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Gib hier die Gewichtung der Noten im Verhältnis an.
        </p>
        <div className="weighting-ratio-grid">
          <label className="text-muted" style={{ display: 'block' }}>Schriftlich</label>
          <span className="weighting-ratio-grid__sep-slot" aria-hidden />
          <label className="text-muted" style={{ display: 'block' }}>Mündlich</label>
          <span className="weighting-ratio-grid__sep-slot" aria-hidden />
          <label className="text-muted" style={{ display: 'block' }}>Tests</label>
          <input type="number" name="written" value={newCourse.weighting.written} onChange={handleNewCourseWeightingChange} className="w-full" />
          <span className="weighting-ratio-grid__colon" aria-hidden>
            :
          </span>
          <input type="number" name="oral" value={newCourse.weighting.oral} onChange={handleNewCourseWeightingChange} className="w-full" />
          <span className="weighting-ratio-grid__colon" aria-hidden>
            :
          </span>
          <input type="number" name="tests" value={newCourse.weighting.tests} onChange={handleNewCourseWeightingChange} className="w-full" />
        </div>
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
          <label className="settings-tests-written-option">
            <input
              type="checkbox"
              checked={newCourse.testsWritten !== false}
              onChange={(e) => setNewCourse((p) => ({ ...p, testsWritten: e.target.checked }))}
            />
            <span>Tests werden geschrieben</span>
          </label>
          <label className="settings-tests-written-option">
            <input
              type="checkbox"
              checked={newCourse.gfsAccepted !== false}
              onChange={(e) => setNewCourse((p) => ({ ...p, gfsAccepted: e.target.checked }))}
            />
            <span>GFS werden angenommen</span>
          </label>
          <label className="settings-tests-written-option">
            <input
              type="checkbox"
              checked={newCourse.klassenlehrerEnabled === true}
              onChange={(e) => setNewCourse((p) => ({ ...p, klassenlehrerEnabled: e.target.checked }))}
            />
            <span>Klassenlehrer</span>
          </label>
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
