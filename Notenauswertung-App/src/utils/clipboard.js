/**
 * Kopiert einen Text in die Zwischenablage des Systems.
 * Unterstützt die moderne navigator.clipboard-API (HTTPS/localhost) und
 * bietet einen zuverlässigen Fallback über document.execCommand('copy') für HTTP- und Server-Umgebungen.
 * @param {string} text
 * @returns {Promise<boolean>} True, wenn das Kopieren erfolgreich war, sonst false.
 */
export async function copyToClipboard(text) {
  if (!text) return false;

  // 1. Moderne Clipboard API (benötigt HTTPS oder localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[copyToClipboard] navigator.clipboard.writeText fehlgeschlagen, benutze Fallback:', err);
    }
  }

  // 2. Fallback über temporäres Textarea-Element & document.execCommand('copy')
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return Boolean(successful);
  } catch (err) {
    console.error('[copyToClipboard] Fallback execCommand kopieren fehlgeschlagen:', err);
    return false;
  }
}
