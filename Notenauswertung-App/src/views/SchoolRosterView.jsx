import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { useAuth } from '../store/AuthContext';
import { userHasAdminRights } from '../utils/userAdmin';
import { useDialog } from '../components/PhixDialog';
import { parseSchoolRosterImportFile, SCHOOL_ROSTER_IMPORT_HELP } from '../utils/schoolRosterXlsxImport';
import { CLASS_SECTION_OPTIONS, distinctClassSections, formatRosterClassLabel } from '../utils/schoolRosterClass';
import GradingKeyHelpButton from '../components/GradingKeyHelpButton';
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
  const { currentUser } = useAuth();
  const isAdmin = userHasAdminRights(currentUser);
  const { showConfirm, showAlert } = useDialog();

  const activeYear = schoolRosterYears.find((y) => y.id === activeSchoolRosterYearId) ?? null;

  const [newYearModalOpen, setNewYearModalOpen] = useState(false);
  const [newYearLabel, setNewYearLabel] = useState(() => defaultSchoolYear());
  const [newYearIsGlobal, setNewYearIsGlobal] = useState(true);
  const [newYearModalError, setNewYearModalError] = useState('');
  const [creatingYear, setCreatingYear] = useState(false);
  const [deletingYear, setDeletingYear] = useState(false);
  const newYearInputRef = useRef(null);

  const [gradeLevel, setGradeLevel] = useState(10);
  const [classSection, setClassSection] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [addIsGlobal, setAddIsGlobal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editGrade, setEditGrade] = useState(10);
  const [editClassSection, setEditClassSection] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editFirst, setEditFirst] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  /** `null` = alle Stufen */
  const [rosterGradeFilter, setRosterGradeFilter] = useState(null);
  /** leer = alle Teilklassen der gewählten Stufe */
  const [rosterSectionFilter, setRosterSectionFilter] = useState('');

  const rosterSectionFilterOptions = useMemo(
    () => distinctClassSections(schoolRosterStudents, { gradeLevel: rosterGradeFilter }),
    [schoolRosterStudents, rosterGradeFilter],
  );

  useEffect(() => {
    if (rosterSectionFilter && !rosterSectionFilterOptions.includes(rosterSectionFilter)) {
      setRosterSectionFilter('');
    }
  }, [rosterSectionFilter, rosterSectionFilterOptions]);

  const filteredSchoolRoster = useMemo(() => {
    let rows = schoolRosterStudents;
    if (rosterGradeFilter !== null) {
      rows = rows.filter((row) => row.gradeLevel === rosterGradeFilter);
    }
    if (rosterSectionFilter) {
      rows = rows.filter((row) => String(row.classSection ?? '').toLowerCase() === rosterSectionFilter);
    }
    const raw = rosterSearch.trim().toLowerCase();
    if (!raw) return rows;
    const tokens = raw.split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      const hay = `${formatRosterClassLabel(row.gradeLevel, row.classSection)} ${String(row.lastName ?? '')} ${String(row.firstName ?? '')}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [schoolRosterStudents, rosterSearch, rosterGradeFilter, rosterSectionFilter]);

  const busy = saving || importing || clearing;

  const handleCreateYear = async (e) => {
    e.preventDefault();
    const clean = newYearLabel.trim();
    if (!clean) {
      setNewYearModalError('Bitte eine Bezeichnung eingeben (z. B. 2025/2026).');
      return;
    }
    setCreatingYear(true);
    setNewYearModalError('');
    try {
      const res = await addSchoolRosterYear(clean, { isGlobal: isAdmin ? newYearIsGlobal : false });
      if (res?.error) {
        setNewYearModalError(res.error);
        return;
      }
      closeNewYearModal();
    } catch (err) {
      setNewYearModalError(err?.message || 'Fehler beim Anlegen des Schuljahres.');
    } finally {
      setCreatingYear(false);
    }
  };

  const handleDeleteYear = async () => {
    if (!activeSchoolRosterYearId || !activeYear) return;
    if (activeYear.isGlobal && !isAdmin) {
      await showAlert('Zentrale Schuljahre können nur von Administratoren gelöscht werden.', { title: 'Hinweis' });
      return;
    }
    const n = schoolRosterStudents.length;
    const extra = n > 0 ? `\n\nDabei werden auch alle ${n} hinterlegten Schüler gelöscht.` : '';
    const ok = await showConfirm(
      `Schuljahr „${activeYear.label}“ wirklich löschen?${extra}\n\nEinzelne Fächer/Kurse sind davon nicht betroffen.`,
      { title: 'Schuljahr löschen', danger: true },
    );
    if (!ok) return;
    setDeletingYear(true);
    try {
      const res = await removeSchoolRosterYear(activeSchoolRosterYearId);
      if (res?.error) {
        await showAlert(res.error, { title: 'Fehler' });
      }
    } finally {
      setDeletingYear(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!activeSchoolRosterYearId) {
      await showAlert('Bitte zuerst ein Schuljahr auswählen.', { title: 'Hinweis' });
      return;
    }
    const last = lastName.trim();
    const first = firstName.trim();
    if (!last || !first) {
      await showAlert('Bitte Nachname und Vorname ausfüllen.', { title: 'Pflichtfelder' });
      return;
    }
    setSaving(true);
    try {
      const res = await addSchoolRosterStudent({
        gradeLevel,
        classSection: classSection.trim(),
        firstName: first,
        lastName: last,
        schoolYearId: activeSchoolRosterYearId,
        isGlobal: Boolean(isAdmin && activeYear?.isGlobal && addIsGlobal),
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

  const startEdit = (row) => {
    if (row.isGlobal && !isAdmin) {
      showAlert('Zentrale Schüler können nur von Administratoren bearbeitet werden.', { title: 'Hinweis' });
      return;
    }
    setEditingId(row.id);
    setEditGrade(row.gradeLevel);
    setEditClassSection(row.classSection || '');
    setEditLast(row.lastName || '');
    setEditFirst(row.firstName || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLast('');
    setEditFirst('');
  };

  const handleSaveEdit = async (id) => {
    const last = editLast.trim();
    const first = editFirst.trim();
    if (!last || !first) {
      await showAlert('Nachname und Vorname dürfen nicht leer sein.', { title: 'Pflichtfelder' });
      return;
    }
    setSaving(true);
    try {
      const res = await updateSchoolRosterStudent(id, {
        gradeLevel: editGrade,
        classSection: editClassSection.trim(),
        firstName: first,
        lastName: last,
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
    if (row.isGlobal && !isAdmin) {
      await showAlert('Zentrale Schüler können nur von Administratoren gelöscht werden.', { title: 'Hinweis' });
      return;
    }
    const ok = await showConfirm(
      `Eintrag „${row.lastName}, ${row.firstName}“ (${formatRosterClassLabel(row.gradeLevel, row.classSection)}) wirklich löschen?`,
      { title: 'Schüler löschen', danger: true },
    );
    if (!ok) return;
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
      const parsed = parseSchoolRosterImportFile(buf, file.name);
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
      const total = rows.length;
      let ok = 0;
      const apiErrors = [];
      const targetIsGlobal = Boolean(isAdmin && activeYear?.isGlobal);

      setImportProgress({
        current: 0,
        total,
        percent: 0,
        currentStudentName: 'Vorbereitung…',
        currentClass: '',
        yearLabel: activeYear?.label ?? 'Schuljahr',
        isGlobal: targetIsGlobal,
      });

      for (let i = 0; i < total; i++) {
        const r = rows[i];
        const studentName = [r.lastName, r.firstName].filter(Boolean).join(', ');
        const classLabel = formatRosterClassLabel(r.gradeLevel, r.classSection);

        setImportProgress({
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
          currentStudentName: studentName,
          currentClass: classLabel,
          yearLabel: activeYear?.label ?? 'Schuljahr',
          isGlobal: targetIsGlobal,
        });

        const res = await addSchoolRosterStudent({
          gradeLevel: r.gradeLevel,
          classSection: r.classSection ?? '',
          firstName: r.firstName,
          lastName: r.lastName,
          schoolYearId: activeSchoolRosterYearId,
          isGlobal: targetIsGlobal,
        });
        if (res?.error) apiErrors.push(`Zeile ${r._sheetRow}: ${res.error}`);
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
      setImportProgress(null);
      setImporting(false);
    }
  };

  const handleClearList = async () => {
    if (!activeSchoolRosterYearId || !activeYear) return;
    const n = schoolRosterStudents.length;
    if (n === 0) return;
    const isGlobalYear = Boolean(activeYear.isGlobal);
    const msg = isGlobalYear && !isAdmin
      ? `Möchtest du alle deine persönlich hinzugefügten Schüler aus „${activeYear.label}“ löschen?\n\nZentrale Stammschüler der Schule bleiben erhalten.`
      : `Alle ${n} Schüler des Schuljahres „${activeYear.label}“ unwiderruflich löschen?\n\nEinzelne Fächer/Kurse sind davon nicht betroffen.`;
    const clearOk = await showConfirm(msg, {
      title: isGlobalYear && !isAdmin ? 'Eigene Schüler löschen' : 'Alle Schüler löschen',
      danger: true,
    });
    if (!clearOk) return;
    setClearing(true);
    try {
      await clearSchoolRosterStudents(activeSchoolRosterYearId);
      cancelEdit();
    } finally {
      setClearing(false);
    }
  };

  const openNewYearModal = () => {
    setNewYearLabel(defaultSchoolYear());
    setNewYearIsGlobal(true);
    setNewYearModalError('');
    setNewYearModalOpen(true);
  };

  const closeNewYearModal = () => {
    if (creatingYear) return;
    setNewYearModalOpen(false);
    setNewYearModalError('');
  };

  useEffect(() => {
    if (newYearModalOpen) {
      const id = window.setTimeout(() => {
        newYearInputRef.current?.focus();
        newYearInputRef.current?.select();
      }, 50);
      return () => window.clearTimeout(id);
    }
  }, [newYearModalOpen]);

  const newYearModal =
    newYearModalOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="program-user-mgmt-modal-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeNewYearModal();
            }}
          >
            <div
              className="program-user-mgmt-modal-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-school-roster-year-title"
              style={{ maxWidth: '32rem', width: '92vw' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="new-school-roster-year-title" className="program-user-mgmt-modal-title">
                Neues Schuljahr anlegen
              </h3>
              <form onSubmit={handleCreateYear}>
                <label
                  htmlFor="new-school-roster-year-input"
                  className="text-muted"
                  style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem' }}
                >
                  Bezeichnung
                </label>
                <input
                  id="new-school-roster-year-input"
                  ref={newYearInputRef}
                  value={newYearLabel}
                  onChange={(e) => setNewYearLabel(e.target.value)}
                  placeholder="z. B. 2025/2026"
                  style={{ width: '100%', marginBottom: '0.75rem', boxSizing: 'border-box' }}
                  disabled={creatingYear}
                  autoComplete="off"
                />
                {isAdmin ? (
                  <label
                    className="text-muted flex items-center gap-2"
                    style={{ fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1rem' }}
                  >
                    <input
                      type="checkbox"
                      checked={newYearIsGlobal}
                      onChange={(e) => setNewYearIsGlobal(e.target.checked)}
                      disabled={creatingYear}
                    />
                    <span>Zentrales Schuljahr (schulweit für alle Lehrkräfte sichtbar)</span>
                  </label>
                ) : null}
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
        )
      : null;

  const importProgressModal =
    importProgress && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="school-roster-progress-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Import-Fortschritt"
          >
            <div className="school-roster-progress-dialog">
              <div className="school-roster-progress-header">
                <div className="school-roster-progress-spinner" aria-hidden="true" />
                <h3 className="school-roster-progress-title">Schülerliste wird importiert…</h3>
              </div>

              <div className="school-roster-progress-info">
                <span className="school-roster-progress-target">
                  {importProgress.yearLabel}
                  {importProgress.isGlobal ? ' [Zentral]' : ' [Eigener Bestand]'}
                </span>
                <span className="school-roster-progress-count">
                  {importProgress.current} von {importProgress.total} ({importProgress.percent} %)
                </span>
              </div>

              <div className="school-roster-progress-bar-track">
                <div
                  className="school-roster-progress-bar-fill"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>

              {importProgress.currentStudentName ? (
                <div className="school-roster-progress-item">
                  <span className="text-muted">Aktuell:</span>
                  <strong>{importProgress.currentStudentName}</strong>
                  {importProgress.currentClass ? (
                    <span className="school-roster-progress-class-tag">
                      {importProgress.currentClass}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="view-generic-scroll program-view" style={{ paddingBottom: '2rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {newYearModal}
      {importProgressModal}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        style={{ display: 'none' }}
        aria-hidden
        onChange={handleImportFile}
      />
      <div className="flex flex-wrap items-center gap-3 mb-4" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Schülerverwaltung</h2>
      </div>

      <div className="glass-panel mb-6" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="school-roster-years-header">
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Schuljahre</h3>
          {hasSchoolYears && activeYear ? (
            <button
              type="button"
              className="danger school-roster-control-btn"
              disabled={busy || deletingYear || (activeYear.isGlobal && !isAdmin)}
              onClick={handleDeleteYear}
              title={activeYear.isGlobal && !isAdmin ? 'Zentrale Schuljahre können nur von Administratoren gelöscht werden.' : 'Schuljahr löschen'}
            >
              {deletingYear ? '…' : 'Schuljahr löschen'}
            </button>
          ) : null}
        </div>
        <p className="text-muted" style={{ fontSize: '0.875rem', margin: '0 0 1rem' }}>
          Schüler werden je Schuljahr geführt. Wähle ein Jahr, um Schüler anzulegen oder zu importieren.
        </p>
        <div className="school-roster-years-toolbar">
          {hasSchoolYears ? (
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
                  setRosterGradeFilter(null);
                  setRosterSectionFilter('');
                }}
                style={{ minWidth: '11rem' }}
                disabled={busy}
                aria-label="Schuljahr auswählen"
              >
                {schoolRosterYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.isGlobal ? ' [Zentral]' : ''}
                    {y.studentCount != null ? ` (${y.studentCount})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
              Noch kein Schuljahr vorhanden. Lege das erste Schuljahr an, um Schüler zu verwalten.
            </p>
          )}
          <button
            type="button"
            className="tab secondary school-roster-control-btn school-roster-years-toolbar__new-year"
            disabled={busy}
            onClick={openNewYearModal}
          >
            + Neues Schuljahr anlegen
          </button>
        </div>
      </div>

      {hasSchoolYears ? (
        <>
      <div className="glass-panel mb-6" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>
          Neuen Schüler anlegen
          {activeYear ? ` (${activeYear.label}${activeYear.isGlobal ? ' — Zentral' : ''})` : ''}
        </h3>
        <form onSubmit={handleAdd} className="school-roster-add-form">
          <div className="school-roster-add-form__grade">
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
              Klasse (Stufe)
            </label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(Number(e.target.value))}
              aria-label="Klassenstufe"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="school-roster-add-form__section">
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
              Teilklasse
            </label>
            <select
              value={classSection}
              onChange={(e) => setClassSection(e.target.value)}
              aria-label="Teilklasse"
            >
              <option value="">—</option>
              {CLASS_SECTION_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="school-roster-add-form__name">
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
              Nachname
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              placeholder="Nachname"
            />
          </div>
          <div className="school-roster-add-form__name">
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
              Vorname
            </label>
            <input
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
              <div className="school-roster-import-actions">
                <button
                  type="button"
                  className="tab secondary school-roster-control-btn"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {importing ? 'Importieren…' : 'Importieren'}
                </button>
                <GradingKeyHelpButton
                  text={SCHOOL_ROSTER_IMPORT_HELP}
                  title="Datei-Import"
                  ariaLabel="Hilfe zum Datei-Import"
                />
              </div>
            </div>
          </div>
          {isAdmin && activeYear?.isGlobal ? (
            <div style={{ flex: '1 1 100%', marginTop: '0.25rem' }}>
              <label
                className="text-muted flex items-center gap-2"
                style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}
              >
                <input
                  type="checkbox"
                  checked={addIsGlobal}
                  onChange={(e) => setAddIsGlobal(e.target.checked)}
                  disabled={busy}
                />
                <span>Als zentralen Stammschüler anlegen (schulweit für alle Lehrkräfte sichtbar)</span>
              </label>
            </div>
          ) : null}
        </form>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div
          className="flex flex-wrap items-center gap-3 mb-4"
          style={{ justifyContent: 'space-between', width: '100%' }}
        >
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
            Schüler{activeYear ? ` — ${activeYear.label}` : ''} (
            {rosterSearch.trim() || rosterGradeFilter !== null || rosterSectionFilter
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
            {clearing
              ? 'Leere…'
              : activeYear?.isGlobal && !isAdmin
                ? 'Eigene Schüler leeren'
                : 'Liste leeren'}
          </button>
        </div>
        {schoolRosterStudents.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>
            In diesem Schuljahr noch keine Schüler. Nutze das Formular oben oder den Datei-Import (CSV/Excel).
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 mb-4" style={{ width: '100%' }}>
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                  Stufe filtern
                </label>
                <select
                  value={rosterGradeFilter === null ? 'all' : String(rosterGradeFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRosterGradeFilter(v === 'all' ? null : Number(v));
                  }}
                  style={{ minWidth: '7rem' }}
                  aria-label="Klassenstufe filtern"
                >
                  <option value="all">Alle</option>
                  {GRADE_OPTIONS.map((g) => (
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
                  style={{ minWidth: '5rem' }}
                  aria-label="Teilklasse filtern"
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
              <div style={{ flex: '1 1 auto', minWidth: '12rem' }}>
                <label htmlFor="school-roster-search" className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                  Suchen
                </label>
                <input
                  id="school-roster-search"
                  type="search"
                  className="w-full"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Nachname, Vorname oder Klasse (z. B. „10a Meyer“)"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Schülerliste durchsuchen"
                />
              </div>
            </div>
            {filteredSchoolRoster.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>
                Keine Treffer mit den aktuellen Filtern{rosterSearch.trim() ? ` für „${rosterSearch.trim()}“` : ''}. Filter anpassen oder zurücksetzen.
              </p>
            ) : (
          <div className="table-container table-container--opaque-thead school-roster-table-scroll" style={{ margin: 0 }}>
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
                {filteredSchoolRoster.map((row) => {
                  const canManage = !row.isGlobal || isAdmin;
                  return editingId === row.id ? (
                    <tr key={row.id}>
                      <td className="text-center" style={{ verticalAlign: 'middle' }}>
                        <div className="flex flex-wrap gap-1" style={{ justifyContent: 'center' }}>
                          <select
                            value={editGrade}
                            onChange={(e) => setEditGrade(Number(e.target.value))}
                            style={{ padding: '0.35rem', width: '100%', maxWidth: '4rem' }}
                            aria-label="Klassenstufe bearbeiten"
                          >
                            {GRADE_OPTIONS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editClassSection}
                            onChange={(e) => setEditClassSection(e.target.value)}
                            style={{ padding: '0.35rem', width: '100%', maxWidth: '3.5rem' }}
                            aria-label="Teilklasse bearbeiten"
                          >
                            <option value="">—</option>
                            {CLASS_SECTION_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
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
                        {formatRosterClassLabel(row.gradeLevel, row.classSection)}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <span>{row.lastName}</span>
                        {row.isGlobal ? (
                          <span className="school-roster-badge school-roster-badge--global" title="Zentraler Stammschüler (schulweit)">Zentral</span>
                        ) : (
                          <span className="school-roster-badge school-roster-badge--private" title="Persönlicher Schüler (nur für dich sichtbar)">Eigener Schüler</span>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>{row.firstName}</td>
                      <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="tab secondary"
                          style={{ marginRight: '0.35rem' }}
                          disabled={saving || importing || clearing || !canManage}
                          onClick={() => startEdit(row)}
                          title={!canManage ? 'Zentrale Schüler können nur von Administratoren bearbeitet werden.' : 'Schüler bearbeiten'}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={saving || importing || clearing || !canManage}
                          onClick={() => handleDelete(row)}
                          title={!canManage ? 'Zentrale Schüler können nur von Administratoren gelöscht werden.' : 'Schüler löschen'}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
