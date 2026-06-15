/**
 * Zentrale API-URL für fetch (Web + später Desktop-Electron).
 *
 * - Leer / nicht gesetzt: relative URLs (Vite-Dev mit Proxy, gleicher Origin in Produktion).
 * - VITE_API_BASE_URL: z. B. http://127.0.0.1:3000 (ohne trailing slash).
 */
export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (raw == null || String(raw).trim() === '') return '';
  return String(raw).replace(/\/+$/, '');
}

/**
 * @param {string} path - beginnt mit /, z. B. /api/courses
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (!base) return p;
  return `${base}${p}`;
}

/**
 * fetch() mit korrekter Basis-URL.
 * @param {string} path
 * @param {RequestInit} [init]
 */
export function apiFetch(path, init) {
  return fetch(apiUrl(path), init).then((res) => {
    if (res.status === 423) {
      void import('./apiAuth.js').then(({ checkCryptoApiResponse }) => checkCryptoApiResponse(res));
    }
    return res;
  });
}
