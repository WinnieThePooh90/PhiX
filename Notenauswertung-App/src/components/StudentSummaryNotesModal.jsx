import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function StudentSummaryNotesModal({ open, onClose, student, initialText = '', onSave }) {
  const [draft, setDraft] = useState(initialText);

  useEffect(() => {
    if (open) setDraft(initialText ?? '');
  }, [open, initialText]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !student) return null;

  const trimmed = String(draft ?? '').trim();

  const handleSave = () => {
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  return createPortal(
    <div className="oral-formula-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="oral-formula-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-summary-notes-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 'min(28rem, calc(100vw - 2rem))' }}
      >
        <div className="oral-formula-modal-header">
          <h2 id="student-summary-notes-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            Notiz — {student.lastName}, {student.firstName}
          </h2>
        </div>
        <div className="oral-formula-modal-body">
          <textarea
            id="student-summary-notes-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            placeholder="Notiz eingeben …"
            aria-label="Notiz"
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.65rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'hsl(var(--background))',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              lineHeight: 1.45,
              resize: 'vertical',
              minHeight: '6.5rem',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.85rem' }}>
            <button type="button" className="tab secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="button" className="tab primary" onClick={handleSave} disabled={!trimmed}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
