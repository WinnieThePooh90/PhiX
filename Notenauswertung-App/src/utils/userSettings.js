const STORAGE_KEY = 'phix_user_settings';

const DEFAULTS = { inactivityTimeoutMin: 5, darkMode: false, colorScheme: 'standard' };

export function getUserSettingsFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function applyUserSettings(settings) {
  const merged = { ...DEFAULTS, ...settings };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch { /* ignore */ }
  document.documentElement.setAttribute('data-theme', merged.darkMode ? 'dark' : 'light');
  document.documentElement.setAttribute('data-color-scheme', merged.colorScheme || 'standard');
}

export function clearUserSettings() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-color-scheme');
}
