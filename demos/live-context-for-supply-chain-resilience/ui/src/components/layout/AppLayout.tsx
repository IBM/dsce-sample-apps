// ui/src/components/layout/AppLayout.tsx
// TSCI Supply Chain sidebar — Turnaround Supply Chain Intelligence
// Features: collapse toggle, project dropdown, login/logout footer, Configuration nav item

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { AuthUser } from '../../pages/LoginPage';

// ── Icons ──────────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);

const ResilienceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const RiskIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const EventsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
  </svg>
);

const ShipmentsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 32 32" fill="currentColor" width="16" height="16" aria-hidden="true">
    <path d="M22 16 12 26 10.6 24.6 19.2 16 10.6 7.4 12 6z"/>
  </svg>
);

const ChevronDown = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
    <path d="M8 11 3 6 3.7 5.3 8 9.6 12.3 5.3 13 6z"/>
  </svg>
);

const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
    {collapsed ? (
      <><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15 3-3-3-3"/></>
    ) : (
      <><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 15-3-3 3-3"/></>
    )}
  </svg>
);

// ── Projects ───────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  label: string;
  facility: string;
  year: string;
  status: 'active' | 'planning' | 'completed';
}

const PROJECTS: Project[] = [
  { id: 'pearl-2026',   label: 'Pearl GTL',             facility: 'Pearl GTL',        year: 'TA-2026',  status: 'active' },
  { id: 'pearl-2028',   label: 'Pearl GTL',             facility: 'Pearl GTL',        year: 'TA-2028',  status: 'planning' },
  { id: 'qafco-2026',   label: 'QAFCO Ammonia',         facility: 'QAFCO',            year: 'TA-2026',  status: 'active' },
  { id: 'ras-laffan-A', label: 'Ras Laffan LDPE',       facility: 'Ras Laffan',       year: 'TA-2025',  status: 'completed' },
  { id: 'orpic-2026',   label: 'ORPIC Mussanah',        facility: 'ORPIC',            year: 'TA-2026',  status: 'active' },
  { id: 'adnoc-ruw',    label: 'ADNOC Ruwais',          facility: 'ADNOC',            year: 'TA-2027',  status: 'planning' },
  { id: 'sabic-juaym',  label: 'SABIC Juaymah NGL',     facility: 'SABIC',            year: 'TA-2026',  status: 'active' },
];

const STATUS_DOT: Record<Project['status'], string> = {
  active:    'var(--tsci-green)',
  planning:  'var(--tsci-yellow)',
  completed: 'var(--tsci-text-muted)',
};

// ── Nav items ──────────────────────────────────────────────────────────────────

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  matchFn: (p: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: <DashboardIcon />, label: 'Readiness Dashboard', path: '/dashboard', matchFn: p => p === '/dashboard' || p === '/' },
  { icon: <ResilienceIcon />, label: 'Supply Resilience',  path: '/agent',     matchFn: p => p === '/agent' },
  { icon: <RiskIcon />,      label: 'Active Risks',        path: '/risks',     matchFn: p => p.startsWith('/risks') },
  { icon: <EventsIcon />,    label: 'Confluent Events',    path: '/events',    matchFn: p => p === '/events' },
  { icon: <ShipmentsIcon />, label: 'Shipments & Materials',path: '/shipments',matchFn: p => p === '/shipments' },
  { icon: <SettingsIcon />,  label: 'Configuration',       path: '/configuration', matchFn: p => p === '/configuration' },
];

// ── Layout ─────────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: React.ReactNode;
  user: AuthUser;
  onLogout: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed]             = useState(false);
  const [projectOpen, setProjectOpen]         = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project>(PROJECTS[0]!);
  const [userMenuOpen, setUserMenuOpen]       = useState(false);

  const projectRef = useRef<HTMLDivElement>(null);
  const userRef    = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) setProjectOpen(false);
      if (userRef.current   && !userRef.current.contains(e.target as Node))    setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setUserMenuOpen(false);
    onLogout();
  };

  const selectProject = (p: Project) => {
    setSelectedProject(p);
    setProjectOpen(false);
  };

  return (
    <div className={`bob-layout-root${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`bob-sidebar${collapsed ? ' collapsed' : ''}`}>

        {/* Header: wordmark + collapse */}
        <div className="bob-sidebar-header">
          {!collapsed && (
            <div className="bob-wordmark">
              <span className="bob-wordmark-ibm">TSCI</span>
              <span className="bob-wordmark-bob">Supply Chain</span>
            </div>
          )}
          <button
            className="bob-sidebar-collapse"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(c => !c)}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>

        {/* Project selector — expanded only */}
        {!collapsed && (
          <div className="bob-sidebar-group" ref={projectRef}>
            <div className="bob-sidebar-group-label">Turnaround Project</div>
            <button
              className="bob-workspace-selector"
              onClick={() => setProjectOpen(o => !o)}
              aria-expanded={projectOpen}
              aria-haspopup="listbox"
            >
              <span className="bob-workspace-selector-text">
                <span
                  className="bob-workspace-status-dot"
                  style={{ background: STATUS_DOT[selectedProject.status] }}
                  aria-hidden="true"
                />
                {selectedProject.label} · {selectedProject.year}
              </span>
              <ChevronDown />
            </button>

            {projectOpen && (
              <div className="bob-project-dropdown" role="listbox" aria-label="Select project">
                {PROJECTS.map(p => (
                  <button
                    key={p.id}
                    role="option"
                    aria-selected={p.id === selectedProject.id}
                    className={`bob-project-option${p.id === selectedProject.id ? ' selected' : ''}`}
                    onClick={() => selectProject(p)}
                  >
                    <span
                      className="bob-workspace-status-dot"
                      style={{ background: STATUS_DOT[p.status] }}
                      aria-hidden="true"
                    />
                    <span className="bob-project-option-text">
                      <span className="bob-project-option-label">{p.label}</span>
                      <span className="bob-project-option-meta">{p.facility} · {p.year}</span>
                    </span>
                    <span className="bob-project-option-status" style={{ color: STATUS_DOT[p.status] }}>
                      {p.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="bob-nav" aria-label="Main navigation">
          <ul className="bob-nav-list">
            {NAV_ITEMS.map((item) => {
              const active = item.matchFn(location.pathname);
              return (
                <li key={item.label} className="bob-nav-item">
                  <button
                    className={`bob-nav-btn${active ? ' active' : ''}`}
                    onClick={() => navigate(item.path)}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="bob-nav-icon">{item.icon}</span>
                    {!collapsed && <span className="bob-nav-label">{item.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User / login footer */}
        <div
          className={`bob-sidebar-footer${collapsed ? ' bob-sidebar-footer--collapsed' : ''}`}
          ref={userRef}
        >
          <button
            className="bob-footer-trigger"
            onClick={() => setUserMenuOpen(o => !o)}
            aria-expanded={userMenuOpen}
            aria-label="User menu"
          >
            <div className="bob-avatar" aria-hidden="true">{user.initials}</div>
            {!collapsed && (
              <>
                <div className="bob-user-info">
                  <p className="bob-user-name">{user.name}</p>
                  <p className="bob-user-email">{user.email}</p>
                </div>
                <ChevronRight />
              </>
            )}
          </button>

          {userMenuOpen && !collapsed && (
            <div className="bob-user-menu" role="menu">
              <div className="bob-user-menu-header">
                <span className="bob-user-menu-name">{user.name}</span>
                <span className="bob-user-menu-role">{user.role}</span>
              </div>
              <button
                className="bob-user-menu-item bob-user-menu-item--danger"
                role="menuitem"
                onClick={handleLogout}
              >
                <LogoutIcon />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="bob-main" id="main-content">
        {children}
      </main>
    </div>
  );
};
