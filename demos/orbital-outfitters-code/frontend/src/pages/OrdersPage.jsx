import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import axiosClient from '../api/axiosClient';
import UnderDevelopmentModal from '../components/UnderDevelopmentModal';
import LoginModal from '../components/LoginModal';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

function statusStyle(status) {
  if (status === 'delivered') return { background: '#C8F2D0', color: '#1E7A40' };
  if (status === 'shipped') return { background: '#CCDDFF', color: '#2850B8' };
  return { background: '#FDE8CC', color: '#E07B00' };
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDevModal, setShowDevModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    axiosClient.get('/orders')
      .then(res => setOrders(res.data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (loading) return <div style={styles.page}><NavBar /><p style={styles.center}>Loading...</p></div>;

  if (!isLoggedIn) return (
    <div style={styles.page}>
      <NavBar />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      <div style={styles.container}>
        <h1 style={styles.title}>MY ORDERS</h1>
        <div style={styles.empty}>
          <p>Please sign in to view your orders.</p>
          <button style={styles.btn} onClick={() => setShowLogin(true)}>LOGIN</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <NavBar />
      <div style={styles.heroBg} />
      <div style={styles.container}>
        <h1 style={styles.title}>MY ORDERS</h1>
        <p style={styles.subtitle}>{orders.length} orders</p>

        {orders.length === 0 ? (
          <div style={styles.empty}>
            <p>No orders yet.</p>
            <button style={styles.shopBtn} onClick={() => navigate('/products')}>Start Shopping</button>
          </div>
        ) : (
          orders.map(order => {
            const st = statusStyle(order.status);
            const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);
            const statusIcon = order.status === 'delivered'
              ? '/assets/icons/orders/order_status_delivered.png'
              : '/assets/icons/orders/order_status_processing.png';
            const date = new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            return (
              <div key={order.order_id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.orderNum}>Order #{order.order_number}</h3>
                    <p style={styles.orderDate}>{date}</p>
                  </div>
                  <div style={styles.headerRight}>
                    <div style={styles.statusCol}>
                      <span style={styles.statusLabel}>Status</span>
                      <span style={{ ...styles.badge, ...st }}>
                        <img src={statusIcon} alt="" style={{ width: 14, marginRight: 4, verticalAlign: 'middle' }} />
                        {statusLabel}
                      </span>
                    </div>
                    <div>
                      <span style={styles.totalLabel}>Total</span>
                      <p style={styles.totalAmt}>${Number(order.total_amount).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Items aren't returned in list endpoint, show shipping info instead */}
                <div style={styles.cardBody}>
                  <p style={styles.shippingLine}>
                    📦 {order.shipping_address_1}, {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                  </p>
                </div>

                <div style={styles.cardActions}>
                  <button style={styles.viewBtn} onClick={() => navigate(`/orders/${order.order_id}`)}>
                    <img src="/assets/icons/orders/view_details.png" alt="" style={{ width: 14, marginRight: 6, verticalAlign: 'middle' }} />
                    VIEW DETAILS
                  </button>
                  <button style={styles.trackBtn} onClick={() => setShowDevModal(true)}>
                    <img src="/assets/icons/orders/track_status.png" alt="" style={{ width: 14, marginRight: 6, verticalAlign: 'middle' }} />
                    TRACK ORDER
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {showDevModal && <UnderDevelopmentModal onClose={() => setShowDevModal(false)} />}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif' },
  heroBg: { height: 8, background: 'linear-gradient(90deg, #CCDDFF, #fff)' },
  container: { maxWidth: 900, margin: '0 auto', padding: '24px 24px 40px' },
  center: { textAlign: 'center', padding: 60 },
  title: { fontSize: 36, fontWeight: 900, color: '#031040', margin: '0 0 4px' },
  subtitle: { color: '#888', marginBottom: 24, fontSize: 16 },
  empty: { textAlign: 'center', padding: 60, color: '#888', background: '#fff', borderRadius: 12 },
  shopBtn: {
    marginTop: 12, padding: '12px 32px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700,
  },
  card: {
    background: '#fff', borderRadius: 12, padding: '20px 24px',
    marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderNum: { fontSize: 18, fontWeight: 700, color: '#031040', margin: '0 0 4px' },
  orderDate: { color: '#888', fontSize: 13, margin: 0 },
  headerRight: { display: 'flex', gap: 32, alignItems: 'flex-start' },
  statusCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  statusLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  badge: {
    display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
    borderRadius: 20, fontSize: 13, fontWeight: 600,
  },
  totalLabel: { fontSize: 12, color: '#888', display: 'block', marginBottom: 4 },
  totalAmt: { fontSize: 20, fontWeight: 800, color: '#031040', margin: 0 },
  cardBody: { borderTop: '1px solid #f0f0f0', padding: '12px 0', marginBottom: 12 },
  shippingLine: { color: '#555', fontSize: 13, margin: 0 },
  cardActions: { display: 'flex', gap: 12 },
  viewBtn: {
    padding: '9px 18px', background: '#fff', border: '1.5px solid #2850B8',
    borderRadius: 6, color: '#2850B8', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  trackBtn: {
    padding: '9px 18px', background: '#fff', border: '1.5px solid #ccc',
    borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};
