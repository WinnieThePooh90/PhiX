import React from 'react';
import {
  ORAL_EXTENDED_MODE_ORDER,
  getOralExtendedModeLabel,
  normalizeOralExtendedMode,
} from '../utils/oralExtendedMode';

export default function OralExtendedModeSwitch({ mode, onChange, disabled = false, title }) {
  const current = normalizeOralExtendedMode(mode);
  const currentIndex = ORAL_EXTENDED_MODE_ORDER.indexOf(current);

  const handleClick = () => {
    if (disabled) return;
    const next = ORAL_EXTENDED_MODE_ORDER[(currentIndex + 1) % ORAL_EXTENDED_MODE_ORDER.length];
    onChange(next);
  };

  return (
    <button
      type="button"
      className={`oral-extended-mode-switch oral-extended-mode-switch--${current}`}
      onClick={handleClick}
      disabled={disabled}
      title={title ?? 'Erweitert: aus · Punkte · Noten'}
      aria-label={getOralExtendedModeLabel(current)}
      aria-pressed={current !== 'off'}
    >
      <span className="oral-extended-mode-switch__track" aria-hidden>
        <span className="oral-extended-mode-switch__thumb" />
      </span>
    </button>
  );
}
