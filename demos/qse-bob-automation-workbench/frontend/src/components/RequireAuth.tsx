import { Loading } from '@carbon/react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../stores/session';

export function RequireAuth() {
  const { user, ready } = useSession();
  const loc = useLocation();
  if (!ready) return <Loading description="Checking session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}
