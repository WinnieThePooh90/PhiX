import React from 'react';
import { Heart, Coffee } from 'lucide-react';

export default function SupportOverviewView({ onOpenRegistration }) {
  return (
    <div className="view-generic-scroll program-view support-overview-view">
      <h3 className="program-view-title">Unterstützung</h3>

      <section className="glass-panel support-overview-section">
        <p className="support-overview-text">
          Du findest das Programm toll und möchtest mich als Entwickler unterstützen?
          Dann überlege dir doch, einen Registrierungsschlüssel zu erwerben:
        </p>
        <div className="support-overview-cta">
          <button
            type="button"
            className="tab active support-overview-btn"
            onClick={() => onOpenRegistration?.()}
          >
            <Heart size={18} strokeWidth={2} aria-hidden />
            Zur Registrierung
          </button>
        </div>
      </section>

      <section className="glass-panel support-overview-section">
        <p className="support-overview-text">
          Oder du möchtest dich in Form eines Kaffees erkenntlich zeigen:
        </p>
        <div className="support-overview-cta">
          <button
            type="button"
            className="tab active support-overview-btn support-overview-btn--coffee"
            onClick={() => {
              /* TODO: Buy Me a Coffee Link einfügen */
            }}
          >
            <Coffee size={18} strokeWidth={2} aria-hidden />
            Buy me a Coffee
          </button>
        </div>
      </section>
    </div>
  );
}
