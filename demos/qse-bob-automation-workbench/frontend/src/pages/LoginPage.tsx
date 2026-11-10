import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, InlineLoading, InlineNotification, PasswordInput, TextInput } from '@carbon/react';
import { api, ApiError } from '../services/api';
import { useSession } from '../stores/session';

// Optional prefill for local and demo builds. Vite inlines VITE_* values into the public bundle at build time, so
// they are empty unless the build sets them (the Code Engine build does not) and must never hold a real password.
// The values must match ADMIN_USERNAME / ADMIN_PASSWORD on the server.
const defaults = () => ({
  username: import.meta.env.VITE_DEFAULT_USERNAME ?? '',
  password: import.meta.env.VITE_DEFAULT_PASSWORD ?? ''
});

export function LoginPage() {
  const { user, ready, setSession } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [username, setUsername] = useState(() => defaults().username);
  const [password, setPassword] = useState(() => defaults().password);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.auth.login(username.trim(), password);
      setPassword('');
      setSession(r.user, r.csrfToken);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <form className="login-card form-stack" onSubmit={submit} aria-labelledby="login-title">
        <div>
          <p className="step-source">IBM</p>
          <h1 id="login-title">QSE Automation Workbench</h1>
          <p className="card-help">Sign in to orchestrate quantum-safe analysis through Headless Bob.</p>
        </div>
        {error && <InlineNotification kind="error" lowContrast hideCloseButton title="Sign-in failed" subtitle={error} />}
        <TextInput id="login-username" labelText="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        <PasswordInput id="login-password" labelText="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" disabled={busy || !username || !password} style={{ width: '100%', maxWidth: 'none' }}>
          {busy ? <InlineLoading description="Signing in" /> : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
