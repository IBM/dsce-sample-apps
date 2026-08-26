import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import LoginModal from './LoginModal';

export default function NavBar() {
  const { isLoggedIn, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <>
      <nav style={styles.nav}>
        <Link to="/" style={styles.logoLink}>
          <img src="/logo_orbital_suppliers.png" alt="Orbital Suppliers" style={styles.logo} />
        </Link>
        <div style={styles.right}>
          <Link to="/cart" style={styles.navItem}>
            <div style={styles.iconWrap}>
              <img src="/assets/icons/home/nav_cart.png" alt="Cart" style={styles.icon} />
              {cartCount > 0 && <span style={styles.badge}>{cartCount}</span>}
            </div>
            <span style={styles.label}>Cart</span>
          </Link>
          <Link to="/orders" style={styles.navItem}>
            <img src="/assets/icons/home/nav_orders_clipboard.png" alt="Orders" style={styles.icon} />
            <span style={styles.label}>Orders</span>
          </Link>
          <Link to="/account" style={styles.navItem}>
            <img src="/assets/icons/home/nav_account_user.png" alt="Account" style={styles.icon} />
            <span style={styles.label}>Account</span>
          </Link>
          {isLoggedIn ? (
            <button onClick={handleLogout} style={styles.navBtn}>
              <img src="/assets/icons/home/nav_logout_arrow.png" alt="Logout" style={styles.icon} />
              <span style={styles.label}>Login / Logout</span>
            </button>
          ) : (
            <button onClick={() => setShowLogin(true)} style={styles.navBtn}>
              <img src="/assets/icons/home/nav_login_arrow.png" alt="Login" style={styles.icon} />
              <span style={styles.label}>Login / Logout</span>
            </button>
          )}
        </div>
      </nav>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 24px',
    background: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  logoLink: { display: 'flex', alignItems: 'center', textDecoration: 'none' },
  logo: { height: 76, width: 'auto' },
  right: { display: 'flex', alignItems: 'center', gap: 24 },
  navItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textDecoration: 'none', color: '#161616', gap: 2,
  },
  navBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'none', border: 'none', cursor: 'pointer', color: '#161616', gap: 2, padding: 0,
  },
  iconWrap: { position: 'relative', display: 'inline-block' },
  icon: { width: 36, height: 36, objectFit: 'contain' },
  badge: {
    position: 'absolute', top: -6, right: -8,
    background: '#2850B8', color: '#fff', borderRadius: '50%',
    fontSize: 10, width: 16, height: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700,
  },
  label: { fontSize: 12, color: '#161616', whiteSpace: 'nowrap' },
};
