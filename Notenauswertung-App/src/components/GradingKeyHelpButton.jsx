import React, { useState, useEffect, useRef, useId } from 'react';

/** Kleines „?“ rechts in der Notenschlüssel-Überschrift: Klick öffnet Erklärung als Popover. */
export default function GradingKeyHelpButton({ text, ariaLabel = 'Berechnung des Notenschlüssels' }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!text) return null;

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        className="tab secondary"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={`${uid}-grading-key-help`}
        id={`${uid}-grading-key-help-trigger`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{
          width: '1.65rem',
          height: '1.65rem',
          minWidth: '1.65rem',
          padding: 0,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: '0.82rem',
          lineHeight: 1,
        }}
        title="Berechnung anzeigen"
      >
        ?
      </button>
      {open ? (
        <div
          id={`${uid}-grading-key-help`}
          role="tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            left: 'auto',
            marginTop: '0.35rem',
            zIndex: 10050,
            minWidth: '12rem',
            maxWidth: 'min(28rem, calc(100vw - 2rem))',
            padding: '0.65rem 0.75rem',
            fontSize: '0.82rem',
            fontWeight: 500,
            lineHeight: 1.45,
            color: 'var(--foreground, inherit)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
            textAlign: 'left',
          }}
        >
          {text}
        </div>
      ) : null}
    </span>
  );
}
