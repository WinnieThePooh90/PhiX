import React from 'react';
import { LEGACY_BUILTIN_ABI_KEY_TYPE } from '../data/kmBwAbiPhysik2026GradingKey';
import { listCourseGradingKeysForSelect } from '../utils/courseArchive';

/**
 * Optionen für eingebaute + kurs-eigene Notenschlüssel (Klausuren, Tests, Projekte).
 * @param {{ course?: object|null, selectedKeyType?: string }} props
 */
export default function CustomGradingKeySelectOptions({ course, selectedKeyType }) {
  const customKeysList = listCourseGradingKeysForSelect(course);
  return (
    <>
      <option value="1">Plateau 1</option>
      <option value="2">Plateau 2</option>
      <option value="3">Plateau 3</option>
      <option value="4">Linear 1</option>
      <option value="5">Linear 2</option>
      <option value="6">Linear 3</option>
      {selectedKeyType === LEGACY_BUILTIN_ABI_KEY_TYPE ? (
        <option value={LEGACY_BUILTIN_ABI_KEY_TYPE}>ABI BaWü 2026 120 BE</option>
      ) : null}
      {customKeysList.map((k) => (
        <option key={k.id} value={`custom:${k.id}`}>
          {k.name}
        </option>
      ))}
    </>
  );
}
