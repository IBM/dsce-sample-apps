import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import axiosClient from '../api/axiosClient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const TAX_RATE = 0.0798;

function statusStyle(status) {
  if (status === 'delivered') return { background: '#C8F2D0', color: '#1E7A40' };
  if (status === 'shipped') return { background: '#CCDDFF', color: '#2850B8' };
  return { background: '#FDE8CC', color: '#E07B00' };
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosClient.get(`/orders/${id}`)
      .then(res => setOrder(res.data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={styles.page}><NavBar /><p style={styles.center}>Loading...</p></div>;
  if (!order) return <div style={styles.page}><NavBar /><p style={styles.center}>Order not found.</p></div>;

  const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const st = statusStyle(order.status);
  const statusIcon = order.status === 'delivered'
    ? '/assets/icons/orders/order_status_delivered.png'
    : '/assets/icons/orders/order_status_processing.png';

  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const items = order.items || [];
  const subtotal = Number(order.subtotal || items.reduce((s, it) => s + Number(it.line_total || 0), 0));
  const tax = Number((subtotal * TAX_RATE).toFixed(2));
  const total = Number(order.total_amount || subtotal + tax);

  return (
    <div style={styles.page}>
      <NavBar />
      <div style={styles.container}>
        <Link to="/orders" style={styles.backLink}>
          <img src="/assets/icons/cart/action_back_arrow.png" alt="" style={{ width: 14, marginRight: 6, verticalAlign: 'middle' }} />
          MY ORDERS
        </Link>

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Order #{order.order_number}</h1>
            <p style={styles.date}>{date}</p>
          </div>
          <span style={{ ...styles.badge, ...st }}>
            <img src={statusIcon} alt="" style={{ width: 14, marginRight: 4, verticalAlign: 'middle' }} />
            {statusLabel}
          </span>
        </div>

        {/* Items table */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Order Items</h3>
          <div style={styles.tableHeader}>
            <span style={{ flex: 2 }}>Product</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Qty</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Unit Price</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Total</span>
          </div>
          {items.map((item, i) => {
            const imgUrl = item.product_image_url
              ? (item.product_image_url.startsWith('http') ? item.product_image_url : `${BACKEND_URL}${item.product_image_url}`)
              : '/logo_orbital_suppliers.png';
            return (
              <div key={i} style={styles.itemRow}>
                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={imgUrl} alt={item.product_name} style={styles.itemImg}
                    onError={e => { e.target.src = '/logo_orbital_suppliers.png'; }} />
                  <span style={styles.itemName}>{item.product_name}</span>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</div>
                <div style={{ flex: 1, textAlign: 'right' }}>${Number(item.unit_price).toFixed(2)}</div>
                <div style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>${Number(item.line_total).toFixed(2)}</div>
              </div>
            );
          })}
        </div>

        <div style={styles.bottomRow}>
          {/* Shipping address */}
          <div style={{ ...styles.card, flex: 1 }}>
            <h3 style={styles.sectionTitle}>Shipping Address</h3>
            <p style={styles.addrLine}>{order.shipping_address_1}</p>
            {order.shipping_address_2 && <p style={styles.addrLine}>{order.shipping_address_2}</p>}
            <p style={styles.addrLine}>{order.shipping_city}, {order.shipping_state} {order.shipping_zip}</p>
          </div>

          {/* Totals */}
          <div style={{ ...styles.card, flex: 1 }}>
            <h3 style={styles.sectionTitle}>Order Summary</h3>
            <div style={styles.sumRow}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div style={styles.sumRow}><span>Shipping</span><span>Free</span></div>
            <div style={styles.sumRow}><span>Tax (7.98%)</span><span>${tax.toFixed(2)}</span></div>
            <div style={styles.totalRow}>
              <strong>Total</strong>
              <strong style={styles.totalAmt}>${Number(total).toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif' },
  container: { maxWidth: 900, margin: '0 auto', padding: '24px 24px 40px' },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  backLink: {
    display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
    color: '#2850B8', fontWeight: 600, fontSize: 14,
    border: '1.5px solid #2850B8', borderRadius: 6, padding: '7px 16px', marginBottom: 24,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 24, flexWrap: 'wrap', gap: 12,
  },
  title: { fontSize: 28, fontWeight: 900, color: '#031040', margin: '0 0 4px' },
  date: { color: '#888', fontSize: 14, margin: 0 },
  badge: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 16px',
    borderRadius: 20, fontSize: 14, fontWeight: 600,
  },
  card: {
    background: '#fff', borderRadius: 12, padding: '20px 24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#031040', margin: '0 0 16px' },
  tableHeader: {
    display: 'flex', padding: '0 0 12px', borderBottom: '1.5px solid #eee',
    fontWeight: 600, fontSize: 13, color: '#888', marginBottom: 8,
  },
  itemRow: {
    display: 'flex', alignItems: 'center', padding: '12px 0',
    borderBottom: '1px solid #f0f0f0', fontSize: 14, color: '#333',
  },
  itemImg: { width: 84, height: 84, borderRadius: 8, objectFit: 'cover', background: '#f0f4ff' },
  itemName: { fontWeight: 600, color: '#161616' },
  bottomRow: { display: 'flex', gap: 20, flexWrap: 'wrap' },
  addrLine: { color: '#444', fontSize: 14, margin: '2px 0' },
  sumRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14, color: '#555',
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '12px 0', fontSize: 18,
  },
  totalAmt: { color: '#2850B8', fontSize: 22 },
};
