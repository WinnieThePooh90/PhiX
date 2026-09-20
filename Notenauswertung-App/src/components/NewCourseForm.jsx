import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { useDialog } from './PhixDialog';
import NotensystemHelpButton from './NotensystemHelpButton';
import PhixCheckboxOption from './PhixCheckboxOption';
import WeightingPercentHint from './WeightingPercentHint';
import AdvancedWeightingSettings from './AdvancedWeightingSettings';
import DeferredNumberInput from './DeferredNumberInput';
import { showTestsInWeightingRatio, isTestsWeightComputed, resolveCourseWeighting, formatComputedTestsWeight, describeTestsPerKlausurWeighting, patchAdvancedWeightingToggle, resolveReferatModeToggle } from '../utils/courseWeightingOptions';
import { selectInputOnFocus } from '../utils/selectOnFocus';
import { defaultSchoolYear } from '../utils/schoolYear';
import { parseGradeFromClassCell } from '../utils/schoolRosterXlsxImport';
import { distinctClassSections, formatRosterClassLabel, parseClassSectionFromClassCell } from '../utils/schoolRosterClass';
import { Trash2, Plus, Users, ClipboardList, UserPlus } from 'lucide-react';

const ROSTER_GRADES = [5, 6, 7, 8, 9, 10, 11, 12, 13];

function rosterStudentKey(firstName, lastName) {
  return `${String(firstName ?? '').trim().toLowerCase()}|${String(lastName ?? '').trim().toLowerCase()}`;
}

export default function NewCourseForm() {
  const {
    createCourse,
    config,
    schoolRosterYears,
    activeSchoolRosterYearId,
    setActiveSchoolRosterYearId,
    schoolRosterStudents,
  } = useData();
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
    referateAccepted: false,
    referatAsExam: false,
    referatAsOral: false,
    referatWrittenPercentEnabled: false,
    referatWrittenPercent: 100,
    referatOralPercentEnabled: false,
    referatOralPercent: 100,
    referatFinalPercentEnabled: false,
    referatFinalPercent: 100,
    klassenlehrerEnabled: false,
    albumEnabled: false,
    advancedWeightingEnabled: false,
    testsAsHalfExam: false,
    testsAsOral: false,
    testsPerKlausurEnabled: false,
    testsPerKlausur: 10,
    advancedWeightingStash: null,
    kursstufe: false,
  });

  // Staged students to be created together with the course
  const [stagedStudents, setStagedStudents] = useState([]);
  const [studentInputMode, setStudentInputMode] = useState('roster'); // 'roster' | 'paste' | 'manual'
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [rosterGradeFilter, setRosterGradeFilter] = useState(null);
  const [rosterSectionFilter, setRosterSectionFilter] = useState('');
  const [rosterTransferSearch, setRosterTransferSearch] = useState('');

  const parsedClassGrade = useMemo(
    () => parseGradeFromClassCell(newCourse.className),
    [newCourse.className],
  );
  const parsedClassSection = useMemo(
    () => parseClassSectionFromClassCell(newCourse.className),
    [newCourse.className],
  );

  useEffect(() => {
    if (parsedClassGrade !== null) {
      setRosterGradeFilter(parsedClassGrade);
    }
  }, [parsedClassGrade]);

  useEffect(() => {
    const courseYear = String(newCourse.year ?? '').trim();
    if (!courseYear || !schoolRosterYears?.length) return;
    const match = schoolRosterYears.find((y) => y.label === courseYear);
    if (match) setActiveSchoolRosterYearId(match.id);
  }, [newCourse.year, schoolRosterYears, setActiveSchoolRosterYearId]);

  const activeRosterYear = schoolRosterYears?.find((y) => y.id === activeSchoolRosterYearId) ?? null;

  const rosterSectionFilterOptions = useMemo(
    () => distinctClassSections(schoolRosterStudents, { gradeLevel: rosterGradeFilter }),
    [schoolRosterStudents, rosterGradeFilter],
  );

  useEffect(() => {
    const sec = parsedClassSection ?? '';
    if (sec && rosterSectionFilterOptions.includes(sec)) {
      setRosterSectionFilter(sec);
    } else if (!sec) {
      setRosterSectionFilter('');
    }
  }, [parsedClassSection, rosterSectionFilterOptions]);

  useEffect(() => {
    if (rosterSectionFilter && !rosterSectionFilterOptions.includes(rosterSectionFilter)) {
      setRosterSectionFilter('');
    }
  }, [rosterSectionFilter, rosterSectionFilterOptions]);

  const rosterCandidates = useMemo(() => {
    const stagedKeys = new Set(stagedStudents.map((s) => rosterStudentKey(s.firstName, s.lastName)));
    let rows = [...(schoolRosterStudents || [])]
      .filter((r) => rosterGradeFilter === null || r.gradeLevel === rosterGradeFilter)
      .filter((r) => !rosterSectionFilter || String(r.classSection ?? '').toLowerCase() === rosterSectionFilter)
      .filter((r) => !stagedKeys.has(rosterStudentKey(r.firstName, r.lastName)));
    const q = rosterTransferSearch.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      rows = rows.filter((r) => {
        const hay = `${formatRosterClassLabel(r.gradeLevel, r.classSection)} ${String(r.lastName ?? '')} ${String(r.firstName ?? '')}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    rows.sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
      const secA = String(a.classSection ?? '');
      const secB = String(b.classSection ?? '');
      if (secA !== secB) return secA.localeCompare(secB, 'de', { sensitivity: 'base' });
      const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
      if (ln !== 0) return ln;
      return String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
    });
    return rows;
  }, [schoolRosterStudents, stagedStudents, rosterGradeFilter, rosterSectionFilter, rosterTransferSearch]);

  const effectiveWeighting = useMemo(
    () => resolveCourseWeighting(newCourse.weighting, newCourse, {}, {}),
    [newCourse],
  );
  const testsWeightComputed = isTestsWeightComputed(newCourse);
  const testsPerKlausurHint = describeTestsPerKlausurWeighting(newCourse, {}, {});

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
    setNewCourse((prev) => ({ ...prev, [name]: value }));
  };

  const setNewCourseWeightingField = (name, value) => {
    setNewCourse((prev) => ({
      ...prev,
      weighting: { ...prev.weighting, [name]: value },
    }));
  };

  const handleAddManualStudent = (e) => {
    if (e) e.preventDefault();
    const fn = newFirstName.trim();
    const ln = newLastName.trim();
    if (!fn && !ln) return;
    setStagedStudents((prev) => [
      ...prev,
      { id: `manual-${Date.now()}-${Math.random()}`, firstName: fn, lastName: ln },
    ]);
    setNewFirstName('');
    setNewLastName('');
  };

  const handlePasteStudents = () => {
    const lines = pasteText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const parsed = [];
    for (const line of lines) {
      const sep = line.indexOf(',');
      if (sep > 0) {
        const lastName = line.slice(0, sep).trim();
        const firstName = line.slice(sep + 1).trim();
        if (lastName || firstName) {
          parsed.push({ id: `paste-${Date.now()}-${Math.random()}`, firstName, lastName });
        }
      } else {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const lastName = parts[0];
          const firstName = parts.slice(1).join(' ');
          if (lastName || firstName) {
            parsed.push({ id: `paste-${Date.now()}-${Math.random()}`, firstName, lastName });
          }
        } else if (parts.length === 1 && parts[0]) {
          parsed.push({ id: `paste-${Date.now()}-${Math.random()}`, firstName: '', lastName: parts[0] });
        }
      }
    }
    if (!parsed.length) return;
    setStagedStudents((prev) => [...prev, ...parsed]);
    setPasteText('');
  };

  const handleAddFromRoster = (row) => {
    setStagedStudents((prev) => [
      ...prev,
      { id: `roster-${row.id}-${Date.now()}`, firstName: row.firstName || '', lastName: row.lastName || '' },
    ]);
  };

  const handleAddAllRosterCandidates = () => {
    if (!rosterCandidates.length) return;
    const stagedKeys = new Set(stagedStudents.map((s) => rosterStudentKey(s.firstName, s.lastName)));
    const newItems = [];
    for (const row of rosterCandidates) {
      const k = rosterStudentKey(row.firstName, row.lastName);
      if (stagedKeys.has(k)) continue;
      stagedKeys.add(k);
      newItems.push({
        id: `roster-${row.id}-${Date.now()}-${Math.random()}`,
        firstName: row.firstName || '',
        lastName: row.lastName || '',
      });
    }
    setStagedStudents((prev) => [...prev, ...newItems]);
  };

  const handleRemoveStagedStudent = (id) => {
    setStagedStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearStagedStudents = () => {
    setStagedStudents([]);
  };

  const handleCreateCourse = async () => {
    if (!newCourse.className || !newCourse.subject) {
      await showAlert('Bitte Klasse und Fach angeben.', { title: 'Hinweis' });
      return;
    }
    const created = await createCourse({
      ...newCourse,
      students: stagedStudents.map((s) => ({
        firstName: s.firstName,
        lastName: s.lastName,
      })),
    });
    if (created) {
      navigate('/', { replace: true });
    } else {
      await showAlert(
        'Das Fach konnte nicht angelegt werden. Bitte prüfe die Verbindung zum Server und versuche es erneut.',
        { title: 'Fehler' },
      );
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
          Klassen &amp; Fachdaten
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
            <DeferredNumberInput
              id="new-course-hours"
              integer
              min={1}
              defaultValue={4}
              value={newCourse.hours}
              onChange={(v) => setNewCourse((prev) => ({ ...prev, hours: v }))}
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
            <DeferredNumberInput name="written" value={newCourse.weighting.written} defaultValue={0} min={0} onChange={(v) => setNewCourseWeightingField('written', v)} onFocus={selectInputOnFocus} className="w-full" />
            <span className="weighting-ratio-grid__colon" aria-hidden>
              :
            </span>
            <DeferredNumberInput name="oral" value={newCourse.weighting.oral} defaultValue={0} min={0} onChange={(v) => setNewCourseWeightingField('oral', v)} onFocus={selectInputOnFocus} className="w-full" />
            <span className="weighting-ratio-grid__colon" aria-hidden>
              :
            </span>
            <DeferredNumberInput name="tests" value={testsWeightComputed ? formatComputedTestsWeight(effectiveWeighting?.tests) : newCourse.weighting.tests} defaultValue={0} min={0} onChange={(v) => setNewCourseWeightingField('tests', v)} onFocus={selectInputOnFocus} className={`w-full${testsWeightComputed ? ' weighting-ratio-grid__tests-computed' : ''}`} readOnly={testsWeightComputed} disabled={testsWeightComputed} />
          </div>
        ) : (
          <div
            className="weighting-ratio-grid"
            style={{ gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }}
          >
            <label className="text-muted" style={{ display: 'block' }}>Schriftlich</label>
            <span className="weighting-ratio-grid__sep-slot" aria-hidden />
            <label className="text-muted" style={{ display: 'block' }}>Mündlich</label>
            <DeferredNumberInput name="written" value={newCourse.weighting.written} defaultValue={0} min={0} onChange={(v) => setNewCourseWeightingField('written', v)} onFocus={selectInputOnFocus} className="w-full" />
            <span className="weighting-ratio-grid__colon" aria-hidden>
              :
            </span>
            <DeferredNumberInput name="oral" value={newCourse.weighting.oral} defaultValue={0} min={0} onChange={(v) => setNewCourseWeightingField('oral', v)} onFocus={selectInputOnFocus} className="w-full" />
          </div>
        )}
        <WeightingPercentHint
          weighting={effectiveWeighting}
          showTestsColumn={showTestsInWeightingRatio(newCourse)}
          testsWeightAuto={testsWeightComputed}
        />
        {testsPerKlausurHint ? (
          <p className="settings-advanced-weighting-hint text-muted" role="note">
            {testsPerKlausurHint}
          </p>
        ) : null}
        <AdvancedWeightingSettings
          advancedEnabled={newCourse.advancedWeightingEnabled === true}
          onAdvancedEnabledChange={(checked) => setNewCourse((p) => ({ ...p, ...patchAdvancedWeightingToggle(checked, p) }))}
          testsAsHalfExam={newCourse.testsAsHalfExam === true}
          onTestsAsHalfExamChange={(checked) => setNewCourse((p) => ({
            ...p,
            testsAsHalfExam: checked,
            testsAsOral: checked ? false : p.testsAsOral,
            testsPerKlausurEnabled: checked ? false : p.testsPerKlausurEnabled,
          }))}
          testsAsOral={newCourse.testsAsOral === true}
          onTestsAsOralChange={(checked) => setNewCourse((p) => ({
            ...p,
            testsAsOral: checked,
            testsAsHalfExam: checked ? false : p.testsAsHalfExam,
            testsPerKlausurEnabled: checked ? false : p.testsPerKlausurEnabled,
          }))}
          testsPerKlausurEnabled={newCourse.testsPerKlausurEnabled === true}
          onTestsPerKlausurEnabledChange={(checked) => setNewCourse((p) => ({
            ...p,
            testsPerKlausurEnabled: checked,
            testsAsHalfExam: checked ? false : p.testsAsHalfExam,
            testsAsOral: checked ? false : p.testsAsOral,
            testsPerKlausur: p.testsPerKlausur > 0 ? p.testsPerKlausur : 10,
          }))}
          testsPerKlausur={newCourse.testsPerKlausur ?? 10}
          onTestsPerKlausurChange={(v) => {
            setNewCourse((p) => ({ ...p, testsPerKlausur: v }));
          }}
          testsWritten={newCourse.testsWritten !== false}
          referateAccepted={newCourse.referateAccepted === true}
          referatAsExam={newCourse.referatAsExam === true}
          referatAsOral={newCourse.referatAsOral === true}
          referatWrittenPercentEnabled={newCourse.referatWrittenPercentEnabled === true}
          referatWrittenPercent={newCourse.referatWrittenPercent ?? 100}
          onReferatWrittenPercentChange={(v) => {
            setNewCourse((p) => ({ ...p, referatWrittenPercent: v }));
          }}
          referatOralPercentEnabled={newCourse.referatOralPercentEnabled === true}
          referatOralPercent={newCourse.referatOralPercent ?? 100}
          onReferatOralPercentChange={(v) => {
            setNewCourse((p) => ({ ...p, referatOralPercent: v }));
          }}
          referatFinalPercentEnabled={newCourse.referatFinalPercentEnabled === true}
          referatFinalPercent={newCourse.referatFinalPercent ?? 100}
          onReferatFinalPercentChange={(v) => {
            setNewCourse((p) => ({ ...p, referatFinalPercent: v }));
          }}
          onReferatModeChange={(mode, checked) => setNewCourse((p) => ({
            ...p,
            ...resolveReferatModeToggle(mode, checked, p),
          }))}
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
            checked={newCourse.referateAccepted === true}
            onChange={(e) => setNewCourse((p) => ({
              ...p,
              referateAccepted: e.target.checked,
              referatAsExam: e.target.checked ? true : false,
              referatAsOral: false,
              referatWrittenPercentEnabled: false,
              referatOralPercentEnabled: false,
              referatFinalPercentEnabled: false,
            }))}
          >
            Referate werden gehalten
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

      {/* Schüler erfassen (optional) */}
      <section aria-labelledby="new-course-students-heading">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
          <h3 id="new-course-students-heading" style={{ margin: 0 }}>
            Schüler hinzufügen (optional)
          </h3>
          {stagedStudents.length > 0 && (
            <button
              type="button"
              className="danger"
              onClick={handleClearStagedStudents}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            >
              Liste leeren
            </button>
          )}
        </div>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Du kannst bereits hier Schüler für das neue Fach erfassen oder später in den Einstellungen hinzufügen.
        </p>

        {/* Übersicht der bereits erfassten Schüler */}
        {stagedStudents.length > 0 ? (
          <div className="glass-panel mb-4" style={{ padding: '0.75rem 1rem' }}>
            <div className="flex justify-between items-center mb-2">
              <strong style={{ fontSize: '0.9rem' }}>
                Bereitstehende Schüler ({stagedStudents.length})
              </strong>
            </div>
            <div
              className="table-container table-container--opaque-thead"
              style={{ margin: 0, maxHeight: '16rem', overflow: 'auto' }}
            >
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '3rem' }}>#</th>
                    <th>Nachname</th>
                    <th>Vorname</th>
                    <th className="text-center" style={{ width: '4rem' }}>
                      Aktion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stagedStudents.map((s, idx) => (
                    <tr key={s.id}>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 500 }}>{s.lastName || '—'}</td>
                      <td>{s.firstName || '—'}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleRemoveStagedStudent(s.id)}
                          style={{ padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                          title="Schüler entfernen"
                          aria-label="Schüler entfernen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Eingabe-Optionen */}
        <div className="glass-panel" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* Sub-Tabs */}
          <div className="tabs mb-4" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            <button
              type="button"
              className={`tab ${studentInputMode === 'roster' ? 'active' : 'secondary'}`}
              onClick={() => setStudentInputMode('roster')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            >
              <Users size={16} />
              Aus Schülerkartei
            </button>
            <button
              type="button"
              className={`tab ${studentInputMode === 'paste' ? 'active' : 'secondary'}`}
              onClick={() => setStudentInputMode('paste')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            >
              <ClipboardList size={16} />
              Per Copy &amp; Paste
            </button>
            <button
              type="button"
              className={`tab ${studentInputMode === 'manual' ? 'active' : 'secondary'}`}
              onClick={() => setStudentInputMode('manual')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            >
              <UserPlus size={16} />
              Manuell
            </button>
          </div>

          {/* TAB 1: Aus Schülerverwaltung */}
          {studentInputMode === 'roster' && (
            <div>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Schüler aus der zentralen Schülerverwaltung für das neue Fach auswählen:
              </p>
              <div className="flex flex-wrap gap-3 mb-4 settings-roster-transfer-row">
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                    Schuljahr
                  </label>
                  <select
                    value={activeSchoolRosterYearId ?? ''}
                    onChange={(e) => setActiveSchoolRosterYearId(Number(e.target.value))}
                    style={{ minWidth: '10rem', width: 'auto' }}
                    disabled={!schoolRosterYears?.length}
                    aria-label="Schuljahr der Schülerverwaltung"
                  >
                    {!schoolRosterYears?.length ? <option value="">— kein Schuljahr —</option> : null}
                    {schoolRosterYears?.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                    Klassenstufe filtern
                  </label>
                  <select
                    value={rosterGradeFilter === null ? 'all' : String(rosterGradeFilter)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRosterGradeFilter(v === 'all' ? null : Number(v));
                    }}
                    style={{ minWidth: '9rem', width: 'auto' }}
                    aria-label="Klassenstufe Schülerverwaltung"
                  >
                    <option value="all">Alle Stufen</option>
                    {ROSTER_GRADES.map((g) => (
                      <option key={g} value={String(g)}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                    Teilklasse filtern
                  </label>
                  <select
                    value={rosterSectionFilter}
                    onChange={(e) => setRosterSectionFilter(e.target.value)}
                    style={{ minWidth: '5rem', width: 'auto' }}
                    aria-label="Teilklasse Schülerverwaltung"
                    disabled={rosterSectionFilterOptions.length === 0}
                  >
                    <option value="">—</option>
                    {rosterSectionFilterOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 14rem', minWidth: '12rem', maxWidth: '100%' }}>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                    Suche (optional)
                  </label>
                  <input
                    type="search"
                    className="w-full"
                    value={rosterTransferSearch}
                    onChange={(e) => setRosterTransferSearch(e.target.value)}
                    placeholder="Name oder Stufe eingrenzen…"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Schülerverwaltung durchsuchen"
                  />
                </div>
                <div className="school-roster-inline-actions">
                  <span className="school-roster-inline-actions__label-spacer" aria-hidden="true">
                    &nbsp;
                  </span>
                  <button
                    type="button"
                    className="tab secondary school-roster-control-btn"
                    disabled={rosterCandidates.length === 0}
                    onClick={handleAddAllRosterCandidates}
                  >
                    {`Alle ${rosterCandidates.length} übernehmen`}
                  </button>
                </div>
              </div>

              {rosterCandidates.length === 0 ? (
                <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                  {!schoolRosterYears?.length
                    ? 'In der Schülerverwaltung ist noch kein Schuljahr angelegt.'
                    : !activeSchoolRosterYearId
                      ? 'Bitte ein Schuljahr auswählen.'
                      : !schoolRosterStudents?.length
                      ? `Im Schuljahr „${activeRosterYear?.label ?? '—'}“ sind noch keine Schüler hinterlegt.`
                      : rosterTransferSearch.trim()
                      ? 'Keine Treffer für diese Suche (mit aktuellem Stufenfilter).'
                      : rosterGradeFilter === null
                      ? 'Keine weiteren Schüler aus der Schülerverwaltung (evtl. alle bereits hinzugefügt).'
                      : rosterSectionFilter
                      ? `Keine Schüler der Klasse ${rosterGradeFilter}${rosterSectionFilter} in der Verwaltung, die noch nicht hinzugefügt wurden.`
                      : `Keine Schüler der Stufe ${rosterGradeFilter} in der Verwaltung, die noch nicht hinzugefügt wurden.`}
                </p>
              ) : (
                <div className="table-container table-container--opaque-thead" style={{ margin: 0, maxHeight: '18rem', overflow: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Nachname</th>
                        <th>Vorname</th>
                        <th className="text-center" style={{ width: '5rem' }}>
                          Klasse
                        </th>
                        <th className="text-center" style={{ width: '5rem' }}>
                          Aktion
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rosterCandidates.map((row) => (
                        <tr key={row.id}>
                          <td>{row.lastName || '—'}</td>
                          <td>{row.firstName || '—'}</td>
                          <td className="text-center">{formatRosterClassLabel(row.gradeLevel, row.classSection)}</td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="tab secondary school-roster-control-btn"
                              onClick={() => handleAddFromRoster(row)}
                              title="Schüler hinzufügen"
                              aria-label="Schüler hinzufügen"
                              style={{ padding: '0.2rem 0.5rem' }}
                            >
                              <Plus size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Per Copy & Paste */}
          {studentInputMode === 'paste' && (
            <div>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Eine Liste einfügen (eine Zeile pro Schüler, Format: <strong>Nachname, Vorname</strong> oder <strong>Nachname Vorname</strong>).
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Mustermann, Max\nMusterfrau, Erika\nBeispiel, Tim"}
                rows={5}
                style={{
                  width: '100%',
                  maxWidth: '480px',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  marginBottom: '0.75rem',
                }}
              />
              <div>
                <button
                  type="button"
                  className="tab active"
                  onClick={handlePasteStudents}
                  disabled={!pasteText.trim()}
                >
                  Liste übernehmen
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Manuell */}
          {studentInputMode === 'manual' && (
            <div>
              <form onSubmit={handleAddManualStudent} className="flex flex-wrap gap-4" style={{ alignItems: 'flex-end' }}>
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                    Vorname
                  </label>
                  <input
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Max..."
                  />
                </div>
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                    Nachname
                  </label>
                  <input
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Mustermann..."
                  />
                </div>
                <button type="submit" className="tab active">
                  Hinzufügen
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      <div
        style={{
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          paddingRight: 'min(4rem, 10vw)',
        }}
      >
        <button type="button" onClick={handleCreateCourse}>
          Fach jetzt anlegen
        </button>
      </div>
    </div>
  );
}
