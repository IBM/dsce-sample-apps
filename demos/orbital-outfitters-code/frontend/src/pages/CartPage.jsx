import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import LoginModal from '../components/LoginModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export default function CartPage() {
  const { isLoggedIn } = useAuth();
  const { refreshCartCount } = useCart();
  const navigate = useNavigate();

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  async function loadCart() {
    setLoading(true);
    try {
      const res = await axiosClient.get('/cart');
      setCart(res.data);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      loadCart();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn]);

  async function updateQty(itemId, newQty) {
    if (newQty < 1) {
      await removeItem(itemId);
      return;
    }
    try {
      const res = await axiosClient.put(`/cart/items/${itemId}`, { quantity: newQty });
      setCart(res.data);
      refreshCartCount();
    } catch {}
  }

  async function removeItem(itemId) {
    try {
      const res = await axiosClient.delete(`/cart/items/${itemId}`);
      setCart(res.data);
      refreshCartCount();
    } catch {}
  }

  if (!isLoggedIn) {
    return (
      <div style={styles.page}>
        <NavBar />
        <div style={styles.topBar}>
          <Link to="/products" style={styles.backLink}>
            <img src="/assets/icons/cart/action_back_arrow.png" alt="" style={styles.backIcon} />
            CONTINUE SHOPPING
          </Link>
        </div>
        <div style={styles.heroArea}>
          <h1 style={styles.title}>SHOPPING CART</h1>
          <p style={styles.subtitle}>0 Items</p>
        </div>
        <div style={styles.loginRequired}>
          <img src="/assets/icons/cart/cart_login_required.png" alt="Login required" style={{ width: 80, marginBottom: 16 }} />
          <h2 style={styles.loginTitle}>Login required</h2>
          <p style={styles.loginSubtext}>Please log in to view your shopping cart,<br />save items, and proceed to checkout.</p>
          <button style={styles.loginBtn} onClick={() => setShowLogin(true)}>LOGIN</button>
          <button style={styles.createBtn}>CREATE AN ACCOUNT</button>
        </div>
        {showLogin && <LoginModal onClose={() => { setShowLogin(false); }} message="Please sign in to view your cart." />}
      </div>
    );
  }

  if (loading) return <div style={styles.page}><NavBar /><p style={{ textAlign: 'center', padding: 60 }}>Loading...</p></div>;

  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);

  return (
    <div style={styles.page}>
      <NavBar />
      <div style={styles.topBar}>
        <Link to="/products" style={styles.backLink}>
          <img src="/assets/icons/cart/action_back_arrow.png" alt="" style={styles.backIcon} />
          CONTINUE SHOPPING
        </Link>
      </div>
      <div style={styles.heroArea}>
        <h1 style={styles.title}>SHOPPING CART</h1>
        <p style={styles.subtitle}>{items.length} items</p>
      </div>

      {items.length === 0 ? (
        <div style={styles.emptyState}>
          <img src="/assets/icons/cart/cart_empty_large.png" alt="Empty cart" style={{ width: 100, marginBottom: 16 }} />
          <h2 style={{ color: '#031040', marginBottom: 8 }}>Your cart is empty</h2>
          <p style={{ color: '#666', marginBottom: 20 }}>Add some products to get started!</p>
          <button style={styles.continueShopping} onClick={() => navigate('/products')}>
            CONTINUE SHOPPING
          </button>
        </div>
      ) : (
        <div style={styles.cartLayout}>
          {/* Items */}
          <div style={styles.itemsPanel}>
            <div style={styles.itemsHeader}>
              <span style={{ flex: 2 }}>Product</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Quantity</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Unit Price</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Total</span>
            </div>
            {items.map(item => {
              const imgUrl = item.product_image_url
                ? (item.product_image_url.startsWith('http') ? item.product_image_url : `${BACKEND_URL}${item.product_image_url}`)
                : '/logo_orbital_suppliers.png';
              return (
                <div key={item.cart_item_id} style={styles.itemRow}>
                  <div style={{ ...styles.itemInfo, flex: 2 }}>
                    <img src={imgUrl} alt={item.product_name} style={styles.itemImg}
                      onError={e => { e.target.src = '/logo_orbital_suppliers.png'; }} />
                    <div>
                      <p style={styles.itemName}>{item.product_name}</p>
                      {item.product_description && (
                        <p style={styles.itemDesc}>{item.product_description}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <button style={styles.qtyBtn} onClick={() => updateQty(item.cart_item_id, item.quantity - 1)}>−</button>
                    <span style={{ minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                    <button style={styles.qtyBtn} onClick={() => updateQty(item.cart_item_id, item.quantity + 1)}>+</button>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right', fontWeight: 500 }}>
                    ${Number(item.unit_price).toFixed(2)}
                  </div>
                  <div style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>
                    ${Number(item.line_total).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div style={styles.summary}>
            <div style={styles.summaryRow}>
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            <div style={styles.summaryRow}>
              <span>Shipping</span><span>$0.00</span>
            </div>
            <div style={styles.totalRow}>
              <span>Total</span><span style={styles.totalAmt}>${subtotal.toFixed(2)}</span>
            </div>
            <button style={styles.continueBtn} onClick={() => navigate('/products')}>
              CONTINUE SHOPPING
            </button>
            <button style={styles.checkoutBtn} onClick={() => navigate('/checkout')}>
              <img src="/assets/icons/cart/action_add_to_cart.png" alt="" style={{ width: 18, marginRight: 8, verticalAlign: 'middle' }} />
              CHECKOUT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif' },
  topBar: { padding: '12px 32px' },
  backLink: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    textDecoration: 'none', color: '#2850B8', fontWeight: 600, fontSize: 14,
    border: '1.5px solid #2850B8', borderRadius: 6, padding: '6px 14px',
  },
  backIcon: { width: 16, height: 16 },
  heroArea: { padding: '0 32px 16px', background: 'linear-gradient(180deg, #e8eeff 0%, #f5f7ff 100%)' },
  title: { fontSize: 36, fontWeight: 900, color: '#031040', margin: '0 0 4px' },
  subtitle: { color: '#888', margin: 0, fontSize: 16 },
  loginRequired: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 20px', background: '#fff', margin: '20px 32px',
    borderRadius: 12, textAlign: 'center',
  },
  loginTitle: { fontSize: 24, fontWeight: 700, color: '#031040', marginBottom: 8 },
  loginSubtext: { color: '#666', fontSize: 14, marginBottom: 24 },
  loginBtn: {
    width: 280, padding: '13px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
    fontSize: 15, marginBottom: 12, letterSpacing: 1,
  },
  createBtn: {
    width: 280, padding: '12px', background: 'transparent',
    border: '1.5px solid #2850B8', borderRadius: 6, fontWeight: 600,
    color: '#2850B8', cursor: 'pointer', fontSize: 15,
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 20px', background: '#fff', margin: '20px 32px', borderRadius: 12,
  },
  continueShopping: {
    padding: '12px 32px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 15,
  },
  cartLayout: {
    display: 'flex', gap: 24, padding: '0 32px 40px', flexWrap: 'wrap', alignItems: 'flex-start',
  },
  itemsPanel: {
    flex: '1 1 500px', background: '#fff', borderRadius: 12,
    padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  itemsHeader: {
    display: 'flex', padding: '0 0 12px', borderBottom: '1.5px solid #eee',
    fontWeight: 600, fontSize: 13, color: '#888', marginBottom: 12,
  },
  itemRow: {
    display: 'flex', alignItems: 'center', padding: '14px 0',
    borderBottom: '1px solid #f0f0f0', gap: 8,
  },
  itemInfo: { display: 'flex', alignItems: 'center', gap: 14 },
  itemImg: { width: 96, height: 96, borderRadius: 8, objectFit: 'cover', background: '#f0f4ff' },
  itemName: { fontWeight: 600, margin: 0, fontSize: 14, color: '#161616' },
  itemDesc: { margin: '3px 0 0', fontSize: 12, color: '#666', lineHeight: 1.4 },
  qtyBtn: {
    width: 28, height: 28, border: '1.5px solid #ccc',
    borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700,
  },
  summary: {
    flex: '0 0 280px', background: '#fff', borderRadius: 12,
    padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: 'fit-content',
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '10px 0', borderBottom: '1px solid #f0f0f0', color: '#444', fontSize: 15,
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '14px 0', fontWeight: 700, fontSize: 18,
  },
  totalAmt: { color: '#2850B8', fontSize: 22, fontWeight: 800 },
  continueBtn: {
    width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #2850B8',
    borderRadius: 6, color: '#2850B8', fontWeight: 700, cursor: 'pointer',
    fontSize: 14, marginBottom: 10, marginTop: 8,
  },
  checkoutBtn: {
    width: '100%', padding: '13px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
    fontSize: 14,
  },
};
