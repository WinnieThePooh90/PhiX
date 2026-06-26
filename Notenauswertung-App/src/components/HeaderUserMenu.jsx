import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useDialog } from './PhixDialog';
import { apiFetch } from '../utils/apiBase';

/**
 * @param {object} props
 * @param {boolean} [props.settingsMenuOpen] — wenn true: Benutzer-Dropdown schließen (Einstellungen offen)
 * @param {(open: boolean) => void} [props.onMenuOpenChange] — `true` wenn Menü geöffnet wird (z. B. Einstellungen schließen)
 */
export default function HeaderUserMenu({ settingsMenuOpen = false, onMenuOpenChange }) {
  const { currentUser, logout } = useAuth();
  const { showConfirm, showAlert } = useDialog();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (settingsMenuOpen) setOpen(false);
  }, [settingsMenuOpen]);

  const setMenuOpen = (next) => {
    setOpen(next);
    if (next) onMenuOpenChange?.(true);
    else onMenuOpenChange?.(false);
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const sync = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      const dropdownMinWidth = 152;
      const margin = 8;
      const vertical =
        spaceBelow < 140
          ? { bottom: window.innerHeight - r.top + 6, top: 'auto' }
          : { top: r.bottom + 6, bottom: 'auto' };

      if (isMobile) {
        const left = Math.max(margin, Math.min(r.left, window.innerWidth - dropdownMinWidth - margin));
        setPos({
          ...vertical,
          left,
          right: 'auto',
        });
      } else {
        setPos({
          ...vertical,
          right: Math.max(0, window.innerWidth - r.right),
          left: 'auto',
        });
      }
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (wrapRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const handleShutdown = async () => {
    const ok = await showConfirm(
      'PhiX wirklich herunterfahren?\n\nServer, Datenbank und alle zugehörigen Dienste werden beendet.',
      { title: 'Herunterfahren', danger: true },
    );
    if (!ok) return;
    setMenuOpen(false);
    const headers = { 'Content-Type': 'application/json' };
    if (currentUser?.username) headers['X-Acting-User'] = currentUser.username;
    const token = (() => {
      try {
        return sessionStorage.getItem('phix_crypto_session_token');
      } catch {
        return null;
      }
    })();
    if (token) headers['X-Phix-Crypto-Token'] = token;

    try {
      if (import.meta.env.DEV) {
        fetch('/shutdown', { method: 'POST' }).catch(() => {});
      }
      const res = await apiFetch('/api/shutdown', { method: 'POST', headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      logout();
      await showAlert(
        'PhiX wird heruntergefahren. Alle Container werden gestoppt \u2013 Sie k\u00F6nnen das Browserfenster schlie\u00DFen.',
        { title: 'Heruntergefahren' },
      );
    } catch (err) {
      await showAlert(`Herunterfahren fehlgeschlagen: ${err?.message || err}`, { title: 'Fehler' });
    }
  };

  if (!currentUser) return null;

  return (
    <div className="header-user-menu-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="tab equiphi-nav-btn equiphi-user-btn"
        onClick={() => setMenuOpen(!open)}
        title={`Benutzer: ${currentUser.username}`}
        aria-label="Benutzermenü öffnen"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User className="header-lucide-icon" size={18} strokeWidth={2} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            className="header-settings-dropdown header-settings-dropdown--portal"
            role="menu"
            aria-label="Benutzer"
            style={pos}
          >
            <div className="header-user-menu-info" role="none">
              Angemeldet als <strong>{currentUser.username}</strong>
            </div>
            <hr className="header-settings-dropdown-divider" aria-hidden />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
            >
              Abmelden
            </button>
            <button
              type="button"
              role="menuitem"
              className="header-settings-dropdown-item--danger"
              onClick={handleShutdown}
            >
              Herunterfahren
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
