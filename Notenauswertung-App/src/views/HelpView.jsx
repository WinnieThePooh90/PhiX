import React from 'react';
import { HELP_CONTACT_EMAIL } from '../config/help';

export default function HelpView() {
  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Hilfe</h3>
      <section className="program-view-panel glass-panel">
        <p className="program-view-panel-text">
          Du hast einen Fehler entdeckt oder kommst einfach nicht weiter? Du hast Fragen zu PhiX? Melde
          dich einfach unverbindlich bei mir:
        </p>
        <p className="program-view-panel-text" style={{ marginTop: '1rem' }}>
          <a href={`mailto:${HELP_CONTACT_EMAIL}`} className="help-contact-mail">
            {HELP_CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </div>
  );
}
