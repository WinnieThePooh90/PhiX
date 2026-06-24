import React, { useState } from 'react';
import { APP_NAME } from '../config/app';
import { APP_VERSION } from '../config/appVersion';
import AppLogo from '../components/AppLogo';
import { useAuth } from '../store/AuthContext';

export default function LoginView({ onRecovery }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const doLogin = async (user, pass) => {
    setError('');
    setSubmitting(true);
    const r = await login(user, pass);
    setSubmitting(false);
    if (!r.ok) setError(r.error || 'Anmeldung fehlgeschlagen.');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    await doLogin(username, password);
  };

  const onDevLogin = async () => {
    await doLogin('admin', 'admin');
  };

  const showDevLoginButton =
    import.meta.env.DEV
    || (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname));

  return (
    <div className="app-login-screen">
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
          {error ? (
            <p className="app-login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="app-login-submit" disabled={submitting}>
            {submitting ? 'Anmelden…' : 'Anmelden'}
          </button>
          {showDevLoginButton ? (
            <button
              type="button"
              className="tab secondary app-login-dev-btn"
              onClick={onDevLogin}
              disabled={submitting}
            >
              Development
            </button>
          ) : null}
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
    </div>
  );
}
