import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../store/AuthContext';
import { usePhiXRegistration } from '../utils/phixRegistration';
import { apiFetch } from '../utils/apiBase';
import { applyCryptoHeader } from '../utils/cryptoSession';
import { userHasAdminRights } from '../utils/userAdmin';

const TIMEOUT_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);

const COLOR_SCHEMES = [
  { value: 'standard', label: 'Standard', preview: 'hsl(222 47% 11%)', registered: false },
  { value: 'blue', label: 'Hellblau', preview: 'hsl(207 90% 45%)', registered: false },
  { value: 'green', label: 'Hellgrün', preview: 'hsl(152 60% 38%)', registered: false },
  { value: 'purple', label: 'Lila', preview: 'hsl(262 70% 50%)', registered: true },
  { value: 'orange', label: 'Orange', preview: 'hsl(25 95% 50%)', registered: true },
  { value: 'pink', label: 'Pink', preview: 'hsl(330 75% 50%)', registered: true },
  { value: 'teal', label: 'Türkis', preview: 'hsl(180 65% 35%)', registered: true },
  { value: 'gold', label: 'Gold', preview: 'hsl(45 90% 42%)', registered: true },
  { value: 'red', label: 'Rot', preview: 'hsl(0 72% 48%)', registered: true },
  { value: 'indigo', label: 'Indigo', preview: 'hsl(240 60% 52%)', registered: true },
  { value: 'yellow', label: 'Gelb', preview: '#ffff00', registered: true },
];

export default function UserSettingsView() {
  const { currentUser, logout } = useAuth();
  const isAdminUser = userHasAdminRights(currentUser);
  const { registered } = usePhiXRegistration();
  const [settings, setSettings] = useState({ inactivityTimeoutMin: 5, darkMode: false, colorScheme: 'standard' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isConfirmedCheckbox, setIsConfirmedCheckbox] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState(null);

  const fetchSettings = useCallback(async () => {
    if (!currentUser?.username) return;
    try {
      const headers = applyCryptoHeader(new Headers());
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

  const handleFactoryReset = async () => {
    if (!isConfirmedCheckbox || isResetting) return;
    setIsResetting(true);
    setResetError(null);
    try {
      const headers = applyCryptoHeader(new Headers({ 'Content-Type': 'application/json' }));
      const res = await apiFetch('/api/setup/factory-reset', {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        let msg = 'Zurücksetzen fehlgeschlagen.';
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {}
        throw new Error(msg);
      }
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      await logout();
      window.location.reload();
    } catch (err) {
      console.error('Factory reset failed:', err);
      setResetError(err.message || 'Zurücksetzen fehlgeschlagen.');
      setIsResetting(false);
    }
  };

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

      {isAdminUser ? (
        <section className="glass-panel user-settings-section user-settings-section--danger" style={{ marginTop: '1rem' }}>
          <h3 className="user-settings-heading user-settings-heading--danger">Danger Zone</h3>
          <p className="user-settings-description">
            Unwiderrufliche Aktionen für das gesamte System.
          </p>
          <div className="user-settings-control">
            <button
              type="button"
              className="tab secondary program-view-panel-cta backup-action-btn backup-action-btn--danger"
              onClick={() => {
                setIsConfirmedCheckbox(false);
                setResetError(null);
                setResetModalOpen(true);
              }}
            >
              PhiX zurücksetzen
            </button>
          </div>
        </section>
      ) : null}

      {resetModalOpen && createPortal(
        <div
          className="modal-overlay phix-dialog-overlay"
          onClick={() => {
            if (!isResetting) setResetModalOpen(false);
          }}
        >
          <div
            className="modal-card phix-dialog-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '90%' }}
          >
            <h2 className="phix-dialog-title" style={{ color: 'var(--danger, #ef4444)' }}>
              PhiX zurücksetzen
            </h2>
            <p className="phix-dialog-message">
              Achtung: Das zurücksetzen löscht sämtliche Daten und setzt das Programm komplett zurück. Bist du sicher, dass du das möchtest?
            </p>

            <div style={{ margin: '1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <input
                type="checkbox"
                id="confirm-reset-checkbox"
                checked={isConfirmedCheckbox}
                onChange={(e) => setIsConfirmedCheckbox(e.target.checked)}
                disabled={isResetting}
                style={{ width: '1.2rem', height: '1.2rem', cursor: isResetting ? 'not-allowed' : 'pointer' }}
              />
              <label
                htmlFor="confirm-reset-checkbox"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                }}
              >
                Ja, ich bin mir sicher
              </label>
            </div>

            {resetError ? (
              <p style={{ color: 'var(--danger, #ef4444)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {resetError}
              </p>
            ) : null}

            <div className="phix-dialog-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn phix-dialog-btn phix-dialog-btn--cancel"
                onClick={() => setResetModalOpen(false)}
                disabled={isResetting}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn phix-dialog-btn phix-dialog-btn--confirm phix-dialog-btn--danger"
                disabled={!isConfirmedCheckbox || isResetting}
                onClick={handleFactoryReset}
                style={{
                  opacity: !isConfirmedCheckbox || isResetting ? 0.45 : 1,
                  cursor: !isConfirmedCheckbox || isResetting ? 'not-allowed' : 'pointer',
                }}
              >
                {isResetting ? 'Wird zurückgesetzt…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

