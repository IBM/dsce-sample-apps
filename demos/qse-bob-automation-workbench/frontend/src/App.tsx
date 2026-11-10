import { lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from './layouts/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { api, setUnauthorizedHandler } from './services/api';
import { useSession } from './stores/session';
import { LoginPage } from './pages/LoginPage';

const OverviewPage = lazy(() => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const BobConnectionPage = lazy(() => import('./pages/BobConnectionPage').then((m) => ({ default: m.BobConnectionPage })));
const RepositoryPage = lazy(() => import('./pages/RepositoryPage').then((m) => ({ default: m.RepositoryPage })));
const QsePage = lazy(() => import('./pages/QsePage').then((m) => ({ default: m.QsePage })));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ReportViewPage = lazy(() => import('./pages/ReportViewPage').then((m) => ({ default: m.ReportViewPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export function App() {
  const { setSession, markReady } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null, null);
      qc.clear();
      navigate('/login', { replace: true });
    });
    api.auth
      .me()
      .then((r) => setSession(r.user, r.csrfToken))
      .catch(() => setSession(null, null))
      .finally(markReady);
    return () => setUnauthorizedHandler(null);
  }, [setSession, markReady, navigate, qc]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="bob" element={<BobConnectionPage />} />
          <Route path="repository" element={<RepositoryPage />} />
          <Route path="qse" element={<QsePage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="workspace/:executionId" element={<WorkspacePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/:executionId" element={<ReportViewPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
