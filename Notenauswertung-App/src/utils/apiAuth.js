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
