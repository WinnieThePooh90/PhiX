export function oralWeekInputDataAttr(oralId, studentId, weekIndex) {
  return `${oralId}__${studentId}__${weekIndex}`;
}

export function focusOralWeekInput(oralId, studentId, weekIndex) {
  const attr = oralWeekInputDataAttr(oralId, studentId, weekIndex);
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-oral-week-input="${attr}"]`);
    el?.focus();
    el?.select();
  });
}

/** Tab/Shift+Tab: nächster/vorheriger Schüler in derselben Wochenspalte */
export function createOralWeekTabHandler({ oralId, rowIndex, weekIndex, displayStudents }) {
  return (e) => {
    if (e.key !== 'Tab') return;
    const next = e.shiftKey ? rowIndex - 1 : rowIndex + 1;
    if (next < 0 || next >= displayStudents.length) return;
    e.preventDefault();
    focusOralWeekInput(oralId, displayStudents[next].id, weekIndex);
  };
}
