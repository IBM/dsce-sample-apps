import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import ProductCard from '../components/ProductCard';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import LoginModal from '../components/LoginModal';

const CATEGORIES = [
  'All',
  'Audio & Entertainment',
  'Beauty & Personal Care',
  'Communication Devices',
  'Computing & Electronics',
  'Home & Habitat',
  'Lighting & Illumination',
  'Medical & Health',
  'Observation & Optics',
  'Outdoor & Adventure',
  'Pet Care & Accessories',
  'Power & Energy',
  'Robotics & Automation',
  'Safety & Protection Equipment',
  'Scanning & Detection',
  'Storage & Containers',
  'Tools & Equipment',
  'Transportation & Mobility',
  'Weapons & Defense',
];

export default function ProductListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { refreshCartCount } = useCart();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [selectedCat, setSelectedCat] = useState(searchParams.get('category') || 'All');
  const [showLogin, setShowLogin] = useState(false);

  const LIMIT = 12;

  const fetchProducts = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (searchInput) params.set('search', searchInput);
      if (selectedCat && selectedCat !== 'All') params.set('category', selectedCat);
      const res = await axiosClient.get(`/products?${params}`);
      setProducts(res.data.products || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchInput, selectedCat]);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const cat = searchParams.get('category') || 'All';
    setSearchInput(q);
    setSelectedCat(cat);
  }, [searchParams.toString()]);

  useEffect(() => { fetchProducts(1); }, [selectedCat, searchInput]);

  async function handleAddToCart(product) {
    if (!isLoggedIn) { setShowLogin(true); return; }
    try {
      await axiosClient.post('/cart/items', { product_id: product.product_id, quantity: 1 });
      await refreshCartCount();
    } catch {}
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearchParams({ q: searchInput, ...(selectedCat !== 'All' ? { category: selectedCat } : {}) });
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={styles.page}>
      <NavBar />
      <div style={styles.hero} />
      <div style={styles.content}>
        <div style={styles.sidebar}>
          <h3 style={styles.sideTitle}>Categories</h3>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              style={{ ...styles.catBtn, ...(selectedCat === cat ? styles.catBtnActive : {}) }}
              onClick={() => { setSelectedCat(cat); setSearchParams({ ...(cat !== 'All' ? { category: cat } : {}), ...(searchInput ? { q: searchInput } : {}) }); }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={styles.main}>
          <div style={styles.topBar}>
            <h1 style={styles.title}>{selectedCat !== 'All' ? selectedCat : 'Products'}</h1>
            <form onSubmit={handleSearch} style={styles.searchRow}>
              <input
                style={styles.searchInput}
                placeholder="Search products..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
              <button type="submit" style={styles.searchBtn}>Search</button>
            </form>
          </div>
          {loading ? (
            <div style={styles.spinner}>Loading...</div>
          ) : products.length === 0 ? (
            <div style={styles.empty}>No products found.</div>
          ) : (
            <div style={styles.grid}>
              {products.map(p => (
                <ProductCard key={p.product_id} product={p} onAddToCart={handleAddToCart} />
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  style={{ ...styles.pageBtn, ...(p === page ? styles.pageBtnActive : {}) }}
                  onClick={() => fetchProducts(p)}
                >{p}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} message="Please sign in to add this item to the cart." />}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif' },
  hero: { height: 8, background: 'linear-gradient(90deg, #CCDDFF, #fff)' },
  content: { display: 'flex', maxWidth: 1200, margin: '0 auto', padding: '24px 20px', gap: 24 },
  sidebar: { width: 180, flexShrink: 0 },
  sideTitle: { fontWeight: 700, fontSize: 16, marginBottom: 12, color: '#031040' },
  catBtn: {
    display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
    marginBottom: 6, background: '#fff', border: '1.5px solid #e0e0e0',
    borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#161616',
  },
  catBtnActive: { background: '#2850B8', color: '#fff', borderColor: '#2850B8' },
  main: { flex: 1 },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 28, fontWeight: 800, color: '#031040', margin: 0 },
  searchRow: { display: 'flex', gap: 0 },
  searchInput: {
    padding: '10px 14px', border: '1.5px solid #ccc',
    borderRadius: '6px 0 0 6px', fontSize: 14, outline: 'none', width: 220,
  },
  searchBtn: {
    padding: '10px 18px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: '0 6px 6px 0', cursor: 'pointer', fontWeight: 600,
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20,
  },
  spinner: { textAlign: 'center', padding: 60, color: '#888', fontSize: 18 },
  empty: { textAlign: 'center', padding: 60, color: '#888', fontSize: 18 },
  pagination: { display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 },
  pageBtn: {
    padding: '8px 14px', border: '1.5px solid #ccc', borderRadius: 6,
    background: '#fff', cursor: 'pointer', fontSize: 14,
  },
  pageBtnActive: { background: '#2850B8', color: '#fff', borderColor: '#2850B8' },
};
