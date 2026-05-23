import React, { useState } from 'react';
import { apiFetch } from '../utils/apiBase';
import { writeCryptoSessionToken } from '../utils/cryptoSession';

export default function CryptoSetupModal({ username, password, onComplete }) {
  const [confirmed, setConfirmed] = useState(false);
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

  const downloadRecovery = () => {
    const text = `PhiX Recovery-Key für ${username}\n\n${recoveryKey}\n\nBewahren Sie diesen Schlüssel sicher auf. Er kann das Passwort ersetzen.\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phix-recovery-${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!recoveryKey) {
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

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: '32rem' }}>
        <h2>Recovery-Key sichern</h2>
        <p>
          Notieren oder laden Sie diesen Schlüssel herunter. Ohne ihn und ohne Passwort sind Ihre Daten
          nicht wiederherstellbar.
        </p>
        <p
          style={{
            fontFamily: 'monospace',
            fontSize: '1.1rem',
            letterSpacing: '0.05em',
            padding: '0.75rem',
            background: 'var(--surface-2, #f4f4f5)',
            borderRadius: '6px',
            wordBreak: 'break-all',
          }}
        >
          {recoveryKey}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button type="button" className="app-login-submit" onClick={downloadRecovery}>
            Als Datei speichern
          </button>
        </div>
        <label style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Ich habe den Recovery-Key sicher aufbewahrt.</span>
        </label>
        <button
          type="button"
          className="app-login-submit"
          style={{ marginTop: '1rem' }}
          disabled={!confirmed}
          onClick={() => onComplete?.()}
        >
          Weiter zur App
        </button>
      </div>
    </div>
  );
}
