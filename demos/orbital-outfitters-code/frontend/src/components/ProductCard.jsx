import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export default function ProductCard({ product, onAddToCart }) {
  const imageUrl = product.product_image_url
    ? (product.product_image_url.startsWith('http') ? product.product_image_url : `${BACKEND_URL}${product.product_image_url}`)
    : '/logo_orbital_suppliers.png';

  return (
    <div style={styles.card}>
      <Link to={`/products/${product.product_id}`} style={styles.imgLink}>
        <img src={imageUrl} alt={product.product_name} style={styles.img}
          onError={e => { e.target.src = '/logo_orbital_suppliers.png'; }} />
      </Link>
      <div style={styles.body}>
        <Link to={`/products/${product.product_id}`} style={styles.name}>
          {product.product_name}
        </Link>
        <p style={styles.desc}>{product.product_description}</p>
        <div style={styles.footer}>
          <span style={styles.price}>${Number(product.price).toFixed(2)}</span>
          <button style={styles.addBtn} onClick={() => onAddToCart(product)}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#fff', borderRadius: 10, overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex',
    flexDirection: 'column', transition: 'box-shadow 0.2s',
  },
  imgLink: { display: 'block' },
  img: { width: '100%', height: 180, objectFit: 'cover', display: 'block', background: '#f0f4ff' },
  body: { padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  name: { fontWeight: 700, fontSize: 15, color: '#161616', textDecoration: 'none' },
  desc: { fontSize: 13, color: '#555', flex: 1, margin: 0,
    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { fontWeight: 700, color: '#2850B8', fontSize: 16 },
  addBtn: {
    background: '#2850B8', color: '#fff', border: 'none',
    borderRadius: 6, padding: '7px 14px', fontSize: 13,
    cursor: 'pointer', fontWeight: 600,
  },
};
