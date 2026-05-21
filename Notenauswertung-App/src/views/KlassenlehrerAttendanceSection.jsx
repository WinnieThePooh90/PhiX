import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';

function formatListDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function toInputDateValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isAttendanceListFullyPresent(list) {
  const entries = list.entries || [];
  return entries.length > 0 && entries.every((e) => e.present === true);
}

function AttendanceListTabButton({ list, isActive, onSelect }) {
  const entries = list.entries || [];
  const presentCount = entries.filter((e) => e.present).length;
  const totalCount = entries.length;
  const tabLabel = list.subject?.trim() || 'Anwesenheitsliste';
  const allPresent = isAttendanceListFullyPresent(list);

  return (
    <button
      type="button"
      role="tab"
      id={`attendance-list-tab-${list.id}`}
      aria-selected={isActive}
      aria-controls={`attendance-list-panel-${list.id}`}
      className={`tab klassenlehrer-money-tab-btn ${isActive ? 'active' : 'secondary'}${allPresent ? ' klassenlehrer-money-tab-btn--all-paid' : ''}`}
      onClick={() => onSelect(list.id)}
      title={tabLabel}
    >
      <span className="klassenlehrer-money-tab-title">{tabLabel}</span>
      <span className="klassenlehrer-money-tab-line">
        {presentCount} / {totalCount} anwesend
      </span>
    </button>
  );
}

function AttendanceListPanel({ list, updateAttendanceListEntryPresent, onEdit, onDelete }) {
  const entries = list.entries || [];
  const presentCount = entries.filter((e) => e.present).length;
  const totalCount = entries.length;
  const dateLabel = formatListDate(list.sessionDate);

  return (
    <div className="glass-panel program-view-panel klassenlehrer-money-panel">
      <div className="klassenlehrer-money-header">
        <div className="klassenlehrer-money-header-main">
          {list.notes ? (
            <p className="text-muted program-view-panel-text klassenlehrer-money-meta">{list.notes}</p>
          ) : null}
        </div>
        <div className="klassenlehrer-money-header-stats">
          <div className="klassenlehrer-money-paid-due-row">
            <p className="program-view-panel-heading klassenlehrer-money-paid-count">
              {presentCount} / {totalCount} anwesend
            </p>
            {dateLabel ? (
              <p className="program-view-panel-heading klassenlehrer-money-due-inline">
                Datum: {dateLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="klassenlehrer-money-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-center klassenlehrer-num-col">Nr.</th>
              <th className="klassenlehrer-name-col">Name</th>
              <th className="klassenlehrer-name-col">Vorname</th>
              <th className="text-center klassenlehrer-paid-col">Anwesend</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const name = `${row.lastName || ''}, ${row.firstName || ''}`.replace(/^, |, $/g, '').trim() || '—';
              const present = row.present === true;
              return (
                <tr key={row.id}>
                  <td className="text-center klassenlehrer-num-col">{row.studentNumber ?? '—'}</td>
                  <td className="klassenlehrer-name-col" title={row.lastName || undefined}>
                    {row.lastName || '—'}
                  </td>
                  <td className="klassenlehrer-name-col" title={row.firstName || undefined}>
                    {row.firstName || '—'}
                  </td>
                  <td
                    className={`text-center klassenlehrer-paid-col gfs-gehalten-td ${present ? 'gfs-gehalten-td--checked' : 'gfs-gehalten-td--unchecked'}`}
                    title={present ? 'Anwesend' : 'Nicht anwesend'}
                  >
                    <label className="gfs-gehalten-label">
                      <input
                        type="checkbox"
                        className="gfs-gehalten-checkbox"
                        checked={present}
                        onChange={(ev) =>
                          updateAttendanceListEntryPresent(list.id, row.id, ev.target.checked)
                        }
                        aria-label={`Anwesend für ${name}`}
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="klassenlehrer-money-panel-actions">
        <button type="button" className="tab secondary" onClick={() => onEdit(list)}>
          Bearbeiten
        </button>
        <button type="button" className="danger" onClick={() => onDelete(list)}>
          Löschen
        </button>
      </div>
    </div>
  );
}

function AttendanceListFormModal({
  open,
  mode,
  formSubject,
  setFormSubject,
  formSessionDate,
  setFormSessionDate,
  formNotes,
  setFormNotes,
  formError,
  setFormError,
  busy,
  subjectInputRef,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  const title = mode === 'edit' ? 'Anwesenheitsliste bearbeiten' : 'Anwesenheitsliste erstellen';
  const submitLabel =
    busy ? (mode === 'edit' ? 'Speichern…' : 'Erstellen…') : mode === 'edit' ? 'Speichern' : 'Erstellen';

  return createPortal(
    <div
      className="program-user-mgmt-modal-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="program-user-mgmt-modal-dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-list-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="attendance-list-modal-title" className="program-user-mgmt-modal-title">
          {title}
        </h2>
        <form className="program-user-mgmt-form" onSubmit={onSubmit}>
          <label className="program-user-mgmt-label">
            Betreff
            <input
              ref={subjectInputRef}
              className="program-user-mgmt-input"
              value={formSubject}
              onChange={(ev) => {
                setFormSubject(ev.target.value);
                if (formError) setFormError('');
              }}
              placeholder="z. B. Elternabend"
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label className="program-user-mgmt-label">
            Datum
            <input
              className="program-user-mgmt-input"
              type="date"
              value={formSessionDate}
              onChange={(ev) => {
                setFormSessionDate(ev.target.value);
                if (formError) setFormError('');
              }}
              disabled={busy}
              required
            />
          </label>
          <label className="program-user-mgmt-label">
            Notizen <span className="text-muted">(optional)</span>
            <textarea
              className="program-user-mgmt-input"
              rows={3}
              value={formNotes}
              onChange={(ev) => setFormNotes(ev.target.value)}
              placeholder="Zusätzliche Hinweise …"
              disabled={busy}
            />
          </label>
          {formError ? (
            <p className="program-user-mgmt-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="program-user-mgmt-modal-actions">
            <button type="submit" className="program-user-mgmt-submit" disabled={busy}>
              {submitLabel}
            </button>
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function KlassenlehrerAttendanceSection() {
  const {
    attendanceLists,
    createAttendanceList,
    updateAttendanceList,
    deleteAttendanceList,
    updateAttendanceListEntryPresent,
  } = useData();

  const lists = attendanceLists || [];
  const [activeListId, setActiveListId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingListId, setEditingListId] = useState(null);
  const [formSubject, setFormSubject] = useState('');
  const [formSessionDate, setFormSessionDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const subjectInputRef = useRef(null);

  useEffect(() => {
    if (lists.length === 0) {
      setActiveListId(null);
      return;
    }
    setActiveListId((prev) => {
      if (prev != null && lists.some((l) => l.id === prev)) return prev;
      return lists[0].id;
    });
  }, [lists]);

  const activeList = lists.find((l) => l.id === activeListId) ?? null;

  const resetForm = useCallback(() => {
    setFormSubject('');
    setFormSessionDate('');
    setFormNotes('');
    setFormError('');
    setEditingListId(null);
  }, []);

  const openCreateModal = useCallback(() => {
    resetForm();
    setModalMode('create');
    setModalOpen(true);
    requestAnimationFrame(() => subjectInputRef.current?.focus());
  }, [resetForm]);

  const openEditModal = useCallback((list) => {
    setFormSubject(list.subject ?? '');
    setFormSessionDate(toInputDateValue(list.sessionDate));
    setFormNotes(list.notes ?? '');
    setFormError('');
    setEditingListId(list.id);
    setModalMode('edit');
    setModalOpen(true);
    requestAnimationFrame(() => subjectInputRef.current?.focus());
  }, []);

  const closeModal = useCallback(() => {
    if (modalBusy) return;
    setModalOpen(false);
    setFormError('');
    setEditingListId(null);
  }, [modalBusy]);

  const validateForm = () => {
    const betreff = formSubject.trim();
    if (!betreff) {
      setFormError('Bitte einen Betreff eingeben.');
      return null;
    }
    const sessionDate = formSessionDate.trim();
    if (!sessionDate) {
      setFormError('Bitte ein Datum eingeben.');
      return null;
    }
    return {
      subject: betreff,
      sessionDate,
      notes: formNotes.trim(),
    };
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const payload = validateForm();
    if (!payload) return;

    setModalBusy(true);
    setFormError('');
    try {
      if (modalMode === 'edit' && editingListId != null) {
        const updated = await updateAttendanceList(editingListId, payload);
        if (updated?.error) {
          setFormError(updated.error);
          return;
        }
        if (!updated?.id) {
          setFormError('Anwesenheitsliste konnte nicht gespeichert werden.');
          return;
        }
        setModalOpen(false);
        return;
      }

      const created = await createAttendanceList(payload);
      if (created?.error) {
        setFormError(created.error);
        return;
      }
      if (!created?.id) {
        setFormError('Anwesenheitsliste konnte nicht erstellt werden.');
        return;
      }
      setActiveListId(created.id);
      setModalOpen(false);
    } catch {
      setFormError(
        modalMode === 'edit'
          ? 'Anwesenheitsliste konnte nicht gespeichert werden.'
          : 'Anwesenheitsliste konnte nicht erstellt werden.',
      );
    } finally {
      setModalBusy(false);
    }
  };

  const handleDelete = async (list) => {
    const label = list.subject?.trim() || 'Anwesenheitsliste';
    const ok = window.confirm(`Anwesenheitsliste „${label}“ wirklich löschen?`);
    if (!ok) return;

    const res = await deleteAttendanceList(list.id);
    if (res?.error) {
      window.alert(res.error);
    }
  };

  return (
    <section className="klassenlehrer-geldlisten-section klassenlehrer-attendance-section">
      <h3 className="program-view-panel-heading" style={{ margin: 0 }}>
        Anwesenheitslisten
      </h3>
      <button type="button" className="tab secondary" onClick={openCreateModal}>
        + Anwesenheitsliste erstellen
      </button>

      {lists.length > 0 ? (
        <>
          <div className="klassenlehrer-money-tabs" role="tablist" aria-label="Anwesenheitslisten">
            {lists.map((list) => (
              <AttendanceListTabButton
                key={list.id}
                list={list}
                isActive={list.id === activeListId}
                onSelect={setActiveListId}
              />
            ))}
          </div>

          {activeList ? (
            <div
              role="tabpanel"
              id={`attendance-list-panel-${activeList.id}`}
              aria-labelledby={`attendance-list-tab-${activeList.id}`}
              className="klassenlehrer-money-tabpanel"
            >
              <AttendanceListPanel
                list={activeList}
                updateAttendanceListEntryPresent={updateAttendanceListEntryPresent}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <AttendanceListFormModal
        open={modalOpen}
        mode={modalMode}
        formSubject={formSubject}
        setFormSubject={setFormSubject}
        formSessionDate={formSessionDate}
        setFormSessionDate={setFormSessionDate}
        formNotes={formNotes}
        setFormNotes={setFormNotes}
        formError={formError}
        setFormError={setFormError}
        busy={modalBusy}
        subjectInputRef={subjectInputRef}
        onClose={closeModal}
        onSubmit={handleFormSubmit}
      />
    </section>
  );
}
