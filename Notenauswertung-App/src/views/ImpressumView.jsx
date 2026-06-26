import React from 'react';
import { APP_NAME } from '../config/app';
import { IMPRESSUM_SECTIONS } from '../config/impressum';
import LegalContentSections from '../components/LegalContentSections';

export default function ImpressumView() {
  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Impressum</h3>
      <p className="text-muted program-view-intro">
        {APP_NAME} wird von Ihnen lokal betrieben — dieses Impressum betrifft den Softwarehersteller, nicht die
        Inhalte in Ihrer Instanz.
      </p>

      <LegalContentSections sections={IMPRESSUM_SECTIONS} />
    </div>
  );
}
