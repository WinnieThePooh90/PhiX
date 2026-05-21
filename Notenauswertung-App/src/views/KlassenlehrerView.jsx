import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';

function formatEuro(amount) {
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function MoneyListPanel({ list, updateMoneyListEntryPaid }) {
  const entries = list.entries || [];
  const paidCount = entries.filter((e) => e.paid).length;
  const totalCount = entries.length;
  const amountPerStudent = Number(list.amountPerStudent);
  const paidAmount = paidCount * amountPerStudent;
  const totalAmount = totalCount * amountPerStudent;

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
          <p className="program-view-panel-heading klassenlehrer-money-paid-count">
            {paidCount} / {totalCount} bezahlt
          </p>
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
    </div>
  );
}

export default function KlassenlehrerView() {
  const { config, moneyLists, createMoneyList, updateMoneyListEntryPaid } = useData();
  const subject = config?.subject ?? '—';
  const classLabel = config?.className || config?.class || '—';
  const year = config?.year ?? '—';

  const lists = moneyLists || [];
  const [activeListId, setActiveListId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formSubject, setFormSubject] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
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

  const openModal = useCallback(() => {
    setFormSubject('');
    setFormAmount('');
    setFormNotes('');
    setFormError('');
    setModalOpen(true);
    requestAnimationFrame(() => subjectInputRef.current?.focus());
  }, []);

  const closeModal = useCallback(() => {
    if (creating) return;
    setModalOpen(false);
    setFormError('');
  }, [creating]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const betreff = formSubject.trim();
    if (!betreff) {
      setFormError('Bitte einen Betreff eingeben.');
      return;
    }
    const amountPerStudent = parseFloat(String(formAmount).replace(',', '.'));
    if (!Number.isFinite(amountPerStudent) || amountPerStudent < 0) {
      setFormError('Bitte einen gültigen Betrag pro Schüler eingeben.');
      return;
    }

    setCreating(true);
    setFormError('');
    try {
      const created = await createMoneyList({
        subject: betreff,
        amountPerStudent,
        notes: formNotes.trim(),
      });
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
      setFormError('Geldliste konnte nicht erstellt werden.');
    } finally {
      setCreating(false);
    }
  };

  const modal =
    modalOpen &&
    createPortal(
      <div
        className="program-user-mgmt-modal-backdrop"
        role="presentation"
        onMouseDown={(ev) => {
          if (ev.target === ev.currentTarget) closeModal();
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
            Geldliste erstellen
          </h2>
          <form className="program-user-mgmt-form" onSubmit={handleCreate}>
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
                disabled={creating}
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
                disabled={creating}
                autoComplete="off"
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
                disabled={creating}
              />
            </label>
            {formError ? (
              <p className="program-user-mgmt-error" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="program-user-mgmt-modal-actions">
              <button type="submit" className="program-user-mgmt-submit" disabled={creating}>
                {creating ? 'Erstellen…' : 'Erstellen'}
              </button>
              <button type="button" className="secondary" onClick={closeModal} disabled={creating}>
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="view-generic-scroll program-view">
      {modal}
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
        <button type="button" className="tab secondary" onClick={openModal}>
          + Geldliste erstellen
        </button>

        {lists.length > 0 ? (
          <>
            <div
              className="klassenlehrer-money-tabs"
              role="tablist"
              aria-label="Geldlisten"
            >
              {lists.map((list) => {
                const tabLabel = list.subject?.trim() || 'Geldliste';
                const isActive = list.id === activeListId;
                return (
                  <button
                    key={list.id}
                    type="button"
                    role="tab"
                    id={`money-list-tab-${list.id}`}
                    aria-selected={isActive}
                    aria-controls={`money-list-panel-${list.id}`}
                    className={`tab ${isActive ? 'active' : 'secondary'}`}
                    onClick={() => setActiveListId(list.id)}
                    title={tabLabel}
                  >
                    {tabLabel}
                  </button>
                );
              })}
            </div>

            {activeList ? (
              <div
                role="tabpanel"
                id={`money-list-panel-${activeList.id}`}
                aria-labelledby={`money-list-tab-${activeList.id}`}
                className="klassenlehrer-money-tabpanel"
              >
                <MoneyListPanel list={activeList} updateMoneyListEntryPaid={updateMoneyListEntryPaid} />
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
