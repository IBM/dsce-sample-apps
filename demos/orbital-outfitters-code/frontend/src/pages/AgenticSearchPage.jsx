import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import LoginModal from '../components/LoginModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

function getTime() {
  const d = new Date();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function AgenticSearchPage() {
  const { isLoggedIn } = useAuth();
  const { refreshCartCount } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const bottomRef = useRef(null);
  const didAutoSearch = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-submit query passed from the home page search bar
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !didAutoSearch.current) {
      didAutoSearch.current = true;
      setInput(q);
      setTimeout(() => {
        setInput('');
        const userMsg = { role: 'user', text: q, time: getTime() };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
        axiosClient.post('/agentSearch', { query: q })
          .then(res => {
            const data = res.data;
            setMessages(prev => [...prev, {
              role: 'agent',
              text: data.agent_response || data.response || 'Here are some products I found.',
              products: data.products || [],
              time: getTime(),
            }]);
          })
          .catch(() => {
            setMessages(prev => [...prev, {
              role: 'agent',
              text: 'Sorry, I encountered an error. Please try again.',
              products: [],
              time: getTime(),
            }]);
          })
          .finally(() => setLoading(false));
      }, 0);
    }
  }, [searchParams]);

  async function handleSubmit(e) {
    e?.preventDefault();
    const query = input.trim();
    if (!query || loading) return;
    setInput('');
    const userMsg = { role: 'user', text: query, time: getTime() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await axiosClient.post('/agentSearch', { query });
      const data = res.data;
      setMessages(prev => [...prev, {
        role: 'agent',
        text: data.agent_response || data.response || 'Here are some products I found.',
        products: data.products || [],
        time: getTime(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: 'Sorry, I encountered an error. Please try again.',
        products: [],
        time: getTime(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleAddToCart(product) {
    if (!isLoggedIn) { setShowLogin(true); return; }
    try {
      await axiosClient.post('/cart/items', { product_id: product.product_id, quantity: 1 });
      await refreshCartCount();
    } catch {}
  }

  function getImageUrl(url) {
    if (!url) return '/logo_orbital_suppliers.png';
    return url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
  }

  return (
    <div style={styles.page}>
      <NavBar />
      <div style={styles.chatArea}>
        {messages.length === 0 && (
          <div style={styles.emptyHint}>
            <p style={styles.emptyText}>Ask the Product Assistant anything about our products!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} style={styles.userRow}>
                <div style={styles.userBubbleWrap}>
                  <div style={styles.userBubble}>{msg.text}</div>
                  <div style={styles.timestamp}>{msg.time}</div>
                </div>
                <div style={styles.userAvatar}>
                  <img src="/assets/icons/home/nav_account_user.png" alt="You" style={styles.avatarImg} />
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={styles.agentRow}>
              <div style={styles.agentBubble}>
                <div style={styles.agentLabel}>Product Assistant</div>
                <p style={styles.agentText}>{msg.text}</p>
                {msg.products && msg.products.length > 0 && (
                  <div style={styles.productGrid}>
                    {msg.products.slice(0, 4).map(p => (
                      <div key={p.product_id} style={styles.productCard}>
                        <img
                          src={getImageUrl(p.product_image_url)}
                          alt={p.product_name}
                          style={styles.productImg}
                          onError={e => { e.target.src = '/logo_orbital_suppliers.png'; }}
                        />
                        <div style={styles.productInfo}>
                          <Link to={`/products/${p.product_id}`} style={styles.productName}>
                            {p.product_name}
                          </Link>
                          <p style={styles.productDesc}>{p.product_description?.slice(0, 70)}</p>
                          <button style={styles.addBtn} onClick={() => handleAddToCart(p)}>
                            <img src="/assets/icons/cart/action_add_to_cart.png" alt="" style={{ width: 14, marginRight: 4, verticalAlign: 'middle' }} />
                            ADD TO CART
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={styles.agentRow}>
            <div style={styles.agentBubble}>
              <div style={styles.agentLabel}>Product Assistant</div>
              <div style={styles.typingDots}>
                <span style={styles.dot} />
                <span style={styles.dot} />
                <span style={styles.dot} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={styles.inputBar}>
        <button style={styles.refreshBtn} onClick={() => setMessages([])} title="Clear conversation">
          <img src="/assets/icons/agentic-search/action_refresh.png" alt="Clear" style={styles.inputIcon} />
        </button>
        <form onSubmit={handleSubmit} style={styles.inputForm}>
          <input
            style={styles.textInput}
            placeholder="Ask about products..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
        </form>
        <button style={styles.submitBtn} onClick={handleSubmit} disabled={loading} title="Submit">
          <img src="/assets/icons/agentic-search/submit_search.png" alt="Submit" style={styles.inputIcon} />
        </button>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} message="Please sign in to add items to your cart." />}

      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif',
    display: 'flex', flexDirection: 'column',
  },
  chatArea: {
    flex: 1, overflowY: 'auto', padding: '24px 32px 12px',
    maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box',
  },
  emptyHint: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 20px', color: '#888',
  },
  emptyText: { fontSize: 16, marginTop: 16, textAlign: 'center' },

  userRow: {
    display: 'flex', justifyContent: 'flex-end',
    alignItems: 'flex-end', gap: 10, marginBottom: 20,
  },
  userBubbleWrap: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: 480 },
  userBubble: {
    background: '#CCDDFF', color: '#031040',
    borderRadius: '18px 18px 4px 18px',
    padding: '12px 18px', fontSize: 15, lineHeight: 1.5,
  },
  timestamp: { fontSize: 11, color: '#aaa', marginTop: 4, marginRight: 4 },
  userAvatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: '#e8eeff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImg: { width: 22, height: 22, objectFit: 'contain' },

  agentRow: {
    display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24,
  },
  agentAvatar: {
    width: 36, height: 36, borderRadius: '50%', background: '#031040',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0,
  },
  agentBubble: {
    background: '#fff', borderRadius: '4px 18px 18px 18px',
    padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    maxWidth: 720, flex: 1,
  },
  agentLabel: { fontWeight: 700, fontSize: 13, color: '#2850B8', marginBottom: 8 },
  agentText: { color: '#333', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' },

  productGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8,
  },
  productCard: {
    display: 'flex', gap: 10, background: '#f5f7ff',
    borderRadius: 8, padding: '10.5px', border: '1px solid #e8eeff',
  },
  productImg: { width: 87, height: 87, borderRadius: 6, objectFit: 'cover', flexShrink: 0 },
  productInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  productName: { fontWeight: 700, fontSize: 13, color: '#031040', textDecoration: 'none' },
  productDesc: { fontSize: 13, color: '#666', margin: 0, flex: 1,
    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  addBtn: {
    padding: '5px 10px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', marginTop: 4,
    alignSelf: 'flex-start',
  },

  typingDots: { display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' },
  dot: {
    width: 8, height: 8, borderRadius: '50%', background: '#2850B8',
    display: 'inline-block',
    animation: 'blink 1.4s infinite both',
  },

  inputBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 32px', background: '#fff',
    borderTop: '1.5px solid #e8eeff',
    maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box',
    position: 'sticky', bottom: 0,
  },
  refreshBtn: {
    width: 40, height: 40, background: '#f5f7ff', border: '1.5px solid #e8eeff',
    borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  inputForm: { flex: 1 },
  textInput: {
    width: '100%', padding: '12px 16px', border: '1.5px solid #ccc',
    borderRadius: 8, fontSize: 15, outline: 'none', boxSizing: 'border-box',
  },
  submitBtn: {
    width: 42, height: 42, background: '#2850B8', border: 'none',
    borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  inputIcon: { width: 20, height: 20, objectFit: 'contain' },
};
