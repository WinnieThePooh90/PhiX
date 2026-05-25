import React from 'react';
import { Plus } from 'lucide-react';

/**
 * Einstellungs-Navigation (Desktop-Dropdown & mobile rechte Leiste).
 */
export default function SettingsNavMenu({
  isAdminUser,
  showKlassenlehrer = false,
  showCourseMenuItems = true,
  onSelect,
  onNewCourse,
  onClose,
  className = '',
}) {
  const pick = (tab) => {
    onSelect(tab);
    onClose?.();
  };

  return (
    <nav className={`settings-nav-menu ${className}`.trim()} role="menu" aria-label="Einstellungen">
      {showCourseMenuItems ? (
        <>
          <button type="button" role="menuitem" onClick={() => pick('settings')}>
            Klasse
          </button>
          <button type="button" role="menuitem" onClick={() => pick('analysis')}>
            Analyse
          </button>
          {showKlassenlehrer ? (
            <button type="button" role="menuitem" onClick={() => pick('klassenlehrer')}>
              Klassenlehrer
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={() => pick('export')}>
            Export
          </button>
          <hr className="header-settings-dropdown-divider" aria-hidden />
        </>
      ) : null}
      <button type="button" role="menuitem" onClick={() => pick('keys')}>
        Notenschlüssel
      </button>
      <button type="button" role="menuitem" onClick={() => pick('schoolRoster')}>
        Schülerverwaltung
      </button>
      <button type="button" role="menuitem" onClick={() => pick('userManagement')}>
        Benutzerverwaltung
      </button>
      <button type="button" role="menuitem" onClick={() => pick('backup')}>
        Backup
      </button>
      <hr className="header-settings-dropdown-divider" aria-hidden />
      <button type="button" role="menuitem" onClick={() => pick('appInfo')}>
        Info
      </button>
      <button type="button" role="menuitem" onClick={() => pick('impressum')}>
        Impressum
      </button>
      <button type="button" role="menuitem" onClick={() => pick('help')}>
        Hilfe
      </button>
      <button type="button" role="menuitem" onClick={() => pick('supportOverview')}>
        Unterstützung
      </button>
      {isAdminUser ? (
        <button type="button" role="menuitem" onClick={() => pick('dependencies')}>
          Dependencies
        </button>
      ) : null}
      <hr className="header-settings-dropdown-divider" aria-hidden />
      <button
        type="button"
        role="menuitem"
        className="header-settings-dropdown-item--with-icon"
        onClick={() => {
          onNewCourse();
          onClose?.();
        }}
      >
        <Plus className="header-settings-dropdown-icon" size={16} strokeWidth={2} aria-hidden />
        Neues Fach
      </button>
    </nav>
  );
}
