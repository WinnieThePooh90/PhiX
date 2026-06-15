import { isEnterAsTabKey } from './tableEnterAsTab';

export function scoreTaskInputDataAttr(scopeKey, rowKey, fieldIndex) {
  return `${scopeKey}__${rowKey}__${fieldIndex}`;
}

export function focusScoreTaskInput(scopeKey, rowKey, fieldIndex) {
  const attr = scoreTaskInputDataAttr(scopeKey, rowKey, fieldIndex);
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-score-task-input="${attr}"]`);
    el?.focus();
    el?.select?.();
  });
}

function parseScoreTaskInputEl(el) {
  const attr = el.getAttribute('data-score-task-input');
  if (!attr) return null;
  const lastSep = attr.lastIndexOf('__');
  if (lastSep < 0) return null;
  const fieldIndex = Number(attr.slice(lastSep + 1));
  const rest = attr.slice(0, lastSep);
  const rowSep = rest.lastIndexOf('__');
  if (rowSep < 0) return null;
  return {
    scopeKey: rest.slice(0, rowSep),
    rowKey: rest.slice(rowSep + 1),
    fieldIndex,
  };
}

export function createScoreTaskTabHandler({
  fieldIndex,
  effectiveFieldCount,
  onTabForwardFromLastField,
  onShiftTabFromFirstField,
}) {
  return (e) => {
    const isTab = e.key === 'Tab';
    const isEnterNav = isEnterAsTabKey(e);
    if (!isTab && !isEnterNav) return;

    if (isEnterNav) {
      e.preventDefault();
      if (fieldIndex < effectiveFieldCount - 1) {
        const parsed = parseScoreTaskInputEl(e.currentTarget);
        if (parsed) {
          focusScoreTaskInput(parsed.scopeKey, parsed.rowKey, fieldIndex + 1);
        }
      } else if (onTabForwardFromLastField) {
        onTabForwardFromLastField();
      }
      return;
    }

    if (e.shiftKey) {
      if (fieldIndex !== 0) return;
      if (!onShiftTabFromFirstField) return;
      e.preventDefault();
      onShiftTabFromFirstField();
      return;
    }
    if (fieldIndex !== effectiveFieldCount - 1) return;
    if (!onTabForwardFromLastField) return;
    e.preventDefault();
    onTabForwardFromLastField();
  };
}
