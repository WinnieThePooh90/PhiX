const FOCUSABLE_SEL =
  'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]), select:not([disabled]), textarea:not([disabled])';

const TABLE_SCROLL_ROOT_SEL =
  '.view-table-scroll, .view-page-scroll, .exam-table-scroll, .table-max-host__body, .gfs-table-scroll, .oral-table-scroll, .referate-table-scroll';

let installed = false;

function isScrollableOverflow(value) {
  return value === 'auto' || value === 'scroll' || value === 'overlay';
}

function elementScrollAxes(node) {
  if (!(node instanceof HTMLElement)) return { x: false, y: false };
  const style = getComputedStyle(node);
  const canScrollX =
    isScrollableOverflow(style.overflowX) || isScrollableOverflow(style.overflow);
  const canScrollY =
    isScrollableOverflow(style.overflowY) || isScrollableOverflow(style.overflow);
  return {
    x: canScrollX && node.scrollWidth > node.clientWidth + 1,
    y: canScrollY && node.scrollHeight > node.clientHeight + 1,
  };
}

function findTableScrollContainer(fieldEl) {
  let node = fieldEl.parentElement;
  let markedFallback = null;

  while (node && node !== document.documentElement) {
    if (!markedFallback && node.matches?.(TABLE_SCROLL_ROOT_SEL)) {
      markedFallback = node;
    }
    const { x, y } = elementScrollAxes(node);
    if (x || y) return node;
    node = node.parentElement;
  }

  return markedFallback;
}

/** Sticky thead/-spalten verringern den sichtbaren Bereich im Scroll-Container. */
function measureStickyInsets(container, table) {
  const cr = container.getBoundingClientRect();
  let left = 0;
  let right = 0;
  let top = 0;

  for (const cell of table.querySelectorAll('th, td')) {
    if (!(cell instanceof HTMLElement)) continue;
    const style = getComputedStyle(cell);
    if (style.position !== 'sticky') continue;
    const r = cell.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;

    const stickyTop = parseFloat(style.top);
    if (Number.isFinite(stickyTop) && stickyTop >= 0 && r.top <= cr.top + 1 && r.bottom > cr.top) {
      top = Math.max(top, r.bottom - cr.top);
    }

    const stickyLeft = parseFloat(style.left);
    if (Number.isFinite(stickyLeft) && stickyLeft >= 0 && r.left <= cr.left + 1 && r.right > cr.left) {
      left = Math.max(left, r.right - cr.left);
    }

    const stickyRight = parseFloat(style.right);
    if (Number.isFinite(stickyRight) && stickyRight >= 0 && r.right >= cr.right - 1 && r.left < cr.right) {
      right = Math.max(right, cr.right - r.left);
    }
  }

  return { left, right, top };
}

/** Scrollt Tabellen-Eingabefelder in den sichtbaren Bereich (inkl. horizontaler Aufgaben-Spalten). */
export function scrollTableFieldIntoView(fieldEl) {
  if (!(fieldEl instanceof HTMLElement)) return;
  const cell = fieldEl.closest('td, th') ?? fieldEl;
  const table = fieldEl.closest('table');
  const container = findTableScrollContainer(fieldEl);

  if (!(container instanceof HTMLElement) || !table) {
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }

  const pad = 6;
  const cr = container.getBoundingClientRect();
  const insets = measureStickyInsets(container, table);
  const visible = {
    left: cr.left + insets.left + pad,
    right: cr.right - insets.right - pad,
    top: cr.top + insets.top + pad,
    bottom: cr.bottom - pad,
  };
  const fr = cell.getBoundingClientRect();

  let dx = 0;
  if (fr.right > visible.right) dx = fr.right - visible.right;
  else if (fr.left < visible.left) dx = fr.left - visible.left;

  let dy = 0;
  if (fr.bottom > visible.bottom) dy = fr.bottom - visible.bottom;
  else if (fr.top < visible.top) dy = fr.top - visible.top;

  if (dx !== 0 || dy !== 0) {
    container.scrollBy({ left: dx, top: dy, behavior: 'auto' });
  }
}

export function scheduleScrollTableFieldIntoView(fieldEl) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scrollTableFieldIntoView(fieldEl));
  });
}

function isTableFieldFocusTarget(el) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (!el.closest('table')) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'hidden'].includes(type)) return false;
  }
  return true;
}

function focusTableField(target) {
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
  scheduleScrollTableFieldIntoView(target);
}

export function isEnterAsTabKey(e) {
  return (e.key === 'Enter' || e.code === 'NumpadEnter') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
}

function isVisibleFocusable(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.tabIndex < 0) return false;
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

export function getTableNavFocusables(table) {
  return Array.from(table.querySelectorAll(FOCUSABLE_SEL)).filter(isVisibleFocusable);
}

/** Nächstes/vorheriges Eingabefeld in derselben Tabellenspalte (data-summary-grade-input). */
export function focusAdjacentSummaryGradeInput(current, reverse = false) {
  if (!(current instanceof HTMLInputElement)) return false;
  const field = current.getAttribute('data-summary-grade-input');
  if (!field) return false;
  const table = current.closest('table');
  if (!table) return false;
  const list = Array.from(
    table.querySelectorAll(`input[data-summary-grade-input="${CSS.escape(field)}"]`),
  ).filter(isVisibleFocusable);
  const i = list.indexOf(current);
  if (i === -1) return false;
  const next = reverse ? i - 1 : i + 1;
  if (next < 0 || next >= list.length) return false;
  const target = list[next];
  focusTableField(target);
  return true;
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
  focusTableField(list[next]);
  return true;
}

/** Enter in Tabellen-Eingabefeldern verhält sich wie Tab (nächstes Feld). */
export function handleTableEnterAsTab(e) {
  if (!isEnterAsTabKey(e)) return;
  e.preventDefault();
  focusAdjacentTableField(e.currentTarget, false);
}

/** Enter in Tabellen-Eingabefeldern verhält sich wie Tab (nächstes Feld). */
export function installTableEnterAsTab() {
  if (installed) return;
  installed = true;

  document.addEventListener('keydown', (e) => {
    if (!isEnterAsTabKey(e) || e.defaultPrevented) return;

    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    if (!el.closest('table')) return;

    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      if (['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'hidden'].includes(type)) return;
    }

    if (el.hasAttribute('data-score-task-input') || el.hasAttribute('data-oral-week-input')) return;

    e.preventDefault();
    focusAdjacentTableField(el, false);
  });

  document.addEventListener('focusin', (e) => {
    if (!isTableFieldFocusTarget(e.target)) return;
    scheduleScrollTableFieldIntoView(e.target);
  });
}
