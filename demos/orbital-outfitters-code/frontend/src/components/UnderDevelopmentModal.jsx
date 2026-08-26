import React from 'react';

export default function UnderDevelopmentModal({ onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={e => e.stopPropagation()}>
        <h2 style={styles.title}>Functionality Under Development</h2>
        <p style={styles.body}>This feature is not yet available. Please check back soon.</p>
        <button style={styles.btn} onClick={onClose}>OK</button>
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
    width: 420, maxWidth: '95vw', textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  title: { fontSize: 22, fontWeight: 700, color: '#161616', margin: '0 0 16px' },
  body: { color: '#444', fontSize: 15, marginBottom: 24 },
  btn: {
    padding: '12px 40px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
};
