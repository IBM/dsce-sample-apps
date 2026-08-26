import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import LoginModal from '../components/LoginModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

const TRUST_BADGES = [
  { icon: '/assets/icons/home/action_mission_ready_quality.png', title: 'Mission-Ready Quality', text: 'Tested for extreme space conditions.' },
  { icon: '/assets/icons/home/action_secure_checkout.png',        title: 'Secure Checkout',        text: 'Your data is encrypted and protected.' },
  { icon: '/assets/icons/home/action_fast_galactic_shipping.png', title: 'Fast Galactic Shipping', text: 'Reliable delivery across the universe.' },
  { icon: '/assets/icons/home/action_explorer_support.png',       title: 'Explorer Support',       text: 'Our team is here for your mission.' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { refreshCartCount } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [featured, setFeatured] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [loginMsg, setLoginMsg] = useState('');
  const [pendingProduct, setPendingProduct] = useState(null);

  useEffect(() => {
    axiosClient.get('/products?limit=4').then(res => {
      setFeatured((res.data.products || []).slice(0, 4));
    }).catch(() => {});
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  }

  async function handleAddToCart(product) {
    if (!isLoggedIn) {
      setPendingProduct(product);
      setLoginMsg('Please sign in to add this item to the cart.');
      setShowLogin(true);
      return;
    }
    try {
      await axiosClient.post('/cart/items', { product_id: product.product_id, quantity: 1 });
      await refreshCartCount();
    } catch {}
  }

  async function onLoginClose() {
    setShowLogin(false);
    if (pendingProduct && isLoggedIn) {
      await handleAddToCart(pendingProduct);
      setPendingProduct(null);
    }
  }

  const SUGGESTED = [
    { icon: '/assets/icons/home/search_lunar_mission.png', label: 'What life support gear do I need for a 7-day lunar mission?' },
    { icon: '/assets/icons/home/search_pets.png',          label: 'What can you show me for pets in space?' },
    { icon: '/assets/icons/home/search_navigation.png',    label: 'What navigation tools are best for deep space travel?' },
    { icon: '/assets/icons/home/search_space_suits.png',   label: 'What space suits are suitable for extreme cold environments?' },
  ];

  return (
    <div style={styles.page}>
      <NavBar />
      {/* Hero */}
      <div style={styles.hero}>
        <img src="/home_page_background.gif" alt="" style={styles.heroBg} />
        <div style={styles.heroContent}>
          <h1 style={styles.headline}>GEAR UP FOR YOUR<br />SPACE JOURNEY</h1>
          <p style={styles.subhead}>
            Explore cutting-edge equipment and supplies for your orbital adventures.<br />
            From life support systems to navigation tools,<br />
            we outfit explorers for the final frontier.
          </p>

          {/* Two-column: left = search + suggestions, right = featured products */}
          <div style={styles.heroColumns}>

            {/* Left column */}
            <div style={styles.leftCol}>
              <form onSubmit={handleSearch} style={styles.searchRow}>
                <div style={styles.searchBox}>
                  <img src="/assets/icons/home/search_navigation.png" alt="" style={styles.searchIconImg} />
                  <input
                    style={styles.searchInput}
                    placeholder="Search products in natural language"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <button type="submit" style={styles.searchBtn}>Ask Agent</button>
              </form>

              {/* 2×2 suggested questions */}
              <div style={styles.suggestGrid}>
                {SUGGESTED.map(s => (
                  <div key={s.label} style={styles.suggestCard}
                    onClick={() => navigate(`/search?q=${encodeURIComponent(s.label)}`)}>
                    <img src={s.icon} alt="" style={styles.suggestIcon} />
                      <span style={styles.suggestLabel}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — featured products */}
            <div style={styles.rightCol}>
              {featured.map(p => {
                const imgUrl = p.product_image_url
                  ? (p.product_image_url.startsWith('http') ? p.product_image_url : `${BACKEND_URL}${p.product_image_url}`)
                  : '/logo_orbital_suppliers.png';
                return (
                  <div key={p.product_id} style={styles.featCard} onClick={() => navigate(`/products/${p.product_id}`)}>
                    <img src={imgUrl} alt={p.product_name || p.name} style={styles.featImg}
                      onError={e => { e.target.src = '/logo_orbital_suppliers.png'; }} />
                    <strong style={styles.featName}>{p.product_name || p.name}</strong>
                    <span style={styles.featDesc}>{(p.product_description || p.description)?.slice(0, 55)}</span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {/* Trust badges */}
      <div style={styles.trustRow}>
        {TRUST_BADGES.map(b => (
          <div key={b.title} style={styles.trustItem}>
            <img src={b.icon} alt={b.title} style={styles.trustIcon} />
            <div>
              <strong style={styles.trustTitle}>{b.title}</strong>
              <p style={styles.trustText}>{b.text}</p>
            </div>
          </div>
        ))}
      </div>

      {showLogin && <LoginModal onClose={onLoginClose} message={loginMsg} />}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif' },
  hero: { position: 'relative', minHeight: 480, overflow: 'hidden' },
  heroBg: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', zIndex: 0,
  },
  heroContent: {
    position: 'relative', zIndex: 1, padding: '40px 40px 30px',
    maxWidth: 1240, margin: '0 auto',
  },
  headline: {
    fontSize: 48, fontWeight: 900, color: '#031040', margin: '0 0 12px',
    lineHeight: 1.1, textTransform: 'uppercase',
  },
  subhead: { fontSize: 15, color: '#222', margin: '0 0 20px', lineHeight: 1.6 },
  /* ── Two-column hero layout ── */
  heroColumns: {
    display: 'flex', gap: 20, alignItems: 'flex-start',
  },
  leftCol: {
    flex: '0 0 420px', display: 'flex', flexDirection: 'column', gap: 12,
  },
  rightCol: {
    flex: 1, display: 'flex', gap: 10, overflowX: 'auto', flexWrap: 'nowrap',
    alignItems: 'flex-start', paddingBottom: 4,
  },
  /* ── Search bar ── */
  searchRow: { display: 'flex', gap: 0, width: '100%' },
  searchBox: {
    flex: 1, display: 'flex', alignItems: 'center',
    background: '#fff', border: '1.5px solid #ccc',
    borderRadius: '6px 0 0 6px', padding: '0 12px',
  },
  searchIconImg: { width: 18, height: 18, objectFit: 'contain', marginRight: 8, opacity: 0.5 },
  searchInput: {
    flex: 1, border: 'none', outline: 'none', fontSize: 14,
    padding: '12px 0', background: 'transparent',
  },
  searchBtn: {
    padding: '12px 20px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: '0 6px 6px 0', fontWeight: 700,
    fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  /* ── 2×2 suggested questions ── */
  suggestGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
  },
  suggestCard: {
    background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '14px 16px',
    cursor: 'pointer', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minHeight: 72,
  },
  suggestIcon: { width: 28, height: 28, objectFit: 'contain', flexShrink: 0 },
  suggestLabel: { fontSize: 12, color: '#222', lineHeight: 1.4 },
  /* ── shared arrow ── */
  catArrow: { fontSize: 16, color: '#2850B8', fontWeight: 700, marginTop: 2 },
  /* ── Featured product cards ── */
  featCard: {
    background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '12px 12px',
    cursor: 'pointer', minWidth: 110, maxWidth: 130, display: 'flex', flexDirection: 'column', gap: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flexShrink: 0,
  },
  featImg: { width: '100%', height: 96, objectFit: 'cover', borderRadius: 6 },
  featName: { fontSize: 12, fontWeight: 700, color: '#031040' },
  featDesc: { fontSize: 10, color: '#555' },
  trustRow: {
    display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap',
    padding: '28px 40px', background: '#fff', borderTop: '1px solid #e8eaf6', gap: 16,
  },
  trustItem: { display: 'flex', alignItems: 'flex-start', gap: 12, maxWidth: 200 },
  trustIcon: { width: 36, height: 36, objectFit: 'contain', flexShrink: 0 },
  trustTitle: { display: 'block', fontWeight: 700, fontSize: 14, color: '#031040' },
  trustText: { fontSize: 12, color: '#555', margin: '2px 0 0' },
};
