import React, { useState } from 'react';
import { APP_NAME } from '../config/app';
import AppLogo from '../components/AppLogo';
import { apiFetch } from '../utils/apiBase';
import { writeCryptoSessionToken } from '../utils/cryptoSession';

export default function RecoveryUnlockView({ onUnlocked }) {
  const [username, setUsername] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/crypto/unlock-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, recoveryKey, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Entsperren fehlgeschlagen.');
        return;
      }
      if (body.cryptoSessionToken) writeCryptoSessionToken(body.cryptoSessionToken);
      onUnlocked?.(body);
    } catch {
      setError('Server nicht erreichbar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-login-screen">
      <div className="app-login-card">
        <div className="app-login-brand">
          <AppLogo size={72} />
          <h1 className="app-login-title">{APP_NAME}</h1>
        </div>
        <p className="app-login-subtitle">Passwort mit Recovery-Key zurücksetzen</p>
        <form className="app-login-form" onSubmit={onSubmit}>
          <label className="app-login-label">
            <span>Benutzername</span>
            <input
              className="app-login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          </label>
          <label className="app-login-label">
            <span>Recovery-Key</span>
            <input
              className="app-login-input"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
          </label>
          <label className="app-login-label">
            <span>Neues Passwort</span>
            <input
              className="app-login-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
            />
          </label>
          {error ? (
            <p className="app-login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="app-login-submit" disabled={submitting}>
            {submitting ? 'Speichern…' : 'Neues Passwort setzen'}
          </button>
        </form>
      </div>
    </div>
  );
}
