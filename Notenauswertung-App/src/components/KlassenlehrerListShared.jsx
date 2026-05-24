import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import PhixCheckboxOption from './PhixCheckboxOption';

export function ListFormExternalCheckboxes({
  includeExternal,
  setIncludeExternal,
  externalOnly,
  setExternalOnly,
  disabled,
}) {
  return (
    <div className="settings-course-check-options klassenlehrer-external-form-options">
      <PhixCheckboxOption
        checked={includeExternal}
        disabled={disabled || externalOnly}
        onChange={(ev) => {
          setIncludeExternal(ev.target.checked);
        }}
      >
        Externe Personen einbinden
      </PhixCheckboxOption>
      <PhixCheckboxOption
        checked={externalOnly}
        disabled={disabled}
        onChange={(ev) => {
          const checked = ev.target.checked;
          setExternalOnly(checked);
          if (checked) setIncludeExternal(false);
        }}
      >
        Nur externe Personen
      </PhixCheckboxOption>
    </div>
  );
}

export function ExternalPersonAddBlock({ onAdd, busy }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setError('Bitte Vor- und Nachname eingeben.');
      return;
    }
    setError('');
    const res = await onAdd({ firstName: fn, lastName: ln });
    if (res?.error) {
      setError(res.error);
      return;
    }
    setFirstName('');
    setLastName('');
  };

  return (
    <form className="klassenlehrer-external-add" onSubmit={handleSubmit}>
      <span className="klassenlehrer-external-add-label">Externe Person hinzufügen</span>
      <input
        className="program-user-mgmt-input klassenlehrer-external-add-input"
        value={lastName}
        onChange={(ev) => {
          setLastName(ev.target.value);
          if (error) setError('');
        }}
        placeholder="Nachname"
        disabled={busy}
        autoComplete="off"
      />
      <input
        className="program-user-mgmt-input klassenlehrer-external-add-input"
        value={firstName}
        onChange={(ev) => {
          setFirstName(ev.target.value);
          if (error) setError('');
        }}
        placeholder="Vorname"
        disabled={busy}
        autoComplete="off"
      />
      <button type="submit" className="tab secondary" disabled={busy}>
        Hinzufügen
      </button>
      {error ? (
        <p className="program-user-mgmt-error klassenlehrer-external-add-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function canAddExternalPersons(list) {
  return Boolean(list?.includeExternal || list?.externalOnly);
}

export function ListPanelFooter({ list, onEdit, onDelete }) {
  return (
    <div className="klassenlehrer-money-panel-actions">
      <button type="button" className="tab secondary" onClick={() => onEdit(list)}>
        Bearbeiten
      </button>
      <button
        type="button"
        className="danger klassenlehrer-list-delete-btn"
        onClick={() => onDelete(list)}
        title="Liste löschen"
        aria-label="Liste löschen"
      >
        <Trash2 size={18} strokeWidth={2} aria-hidden />
        Löschen
      </button>
    </div>
  );
}

export function RemarkEntryField({ value, onCommit, disabled, ariaLabel }) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  return (
    <textarea
      className="klassenlehrer-remark-input program-user-mgmt-input"
      value={draft}
      onChange={(ev) => setDraft(ev.target.value)}
      onBlur={() => {
        const next = draft;
        if (next !== (value ?? '')) onCommit(next);
      }}
      rows={2}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder="Bemerkung …"
    />
  );
}
