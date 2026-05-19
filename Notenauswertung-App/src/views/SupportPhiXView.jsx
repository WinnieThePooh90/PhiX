import React, { useState } from 'react';
import { APP_NAME } from '../config/app';
import { usePhiXRegistration } from '../utils/phixRegistration';

/** Offizielle PayPal-Spenden-URL (Hosted Button). */
const PAYPAL_DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=U737ERXEAE5CJ';

export default function SupportPhiXView({ onRegistrationSuccess }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [registerFeedback, setRegisterFeedback] = useState(null);
  const { registered, register } = usePhiXRegistration();

  const handleRegisterVersion = (e) => {
    e.preventDefault();
    setRegisterFeedback(null);
    if (register(licenseKey)) {
      setLicenseKey('');
      onRegistrationSuccess?.();
    } else {
      setRegisterFeedback({ type: 'error', text: 'Ungültiger Registrierungsschlüssel.' });
    }
  };

  return (
    <div
      className="view-generic-scroll program-view support-phix-view"
      style={{ paddingBottom: '2rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
    >
      <section className="glass-panel support-phix-section" aria-labelledby="support-phix-why-heading">
        <h3 id="support-phix-why-heading" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
          Wozu registrieren
        </h3>
        <div className="support-phix-prose text-muted">
          <p>
            Durch das Registrieren des Programms erhältst du keine zusätzlichen oder neuen Funktionen.
            Ich möchte das Programm auch ohne einen Kauf in vollem Umfang anbieten.
          </p>
          <p>
            Was du allerdings erhältst: Ein herzliches Dankeschön von mir und ein gutes Gewissen, die
            Entwicklung von {APP_NAME} mit einem kleinen, aber feinen Beitrag unterstützt zu haben.
          </p>
          <p>
            Mit der Spende erhältst du aber zusätzlich auch einen Registrierungsschlüssel.
          </p>
          <p>
            Was macht aber dann der Registrierungsschlüssel? Gib ihn ein und finde es heraus :)
          </p>
        </div>
      </section>

      <section className="glass-panel support-phix-section" aria-labelledby="support-phix-license-heading">
        <h3 id="support-phix-license-heading" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
          Version registrieren
        </h3>
        <p className="text-muted" style={{ fontSize: '0.875rem', margin: '0 0 1rem' }}>
          Lizenzschlüssel eingeben, um diese Installation zu registrieren.
          {registered ? ' Diese Installation ist bereits registriert.' : ''}
        </p>
        <form className="support-phix-license-form" onSubmit={handleRegisterVersion}>
          <label className="support-phix-label" htmlFor="support-phix-license-key">
            Lizenzschlüssel
          </label>
          <div className="support-phix-license-row">
            <input
              id="support-phix-license-key"
              type="text"
              className="support-phix-license-input"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="z. B. XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="tab active support-phix-register-btn">
              Version Registrieren
            </button>
          </div>
          {registerFeedback ? (
            <p
              className={`support-phix-register-feedback support-phix-register-feedback--${registerFeedback.type}`}
              role="status"
            >
              {registerFeedback.text}
            </p>
          ) : null}
        </form>
      </section>

      <section className="glass-panel support-phix-section" aria-labelledby="support-phix-donate-heading">
        <h3 id="support-phix-donate-heading" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
          {APP_NAME} unterstützen
        </h3>
        <p className="support-phix-donate-text text-muted">
          Unterstütze mich mit einer kleinen Spende. Mit einer Spende (egal wie hoch) erhältst du dann auch einen
          Lizenzschlüssel. Vergiss bitte dazu nicht, deine eMail-Adresse im Spendenverlauf anzugeben. Danke!
        </p>
        <div className="support-phix-paypal-wrap">
          <a
            href={PAYPAL_DONATE_URL}
            className="support-phix-paypal-btn"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Mit PayPal spenden (öffnet neues Fenster)"
          >
            <span className="support-phix-paypal-btn__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
                <path
                  fill="#003087"
                  d="M8.32 8.88h2.78c1.28 0 2.2-.84 2.4-2.05.22-1.34-.62-2.33-2.08-2.33H7.14L5.5 14.5h2.14l.68-5.62z"
                />
                <path
                  fill="#009cde"
                  d="M18.1 6.5c-.48-1.86-2.08-2.5-3.88-2.5H9.62c-.28 0-.52.2-.56.48L6.5 17.5h3.2l.62-3.88h2.58c2.52 0 4.48-1.02 5.06-3.98.24-1.14.02-2.2-.86-3.14z"
                />
              </svg>
            </span>
            <span className="support-phix-paypal-btn__text">Mit PayPal spenden</span>
          </a>
        </div>
      </section>
    </div>
  );
}
