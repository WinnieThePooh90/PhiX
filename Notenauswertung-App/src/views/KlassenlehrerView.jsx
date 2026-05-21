import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';

function formatEuro(amount) {
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDueDate(iso) {
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

function isMoneyListFullyPaid(list) {
  const entries = list.entries || [];
  return entries.length > 0 && entries.every((e) => e.paid === true);
}

function MoneyListTabButton({ list, isActive, onSelect }) {
  const entries = list.entries || [];
  const paidCount = entries.filter((e) => e.paid).length;
  const totalCount = entries.length;
  const tabLabel = list.subject?.trim() || 'Geldliste';
  const allPaid = isMoneyListFullyPaid(list);

  return (
    <button
      type="button"
      role="tab"
      id={`money-list-tab-${list.id}`}
      aria-selected={isActive}
      aria-controls={`money-list-panel-${list.id}`}
      className={`tab klassenlehrer-money-tab-btn ${isActive ? 'active' : 'secondary'}${allPaid ? ' klassenlehrer-money-tab-btn--all-paid' : ''}`}
      onClick={() => onSelect(list.id)}
      title={tabLabel}
    >
      <span className="klassenlehrer-money-tab-title">{tabLabel}</span>
      <span className="klassenlehrer-money-tab-line">
        {paidCount} / {totalCount} bezahlt
      </span>
    </button>
  );
}

function MoneyListPanel({ list, updateMoneyListEntryPaid, onEdit, onDelete }) {
  const entries = list.entries || [];
  const paidCount = entries.filter((e) => e.paid).length;
  const totalCount = entries.length;
  const amountPerStudent = Number(list.amountPerStudent);
  const paidAmount = paidCount * amountPerStudent;
  const totalAmount = totalCount * amountPerStudent;
  const dueLabel = formatDueDate(list.dueDate);

  return (
    <div className="glass-panel program-view-panel klassenlehrer-money-panel">
      <div className="klassenlehrer-money-header">
        <div className="klassenlehrer-money-header-main">
          {(list.notes || Number.isFinite(amountPerStudent)) && (
            <p className="text-muted program-view-panel-text klassenlehrer-money-meta">
              {Number.isFinite(amountPerStudent) ? `${formatEuro(amountPerStudent)} pro Schüler` : null}
              {list.notes && Number.isFinite(amountPerStudent) ? ' · ' : null}
              {list.notes || null}
            </p>
          )}
        </div>
        <div className="klassenlehrer-money-header-stats">
          <div className="klassenlehrer-money-paid-due-row">
            <p className="program-view-panel-heading klassenlehrer-money-paid-count">
              {paidCount} / {totalCount} bezahlt
            </p>
            {dueLabel ? (
              <p className="program-view-panel-heading klassenlehrer-money-due-inline">
                Fällig: {dueLabel}
              </p>
            ) : null}
          </div>
          <p className="klassenlehrer-money-paid-sum">
            {formatEuro(paidAmount)} / {formatEuro(totalAmount)}
          </p>
        </div>
      </div>
      <div className="klassenlehrer-money-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-center klassenlehrer-num-col">Nr.</th>
              <th className="klassenlehrer-name-col">Name</th>
              <th className="klassenlehrer-name-col">Vorname</th>
              <th className="text-center klassenlehrer-paid-col">Bezahlt</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const name = `${row.lastName || ''}, ${row.firstName || ''}`.replace(/^, |, $/g, '').trim() || '—';
              const paid = row.paid === true;
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
                    className={`text-center klassenlehrer-paid-col gfs-gehalten-td ${paid ? 'gfs-gehalten-td--checked' : 'gfs-gehalten-td--unchecked'}`}
                    title={paid ? 'Bezahlt' : 'Noch nicht bezahlt'}
                  >
                    <label className="gfs-gehalten-label">
                      <input
                        type="checkbox"
                        className="gfs-gehalten-checkbox"
                        checked={paid}
                        onChange={(ev) => updateMoneyListEntryPaid(list.id, row.id, ev.target.checked)}
                        aria-label={`Bezahlt für ${name}`}
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

function MoneyListFormModal({
  open,
  mode,
  formSubject,
  setFormSubject,
  formAmount,
  setFormAmount,
  formNotes,
  setFormNotes,
  formDueDate,
  setFormDueDate,
  formError,
  setFormError,
  busy,
  subjectInputRef,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  const title = mode === 'edit' ? 'Geldliste bearbeiten' : 'Geldliste erstellen';
  const submitLabel = busy ? (mode === 'edit' ? 'Speichern…' : 'Erstellen…') : mode === 'edit' ? 'Speichern' : 'Erstellen';

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
        aria-labelledby="money-list-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="money-list-modal-title" className="program-user-mgmt-modal-title">
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
              placeholder="z. B. Klassenfahrt"
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label className="program-user-mgmt-label">
            Betrag pro Schüler (€)
            <input
              className="program-user-mgmt-input"
              type="text"
              inputMode="decimal"
              value={formAmount}
              onChange={(ev) => {
                setFormAmount(ev.target.value);
                if (formError) setFormError('');
              }}
              placeholder="z. B. 15,00"
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label className="program-user-mgmt-label">
            Fällig
            <input
              className="program-user-mgmt-input"
              type="date"
              value={formDueDate}
              onChange={(ev) => {
                setFormDueDate(ev.target.value);
                if (formError) setFormError('');
              }}
              disabled={busy}
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

export default function KlassenlehrerView() {
  const {
    config,
    moneyLists,
    createMoneyList,
    updateMoneyList,
    deleteMoneyList,
    updateMoneyListEntryPaid,
  } = useData();
  const subject = config?.subject ?? '—';
  const classLabel = config?.className || config?.class || '—';
  const year = config?.year ?? '—';

  const lists = moneyLists || [];
  const [activeListId, setActiveListId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingListId, setEditingListId] = useState(null);
  const [formSubject, setFormSubject] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
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
    setFormAmount('');
    setFormNotes('');
    setFormDueDate('');
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
    setFormAmount(String(list.amountPerStudent ?? ''));
    setFormNotes(list.notes ?? '');
    setFormDueDate(toInputDateValue(list.dueDate));
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
    const amountPerStudent = parseFloat(String(formAmount).replace(',', '.'));
    if (!Number.isFinite(amountPerStudent) || amountPerStudent < 0) {
      setFormError('Bitte einen gültigen Betrag pro Schüler eingeben.');
      return null;
    }
    return {
      subject: betreff,
      amountPerStudent,
      notes: formNotes.trim(),
      dueDate: formDueDate.trim() || null,
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
        const updated = await updateMoneyList(editingListId, payload);
        if (updated?.error) {
          setFormError(updated.error);
          return;
        }
        if (!updated?.id) {
          setFormError('Geldliste konnte nicht gespeichert werden.');
          return;
        }
        setModalOpen(false);
        return;
      }

      const created = await createMoneyList(payload);
      if (created?.error) {
        setFormError(created.error);
        return;
      }
      if (!created?.id) {
        setFormError('Geldliste konnte nicht erstellt werden.');
        return;
      }
      setActiveListId(created.id);
      setModalOpen(false);
    } catch {
      setFormError(
        modalMode === 'edit'
          ? 'Geldliste konnte nicht gespeichert werden.'
          : 'Geldliste konnte nicht erstellt werden.',
      );
    } finally {
      setModalBusy(false);
    }
  };

  const handleDelete = async (list) => {
    const label = list.subject?.trim() || 'Geldliste';
    const ok = window.confirm(`Geldliste „${label}“ wirklich löschen?`);
    if (!ok) return;

    const res = await deleteMoneyList(list.id);
    if (res?.error) {
      window.alert(res.error);
    }
  };

  return (
    <div className="view-generic-scroll program-view">
      <MoneyListFormModal
        open={modalOpen}
        mode={modalMode}
        formSubject={formSubject}
        setFormSubject={setFormSubject}
        formAmount={formAmount}
        setFormAmount={setFormAmount}
        formNotes={formNotes}
        setFormNotes={setFormNotes}
        formDueDate={formDueDate}
        setFormDueDate={setFormDueDate}
        formError={formError}
        setFormError={setFormError}
        busy={modalBusy}
        subjectInputRef={subjectInputRef}
        onClose={closeModal}
        onSubmit={handleFormSubmit}
      />
      <h2 className="program-view-title">Klassenlehrer</h2>
      <p className="text-muted program-view-intro">
        Zusätzliche Werkzeuge und Übersichten für die Klassenführung im aktuellen Fach.
      </p>

      <div className="glass-panel program-view-panel">
        <h3 className="program-view-panel-heading">Aktueller Kurs</h3>
        <p className="program-view-panel-text" style={{ margin: 0 }}>
          {subject} · Klasse {classLabel} · Schuljahr {year}
        </p>
      </div>

      <section className="klassenlehrer-geldlisten-section">
        <button type="button" className="tab secondary" onClick={openCreateModal}>
          + Geldliste erstellen
        </button>

        {lists.length > 0 ? (
          <>
            <div className="klassenlehrer-money-tabs" role="tablist" aria-label="Geldlisten">
              {lists.map((list) => (
                <MoneyListTabButton
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
                id={`money-list-panel-${activeList.id}`}
                aria-labelledby={`money-list-tab-${activeList.id}`}
                className="klassenlehrer-money-tabpanel"
              >
                <MoneyListPanel
                  list={activeList}
                  updateMoneyListEntryPaid={updateMoneyListEntryPaid}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
