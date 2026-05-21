import React, { useState } from 'react';

export function ListFormExternalCheckboxes({
  includeExternal,
  setIncludeExternal,
  externalOnly,
  setExternalOnly,
  disabled,
}) {
  return (
    <div className="klassenlehrer-external-form-options">
      <label className="klassenlehrer-external-checkbox">
        <input
          type="checkbox"
          checked={includeExternal}
          disabled={disabled || externalOnly}
          onChange={(ev) => {
            setIncludeExternal(ev.target.checked);
          }}
        />
        Externe Personen einbinden
      </label>
      <label className="klassenlehrer-external-checkbox">
        <input
          type="checkbox"
          checked={externalOnly}
          disabled={disabled}
          onChange={(ev) => {
            const checked = ev.target.checked;
            setExternalOnly(checked);
            if (checked) setIncludeExternal(false);
          }}
        />
        Nur externe Personen
      </label>
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
