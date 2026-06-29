/** Kleinbuchstaben a–z für manuelles Anlegen/Bearbeiten. */
export const CLASS_SECTION_OPTIONS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function normalizeClassSection(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === '-') return '';
  if (!/^[a-z]{1,4}$/.test(s)) return null;
  return s;
}

/** Anzeige z. B. „10a“ oder nur „10“ ohne Teilklasse. */
export function formatRosterClassLabel(gradeLevel, classSection) {
  const sec = normalizeClassSection(classSection) ?? '';
  return sec ? `${gradeLevel}${sec}` : String(gradeLevel);
}

/** Teilklasse aus Klassenzelle (z. B. „10a“ → „a“, „Klasse 10“ → „“). */
export function parseClassSectionFromClassCell(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const s = String(raw).trim();
  if (!s) return '';
  const withoutGrade = s.replace(/^.*?(\d{1,2})/, '').trim();
  const m = withoutGrade.match(/^([a-z]+)/i);
  return m ? m[1].toLowerCase() : '';
}

/**
 * Eindeutige Teilklassen aus Schülerzeilen (z. B. nach Import), optional nur einer Stufe.
 * @param {Array<{ gradeLevel?: number, classSection?: string }>} rows
 * @param {{ gradeLevel?: number | null }} [opts]
 */
export function distinctClassSections(rows, { gradeLevel = null } = {}) {
  const set = new Set();
  for (const row of rows || []) {
    if (gradeLevel !== null && row.gradeLevel !== gradeLevel) continue;
    const sec = normalizeClassSection(row.classSection);
    if (sec) set.add(sec);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
}
