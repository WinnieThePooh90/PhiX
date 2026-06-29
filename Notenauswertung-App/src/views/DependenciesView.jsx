import React, { useMemo, useState } from 'react';
import { APP_NAME } from '../config/app';
import LicenseTextModal from '../components/LicenseTextModal';
import {
  PHIX_COPYRIGHT,
  PHIX_LICENSE_SPDX,
  PHIX_LICENSE_TITLE,
} from '../config/phixLicense';
import { PHIX_APACHE_LICENSE_TEXT } from '../data/phixLicenseText';
import { getDependencySections, LICENSE_EXPLANATIONS } from '../data/dependencyCatalog';
import { getPackageLicenseText } from '../data/dependencyPackageLicenses';

function sectionSlug(title) {
  return String(title)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'section';
}

function buildLicenseModalContent(row) {
  const text = getPackageLicenseText(row.name);
  if (text) {
    return {
      title: `Lizenz — ${row.name} (${row.license})`,
      text,
    };
  }
  return {
    title: `Lizenz — ${row.name}`,
    text: `Für „${row.name}“ ist kein Lizenztext hinterlegt (${row.license}).\n\nBitte den vollständigen Lizenztext im npm-Paket oder unter node_modules/${row.name}/LICENSE nachlesen.`,
  };
}

function DependencyTable({ title, rows, onShowLicense }) {
  if (!rows?.length) return null;
  const sid = `app-deps-${sectionSlug(title)}`;
  return (
    <section className="app-info-section glass-panel" aria-labelledby={sid}>
      <h4 id={sid} className="program-view-panel-heading">
        {title}
      </h4>
      <div className="app-info-table-wrap">
        <table className="app-info-table">
          <thead>
            <tr>
              <th scope="col">Paket</th>
              <th scope="col">Version</th>
              <th scope="col">Nutzen</th>
              <th scope="col">Lizenz</th>
              <th scope="col">Lizenztext</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.scope}-${r.name}`}>
                <td>
                  <code className="app-info-code">{r.name}</code>
                </td>
                <td>
                  <code className="app-info-code">{r.version}</code>
                </td>
                <td>{r.purpose}</td>
                <td>
                  <code className="app-info-code">{r.license}</code>
                </td>
                <td className="app-info-table__actions-col">
                  <button
                    type="button"
                    className="tab secondary dependency-license-btn"
                    onClick={() => onShowLicense(buildLicenseModalContent(r))}
                  >
                    Lizenztext
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DependenciesView({ onOpenLicense }) {
  const sections = useMemo(() => getDependencySections(), []);
  const [licenseModal, setLicenseModal] = useState(null);

  const allRows = useMemo(
    () => [
      ...sections.frontendRuntime,
      ...sections.frontendDev,
      ...sections.backendRuntime,
      ...sections.backendDev,
      ...sections.desktopBuild,
    ],
    [sections],
  );

  const usedLicenses = useMemo(() => {
    const set = new Set(allRows.map((r) => r.license.trim()));
    return LICENSE_EXPLANATIONS.filter((ex) => set.has(ex.id));
  }, [allRows]);

  const openPhixLicense = () => {
    setLicenseModal({
      title: `${APP_NAME} — ${PHIX_LICENSE_TITLE}`,
      text: PHIX_APACHE_LICENSE_TEXT,
    });
  };

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Dependencies</h3>
      <p className="text-muted program-view-intro">
        Übersicht der eingebundenen npm-Pakete (Laufzeit und Entwicklung). {APP_NAME} selbst steht unter der{' '}
        <strong>Apache License 2.0</strong> ({PHIX_LICENSE_SPDX}, {PHIX_COPYRIGHT}). Frontend-Versionen stammen aus
        der <code className="app-info-code">package.json</code> der Web-App; Backend- und Desktop-Versionen aus{' '}
        <code className="app-info-code">src/data/backend-package.snapshot.json</code> bzw.{' '}
        <code className="app-info-code">desktop-package.snapshot.json</code> (Kopien für den Build, z. B. Docker —
        bei Änderungen in <code className="app-info-code">backend/</code> oder <code className="app-info-code">desktop/</code>{' '}
        bitte mitpflegen).
      </p>

      <LicenseTextModal modal={licenseModal} onClose={() => setLicenseModal(null)} />

      <div className="program-view-stack">
        <section className="app-info-section glass-panel" aria-labelledby="app-deps-phix-license-heading">
          <h4 id="app-deps-phix-license-heading" className="program-view-panel-heading">
            {APP_NAME}-Programmlizenz
          </h4>
          <p className="program-view-panel-text text-muted" style={{ marginTop: 0 }}>
            Der Quellcode von {APP_NAME} ist Open Source unter{' '}
            <code className="app-info-code">{PHIX_LICENSE_SPDX}</code>. Die nachfolgenden Tabellen betreffen nur
            eingebundene Bibliotheken Dritter.
          </p>
          <p className="program-view-panel-text" style={{ marginBottom: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="tab primary dependency-license-btn" onClick={openPhixLicense}>
              PhiX-Lizenztext
            </button>
            {onOpenLicense ? (
              <button type="button" className="tab secondary" onClick={onOpenLicense}>
                Lizenz-Übersicht
              </button>
            ) : null}
          </p>
        </section>

        <DependencyTable
          title="Frontend — Laufzeit"
          rows={sections.frontendRuntime}
          onShowLicense={setLicenseModal}
        />
        <DependencyTable
          title="Backend — Laufzeit"
          rows={sections.backendRuntime}
          onShowLicense={setLicenseModal}
        />
        <DependencyTable
          title="Frontend — Entwicklung"
          rows={sections.frontendDev}
          onShowLicense={setLicenseModal}
        />
        <DependencyTable
          title="Backend — Entwicklung"
          rows={sections.backendDev}
          onShowLicense={setLicenseModal}
        />
        <DependencyTable
          title="Desktop — Build (Electron)"
          rows={sections.desktopBuild}
          onShowLicense={setLicenseModal}
        />

        <section className="app-info-section glass-panel" aria-labelledby="app-deps-licenses-heading">
          <h4 id="app-deps-licenses-heading" className="program-view-panel-heading">
            Erläuterung der Lizenzen (Drittanbieter)
          </h4>
          <p className="program-view-panel-text text-muted">
            Kurz erklärt. Bei Weitergabe oder Veröffentlichung der Anwendung die vollständigen Lizenztexte der Pakete
            sowie die PhiX-Apache-2.0-Lizenz beachten.
          </p>
          <div className="app-info-license-list">
            {usedLicenses.map((block) => (
              <article key={block.id} className="app-info-license-block">
                <h5 className="app-info-license-title">{block.title}</h5>
                <p className="app-info-license-text">{block.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
