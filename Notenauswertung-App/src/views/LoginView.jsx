import React, { useState } from 'react';
import { APP_NAME } from '../config/app';
import { APP_VERSION } from '../config/appVersion';
import AppLogo from '../components/AppLogo';
import ChangelogModal from '../components/ChangelogModal';
import { useAuth } from '../store/AuthContext';

export default function LoginView({ onRecovery }) {
  const { login, setInitialPassword } = useAuth();
  const [showChangelog, setShowChangelog] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(() => {
    try {
      const msg = sessionStorage.getItem('phix_login_notice');
      if (msg) {
        sessionStorage.removeItem('phix_login_notice');
        return msg;
      }
    } catch {
      /* ignore */
    }
    return '';
  });
  const [submitting, setSubmitting] = useState(false);
  const [initialSetupUsername, setInitialSetupUsername] = useState(null);
  const [initialPassword, setInitialPasswordValue] = useState('');
  const [initialPassword2, setInitialPassword2] = useState('');
  const [setupToken, setSetupToken] = useState('');

  const doLogin = async (user, pass) => {
    setError('');
    setSubmitting(true);
    const r = await login(user, pass);
    setSubmitting(false);
    if (r.ok) return;
    if (r.requiresInitialPassword) {
      setInitialSetupUsername(r.username || user);
      setUsername(r.username || user);
      setPassword('');
      setInitialPasswordValue('');
      setInitialPassword2('');
      setError('');
      return;
    }
    setError(r.error || 'Anmeldung fehlgeschlagen.');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    await doLogin(username, password);
  };

  const onSubmitInitialPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (initialPassword !== initialPassword2) {
      setError('Die Passwort-Wiederholung stimmt nicht überein.');
      return;
    }
    setSubmitting(true);
    const r = await setInitialPassword(initialSetupUsername || username, initialPassword, setupToken);
    if (!r.ok) {
      setSubmitting(false);
      setError(r.error || 'Passwort konnte nicht gespeichert werden.');
      return;
    }
    const loginUser = initialSetupUsername || username;
    const loginResult = await login(loginUser, initialPassword);
    setSubmitting(false);
    if (!loginResult.ok) {
      setError(loginResult.error || 'Passwort gespeichert, Anmeldung fehlgeschlagen.');
      setInitialSetupUsername(null);
      return;
    }
    setInitialSetupUsername(null);
  };

  const cancelInitialSetup = () => {
    setInitialSetupUsername(null);
    setInitialPasswordValue('');
    setInitialPassword2('');
    setError('');
  };

  if (initialSetupUsername) {
    return (
      <div className="app-login-screen">
        <div className="app-login-card">
          <div className="app-login-brand app-login-brand--solo">
            <AppLogo size={72} />
          </div>
          <h2 className="app-login-title app-login-title--setup">Erstes Passwort festlegen</h2>
          <p className="app-login-subtitle app-login-subtitle--center">{initialSetupUsername}</p>
          <form className="app-login-form" onSubmit={onSubmitInitialPassword}>
            <label className="app-login-label">
              <span>Einrichtungs-Token (vom Administrator)</span>
              <input
                className="app-login-input"
                type="text"
                autoComplete="off"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                disabled={submitting}
                placeholder="Beim allerersten Start leer lassen"
              />
            </label>
            <label className="app-login-label">
              <span>Neues Passwort</span>
              <input
                className="app-login-input"
                type="password"
                autoComplete="new-password"
                value={initialPassword}
                onChange={(e) => setInitialPasswordValue(e.target.value)}
                disabled={submitting}
              />
            </label>
            <label className="app-login-label">
              <span>Passwort wiederholen</span>
              <input
                className="app-login-input"
                type="password"
                autoComplete="new-password"
                value={initialPassword2}
                onChange={(e) => setInitialPassword2(e.target.value)}
                disabled={submitting}
              />
            </label>
            {error ? (
              <p className="app-login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="app-login-submit" disabled={submitting}>
              {submitting ? 'Speichern…' : 'Passwort speichern und anmelden'}
            </button>
            <button type="button" className="tab secondary" onClick={cancelInitialSetup} disabled={submitting}>
              Zurück zur Anmeldung
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-login-screen">
      <div className="app-login-top-bar">
        <button
          type="button"
          className="app-login-changelog-btn"
          onClick={() => setShowChangelog(true)}
          title="Änderungen und Versionsverlauf anzeigen"
          aria-haspopup="dialog"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Changelog
        </button>
      </div>

      <div className="app-login-card">
        <div className="app-login-brand app-login-brand--solo">
          <AppLogo size={72} />
        </div>
        <form className="app-login-form" onSubmit={onSubmit}>
          <label className="app-login-label">
            <span>Benutzername</span>
            <input
              className="app-login-input"
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          </label>
          <label className="app-login-label">
            <span>Passwort</span>
            <input
              className="app-login-input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </label>
          {info ? (
            <p className="app-login-info" style={{ color: 'var(--color-primary, #3b82f6)', margin: '0 0 12px', fontSize: '0.9rem', textAlign: 'center' }} role="status">
              {info}
            </p>
          ) : null}
          {error ? (
            <p className="app-login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="app-login-submit" disabled={submitting}>
            {submitting ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
      <div className="app-login-footer">
        <p className="app-login-build-info">
          {APP_NAME} by Karsten Paulokat - Build {APP_VERSION}
        </p>
        {onRecovery ? (
          <button
            type="button"
            className="tab secondary backup-action-btn app-login-recovery-btn"
            onClick={onRecovery}
          >
            Passwort mit Recovery-Key zurücksetzen
          </button>
        ) : null}
      </div>

      <ChangelogModal open={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
}
