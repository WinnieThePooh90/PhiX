/**
 * Notenschlüssel-Vorlage „Vorlage 1“ (= eingebauter Schlüssel 1, K = 1,05).
 */

import {
  buildFormulaBands,
  gradeFromFormulaPoints,
} from './formulaGradingKey';

const VORLAGE_1_INTERCEPT = 1.05;

export const buildVorlage1Bands = (maxPoints) => buildFormulaBands(maxPoints, VORLAGE_1_INTERCEPT);

export const gradeFromVorlage1Points = (points, maxPoints) =>
  gradeFromFormulaPoints(points, maxPoints, VORLAGE_1_INTERCEPT);

export const VORLAGE_1_KEY = {
  id: 'vorlage-1',
  name: 'Vorlage 1',
  template: 'vorlage1',
  referenceMaxPoints: 50,
  bands: [],
};

export function isVorlage1KeyFamilyId(id) {
  return typeof id === 'string' && (id === VORLAGE_1_KEY.id || id.startsWith(`${VORLAGE_1_KEY.id}~`));
}

export function nextVorlage1TemplateCloneIdentity(existingKeys) {
  const baseId = VORLAGE_1_KEY.id;
  const baseName = VORLAGE_1_KEY.name;
  const list = Array.isArray(existingKeys) ? existingKeys : [];
  const names = new Set(list.map((k) => k.name));
  const ids = new Set(list.map((k) => k.id));

  if (!ids.has(baseId)) {
    let name = baseName;
    if (names.has(baseName)) {
      let n = 1;
      while (names.has(`${baseName} (${n})`)) n += 1;
      name = `${baseName} (${n})`;
    }
    return { id: baseId, name };
  }

  let n = 1;
  for (;;) {
    const name = `${baseName} (${n})`;
    const id = `${baseId}~${n}`;
    if (!names.has(name) && !ids.has(id)) return { id, name };
    n += 1;
  }
}
