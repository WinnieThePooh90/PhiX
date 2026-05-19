import React, { useMemo } from 'react';
import { getDependencySections, LICENSE_EXPLANATIONS } from '../data/dependencyCatalog';

function sectionSlug(title) {
  return String(title)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'section';
}

function DependencyTable({ title, rows }) {
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
  const usedLicenses = useMemo(() => {
    const all = [
      ...sections.frontendRuntime,
      ...sections.frontendDev,
      ...sections.backendRuntime,
      ...sections.backendDev,
    ];
    const set = new Set(all.map((r) => r.license.trim()));
    return LICENSE_EXPLANATIONS.filter((ex) => set.has(ex.id));
  }, [sections]);

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Dependencies</h3>
      <p className="text-muted program-view-intro">
        Übersicht der eingebundenen npm-Pakete (Laufzeit und Entwicklung). Frontend-Versionen stammen aus der{' '}
        <code className="app-info-code">package.json</code> der Web-App; Backend-Versionen aus{' '}
        <code className="app-info-code">src/data/backend-package.snapshot.json</code> (Kopie der Backend-Abhängigkeiten
        für den Build, z. B. Docker — bei Backend-Änderungen bitte mitpflegen).
      </p>

      <div className="program-view-stack">
        <DependencyTable title="Frontend — Laufzeit" rows={sections.frontendRuntime} />
        <DependencyTable title="Backend — Laufzeit" rows={sections.backendRuntime} />
        <DependencyTable title="Frontend — Entwicklung" rows={sections.frontendDev} />
        <DependencyTable title="Backend — Entwicklung" rows={sections.backendDev} />

        <section className="app-info-section glass-panel" aria-labelledby="app-deps-licenses-heading">
          <h4 id="app-deps-licenses-heading" className="program-view-panel-heading">
            Erläuterung der Lizenzen
          </h4>
          <p className="program-view-panel-text text-muted">
            Kurz erklärt: keine Rechtsberatung. Bei Veröffentlichung oder Weitergabe Ihrer Anwendung die vollständigen
            Lizenztexte der Pakete beachten.
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
