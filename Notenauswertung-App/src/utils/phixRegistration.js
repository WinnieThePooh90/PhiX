import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from './apiBase';
import { applyCryptoHeader } from './cryptoSession';

const listeners = new Set();

function notifyRegistrationChange() {
  listeners.forEach((fn) => fn());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('phix-registration-change'));
  }
}

let cachedStatus = null;

export async function fetchRegistrationStatus() {
  try {
    const res = await apiFetch('/api/registration');
    if (!res.ok) return false;
    const data = await res.json();
    cachedStatus = !!data.registered;
    return cachedStatus;
  } catch {
    return cachedStatus ?? false;
  }
}

export function isPhiXRegistered() {
  return cachedStatus ?? false;
}

/**
 * @returns {Promise<boolean>} true wenn der Schlüssel akzeptiert wurde
 */
export async function registerPhiXVersion(keyRaw, username) {
  try {
    const headers = applyCryptoHeader(new Headers({ 'Content-Type': 'application/json' }));
    const res = await apiFetch('/api/registration', {
      method: 'POST',
      headers,
      body: JSON.stringify({ key: keyRaw }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.registered) {
      cachedStatus = true;
      notifyRegistrationChange();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function subscribePhiXRegistration(listener) {
  listeners.add(listener);
  window.addEventListener('phix-registration-change', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('phix-registration-change', listener);
  };
}

export async function unregisterPhiXVersion(username) {
  try {
    const headers = applyCryptoHeader(new Headers());
    const res = await apiFetch('/api/registration', { method: 'DELETE', headers });
    if (res.ok) {
      cachedStatus = false;
      notifyRegistrationChange();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function usePhiXRegistration() {
  const [registered, setRegistered] = useState(() => cachedStatus ?? false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRegistrationStatus().then((val) => {
      if (!cancelled) {
        setRegistered(val);
        setLoading(false);
      }
    });
    const unsub = subscribePhiXRegistration(() => setRegistered(isPhiXRegistered()));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const register = useCallback(async (key, username) => {
    const ok = await registerPhiXVersion(key, username);
    if (ok) setRegistered(true);
    return ok;
  }, []);

  const unregister = useCallback(async (username) => {
    const ok = await unregisterPhiXVersion(username);
    if (ok) setRegistered(false);
    return ok;
  }, []);

  return { registered, loading, register, unregister };
}
