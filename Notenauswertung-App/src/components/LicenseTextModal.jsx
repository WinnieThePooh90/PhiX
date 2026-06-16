import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Modal mit scrollbarem Lizenztext (PhiX oder npm-Abhängigkeit). */
export default function LicenseTextModal({ modal, onClose }) {
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
        aria-labelledby="license-text-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dependency-license-modal-header">
          <h2 id="license-text-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
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
