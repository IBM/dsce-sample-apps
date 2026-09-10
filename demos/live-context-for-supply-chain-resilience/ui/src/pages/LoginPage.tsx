// ui/src/pages/LoginPage.tsx
import React, { useState } from 'react';
import loginBkg from '../../images/Login_screen_bkg.png';

export interface AuthUser {
  username: string;
  name: string;
  email: string;
  role: string;
  initials: string;
}

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Demo auth: credentials are validated by the backend /api/auth/login endpoint.
    // For local dev without a backend, any non-empty username/password is accepted
    // and a session user is constructed from the entered username.
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    })
      .then(async resp => {
        if (resp.ok) {
          const data = await resp.json() as { name?: string; email?: string; role?: string };
          onLogin({
            username: username.trim(),
            name:     data.name     ?? username.trim(),
            email:    data.email    ?? `${username.trim()}@tsci.ops`,
            role:     data.role     ?? 'Operator',
            initials: username.trim().slice(0, 2).toUpperCase(),
          });
        } else {
          setError('Invalid username or password.');
          setLoading(false);
        }
      })
      .catch(() => {
        // Backend unreachable in local dev — accept any non-empty credentials
        onLogin({
          username: username.trim(),
          name:     username.trim(),
          email:    `${username.trim()}@tsci.ops`,
          role:     'Operator',
          initials: username.trim().slice(0, 2).toUpperCase(),
        });
      });
  };

  return (
    <div className="tsci-login-root" style={{ backgroundImage: `url(${loginBkg})` }}>
      <div className="tsci-login-overlay" />

      <div className="tsci-login-card" role="main">
        <div className="tsci-login-logo">
          <span className="tsci-login-logo-primary">TSCI</span>
          <span className="tsci-login-logo-secondary">Supply Chain Intelligence</span>
        </div>

        <h1 className="tsci-login-title">Sign in</h1>
        <p className="tsci-login-subtitle">Turnaround Operations Portal</p>

        <form className="tsci-login-form" onSubmit={handleSubmit} noValidate>
          <div className="tsci-login-field">
            <label htmlFor="tsci-username" className="tsci-login-label">
              Username
            </label>
            <input
              id="tsci-username"
              type="text"
              className={`tsci-login-input${error ? ' tsci-login-input--error' : ''}`}
              placeholder="Enter username"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="tsci-login-field">
            <label htmlFor="tsci-password" className="tsci-login-label">
              Password
            </label>
            <input
              id="tsci-password"
              type="password"
              className={`tsci-login-input${error ? ' tsci-login-input--error' : ''}`}
              placeholder="Enter password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="tsci-login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="tsci-login-btn"
            disabled={loading || !username || !password}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
