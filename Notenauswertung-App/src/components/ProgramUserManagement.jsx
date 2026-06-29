import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../store/AuthContext';
import { useDialog } from './PhixDialog';
import PhixCheckboxOption from './PhixCheckboxOption';
import { isReservedAdminUsername, userHasAdminRights } from '../utils/userAdmin';

export default function ProgramUserManagement() {
  const { usersList, addUser, setPasswordForUser, setUserAdmin, deleteUser, currentUser } = useAuth();
  const { showConfirm, showAlert } = useDialog();

  const [newUsername, setNewUsername] = useState('');
  const [formErr, setFormErr] = useState('');

  const [passwordUserId, setPasswordUserId] = useState(null);
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdNew2, setPwdNew2] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [listErr, setListErr] = useState('');
  const [adminToggleUserId, setAdminToggleUserId] = useState(null);

  const pwdFirstInputRef = useRef(null);

  const sortedUsers = useMemo(
    () => [...usersList].sort((a, b) => a.username.localeCompare(b.username, 'de', { sensitivity: 'base' })),
    [usersList],
  );

  const actingIsAdmin = userHasAdminRights(currentUser);

  const isSelfUser = (u) => String(u?.id) === String(currentUser?.id);

  const resetPasswordForm = useCallback(() => {
    setPasswordUserId(null);
    setPwdOld('');
    setPwdNew('');
    setPwdNew2('');
    setPwdMsg('');
    setPwdErr('');
  }, []);

  const openPasswordModal = useCallback(
    (u) => {
      if (!isSelfUser(u)) return;
      setListErr('');
      setPasswordUserId(u.id);
      setPwdOld('');
      setPwdNew('');
      setPwdNew2('');
      setPwdMsg('');
      setPwdErr('');
    },
    [currentUser?.id],
  );

  useEffect(() => {
    if (!passwordUserId) return undefined;
    const t = requestAnimationFrame(() => pwdFirstInputRef.current?.focus());
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resetPasswordForm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [passwordUserId, resetPasswordForm]);

  const onToggleAdmin = async (u, checked) => {
    setListErr('');
    if (!actingIsAdmin) {
      setListErr('Nur Administratoren dürfen Admin-Rechte vergeben oder entziehen.');
      return;
    }
    if (isReservedAdminUsername(u.username)) return;
    setAdminToggleUserId(u.id);
    try {
      const r = await setUserAdmin(u.id, checked);
      if (!r.ok) {
        setListErr(r.error || 'Admin-Rechte konnten nicht gespeichert werden.');
      }
    } finally {
      setAdminToggleUserId(null);
    }
  };

  const canDeleteUser = (u) =>
    (actingIsAdmin || isSelfUser(u)) &&
    !isReservedAdminUsername(u.username) &&
    sortedUsers.length > 1;

  const onDeleteUser = async (u) => {
    setListErr('');
    if (!actingIsAdmin && !isSelfUser(u)) {
      setListErr('Nur Administratoren dürfen andere Benutzer löschen.');
      return;
    }
    if (isReservedAdminUsername(u.username)) {
      setListErr('Der Benutzer „admin“ kann nicht gelöscht werden.');
      return;
    }
    const ok = await showConfirm(
      isSelfUser(u)
        ? `Eigenen Benutzer „${u.username}“ wirklich löschen?\n\nAlle Ihre Klassen, Schülerdaten und Noten werden unwiderruflich gelöscht. Sie werden abgemeldet.`
        : `Benutzer „${u.username}“ wirklich löschen?\n\nAlle Klassen, Schülerdaten und Noten dieses Benutzers werden unwiderruflich gelöscht. Eine Anmeldung mit diesem Namen ist danach nicht mehr möglich.`,
      { title: isSelfUser(u) ? 'Eigenen Benutzer löschen' : 'Benutzer löschen', danger: true },
    );
    if (!ok) return;
    const r = await deleteUser(u.id);
    if (!r.ok) {
      setListErr(r.error || 'Löschen fehlgeschlagen.');
      return;
    }
    try {
      localStorage.removeItem(`phix_last_tab_${u.username}`);
      localStorage.removeItem(`phix_last_course_id_${u.username}`);
    } catch {}
    if (passwordUserId === u.id) resetPasswordForm();
  };

  const onCreateUser = async (e) => {
    e.preventDefault();
    setFormErr('');
    setListErr('');
    const r = await addUser(newUsername);
    if (!r.ok) {
      setFormErr(r.error || 'Anlegen fehlgeschlagen.');
      return;
    }
    const createdName = newUsername.trim();
    setNewUsername('');
    const tokenHint = r.setupToken
      ? `\n\nEinrichtungs-Token (einmalig an den Benutzer weitergeben):\n${r.setupToken}`
      : '';
    await showAlert(
      `Benutzer „${createdName}“ wurde angelegt. Beim ersten Login legt er sein Passwort fest (mit Einrichtungs-Token), richtet die Verschlüsselung ein und erhält einen Recovery-Key.${tokenHint}`,
      { title: 'Benutzer angelegt' },
    );
  };

  const onSubmitPassword = async (e) => {
    e.preventDefault();
    setPwdErr('');
    setPwdMsg('');
    if (!pwdOld.trim()) {
      setPwdErr('Aktuelles Passwort eingeben.');
      return;
    }
    if (pwdNew !== pwdNew2) {
      setPwdErr('Die Passwort-Wiederholung stimmt nicht überein.');
      return;
    }
    const r = await setPasswordForUser(passwordUserId, pwdNew, pwdOld);
    if (!r.ok) {
      setPwdErr(r.error || 'Speichern fehlgeschlagen.');
      return;
    }
    setPwdMsg('Passwort wurde geändert.');
    setPwdOld('');
    setPwdNew('');
    setPwdNew2('');
  };

  const passwordModal =
    passwordUserId &&
    createPortal(
      <div
        className="program-user-mgmt-modal-backdrop"
        role="presentation"
        onMouseDown={(ev) => {
          if (ev.target === ev.currentTarget) resetPasswordForm();
        }}
      >
        <div
          className="program-user-mgmt-modal-dialog glass-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="program-user-mgmt-pwd-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id="program-user-mgmt-pwd-title" className="program-user-mgmt-modal-title">
            Eigenes Passwort ändern
          </h2>
          <form className="program-user-mgmt-form" onSubmit={onSubmitPassword}>
            <label className="program-user-mgmt-label">
              Aktuelles Passwort
              <input
                ref={pwdFirstInputRef}
                className="program-user-mgmt-input"
                type="password"
                autoComplete="current-password"
                value={pwdOld}
                onChange={(e) => setPwdOld(e.target.value)}
              />
            </label>
            <label className="program-user-mgmt-label">
              Neues Passwort
              <input
                className="program-user-mgmt-input"
                type="password"
                autoComplete="new-password"
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
              />
            </label>
            <label className="program-user-mgmt-label">
              Neues Passwort wiederholen
              <input
                className="program-user-mgmt-input"
                type="password"
                autoComplete="new-password"
                value={pwdNew2}
                onChange={(e) => setPwdNew2(e.target.value)}
              />
            </label>
            {pwdErr ? (
              <p className="program-user-mgmt-error" role="alert">
                {pwdErr}
              </p>
            ) : null}
            {pwdMsg ? <p className="program-user-mgmt-success">{pwdMsg}</p> : null}
            <div className="program-user-mgmt-modal-actions">
              <button type="submit" className="program-user-mgmt-submit">
                Passwort speichern
              </button>
              <button type="button" className="secondary" onClick={resetPasswordForm}>
                {pwdMsg ? 'Schließen' : 'Abbrechen'}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="program-user-mgmt">
      <h3 className="program-user-mgmt-page-title">Benutzerverwaltung</h3>

      <section className="program-user-mgmt-section" aria-labelledby="program-user-mgmt-list-heading">
        <h4 id="program-user-mgmt-list-heading" className="program-user-mgmt-section-title">
          Bestehende Benutzer
        </h4>
        {listErr ? (
          <p className="program-user-mgmt-error program-user-mgmt-section-alert" role="alert">
            {listErr}
          </p>
        ) : null}
        <ul className="program-user-mgmt-list program-user-mgmt-list--wide">
          {sortedUsers.map((u) => (
            <li key={u.id} className="program-user-mgmt-list-item">
              <span className="program-user-mgmt-name">
                {u.username}
                {currentUser?.username === u.username ? (
                  <span className="program-user-mgmt-you"> (Sie)</span>
                ) : null}
              </span>
              <span className="program-user-mgmt-row-actions">
                {actingIsAdmin ? (
                  <PhixCheckboxOption
                    className="program-user-mgmt-admin-check program-user-mgmt-action-btn"
                    checked={userHasAdminRights(u)}
                    disabled={
                      isReservedAdminUsername(u.username) || adminToggleUserId === u.id
                    }
                    onChange={(e) => onToggleAdmin(u, e.target.checked)}
                    title={
                      isReservedAdminUsername(u.username)
                        ? 'Dem Benutzer „admin“ können Admin-Rechte nicht entzogen werden.'
                        : 'Administratorrechte (z. B. Backup, Dependencies)'
                    }
                    aria-label={`Administratorrechte für ${u.username}`}
                  >
                    Admin
                  </PhixCheckboxOption>
                ) : null}
                {isSelfUser(u) ? (
                  <button
                    type="button"
                    className="program-user-mgmt-link-btn program-user-mgmt-action-btn"
                    title="Eigenes Passwort ändern"
                    onClick={() => openPasswordModal(u)}
                  >
                    Passwort ändern
                  </button>
                ) : null}
                {canDeleteUser(u) ? (
                  <button
                    type="button"
                    className="program-user-mgmt-delete-btn program-user-mgmt-action-btn"
                    title={
                      isSelfUser(u)
                        ? 'Eigenen Benutzer löschen'
                        : 'Benutzer löschen'
                    }
                    onClick={() => onDeleteUser(u)}
                  >
                    Löschen
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="program-user-mgmt-section" aria-labelledby="program-user-mgmt-create-heading">
        <h4 id="program-user-mgmt-create-heading" className="program-user-mgmt-section-title">
          Neuen Benutzer anlegen
        </h4>
        <form className="program-user-mgmt-form" onSubmit={onCreateUser}>
          <label className="program-user-mgmt-label">
            Benutzername
            <input
              className="program-user-mgmt-input"
              type="text"
              autoComplete="off"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </label>
          <p className="program-user-mgmt-create-hint">
            Das Passwort legt der neue Benutzer beim ersten Login selbst fest.
          </p>
          {formErr ? (
            <p className="program-user-mgmt-error" role="alert">
              {formErr}
            </p>
          ) : null}
          <button type="submit" className="program-user-mgmt-submit">
            Benutzer anlegen
          </button>
        </form>
      </section>

      {passwordModal}
    </div>
  );
}
