/** Beim Fokus den gesamten Inhalt markieren (schnelles Überschreiben per Tastatur). */
export function selectInputOnFocus(e) {
  const el = e.currentTarget;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select();
  }
}
