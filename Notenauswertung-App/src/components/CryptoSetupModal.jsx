import React, { useState, useRef } from 'react';
import { apiFetch } from '../utils/apiBase';
import { clearCryptoSessionToken } from '../utils/cryptoSession';
import { writePendingRecoverySetup } from '../utils/pendingRecovery';
import RecoveryKeyModal from './RecoveryKeyModal';

export default function CryptoSetupModal({ username, password, onComplete }) {
  const [recoveryKey, setRecoveryKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setupStartedRef = useRef(false);

  const runSetup = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch('/api/auth/crypto/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Acting-User': username,
        },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Einrichtung fehlgeschlagen.');
        return;
      }
      const key = body.recoveryKey || '';
      const token = body.cryptoSessionToken || '';
      if (!key || !token) {
        setError('Recovery-Key konnte nicht erzeugt werden.');
        return;
      }
      clearCryptoSessionToken();
      writePendingRecoverySetup({ username, recoveryKey: key, cryptoSessionToken: token });
      setRecoveryKey(key);
    } catch {
      setError('Server nicht erreichbar.');
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (setupStartedRef.current) return undefined;
    setupStartedRef.current = true;
    void runSetup();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (recoveryKey) {
    return (
      <RecoveryKeyModal
        username={username}
        recoveryKey={recoveryKey}
        successMessage="Ihre Verschlüsselung wurde eingerichtet."
        confirmLabel="Weiter zur App"
        onClose={() => onComplete?.()}
      />
    );
  }

  return (
    <div className="app-login-screen" role="dialog" aria-modal="true" aria-busy={busy}>
      <div className="app-login-card">
        <h1 className="app-login-title">Verschlüsselung einrichten</h1>
        <p className="app-login-subtitle">{busy ? 'Schlüssel werden erzeugt…' : 'Einrichtung wird vorbereitet…'}</p>
        {error ? (
          <p className="app-login-error" role="alert">
            {error}
          </p>
        ) : null}
        {error ? (
          <button type="button" className="app-login-submit" onClick={runSetup} disabled={busy}>
            Erneut versuchen
          </button>
        ) : null}
      </div>
    </div>
  );
}
