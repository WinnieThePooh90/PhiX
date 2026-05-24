import React from 'react';

/**
 * Standard-Checkbox mit Label-Rahmen (wie Listen-Popup / Facheinstellungen).
 * Für Toggle-Schalter weiterhin <label className="switch"> verwenden.
 */
export default function PhixCheckboxOption({
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  children,
  wrap = false,
  className = '',
  id,
  name,
  title,
  'aria-label': ariaLabel,
}) {
  return (
    <label
      className={`phix-checkbox-option${wrap ? ' phix-checkbox-option--wrap' : ''}${className ? ` ${className}` : ''}`}
      title={title}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <span>{children}</span>
    </label>
  );
}
