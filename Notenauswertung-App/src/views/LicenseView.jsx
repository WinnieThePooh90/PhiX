import React, { useMemo, useState } from 'react';
import { APP_NAME } from '../config/app';
import LicenseTextModal from '../components/LicenseTextModal';
import {
  PHIX_COPYRIGHT,
  PHIX_LICENSE_SPDX,
  PHIX_LICENSE_SUMMARY,
  PHIX_LICENSE_TITLE,
  PHIX_THIRD_PARTY_HINT,
} from '../config/phixLicense';
import { PHIX_APACHE_LICENSE_TEXT } from '../data/phixLicenseText';
import { getDependencySections } from '../data/dependencyCatalog';

function uniqueRuntimeLicenses(sections) {
  const rows = [...sections.frontendRuntime, ...sections.backendRuntime];
  const byLicense = new Map();
  for (const row of rows) {
    const key = row.license.trim();
    if (!byLicense.has(key)) byLicense.set(key, []);
    byLicense.get(key).push(row.name);
  }
  return [...byLicense.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en'));
}

export default function LicenseView({ onOpenDependencies }) {
  const [licenseModal, setLicenseModal] = useState(null);
  const sections = useMemo(() => getDependencySections(), []);
  const runtimeLicenses = useMemo(() => uniqueRuntimeLicenses(sections), [sections]);

  const openPhixLicense = () => {
    setLicenseModal({
      title: `${APP_NAME} — ${PHIX_LICENSE_TITLE}`,
      text: PHIX_APACHE_LICENSE_TEXT,
    });
  };

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Lizenz</h3>
      <p className="text-muted program-view-intro">
        {APP_NAME} ist Open-Source-Software. Der Quellcode wird unter der{' '}
        <strong>Apache License 2.0</strong> ({PHIX_LICENSE_SPDX}) veröffentlicht.
      </p>

      <LicenseTextModal modal={licenseModal} onClose={() => setLicenseModal(null)} />

      <div className="program-view-stack">
        <section className="app-info-section glass-panel" aria-labelledby="phix-license-heading">
          <h4 id="phix-license-heading" className="program-view-panel-heading">
            {APP_NAME}-Programmlizenz
          </h4>
          <p className="program-view-panel-text text-muted" style={{ marginTop: 0 }}>
            <code className="app-info-code">{PHIX_LICENSE_SPDX}</code>
            {' · '}
            {PHIX_COPYRIGHT}
          </p>
          <ul className="phix-license-summary-list">
            {PHIX_LICENSE_SUMMARY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="program-view-panel-text" style={{ marginBottom: '0.75rem' }}>
            <button type="button" className="tab primary dependency-license-btn" onClick={openPhixLicense}>
              Vollständigen Lizenztext anzeigen
            </button>
          </p>
        </section>

        <section className="app-info-section glass-panel" aria-labelledby="phix-third-party-heading">
          <h4 id="phix-third-party-heading" className="program-view-panel-heading">
            Bibliotheken Dritter
          </h4>
          <p className="program-view-panel-text text-muted">{PHIX_THIRD_PARTY_HINT}</p>
          <p className="program-view-panel-text text-muted">
            In den Desktop-Builds sind zusätzlich <strong>Electron</strong> (MIT) und{' '}
            <strong>Chromium</strong> enthalten; deren Lizenz- und Urheberrechtshinweise liegen der
            Electron-Distribution bei.
          </p>
          <div className="app-info-license-list">
            {runtimeLicenses.map(([license, packages]) => (
              <article key={license} className="app-info-license-block">
                <h5 className="app-info-license-title">
                  <code className="app-info-code">{license}</code>
                </h5>
                <p className="app-info-license-text">
                  {packages.join(', ')}
                </p>
              </article>
            ))}
          </div>
          {onOpenDependencies ? (
            <p className="program-view-panel-text" style={{ marginBottom: 0 }}>
              <button type="button" className="tab secondary" onClick={onOpenDependencies}>
                Dependencies (detaillierte Paketliste)
              </button>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
