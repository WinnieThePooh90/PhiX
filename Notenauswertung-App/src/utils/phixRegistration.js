import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'phix_version_registered';

/** Vorerst gültiger Registrierungsschlüssel (ohne Backend). */
const VALID_REGISTRATION_KEY = 'test';

const listeners = new Set();

function notifyRegistrationChange() {
  listeners.forEach((fn) => fn());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('phix-registration-change'));
  }
}

export function isPhiXRegistered() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

/** @returns {boolean} true, wenn der Schlüssel gültig war und die Version registriert wurde */
export function registerPhiXVersion(keyRaw) {
  const key = String(keyRaw ?? '').trim().toLowerCase();
  if (key !== VALID_REGISTRATION_KEY) return false;
  localStorage.setItem(STORAGE_KEY, '1');
  notifyRegistrationChange();
  return true;
}

export function unregisterPhiXVersion() {
  localStorage.removeItem(STORAGE_KEY);
  notifyRegistrationChange();
}

export function subscribePhiXRegistration(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener('phix-registration-change', listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('phix-registration-change', listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function usePhiXRegistration() {
  const [registered, setRegistered] = useState(() => isPhiXRegistered());

  useEffect(() => {
    const sync = () => setRegistered(isPhiXRegistered());
    return subscribePhiXRegistration(sync);
  }, []);

  const register = useCallback((key) => {
    const ok = registerPhiXVersion(key);
    if (ok) setRegistered(true);
    return ok;
  }, []);

  const unregister = useCallback(() => {
    unregisterPhiXVersion();
    setRegistered(false);
  }, []);

  return { registered, register, unregister };
}
