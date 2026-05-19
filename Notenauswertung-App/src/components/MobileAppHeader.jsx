import React from 'react';
import { PanelLeft, Settings, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Fester Smartphone-Header: Fächer links, Kopfbereich ein/aus (Mitte), App-Einstellungen rechts.
 * Seiteneinstellungen (KA/Test/…) werden separat unter der Suchleiste in App.jsx umgeschaltet.
 */
export default function MobileAppHeader({
  headerRef,
  expanded,
  onToggleExpanded,
  onOpenCourses,
  onOpenSettings,
  coursesOpen = false,
  settingsOpen = false,
  children,
}) {
  return (
    <header
      ref={headerRef}
      className={`app-mobile-header${expanded ? '' : ' is-collapsed'}`}
    >
      <div className="app-mobile-header-toolbar">
        <button
          type="button"
          className="app-mobile-header-btn"
          onClick={onOpenCourses}
          aria-expanded={coursesOpen}
          aria-label={coursesOpen ? 'Fächer schließen' : 'Fächer anzeigen'}
        >
          <PanelLeft size={20} strokeWidth={2} aria-hidden />
          <span>Fächer</span>
        </button>
        <button
          type="button"
          className="app-mobile-header-btn app-mobile-header-btn--toggle"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-label={expanded ? 'Titel, Tabs und Suche einklappen' : 'Titel, Tabs und Suche ausklappen'}
        >
          {expanded ? (
            <ChevronUp size={22} strokeWidth={2.25} aria-hidden />
          ) : (
            <ChevronDown size={22} strokeWidth={2.25} aria-hidden />
          )}
        </button>
        <button
          type="button"
          className="app-mobile-header-btn app-mobile-header-btn--right"
          onClick={onOpenSettings}
          aria-expanded={settingsOpen}
          aria-label={settingsOpen ? 'Einstellungen schließen' : 'Einstellungen anzeigen'}
        >
          <Settings size={20} strokeWidth={2} aria-hidden />
          <span>Einstellungen</span>
        </button>
      </div>
      {expanded && children ? <div className="app-mobile-header-body">{children}</div> : null}
    </header>
  );
}
