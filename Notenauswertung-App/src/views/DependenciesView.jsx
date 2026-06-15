import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getDependencySections, LICENSE_EXPLANATIONS } from '../data/dependencyCatalog';
import { getPackageLicenseText } from '../data/dependencyPackageLicenses';

function sectionSlug(title) {
  return String(title)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'section';
}

function LicenseTextModal({ modal, onClose }) {
  useEffect(() => {
    if (!modal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, onClose]);

  if (!modal) return null;

  return createPortal(
    <div
      className="dependency-license-modal-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="dependency-license-modal-dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependency-license-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dependency-license-modal-header">
          <h2 id="dependency-license-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            {modal.title}
          </h2>
          <button type="button" className="tab secondary" onClick={onClose}>
            Schließen
          </button>
        </div>
        <pre className="dependency-license-modal-body">{modal.text}</pre>
      </div>
    </div>,
    document.body,
  );
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

export default function DependenciesView() {
  const sections = useMemo(() => getDependencySections(), []);
  const [licenseModal, setLicenseModal] = useState(null);

  const allRows = useMemo(
    () => [
      ...sections.frontendRuntime,
      ...sections.frontendDev,
      ...sections.backendRuntime,
      ...sections.backendDev,
    ],
    [sections],
  );

  const usedLicenses = useMemo(() => {
    const set = new Set(allRows.map((r) => r.license.trim()));
    return LICENSE_EXPLANATIONS.filter((ex) => set.has(ex.id));
  }, [allRows]);

  const examplePackageForLicense = useMemo(() => {
    const map = new Map();
    for (const row of allRows) {
      if (!map.has(row.license) && getPackageLicenseText(row.name)) {
        map.set(row.license, row.name);
      }
    }
    return map;
  }, [allRows]);

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Dependencies</h3>
      <p className="text-muted program-view-intro">
        Übersicht der eingebundenen npm-Pakete (Laufzeit und Entwicklung). Frontend-Versionen stammen aus der{' '}
        <code className="app-info-code">package.json</code> der Web-App; Backend-Versionen aus{' '}
        <code className="app-info-code">src/data/backend-package.snapshot.json</code> (Kopie der Backend-Abhängigkeiten
        für den Build, z. B. Docker — bei Backend-Änderungen bitte mitpflegen).
      </p>

      <LicenseTextModal modal={licenseModal} onClose={() => setLicenseModal(null)} />

      <div className="program-view-stack">
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

        <section className="app-info-section glass-panel" aria-labelledby="app-deps-licenses-heading">
          <h4 id="app-deps-licenses-heading" className="program-view-panel-heading">
            Erläuterung der Lizenzen
          </h4>
          <p className="program-view-panel-text text-muted">
            Kurz erklärt. Bei Veröffentlichung oder Weitergabe Ihrer Anwendung die vollständigen Lizenztexte der Pakete
            beachten.
          </p>
          <div className="app-info-license-list">
            {usedLicenses.map((block) => (
              <article key={block.id} className="app-info-license-block">
                <h5 className="app-info-license-title">{block.title}</h5>
                <p className="app-info-license-text">{block.text}</p>
                {getPackageLicenseText(examplePackageForLicense.get(block.id)) ? (
                  <button
                    type="button"
                    className="tab secondary dependency-license-btn"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => {
                      const pkg = examplePackageForLicense.get(block.id);
                      const text = getPackageLicenseText(pkg);
                      if (!text) return;
                      setLicenseModal({
                        title: `Lizenztext — ${block.title} (Beispiel: ${pkg})`,
                        text,
                      });
                    }}
                  >
                    Lizenztext (Beispiel)
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
