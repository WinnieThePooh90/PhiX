import React, { useState } from 'react';
import { apiFetch } from '../utils/apiBase';
import { writeCryptoSessionToken } from '../utils/cryptoSession';
import RecoveryKeyModal from './RecoveryKeyModal';

export default function CryptoSetupModal({ username, password, onComplete }) {
  const [recoveryKey, setRecoveryKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runSetup = async () => {
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
      if (body.cryptoSessionToken) writeCryptoSessionToken(body.cryptoSessionToken);
      setRecoveryKey(body.recoveryKey || '');
    } catch {
      setError('Server nicht erreichbar.');
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    runSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (recoveryKey) {
    return (
      <RecoveryKeyModal
        username={username}
        recoveryKey={recoveryKey}
        confirmLabel="Weiter zur App"
        onClose={() => onComplete?.()}
      />
    );
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2>Verschlüsselung einrichten</h2>
        <p>Schlüssel werden erzeugt…</p>
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
