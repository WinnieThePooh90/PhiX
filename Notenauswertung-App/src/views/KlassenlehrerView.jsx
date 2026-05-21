import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';

function formatEuro(amount) {
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

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

function listTabKey(type, id) {
  return `${type}:${id}`;
}

function tabDomId(key) {
  return `klassenlehrer-tab-${key.replace(':', '-')}`;
}

function buildMergedTabs(moneyLists, attendanceLists) {
  const tabs = [
    ...(moneyLists || []).map((list) => ({
      type: 'money',
      key: listTabKey('money', list.id),
      list,
      sortTime: list.createdAt ? new Date(list.createdAt).getTime() : list.id,
    })),
    ...(attendanceLists || []).map((list) => ({
      type: 'attendance',
      key: listTabKey('attendance', list.id),
      list,
      sortTime: list.createdAt ? new Date(list.createdAt).getTime() : list.id,
    })),
  ];
  return tabs.sort((a, b) => a.sortTime - b.sortTime || a.key.localeCompare(b.key));
}

function isMoneyListComplete(list) {
  const entries = list.entries || [];
  return entries.length > 0 && entries.every((e) => e.paid === true);
}

function isAttendanceListComplete(list) {
  const entries = list.entries || [];
  return entries.length > 0 && entries.every((e) => e.present === true);
}

function KlassenlehrerListTabButton({ tab, isActive, onSelect }) {
  const { type, list, key } = tab;
  const entries = list.entries || [];
  const doneCount = entries.filter((e) => (type === 'money' ? e.paid : e.present)).length;
  const totalCount = entries.length;
  const tabLabel =
    list.subject?.trim() || (type === 'money' ? 'Geldliste' : 'Anwesenheitsliste');
  const complete = type === 'money' ? isMoneyListComplete(list) : isAttendanceListComplete(list);
  const statusLine =
    type === 'money'
      ? `${doneCount} / ${totalCount} bezahlt`
      : `${doneCount} / ${totalCount} anwesend`;

  return (
    <button
      type="button"
      role="tab"
      id={tabDomId(key)}
      aria-selected={isActive}
      aria-controls={`${tabDomId(key)}-panel`}
      className={`tab klassenlehrer-money-tab-btn ${isActive ? 'active' : 'secondary'}${complete ? ' klassenlehrer-money-tab-btn--all-paid' : ''}`}
      onClick={() => onSelect(key)}
      title={tabLabel}
    >
      <span className="klassenlehrer-money-tab-title">{tabLabel}</span>
      <span className="klassenlehrer-money-tab-line">{statusLine}</span>
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
  const dueLabel = formatListDate(list.dueDate);

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

export default function KlassenlehrerView() {
  const {
    config,
    moneyLists,
    attendanceLists,
    createMoneyList,
    updateMoneyList,
    deleteMoneyList,
    updateMoneyListEntryPaid,
    createAttendanceList,
    updateAttendanceList,
    deleteAttendanceList,
    updateAttendanceListEntryPresent,
  } = useData();
  const subject = config?.subject ?? '—';
  const classLabel = config?.className || config?.class || '—';
  const year = config?.year ?? '—';

  const mergedTabs = useMemo(
    () => buildMergedTabs(moneyLists, attendanceLists),
    [moneyLists, attendanceLists],
  );

  const [activeTabKey, setActiveTabKey] = useState(null);

  const [moneyModalOpen, setMoneyModalOpen] = useState(false);
  const [moneyModalMode, setMoneyModalMode] = useState('create');
  const [moneyEditingId, setMoneyEditingId] = useState(null);
  const [moneyFormSubject, setMoneyFormSubject] = useState('');
  const [moneyFormAmount, setMoneyFormAmount] = useState('');
  const [moneyFormNotes, setMoneyFormNotes] = useState('');
  const [moneyFormDueDate, setMoneyFormDueDate] = useState('');
  const [moneyFormError, setMoneyFormError] = useState('');
  const [moneyModalBusy, setMoneyModalBusy] = useState(false);
  const moneySubjectInputRef = useRef(null);

  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceModalMode, setAttendanceModalMode] = useState('create');
  const [attendanceEditingId, setAttendanceEditingId] = useState(null);
  const [attendanceFormSubject, setAttendanceFormSubject] = useState('');
  const [attendanceFormSessionDate, setAttendanceFormSessionDate] = useState('');
  const [attendanceFormNotes, setAttendanceFormNotes] = useState('');
  const [attendanceFormError, setAttendanceFormError] = useState('');
  const [attendanceModalBusy, setAttendanceModalBusy] = useState(false);
  const attendanceSubjectInputRef = useRef(null);

  useEffect(() => {
    if (mergedTabs.length === 0) {
      setActiveTabKey(null);
      return;
    }
    setActiveTabKey((prev) => {
      if (prev != null && mergedTabs.some((t) => t.key === prev)) return prev;
      return mergedTabs[0].key;
    });
  }, [mergedTabs]);

  const activeTab = mergedTabs.find((t) => t.key === activeTabKey) ?? null;

  const resetMoneyForm = useCallback(() => {
    setMoneyFormSubject('');
    setMoneyFormAmount('');
    setMoneyFormNotes('');
    setMoneyFormDueDate('');
    setMoneyFormError('');
    setMoneyEditingId(null);
  }, []);

  const resetAttendanceForm = useCallback(() => {
    setAttendanceFormSubject('');
    setAttendanceFormSessionDate('');
    setAttendanceFormNotes('');
    setAttendanceFormError('');
    setAttendanceEditingId(null);
  }, []);

  const openCreateMoneyModal = useCallback(() => {
    resetMoneyForm();
    setMoneyModalMode('create');
    setMoneyModalOpen(true);
    requestAnimationFrame(() => moneySubjectInputRef.current?.focus());
  }, [resetMoneyForm]);

  const openCreateAttendanceModal = useCallback(() => {
    resetAttendanceForm();
    setAttendanceModalMode('create');
    setAttendanceModalOpen(true);
    requestAnimationFrame(() => attendanceSubjectInputRef.current?.focus());
  }, [resetAttendanceForm]);

  const openEditMoneyModal = useCallback(
    (list) => {
      setMoneyFormSubject(list.subject ?? '');
      setMoneyFormAmount(String(list.amountPerStudent ?? ''));
      setMoneyFormNotes(list.notes ?? '');
      setMoneyFormDueDate(toInputDateValue(list.dueDate));
      setMoneyFormError('');
      setMoneyEditingId(list.id);
      setMoneyModalMode('edit');
      setMoneyModalOpen(true);
      requestAnimationFrame(() => moneySubjectInputRef.current?.focus());
    },
    [],
  );

  const openEditAttendanceModal = useCallback((list) => {
    setAttendanceFormSubject(list.subject ?? '');
    setAttendanceFormSessionDate(toInputDateValue(list.sessionDate));
    setAttendanceFormNotes(list.notes ?? '');
    setAttendanceFormError('');
    setAttendanceEditingId(list.id);
    setAttendanceModalMode('edit');
    setAttendanceModalOpen(true);
    requestAnimationFrame(() => attendanceSubjectInputRef.current?.focus());
  }, []);

  const closeMoneyModal = useCallback(() => {
    if (moneyModalBusy) return;
    setMoneyModalOpen(false);
    setMoneyFormError('');
    setMoneyEditingId(null);
  }, [moneyModalBusy]);

  const closeAttendanceModal = useCallback(() => {
    if (attendanceModalBusy) return;
    setAttendanceModalOpen(false);
    setAttendanceFormError('');
    setAttendanceEditingId(null);
  }, [attendanceModalBusy]);

  const validateMoneyForm = () => {
    const betreff = moneyFormSubject.trim();
    if (!betreff) {
      setMoneyFormError('Bitte einen Betreff eingeben.');
      return null;
    }
    const amountPerStudent = parseFloat(String(moneyFormAmount).replace(',', '.'));
    if (!Number.isFinite(amountPerStudent) || amountPerStudent < 0) {
      setMoneyFormError('Bitte einen gültigen Betrag pro Schüler eingeben.');
      return null;
    }
    return {
      subject: betreff,
      amountPerStudent,
      notes: moneyFormNotes.trim(),
      dueDate: moneyFormDueDate.trim() || null,
    };
  };

  const handleMoneyFormSubmit = async (e) => {
    e.preventDefault();
    const payload = validateMoneyForm();
    if (!payload) return;

    setMoneyModalBusy(true);
    setMoneyFormError('');
    try {
      if (moneyModalMode === 'edit' && moneyEditingId != null) {
        const updated = await updateMoneyList(moneyEditingId, payload);
        if (updated?.error) {
          setMoneyFormError(updated.error);
          return;
        }
        if (!updated?.id) {
          setMoneyFormError('Geldliste konnte nicht gespeichert werden.');
          return;
        }
        setActiveTabKey(listTabKey('money', updated.id));
        setMoneyModalOpen(false);
        return;
      }

      const created = await createMoneyList(payload);
      if (created?.error) {
        setMoneyFormError(created.error);
        return;
      }
      if (!created?.id) {
        setMoneyFormError('Geldliste konnte nicht erstellt werden.');
        return;
      }
      setActiveTabKey(listTabKey('money', created.id));
      setMoneyModalOpen(false);
    } catch {
      setMoneyFormError(
        moneyModalMode === 'edit'
          ? 'Geldliste konnte nicht gespeichert werden.'
          : 'Geldliste konnte nicht erstellt werden.',
      );
    } finally {
      setMoneyModalBusy(false);
    }
  };

  const validateAttendanceForm = () => {
    const betreff = attendanceFormSubject.trim();
    if (!betreff) {
      setAttendanceFormError('Bitte einen Betreff eingeben.');
      return null;
    }
    const sessionDate = attendanceFormSessionDate.trim();
    if (!sessionDate) {
      setAttendanceFormError('Bitte ein Datum eingeben.');
      return null;
    }
    return {
      subject: betreff,
      sessionDate,
      notes: attendanceFormNotes.trim(),
    };
  };

  const handleAttendanceFormSubmit = async (e) => {
    e.preventDefault();
    const payload = validateAttendanceForm();
    if (!payload) return;

    setAttendanceModalBusy(true);
    setAttendanceFormError('');
    try {
      if (attendanceModalMode === 'edit' && attendanceEditingId != null) {
        const updated = await updateAttendanceList(attendanceEditingId, payload);
        if (updated?.error) {
          setAttendanceFormError(updated.error);
          return;
        }
        if (!updated?.id) {
          setAttendanceFormError('Anwesenheitsliste konnte nicht gespeichert werden.');
          return;
        }
        setActiveTabKey(listTabKey('attendance', updated.id));
        setAttendanceModalOpen(false);
        return;
      }

      const created = await createAttendanceList(payload);
      if (created?.error) {
        setAttendanceFormError(created.error);
        return;
      }
      if (!created?.id) {
        setAttendanceFormError('Anwesenheitsliste konnte nicht erstellt werden.');
        return;
      }
      setActiveTabKey(listTabKey('attendance', created.id));
      setAttendanceModalOpen(false);
    } catch {
      setAttendanceFormError(
        attendanceModalMode === 'edit'
          ? 'Anwesenheitsliste konnte nicht gespeichert werden.'
          : 'Anwesenheitsliste konnte nicht erstellt werden.',
      );
    } finally {
      setAttendanceModalBusy(false);
    }
  };

  const handleDeleteMoney = async (list) => {
    const label = list.subject?.trim() || 'Geldliste';
    const ok = window.confirm(`Geldliste „${label}“ wirklich löschen?`);
    if (!ok) return;
    const res = await deleteMoneyList(list.id);
    if (res?.error) window.alert(res.error);
  };

  const handleDeleteAttendance = async (list) => {
    const label = list.subject?.trim() || 'Anwesenheitsliste';
    const ok = window.confirm(`Anwesenheitsliste „${label}“ wirklich löschen?`);
    if (!ok) return;
    const res = await deleteAttendanceList(list.id);
    if (res?.error) window.alert(res.error);
  };

  return (
    <div className="view-generic-scroll program-view">
      <MoneyListFormModal
        open={moneyModalOpen}
        mode={moneyModalMode}
        formSubject={moneyFormSubject}
        setFormSubject={setMoneyFormSubject}
        formAmount={moneyFormAmount}
        setFormAmount={setMoneyFormAmount}
        formNotes={moneyFormNotes}
        setFormNotes={setMoneyFormNotes}
        formDueDate={moneyFormDueDate}
        setFormDueDate={setMoneyFormDueDate}
        formError={moneyFormError}
        setFormError={setMoneyFormError}
        busy={moneyModalBusy}
        subjectInputRef={moneySubjectInputRef}
        onClose={closeMoneyModal}
        onSubmit={handleMoneyFormSubmit}
      />
      <AttendanceListFormModal
        open={attendanceModalOpen}
        mode={attendanceModalMode}
        formSubject={attendanceFormSubject}
        setFormSubject={setAttendanceFormSubject}
        formSessionDate={attendanceFormSessionDate}
        setFormSessionDate={setAttendanceFormSessionDate}
        formNotes={attendanceFormNotes}
        setFormNotes={setAttendanceFormNotes}
        formError={attendanceFormError}
        setFormError={setAttendanceFormError}
        busy={attendanceModalBusy}
        subjectInputRef={attendanceSubjectInputRef}
        onClose={closeAttendanceModal}
        onSubmit={handleAttendanceFormSubmit}
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
        <div className="klassenlehrer-create-buttons">
          <button type="button" className="tab secondary" onClick={openCreateMoneyModal}>
            + Geldliste erstellen
          </button>
          <button type="button" className="tab secondary" onClick={openCreateAttendanceModal}>
            + Anwesenheitsliste erstellen
          </button>
        </div>

        {mergedTabs.length > 0 ? (
          <>
            <div className="klassenlehrer-money-tabs" role="tablist" aria-label="Listen">
              {mergedTabs.map((tab) => (
                <KlassenlehrerListTabButton
                  key={tab.key}
                  tab={tab}
                  isActive={tab.key === activeTabKey}
                  onSelect={setActiveTabKey}
                />
              ))}
            </div>

            {activeTab ? (
              <div
                role="tabpanel"
                id={`${tabDomId(activeTab.key)}-panel`}
                aria-labelledby={tabDomId(activeTab.key)}
                className="klassenlehrer-money-tabpanel"
              >
                {activeTab.type === 'money' ? (
                  <MoneyListPanel
                    list={activeTab.list}
                    updateMoneyListEntryPaid={updateMoneyListEntryPaid}
                    onEdit={openEditMoneyModal}
                    onDelete={handleDeleteMoney}
                  />
                ) : (
                  <AttendanceListPanel
                    list={activeTab.list}
                    updateAttendanceListEntryPresent={updateAttendanceListEntryPresent}
                    onEdit={openEditAttendanceModal}
                    onDelete={handleDeleteAttendance}
                  />
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
