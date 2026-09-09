import { useState } from 'react';
import { View, ViewOff, Login as LoginIcon } from '@carbon/icons-react';
import './Login.scss';

export default function Login({ onLogin }) {
  const [username,    setUsername]    = useState('maxadmin');
  const [password,    setPassword]    = useState('maxadmin');
  const [showPwd,     setShowPwd]     = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    // Simulate async auth — any non-empty credentials are accepted
    setTimeout(() => {
      setLoading(false);
      onLogin(username.trim());
    }, 600);
  };

  return (
    <div className="login-bg">
      <div className="login-card" role="main">

        {/* Title block — matches the "IBM Benefit Realization / Intelligence Platform" style */}
        <div className="login-title-block">
          <h1 className="login-app-name">Asset Management<br />Knowledge Hub</h1>
          <p className="login-app-sub">Intelligence Platform</p>
        </div>

        <form className="login-form" onSubmit={submit} noValidate>

          {/* Username */}
          <div className="login-field">
            <label htmlFor="login-username" className="login-label">Username</label>
            <input
              id="login-username"
              type="text"
              className="login-input"
              autoComplete="username"
              placeholder=""
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="login-password" className="login-label">Password</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPwd ? 'text' : 'password'}
                className="login-input"
                autoComplete="current-password"
                placeholder=""
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPwd ? <ViewOff size={18} /> : <View size={18} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p className="login-error" role="alert">{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            className={`login-btn${loading ? ' login-btn--loading' : ''}`}
            disabled={loading}
          >
            <span>{loading ? 'Signing in…' : 'Sign in'}</span>
            {!loading && <LoginIcon size={18} />}
          </button>

        </form>
      </div>
    </div>
  );
}
