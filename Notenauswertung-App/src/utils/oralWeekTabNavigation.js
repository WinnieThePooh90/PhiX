import { isEnterAsTabKey, scheduleScrollTableFieldIntoView } from './tableEnterAsTab';

export function oralWeekInputDataAttr(oralId, studentId, weekIndex) {
  return `${oralId}__${studentId}__${weekIndex}`;
}

export function focusOralWeekInput(oralId, studentId, weekIndex) {
  const attr = oralWeekInputDataAttr(oralId, studentId, weekIndex);
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-oral-week-input="${attr}"]`);
    if (!el) return;
    el.focus();
    try {
      el.select();
    } catch {
      /* ignore */
    }
    scheduleScrollTableFieldIntoView(el);
  });
}

/** Tab/Enter: nächster Schüler in derselben Wochenspalte; Shift+Tab: vorheriger Schüler */
export function createOralWeekTabHandler({ oralId, rowIndex, weekIndex, displayStudents }) {
  return (e) => {
    const isTab = e.key === 'Tab';
    const isEnterNav = isEnterAsTabKey(e);
    if (!isTab && !isEnterNav) return;

    const reverse = isTab && e.shiftKey;
    const forward = isEnterNav || (isTab && !e.shiftKey);
    if (!forward && !reverse) return;

    const next = reverse ? rowIndex - 1 : rowIndex + 1;
    if (next < 0 || next >= displayStudents.length) return;
    e.preventDefault();
    focusOralWeekInput(oralId, displayStudents[next].id, weekIndex);
  };
}
