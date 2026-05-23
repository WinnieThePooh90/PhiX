/**
 * AsyncLocalStorage für DEK pro HTTP-Request (Prisma-Extension).
 */
const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function runWithCryptoContext(ctx, fn) {
  return storage.run(ctx, fn);
}

function getCryptoContext() {
  return storage.getStore() || null;
}

function getDekFromContext() {
  const ctx = getCryptoContext();
  if (ctx?.bypassCrypto) return null;
  return ctx?.dek ?? null;
}

function isCryptoBypassed() {
  return Boolean(getCryptoContext()?.bypassCrypto);
}

module.exports = {
  runWithCryptoContext,
  getCryptoContext,
  getDekFromContext,
  isCryptoBypassed,
};
