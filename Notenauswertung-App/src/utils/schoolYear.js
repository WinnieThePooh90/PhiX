/** Aktuelles Schuljahr als „YYYY/YYYY+1“ (z. B. 2026/2027). */
export function defaultSchoolYear() {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

/** Erstes vierstelliges Jahr in einem Schuljahres-String für Sortierung. */
export function schoolYearStartForSort(yearRaw) {
  const m = String(yearRaw ?? '').trim().match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

export function sortSchoolYears(years) {
  return [...(years || [])].sort(
    (a, b) => schoolYearStartForSort(b.label) - schoolYearStartForSort(a.label),
  );
}

export function normalizeSchoolYearLabel(raw) {
  const label = String(raw ?? '').trim();
  if (!label) return { error: 'Bitte ein Schuljahr eintragen (z. B. 2026/2027).' };
  if (label.length > 32) return { error: 'Schuljahr ist zu lang (max. 32 Zeichen).' };
  return { label };
}
