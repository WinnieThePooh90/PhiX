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

const VORLAGE_1_ID = 'vorlage-1';

export function isVorlage1KeyFamilyId(id) {
  return typeof id === 'string' && (id === VORLAGE_1_ID || id.startsWith(`${VORLAGE_1_ID}~`));
}
