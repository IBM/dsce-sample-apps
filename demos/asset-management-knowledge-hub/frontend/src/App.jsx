import React, { useState, useEffect, useRef } from 'react';
import {
  Theme,
  Header,
  HeaderMenuButton,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SkipToContent,
} from '@carbon/react';
import {
  Notification,
  Logout,
  IbmWatsonAssistant,
  Bullhorn,
  DataConnected,
  CalendarHeatMap,
  CloudAuditing,
  ChartLineData,
  Cube,
  Settings,
} from '@carbon/icons-react';

import Login          from './pages/Login';
import AgentChat      from './pages/AgentChat';
import Configuration  from './pages/Configuration';
import Audit          from './pages/Audit';
import Statistics     from './pages/Statistics';
import DataIngestion  from './pages/DataIngestion';
import Architecture   from './pages/Architecture';
import ActionCenter   from './pages/ActionCenter';
import ActionDetail   from './pages/ActionDetail';
import ScheduledJobs  from './pages/ScheduledJobs';
import './App.scss';

const PAGES = [
  { key: 'agent',         label: 'Knowledge Hub',  Icon: IbmWatsonAssistant, Page: AgentChat     },
  { key: 'actions',       label: 'Action Center',  Icon: Bullhorn,           Page: ActionCenter  },
  { key: 'ingestion',     label: 'Data Ingestion', Icon: DataConnected,      Page: DataIngestion },
  { key: 'scheduledjobs', label: 'Scheduled Jobs', Icon: CalendarHeatMap,    Page: ScheduledJobs },
  { key: 'audit',         label: 'Audit Log',      Icon: CloudAuditing,      Page: Audit         },
  { key: 'statistics',    label: 'Statistics',     Icon: ChartLineData,      Page: Statistics    },
  { key: 'architecture',  label: 'Architecture',   Icon: Cube,               Page: Architecture  },
  { key: 'configuration', label: 'Configuration',  Icon: Settings,           Page: Configuration },
];

// Expandable nav groups — each group becomes a SideNavMenu.
// Dividers are rendered between groups (not after the last one).
const NAV_GROUPS = [
  { label: 'Workspace',                items: ['agent', 'actions']           },
  { label: 'Data Operations',          items: ['ingestion', 'scheduledjobs'] },
  { label: 'Governance & Monitoring',  items: ['audit', 'statistics']        },
  { label: 'Platform Administration',  items: ['architecture', 'configuration'] },
];

const SIDENAV_BREAKPOINT = 1056;

function initials(name) {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function App() {
  const [user,             setUser]             = useState(null);
  const [active,           setActive]           = useState('agent');
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [sideNavOpen,      setSideNavOpen]      = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= SIDENAV_BREAKPOINT
  );

  // Keep default-open on wide screens, closed on narrow — but do NOT auto-reopen
  // when a wide-screen user has intentionally closed the nav.
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < SIDENAV_BREAKPOINT) setSideNavOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!user) {
    return <Login onLogin={(username) => setUser(username)} />;
  }

  const navigate = (key) => {
    setActive(key);
    setSelectedActionId(null);
    if (window.innerWidth < SIDENAV_BREAKPOINT) setSideNavOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    setActive('agent');
  };

  function openAction(id) {
    setActive('actions');
    setSelectedActionId(id);
  }

  function renderActionView() {
    if (!selectedActionId) {
      return <ActionCenter onOpen={openAction} />;
    }
    return (
      <ActionDetail
        actionId={selectedActionId}
        onBack={() => setSelectedActionId(null)}
        onOpen={openAction}
      />
    );
  }

  return (
    <Theme theme="g100">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Header aria-label="Asset Management Knowledge Hub">
        <SkipToContent href="#main-content" />
        <HeaderMenuButton
          aria-label={sideNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          isActive={sideNavOpen}
          isCollapsible
          onClick={() => setSideNavOpen(o => !o)}
        />
        <HeaderName prefix="" href="#">
          Asset Management Knowledge Hub
        </HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction aria-label="Notifications" tooltipAlignment="end">
            <Notification size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction
            aria-label={`Signed in as ${user}`}
            tooltipAlignment="end"
            className="header-user-action"
          >
            <span className="header-user-avatar" aria-hidden="true">
              {initials(user)}
            </span>
          </HeaderGlobalAction>
          <HeaderGlobalAction
            aria-label="Sign out"
            tooltipAlignment="end"
            onClick={handleLogout}
          >
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>

      {/* ── Side Navigation ─────────────────────────────────────────────────── */}
      <SideNav
        aria-label="Side navigation"
        expanded={sideNavOpen}
        isFixedNav
        onOverlayClick={() => setSideNavOpen(false)}
        className={`app-sidenav${sideNavOpen ? ' app-sidenav--open' : ' app-sidenav--closed'}`}
      >
        <SideNavItems>
          {NAV_GROUPS.map((group, gi) => {
            const groupPages = group.items
              .map(key => PAGES.find(p => p.key === key))
              .filter(Boolean);
            // Auto-expand the group that contains the active page
            const isGroupActive = group.items.includes(active);
            return (
              <React.Fragment key={gi}>
                <SideNavMenu
                  title={group.label}
                  defaultExpanded={isGroupActive}
                  isActive={isGroupActive}
                >
                  {groupPages.map(({ key, label, Icon }) => (
                    <SideNavLink
                      key={key}
                      isActive={active === key}
                      aria-current={active === key ? 'page' : undefined}
                      renderIcon={Icon}
                      href="#"
                      onClick={e => { e.preventDefault(); navigate(key); }}
                    >
                      {label}
                    </SideNavLink>
                  ))}
                </SideNavMenu>
                {gi < NAV_GROUPS.length - 1 && (
                  <li aria-hidden="true" className="app-sidenav__divider" />
                )}
              </React.Fragment>
            );
          })}
        </SideNavItems>
      </SideNav>

      {/* Dim overlay — shown on mobile when nav is open as a drawer */}
      {sideNavOpen && window.innerWidth < SIDENAV_BREAKPOINT && (
        <div className="app-nav-overlay" onClick={() => setSideNavOpen(false)} aria-hidden="true" />
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <Theme theme="white">
        <main
          id="main-content"
          className={`app-main${sideNavOpen ? ' app-main--nav-open' : ' app-main--nav-closed'}`}
        >
          <div style={{ display: active === 'agent'     ? 'contents' : 'none' }}>
            <AgentChat username={user} onNavigate={navigate} isActive={active === 'agent'} />
          </div>
          <div style={{ display: active === 'ingestion' ? 'contents' : 'none' }}>
            <DataIngestion onNavigate={navigate} />
          </div>

          {active === 'configuration'  && <Configuration />}
          {active === 'audit'          && <Audit />}
          {active === 'statistics'     && <Statistics />}
          {active === 'architecture'   && <Architecture />}
          {active === 'actions'        && renderActionView()}
          {active === 'scheduledjobs'  && <ScheduledJobs />}
        </main>
      </Theme>

    </Theme>
  );
}
