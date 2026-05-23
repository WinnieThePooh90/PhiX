const STORAGE_CRYPTO_TOKEN = 'phix_crypto_session_token';

export function readCryptoSessionToken() {
  try {
    return sessionStorage.getItem(STORAGE_CRYPTO_TOKEN);
  } catch {
    return null;
  }
}

export function writeCryptoSessionToken(token) {
  try {
    if (token) sessionStorage.setItem(STORAGE_CRYPTO_TOKEN, String(token));
    else sessionStorage.removeItem(STORAGE_CRYPTO_TOKEN);
  } catch {
    /* ignore */
  }
}

export function clearCryptoSessionToken() {
  writeCryptoSessionToken(null);
}

export function applyCryptoHeader(headers) {
  const h = headers instanceof Headers ? headers : new Headers(headers || {});
  const token = readCryptoSessionToken();
  if (token) h.set('X-Phix-Crypto-Token', token);
  return h;
}
