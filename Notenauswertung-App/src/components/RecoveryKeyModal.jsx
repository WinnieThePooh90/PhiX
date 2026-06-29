import React, { useState } from 'react';
import PhixCheckboxOption from './PhixCheckboxOption';

/**
 * Vollbild: Recovery-Key nach Ersteinrichtung (Checkbox-Pflicht vor Fortfahren).
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
    const text = `PhiX Recovery-Key für ${username}\n\n${recoveryKey}\n\nBewahre diesen Schlüssel sicher auf. Er kann das Passwort ersetzen.\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phix-recovery-${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-login-screen phix-recovery-screen" role="dialog" aria-modal="true" aria-labelledby="recovery-key-modal-title">
      <div className="app-login-card phix-recovery-card">
        <h1 id="recovery-key-modal-title" className="app-login-title">
          {title}
        </h1>
        {successMessage ? <p className="app-login-subtitle phix-recovery-success">{successMessage}</p> : null}
        <p className="phix-recovery-hint">
          Notiere oder lade diesen Schlüssel herunter. Ohne ihn und ohne Passwort sind deine Daten nicht
          wiederherstellbar.
        </p>
        <p className="phix-recovery-key-display" aria-label="Recovery-Key">
          {recoveryKey}
        </p>
        <div className="phix-recovery-actions">
          <button type="button" className="app-login-submit" onClick={downloadRecovery}>
            Als Datei speichern
          </button>
        </div>
        <PhixCheckboxOption wrap checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}>
          Ich habe den Recovery-Key sicher aufbewahrt.
        </PhixCheckboxOption>
        <button
          type="button"
          className="app-login-submit phix-recovery-continue"
          disabled={!confirmed}
          onClick={() => onClose?.()}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
