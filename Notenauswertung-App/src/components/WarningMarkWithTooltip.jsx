import React, { useState, useRef, useEffect } from 'react';

/** Rotes „(!)“: Hover (`title`) und Klick öffnen denselben Hinweis als Popover. */
export default function WarningMarkWithTooltip({ text }) {
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
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-block', verticalAlign: 'baseline' }}>
      <button
        type="button"
        title={text}
        aria-label={text}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{
          margin: 0,
          padding: 0,
          border: 'none',
          background: 'none',
          font: 'inherit',
          fontWeight: 700,
          color: 'var(--danger)',
          cursor: 'pointer',
          userSelect: 'none',
          lineHeight: 'inherit',
        }}
      >
        (!)
      </button>
      {open ? (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '0.25rem',
            zIndex: 10050,
            minWidth: '12rem',
            maxWidth: 'min(22rem, calc(100vw - 2rem))',
            padding: '0.5rem 0.65rem',
            fontSize: '0.82rem',
            fontWeight: 500,
            lineHeight: 1.35,
            color: 'var(--foreground, inherit)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
            textAlign: 'left',
          }}
        >
          {text}
        </div>
      ) : null}
    </span>
  );
}
