import React from 'react';

/**
 * Standard-Radio mit Label-Rahmen (gleiches Erscheinungsbild wie PhixCheckboxOption).
 */
export default function PhixRadioOption({
  name,
  value,
  checked,
  onChange,
  disabled = false,
  children,
  wrap = false,
  className = '',
  title,
}) {
  return (
    <label
      className={`phix-radio-option phix-checkbox-option${wrap ? ' phix-checkbox-option--wrap' : ''}${className ? ` ${className}` : ''}`}
      title={title}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span>{children}</span>
    </label>
  );
}
