import { isAbiBaWue2026KeyFamilyId } from '../data/kmBwAbiPhysik2026GradingKey';
import { isAbiBaWue2026Mathematik100BeFamilyId } from '../data/abiBaWu2026Mathematik100BeGradingKey';
import { isVorlage1KeyFamilyId } from '../data/vorlage1GradingKey';

/** @param {unknown} raw */
export function parseCustomGradingKeys(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((k) => k && typeof k === 'object');
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((k) => k && typeof k === 'object') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** @param {unknown} key */
export function isSelectableCustomGradingKey(key) {
  if (!key || typeof key !== 'object') return false;
  const id = key.id;
  const name = key.name;
  if (id == null || String(id).trim() === '') return false;
  if (name == null || String(name).trim() === '') return false;
  if (isVorlage1KeyFamilyId(id)) return true;
  if (isAbiBaWue2026KeyFamilyId(id)) return true;
  if (isAbiBaWue2026Mathematik100BeFamilyId(id)) return true;
  return Array.isArray(key.bands) && key.bands.length > 0;
}

/** Alle im Kurs wählbaren eigenen Notenschlüssel (Klausuren, Tests, Projekte, …). */
export function listSelectableCustomGradingKeys(raw) {
  return parseCustomGradingKeys(raw).filter(isSelectableCustomGradingKey);
}

/** @param {unknown} course */
export function normalizeCourseCustomGradingKeys(course) {
  if (!course || typeof course !== 'object') return course;
  return {
    ...course,
    customGradingKeys: parseCustomGradingKeys(course.customGradingKeys),
  };
}
