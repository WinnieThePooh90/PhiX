import { apiFetch } from './apiBase';
import { applyCryptoHeader } from './cryptoSession';

export const AUSWERTUNGSHILFE_ACCEPT =
  '.pdf,.doc,.docx,.txt,.rtf,.odt,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/rtf,application/vnd.oasis.opendocument.text';

let cachedMeta = null;
const listeners = new Set();

function notify(meta) {
  cachedMeta = meta;
  listeners.forEach((fn) => fn(meta));
}

export function subscribeUserAuswertungshilfe(listener) {
  listeners.add(listener);
  if (cachedMeta) listener(cachedMeta);
  return () => listeners.delete(listener);
}

function actingHeaders() {
  return applyCryptoHeader(new Headers());
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

export async function fetchUserAuswertungshilfeMeta(username) {
  const res = await apiFetch('/api/user-auswertungshilfe', { headers: actingHeaders(username) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Auswertungshilfe konnte nicht geladen werden.');
  }
  const data = await res.json();
  const meta = {
    uploaded: !!data.uploaded,
    fileName: data.fileName ?? null,
    mimeType: data.mimeType ?? null,
    updatedAt: data.updatedAt ?? null,
  };
  notify(meta);
  return meta;
}

export async function uploadUserAuswertungshilfe(username, file) {
  const fileData = await readFileAsBase64(file);
  const res = await apiFetch('/api/user-auswertungshilfe', {
    method: 'PUT',
    headers: applyCryptoHeader(
      new Headers({
        'Content-Type': 'application/json',
      }),
    ),
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || '',
      fileData,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Upload fehlgeschlagen.');
  }
  const data = await res.json();
  const meta = {
    uploaded: true,
    fileName: data.fileName ?? file.name,
    mimeType: data.mimeType ?? file.type ?? null,
    updatedAt: data.updatedAt ?? null,
  };
  notify(meta);
  return meta;
}

function parseFilenameFromDisposition(header) {
  if (!header) return null;
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/"/g, '').trim());
  } catch {
    return m[1].replace(/"/g, '').trim();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadUserAuswertungshilfe(username, fallbackName) {
  const res = await apiFetch('/api/user-auswertungshilfe/file', { headers: actingHeaders(username) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Datei konnte nicht geladen werden.');
  }
  const blob = await res.blob();
  const fileName =
    parseFilenameFromDisposition(res.headers.get('Content-Disposition')) ||
    fallbackName ||
    'auswertungshilfe.pdf';
  downloadBlob(blob, fileName);
}

export async function deleteUserAuswertungshilfe(username) {
  const res = await apiFetch('/api/user-auswertungshilfe', {
    method: 'DELETE',
    headers: actingHeaders(username),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Auswertungshilfe konnte nicht gelöscht werden.');
  }
  notify({
    uploaded: false,
    fileName: null,
    mimeType: null,
    updatedAt: null,
  });
}
