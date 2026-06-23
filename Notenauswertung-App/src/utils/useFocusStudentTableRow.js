import { useEffect, useRef } from 'react';

/**
 * Scrollt zur Tabellenzeile eines Schülers und hebt sie kurz hervor (z. B. nach Klick auf Übersicht-Fähnchen).
 */
export function useFocusStudentTableRow(focusStudentId, rowStudentIds, onFocusConsumed) {
  const rowRefs = useRef({});

  useEffect(() => {
    if (!focusStudentId) return undefined;
    const row = rowRefs.current[focusStudentId];
    if (!row) return undefined;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('table-row--focus');
    onFocusConsumed?.();
    const t = window.setTimeout(() => row.classList.remove('table-row--focus'), 4000);
    return () => window.clearTimeout(t);
  }, [focusStudentId, rowStudentIds, onFocusConsumed]);

  const setRowRef = (studentId, el) => {
    if (el) rowRefs.current[studentId] = el;
    else delete rowRefs.current[studentId];
  };

  return setRowRef;
}
