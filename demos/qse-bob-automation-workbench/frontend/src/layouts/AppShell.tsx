import { Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Content,
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderName,
  HeaderPanel,
  Loading,
  Tag,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Switcher,
  SwitcherItem,
  SwitcherDivider
} from '@carbon/react';
import { Activity, Chip, Code, DocumentMultiple_01, Dashboard, Settings, UserAvatar, Logout, Connect, LogoGithub } from '@carbon/icons-react';
import { useState } from 'react';
import { useBob, useExecution, useQse, useRepos, useSettings } from '../hooks/queries';
import { api } from '../services/api';
import { useSession } from '../stores/session';
import { useWorkspace } from '../stores/workspace';
import { ACTIVE_STATUSES } from '../services/format';
import { statusLabel } from '../components/StatusTag';
import { Toasts } from '../components/Toasts';
import { useQueryClient } from '@tanstack/react-query';

const NAV = [
  { to: '/', label: 'Overview', icon: Dashboard, end: true },
  { to: '/bob', label: 'Bob Connection', icon: Connect },
  { to: '/repository', label: 'Repository Configuration', icon: LogoGithub },
  { to: '/qse', label: 'QSE Configuration', icon: Chip },
  { to: '/workspace', label: 'Execution Workspace', icon: Code },
  { to: '/history', label: 'Execution History', icon: Activity },
  { to: '/reports', label: 'Reports', icon: DocumentMultiple_01 },
  { to: '/settings', label: 'Settings', icon: Settings }
];

const DEMO_NOTE =
  'Demo — recorded data, not a live run. This site replays a recording of a real earlier Headless Bob + QSE CLI execution. Headless Bob, GitHub and the QSE CLI are not contacted, and what you type is not sent anywhere.';

function dot(color: string) {
  return <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />;
}

export function AppShell() {
  const user = useSession((s) => s.user);
  const setSession = useSession((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: bob } = useBob();
  const { data: settings } = useSettings();
  const { data: qse } = useQse();
  const { data: repos } = useRepos();
  const activeRepoId = useWorkspace((s) => s.activeRepositoryId);
  const activeExecId = useWorkspace((s) => s.activeExecutionId);
  const { data: exec } = useExecution(activeExecId);
  const repo = repos?.items.find((r) => r.id === activeRepoId) ?? repos?.items.find((r) => r.status === 'cloned');

  const bobState = bob?.state ?? 'not_configured';
  const bobColor = bobState === 'connected' ? '#42be65' : bobState === 'connecting' ? '#78a9ff' : bobState === 'not_configured' ? '#8d8d8d' : '#fa4d56';
  const running = exec && ACTIVE_STATUSES.includes(exec.status);

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setSession(null, null);
      qc.clear();
      navigate('/login');
    }
  };

  return (
    <>
      <Header aria-label="QSE Automation Workbench">
        <SkipToContent />
        <HeaderName as={NavLink} to="/" prefix="IBM">
          QSE Automation Workbench
        </HeaderName>
        <HeaderGlobalBar>
          <div className="header-status" aria-label="Status summary">
            <span className="item" title={bob?.message ?? undefined}>
              {dot(bobColor)} Bob: {bob?.mock ? 'Demo — ' : ''}
              {statusLabel(bobState)}
              {settings?.streamMode === 'mock' && (
                <Tag size="sm" type="gray" title={DEMO_NOTE} style={{ marginLeft: 8 }}>
                  STREAM_MODE=mock
                </Tag>
              )}
            </span>
            <span className="item hide-md repo" title={repo?.url}>
              <LogoGithub size={16} /> {repo ? `${repo.owner}/${repo.name}@${repo.branch}` : 'No repository'}
            </span>
            <span className="item hide-md">
              <Chip size={16} /> QSE: {qse ? statusLabel(qse.status) : '…'}
            </span>
            <span className="item">
              {dot(running ? '#78a9ff' : exec?.status === 'failed' ? '#fa4d56' : exec?.status === 'completed' ? '#42be65' : '#8d8d8d')}
              Execution: {exec ? statusLabel(exec.status) : 'Idle'}
            </span>
          </div>
          <HeaderGlobalAction aria-label="User menu" tooltipAlignment="end" isActive={profileOpen} onClick={() => setProfileOpen((v) => !v)}>
            <UserAvatar size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
        <HeaderPanel aria-label="User menu" expanded={profileOpen} onHeaderPanelFocus={() => undefined}>
          <Switcher aria-label="Profile">
            <SwitcherItem aria-label="Signed in" href="#" onClick={(e: React.MouseEvent) => e.preventDefault()}>
              {user?.username} ({user?.role})
            </SwitcherItem>
            <SwitcherDivider />
            <SwitcherItem aria-label="Settings" href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); setProfileOpen(false); navigate('/settings'); }}>
              Settings
            </SwitcherItem>
            <SwitcherItem aria-label="Sign out" href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); void logout(); }}>
              <span className="row"><Logout size={16} /> Sign out</span>
            </SwitcherItem>
          </Switcher>
        </HeaderPanel>
      </Header>
      <SideNav aria-label="Primary navigation" expanded isFixedNav isChildOfHeader={false} isRail={false} href="#main">
        <SideNavItems>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <SideNavLink
              key={to}
              as={NavLink}
              to={to}
              end={end}
              renderIcon={Icon}
              isActive={end ? location.pathname === to : location.pathname.startsWith(to)}
            >
              {label}
            </SideNavLink>
          ))}
        </SideNavItems>
      </SideNav>
      <Content id="main" style={{ marginLeft: '16rem', padding: 0, marginTop: '3rem' }}>
        <div className="app-main">
          <Suspense fallback={<Loading withOverlay={false} description="Loading" />}>
            <Outlet />
          </Suspense>
        </div>
      </Content>
      <Toasts />
    </>
  );
}
