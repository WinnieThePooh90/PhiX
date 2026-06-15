import React, { useState, useEffect, useRef, useId } from 'react';

const NOTENSYSTEM_HELP_TEXT =
  'Beim Wechsel werden gespeicherte manuelle Noten (Endnote, mündliche Note, GFS) automatisch umgerechnet und in der Datenbank im jeweiligen Format abgelegt (klassisch: Viertelnoten als Text, Punktesystem: ganze Zahlen 0–15). Beim Wechsel zurück auf klassisch werden Klausuren mit dem früheren eingebauten Schlüssel „ABI BaWü 2026 120 BE“ auf Plateau 1 gesetzt. Neu angelegte Klausuren und Projekte nutzen standardmäßig Plateau 1. ABI-Schlüssel können als Vorlage unter Notenschlüssel hinzugefügt werden.';

/** Fragezeichen neben der Notensystem-Auswahl: Hilfetext als Tooltip-Popover */
export default function NotensystemHelpButton() {
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

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        className="tab secondary"
        aria-label="Hilfe zum Notensystem"
        aria-expanded={open}
        aria-controls={`${uid}-notensystem-help-tooltip`}
        id={`${uid}-notensystem-help-trigger`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{
          width: '2rem',
          height: '2rem',
          minWidth: '2rem',
          padding: 0,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: '0.95rem',
          lineHeight: 1,
        }}
        title="Hilfe anzeigen"
      >
        ?
      </button>
      {open ? (
        <div
          id={`${uid}-notensystem-help-tooltip`}
          role="tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            left: 'auto',
            marginTop: '0.35rem',
            zIndex: 10050,
            minWidth: '14rem',
            maxWidth: 'min(32rem, calc(100vw - 2rem))',
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
          {NOTENSYSTEM_HELP_TEXT}
        </div>
      ) : null}
    </span>
  );
}
