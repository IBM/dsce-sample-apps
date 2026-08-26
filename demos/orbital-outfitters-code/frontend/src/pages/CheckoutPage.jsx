import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import axiosClient from '../api/axiosClient';
import { useCart } from '../context/CartContext';
import UnderDevelopmentModal from '../components/UnderDevelopmentModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const TAX_RATE = 0.0798;

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { refreshCartCount } = useCart();

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [showDevModal, setShowDevModal] = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    address1: '', address2: '',
    city: '', state: 'Texas', zip: '', country: 'United States',
  });

  useEffect(() => {
    axiosClient.get('/cart')
      .then(res => setCart(res.data))
      .catch(() => setCart(null))
      .finally(() => setLoading(false));
    // Pre-fill from profile
    axiosClient.get('/auth/me').then(res => {
      const u = res.data;
      setForm(f => ({
        ...f,
        full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        email: u.email || '',
        phone: `+1 (${u.area_code || ''}) ${u.phone || ''}`.trim(),
        address1: u.address_1 || '',
        address2: u.address_2 || '',
        city: u.city || '',
        state: u.state || 'Texas',
        zip: u.zip_code || '',
      }));
    }).catch(() => {});
  }, []);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handlePlaceOrder() {
    if (!form.address1 || !form.city || !form.state || !form.zip) {
      setError('Please fill in all required shipping address fields.');
      return;
    }
    setPlacing(true);
    setError('');
    try {
      const res = await axiosClient.post('/orders', {
        shipping_address_1: form.address1,
        shipping_address_2: form.address2 || null,
        shipping_city: form.city,
        shipping_state: form.state,
        shipping_zip: form.zip,
      });
      await refreshCartCount();
      navigate(`/orders/${res.data.order_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (loading) return <div style={styles.page}><NavBar /><p style={styles.center}>Loading...</p></div>;

  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);
  const tax = Number((subtotal * TAX_RATE).toFixed(2));
  const total = (subtotal + tax).toFixed(2);

  return (
    <>
    <div style={styles.page}>
      <NavBar />
      {/* Stepper */}
      <div style={styles.stepper}>
        <span style={styles.stepDone}>🛒 Cart</span>
        <span style={styles.stepLine} />
        <span style={styles.stepActive}>📋 Checkout</span>
        <span style={styles.stepLine} />
        <span style={styles.stepTodo}>✓ Confirmation</span>
      </div>
      <div style={styles.container}>
        <h1 style={styles.title}>CHECKOUT</h1>
        <p style={styles.subhead}>Secure checkout for your orbital order</p>
        <div style={styles.layout}>
          {/* Form */}
          <div style={styles.formCol}>
            {/* Contact Info */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}><span style={styles.stepNum}>1</span> Contact Information</h3>
              <div style={styles.formGrid3}>
                <div>
                  <label style={styles.label}>Full Name</label>
                  <input style={styles.input} placeholder="Jane Explorer" value={form.full_name}
                    onChange={e => set('full_name', e.target.value)} />
                </div>
                <div>
                  <label style={styles.label}>Email Address</label>
                  <input style={styles.input} type="email" placeholder="jane.explorer@orbital.com"
                    value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div>
                  <label style={styles.label}>Phone Number</label>
                  <input style={styles.input} type="tel" placeholder="+1 (555) 123-4567"
                    value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}><span style={styles.stepNum}>2</span> Shipping Address</h3>
              <div style={styles.formGrid2}>
                <div>
                  <label style={styles.label}>Address</label>
                  <input style={styles.input} placeholder="123 Orbit Avenue" value={form.address1}
                    onChange={e => set('address1', e.target.value)} />
                </div>
                <div>
                  <label style={styles.label}>Address Line 2 (Optional)</label>
                  <input style={styles.input} placeholder="Suite 500" value={form.address2}
                    onChange={e => set('address2', e.target.value)} />
                </div>
              </div>
              <div style={styles.formGrid4}>
                <div>
                  <label style={styles.label}>City</label>
                  <input style={styles.input} placeholder="Houston" value={form.city}
                    onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <label style={styles.label}>State/Region</label>
                  <select style={styles.input} value={form.state} onChange={e => set('state', e.target.value)}>
                    {US_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>ZIP Code</label>
                  <input style={styles.input} placeholder="77368" value={form.zip}
                    onChange={e => set('zip', e.target.value)} />
                </div>
                <div>
                  <label style={styles.label}>Country</label>
                  <select style={styles.input} value={form.country} onChange={e => set('country', e.target.value)}>
                    <option>United States</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}><span style={styles.stepNum}>3</span> Payment Method</h3>
              <div style={styles.paymentPlaceholder}>
                <span style={{ fontSize: 32 }}>💳</span>
                <p style={{ color: '#888', fontSize: 14, margin: '10px 0 0' }}>
                  Payment handling not yet supported or required.
                </p>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div style={styles.summaryCol}>
            <h3 style={styles.summaryTitle}>🛒 Order Summary</h3>
            <div style={styles.summaryItems}>
              {items.map(item => {
                const imgUrl = item.product_image_url
                  ? (item.product_image_url.startsWith('http') ? item.product_image_url : `${BACKEND_URL}${item.product_image_url}`)
                  : '/logo_orbital_suppliers.png';
                return (
                  <div key={item.cart_item_id} style={styles.summaryItem}>
                    <img src={imgUrl} alt={item.product_name} style={styles.summaryImg}
                      onError={e => { e.target.src = '/logo_orbital_suppliers.png'; }} />
                    <div style={{ flex: 1 }}>
                      <p style={styles.summaryItemName}>{item.product_name}</p>
                      <p style={styles.summaryItemQty}>Qty: {item.quantity}</p>
                    </div>
                    <span style={styles.summaryItemPrice}>${Number(item.line_total).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div style={styles.sumRow}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div style={styles.sumRow}><span>Shipping</span><span>Free</span></div>
            <div style={styles.sumRow}>
              <span>Tax (7.98%) ⓘ</span><span>${tax.toFixed(2)}</span>
            </div>
            <div style={styles.totalRow}>
              <strong>Total</strong>
              <strong style={styles.totalAmt}>${total}</strong>
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.placeBtn} onClick={() => setShowDevModal(true)} disabled={placing}>
              {placing ? 'PLACING ORDER...' : 'PLACE ORDER  +'}
            </button>
            <Link to="/cart" style={{ textDecoration: 'none' }}>
              <button style={styles.returnBtn}>RETURN TO CART</button>
            </Link>
            <p style={styles.secureNote}>🔒 256-bit encrypted secure checkout</p>
          </div>
        </div>
      </div>
    </div>
    {showDevModal && <UnderDevelopmentModal onClose={() => setShowDevModal(false)} />}
    </>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif' },
  center: { textAlign: 'center', padding: 60 },
  stepper: {
    display: 'flex', alignItems: 'center', padding: '16px 40px',
    gap: 8, fontSize: 14, color: '#888', background: '#fff', borderBottom: '1px solid #eee',
  },
  stepDone: { color: '#888' },
  stepLine: { flex: 1, height: 1, background: '#ddd' },
  stepActive: { color: '#2850B8', fontWeight: 700 },
  stepTodo: { color: '#bbb' },
  container: { maxWidth: 1100, margin: '0 auto', padding: '24px 24px 40px' },
  title: { fontSize: 36, fontWeight: 900, color: '#031040', margin: '0 0 4px' },
  subhead: { color: '#888', marginBottom: 24 },
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  formCol: { flex: '1 1 560px' },
  section: { background: '#fff', borderRadius: 10, padding: 24, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#031040', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10 },
  stepNum: {
    width: 26, height: 26, borderRadius: '50%', background: '#2850B8', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
  },
  formGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 },
  formGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  formGrid4: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 },
  input: {
    width: '100%', padding: '10px 12px', border: '1.5px solid #ddd',
    borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none',
  },
  paymentPlaceholder: {
    border: '1.5px dashed #ccc', borderRadius: 8, padding: '28px',
    textAlign: 'center', background: '#fafafa',
  },
  summaryCol: {
    flex: '0 0 320px', background: '#fff', borderRadius: 12,
    padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  summaryTitle: { fontSize: 16, fontWeight: 700, color: '#031040', margin: '0 0 16px' },
  summaryItems: { marginBottom: 12 },
  summaryItem: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  summaryImg: { width: 48, height: 48, borderRadius: 6, objectFit: 'cover', background: '#f0f4ff' },
  summaryItemName: { fontWeight: 600, margin: 0, fontSize: 13 },
  summaryItemQty: { color: '#888', fontSize: 12, margin: 0 },
  summaryItemPrice: { fontWeight: 600, fontSize: 14 },
  sumRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14, color: '#555',
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '14px 0', fontSize: 18,
  },
  totalAmt: { color: '#2850B8', fontSize: 22 },
  error: { color: '#c00', fontSize: 13, marginTop: 8 },
  placeBtn: {
    width: '100%', padding: '14px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
    fontSize: 15, marginTop: 12, marginBottom: 10,
  },
  returnBtn: {
    width: '100%', padding: '13px', background: '#fff', border: '1.5px solid #2850B8',
    borderRadius: 6, color: '#2850B8', fontWeight: 700, cursor: 'pointer', fontSize: 15,
  },
  secureNote: { textAlign: 'center', color: '#888', fontSize: 12, marginTop: 12 },
};
