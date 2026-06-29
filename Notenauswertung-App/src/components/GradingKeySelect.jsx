import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LEGACY_BUILTIN_ABI_KEY_TYPE } from '../data/kmBwAbiPhysik2026GradingKey';
import {
  getBuiltinGradingKeySelectSuffix,
  getBuiltinGradingKeyTitle,
} from '../data/gradingKeyDisplay';
import { listCourseGradingKeysForSelect } from '../utils/courseArchive';

const BUILTIN_KEY_TYPES = ['1', '2', '3', '4', '5', '6'];

function GradingKeyOptionLabel({ title, suffix }) {
  if (!suffix) return title;
  return (
    <>
      {title}
      <span className="grading-key-select__suffix">{suffix}</span>
    </>
  );
}

/**
 * Notenschlüssel-Auswahl (eingebaut + kurs-eigene) für Klausuren, Tests, Projekte.
 * @param {{
 *   id?: string,
 *   className?: string,
 *   value?: string,
 *   onChange: (value: string) => void,
 *   course?: object|null,
 *   maxPoints?: unknown,
 *   showNotenpunkte?: boolean,
 * }} props
 */
export default function GradingKeySelect({
  id,
  className = 'course-meta-control',
  value,
  onChange,
  course,
  maxPoints,
  showNotenpunkte = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const selectedValue = value || '1';

  const options = useMemo(() => {
    const builtins = BUILTIN_KEY_TYPES.map((type) => {
      const title = getBuiltinGradingKeyTitle(type) || `Schlüssel ${type}`;
      const suffix = getBuiltinGradingKeySelectSuffix(type, maxPoints, showNotenpunkte);
      return { value: type, title, suffix };
    });

    const legacy =
      selectedValue === LEGACY_BUILTIN_ABI_KEY_TYPE
        ? [{ value: LEGACY_BUILTIN_ABI_KEY_TYPE, title: 'ABI BaWü 2026 120 BE', suffix: null }]
        : [];

    const custom = listCourseGradingKeysForSelect(course).map((k) => ({
      value: `custom:${k.id}`,
      title: k.name,
      suffix: null,
    }));

    return [...builtins, ...legacy, ...custom];
  }, [course, maxPoints, showNotenpunkte, selectedValue]);

  const selected = options.find((o) => o.value === selectedValue) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = (next) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="grading-key-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`grading-key-select__trigger ${className}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="grading-key-select__trigger-text">
          <GradingKeyOptionLabel title={selected?.title} suffix={selected?.suffix} />
        </span>
      </button>
      {open ? (
        <ul id={listId} role="listbox" className="grading-key-select__list" aria-labelledby={id}>
          {options.map((o) => (
            <li key={o.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={o.value === selectedValue}
                className="grading-key-select__option"
                onClick={() => handlePick(o.value)}
              >
                <GradingKeyOptionLabel title={o.title} suffix={o.suffix} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
