export function scoreTaskInputDataAttr(scopeKey, rowKey, fieldIndex) {
  return `${scopeKey}__${rowKey}__${fieldIndex}`;
}

export function focusScoreTaskInput(scopeKey, rowKey, fieldIndex) {
  const attr = scoreTaskInputDataAttr(scopeKey, rowKey, fieldIndex);
  requestAnimationFrame(() => {
    document.querySelector(`[data-score-task-input="${attr}"]`)?.focus();
  });
}

export function createScoreTaskTabHandler({
  fieldIndex,
  effectiveFieldCount,
  onTabForwardFromLastField,
  onShiftTabFromFirstField,
}) {
  return (e) => {
    if (e.key !== 'Tab') return;
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
