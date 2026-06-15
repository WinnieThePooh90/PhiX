const FOCUSABLE_SEL =
  'tbody input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]), tbody select:not([disabled])';

let installed = false;

export function isEnterAsTabKey(e) {
  return e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
}

function isVisibleFocusable(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.tabIndex < 0) return false;
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

export function getTableNavFocusables(table) {
  return Array.from(table.querySelectorAll(FOCUSABLE_SEL)).filter(isVisibleFocusable);
}

/** Nächstes/vorheriges Eingabefeld in derselben Tabelle (DOM-Reihenfolge). */
export function focusAdjacentTableField(current, reverse = false) {
  const table = current.closest('table');
  if (!table) return false;
  const list = getTableNavFocusables(table);
  const i = list.indexOf(current);
  if (i === -1) return false;
  const next = reverse ? i - 1 : i + 1;
  if (next < 0 || next >= list.length) return false;
  const target = list[next];
  target.focus();
  if (target instanceof HTMLInputElement && typeof target.select === 'function') {
    const type = (target.type || 'text').toLowerCase();
    if (type !== 'date' && type !== 'color') {
      try {
        target.select();
      } catch {
        /* ignore */
      }
    }
  }
  return true;
}

/** Enter in Tabellen-Eingabefeldern verhält sich wie Tab (nächstes Feld). */
export function installTableEnterAsTab() {
  if (installed) return;
  installed = true;

  document.addEventListener('keydown', (e) => {
    if (!isEnterAsTabKey(e) || e.defaultPrevented) return;

    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    if (!el.closest('table tbody')) return;

    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      if (['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'hidden'].includes(type)) return;
    }

    if (el.hasAttribute('data-score-task-input') || el.hasAttribute('data-oral-week-input')) return;

    e.preventDefault();
    focusAdjacentTableField(el, false);
  });
}
