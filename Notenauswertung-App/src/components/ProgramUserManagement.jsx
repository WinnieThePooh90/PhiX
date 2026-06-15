import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../store/AuthContext';
import { useDialog } from './PhixDialog';

export default function ProgramUserManagement() {
  const { usersList, addUser, setPasswordForUser, deleteUser, currentUser } = useAuth();
  const { showConfirm } = useDialog();

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [formErr, setFormErr] = useState('');
  const [formMsg, setFormMsg] = useState('');

  const [passwordUserId, setPasswordUserId] = useState(null);
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdNew2, setPwdNew2] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [listErr, setListErr] = useState('');

  const pwdFirstInputRef = useRef(null);

  const sortedUsers = useMemo(
    () => [...usersList].sort((a, b) => a.username.localeCompare(b.username, 'de', { sensitivity: 'base' })),
    [usersList],
  );

  const isReservedAdminUser = (username) =>
    String(username ?? '').toLowerCase() === 'admin';

  const isActingAdmin = () => String(currentUser?.username ?? '').toLowerCase() === 'admin';

  const canChangePasswordForUser = (u) =>
    !isReservedAdminUser(u.username) || isActingAdmin();

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
      if (isReservedAdminUser(u.username) && String(currentUser?.username ?? '').toLowerCase() !== 'admin') {
        setListErr('Nur der Administrator darf das Passwort von „admin“ ändern.');
        return;
      }
      setListErr('');
      setPasswordUserId(u.id);
      setPwdOld('');
      setPwdNew('');
      setPwdNew2('');
      setPwdMsg('');
      setPwdErr('');
    },
    [currentUser?.username],
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

  const onDeleteUser = async (u) => {
    setListErr('');
    if (isReservedAdminUser(u.username)) {
      setListErr('Der Benutzer „admin“ kann nicht gelöscht werden.');
      return;
    }
    const ok = await showConfirm(
      `Benutzer „${u.username}“ wirklich löschen?\n\nAlle Klassen, Schülerdaten und Noten dieses Benutzers werden unwiderruflich gelöscht. Eine Anmeldung mit diesem Namen ist danach nicht mehr möglich.`,
      { title: 'Benutzer löschen', danger: true },
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
    setFormMsg('');
    setListErr('');
    if (newPassword !== newPassword2) {
      setFormErr('Die Passwort-Wiederholung stimmt nicht überein.');
      return;
    }
    const r = await addUser(newUsername, newPassword);
    if (!r.ok) {
      setFormErr(r.error || 'Anlegen fehlgeschlagen.');
      return;
    }
    const createdName = newUsername.trim();
    setFormMsg(
      `Benutzer „${createdName}“ wurde angelegt. Beim ersten Login richtet er die Verschlüsselung ein und erhält einen Recovery-Key.`,
    );
    setNewUsername('');
    setNewPassword('');
    setNewPassword2('');
  };

  const onSubmitPassword = async (e) => {
    e.preventDefault();
    setPwdErr('');
    setPwdMsg('');
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
    setPwdNew('');
    setPwdNew2('');
  };

  const pwdModalUsername = sortedUsers.find((x) => x.id === passwordUserId)?.username ?? '—';

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
            Passwort ändern für <strong>{pwdModalUsername}</strong>
          </h2>
          <form className="program-user-mgmt-form" onSubmit={onSubmitPassword}>
            <label className="program-user-mgmt-label">
              Neues Passwort
              <input
                ref={pwdFirstInputRef}
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
                <button
                  type="button"
                  className="program-user-mgmt-link-btn"
                  disabled={!canChangePasswordForUser(u)}
                  title={
                    !canChangePasswordForUser(u)
                      ? 'Nur der Administrator darf das Passwort von „admin“ ändern.'
                      : 'Passwort ändern'
                  }
                  onClick={() => openPasswordModal(u)}
                >
                  Passwort ändern
                </button>
                <button
                  type="button"
                  className="program-user-mgmt-delete-btn"
                  disabled={sortedUsers.length <= 1 || isReservedAdminUser(u.username)}
                  title={
                    isReservedAdminUser(u.username)
                      ? 'Der Benutzer „admin“ kann nicht gelöscht werden.'
                      : sortedUsers.length <= 1
                        ? 'Mindestens ein Benutzer muss bleiben.'
                        : 'Benutzer löschen'
                  }
                  onClick={() => onDeleteUser(u)}
                >
                  Löschen
                </button>
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
          <label className="program-user-mgmt-label">
            Passwort
            <input
              className="program-user-mgmt-input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="program-user-mgmt-label">
            Passwort wiederholen
            <input
              className="program-user-mgmt-input"
              type="password"
              autoComplete="new-password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
            />
          </label>
          {formErr ? (
            <p className="program-user-mgmt-error" role="alert">
              {formErr}
            </p>
          ) : null}
          {formMsg ? <p className="program-user-mgmt-success">{formMsg}</p> : null}
          <button type="submit" className="program-user-mgmt-submit">
            Benutzer anlegen
          </button>
        </form>
      </section>

      {passwordModal}
    </div>
  );
}
