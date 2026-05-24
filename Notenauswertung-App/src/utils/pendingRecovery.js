const STORAGE_KEY = 'phix_pending_recovery_setup';

/** @returns {{ username: string, recoveryKey: string, cryptoSessionToken: string } | null} */
export function readPendingRecoverySetup() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      !data ||
      typeof data.username !== 'string' ||
      typeof data.recoveryKey !== 'string' ||
      typeof data.cryptoSessionToken !== 'string'
    ) {
      return null;
    }
    return {
      username: data.username,
      recoveryKey: data.recoveryKey,
      cryptoSessionToken: data.cryptoSessionToken,
    };
  } catch {
    return null;
  }
}

export function writePendingRecoverySetup({ username, recoveryKey, cryptoSessionToken }) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        username: String(username),
        recoveryKey: String(recoveryKey),
        cryptoSessionToken: String(cryptoSessionToken),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function clearPendingRecoverySetup() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
