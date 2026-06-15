/**
 * Schülerfilter für Tabellen (Übersicht, Klausuren, Mündlich, Tests, Projekte, GFS).
 * - Leere Suche → `null` (alle Schüler).
 * - Nicht leere Suche → `Set` der passenden IDs (auch leeres Set, wenn niemand passt).
 */
export function resolveStudentIdFilterSet(students, queryRaw) {
  const q = String(queryRaw ?? '').trim().toLowerCase();
  if (!q) return null;

  const matches = (students || []).filter((s) => {
    const fn = String(s.firstName ?? '').toLowerCase();
    const ln = String(s.lastName ?? '').toLowerCase();
    const full = `${fn} ${ln}`.trim();
    const num = String(s.studentNumber ?? '').trim();
    if (fn.includes(q) || ln.includes(q) || full.includes(q)) return true;
    if (num && num.includes(q)) return true;
    return false;
  });

  return new Set(matches.map((s) => s.id));
}
