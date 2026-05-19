import React, { useState } from 'react';
import { APP_NAME } from '../config/app';
import { useAuth } from '../store/AuthContext';

export default function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const r = await login(username, password);
    setSubmitting(false);
    if (!r.ok) setError(r.error || 'Anmeldung fehlgeschlagen.');
  };

  return (
    <div className="app-login-screen">
      <div className="app-login-card">
        <h1 className="app-login-title">{APP_NAME}</h1>
        <p className="app-login-subtitle">Bitte anmelden</p>
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
        </form>
      </div>
    </div>
  );
}
