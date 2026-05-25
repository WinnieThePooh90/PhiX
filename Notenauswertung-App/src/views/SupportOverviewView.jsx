import React from 'react';
import { Heart, CheckCircle } from 'lucide-react';
import { usePhiXRegistration } from '../utils/phixRegistration';

const BMC_URL = 'https://buymeacoffee.com/KarstenPaulokat';

function BuyMeACoffeeButton() {
  return (
    <a
      href={BMC_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="bmc-button"
    >
      <img
        src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg"
        alt=""
        aria-hidden="true"
        className="bmc-button__icon"
      />
      <span className="bmc-button__text">Buy me a coffee</span>
    </a>
  );
}

export default function SupportOverviewView({ onOpenRegistration }) {
  const { registered } = usePhiXRegistration();

  return (
    <div className="view-generic-scroll program-view support-overview-view">
      <h3 className="program-view-title">Unterstützung</h3>

      <section className="glass-panel support-overview-section">
        <p className="support-overview-text">
          Du findest das Programm toll und möchtest mich als Entwickler unterstützen?
          Dann überlege dir doch, einen Registrierungsschlüssel zu erwerben:
        </p>
        <div className="support-overview-cta">
          {registered ? (
            <p className="support-overview-registered">
              <CheckCircle size={18} strokeWidth={2} aria-hidden="true" />
              Bereits registriert. Vielen Dank!
            </p>
          ) : (
            <button
              type="button"
              className="tab active support-overview-btn"
              onClick={() => onOpenRegistration?.()}
            >
              <Heart size={18} strokeWidth={2} aria-hidden />
              Zur Registrierung
            </button>
          )}
        </div>
      </section>

      <section className="glass-panel support-overview-section">
        <p className="support-overview-text">
          Oder du möchtest dich in Form eines Kaffees erkenntlich zeigen:
        </p>
        <div className="support-overview-cta">
          <BuyMeACoffeeButton />
        </div>
      </section>
    </div>
  );
}
