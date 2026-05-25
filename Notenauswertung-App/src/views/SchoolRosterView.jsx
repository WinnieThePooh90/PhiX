import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { useDialog } from '../components/PhixDialog';
import { parseSchoolRosterXlsx } from '../utils/schoolRosterXlsxImport';
import { defaultSchoolYear, normalizeSchoolYearLabel } from '../utils/schoolYear';

const GRADE_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13];

export default function SchoolRosterView() {
  const {
    schoolRosterYears,
    activeSchoolRosterYearId,
    setActiveSchoolRosterYearId,
    addSchoolRosterYear,
    removeSchoolRosterYear,
    schoolRosterStudents,
    addSchoolRosterStudent,
    updateSchoolRosterStudent,
    removeSchoolRosterStudent,
    clearSchoolRosterStudents,
  } = useData();
  const { showConfirm, showAlert } = useDialog();

  const activeYear = schoolRosterYears.find((y) => y.id === activeSchoolRosterYearId) ?? null;

  const [newYearModalOpen, setNewYearModalOpen] = useState(false);
  const [newYearLabel, setNewYearLabel] = useState(() => defaultSchoolYear());
  const [newYearModalError, setNewYearModalError] = useState('');
  const [creatingYear, setCreatingYear] = useState(false);
  const [deletingYear, setDeletingYear] = useState(false);
  const newYearInputRef = useRef(null);

  const [gradeLevel, setGradeLevel] = useState(10);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editGrade, setEditGrade] = useState(10);
  const [editLast, setEditLast] = useState('');
  const [editFirst, setEditFirst] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');

  const filteredSchoolRoster = useMemo(() => {
    const raw = rosterSearch.trim().toLowerCase();
    if (!raw) return schoolRosterStudents;
    const tokens = raw.split(/\s+/).filter(Boolean);
    return schoolRosterStudents.filter((row) => {
      const hay = `${row.gradeLevel} ${String(row.lastName ?? '')} ${String(row.firstName ?? '')}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [schoolRosterStudents, rosterSearch]);

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditGrade(row.gradeLevel);
    setEditLast(row.lastName);
    setEditFirst(row.firstName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLast('');
    setEditFirst('');
  };

  const openNewYearModal = () => {
    setNewYearLabel(defaultSchoolYear());
    setNewYearModalError('');
    setNewYearModalOpen(true);
  };

  const closeNewYearModal = () => {
    if (creatingYear) return;
    setNewYearModalOpen(false);
    setNewYearModalError('');
  };

  useEffect(() => {
    if (!newYearModalOpen) return undefined;
    const t = window.setTimeout(() => newYearInputRef.current?.focus(), 0);
    const onKey = (e) => {
      if (e.key === 'Escape') closeNewYearModal();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [newYearModalOpen, creatingYear]);

  const handleCreateYear = async (e) => {
    e.preventDefault();
    const norm = normalizeSchoolYearLabel(newYearLabel);
    if (norm.error) {
      setNewYearModalError(norm.error);
      return;
    }
    setNewYearModalError('');
    setCreatingYear(true);
    try {
      const res = await addSchoolRosterYear(norm.label);
      if (res?.error) {
        setNewYearModalError(res.error);
        return;
      }
      setNewYearModalOpen(false);
      setNewYearLabel(defaultSchoolYear());
    } finally {
      setCreatingYear(false);
    }
  };

  const hasSchoolYears = schoolRosterYears.length > 0;

  const handleDeleteYear = async () => {
    if (!activeYear) return;
    const n = activeYear.studentCount ?? schoolRosterStudents.length;
    const msg =
      n > 0
        ? `Schuljahr „${activeYear.label}“ mit ${n} Schüler(n) unwiderruflich löschen?`
        : `Schuljahr „${activeYear.label}“ löschen?`;
    if (!(await showConfirm(msg, { title: 'Schuljahr löschen', danger: true }))) return;
    setDeletingYear(true);
    try {
      await removeSchoolRosterYear(activeYear.id);
      cancelEdit();
    } catch (err) {
      console.error(err);
      await showAlert(`Löschen fehlgeschlagen: ${err?.message || String(err)}`, { title: 'Fehler' });
    } finally {
      setDeletingYear(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!activeSchoolRosterYearId) {
      await showAlert('Bitte zuerst ein Schuljahr anlegen oder auswählen.', { title: 'Hinweis' });
      return;
    }
    const ln = lastName.trim();
    const fn = firstName.trim();
    if (!ln || !fn) {
      await showAlert('Bitte Vor- und Nachnamen eintragen.', { title: 'Hinweis' });
      return;
    }
    setSaving(true);
    try {
      const res = await addSchoolRosterStudent({
        gradeLevel,
        firstName: fn,
        lastName: ln,
        schoolYearId: activeSchoolRosterYearId,
      });
      if (res?.error) {
        await showAlert(res.error, { title: 'Fehler' });
        return;
      }
      setLastName('');
      setFirstName('');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id) => {
    if (!activeSchoolRosterYearId) return;
    const ln = editLast.trim();
    const fn = editFirst.trim();
    if (!ln || !fn) {
      await showAlert('Bitte Vor- und Nachnamen eintragen.', { title: 'Hinweis' });
      return;
    }
    setSaving(true);
    try {
      const res = await updateSchoolRosterStudent(id, {
        gradeLevel: editGrade,
        firstName: fn,
        lastName: ln,
        schoolYearId: activeSchoolRosterYearId,
      });
      if (res?.error) {
        await showAlert(res.error, { title: 'Fehler' });
        return;
      }
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!(await showConfirm(`Eintrag „${row.lastName}, ${row.firstName}“ (Klasse ${row.gradeLevel}) wirklich löschen?`, { title: 'Eintrag löschen', danger: true }))) return;
    await removeSchoolRosterStudent(row.id);
    if (editingId === row.id) cancelEdit();
  };

  const handleImportFile = async (e) => {
    if (!activeSchoolRosterYearId) {
      await showAlert('Bitte zuerst ein Schuljahr auswählen.', { title: 'Hinweis' });
      return;
    }
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseSchoolRosterXlsx(buf);
      if (parsed.error) {
        let msg = parsed.error;
        if (parsed.skipped?.length) {
          msg += '\n\n';
          msg += parsed.skipped
            .slice(0, 12)
            .map((s) => `Zeile ${s._sheetRow}: ${s._reason}`)
            .join('\n');
          if (parsed.skipped.length > 12) msg += `\n… (+${parsed.skipped.length - 12} weitere)`;
        }
        await showAlert(msg, { title: 'Import-Fehler' });
        return;
      }
      const { rows, skipped = [] } = parsed;
      let ok = 0;
      const apiErrors = [];
      for (const r of rows) {
        const res = await addSchoolRosterStudent({
          gradeLevel: r.gradeLevel,
          firstName: r.firstName,
          lastName: r.lastName,
          schoolYearId: activeSchoolRosterYearId,
        });
        if (res?.error) apiErrors.push(`Excel-Zeile ${r._sheetRow}: ${res.error}`);
        else ok++;
      }
      let msg = `${ok} Schüler in „${activeYear?.label ?? 'Schuljahr'}“ importiert.`;
      if (skipped.length) {
        msg += `\n\n${skipped.length} Zeile(n) übersprungen:`;
        msg += `\n${skipped
          .slice(0, 10)
          .map((s) => `Zeile ${s._sheetRow}: ${s._reason}`)
          .join('\n')}`;
        if (skipped.length > 10) msg += `\n… (+${skipped.length - 10} weitere)`;
      }
      if (apiErrors.length) {
        msg += `\n\nSpeichern fehlgeschlagen (${apiErrors.length}):`;
        msg += `\n${apiErrors.slice(0, 8).join('\n')}`;
        if (apiErrors.length > 8) msg += '\n…';
      }
      await showAlert(msg, { title: 'Import abgeschlossen' });
    } catch (err) {
      console.error(err);
      await showAlert(`Import fehlgeschlagen: ${err?.message || String(err)}`, { title: 'Fehler' });
    } finally {
      setImporting(false);
    }
  };

  const handleClearList = async () => {
    if (!activeSchoolRosterYearId || !activeYear) return;
    const n = schoolRosterStudents.length;
    if (n === 0) return;
    const clearOk = await showConfirm(`Alle ${n} Schüler des Schuljahres „${activeYear.label}“ unwiderruflich löschen?\n\nEinzelne Fächer/Kurse sind davon nicht betroffen.`, { title: 'Alle Schüler löschen', danger: true });
    if (!clearOk) return;
    setClearing(true);
    try {
      await clearSchoolRosterStudents(activeSchoolRosterYearId);
      cancelEdit();
    } catch (err) {
      console.error(err);
      await showAlert(`Löschen fehlgeschlagen: ${err?.message || String(err)}`, { title: 'Fehler' });
    } finally {
      setClearing(false);
    }
  };

  const busy = saving || importing || clearing || creatingYear || deletingYear;

  const newYearModal =
    newYearModalOpen &&
    createPortal(
      <div
        className="program-user-mgmt-modal-backdrop"
        role="presentation"
        onMouseDown={(ev) => {
          if (ev.target === ev.currentTarget) closeNewYearModal();
        }}
      >
        <div
          className="program-user-mgmt-modal-dialog glass-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="school-roster-new-year-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id="school-roster-new-year-title" className="program-user-mgmt-modal-title">
            Neues Schuljahr anlegen
          </h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', margin: '0 0 1rem' }}>
            Bezeichnung z.&nbsp;B. <strong>2026/2027</strong>
          </p>
          <form className="program-user-mgmt-form" onSubmit={handleCreateYear}>
            <label className="program-user-mgmt-label">
              Schuljahr
              <input
                ref={newYearInputRef}
                className="program-user-mgmt-input"
                value={newYearLabel}
                onChange={(e) => {
                  setNewYearLabel(e.target.value);
                  if (newYearModalError) setNewYearModalError('');
                }}
                placeholder="2026/2027"
                disabled={creatingYear}
                autoComplete="off"
              />
            </label>
            {newYearModalError ? (
              <p className="program-user-mgmt-error" role="alert">
                {newYearModalError}
              </p>
            ) : null}
            <div className="program-user-mgmt-modal-actions">
              <button type="submit" className="program-user-mgmt-submit" disabled={creatingYear}>
                {creatingYear ? 'Anlegen…' : 'Anlegen'}
              </button>
              <button type="button" className="secondary" onClick={closeNewYearModal} disabled={creatingYear}>
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="view-generic-scroll program-view" style={{ paddingBottom: '2rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {newYearModal}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        style={{ display: 'none' }}
        aria-hidden
        onChange={handleImportFile}
      />
      <div className="flex flex-wrap items-center gap-3 mb-4" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Schülerverwaltung</h2>
      </div>

      <div className="glass-panel mb-6" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>Schuljahre</h3>
        <p className="text-muted" style={{ fontSize: '0.875rem', margin: '0 0 1rem' }}>
          Schüler werden je Schuljahr geführt. Wähle ein Jahr, um Schüler anzulegen oder zu importieren.
        </p>
        {hasSchoolYears ? (
          <div className="flex flex-wrap gap-3 mb-4 school-roster-years-row">
            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                Schuljahr
              </label>
              <select
                value={activeSchoolRosterYearId ?? ''}
                onChange={(e) => {
                  setActiveSchoolRosterYearId(Number(e.target.value));
                  cancelEdit();
                  setRosterSearch('');
                }}
                style={{ minWidth: '11rem' }}
                disabled={busy}
                aria-label="Schuljahr auswählen"
              >
                {schoolRosterYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.studentCount != null ? ` (${y.studentCount})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {activeYear ? (
              <div className="school-roster-inline-actions">
                <span className="school-roster-inline-actions__label-spacer" aria-hidden="true">
                  &nbsp;
                </span>
                <button
                  type="button"
                  className="danger school-roster-control-btn"
                  disabled={busy || deletingYear}
                  onClick={handleDeleteYear}
                >
                  {deletingYear ? '…' : 'Schuljahr löschen'}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted" style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
            Noch kein Schuljahr vorhanden. Lege das erste Schuljahr an, um Schüler zu verwalten.
          </p>
        )}
        <button type="button" className="tab secondary" disabled={busy} onClick={openNewYearModal}>
          + Neues Schuljahr anlegen
        </button>
      </div>

      {hasSchoolYears ? (
        <>
      <div className="glass-panel mb-6" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>
          Neuen Schüler anlegen
          {activeYear ? ` (${activeYear.label})` : ''}
        </h3>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 school-roster-add-form">
          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
              Klasse (Stufe)
            </label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(Number(e.target.value))}
              style={{ minWidth: '5rem', width: 'auto' }}
              aria-label="Klassenstufe"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 10rem', minWidth: '8rem' }}>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
              Nachname
            </label>
            <input
              className="w-full"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              placeholder="Nachname"
            />
          </div>
          <div style={{ flex: '1 1 10rem', minWidth: '8rem' }}>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
              Vorname
            </label>
            <input
              className="w-full"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              placeholder="Vorname"
            />
          </div>
          <div className="school-roster-inline-actions">
            <span className="school-roster-inline-actions__label-spacer" aria-hidden="true">
              &nbsp;
            </span>
            <div className="school-roster-inline-actions__buttons">
              <button type="submit" className="tab active school-roster-control-btn" disabled={busy}>
                {saving ? '…' : 'Hinzufügen'}
              </button>
              <button
                type="button"
                className="tab secondary school-roster-control-btn"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? 'Importieren…' : 'Importieren'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div
          className="flex flex-wrap items-center gap-3 mb-4"
          style={{ justifyContent: 'space-between', width: '100%' }}
        >
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
            Schüler{activeYear ? ` — ${activeYear.label}` : ''} (
            {rosterSearch.trim()
              ? `${filteredSchoolRoster.length} von ${schoolRosterStudents.length}`
              : schoolRosterStudents.length}
            )
          </h3>
          <button
            type="button"
            className="danger"
            disabled={busy || schoolRosterStudents.length === 0}
            onClick={handleClearList}
          >
            {clearing ? 'Leere…' : 'Liste leeren'}
          </button>
        </div>
        {schoolRosterStudents.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>
            In diesem Schuljahr noch keine Schüler. Nutze das Formular oben oder den Excel-Import.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4" style={{ width: '100%' }}>
              <label htmlFor="school-roster-search" className="text-muted" style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                Suchen / filtern
              </label>
              <input
                id="school-roster-search"
                type="search"
                className="w-full"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Nachname, Vorname oder Stufe; mehrere Wörter = alle müssen passen (z. B. „10 Meyer“)"
                autoComplete="off"
                spellCheck={false}
                style={{ flex: '1 1 auto', minWidth: '12rem', width: '100%' }}
                aria-label="Schülerliste durchsuchen"
              />
            </div>
            {filteredSchoolRoster.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>
                Keine Treffer für „{rosterSearch.trim()}“. Filter anpassen oder zurücksetzen.
              </p>
            ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th className="text-center" style={{ width: '6rem' }}>
                    Klasse
                  </th>
                  <th>Nachname</th>
                  <th>Vorname</th>
                  <th className="text-right" style={{ width: '12rem' }}>
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSchoolRoster.map((row) =>
                  editingId === row.id ? (
                    <tr key={row.id}>
                      <td className="text-center" style={{ verticalAlign: 'middle' }}>
                        <select
                          value={editGrade}
                          onChange={(e) => setEditGrade(Number(e.target.value))}
                          style={{ padding: '0.35rem', width: '100%', maxWidth: '5rem' }}
                          aria-label="Klassenstufe bearbeiten"
                        >
                          {GRADE_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <input
                          className="w-full"
                          value={editLast}
                          onChange={(e) => setEditLast(e.target.value)}
                          placeholder="Nachname"
                        />
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <input
                          className="w-full"
                          value={editFirst}
                          onChange={(e) => setEditFirst(e.target.value)}
                          placeholder="Vorname"
                        />
                      </td>
                      <td className="text-right" style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="tab secondary"
                          style={{ marginRight: '0.35rem' }}
                          disabled={saving || clearing}
                          onClick={() => handleSaveEdit(row.id)}
                        >
                          Speichern
                        </button>
                        <button type="button" className="tab secondary" disabled={saving || clearing} onClick={cancelEdit}>
                          Abbrechen
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td className="text-center" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {row.gradeLevel}
                      </td>
                      <td>{row.lastName}</td>
                      <td>{row.firstName}</td>
                      <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="tab secondary"
                          style={{ marginRight: '0.35rem' }}
                          disabled={saving || importing || clearing}
                          onClick={() => startEdit(row)}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={saving || importing || clearing}
                          onClick={() => handleDelete(row)}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </div>
        </>
      ) : null}
    </div>
  );
}
