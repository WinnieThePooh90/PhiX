import { apiFetch } from './apiBase';
import { applyCryptoHeader, clearCryptoSessionToken } from './cryptoSession';

export const PHIX_CRYPTO_LOST_EVENT = 'phix-crypto-session-lost';

/** @typedef {{ needsSetup?: boolean, needsRelogin?: boolean, error?: string }} CryptoStatusBody */

/**
 * @param {Response} res
 * @returns {Promise<{ lost: boolean, body: CryptoStatusBody | unknown }>}
 */
export async function checkCryptoApiResponse(res) {
  if (res.status !== 423) {
    return { lost: false, body: null };
  }
  let body = {};
  try {
    body = await res.clone().json();
  } catch {
    /* ignore */
  }
  clearCryptoSessionToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PHIX_CRYPTO_LOST_EVENT, {
        detail: body,
      }),
    );
  }
  return { lost: true, body };
}

/**
 * fetch mit X-Acting-User + Krypto-Token; bei 423 wird Sitzung invalidiert.
 * @param {string} actingUsername
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function fetchWithActingAndCrypto(actingUsername, path, init = {}) {
  const headers = applyCryptoHeader(new Headers(init.headers || {}));
  if (actingUsername) headers.set('X-Acting-User', actingUsername);
  const res = await apiFetch(path, { ...init, headers });
  const crypto = await checkCryptoApiResponse(res);
  return { res, cryptoLost: crypto.lost, cryptoBody: crypto.body };
}
