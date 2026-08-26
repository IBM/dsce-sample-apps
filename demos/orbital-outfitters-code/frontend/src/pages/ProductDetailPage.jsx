import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import LoginModal from '../components/LoginModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

const TRUST_BADGES = [
  { icon: '🚀', title: 'Fast Cosmic Shipping', text: 'Priority delivery across the universe.' },
  { icon: '🔒', title: 'Secure Checkout', text: 'Your data is encrypted and protected.' },
  { icon: '🛡️', title: 'Mission-Ready Quality', text: 'Tested for extreme space conditions.' },
  { icon: '🎧', title: 'Explorer Support', text: 'Our team is here for your mission.' },
];

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { refreshCartCount } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState('reviews');
  const [showLogin, setShowLogin] = useState(false);
  const [addedMsg, setAddedMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    axiosClient.get(`/products/${id}`)
      .then(res => setProduct(res.data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddToCart() {
    if (!isLoggedIn) { setShowLogin(true); return; }
    try {
      await axiosClient.post('/cart/items', { product_id: product.product_id, quantity: qty });
      await refreshCartCount();
      setAddedMsg('Added to cart!');
      setTimeout(() => setAddedMsg(''), 2000);
    } catch {}
  }

  if (loading) return <div style={styles.page}><NavBar /><p style={styles.center}>Loading...</p></div>;
  if (!product) return <div style={styles.page}><NavBar /><p style={styles.center}>Product not found.</p></div>;

  const imageUrl = product.product_image_url
    ? (product.product_image_url.startsWith('http') ? product.product_image_url : `${BACKEND_URL}${product.product_image_url}`)
    : '/logo_orbital_suppliers.png';

  const features = [product.feature1, product.feature2, product.feature3, product.feature4].filter(Boolean);
  const reviews = product.reviews || [];

  return (
    <div style={styles.page}>
      <NavBar />
      <div style={styles.heroBg} />
      <div style={styles.container}>
        {/* Breadcrumb */}
        <div style={styles.breadcrumb}>
          <Link to="/" style={styles.crumbLink}>Home</Link>
          <span style={styles.crumbSep}> › </span>
          <Link to={`/products?category=${encodeURIComponent(product.category || '')}`} style={styles.crumbLink}>
            {product.category || 'Products'}
          </Link>
          <span style={styles.crumbSep}> › </span>
          <span style={styles.crumbCurrent}>{product.product_name}</span>
        </div>

        <div style={styles.main}>
          {/* Left: image */}
          <div style={styles.imgCol}>
            <img src={imageUrl} alt={product.product_name} style={styles.img}
              onError={e => { e.target.src = '/logo_orbital_suppliers.png'; }} />
          </div>

          {/* Right: details */}
          <div style={styles.detailCol}>
            <h1 style={styles.name}>{product.product_name}</h1>
            <div style={styles.badgeRow}>
              <span style={styles.catBadge}>{product.category}</span>
              <span style={styles.stockBadge}>✓ In Stock</span>
            </div>
            <p style={styles.desc}>{product.product_description}</p>
            <div style={styles.meta}>
              {product.weight_lbs && <span><strong>Weight:</strong> {product.weight_lbs} lbs</span>}
              {product.width_inches && <span><strong>Dimensions:</strong> {product.width_inches}" × {product.height_inches}" × {product.depth_inches}"</span>}
            </div>
            <div style={styles.price}>${Number(product.price).toFixed(2)}</div>
            <div style={styles.qtyRow}>
              <span style={styles.qtyLabel}>Quantity:</span>
              <button style={styles.qtyBtn} onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <input type="number" value={qty} min={1} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                style={styles.qtyInput} />
              <button style={styles.qtyBtn} onClick={() => setQty(q => q + 1)}>+</button>
            </div>
            <button style={styles.addBtn} onClick={handleAddToCart}>
              <img src="/assets/icons/cart/action_add_to_cart.png" alt="" style={{ width: 18, marginRight: 8, verticalAlign: 'middle' }} />
              Add to Cart
            </button>
            {addedMsg && <p style={styles.addedMsg}>{addedMsg}</p>}

            {/* Trust badges */}
            <div style={styles.trustRow}>
              {TRUST_BADGES.map(b => (
                <div key={b.title} style={styles.trustItem}>
                  <span>{b.icon}</span>
                  <div>
                    <strong style={{ fontSize: 11 }}>{b.title}</strong>
                    <p style={{ fontSize: 10, margin: 0, color: '#666' }}>{b.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(activeTab === 'reviews' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('reviews')}>
            ☆ Reviews ({reviews.length})
          </button>
          <button style={{ ...styles.tab, ...(activeTab === 'features' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('features')}>
            Features
          </button>
        </div>

        {activeTab === 'reviews' ? (
          <div style={styles.tabPanel}>
            {reviews.length === 0 ? <p style={{ color: '#888' }}>No reviews yet.</p> :
              reviews.map((r, i) => (
                <div key={i} style={styles.review}>
                  <div style={styles.reviewHeader}>
                    <span style={styles.avatar}>{r.reviewer_initials}</span>
                    <div>
                      <div style={styles.stars}>{'★'.repeat(Math.round(r.score))}{'☆'.repeat(5 - Math.round(r.score))}</div>
                      <span style={styles.score}>{Number(r.score).toFixed(1)}</span>
                    </div>
                  </div>
                  <p style={styles.reviewText}>{r.review}</p>
                </div>
              ))}
          </div>
        ) : (
          <div style={styles.tabPanel}>
            <ul style={styles.featureList}>
              {features.map((f, i) => <li key={i} style={styles.featureItem}>{f}</li>)}
            </ul>
          </div>
        )}
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} message="Please sign in to add this item to the cart." />}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif' },
  heroBg: { height: 8, background: 'linear-gradient(90deg, #CCDDFF, #fff)' },
  container: { maxWidth: 1100, margin: '0 auto', padding: '20px 24px' },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  breadcrumb: { fontSize: 13, color: '#888', marginBottom: 20 },
  crumbLink: { color: '#2850B8', textDecoration: 'none' },
  crumbSep: { margin: '0 6px', color: '#bbb' },
  crumbCurrent: { color: '#333' },
  main: { display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 32 },
  imgCol: { flex: '0 0 380px', maxWidth: 380 },
  img: { width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 380, background: '#f0f4ff' },
  detailCol: { flex: 1, minWidth: 280 },
  name: { fontSize: 32, fontWeight: 800, color: '#031040', margin: '0 0 12px' },
  badgeRow: { display: 'flex', gap: 10, marginBottom: 14 },
  catBadge: { background: '#CCDDFF', color: '#031040', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600 },
  stockBadge: { background: '#C8F2D0', color: '#1E7A40', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600 },
  desc: { color: '#444', fontSize: 15, lineHeight: 1.6, marginBottom: 14 },
  meta: { display: 'flex', gap: 20, color: '#555', fontSize: 13, marginBottom: 16, flexWrap: 'wrap' },
  price: { fontSize: 32, fontWeight: 800, color: '#031040', marginBottom: 18 },
  qtyRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 },
  qtyLabel: { fontWeight: 600, color: '#161616' },
  qtyBtn: {
    width: 32, height: 32, background: '#fff', border: '1.5px solid #ccc',
    borderRadius: 6, cursor: 'pointer', fontSize: 18, fontWeight: 700,
  },
  qtyInput: {
    width: 50, textAlign: 'center', border: '1.5px solid #ccc',
    borderRadius: 6, padding: '4px', fontSize: 16,
  },
  addBtn: {
    width: '100%', padding: '14px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer',
    marginBottom: 10,
  },
  addedMsg: { color: '#1E7A40', fontWeight: 600, fontSize: 14, textAlign: 'center' },
  trustRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 },
  trustItem: { display: 'flex', gap: 8, alignItems: 'flex-start', flex: '1 1 120px' },
  tabs: { display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: 20, gap: 4 },
  tab: {
    padding: '10px 24px', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', cursor: 'pointer',
    fontSize: 15, fontWeight: 600, color: '#666', marginBottom: -2,
  },
  tabActive: { color: '#2850B8', borderBottomColor: '#2850B8' },
  tabPanel: { background: '#fff', borderRadius: 10, padding: 24 },
  review: { borderBottom: '1px solid #eee', paddingBottom: 16, marginBottom: 16 },
  reviewHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: {
    width: 40, height: 40, borderRadius: '50%', background: '#CCDDFF',
    color: '#2850B8', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 15,
  },
  stars: { color: '#f59e0b', fontSize: 16 },
  score: { fontSize: 13, color: '#888' },
  reviewText: { color: '#444', fontSize: 14, lineHeight: 1.6, margin: 0 },
  featureList: { paddingLeft: 20 },
  featureItem: { fontSize: 15, color: '#333', marginBottom: 10, lineHeight: 1.5 },
};
