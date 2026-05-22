import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  canAddExternalPersons,
  ExternalPersonAddBlock,
  ListFormExternalCheckboxes,
  ListPanelFooter,
  RemarkEntryField,
} from '../components/KlassenlehrerListShared';
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

const LIST_DEFAULT_LABELS = {
  money: 'Geldliste',
  attendance: 'Anwesenheitsliste',
  collection: 'Sammelliste',
  notes: 'Notizenliste',
};

function entryDone(entry, type) {
  if (type === 'money') return entry.paid === true;
  if (type === 'attendance') return entry.present === true;
  if (type === 'notes') return Boolean(String(entry.remark ?? '').trim());
  return entry.collected === true;
}

function isListComplete(list, type) {
  const entries = list.entries || [];
  return entries.length > 0 && entries.every((e) => entryDone(e, type));
}

function listStatusLine(type, doneCount, totalCount) {
  if (type === 'money') return `${doneCount} / ${totalCount} bezahlt`;
  if (type === 'attendance') return `${doneCount} / ${totalCount} anwesend`;
  if (type === 'notes') return `${doneCount} / ${totalCount} mit Bemerkung`;
  return `${doneCount} / ${totalCount} eingesammelt`;
}

function buildMergedTabs(moneyLists, attendanceLists, collectionLists, notesLists) {
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
    ...(collectionLists || []).map((list) => ({
      type: 'collection',
      key: listTabKey('collection', list.id),
      list,
      sortTime: list.createdAt ? new Date(list.createdAt).getTime() : list.id,
    })),
    ...(notesLists || []).map((list) => ({
      type: 'notes',
      key: listTabKey('notes', list.id),
      list,
      sortTime: list.createdAt ? new Date(list.createdAt).getTime() : list.id,
    })),
  ];
  return tabs.sort((a, b) => a.sortTime - b.sortTime || a.key.localeCompare(b.key));
}

function KlassenlehrerListTabButton({ tab, isActive, onSelect }) {
  const { type, list, key } = tab;
  const entries = list.entries || [];
  const doneCount = entries.filter((e) => entryDone(e, type)).length;
  const totalCount = entries.length;
  const tabLabel = list.subject?.trim() || LIST_DEFAULT_LABELS[type] || 'Liste';
  const complete = isListComplete(list, type);
  const statusLine = listStatusLine(type, doneCount, totalCount);

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

function MoneyListPanel({ list, updateMoneyListEntryPaid, onAddExternal, onRemoveExternalEntry, onEdit, onDelete }) {
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
              const isExternal = row.isExternal === true;
              return (
                <tr key={row.id}>
                  <td className="text-center klassenlehrer-num-col">
                    {isExternal ? (
                      <>
                        ext.
                        <button
                          type="button"
                          className="tab secondary klassenlehrer-external-row-remove"
                          title="Externe Person entfernen"
                          onClick={() => onRemoveExternalEntry(row.id)}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      row.studentNumber ?? '—'
                    )}
                  </td>
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
      {canAddExternalPersons(list) ? <ExternalPersonAddBlock onAdd={onAddExternal} /> : null}
      <ListPanelFooter list={list} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function AttendanceListPanel({ list, updateAttendanceListEntryPresent, onAddExternal, onRemoveExternalEntry, onEdit, onDelete }) {
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
              const isExternal = row.isExternal === true;
              return (
                <tr key={row.id}>
                  <td className="text-center klassenlehrer-num-col">
                    {isExternal ? (
                      <>
                        ext.
                        <button
                          type="button"
                          className="tab secondary klassenlehrer-external-row-remove"
                          title="Externe Person entfernen"
                          onClick={() => onRemoveExternalEntry(row.id)}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      row.studentNumber ?? '—'
                    )}
                  </td>
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
      {canAddExternalPersons(list) ? <ExternalPersonAddBlock onAdd={onAddExternal} /> : null}
      <ListPanelFooter list={list} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function CollectionListPanel({ list, updateCollectionListEntryCollected, onAddExternal, onRemoveExternalEntry, onEdit, onDelete }) {
  const entries = list.entries || [];
  const collectedCount = entries.filter((e) => e.collected).length;
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
              {collectedCount} / {totalCount} eingesammelt
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
              <th className="text-center klassenlehrer-paid-col">Eingesammelt</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const name = `${row.lastName || ''}, ${row.firstName || ''}`.replace(/^, |, $/g, '').trim() || '—';
              const collected = row.collected === true;
              const isExternal = row.isExternal === true;
              return (
                <tr key={row.id}>
                  <td className="text-center klassenlehrer-num-col">
                    {isExternal ? (
                      <>
                        ext.
                        <button
                          type="button"
                          className="tab secondary klassenlehrer-external-row-remove"
                          title="Externe Person entfernen"
                          onClick={() => onRemoveExternalEntry(row.id)}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      row.studentNumber ?? '—'
                    )}
                  </td>
                  <td className="klassenlehrer-name-col" title={row.lastName || undefined}>
                    {row.lastName || '—'}
                  </td>
                  <td className="klassenlehrer-name-col" title={row.firstName || undefined}>
                    {row.firstName || '—'}
                  </td>
                  <td
                    className={`text-center klassenlehrer-paid-col gfs-gehalten-td ${collected ? 'gfs-gehalten-td--checked' : 'gfs-gehalten-td--unchecked'}`}
                    title={collected ? 'Eingesammelt' : 'Noch nicht eingesammelt'}
                  >
                    <label className="gfs-gehalten-label">
                      <input
                        type="checkbox"
                        className="gfs-gehalten-checkbox"
                        checked={collected}
                        onChange={(ev) =>
                          updateCollectionListEntryCollected(list.id, row.id, ev.target.checked)
                        }
                        aria-label={`Eingesammelt für ${name}`}
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canAddExternalPersons(list) ? <ExternalPersonAddBlock onAdd={onAddExternal} /> : null}
      <ListPanelFooter list={list} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function NotesListPanel({
  list,
  updateNotesListEntryRemark,
  onAddExternal,
  onRemoveExternalEntry,
  onEdit,
  onDelete,
}) {
  const entries = list.entries || [];
  const remarkCount = entries.filter((e) => Boolean(String(e.remark ?? '').trim())).length;
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
              {remarkCount} / {totalCount} mit Bemerkung
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
        <table className="data-table klassenlehrer-notes-table">
          <thead>
            <tr>
              <th className="text-center klassenlehrer-num-col">Nr.</th>
              <th className="klassenlehrer-name-col">Name</th>
              <th className="klassenlehrer-name-col">Vorname</th>
              <th className="klassenlehrer-remark-col">Bemerkungen</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const name = `${row.lastName || ''}, ${row.firstName || ''}`.replace(/^, |, $/g, '').trim() || '—';
              const isExternal = row.isExternal === true;
              return (
                <tr key={row.id}>
                  <td className="text-center klassenlehrer-num-col">
                    {isExternal ? (
                      <>
                        ext.
                        <button
                          type="button"
                          className="tab secondary klassenlehrer-external-row-remove"
                          title="Externe Person entfernen"
                          onClick={() => onRemoveExternalEntry(row.id)}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      row.studentNumber ?? '—'
                    )}
                  </td>
                  <td className="klassenlehrer-name-col" title={row.lastName || undefined}>
                    {row.lastName || '—'}
                  </td>
                  <td className="klassenlehrer-name-col" title={row.firstName || undefined}>
                    {row.firstName || '—'}
                  </td>
                  <td className="klassenlehrer-remark-cell klassenlehrer-remark-col">
                    <RemarkEntryField
                      value={row.remark ?? ''}
                      onCommit={(remark) => updateNotesListEntryRemark(list.id, row.id, remark)}
                      ariaLabel={`Bemerkung für ${name}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canAddExternalPersons(list) ? <ExternalPersonAddBlock onAdd={onAddExternal} /> : null}
      <ListPanelFooter list={list} onEdit={onEdit} onDelete={onDelete} />
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
  formIncludeExternal,
  setFormIncludeExternal,
  formExternalOnly,
  setFormExternalOnly,
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
            Fällig <span className="text-muted">(optional)</span>
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
            <ListFormExternalCheckboxes
              includeExternal={formIncludeExternal}
              setIncludeExternal={setFormIncludeExternal}
              externalOnly={formExternalOnly}
              setExternalOnly={setFormExternalOnly}
              disabled={busy}
            />
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
  formIncludeExternal,
  setFormIncludeExternal,
  formExternalOnly,
  setFormExternalOnly,
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
            Datum <span className="text-muted">(optional)</span>
            <input
              className="program-user-mgmt-input"
              type="date"
              value={formSessionDate}
              onChange={(ev) => {
                setFormSessionDate(ev.target.value);
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
          <ListFormExternalCheckboxes
            includeExternal={formIncludeExternal}
            setIncludeExternal={setFormIncludeExternal}
            externalOnly={formExternalOnly}
            setExternalOnly={setFormExternalOnly}
            disabled={busy}
          />
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

function CollectionListFormModal({
  open,
  mode,
  formSubject,
  setFormSubject,
  formSessionDate,
  setFormSessionDate,
  formNotes,
  setFormNotes,
  formIncludeExternal,
  setFormIncludeExternal,
  formExternalOnly,
  setFormExternalOnly,
  formError,
  setFormError,
  busy,
  subjectInputRef,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  const title = mode === 'edit' ? 'Sammelliste bearbeiten' : 'Sammelliste erstellen';
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
        aria-labelledby="collection-list-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="collection-list-modal-title" className="program-user-mgmt-modal-title">
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
              placeholder="z. B. Unterschriftenliste"
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label className="program-user-mgmt-label">
            Datum <span className="text-muted">(optional)</span>
            <input
              className="program-user-mgmt-input"
              type="date"
              value={formSessionDate}
              onChange={(ev) => {
                setFormSessionDate(ev.target.value);
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
          <ListFormExternalCheckboxes
            includeExternal={formIncludeExternal}
            setIncludeExternal={setFormIncludeExternal}
            externalOnly={formExternalOnly}
            setExternalOnly={setFormExternalOnly}
            disabled={busy}
          />
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

function NotesListFormModal({
  open,
  mode,
  formSubject,
  setFormSubject,
  formSessionDate,
  setFormSessionDate,
  formNotes,
  setFormNotes,
  formIncludeExternal,
  setFormIncludeExternal,
  formExternalOnly,
  setFormExternalOnly,
  formError,
  setFormError,
  busy,
  subjectInputRef,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  const title = mode === 'edit' ? 'Notizenliste bearbeiten' : 'Notizenliste erstellen';
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
        aria-labelledby="notes-list-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="notes-list-modal-title" className="program-user-mgmt-modal-title">
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
              placeholder="z. B. Elterngespräche"
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label className="program-user-mgmt-label">
            Datum <span className="text-muted">(optional)</span>
            <input
              className="program-user-mgmt-input"
              type="date"
              value={formSessionDate}
              onChange={(ev) => {
                setFormSessionDate(ev.target.value);
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
              placeholder="Zusätzliche Hinweise zur Liste …"
              disabled={busy}
            />
          </label>
          <ListFormExternalCheckboxes
            includeExternal={formIncludeExternal}
            setIncludeExternal={setFormIncludeExternal}
            externalOnly={formExternalOnly}
            setExternalOnly={setFormExternalOnly}
            disabled={busy}
          />
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
    moneyLists,
    attendanceLists,
    collectionLists,
    notesLists,
    createMoneyList,
    updateMoneyList,
    deleteMoneyList,
    updateMoneyListEntryPaid,
    addMoneyListExternalEntry,
    removeMoneyListEntry,
    createAttendanceList,
    updateAttendanceList,
    deleteAttendanceList,
    updateAttendanceListEntryPresent,
    addAttendanceListExternalEntry,
    removeAttendanceListEntry,
    createCollectionList,
    updateCollectionList,
    deleteCollectionList,
    updateCollectionListEntryCollected,
    addCollectionListExternalEntry,
    removeCollectionListEntry,
    createNotesList,
    updateNotesList,
    deleteNotesList,
    updateNotesListEntryRemark,
    addNotesListExternalEntry,
    removeNotesListEntry,
  } = useData();

  const mergedTabs = useMemo(
    () => buildMergedTabs(moneyLists, attendanceLists, collectionLists, notesLists),
    [moneyLists, attendanceLists, collectionLists, notesLists],
  );

  const [activeTabKey, setActiveTabKey] = useState(null);

  const [moneyModalOpen, setMoneyModalOpen] = useState(false);
  const [moneyModalMode, setMoneyModalMode] = useState('create');
  const [moneyEditingId, setMoneyEditingId] = useState(null);
  const [moneyFormSubject, setMoneyFormSubject] = useState('');
  const [moneyFormAmount, setMoneyFormAmount] = useState('');
  const [moneyFormNotes, setMoneyFormNotes] = useState('');
  const [moneyFormDueDate, setMoneyFormDueDate] = useState('');
  const [moneyFormIncludeExternal, setMoneyFormIncludeExternal] = useState(false);
  const [moneyFormExternalOnly, setMoneyFormExternalOnly] = useState(false);
  const [moneyFormError, setMoneyFormError] = useState('');
  const [moneyModalBusy, setMoneyModalBusy] = useState(false);
  const moneySubjectInputRef = useRef(null);

  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceModalMode, setAttendanceModalMode] = useState('create');
  const [attendanceEditingId, setAttendanceEditingId] = useState(null);
  const [attendanceFormSubject, setAttendanceFormSubject] = useState('');
  const [attendanceFormSessionDate, setAttendanceFormSessionDate] = useState('');
  const [attendanceFormNotes, setAttendanceFormNotes] = useState('');
  const [attendanceFormIncludeExternal, setAttendanceFormIncludeExternal] = useState(false);
  const [attendanceFormExternalOnly, setAttendanceFormExternalOnly] = useState(false);
  const [attendanceFormError, setAttendanceFormError] = useState('');
  const [attendanceModalBusy, setAttendanceModalBusy] = useState(false);
  const attendanceSubjectInputRef = useRef(null);

  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionModalMode, setCollectionModalMode] = useState('create');
  const [collectionEditingId, setCollectionEditingId] = useState(null);
  const [collectionFormSubject, setCollectionFormSubject] = useState('');
  const [collectionFormSessionDate, setCollectionFormSessionDate] = useState('');
  const [collectionFormNotes, setCollectionFormNotes] = useState('');
  const [collectionFormIncludeExternal, setCollectionFormIncludeExternal] = useState(false);
  const [collectionFormExternalOnly, setCollectionFormExternalOnly] = useState(false);
  const [collectionFormError, setCollectionFormError] = useState('');
  const [collectionModalBusy, setCollectionModalBusy] = useState(false);
  const collectionSubjectInputRef = useRef(null);

  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesModalMode, setNotesModalMode] = useState('create');
  const [notesEditingId, setNotesEditingId] = useState(null);
  const [notesFormSubject, setNotesFormSubject] = useState('');
  const [notesFormSessionDate, setNotesFormSessionDate] = useState('');
  const [notesFormNotes, setNotesFormNotes] = useState('');
  const [notesFormIncludeExternal, setNotesFormIncludeExternal] = useState(false);
  const [notesFormExternalOnly, setNotesFormExternalOnly] = useState(false);
  const [notesFormError, setNotesFormError] = useState('');
  const [notesModalBusy, setNotesModalBusy] = useState(false);
  const notesSubjectInputRef = useRef(null);

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
    setMoneyFormIncludeExternal(false);
    setMoneyFormExternalOnly(false);
    setMoneyFormError('');
    setMoneyEditingId(null);
  }, []);

  const resetAttendanceForm = useCallback(() => {
    setAttendanceFormSubject('');
    setAttendanceFormSessionDate('');
    setAttendanceFormNotes('');
    setAttendanceFormIncludeExternal(false);
    setAttendanceFormExternalOnly(false);
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

  const resetCollectionForm = useCallback(() => {
    setCollectionFormSubject('');
    setCollectionFormSessionDate('');
    setCollectionFormNotes('');
    setCollectionFormIncludeExternal(false);
    setCollectionFormExternalOnly(false);
    setCollectionFormError('');
    setCollectionEditingId(null);
  }, []);

  const openCreateCollectionModal = useCallback(() => {
    resetCollectionForm();
    setCollectionModalMode('create');
    setCollectionModalOpen(true);
    requestAnimationFrame(() => collectionSubjectInputRef.current?.focus());
  }, [resetCollectionForm]);

  const resetNotesForm = useCallback(() => {
    setNotesFormSubject('');
    setNotesFormSessionDate('');
    setNotesFormNotes('');
    setNotesFormIncludeExternal(false);
    setNotesFormExternalOnly(false);
    setNotesFormError('');
    setNotesEditingId(null);
  }, []);

  const openCreateNotesModal = useCallback(() => {
    resetNotesForm();
    setNotesModalMode('create');
    setNotesModalOpen(true);
    requestAnimationFrame(() => notesSubjectInputRef.current?.focus());
  }, [resetNotesForm]);

  const openEditMoneyModal = useCallback(
    (list) => {
      setMoneyFormSubject(list.subject ?? '');
      setMoneyFormAmount(String(list.amountPerStudent ?? ''));
      setMoneyFormNotes(list.notes ?? '');
      setMoneyFormDueDate(toInputDateValue(list.dueDate));
      setMoneyFormIncludeExternal(Boolean(list.includeExternal));
      setMoneyFormExternalOnly(Boolean(list.externalOnly));
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
    setAttendanceFormIncludeExternal(Boolean(list.includeExternal));
    setAttendanceFormExternalOnly(Boolean(list.externalOnly));
    setAttendanceFormError('');
    setAttendanceEditingId(list.id);
    setAttendanceModalMode('edit');
    setAttendanceModalOpen(true);
    requestAnimationFrame(() => attendanceSubjectInputRef.current?.focus());
  }, []);

  const openEditCollectionModal = useCallback((list) => {
    setCollectionFormSubject(list.subject ?? '');
    setCollectionFormSessionDate(toInputDateValue(list.sessionDate));
    setCollectionFormNotes(list.notes ?? '');
    setCollectionFormIncludeExternal(Boolean(list.includeExternal));
    setCollectionFormExternalOnly(Boolean(list.externalOnly));
    setCollectionFormError('');
    setCollectionEditingId(list.id);
    setCollectionModalMode('edit');
    setCollectionModalOpen(true);
    requestAnimationFrame(() => collectionSubjectInputRef.current?.focus());
  }, []);

  const openEditNotesModal = useCallback((list) => {
    setNotesFormSubject(list.subject ?? '');
    setNotesFormSessionDate(toInputDateValue(list.sessionDate));
    setNotesFormNotes(list.notes ?? '');
    setNotesFormIncludeExternal(Boolean(list.includeExternal));
    setNotesFormExternalOnly(Boolean(list.externalOnly));
    setNotesFormError('');
    setNotesEditingId(list.id);
    setNotesModalMode('edit');
    setNotesModalOpen(true);
    requestAnimationFrame(() => notesSubjectInputRef.current?.focus());
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

  const closeCollectionModal = useCallback(() => {
    if (collectionModalBusy) return;
    setCollectionModalOpen(false);
    setCollectionFormError('');
    setCollectionEditingId(null);
  }, [collectionModalBusy]);

  const closeNotesModal = useCallback(() => {
    if (notesModalBusy) return;
    setNotesModalOpen(false);
    setNotesFormError('');
    setNotesEditingId(null);
  }, [notesModalBusy]);

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
      includeExternal: moneyFormIncludeExternal,
      externalOnly: moneyFormExternalOnly,
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
    return {
      subject: betreff,
      sessionDate: attendanceFormSessionDate.trim() || null,
      notes: attendanceFormNotes.trim(),
      includeExternal: attendanceFormIncludeExternal,
      externalOnly: attendanceFormExternalOnly,
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

  const validateCollectionForm = () => {
    const betreff = collectionFormSubject.trim();
    if (!betreff) {
      setCollectionFormError('Bitte einen Betreff eingeben.');
      return null;
    }
    return {
      subject: betreff,
      sessionDate: collectionFormSessionDate.trim() || null,
      notes: collectionFormNotes.trim(),
      includeExternal: collectionFormIncludeExternal,
      externalOnly: collectionFormExternalOnly,
    };
  };

  const handleCollectionFormSubmit = async (e) => {
    e.preventDefault();
    const payload = validateCollectionForm();
    if (!payload) return;

    setCollectionModalBusy(true);
    setCollectionFormError('');
    try {
      if (collectionModalMode === 'edit' && collectionEditingId != null) {
        const updated = await updateCollectionList(collectionEditingId, payload);
        if (updated?.error) {
          setCollectionFormError(updated.error);
          return;
        }
        if (!updated?.id) {
          setCollectionFormError('Sammelliste konnte nicht gespeichert werden.');
          return;
        }
        setActiveTabKey(listTabKey('collection', updated.id));
        setCollectionModalOpen(false);
        return;
      }

      const created = await createCollectionList(payload);
      if (created?.error) {
        setCollectionFormError(created.error);
        return;
      }
      if (!created?.id) {
        setCollectionFormError('Sammelliste konnte nicht erstellt werden.');
        return;
      }
      setActiveTabKey(listTabKey('collection', created.id));
      setCollectionModalOpen(false);
    } catch {
      setCollectionFormError(
        collectionModalMode === 'edit'
          ? 'Sammelliste konnte nicht gespeichert werden.'
          : 'Sammelliste konnte nicht erstellt werden.',
      );
    } finally {
      setCollectionModalBusy(false);
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

  const handleDeleteCollection = async (list) => {
    const label = list.subject?.trim() || 'Sammelliste';
    const ok = window.confirm(`Sammelliste „${label}“ wirklich löschen?`);
    if (!ok) return;
    const res = await deleteCollectionList(list.id);
    if (res?.error) window.alert(res.error);
  };

  const validateNotesForm = () => {
    const betreff = notesFormSubject.trim();
    if (!betreff) {
      setNotesFormError('Bitte einen Betreff eingeben.');
      return null;
    }
    return {
      subject: betreff,
      sessionDate: notesFormSessionDate.trim() || null,
      notes: notesFormNotes.trim(),
      includeExternal: notesFormIncludeExternal,
      externalOnly: notesFormExternalOnly,
    };
  };

  const handleNotesFormSubmit = async (e) => {
    e.preventDefault();
    const payload = validateNotesForm();
    if (!payload) return;

    setNotesModalBusy(true);
    setNotesFormError('');
    try {
      if (notesModalMode === 'edit' && notesEditingId != null) {
        const updated = await updateNotesList(notesEditingId, payload);
        if (updated?.error) {
          setNotesFormError(updated.error);
          return;
        }
        if (!updated?.id) {
          setNotesFormError('Notizenliste konnte nicht gespeichert werden.');
          return;
        }
        setActiveTabKey(listTabKey('notes', updated.id));
        setNotesModalOpen(false);
        return;
      }

      const created = await createNotesList(payload);
      if (created?.error) {
        setNotesFormError(created.error);
        return;
      }
      if (!created?.id) {
        setNotesFormError('Notizenliste konnte nicht erstellt werden.');
        return;
      }
      setActiveTabKey(listTabKey('notes', created.id));
      setNotesModalOpen(false);
    } catch {
      setNotesFormError(
        notesModalMode === 'edit'
          ? 'Notizenliste konnte nicht gespeichert werden.'
          : 'Notizenliste konnte nicht erstellt werden.',
      );
    } finally {
      setNotesModalBusy(false);
    }
  };

  const handleDeleteNotes = async (list) => {
    const label = list.subject?.trim() || 'Notizenliste';
    const ok = window.confirm(`Notizenliste „${label}“ wirklich löschen?`);
    if (!ok) return;
    const res = await deleteNotesList(list.id);
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
        formIncludeExternal={moneyFormIncludeExternal}
        setFormIncludeExternal={setMoneyFormIncludeExternal}
        formExternalOnly={moneyFormExternalOnly}
        setFormExternalOnly={setMoneyFormExternalOnly}
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
        formIncludeExternal={attendanceFormIncludeExternal}
        setFormIncludeExternal={setAttendanceFormIncludeExternal}
        formExternalOnly={attendanceFormExternalOnly}
        setFormExternalOnly={setAttendanceFormExternalOnly}
        formError={attendanceFormError}
        setFormError={setAttendanceFormError}
        busy={attendanceModalBusy}
        subjectInputRef={attendanceSubjectInputRef}
        onClose={closeAttendanceModal}
        onSubmit={handleAttendanceFormSubmit}
      />
      <CollectionListFormModal
        open={collectionModalOpen}
        mode={collectionModalMode}
        formSubject={collectionFormSubject}
        setFormSubject={setCollectionFormSubject}
        formSessionDate={collectionFormSessionDate}
        setFormSessionDate={setCollectionFormSessionDate}
        formNotes={collectionFormNotes}
        setFormNotes={setCollectionFormNotes}
        formIncludeExternal={collectionFormIncludeExternal}
        setFormIncludeExternal={setCollectionFormIncludeExternal}
        formExternalOnly={collectionFormExternalOnly}
        setFormExternalOnly={setCollectionFormExternalOnly}
        formError={collectionFormError}
        setFormError={setCollectionFormError}
        busy={collectionModalBusy}
        subjectInputRef={collectionSubjectInputRef}
        onClose={closeCollectionModal}
        onSubmit={handleCollectionFormSubmit}
      />
      <NotesListFormModal
        open={notesModalOpen}
        mode={notesModalMode}
        formSubject={notesFormSubject}
        setFormSubject={setNotesFormSubject}
        formSessionDate={notesFormSessionDate}
        setFormSessionDate={setNotesFormSessionDate}
        formNotes={notesFormNotes}
        setFormNotes={setNotesFormNotes}
        formIncludeExternal={notesFormIncludeExternal}
        setFormIncludeExternal={setNotesFormIncludeExternal}
        formExternalOnly={notesFormExternalOnly}
        setFormExternalOnly={setNotesFormExternalOnly}
        formError={notesFormError}
        setFormError={setNotesFormError}
        busy={notesModalBusy}
        subjectInputRef={notesSubjectInputRef}
        onClose={closeNotesModal}
        onSubmit={handleNotesFormSubmit}
      />

      <h2 className="program-view-title">Klassenlehrer</h2>
      <p className="text-muted program-view-intro">
        Zusätzliche Werkzeuge und Übersichten für die Klassenführung im aktuellen Fach.
      </p>

      <div className="glass-panel program-view-panel">
        <h3 className="program-view-panel-heading">Neue Liste anlegen</h3>
        <div className="klassenlehrer-create-buttons">
          <button type="button" className="tab secondary" onClick={openCreateMoneyModal}>
            + Geldliste erstellen
          </button>
          <button type="button" className="tab secondary" onClick={openCreateAttendanceModal}>
            + Anwesenheitsliste erstellen
          </button>
          <button type="button" className="tab secondary" onClick={openCreateCollectionModal}>
            + Sammelliste erstellen
          </button>
          <button type="button" className="tab secondary" onClick={openCreateNotesModal}>
            + Notizenliste erstellen
          </button>
        </div>
      </div>

      <section className="klassenlehrer-geldlisten-section">
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
                    onAddExternal={(person) => addMoneyListExternalEntry(activeTab.list.id, person)}
                    onRemoveExternalEntry={removeMoneyListEntry}
                    onEdit={openEditMoneyModal}
                    onDelete={handleDeleteMoney}
                  />
                ) : activeTab.type === 'attendance' ? (
                  <AttendanceListPanel
                    list={activeTab.list}
                    updateAttendanceListEntryPresent={updateAttendanceListEntryPresent}
                    onAddExternal={(person) => addAttendanceListExternalEntry(activeTab.list.id, person)}
                    onRemoveExternalEntry={removeAttendanceListEntry}
                    onEdit={openEditAttendanceModal}
                    onDelete={handleDeleteAttendance}
                  />
                ) : activeTab.type === 'notes' ? (
                  <NotesListPanel
                    list={activeTab.list}
                    updateNotesListEntryRemark={updateNotesListEntryRemark}
                    onAddExternal={(person) => addNotesListExternalEntry(activeTab.list.id, person)}
                    onRemoveExternalEntry={removeNotesListEntry}
                    onEdit={openEditNotesModal}
                    onDelete={handleDeleteNotes}
                  />
                ) : (
                  <CollectionListPanel
                    list={activeTab.list}
                    updateCollectionListEntryCollected={updateCollectionListEntryCollected}
                    onAddExternal={(person) => addCollectionListExternalEntry(activeTab.list.id, person)}
                    onRemoveExternalEntry={removeCollectionListEntry}
                    onEdit={openEditCollectionModal}
                    onDelete={handleDeleteCollection}
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
