/**
 * Einfaches In-Memory Rate-Limiting pro Schlüssel (z. B. Client-IP).
 */
const buckets = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(key, { maxAttempts = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  let row = buckets.get(key);
  if (!row || now > row.resetAt) {
    row = { count: 0, resetAt: now + windowMs };
    buckets.set(key, row);
  }
  row.count += 1;
  if (row.count > maxAttempts) {
    return { allowed: false, retryAfterMs: row.resetAt - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

module.exports = {
  clientIp,
  checkRateLimit,
};
