import { isAbiBaWue2026KeyFamilyId } from '../data/kmBwAbiPhysik2026GradingKey';
import { isAbiBaWue2026Mathematik100BeFamilyId } from '../data/abiBaWu2026Mathematik100BeGradingKey';

/**
 * Tooltip für rotes „(!)“, wenn die (simulierten) Maximalpunkte nicht zur ABI-BaWü-Vorlage passen.
 * @param {unknown} keyId — `customGradingKeys[].id`
 * @param {unknown} simulatedMaxPoints
 * @returns {string | null}
 */
export function abiTemplateSimulatedMaxMismatchTooltip(keyId, simulatedMaxPoints) {
  if (typeof keyId !== 'string') return null;
  const mp = Number(simulatedMaxPoints);
  if (isAbiBaWue2026KeyFamilyId(keyId)) {
    if (Number.isFinite(mp) && mp === 120) return null;
    return 'Notenschlüssel für 120 Berechnungseinheiten ausgelegt';
  }
  if (isAbiBaWue2026Mathematik100BeFamilyId(keyId)) {
    if (Number.isFinite(mp) && mp === 100) return null;
    return 'Notenschlüssel für 100 Berechnungseinheiten ausgelegt';
  }
  return null;
}
