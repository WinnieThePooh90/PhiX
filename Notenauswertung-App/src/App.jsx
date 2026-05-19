import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Settings,
  Star,
  Heart,
  PanelLeft,
  PanelRight,
  X,
} from 'lucide-react';
import { useData } from './store/DataContext';
import { useAuth } from './store/AuthContext';
import SettingsView from './views/SettingsView';
import NewCourseForm from './components/NewCourseForm';
import SchoolRosterView from './views/SchoolRosterView';
import UserManagementView from './views/UserManagementView';
import AppInfoView from './views/AppInfoView';
import DependenciesView from './views/DependenciesView';
import ImpressumView from './views/ImpressumView';
import AnalysisView from './views/AnalysisView';
import ExamsView from './views/ExamsView';
import OralView from './views/OralView';
import TestsView from './views/TestsView';
import GfsView from './views/GfsView';
import SummaryView from './views/SummaryView';
import KeysView from './views/KeysView';
import SupportPhiXView from './views/SupportPhiXView';
import HeaderUserMenu from './components/HeaderUserMenu';
import SettingsNavMenu from './components/SettingsNavMenu';

const MOBILE_MEDIA = '(max-width: 768px)';
import { resolveStudentIdFilterSet } from './utils/studentSearchFilter';
import { APP_NAME } from './config/app';
import { usePhiXRegistration } from './utils/phixRegistration';

/** Schuljahres-String z. B. „2025/2026“ → erstes Jahr für Sortierung (höher = neuer = weiter oben). */
function schoolYearStartForSort(yearRaw) {
  const m = String(yearRaw ?? '').trim().match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function courseSidebarLabel(c) {
  return `${c.subject ?? ''} ${c.className ?? ''}`.trim();
}

/** Ermöglicht Suche wie in der Leiste (z. B. „Physik 10“) sowie getrennte Begriffe / Reihenfolge. */
function courseMatchesSidebarSearch(c, queryRaw) {
  const q = queryRaw.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    courseSidebarLabel(c),
    String(c.year ?? ''),
    c.subject ?? '',
    c.className ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const qNorm = q.replace(/\s+/g, ' ');
  if (haystack.includes(qNorm)) return true;
  const tokens = qNorm.split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isNewCoursePage = location.pathname === '/courses/new';

  const { config, courses, activeCourseId, setActiveCourseId, toggleCourseFavorite, students } = useData();
  const { currentUser } = useAuth();
  const { registered: phixRegistered } = usePhiXRegistration();
  const isAdminUser = currentUser?.username?.toLowerCase() === 'admin';
  const [activeTab, setActiveTab] = useState('summary');

  const showTestsTab = config?.testsWritten !== false;
  const showGfsTab = config?.gfsAccepted !== false;

  useEffect(() => {
    if (!showTestsTab && activeTab === 'tests') setActiveTab('summary');
    if (!showGfsTab && activeTab === 'gfs') setActiveTab('summary');
  }, [showTestsTab, showGfsTab, activeTab]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA);
    const onChange = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) {
        setMobileCoursesOpen(false);
        setMobileSettingsOpen(false);
      }
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;
    const open = mobileCoursesOpen || mobileSettingsOpen;
    document.body.classList.toggle('app-mobile-drawer-open', open);
    return () => document.body.classList.remove('app-mobile-drawer-open');
  }, [isMobile, mobileCoursesOpen, mobileSettingsOpen]);

  useEffect(() => {
    setMobileCoursesOpen(false);
    setMobileSettingsOpen(false);
  }, [activeTab, isNewCoursePage]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MEDIA).matches : false,
  );
  const [mobileCoursesOpen, setMobileCoursesOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [selectedYearFilter, setSelectedYearFilter] = useState('');
  const [sidebarCourseSearch, setSidebarCourseSearch] = useState('');
  const [headerSearch, setHeaderSearch] = useState('');
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [settingsMenuPos, setSettingsMenuPos] = useState(null);
  const settingsMenuRef = useRef(null);
  const settingsGearRef = useRef(null);
  const settingsDropdownRef = useRef(null);

  const uniqueYears = [...new Set(courses.map((c) => c.year))].sort().reverse();

  const sidebarCourses = React.useMemo(() => {
    const q = sidebarCourseSearch;
    const textMatch = (c) => courseMatchesSidebarSearch(c, q);
    const labelCompare = (a, b) =>
      courseSidebarLabel(a).localeCompare(courseSidebarLabel(b), 'de', { numeric: true, sensitivity: 'base' });

    const favorites = courses.filter((c) => c.isFavorite === true && textMatch(c)).sort(labelCompare);

    const rest = courses
      .filter(
        (c) =>
          c.isFavorite !== true &&
          (!selectedYearFilter || c.year === selectedYearFilter) &&
          textMatch(c),
      )
      .sort((a, b) => {
        const yd = schoolYearStartForSort(b.year) - schoolYearStartForSort(a.year);
        if (yd !== 0) return yd;
        return labelCompare(a, b);
      });

    return [...favorites, ...rest];
  }, [courses, selectedYearFilter, sidebarCourseSearch]);

  const studentIdFilterSet = React.useMemo(
    () => resolveStudentIdFilterSet(students, headerSearch),
    [students, headerSearch],
  );

  useLayoutEffect(() => {
    if (!settingsMenuOpen) {
      setSettingsMenuPos(null);
      return undefined;
    }
    const sync = () => {
      const el = settingsGearRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSettingsMenuPos({
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
      });
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [settingsMenuOpen]);

  useEffect(() => {
    if (!settingsMenuOpen) return undefined;
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (settingsMenuRef.current?.contains(t)) return;
      if (settingsDropdownRef.current?.contains(t)) return;
      if (t.closest('.header-user-menu-wrap')) return;
      setSettingsMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [settingsMenuOpen]);

  useEffect(() => {
    setSettingsMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isAdminUser && activeTab === 'dependencies') {
      setActiveTab('summary');
    }
  }, [isAdminUser, activeTab]);

  const openMainTab = (tab) => {
    if (isNewCoursePage) navigate('/');
    setActiveTab(tab);
    setMobileSettingsOpen(false);
    setMobileCoursesOpen(false);
  };

  const sidebarShowsNav = !sidebarCollapsed || isMobile;

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileSettingsOpen(false);
      setMobileCoursesOpen((o) => !o);
      return;
    }
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const closeMobileDrawers = () => {
    setMobileCoursesOpen(false);
    setMobileSettingsOpen(false);
  };

  const handleNewCourseClick = () => {
    navigate('/courses/new');
  };

  const renderView = () => {
    switch (activeTab) {
      case 'settings':
        return <SettingsView />;
      case 'exams':
        return <ExamsView studentIdFilterSet={studentIdFilterSet} />;
      case 'oral':
        return <OralView studentIdFilterSet={studentIdFilterSet} />;
      case 'tests':
        return <TestsView studentIdFilterSet={studentIdFilterSet} />;
      case 'gfs':
        return <GfsView />;
      case 'summary':
        return <SummaryView studentIdFilterSet={studentIdFilterSet} />;
      case 'keys':
        return <KeysView />;
      case 'schoolRoster':
        return <SchoolRosterView onBack={() => openMainTab('summary')} />;
      case 'userManagement':
        return <UserManagementView />;
      case 'analysis':
        return <AnalysisView />;
      case 'appInfo':
        return <AppInfoView onOpenSupport={() => openMainTab('support')} />;
      case 'dependencies':
        return isAdminUser ? <DependenciesView /> : <SummaryView studentIdFilterSet={studentIdFilterSet} />;
      case 'support':
        return <SupportPhiXView onRegistrationSuccess={() => openMainTab('appInfo')} />;
      case 'impressum':
        return <ImpressumView />;
      default:
        return <SummaryView studentIdFilterSet={studentIdFilterSet} />;
    }
  };

  const selectCourse = (courseId) => {
    setActiveCourseId(courseId);
    if (isNewCoursePage) navigate('/');
    if (isMobile) setMobileCoursesOpen(false);
  };

  return (
    <div className={`app-container${isMobile ? ' app-container--mobile' : ''}`}>
      {isMobile && (mobileCoursesOpen || mobileSettingsOpen) && (
        <button
          type="button"
          className="app-mobile-backdrop"
          aria-label="Menü schließen"
          onClick={closeMobileDrawers}
        />
      )}

      <aside
        className={[
          'app-sidebar',
          !isMobile && sidebarCollapsed ? 'collapsed' : '',
          isMobile ? 'app-sidebar--mobile' : '',
          isMobile && mobileCoursesOpen ? 'app-sidebar--open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={isMobile && !mobileCoursesOpen}
      >
        <div className="app-sidebar-header">
          {sidebarShowsNav && <span>Meine Fächer</span>}
          <button
            type="button"
            className={!isMobile && sidebarCollapsed ? 'equiphi-sidebar-toggle' : undefined}
            style={{ padding: '0.25rem 0.5rem', marginLeft: sidebarShowsNav && !isMobile ? 'auto' : undefined }}
            onClick={toggleSidebar}
            title={isMobile ? 'Fächer schließen' : 'Sidebar einklappen/ausklappen'}
            aria-expanded={isMobile ? mobileCoursesOpen : !sidebarCollapsed}
          >
            {isMobile ? <X size={20} strokeWidth={2} aria-hidden /> : sidebarCollapsed ? '➔' : '☰'}
          </button>
        </div>
        <div className="app-sidebar-nav">
          {sidebarShowsNav && (
            <>
              <div className="app-sidebar-nav-scroll">
                {uniqueYears.length > 0 && (
                  <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)' }}>
                    <select
                      value={selectedYearFilter}
                      onChange={(e) => setSelectedYearFilter(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                    >
                      <option value="">Alle Schuljahre</option>
                      {uniqueYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {sidebarCourses.map((course) => {
                  const fav = course.isFavorite === true;
                  return (
                    <div
                      key={course.id}
                      className={`course-item course-item--with-fav ${activeCourseId === course.id ? 'active' : ''}`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="course-item-main"
                        onClick={() => selectCourse(course.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectCourse(course.id);
                          }
                        }}
                      >
                        <div className="course-item-title">
                          {course.subject} {course.className}
                        </div>
                        <div className="course-item-meta">
                          {course.year}, {course.weighting?.written ?? ''}:{course.weighting?.oral ?? ''}:{course.weighting?.tests ?? ''}
                          {isAdminUser && course.ownerUsername ? (
                            <>
                              {' · '}
                              {course.ownerUsername}
                            </>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`course-item-fav${fav ? ' course-item-fav--on' : ''}`}
                        title={fav ? 'Favorit entfernen' : 'Als Favorit markieren'}
                        aria-pressed={fav}
                        aria-label={fav ? 'Favorit entfernen' : 'Als Favorit markieren'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCourseFavorite(course.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <Star size={18} strokeWidth={2} fill={fav ? 'currentColor' : 'none'} aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="app-sidebar-footer">
                <div className="app-sidebar-course-search-wrap">
                  <Search className="app-sidebar-course-search-icon" size={14} strokeWidth={2} aria-hidden />
                  <input
                    type="search"
                    className="app-sidebar-course-search-input"
                    placeholder="Fächer filtern…"
                    value={sidebarCourseSearch}
                    onChange={(e) => setSidebarCourseSearch(e.target.value)}
                    aria-label="Fächer in der Liste filtern"
                  />
                </div>
                <button type="button" className="app-sidebar-new-course-btn" onClick={handleNewCourseClick}>
                  + Neues Fach
                </button>
                {phixRegistered ? (
                  <div className="app-sidebar-thanks" role="status">
                    <span className="app-sidebar-thanks__line">
                      <Heart className="app-sidebar-thanks__heart" size={15} strokeWidth={2} aria-hidden />
                      <span>Herzlichen Dank</span>
                      <Heart className="app-sidebar-thanks__heart" size={15} strokeWidth={2} aria-hidden />
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`app-sidebar-support-btn secondary${activeTab === 'support' ? ' app-sidebar-support-btn--active' : ''}`}
                    onClick={() => openMainTab('support')}
                  >
                    {APP_NAME} unterstützen
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </aside>

      {isMobile && (
        <aside
          className={`app-mobile-settings-panel${mobileSettingsOpen ? ' is-open' : ''}`}
          aria-hidden={!mobileSettingsOpen}
        >
          <div className="app-mobile-panel-header">
            <span>Einstellungen</span>
            <button
              type="button"
              className="app-mobile-panel-close"
              onClick={() => setMobileSettingsOpen(false)}
              aria-label="Einstellungen schließen"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <SettingsNavMenu
            className="settings-nav-menu--panel"
            isAdminUser={isAdminUser}
            onSelect={openMainTab}
            onNewCourse={handleNewCourseClick}
            onClose={() => setMobileSettingsOpen(false)}
          />
          <div className="app-mobile-panel-footer">
            <HeaderUserMenu
              settingsMenuOpen={settingsMenuOpen}
              onMenuOpenChange={(o) => {
                if (o) setSettingsMenuOpen(false);
              }}
            />
          </div>
        </aside>
      )}

      {isMobile && (
        <>
          <button
            type="button"
            className="app-mobile-rail app-mobile-rail--left"
            onClick={() => {
              setMobileSettingsOpen(false);
              setMobileCoursesOpen((o) => !o);
            }}
            aria-expanded={mobileCoursesOpen}
            aria-label={mobileCoursesOpen ? 'Fächer schließen' : 'Fächer öffnen'}
          >
            <PanelLeft size={22} strokeWidth={2} aria-hidden />
            <span className="app-mobile-rail-label">Fächer</span>
          </button>
          <button
            type="button"
            className="app-mobile-rail app-mobile-rail--right"
            onClick={() => {
              setMobileCoursesOpen(false);
              setMobileSettingsOpen((o) => !o);
            }}
            aria-expanded={mobileSettingsOpen}
            aria-label={mobileSettingsOpen ? 'Einstellungen schließen' : 'Einstellungen öffnen'}
          >
            <PanelRight size={22} strokeWidth={2} aria-hidden />
            <span className="app-mobile-rail-label">Mehr</span>
          </button>
        </>
      )}

      <div className="app-main">
        {isNewCoursePage ? (
          <>
            <div className="sticky-header">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <header style={{ textAlign: 'left' }}>
                  <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.5rem' }}>Neues Fach anlegen</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Schuljahr, Klasse, Fach und Gewichtung erfassen
                  </p>
                </header>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  <button type="button" className="secondary" onClick={() => navigate('/')}>
                    Zurück
                  </button>
                  <HeaderUserMenu
                    settingsMenuOpen={settingsMenuOpen}
                    onMenuOpenChange={(o) => {
                      if (o) setSettingsMenuOpen(false);
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="app-main-content-wrap">
              <main className="app-main-views">
                <NewCourseForm />
              </main>
            </div>
          </>
        ) : config ? (
          <>
            <div className="sticky-header">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  alignItems: 'stretch',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <header style={{ textAlign: 'left' }}>
                    <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.5rem' }}>
                      {config.subject} {config.className || config.class}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      Schuljahr: {config.year}
                      {config.weighting != null && (
                        <>
                          {' · '}
                          Gewichtung: {config.weighting.written ?? '—'}:{config.weighting.oral ?? '—'}:{config.weighting.tests ?? '—'}
                        </>
                      )}
                      {isAdminUser && config.ownerUsername ? (
                        <>
                          {' · '}
                          {config.ownerUsername}
                        </>
                      ) : null}
                    </p>
                  </header>

                  <nav className="tabs equiphi-tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                    <button type="button" className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
                      Übersicht
                    </button>
                    <button type="button" className={`tab ${activeTab === 'exams' ? 'active' : ''}`} onClick={() => setActiveTab('exams')}>
                      Klausuren
                    </button>
                    <button type="button" className={`tab ${activeTab === 'oral' ? 'active' : ''}`} onClick={() => setActiveTab('oral')}>
                      Mündlich
                    </button>
                    {showTestsTab && (
                      <button type="button" className={`tab ${activeTab === 'tests' ? 'active' : ''}`} onClick={() => setActiveTab('tests')}>
                        Tests
                      </button>
                    )}
                    {showGfsTab && (
                      <button type="button" className={`tab ${activeTab === 'gfs' ? 'active' : ''}`} onClick={() => setActiveTab('gfs')}>
                        GFS
                      </button>
                    )}
                    <div className="header-settings-menu-wrap app-desktop-only" ref={settingsMenuRef}>
                      <button
                        ref={settingsGearRef}
                        type="button"
                        className={`tab equiphi-nav-btn equiphi-settings-btn ${activeTab === 'settings' || activeTab === 'schoolRoster' || activeTab === 'userManagement' || activeTab === 'keys' || activeTab === 'analysis' || activeTab === 'appInfo' || activeTab === 'impressum' || (isAdminUser && activeTab === 'dependencies') ? 'active' : ''}`}
                        onClick={() => setSettingsMenuOpen((o) => !o)}
                        title="Einstellungen"
                        aria-label="Einstellungen öffnen"
                        aria-expanded={settingsMenuOpen}
                        aria-haspopup="menu"
                      >
                        <Settings className="header-lucide-icon" size={18} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                    <div className="app-desktop-only">
                      <HeaderUserMenu
                        settingsMenuOpen={settingsMenuOpen}
                        onMenuOpenChange={(o) => {
                          if (o) setSettingsMenuOpen(false);
                        }}
                      />
                    </div>
                    {!isMobile &&
                      settingsMenuOpen &&
                      settingsMenuPos &&
                      createPortal(
                        <div
                          ref={settingsDropdownRef}
                          className="header-settings-dropdown header-settings-dropdown--portal"
                          role="menu"
                          aria-label="Einstellungen"
                          style={{
                            top: settingsMenuPos.top,
                            right: settingsMenuPos.right,
                          }}
                        >
                          <SettingsNavMenu
                            isAdminUser={isAdminUser}
                            onSelect={openMainTab}
                            onNewCourse={handleNewCourseClick}
                            onClose={() => setSettingsMenuOpen(false)}
                          />
                        </div>,
                        document.body,
                      )}
                  </nav>
                </div>

                {(isMobile || !sidebarCollapsed) && (
                  <div className="header-controls-row">
                    <div className="header-search-wrap">
                      <Search className="header-search-lucide" size={16} strokeWidth={2} aria-hidden />
                      <input
                        className="header-search-input"
                        type="search"
                        placeholder="Schüler suchen (Name, Nr.)…"
                        value={headerSearch}
                        onChange={(e) => setHeaderSearch(e.target.value)}
                        aria-label="Schüler in Übersicht, Klausuren, Mündlich und Tests nach Vorname, Nachname oder Nummer filtern"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="app-main-content-wrap">
              <main className="app-main-views">{renderView()}</main>
            </div>
          </>
        ) : (
          <div
            className="app-main-empty-state"
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 0%',
              minHeight: 0,
              minWidth: 0,
              width: '100%',
              position: 'relative',
            }}
          >
            <div className="app-main-empty-state-user app-desktop-only">
              <HeaderUserMenu
                settingsMenuOpen={settingsMenuOpen}
                onMenuOpenChange={(o) => {
                  if (o) setSettingsMenuOpen(false);
                }}
              />
            </div>
            <div
              style={{
                flex: '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2rem',
                textAlign: 'center',
                minHeight: 0,
              }}
            >
              <h2>Kein Fach ausgewählt oder vorhanden</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Lege ein neues Fach an, um mit {APP_NAME} zu starten.
              </p>
              <button type="button" onClick={handleNewCourseClick}>
                Neues Fach anlegen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
