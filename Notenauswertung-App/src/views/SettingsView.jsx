import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { useDialog } from '../components/PhixDialog';
import { normalizeCourseGradeSystem } from '../utils/calculator';
import { parseGradeFromClassCell } from '../utils/schoolRosterXlsxImport';
import NotensystemHelpButton from '../components/NotensystemHelpButton';
import PhixCheckboxOption from '../components/PhixCheckboxOption';

const ROSTER_GRADES = [5, 6, 7, 8, 9, 10, 11, 12, 13];

function rosterStudentKey(firstName, lastName) {
  return `${String(firstName ?? '').trim().toLowerCase()}|${String(lastName ?? '').trim().toLowerCase()}`;
}

export default function SettingsView() {
  const {
    config,
    setConfig,
    students,
    addStudent,
    removeStudent,
    clearCourseStudents,
    deleteCourse,
    migrateGradingSystem,
    schoolRosterYears,
    activeSchoolRosterYearId,
    setActiveSchoolRosterYearId,
    schoolRosterStudents,
  } = useData();
  const { showConfirm, showAlert } = useDialog();
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteAdding, setPasteAdding] = useState(false);
  /** `null` = alle Klassenstufen (5–13), sonst nur diese Stufe */
  const [rosterGradeFilter, setRosterGradeFilter] = useState(10);
  const [rosterTransferSearch, setRosterTransferSearch] = useState('');
  /** Gemeinsamer Bereich: manuelles Anlegen + Übernahme aus Schülerverwaltung */
  const [addStudentsPanelOpen, setAddStudentsPanelOpen] = useState(false);
  const [addingRosterId, setAddingRosterId] = useState(null);
  const [addingAllRoster, setAddingAllRoster] = useState(false);
  const [clearingCourseStudents, setClearingCourseStudents] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const classFieldForGrade = config?.className || config?.class;
  const parsedClassGrade = useMemo(() => parseGradeFromClassCell(classFieldForGrade), [classFieldForGrade]);

  useEffect(() => {
    if (parsedClassGrade != null) setRosterGradeFilter(parsedClassGrade);
  }, [parsedClassGrade, classFieldForGrade]);

  useEffect(() => {
    const courseYear = String(config?.year ?? '').trim();
    if (!courseYear || !schoolRosterYears.length) return;
    const match = schoolRosterYears.find((y) => y.label === courseYear);
    if (match) setActiveSchoolRosterYearId(match.id);
  }, [config?.year, config?.id, schoolRosterYears, setActiveSchoolRosterYearId]);

  const activeRosterYear = schoolRosterYears.find((y) => y.id === activeSchoolRosterYearId) ?? null;

  const rosterCandidates = useMemo(() => {
    const inCourse = new Set(students.map((s) => rosterStudentKey(s.firstName, s.lastName)));
    let rows = [...(schoolRosterStudents || [])]
      .filter((r) => rosterGradeFilter === null || r.gradeLevel === rosterGradeFilter)
      .filter((r) => !inCourse.has(rosterStudentKey(r.firstName, r.lastName)));
    const q = rosterTransferSearch.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      rows = rows.filter((r) => {
        const hay = `${r.gradeLevel} ${String(r.lastName ?? '')} ${String(r.firstName ?? '')}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    rows.sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
      const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
      if (ln !== 0) return ln;
      return String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
    });
    return rows;
  }, [schoolRosterStudents, students, rosterGradeFilter, rosterTransferSearch]);

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleWeightingChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      weighting: { ...prev.weighting, [name]: parseFloat(value) || 0 }
    }));
  };

  const handleGradeSystemChange = async (e) => {
    const next = normalizeCourseGradeSystem(e.target.value);
    const prev = normalizeCourseGradeSystem(config?.gradeSystem);
    if (next !== prev) {
      await migrateGradingSystem(prev, next);
    }
    setConfig((c) => ({ ...c, gradeSystem: next }));
  };

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim()) return;
    addStudent({ firstName: newFirstName, lastName: newLastName });
    setNewFirstName('');
    setNewLastName('');
  };

  const handleAddTestStudent = () => {
    const nextNum = students.length + 1;
    addStudent({ firstName: `Test ${nextNum}`, lastName: `${nextNum}` });
  };

  const handleAddFromRoster = async (row) => {
    setAddingRosterId(row.id);
    try {
      await addStudent({ firstName: row.firstName, lastName: row.lastName });
    } finally {
      setAddingRosterId(null);
    }
  };

  const handleClearCourseStudents = async () => {
    const n = students.length;
    if (n === 0) return;
    const label = `"${config.subject}" (${config.className || config.class || ''})`.trim();
    const ok = await showConfirm(
      `Alle ${n} Sch\u00FCler aus der Kursliste f\u00FCr ${label} entfernen?\n\nDas Fach bleibt bestehen; nur die Teilnehmerliste wird geleert.`,
      { title: 'Kursliste leeren', danger: true },
    );
    if (!ok) return;
    setClearingCourseStudents(true);
    try {
      await clearCourseStudents();
      setDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      await showAlert(`Leeren fehlgeschlagen: ${err?.message || String(err)}`, { title: 'Fehler' });
    } finally {
      setClearingCourseStudents(false);
    }
  };

  const handleAddAllRosterCandidates = async () => {
    if (!rosterCandidates.length) return;
    const stageHint =
      rosterGradeFilter === null ? 'allen gew\u00E4hlten Stufen' : `der Stufe ${rosterGradeFilter}`;
    let ok = true;
    if (rosterCandidates.length > 8) {
      ok = await showConfirm(
        `${rosterCandidates.length} Sch\u00FCler (${stageHint}, evtl. eingeschr\u00E4nkt durch die Suche) aus der Sch\u00FClerverwaltung in diesen Kurs \u00FCbernehmen?`,
        { title: 'Sch\u00FCler \u00FCbernehmen' },
      );
    }
    if (!ok) return;
    setAddingAllRoster(true);
    try {
      const keys = new Set(students.map((s) => rosterStudentKey(s.firstName, s.lastName)));
      for (const row of rosterCandidates) {
        const k = rosterStudentKey(row.firstName, row.lastName);
        if (keys.has(k)) continue;
        keys.add(k);
        await addStudent({ firstName: row.firstName, lastName: row.lastName });
      }
    } finally {
      setAddingAllRoster(false);
    }
  };

  const handleDeleteCourse = async () => {
    const ok = await showConfirm(
      `M\u00F6chtest du das Fach "${config.subject} (${config.className || config.class})" wirklich komplett l\u00F6schen?\n\nAchtung: Alle zugeh\u00F6rigen Noten und Sch\u00FCler werden endg\u00FCltig entfernt!`,
      { title: 'Fach l\u00F6schen', danger: true },
    );
    if (!ok) return;
    setDeleteModalOpen(false);
    deleteCourse(config.id);
  };

  useEffect(() => {
    if (!deleteModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setDeleteModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteModalOpen]);

  const handlePasteStudents = async () => {
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
        if (lastName && firstName) parsed.push({ firstName, lastName });
      } else {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const lastName = parts[0];
          const firstName = parts.slice(1).join(' ');
          if (lastName && firstName) parsed.push({ firstName, lastName });
        }
      }
    }
    if (!parsed.length) {
      await showAlert('Keine g\u00FCltigen Eintr\u00E4ge erkannt. Bitte das Format \u201ENachname, Vorname\u201C verwenden (eine Zeile pro Sch\u00FCler).', { title: 'Kein Ergebnis' });
      return;
    }
    const ok = await showConfirm(
      `${parsed.length} Sch\u00FCler erkannt. In den Kurs \u00FCbernehmen?`,
      { title: 'Sch\u00FCler einf\u00FCgen' },
    );
    if (!ok) return;
    setPasteAdding(true);
    try {
      for (const s of parsed) {
        await addStudent(s);
      }
      setPasteText('');
    } finally {
      setPasteAdding(false);
    }
  };

  if (!config) {
    return null;
  }

  return (
    <div className="view-generic-scroll" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {deleteModalOpen
        ? createPortal(
            <div
              className="oral-formula-modal-backdrop"
              role="presentation"
              onClick={() => setDeleteModalOpen(false)}
            >
              <div
                className="oral-formula-modal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-delete-modal-title"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 'min(32rem, calc(100vw - 2rem))' }}
              >
                <div className="oral-formula-modal-header">
                  <h2 id="settings-delete-modal-title" style={{ margin: 0, fontSize: '1.05rem', color: 'var(--danger)' }}>
                    Löschen
                  </h2>
                  <button type="button" className="tab secondary" onClick={() => setDeleteModalOpen(false)}>
                    Schließen
                  </button>
                </div>
                <div className="oral-formula-modal-body" style={{ fontSize: '0.875rem', lineHeight: 1.55 }}>
                  <p className="text-muted" style={{ margin: '0 0 1rem' }}>
                    Aktionen, die Daten dieses Kurses dauerhaft entfernen oder die Teilnehmerliste leeren.
                  </p>
                  <p className="text-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem' }}>
                    Schülerliste leeren
                  </p>
                  <p style={{ margin: '0 0 0.75rem' }}>
                    Alle Schüler aus der Kursliste entfernen — das Fach bleibt bestehen.
                  </p>
                  <button
                    type="button"
                    className="danger"
                    disabled={students.length === 0 || clearingCourseStudents}
                    onClick={handleClearCourseStudents}
                  >
                    {clearingCourseStudents ? 'Leere…' : 'Liste leeren'}
                  </button>
                  <p
                    className="text-muted"
                    style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}
                  >
                    Gesamtes Fach löschen
                  </p>
                  <p style={{ margin: '0 0 0.75rem' }}>
                    Das Fach inklusive aller Schüler, Noten und Schlüssel unwiderruflich entfernen.
                  </p>
                  <button type="button" className="danger" onClick={handleDeleteCourse}>
                    Fach unwiderruflich löschen
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <h2 style={{ margin: 0 }}>Allgemeine Einstellungen</h2>
        <button type="button" className="danger" onClick={() => setDeleteModalOpen(true)}>
          Löschen
        </button>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '2.25rem',
        }}
      >
        <section aria-labelledby="settings-class-data-heading">
              <h3 id="settings-class-data-heading" className="mb-2">
                Klassen & Fachdaten
              </h3>
              <div className="flex gap-4">
                <div className="w-full">
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Schuljahr</label>
                  <input name="year" value={config.year} onChange={handleConfigChange} className="w-full" />
                </div>
                <div className="w-full">
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Klasse</label>
                  <input name="className" value={config.className || config.class} onChange={handleConfigChange} className="w-full" />
                </div>
              </div>
              <div className="flex gap-4 mt-4">
                <div className="w-full">
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Fach</label>
                  <input name="subject" value={config.subject} onChange={handleConfigChange} className="w-full" />
                </div>
                <div className="w-full">
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Wochenstunden</label>
                  <input type="number" name="hours" value={config.hours} onChange={handleConfigChange} className="w-full" />
                </div>
              </div>
            </section>

            <section aria-labelledby="settings-weight-heading">
              <h3 id="settings-weight-heading" className="mb-2">
                Gewichtung
              </h3>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                Gib hier die Gewichtung der Noten im Verhältnis an, z. B. 3:1 oder 75:25 oder 3:2:1 oder 75:33:17.
              </p>
              {config.testsWritten !== false ? (
                <div className="weighting-ratio-grid mt-4">
                  <label className="text-muted" style={{ display: 'block' }}>Schriftlich</label>
                  <span className="weighting-ratio-grid__sep-slot" aria-hidden />
                  <label className="text-muted" style={{ display: 'block' }}>Mündlich</label>
                  <span className="weighting-ratio-grid__sep-slot" aria-hidden />
                  <label className="text-muted" style={{ display: 'block' }}>Tests</label>
                  <input type="number" name="written" value={config.weighting.written} onChange={handleWeightingChange} className="w-full" />
                  <span className="weighting-ratio-grid__colon" aria-hidden>
                    :
                  </span>
                  <input type="number" name="oral" value={config.weighting.oral} onChange={handleWeightingChange} className="w-full" />
                  <span className="weighting-ratio-grid__colon" aria-hidden>
                    :
                  </span>
                  <input type="number" name="tests" value={config.weighting.tests} onChange={handleWeightingChange} className="w-full" />
                </div>
              ) : (
                <div
                  className="weighting-ratio-grid mt-4"
                  style={{ gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }}
                >
                  <label className="text-muted" style={{ display: 'block' }}>Schriftlich</label>
                  <span className="weighting-ratio-grid__sep-slot" aria-hidden />
                  <label className="text-muted" style={{ display: 'block' }}>Mündlich</label>
                  <input type="number" name="written" value={config.weighting.written} onChange={handleWeightingChange} className="w-full" />
                  <span className="weighting-ratio-grid__colon" aria-hidden>
                    :
                  </span>
                  <input type="number" name="oral" value={config.weighting.oral} onChange={handleWeightingChange} className="w-full" />
                </div>
              )}
            </section>

            <section aria-labelledby="settings-course-options-heading">
              <h3 id="settings-course-options-heading" className="mb-2">
                Facheinstellungen
              </h3>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Notensystem</label>
              <div className="flex flex-wrap items-center gap-2" style={{ width: '100%' }}>
                <select
                  value={config.gradeSystem ?? 'classic'}
                  onChange={handleGradeSystemChange}
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
                  checked={config.testsWritten !== false}
                  onChange={(e) => setConfig((c) => ({ ...c, testsWritten: e.target.checked }))}
                >
                  Tests werden geschrieben
                </PhixCheckboxOption>
                <PhixCheckboxOption
                  checked={config.gfsAccepted !== false}
                  onChange={(e) => setConfig((c) => ({ ...c, gfsAccepted: e.target.checked }))}
                >
                  GFS werden angenommen
                </PhixCheckboxOption>
                <PhixCheckboxOption
                  checked={config.projectsAccepted === true}
                  onChange={(e) => setConfig((c) => ({ ...c, projectsAccepted: e.target.checked }))}
                >
                  Projekte werden durchgeführt
                </PhixCheckboxOption>
                <PhixCheckboxOption
                  checked={config.klassenlehrerEnabled === true}
                  onChange={(e) => setConfig((c) => ({ ...c, klassenlehrerEnabled: e.target.checked }))}
                >
                  Klassenlehrer
                </PhixCheckboxOption>
              </div>
            </section>
          </div>

          <section
            aria-labelledby="settings-student-list-heading"
            style={{
              marginTop: '2.75rem',
              paddingTop: '0.25rem',
              borderTop: '1px solid var(--border)',
            }}
          >
          <h2 id="settings-student-list-heading" className="mb-4">
            Schülerliste ({students.length})
          </h2>

          {!addStudentsPanelOpen ? (
            <div className="mb-6" style={{ width: '100%' }}>
              <button
                type="button"
                className="tab secondary"
                onClick={() => setAddStudentsPanelOpen(true)}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontWeight: 600,
                  padding: '0.75rem 1rem',
                  boxSizing: 'border-box',
                }}
                aria-expanded={false}
                aria-controls="add-students-panel"
              >
                Schüler hinzufügen
              </button>
            </div>
          ) : (
          <div
            id="add-students-panel"
            className="glass-panel mb-6"
            style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
          >
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Schüler hinzufügen</h3>
              <button
                type="button"
                className="tab secondary"
                onClick={() => setAddStudentsPanelOpen(false)}
                aria-expanded={true}
                aria-controls="add-students-panel"
              >
                Einklappen
              </button>
            </div>

            <h4 className="text-muted" style={{ fontSize: '0.95rem', margin: '0 0 0.75rem', fontWeight: 600 }}>
              Manuell
            </h4>
            <form onSubmit={handleAddStudent} className="flex flex-wrap gap-4 mb-6" style={{ alignItems: 'flex-end' }}>
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Vorname</label>
                <input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Max..." />
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Nachname</label>
                <input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Mustermann..." />
              </div>
              <button type="submit">In Kurs übernehmen</button>
              <button type="button" className="secondary" onClick={handleAddTestStudent}>
                Testschüler
              </button>
            </form>

            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '1.25rem',
                marginTop: '0.25rem',
              }}
            >
              <h4 className="text-muted" style={{ fontSize: '0.95rem', margin: '0 0 0.75rem', fontWeight: 600 }}>
                Per Copy &amp; Paste
              </h4>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Eine Liste einfügen (eine Zeile pro Schüler, Format: <strong>Nachname, Vorname</strong> oder ohne Komma: <strong>Nachname Vorname</strong>).
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Mustermann, Max\nMusterfrau, Erika\nBeispiel, Tim"}
                rows={5}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  marginBottom: '0.75rem',
                }}
                disabled={pasteAdding}
              />
              <div>
                <button
                  type="button"
                  className="tab active"
                  onClick={handlePasteStudents}
                  disabled={pasteAdding || !pasteText.trim()}
                >
                  {pasteAdding ? 'Wird hinzugefügt…' : 'Liste übernehmen'}
                </button>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '1.25rem',
                marginTop: '1.25rem',
              }}
            >
              <h4 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>Aus Schülerverwaltung</h4>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Schüler aus der schulweiten Liste (Programm → Schülerverwaltung) in diesen Kurs übernehmen. Zuerst das{' '}
              <strong>Schuljahr</strong> wählen, dann optional eine <strong>Klassenstufe</strong> oder <strong>Alle Stufen</strong>.
              Über die <strong>Suche</strong> kannst du die Liste einschränken (Nachname, Vorname oder Ziffer der Stufe). Bereits im Kurs
              vorhandene Namen werden ausgeblendet.
              {parsedClassGrade != null ? (
                <>
                  {' '}
                  Die Stufe <strong>{parsedClassGrade}</strong> wurde aus dem Klassenfeld „{String(classFieldForGrade || '').trim() || '—'}“
                  erkannt und als Filter voreingestellt.
                </>
              ) : (
                <>
                  {' '}
                  Aus dem Klassenfeld ließ sich keine Stufe 5–13 ableiten; bitte die Stufe manuell wählen oder „Alle Stufen“ nutzen.
                </>
              )}
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
                  disabled={addingAllRoster || !schoolRosterYears.length}
                  aria-label="Schuljahr der Schülerverwaltung"
                >
                  {!schoolRosterYears.length ? <option value="">— kein Schuljahr —</option> : null}
                  {schoolRosterYears.map((y) => (
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
                  disabled={addingAllRoster}
                >
                  <option value="all">Alle Stufen</option>
                  {ROSTER_GRADES.map((g) => (
                    <option key={g} value={String(g)}>
                      {g}
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
                  disabled={addingAllRoster}
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
                  disabled={addingAllRoster || addingRosterId != null || rosterCandidates.length === 0}
                  onClick={handleAddAllRosterCandidates}
                >
                  {addingAllRoster ? 'Übernehme…' : `Alle ${rosterCandidates.length} übernehmen`}
                </button>
              </div>
            </div>
            {rosterCandidates.length === 0 ? (
              <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                {!schoolRosterYears.length
                  ? 'In der Schülerverwaltung ist noch kein Schuljahr angelegt. Unter Programm → Schülerverwaltung zuerst ein Schuljahr (z. B. 2026/2027) anlegen.'
                  : !activeSchoolRosterYearId
                    ? 'Bitte ein Schuljahr auswählen.'
                    : !schoolRosterStudents?.length
                  ? `Im Schuljahr „${activeRosterYear?.label ?? '—'}“ sind noch keine Schüler. Unter Programm → Schülerverwaltung anlegen oder importieren.`
                  : rosterTransferSearch.trim()
                    ? 'Keine Treffer für diese Suche (mit aktuellem Stufenfilter; nur Schüler, die noch nicht im Kurs sind).'
                    : rosterGradeFilter === null
                      ? 'Keine weiteren Schüler aus der Verwaltung für „Alle Stufen“ — evtl. sind alle bereits im Kurs.'
                      : `Keine Schüler der Stufe ${rosterGradeFilter} in der Verwaltung, die noch nicht im Kurs sind.`}
              </p>
            ) : (
              <div className="table-container table-container--opaque-thead" style={{ margin: 0, maxHeight: 'min(22rem, 50vh)', overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Nachname</th>
                      <th>Vorname</th>
                      <th className="text-center" style={{ width: '5rem' }}>
                        Stufe
                      </th>
                      <th className="text-right" style={{ width: '11rem' }}>
                        Aktion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterCandidates.map((r) => (
                      <tr key={r.id}>
                        <td>{r.lastName}</td>
                        <td>{r.firstName}</td>
                        <td className="text-center">{r.gradeLevel}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="tab secondary"
                            disabled={addingRosterId != null || addingAllRoster}
                            onClick={() => handleAddFromRoster(r)}
                            title="Diesen Schüler einzeln in den Kurs übernehmen"
                          >
                            {addingRosterId === r.id ? '…' : 'Zum Kurs'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
          )}

          <div
            className="table-container table-container--opaque-thead"
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>#</th>
                  <th>Nachname</th>
                  <th>Vorname</th>
                  <th className="text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => (
                  <tr key={s.id}>
                    <td>{s.studentNumber ?? (idx + 1)}</td>
                    <td>{s.lastName}</td>
                    <td>{s.firstName}</td>
                    <td className="text-right">
                      <button className="danger" onClick={() => removeStudent(s.id)}>Löschen</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </section>
    </div>
  );
}
