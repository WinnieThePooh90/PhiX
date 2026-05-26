import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import { usePhiXRegistration } from '../utils/phixRegistration';
import { apiFetch } from '../utils/apiBase';
import { applyCryptoHeader } from '../utils/cryptoSession';

const TIMEOUT_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);

const COLOR_SCHEMES = [
  { value: 'standard', label: 'Standard', preview: 'hsl(222 47% 11%)', registered: false },
  { value: 'blue', label: 'Hellblau', preview: 'hsl(207 90% 45%)', registered: false },
  { value: 'green', label: 'Hellgr\u00FCn', preview: 'hsl(152 60% 38%)', registered: false },
  { value: 'purple', label: 'Lila', preview: 'hsl(262 70% 50%)', registered: true },
  { value: 'orange', label: 'Orange', preview: 'hsl(25 95% 50%)', registered: true },
  { value: 'pink', label: 'Pink', preview: 'hsl(330 75% 50%)', registered: true },
  { value: 'teal', label: 'T\u00FCrkis', preview: 'hsl(180 65% 35%)', registered: true },
];

export default function UserSettingsView() {
  const { currentUser } = useAuth();
  const { registered } = usePhiXRegistration();
  const [settings, setSettings] = useState({ inactivityTimeoutMin: 5, darkMode: false, colorScheme: 'standard' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!currentUser?.username) return;
    try {
      const headers = applyCryptoHeader(new Headers());
      headers.set('X-Acting-User', currentUser.username);
      const res = await apiFetch('/api/user-settings', { headers });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load user settings', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key, value) => {
    if (!currentUser?.username) return;
    setSaving(true);
    try {
      const headers = applyCryptoHeader(new Headers({ 'Content-Type': 'application/json' }));
      headers.set('X-Acting-User', currentUser.username);
      const res = await apiFetch('/api/user-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (key === 'darkMode') {
          document.documentElement.setAttribute('data-theme', value ? 'dark' : 'light');
        }
        if (key === 'colorScheme') {
          document.documentElement.setAttribute('data-color-scheme', value || 'standard');
        }
        if (key === 'inactivityTimeoutMin') {
          window.dispatchEvent(new CustomEvent('phix-settings-changed', { detail: { inactivityTimeoutMin: value } }));
        }
      }
    } catch (err) {
      console.error('Failed to save user settings', err);
    } finally {
      setSaving(false);
    }
  }, [currentUser?.username]);

  if (loading) {
    return (
      <div className="view-generic-scroll program-view">
        <h2 className="view-title">Einstellungen</h2>
        <p>Laden…</p>
      </div>
    );
  }

  return (
    <div className="view-generic-scroll program-view">
      <h2 className="view-title">Einstellungen</h2>

      <section className="glass-panel user-settings-section">
        <h3 className="user-settings-heading">Automatischer Logout bei Inaktivität</h3>
        <p className="user-settings-description">
          Nach dieser Zeit ohne Maus- oder Tastatureingabe wirst du automatisch abgemeldet.
        </p>
        <div className="user-settings-control">
          <select
            className="user-settings-select"
            value={settings.inactivityTimeoutMin}
            disabled={saving}
            onChange={(e) => updateSetting('inactivityTimeoutMin', Number(e.target.value))}
          >
            {TIMEOUT_OPTIONS.map((min) => (
              <option key={min} value={min}>
                {min} Minuten
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="glass-panel user-settings-section">
        <h3 className="user-settings-heading">Erscheinungsbild</h3>
        <div className="user-settings-control">
          <label className="switch" title="Dunkles Design ein-/ausschalten">
            <input
              type="checkbox"
              checked={settings.darkMode}
              disabled={saving}
              onChange={(e) => updateSetting('darkMode', e.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="user-settings-label">Dunkles Design (Dark Mode)</span>
        </div>

        <div className="user-settings-control" style={{ marginTop: '1.25rem' }}>
          <span className="user-settings-label" style={{ marginRight: '1rem' }}>Farbschema</span>
          <div className="color-scheme-options">
            {COLOR_SCHEMES.filter((s) => !s.registered || registered).map((scheme) => (
              <button
                key={scheme.value}
                type="button"
                className={`color-scheme-btn${settings.colorScheme === scheme.value ? ' color-scheme-btn--active' : ''}`}
                disabled={saving}
                onClick={() => updateSetting('colorScheme', scheme.value)}
                title={scheme.label}
              >
                <span
                  className="color-scheme-btn__swatch"
                  style={{ background: scheme.preview }}
                />
                <span className="color-scheme-btn__label">{scheme.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
