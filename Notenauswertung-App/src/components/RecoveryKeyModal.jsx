import React, { useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Popup: Erfolgsmeldung + Recovery-Key; Schließen nur nach Bestätigungs-Checkbox.
 */
export default function RecoveryKeyModal({
  username,
  recoveryKey,
  successMessage,
  title = 'Recovery-Key sichern',
  confirmLabel = 'Schließen',
  onClose,
}) {
  const [confirmed, setConfirmed] = useState(false);

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

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="recovery-key-modal-title">
      <div className="modal-card" style={{ maxWidth: '32rem' }} onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="recovery-key-modal-title">{title}</h2>
        {successMessage ? <p className="program-user-mgmt-success">{successMessage}</p> : null}
        <p>
          Notieren oder laden Sie diesen Schlüssel herunter. Ohne ihn und ohne Passwort sind die Daten dieses
          Benutzers nicht wiederherstellbar.
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
          onClick={() => onClose?.()}
        >
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
