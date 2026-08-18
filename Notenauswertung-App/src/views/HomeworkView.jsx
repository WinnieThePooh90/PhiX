import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, Trash2, Edit2, ArrowUpDown } from 'lucide-react';
import { useData } from '../store/DataContext';
import { useDialog } from '../components/PhixDialog';

function getTodayFormatted() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function HomeworkListFormModal({ open, mode, formTitle, setFormTitle, busy, error, onClose, onSubmit }) {
  if (!open) return null;
  const isEdit = mode === 'edit';
  const modalHeading = isEdit ? 'Hausaufgabenliste umbenennen' : 'Neue Hausaufgabenliste erstellen';
  const submitLabel = busy ? (isEdit ? 'Speichern…' : 'Erstellen…') : isEdit ? 'Speichern' : 'Erstellen';

  return createPortal(
    <div className="modal-overlay phix-dialog-overlay" onClick={onClose}>
      <div className="modal-card phix-dialog-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%' }}>
        <h2 className="phix-dialog-title" style={{ marginTop: 0, marginBottom: '1rem' }}>{modalHeading}</h2>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.4rem' }}>
              Titel der Liste
            </label>
            <input
              type="text"
              className="select-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.95rem', borderRadius: '0.375rem', border: '1px solid rgba(148,163,184,0.4)' }}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="z. B. Hausaufgabenliste"
              autoFocus
              disabled={busy}
            />
          </div>
          {error ? <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="tab secondary" onClick={onClose} disabled={busy}>
              Abbrechen
            </button>
            <button type="submit" className="tab active" disabled={busy}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function HomeworkView() {
  const {
    students,
    config,
    homeworkLists,
    createHomeworkList,
    updateHomeworkList,
    deleteHomeworkList,
    updateHomeworkListEntry,
    courseArchived,
  } = useData();

  const { showConfirm, showAlert } = useDialog();

  const [activeListId, setActiveListId] = useState(() => {
    return homeworkLists && homeworkLists.length > 0 ? homeworkLists[0].id : null;
  });

  const [sortMode, setSortMode] = useState('seatingPlan'); // 'seatingPlan' | 'alphabetical'

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [modalTitleInput, setModalTitleInput] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  // Ausgewählte/Aktive Hausaufgabenliste
  const activeList = useMemo(() => {
    if (!homeworkLists || homeworkLists.length === 0) return null;
    if (activeListId != null) {
      const found = homeworkLists.find((l) => l.id === activeListId);
      if (found) return found;
    }
    return homeworkLists[0];
  }, [homeworkLists, activeListId]);

  // Sitzplan-Sortierung vs Alphabetische Sortierung der Schüler
  const sortedStudents = useMemo(() => {
    const list = [...(students || [])];
    if (sortMode === 'alphabetical') {
      return list.sort((a, b) => {
        const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
        if (ln !== 0) return ln;
        return String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
      });
    }

    // Standard: 'seatingPlan' (R1:1, R1:2, R1:3, R2:1...)
    const seatingPlan = config?.seatingPlan;
    if (!seatingPlan || !seatingPlan.assignments) {
      // Fallback: alphabetisch falls kein Sitzplan vorhanden
      return list.sort((a, b) => {
        const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
        if (ln !== 0) return ln;
        return String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
      });
    }

    const rows = Number(seatingPlan.rows) || 8;
    const cols = Number(seatingPlan.cols) || 3;
    const assignments = seatingPlan.assignments || {};

    const studentMap = new Map(list.map((s) => [Number(s.id), s]));
    const ordered = [];
    const usedIds = new Set();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}_${c}`;
        const sId = assignments[key];
        if (sId != null && studentMap.has(Number(sId))) {
          const numId = Number(sId);
          if (!usedIds.has(numId)) {
            usedIds.add(numId);
            ordered.push(studentMap.get(numId));
          }
        }
      }
    }

    // Schüler ohne zugewiesenen Sitzplatz hinten anfügen
    const unseated = list
      .filter((s) => !usedIds.has(Number(s.id)))
      .sort((a, b) => {
        const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
        if (ln !== 0) return ln;
        return String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
      });

    return [...ordered, ...unseated];
  }, [students, sortMode, config?.seatingPlan]);

  // Eintrags-Map für schnellen Zugriff
  const entriesMap = useMemo(() => {
    if (!activeList || !activeList.entries) return new Map();
    const map = new Map();
    activeList.entries.forEach((e) => {
      map.set(Number(e.studentId), e);
    });
    return map;
  }, [activeList]);

  // Modal öffnen: Erstellen
  const openCreateModal = () => {
    const nextIndex = (homeworkLists?.length || 0) + 1;
    setModalTitleInput(nextIndex > 1 ? `Hausaufgabenliste ${nextIndex}` : 'Hausaufgabenliste');
    setModalMode('create');
    setModalError('');
    setModalOpen(true);
  };

  // Modal öffnen: Bearbeiten
  const openEditModal = () => {
    if (!activeList) return;
    setModalTitleInput(activeList.title || 'Hausaufgabenliste');
    setModalMode('edit');
    setModalError('');
    setModalOpen(true);
  };

  // Modal Absenden
  const handleModalSubmit = async (e) => {
    e.preventDefault();
    const titleClean = modalTitleInput.trim() || 'Hausaufgabenliste';
    setModalBusy(true);
    setModalError('');
    try {
      if (modalMode === 'edit' && activeList) {
        await updateHomeworkList(activeList.id, { title: titleClean });
      } else {
        const created = await createHomeworkList(titleClean);
        if (created?.id) {
          setActiveListId(created.id);
        }
      }
      setModalOpen(false);
    } catch {
      setModalError('Fehler beim Speichern der Hausaufgabenliste.');
    } finally {
      setModalBusy(false);
    }
  };

  // Liste löschen
  const handleDeleteList = async () => {
    if (!activeList) return;
    const ok = await showConfirm(`Hausaufgabenliste „${activeList.title}“ wirklich löschen?`, {
      title: 'Liste löschen',
      danger: true,
    });
    if (!ok) return;
    await deleteHomeworkList(activeList.id);
  };

  // Spalte hinzufügen
  const handleAddColumn = async () => {
    if (!activeList) return;
    const currentCols = activeList.columns || [];
    const nextNum = currentCols.length + 1;
    const newCol = {
      id: `col_${Date.now()}_${nextNum}`,
      label: `Stunde ${nextNum}`,
      date: null,
    };
    const updatedCols = [...currentCols, newCol];
    await updateHomeworkList(activeList.id, { columns: updatedCols });
  };

  // Spalte entfernen
  const handleRemoveColumn = async (colId) => {
    if (!activeList) return;
    const currentCols = activeList.columns || [];
    if (currentCols.length <= 1) {
      await showAlert('Eine Hausaufgabenliste muss mindestens 1 Spalte enthalten.', { title: 'Hinweis' });
      return;
    }
    const updatedCols = currentCols.filter((c) => c.id !== colId);
    await updateHomeworkList(activeList.id, { columns: updatedCols });
  };

  // Datum in Header einfügen / ändern
  const handleSetHeaderDate = async (colId) => {
    if (!activeList) return;
    const todayStr = getTodayFormatted();
    const updatedCols = (activeList.columns || []).map((col) => {
      if (col.id === colId) {
        return { ...col, date: todayStr };
      }
      return col;
    });
    await updateHomeworkList(activeList.id, { columns: updatedCols });
  };

  // Checkbox für Stunde umschalten
  const handleToggleCheck = (studentId, colId) => {
    if (courseArchived || !activeList) return;
    const entry = entriesMap.get(Number(studentId)) || { studentId, checks: {}, completed: false };
    const currentChecks = entry.checks || {};
    const nextChecks = { ...currentChecks, [colId]: !currentChecks[colId] };
    updateHomeworkListEntry(activeList.id, studentId, { checks: nextChecks });
  };

  // Checkbox für Erledigt umschalten
  const handleToggleCompleted = (studentId) => {
    if (courseArchived || !activeList) return;
    const entry = entriesMap.get(Number(studentId)) || { studentId, checks: {}, completed: false };
    const nextVal = !entry.completed;
    updateHomeworkListEntry(activeList.id, studentId, { completed: nextVal });
  };

  const columns = activeList?.columns || [{ id: 'col_1', label: 'Stunde 1', date: null }];

  return (
    <div className="view-generic-scroll program-view">
      <HomeworkListFormModal
        open={modalOpen}
        mode={modalMode}
        formTitle={modalTitleInput}
        setFormTitle={setModalTitleInput}
        busy={modalBusy}
        error={modalError}
        onClose={() => !modalBusy && setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      <h2 className="program-view-title">Hausaufgaben</h2>
      <p className="text-muted program-view-intro">
        Erstelle und verwalte Hausaufgabenlisten für die Klasse mit Kalenderdaten und Erledigt-Abhakung.
      </p>

      {/* Button & Tabs-Zeile */}
      <div className="glass-panel program-view-panel" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {!courseArchived ? (
              <button type="button" className="tab active" onClick={openCreateModal} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Plus size={16} style={{ marginRight: '0.35rem' }} /> Hausaufgabenliste erstellen
              </button>
            ) : null}

            {/* Sortierungswähler */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
              <ArrowUpDown size={15} className="text-muted" />
              <label htmlFor="homework-sort-select" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                Sortierung:
              </label>
              <select
                id="homework-sort-select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="select-input"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', borderRadius: '0.375rem' }}
              >
                <option value="seatingPlan">Nach Sitzplan (Standard)</option>
                <option value="alphabetical">Alphabetisch</option>
              </select>
            </div>
          </div>

          {activeList && !courseArchived ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="tab secondary" onClick={openEditModal} title="Liste umbenennen">
                <Edit2 size={15} style={{ marginRight: '0.3rem' }} /> Umbenennen
              </button>
              <button type="button" className="tab danger" onClick={handleDeleteList} title="Liste löschen">
                <Trash2 size={15} style={{ marginRight: '0.3rem' }} /> Löschen
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tabs der verfügbaren Hausaufgabenlisten */}
      {homeworkLists && homeworkLists.length > 0 ? (
        <div className="klassenlehrer-money-tabs" role="tablist" aria-label="Hausaufgabenlisten" style={{ marginBottom: '1rem' }}>
          {homeworkLists.map((list) => {
            const isActive = activeList && activeList.id === list.id;
            return (
              <button
                key={list.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`tab klassenlehrer-money-tab-btn ${isActive ? 'active' : 'secondary'}`}
                onClick={() => setActiveListId(list.id)}
              >
                <span className="klassenlehrer-money-tab-title">{list.title || 'Hausaufgabenliste'}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel text-center" style={{ padding: '2rem', color: '#64748b' }}>
          Noch keine Hausaufgabenliste vorhanden. Klicke oben auf „Hausaufgabenliste erstellen“.
        </div>
      )}

      {/* Tabellenansicht der aktiven Hausaufgabenliste */}
      {activeList ? (
        <div className="glass-panel program-view-panel" style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>{activeList.title}</h3>
            {!courseArchived ? (
              <button type="button" className="tab secondary" onClick={handleAddColumn} style={{ fontSize: '0.85rem' }}>
                <Plus size={14} style={{ marginRight: '0.25rem' }} /> Stunde hinzufügen
              </button>
            ) : null}
          </div>

          <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid rgba(148, 163, 184, 0.2)', width: '220px' }}>
                  Vorname / Name
                </th>
                {columns.map((col, idx) => (
                  <th
                    key={col.id}
                    style={{
                      textAlign: 'center',
                      padding: '0.75rem 0.5rem',
                      borderBottom: '2px solid rgba(148, 163, 184, 0.2)',
                      minWidth: '130px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span>{col.label || `Stunde ${idx + 1}`}</span>
                        {!courseArchived && columns.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(col.id)}
                            title="Spalte löschen"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, color: '#ef4444', padding: 0 }}
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </div>

                      {/* Kalenderbutton & Datumsanzeige */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 'normal' }}>
                        {col.date ? (
                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                            {col.date}
                          </span>
                        ) : null}
                        {!courseArchived ? (
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleSetHeaderDate(col.id)}
                            title="Aktuelles Datum einfügen"
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(148, 163, 184, 0.3)',
                              borderRadius: '0.25rem',
                              padding: '0.2rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <Calendar size={14} color="#3b82f6" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </th>
                ))}
                <th style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '2px solid rgba(148, 163, 184, 0.2)', width: '100px' }}>
                  Erledigt
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student) => {
                const entry = entriesMap.get(Number(student.id));
                const checks = entry?.checks || {};
                const isCompleted = entry?.completed === true;

                return (
                  <tr key={student.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500 }}>
                      {student.lastName ? `${student.firstName} ${student.lastName}` : student.firstName}
                    </td>

                    {/* Stunden Spalten */}
                    {columns.map((col) => {
                      const isChecked = Boolean(checks[col.id]);
                      return (
                        <td key={col.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={courseArchived}
                            onChange={() => handleToggleCheck(student.id, col.id)}
                            style={{ width: '1.1rem', height: '1.1rem', cursor: courseArchived ? 'default' : 'pointer' }}
                          />
                        </td>
                      );
                    })}

                    {/* Spalte Erledigt */}
                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        disabled={courseArchived}
                        onChange={() => handleToggleCompleted(student.id)}
                        style={{ width: '1.25rem', height: '1.25rem', accentColor: '#16a34a', cursor: courseArchived ? 'default' : 'pointer' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
