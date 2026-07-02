/**
 * Express-Middleware: Krypto-Session (423 ohne Token).
 */
const { getCryptoSession } = require('./crypto-session');
const { runWithCryptoContext } = require('./crypto-context');
const { usernameWhere } = require('./username-filter');

const CRYPTO_EXEMPT = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/initial-password',
  '/api/auth/session',
  '/api/auth/crypto/setup',
  '/api/auth/crypto/status',
  '/api/auth/crypto/unlock-recovery',
  '/api/registration',
  '/api/setup/wizard-status',
  '/api/setup/work-user',
]);

function isCryptoExempt(path) {
  return CRYPTO_EXEMPT.has(path);
}

function createCryptoMiddleware({ prisma, getActingUser }) {
  return async function cryptoMiddleware(req, res, next) {
    if (!req.path.startsWith('/api/')) return next();
    if (isCryptoExempt(req.path)) return next();

    const acting = getActingUser(req);
    if (!acting) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }

    const user = await prisma.appUser.findFirst({
      where: usernameWhere(acting),
      select: { id: true, username: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'Unbekannter Benutzer' });
    }

    const userCrypto = await prisma.userCrypto.findUnique({
      where: { userId: user.id },
    });

    if (!userCrypto) {
      return res.status(423).json({
        error: 'Verschlüsselung einrichten.',
        requiresCryptoSetup: true,
      });
    }

    const token = String(req.get('X-Phix-Crypto-Token') || '').trim();
    const session = getCryptoSession(token);
    if (!session || session.userId !== user.id) {
      return res.status(423).json({
        error: 'Bitte melde dich erneut an (Verschlüsselung).',
        requiresCryptoRelogin: true,
      });
    }

    return runWithCryptoContext({ dek: session.dek, userId: user.id }, () => next());
  };
}

module.exports = { createCryptoMiddleware, isCryptoExempt, CRYPTO_EXEMPT };
