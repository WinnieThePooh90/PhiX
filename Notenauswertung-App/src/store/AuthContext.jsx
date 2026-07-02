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
import { mapAppUserFromApi, userHasAdminRights } from '../utils/userAdmin';
import {
  readPendingRecoverySetup,
  clearPendingRecoverySetup,
} from '../utils/pendingRecovery';

const STORAGE_SESSION_KEY = 'notenauswertung_session_username';

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

export function authHeaders() {
  return applyCryptoHeader(new Headers());
}

function jsonAuthHeaders() {
  const h = authHeaders();
  h.set('Content-Type', 'application/json');
  return h;
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [pendingCryptoSetup, setPendingCryptoSetup] = useState(null);
  const [pendingRecoveryConfirm, setPendingRecoveryConfirm] = useState(null);
  const [setupWizardNeeded, setSetupWizardNeeded] = useState(false);
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

  const refreshUsersList = useCallback(async () => {
    const n = ++usersListNonce.current;
    try {
      const res = await apiFetch('/api/users', { headers: authHeaders() });
      if (!res.ok) {
        if (n === usersListNonce.current) setUsersList([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data)
        ? data.map((row) => mapAppUserFromApi(row)).filter(Boolean)
        : [];
      if (n === usersListNonce.current) setUsersList(list);
    } catch {
      if (n === usersListNonce.current) setUsersList([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storedSettings = getUserSettingsFromStorage();
        if (storedSettings.darkMode) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
        if (storedSettings.colorScheme && storedSettings.colorScheme !== 'standard') {
          document.documentElement.setAttribute('data-color-scheme', storedSettings.colorScheme);
        }
        const res = await apiFetch('/api/auth/session');
        if (cancelled) return;
        if (res.ok) {
          const body = await res.json();
          const u = mapAppUserFromApi(body);
          if (u) {
            setCurrentUser(u);
            try {
              localStorage.setItem(STORAGE_SESSION_KEY, u.username);
            } catch {
              /* ignore */
            }
          }
          const statusRes = await apiFetch('/api/auth/crypto/status', {
            headers: authHeaders(),
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
          try {
            const wsRes = await apiFetch('/api/setup/wizard-status');
            if (!cancelled && wsRes.ok) {
              const ws = await wsRes.json();
              setSetupWizardNeeded(ws.needsWizard === true);
            } else if (!cancelled) {
              setSetupWizardNeeded(false);
            }
          } catch {
            if (!cancelled) setSetupWizardNeeded(false);
          }
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
    if (!userHasAdminRights(currentUser)) {
      setUsersList([]);
      return undefined;
    }
    refreshUsersList();
    return undefined;
  }, [currentUser, pendingCryptoSetup, pendingRecoveryConfirm, refreshUsersList]);

  const login = useCallback(async (usernameRaw, passwordRaw) => {
    const usernameIn = String(usernameRaw ?? '').trim();
    const password = String(passwordRaw ?? '');
    if (!usernameIn) {
      return { ok: false, error: 'Benutzername eingeben.' };
    }
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameIn, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.requiresInitialPassword) {
          return {
            ok: false,
            requiresInitialPassword: true,
            username: body.username || usernameIn,
            error: body.error || 'Leg zuerst ein Passwort fest.',
          };
        }
        return { ok: false, error: body.error || 'Anmeldung fehlgeschlagen.' };
      }
      const u = mapAppUserFromApi(body);
      if (!u) {
        return { ok: false, error: 'Anmeldung fehlgeschlagen.' };
      }
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
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
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
      try {
        const sessionRes = await apiFetch('/api/auth/session');
        if (cancelled) return;
        if (!sessionRes.ok) {
          void logout();
          return;
        }
        const statusRes = await apiFetch('/api/auth/crypto/status', {
          headers: authHeaders(),
        });
        if (cancelled) return;
        const statusBody = await statusRes.json().catch(() => ({}));
        if (!cancelled) {
          applyCryptoGateFromStatus(currentUser.username, statusRes, statusBody);
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

  const setInitialPassword = useCallback(async (usernameRaw, newPasswordRaw, setupTokenRaw) => {
    const username = String(usernameRaw ?? '').trim();
    const newPassword = String(newPasswordRaw ?? '');
    const setupToken = String(setupTokenRaw ?? '').trim();
    if (!username || !newPassword) {
      return { ok: false, error: 'Benutzername und Passwort eingeben.' };
    }
    try {
      const res = await apiFetch('/api/auth/initial-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword, setupToken }),
      });
      if (res.status === 204) return { ok: true };
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || 'Passwort konnte nicht gespeichert werden.' };
    } catch {
      return { ok: false, error: 'Server nicht erreichbar.' };
    }
  }, []);

  const addUser = useCallback(
    async (usernameRaw) => {
      const username = String(usernameRaw ?? '').trim();
      if (!username) {
        return { ok: false, error: 'Benutzername eingeben.' };
      }
      const acting = currentUser?.username;
      if (!acting) return { ok: false, error: 'Nicht angemeldet.' };
      try {
        const res = await apiFetch('/api/users', {
          method: 'POST',
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ username }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: body.error || 'Anlegen fehlgeschlagen.' };
        }
        await refreshUsersList();
        return { ok: true, setupToken: body.setupToken || '' };
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
          headers: jsonAuthHeaders(),
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
          headers: authHeaders(),
        });
        if (res.status === 204) {
          const selfDeleted = String(userId) === String(currentUser?.id);
          if (selfDeleted) {
            await logout();
          } else {
            await refreshUsersList();
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

  const setUserAdmin = useCallback(
    async (userId, isAdmin) => {
      const acting = currentUser?.username;
      if (!acting) return { ok: false, error: 'Nicht angemeldet.' };
      if (!userHasAdminRights(currentUser)) {
        return { ok: false, error: 'Nur Administratoren dürfen Admin-Rechte vergeben oder entziehen.' };
      }
      try {
        const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}/admin`, {
          method: 'PATCH',
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ isAdmin: isAdmin === true }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: body.error || 'Speichern fehlgeschlagen.' };
        }
        const updated = mapAppUserFromApi(body);
        await refreshUsersList();
        if (updated && String(userId) === String(currentUser?.id)) {
          setCurrentUser(updated);
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Server nicht erreichbar.' };
      }
    },
    [currentUser, refreshUsersList],
  );

  const completeSetupWizard = useCallback(() => {
    setSetupWizardNeeded(false);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      authReady,
      setupWizardNeeded,
      completeSetupWizard,
      pendingCryptoSetup,
      pendingRecoveryConfirm,
      completeCryptoSetup,
      confirmPendingRecovery,
      login,
      logout,
      setInitialPassword,
      usersList,
      addUser,
      setPasswordForUser,
      setUserAdmin,
      deleteUser,
      authHeaders,
    }),
    [
      currentUser,
      authReady,
      setupWizardNeeded,
      completeSetupWizard,
      pendingCryptoSetup,
      pendingRecoveryConfirm,
      completeCryptoSetup,
      confirmPendingRecovery,
      login,
      logout,
      setInitialPassword,
      usersList,
      addUser,
      setPasswordForUser,
      setUserAdmin,
      deleteUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
