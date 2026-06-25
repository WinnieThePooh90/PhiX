import React from 'react';
import { useDialog } from './PhixDialog';

/** Kleines „?“ in der Notenschlüssel-Überschrift: Klick öffnet Erklärung als Dialog-Popup. */
export default function GradingKeyHelpButton({
  text,
  title = 'Berechnung',
  ariaLabel = 'Berechnung des Notenschlüssels',
}) {
  const { showAlert } = useDialog();

  if (!text) return null;

  return (
    <button
      type="button"
      className="tab secondary"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        showAlert(text, { title });
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
    >
      ?
    </button>
  );
}
