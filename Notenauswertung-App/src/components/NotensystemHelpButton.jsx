import React from 'react';
import { useDialog } from './PhixDialog';

const NOTENSYSTEM_HELP_TEXT =
  'Klassisches Notensystem: Noten von 1 bis 6 in 0,25er Schritten für die Unter- und Mittelstufe.\n\n'
  + 'Notenpunkte: Noten von 0-15 Notenpunkte für die Oberstufe.\n\n'
  + 'Das Notensystem kann auch später noch geändert werden.';

/** Fragezeichen-Hilfe zum Notensystem (Popup). */
export default function NotensystemHelpButton() {
  const { showAlert } = useDialog();

  return (
    <button
      type="button"
      className="tab secondary"
      aria-label="Hilfe zum Notensystem"
      onClick={(e) => {
        e.stopPropagation();
        showAlert(NOTENSYSTEM_HELP_TEXT, { title: 'Notensystem' });
      }}
      style={{
        width: '1.5rem',
        height: '1.5rem',
        minWidth: '1.5rem',
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
