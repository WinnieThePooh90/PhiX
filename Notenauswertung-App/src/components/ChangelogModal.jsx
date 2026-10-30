import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CHANGELOG_ITEMS } from '../data/changelogItems';

export default function ChangelogModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="dependency-license-modal-backdrop app-changelog-modal-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="dependency-license-modal-dialog glass-panel app-changelog-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dependency-license-modal-header app-changelog-modal-header">
          <div>
            <h2 id="changelog-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Changelog & Versionsverlauf
            </h2>
            <p className="text-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
              Neueste Änderungen und Updates im Überblick
            </p>
          </div>
          <button type="button" className="tab secondary" onClick={onClose}>
            Schließen
          </button>
        </div>
        <div className="app-changelog-modal-body">
          <div className="app-changelog-list">
            {CHANGELOG_ITEMS.map((item) => (
              <article key={item.build} className="app-changelog-entry">
                <header className="app-changelog-entry-header">
                  <div className="app-changelog-badge-row">
                    <span className="app-changelog-build-badge">Build {item.build}</span>
                    <time className="app-changelog-date">{item.date}</time>
                  </div>
                  <h3 className="app-changelog-entry-title">{item.title}</h3>
                </header>
                <ul className="app-changelog-bullet-list">
                  {item.highlights.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
