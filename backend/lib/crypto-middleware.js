/**
 * Express-Middleware: Krypto-Session (423 ohne Token).
 */
const { getCryptoSession } = require('./crypto-session');
const { runWithCryptoContext } = require('./crypto-context');
const { usernameWhere } = require('./username-filter');

const CRYPTO_EXEMPT = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/crypto/setup',
  '/api/auth/crypto/unlock-recovery',
  '/api/auth/crypto/status',
  '/api/users/migrate-from-localstorage',
  '/api/registration',
  '/api/health',
  '/api/shutdown',
]);

function isCryptoExempt(path) {
  if (CRYPTO_EXEMPT.has(path)) return true;
  if (path.startsWith('/api/impressum')) return true;
  return false;
}

function createCryptoMiddleware({ prisma, getActingUser, assertActingUser }) {
  return async function cryptoMiddleware(req, res, next) {
    if (!req.path.startsWith('/api/')) return next();
    if (isCryptoExempt(req.path)) return next();

    const acting = getActingUser(req);
    if (!acting) {
      return res.status(401).json({ error: 'X-Acting-User erforderlich' });
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
      if (req.path === '/api/auth/crypto/migrate-plaintext') {
        return res.status(400).json({ error: 'Verschlüsselung zuerst einrichten.' });
      }
      return res.status(423).json({
        error: 'Verschlüsselung einrichten.',
        requiresCryptoSetup: true,
      });
    }

    const token = String(req.get('X-Phix-Crypto-Token') || '').trim();
    const session = getCryptoSession(token);
    if (!session || session.userId !== user.id) {
      return res.status(423).json({
        error: 'Bitte erneut anmelden (Verschlüsselung).',
        requiresCryptoRelogin: true,
      });
    }

    return runWithCryptoContext({ dek: session.dek, userId: user.id }, () => next());
  };
}

module.exports = { createCryptoMiddleware, isCryptoExempt, CRYPTO_EXEMPT };
