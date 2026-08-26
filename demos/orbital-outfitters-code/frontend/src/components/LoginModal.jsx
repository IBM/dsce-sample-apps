import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function LoginModal({ onClose, message }) {
  const { login } = useAuth();
  const { refreshCartCount } = useCart();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axiosClient.post('/auth/login', { login: email, password });
      login(res.data.token, res.data.user);
      await refreshCartCount();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAutocomplete() {
    setAutoLoading(true);
    try {
      const res = await axiosClient.get('/auth/random-user');
      setEmail(res.data.email);
      setPassword(res.data.password);
    } catch {
      setError('Could not fetch a demo user.');
    } finally {
      setAutoLoading(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={e => e.stopPropagation()}>
        <button style={styles.close} onClick={onClose}>✕</button>
        <img src="/logo_orbital_suppliers.png" alt="Orbital Suppliers" style={styles.logo} />
        <h2 style={styles.title}>Sign In</h2>
        {message && <p style={styles.contextMsg}>{message}</p>}
        <form onSubmit={handleLogin}>
          <label style={styles.label}>Email</label>
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={styles.input} required
          />
          <label style={styles.label}>Password</label>
          <div style={styles.passWrap}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...styles.input, paddingRight: 40 }}
              required
            />
            <button type="button" style={styles.eyeBtn} onClick={() => setShowPass(v => !v)}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.loginBtn} disabled={loading}>
            {loading ? 'LOGGING IN...' : 'LOGIN'}
          </button>
        </form>
        <button style={styles.autoBtn} onClick={handleAutocomplete} disabled={autoLoading}>
          {autoLoading ? 'Loading...' : 'Autocomplete with random user'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: 12, padding: '36px 40px',
    width: 480, maxWidth: '95vw', position: 'relative',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  close: {
    position: 'absolute', top: 16, right: 16,
    background: 'none', border: 'none', fontSize: 20,
    cursor: 'pointer', color: '#161616',
  },
  logo: { height: 48, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 700, color: '#161616', margin: '0 0 8px' },
  contextMsg: { color: '#444', marginBottom: 16, fontSize: 15 },
  label: { display: 'block', fontWeight: 600, marginBottom: 6, marginTop: 14, color: '#161616' },
  input: {
    width: '100%', padding: '12px 14px', border: '1.5px solid #ddd',
    borderRadius: 6, fontSize: 15, boxSizing: 'border-box',
    outline: 'none',
  },
  passWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
  },
  error: { color: '#c00', fontSize: 13, marginTop: 8 },
  loginBtn: {
    width: '100%', padding: '14px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 700,
    cursor: 'pointer', marginTop: 20, letterSpacing: 1,
  },
  autoBtn: {
    width: '100%', padding: '13px', background: 'transparent',
    border: '1.5px solid #2850B8', borderRadius: 6, fontSize: 15,
    color: '#2850B8', cursor: 'pointer', marginTop: 12, fontWeight: 500,
  },
};
