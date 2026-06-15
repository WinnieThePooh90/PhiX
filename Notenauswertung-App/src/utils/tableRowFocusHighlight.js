const FOCUSABLE = 'input, select, textarea';

let installed = false;

/** Setzt `table-row--focus` auf die Zeile mit aktivem Eingabefeld (alle Tabellen). */
export function installTableRowFocusHighlight() {
  if (installed) return;
  installed = true;
  const clearAll = () => {
    document.querySelectorAll('table tbody tr.table-row--focus').forEach((row) => {
      row.classList.remove('table-row--focus');
    });
  };

  const onFocusIn = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches(FOCUSABLE)) return;
    const row = el.closest('table tbody tr');
    if (!row) return;
    clearAll();
    row.classList.add('table-row--focus');
  };

  const onFocusOut = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches(FOCUSABLE)) return;
    const row = el.closest('table tbody tr');
    if (!row) return;
    requestAnimationFrame(() => {
      if (!row.contains(document.activeElement)) row.classList.remove('table-row--focus');
    });
  };

  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
}
