import {
  parseCustomGradingKeys,
  listSelectableCustomGradingKeys,
} from './customGradingKeys';

const CUSTOM_KEY_PREFIX = 'custom:';

export function isCourseArchived(course) {
  return course?.archived === true;
}

/** Alle in Klausuren/Tests/Projekten referenzierten custom:-Schlüssel-IDs. */
export function collectUsedCustomGradingKeyIds(exams, tests, projects) {
  const ids = new Set();
  const scan = (keyType) => {
    if (typeof keyType === 'string' && keyType.startsWith(CUSTOM_KEY_PREFIX)) {
      ids.add(keyType.slice(CUSTOM_KEY_PREFIX.length));
    }
  };
  Object.values(exams || {}).forEach((e) => scan(e?.keyType));
  Object.values(tests || {}).forEach((t) => scan(t?.keyType));
  Object.values(projects || {}).forEach((p) => scan(p?.keyType));
  return ids;
}

/**
 * Snapshot der beim Archivieren genutzten Notenschlüssel (volle Definitionen).
 * @param {unknown} customGradingKeys
 * @param {Set<string>|string[]} usedIds
 */
export function buildArchivedGradingKeysSnapshot(customGradingKeys, usedIds) {
  const idSet = usedIds instanceof Set ? usedIds : new Set(usedIds);
  const list = parseCustomGradingKeys(customGradingKeys);
  return list
    .filter((k) => idSet.has(String(k?.id)))
    .map((k) => ({
      ...k,
      bands: Array.isArray(k.bands) ? k.bands.map((b) => ({ ...b })) : k.bands,
    }));
}

/**
 * Lookup-Liste für Notenberechnung: aktive + archivierte Snapshots (Snapshot gewinnt bei Konflikt).
 * @param {unknown} course
 */
export function getCourseGradingKeysLookup(course) {
  const active = parseCustomGradingKeys(course?.customGradingKeys);
  const archived = parseCustomGradingKeys(course?.archivedGradingKeys);
  const byId = new Map();
  for (const k of active) {
    if (k?.id != null) byId.set(String(k.id), k);
  }
  for (const k of archived) {
    if (k?.id != null) byId.set(String(k.id), k);
  }
  return [...byId.values()];
}

/** Auswahl-Dropdown: bei archivierten Kursen auch Snapshots anzeigen. */
export function listCourseGradingKeysForSelect(course) {
  if (isCourseArchived(course)) {
    return listSelectableCustomGradingKeys(getCourseGradingKeysLookup(course));
  }
  return listSelectableCustomGradingKeys(course?.customGradingKeys);
}

export function normalizeCourseArchiveFields(course) {
  if (!course || typeof course !== 'object') return course;
  return {
    ...course,
    archived: course.archived === true,
    archivedGradingKeys: parseCustomGradingKeys(course.archivedGradingKeys),
  };
}
