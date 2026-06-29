import { isEnterAsTabKey, scheduleScrollTableFieldIntoView } from './tableEnterAsTab';

export function scoreTaskInputDataAttr(scopeKey, rowKey, fieldIndex) {
  return `${scopeKey}__${String(rowKey)}__${fieldIndex}`;
}

export function focusScoreTaskInput(scopeKey, rowKey, fieldIndex) {
  const attr = scoreTaskInputDataAttr(scopeKey, rowKey, fieldIndex);
  const focusEl = () => {
    const el = document.querySelector(`[data-score-task-input="${CSS.escape(attr)}"]`);
    if (!el) return false;
    el.focus();
    if (typeof el.select === 'function') {
      try {
        el.select();
      } catch {
        /* ignore */
      }
    }
    scheduleScrollTableFieldIntoView(el);
    return true;
  };
  if (!focusEl()) {
    requestAnimationFrame(focusEl);
  }
}

export function createScoreTaskTabHandler({
  scopeKey,
  rowKey,
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
        focusScoreTaskInput(scopeKey, rowKey, fieldIndex + 1);
      } else {
        onTabForwardFromLastField?.();
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
