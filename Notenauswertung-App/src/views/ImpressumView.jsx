import React from 'react';
import { IMPRESSUM_SECTIONS } from '../config/impressum';
import LegalContentSections from '../components/LegalContentSections';

export default function ImpressumView() {
  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Impressum</h3>
      <p className="text-muted program-view-intro">
        Angaben gemäß Telemediengesetz (TMG) und Medienstaatsvertrag (MStV).
      </p>

      <LegalContentSections sections={IMPRESSUM_SECTIONS} />
    </div>
  );
}
