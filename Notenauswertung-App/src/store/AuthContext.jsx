import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/apiBase';
import { PHIX_CRYPTO_LOST_EVENT } from '../utils/apiAuth';
import {
  readCryptoSessionToken,
  writeCryptoSessionToken,
  clearCryptoSessionToken,
  applyCryptoHeader,
} from '../utils/cryptoSession';
import { INACTIVITY_LOGOUT_MS, SESSION_HEARTBEAT_MS } from '../config/session';
import { applyUserSettings, getUserSettingsFromStorage, clearUserSettings } from '../utils/userSettings';
import {
  readPendingRecoverySetup,
  clearPendingRecoverySetup,
} from '../utils/pendingRecovery';

const STORAGE_SESSION_KEY = 'notenauswertung_session_username';
const LEGACY_STORAGE_USERS_KEY = 'notenauswertung_users';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth nur innerhalb von AuthProvider verwenden');
  return ctx;
};

function readSessionUsername() {
  try {
    return localStorage.getItem(STORAGE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function authHeaders(username) {
  const h = new Headers();
  if (username) h.set('X-Acting-User', username);
  return applyCryptoHeader(h);
}

function jsonHeadersWithActing(acting) {
  const h = authHeaders(acting);
  h.set('Content-Type', 'application/json');
  return h;
}

async function tryMigrateLegacyUsersFromBrowser() {
  let raw;
  try {
    raw = localStorage.getItem(LEGACY_STORAGE_USERS_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(arr) || arr.length === 0) return;
  const users = arr
    .filter((u) => u && String(u.username ?? '').trim() && String(u.password ?? ''))
    .map((u) => ({ username: String(u.username).trim(), password: String(u.password) }));
  if (users.length === 0) return;
  try {
    const res = await apiFetch('/api/users/migrate-from-localstorage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    });
    if (res.ok) {
      localStorage.removeItem(LEGACY_STORAGE_USERS_KEY);
    }
  } catch {
    /* Server ggf. nicht erreichbar */
  }
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [pendingCryptoSetup, setPendingCryptoSetup] = useState(null);
  const [pendingRecoveryConfirm, setPendingRecoveryConfirm] = useState(null);
  const usersListNonce = useRef(0);

  const applyCryptoGateFromStatus = useCallback((username, statusRes, statusBody) => {
    if (statusBody?.needsSetup) {
      clearCryptoSessionToken();
      setPendingCryptoSetup({
        username,
        password: null,
        needsRelogin: true,
        needsSetup: true,
      });
      return;
    }
    if (!statusRes.ok || statusBody?.needsRelogin) {
      clearCryptoSessionToken();
      setPendingCryptoSetup({ username, password: null, needsRelogin: true });
      return;
    }
    setPendingCryptoSetup(null);
  }, []);

  useEffect(() => {
    const onCryptoLost = (ev) => {
      const detail = ev?.detail || {};
      const username = currentUser?.username || readSessionUsername();
      if (!username) return;
      clearCryptoSessionToken();
      if (detail.requiresCryptoSetup || detail.needsSetup) {
        setPendingCryptoSetup({
          username,
          password: null,
          needsRelogin: true,
          needsSetup: true,
        });
      } else {
        setPendingCryptoSetup({ username, password: null, needsRelogin: true });
      }
    };
    window.addEventListener(PHIX_CRYPTO_LOST_EVENT, onCryptoLost);
    return () => window.removeEventListener(PHIX_CRYPTO_LOST_EVENT, onCryptoLost);
  }, [currentUser?.username]);

  const refreshUsersList = useCallback(async (actingUsername) => {
    const u = String(actingUsername ?? '').trim();
    if (!u) {
      setUsersList([]);
      return;
    }
    const n = ++usersListNonce.current;
    try {
      const res = await apiFetch('/api/users', { headers: authHeaders(u) });
      if (!res.ok) {
        if (n === usersListNonce.current) setUsersList([]);
        return;
      }
      const data = await res.json();
      if (n === usersListNonce.current) setUsersList(Array.isArray(data) ? data : []);
    } catch {
      if (n === usersListNonce.current) setUsersList([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await tryMigrateLegacyUsersFromBrowser();
      const sessionName = readSessionUsername();
      if (!sessionName || !String(sessionName).trim()) {
        if (!cancelled) {
          setCurrentUser(null);
          clearCryptoSessionToken();
          setAuthReady(true);
        }
        return;
      }
      try {
        const storedSettings = getUserSettingsFromStorage();
        if (storedSettings.darkMode) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
        if (storedSettings.colorScheme && storedSettings.colorScheme !== 'standard') {
          document.documentElement.setAttribute('data-color-scheme', storedSettings.colorScheme);
        }
        const res = await apiFetch('/api/auth/session', { headers: authHeaders(sessionName) });
        if (cancelled) return;
        if (res.ok) {
          const body = await res.json();
          setCurrentUser({ id: body.id, username: body.username });
          const statusRes = await apiFetch('/api/auth/crypto/status', {
            headers: authHeaders(body.username),
          });
          const statusBody = await statusRes.json().catch(() => ({}));
          if (!cancelled) {
            const pendingRec = readPendingRecoverySetup();
            if (pendingRec && pendingRec.username === body.username) {
              clearCryptoSessionToken();
              setPendingRecoveryConfirm(pendingRec);
              setPendingCryptoSetup(null);
            } else {
              applyCryptoGateFromStatus(body.username, statusRes, statusBody);
            }
          }
        } else {
          try {
            localStorage.removeItem(STORAGE_SESSION_KEY);
          } catch {
            /* ignore */
          }
          clearCryptoSessionToken();
          setCurrentUser(null);
        }
      } catch {
        if (!cancelled) setCurrentUser(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.username || pendingCryptoSetup || pendingRecoveryConfirm) {
      if (!currentUser?.username) setUsersList([]);
      return undefined;
    }
    refreshUsersList(currentUser.username);
    return undefined;
  }, [currentUser?.username, pendingCryptoSetup, pendingRecoveryConfirm, refreshUsersList]);

  const login = useCallback(async (usernameRaw, passwordRaw) => {
    const usernameIn = String(usernameRaw ?? '').trim();
    const password = String(passwordRaw ?? '');
    if (!usernameIn || !password) {
      return { ok: false, error: 'Benutzername und Passwort eingeben.' };
    }
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameIn, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: body.error || 'Anmeldung fehlgeschlagen.' };
      }
      const u = { id: String(body.id), username: body.username };
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, u.username);
      } catch {
        return { ok: false, error: 'Sitzung konnte nicht gespeichert werden.' };
      }
      if (body.cryptoSessionToken) {
        writeCryptoSessionToken(body.cryptoSessionToken);
      } else {
        clearCryptoSessionToken();
      }
      if (body.settings) applyUserSettings(body.settings);
      setCurrentUser(u);
      if (body.requiresCryptoSetup) {
        clearPendingRecoverySetup();
        setPendingRecoveryConfirm(null);
        setPendingCryptoSetup({ username: u.username, password, needsRelogin: false, needsSetup: true });
      } else if (!body.cryptoSessionToken) {
        clearCryptoSessionToken();
        setPendingCryptoSetup({ username: u.username, password: null, needsRelogin: true });
      } else {
        setPendingCryptoSetup(null);
      }
      return { ok: true, requiresCryptoSetup: Boolean(body.requiresCryptoSetup) };
    } catch {
      return { ok: false, error: 'Server nicht erreichbar.' };
    }
  }, []);

  const logout = useCallback(async () => {
    const token = readCryptoSessionToken();
    try {
      const acting = readSessionUsername();
      const h = new Headers();
      if (acting) h.set('X-Acting-User', acting);
      if (token) h.set('X-Phix-Crypto-Token', token);
      await apiFetch('/api/auth/logout', { method: 'POST', headers: h });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      /* ignore */
    }
    clearCryptoSessionToken();
    clearUserSettings();
    setPendingCryptoSetup(null);
    setPendingRecoveryConfirm(null);
    clearPendingRecoverySetup();
    setCurrentUser(null);
    try { window.history.replaceState(null, '', '/'); } catch {}
  }, []);

  useEffect(() => {
    if (!currentUser?.username || pendingCryptoSetup || pendingRecoveryConfirm) return undefined;

    let timeoutMs = getUserSettingsFromStorage().inactivityTimeoutMin * 60 * 1000 || INACTIVITY_LOGOUT_MS;
    let timerId = null;
    const scheduleLogout = () => {
      if (timerId != null) clearTimeout(timerId);
      timerId = setTimeout(() => {
        void logout();
      }, timeoutMs);
    };

    const onActivity = () => scheduleLogout();
    const onSettingsChanged = (ev) => {
      if (ev.detail?.inactivityTimeoutMin) {
        timeoutMs = ev.detail.inactivityTimeoutMin * 60 * 1000;
        scheduleLogout();
      }
    };
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'click', 'wheel', 'scroll'];

    scheduleLogout();
    for (const ev of activityEvents) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    window.addEventListener('phix-settings-changed', onSettingsChanged);

    return () => {
      if (timerId != null) clearTimeout(timerId);
      for (const ev of activityEvents) {
        window.removeEventListener(ev, onActivity);
      }
      window.removeEventListener('phix-settings-changed', onSettingsChanged);
    };
  }, [currentUser?.username, pendingCryptoSetup, pendingRecoveryConfirm, logout]);

  /** Regelmäßige Sitzungsprüfung – erkennt abgelaufene Krypto-Session ohne Browser-Reload. */
  useEffect(() => {
    if (!currentUser?.username || pendingCryptoSetup || pendingRecoveryConfirm) return undefined;

    let cancelled = false;

    const verifySession = async () => {
      const username = currentUser.username;
      try {
        const sessionRes = await apiFetch('/api/auth/session', { headers: authHeaders(username) });
        if (cancelled) return;
        if (!sessionRes.ok) {
          void logout();
          return;
        }
        const statusRes = await apiFetch('/api/auth/crypto/status', {
          headers: authHeaders(username),
        });
        if (cancelled) return;
        const statusBody = await statusRes.json().catch(() => ({}));
        if (!cancelled) {
          applyCryptoGateFromStatus(username, statusRes, statusBody);
        }
      } catch {
        /* Netzwerkfehler: keine erzwungene Abmeldung */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void verifySession();
      }
    };

    void verifySession();
    const intervalId = setInterval(() => void verifySession(), SESSION_HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    currentUser?.username,
    pendingCryptoSetup,
    pendingRecoveryConfirm,
    applyCryptoGateFromStatus,
    logout,
  ]);

  const completeCryptoSetup = useCallback(() => {
    const pending = readPendingRecoverySetup();
    if (pending?.cryptoSessionToken) {
      writeCryptoSessionToken(pending.cryptoSessionToken);
    }
    clearPendingRecoverySetup();
    setPendingRecoveryConfirm(null);
    setPendingCryptoSetup(null);
  }, []);

  const confirmPendingRecovery = useCallback(() => {
    completeCryptoSetup();
  }, [completeCryptoSetup]);

  const addUser = useCallback(
    async (usernameRaw, passwordRaw) => {
      const username = String(usernameRaw ?? '').trim();
      const password = String(passwordRaw ?? '');
      if (!username) {
        return { ok: false, error: 'Benutzername eingeben.' };
      }
      if (!password) {
        return { ok: false, error: 'Passwort eingeben.' };
      }
      const acting = currentUser?.username;
      if (!acting) return { ok: false, error: 'Nicht angemeldet.' };
      try {
        const res = await apiFetch('/api/users', {
          method: 'POST',
          headers: jsonHeadersWithActing(acting),
          body: JSON.stringify({ username, password }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: body.error || 'Anlegen fehlgeschlagen.' };
        }
        await refreshUsersList(acting);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Server nicht erreichbar.' };
      }
    },
    [currentUser?.username, refreshUsersList],
  );

  const setPasswordForUser = useCallback(
    async (userId, newPasswordRaw, oldPasswordRaw) => {
      const newPassword = String(newPasswordRaw ?? '');
      const oldPassword = String(oldPasswordRaw ?? '');
      if (!newPassword) {
        return { ok: false, error: 'Neues Passwort eingeben.' };
      }
      const acting = currentUser?.username;
      if (!acting) return { ok: false, error: 'Nicht angemeldet.' };
      try {
        const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}/password`, {
          method: 'PATCH',
          headers: jsonHeadersWithActing(acting),
          body: JSON.stringify({ newPassword, oldPassword }),
        });
        if (res.status === 204) return { ok: true };
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || 'Speichern fehlgeschlagen.' };
      } catch {
        return { ok: false, error: 'Server nicht erreichbar.' };
      }
    },
    [currentUser?.username],
  );

  const deleteUser = useCallback(
    async (userId) => {
      const acting = currentUser?.username;
      if (!acting) return { ok: false, error: 'Nicht angemeldet.' };
      try {
        const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: authHeaders(acting),
        });
        if (res.status === 204) {
          const selfDeleted = String(userId) === String(currentUser?.id);
          if (selfDeleted) {
            await logout();
          } else {
            await refreshUsersList(acting);
          }
          return { ok: true };
        }
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || 'Löschen fehlgeschlagen.' };
      } catch {
        return { ok: false, error: 'Server nicht erreichbar.' };
      }
    },
    [currentUser?.username, currentUser?.id, refreshUsersList, logout],
  );

  const value = useMemo(
    () => ({
      currentUser,
      authReady,
      pendingCryptoSetup,
      pendingRecoveryConfirm,
      completeCryptoSetup,
      confirmPendingRecovery,
      login,
      logout,
      usersList,
      addUser,
      setPasswordForUser,
      deleteUser,
      authHeaders,
    }),
    [
      currentUser,
      authReady,
      pendingCryptoSetup,
      pendingRecoveryConfirm,
      completeCryptoSetup,
      confirmPendingRecovery,
      login,
      logout,
      usersList,
      addUser,
      setPasswordForUser,
      deleteUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
