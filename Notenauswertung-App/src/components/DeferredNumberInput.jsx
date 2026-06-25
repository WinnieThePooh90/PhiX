import React, { useEffect, useState } from 'react';

/**
 * Parses a numeric input string; returns `defaultValue` when empty/invalid.
 */
export function parseCommittedNumber(raw, { defaultValue = 0, min, max, integer = false } = {}) {
  const trimmed = String(raw ?? '').trim().replace(',', '.');
  if (trimmed === '' || trimmed === '-') return defaultValue;
  let n = integer ? parseInt(trimmed, 10) : parseFloat(trimmed);
  if (!Number.isFinite(n)) return defaultValue;
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  if (integer) n = Math.round(n);
  return n;
}

function formatDisplay(value, defaultValue) {
  if (value === '' || value == null || Number.isNaN(Number(value))) return String(defaultValue);
  return String(value);
}

/**
 * Numeric input: field may be empty while typing; value commits on blur.
 */
export default function DeferredNumberInput({
  value,
  onChange,
  defaultValue = 0,
  min,
  max,
  integer = false,
  className,
  style,
  id,
  onFocus,
  onBlur,
  onMouseDown,
  onClick,
  ...rest
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!editing) {
      setDraft(formatDisplay(value, defaultValue));
    }
  }, [value, defaultValue, editing]);

  const commit = () => {
    const next = parseCommittedNumber(draft, { defaultValue, min, max, integer });
    onChange(next);
    setDraft(String(next));
  };

  return (
    <input
      {...rest}
      id={id}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      className={className}
      style={style}
      value={editing ? draft : formatDisplay(value, defaultValue)}
      onFocus={(e) => {
        setEditing(true);
        setDraft(formatDisplay(value, defaultValue));
        onFocus?.(e);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        setEditing(false);
        commit();
        onBlur?.(e);
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    />
  );
}
