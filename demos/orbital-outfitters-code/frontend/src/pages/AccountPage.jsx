import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import LoginModal from '../components/LoginModal';

const NAV_ITEMS = [
  { key: 'overview', label: 'Account Overview', icon: '/assets/icons/account/account_overview_user.png' },
  { key: 'orders', label: 'Order History', icon: '/assets/icons/account/account_order_history_clock.png' },
  { key: 'addresses', label: 'Addresses', icon: '/assets/icons/account/account_addresses_pin.png' },
  { key: 'payment', label: 'Payment Methods', icon: '/assets/icons/account/account_payment_methods_card.png' },
  { key: 'security', label: 'Security', icon: '/assets/icons/account/account_security_shield.png' },
  { key: 'preferences', label: 'Preferences', icon: '/assets/icons/account/account_preferences_gear.png' },
];

export default function AccountPage() {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [emailPref, setEmailPref] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) { setShowLogin(true); return; }
    axiosClient.get('/auth/me')
      .then(res => {
        setProfile(res.data);
        setForm({
          first_name: res.data.first_name || '',
          last_name: res.data.last_name || '',
          email: res.data.email || '',
          phone: res.data.phone || '',
          area_code: res.data.area_code || '',
          address_1: res.data.address_1 || '',
          address_2: res.data.address_2 || '',
          city: res.data.city || '',
          state: res.data.state || '',
          zip_code: res.data.zip_code || '',
        });
      })
      .catch(() => {});
  }, [isLoggedIn]);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      await axiosClient.put('/auth/me', form);
      setSaveMsg('Changes saved!');
      setEditing(false);
    } catch {
      setSaveMsg('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div style={styles.page}>
        <NavBar />
        {showLogin && (
          <LoginModal
            onClose={() => { setShowLogin(false); navigate('/'); }}
            message="Please sign in to view your account."
          />
        )}
      </div>
    );
  }

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : (user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '');

  const addressBlock = profile
    ? [
        profile.address_1,
        profile.address_2,
        profile.city && profile.state ? `${profile.city}, ${profile.state} ${profile.zip_code || ''}` : '',
        'United States',
      ].filter(Boolean).join('\n')
    : '';

  return (
    <div style={styles.page}>
      <NavBar />
      <div style={styles.container}>
        <h1 style={styles.pageTitle}>ACCOUNT</h1>
        <p style={styles.pageSubtitle}>Manage your account information and preferences.</p>

        <div style={styles.layout}>
          {/* Sidebar */}
          <div style={styles.sidebar}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                style={{ ...styles.sideBtn, ...(activeTab === item.key ? styles.sideBtnActive : {}) }}
                onClick={() => setActiveTab(item.key)}
              >
                <img src={item.icon} alt="" style={styles.sideIcon} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Main panel */}
          <div style={styles.mainPanel}>
            {activeTab === 'overview' && profile ? (
              <>
                {/* User header */}
                <div style={styles.userHeader}>
                  <div style={styles.avatarCircle}>
                    <img src="/assets/icons/account/account_overview_user.png" alt="" style={{ width: 40, opacity: 0.6 }} />
                  </div>
                  <div>
                    <h2 style={styles.userName}>{fullName}</h2>
                    <p style={styles.welcomeBack}>Welcome back!</p>
                  </div>
                  <button style={styles.editBtn} onClick={() => setEditing(v => !v)}>
                    {editing ? 'CANCEL' : 'EDIT ACCOUNT'}
                  </button>
                </div>

                {/* Account Information */}
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Account Information</h3>
                  <div style={styles.fieldGrid2}>
                    <div>
                      <label style={styles.label}>Name</label>
                      {editing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input style={styles.input} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First" />
                          <input style={styles.input} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last" />
                        </div>
                      ) : (
                        <input style={{ ...styles.input, background: '#fafafa' }} value={fullName} readOnly />
                      )}
                    </div>
                    <div>
                      <label style={styles.label}>Email</label>
                      <input style={{ ...styles.input, ...(editing ? {} : { background: '#fafafa' }) }}
                        value={editing ? form.email : (profile.email || '')}
                        onChange={e => set('email', e.target.value)}
                        readOnly={!editing}
                      />
                    </div>
                  </div>
                  <div style={styles.fieldGrid1}>
                    <label style={styles.label}>Phone</label>
                    {editing ? (
                      <div style={{ display: 'flex', gap: 8, maxWidth: 320 }}>
                        <input style={{ ...styles.input, width: 90 }} value={form.area_code} onChange={e => set('area_code', e.target.value)} placeholder="Area code" />
                        <input style={styles.input} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Phone number" />
                      </div>
                    ) : (
                      <input style={{ ...styles.input, background: '#fafafa', maxWidth: 320 }}
                        value={profile.area_code ? `+1 (${profile.area_code}) ${profile.phone || ''}` : (profile.phone || '')}
                        readOnly
                      />
                    )}
                  </div>
                </div>

                {/* Shipping Address */}
                <div style={styles.section}>
                  <div style={styles.sectionRow}>
                    <h3 style={styles.sectionTitle}>Shipping Address</h3>
                    <button style={styles.outlineBtn}>EDIT ADDRESS</button>
                  </div>
                  <div style={styles.addressBlock}>
                    {addressBlock.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                  </div>
                </div>

                {/* Password */}
                <div style={styles.section}>
                  <div style={styles.sectionRow}>
                    <h3 style={styles.sectionTitle}>Password</h3>
                    <button style={styles.outlineBtn}>CHANGE PASSWORD</button>
                  </div>
                  <input type="password" style={{ ...styles.input, background: '#fafafa', maxWidth: 320 }}
                    value="••••••••••••" readOnly />
                </div>

                {/* Preferences */}
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Preferences</h3>
                  <label style={styles.checkLabel}>
                    <input type="checkbox" checked={emailPref} onChange={e => setEmailPref(e.target.checked)} style={{ marginRight: 8 }} />
                    Email me about new products, special offers, and updates.
                  </label>
                </div>

                {saveMsg && <p style={saveMsg.includes('Failed') ? styles.errorMsg : styles.successMsg}>{saveMsg}</p>}
                <div style={styles.saveRow}>
                  <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                    {saving ? 'SAVING...' : 'SAVE CHANGES  +'}
                  </button>
                </div>
              </>
            ) : activeTab === 'overview' ? (
              <p style={{ color: '#888', padding: 40 }}>Loading profile...</p>
            ) : (
              <div style={styles.underDev}>
                <span style={{ fontSize: 48 }}>🚧</span>
                <h3 style={styles.underDevTitle}>Functionality Under Development</h3>
                <p style={styles.underDevText}>This section is not yet available. Please check back soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7ff', fontFamily: 'sans-serif' },
  container: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px 48px' },
  pageTitle: { fontSize: 32, fontWeight: 900, color: '#031040', margin: '0 0 4px' },
  pageSubtitle: { color: '#888', marginBottom: 28, fontSize: 14 },
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  sidebar: {
    width: 200, background: '#fff', borderRadius: 12,
    padding: '12px 8px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', flexShrink: 0,
  },
  sideBtn: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '11px 14px', background: 'none', border: 'none',
    cursor: 'pointer', borderRadius: 8, fontSize: 13, color: '#333',
    textAlign: 'left', marginBottom: 2,
  },
  sideBtnActive: { background: '#e8eeff', color: '#2850B8', fontWeight: 600 },
  sideIcon: { width: 20, height: 20, objectFit: 'contain' },
  mainPanel: {
    flex: 1, background: '#fff', borderRadius: 12,
    padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', minWidth: 280,
  },
  userHeader: {
    display: 'flex', alignItems: 'center', gap: 16,
    marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap',
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: '50%',
    background: '#CCDDFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  userName: { fontSize: 22, fontWeight: 700, color: '#031040', margin: '0 0 4px' },
  welcomeBack: { color: '#888', fontSize: 13, margin: 0 },
  editBtn: {
    marginLeft: 'auto', padding: '9px 20px', background: '#fff',
    border: '1.5px solid #2850B8', borderRadius: 6, color: '#2850B8',
    fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
  },
  section: { marginBottom: 24 },
  sectionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#031040', margin: '0 0 12px' },
  fieldGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  fieldGrid1: {},
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 },
  input: {
    width: '100%', padding: '10px 12px', border: '1.5px solid #ddd',
    borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none',
  },
  outlineBtn: {
    padding: '7px 16px', background: '#fff', border: '1.5px solid #ccc',
    borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600, color: '#333', whiteSpace: 'nowrap',
  },
  addressBlock: {
    background: '#fafafa', border: '1.5px solid #ddd', borderRadius: 6,
    padding: '10px 14px', fontSize: 14, color: '#333', lineHeight: 1.8, maxWidth: 360,
  },
  checkLabel: { display: 'flex', alignItems: 'center', fontSize: 14, color: '#333', cursor: 'pointer' },
  saveRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 8 },
  saveBtn: {
    padding: '12px 28px', background: '#2850B8', color: '#fff',
    border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
    fontSize: 14, letterSpacing: 0.5,
  },
  successMsg: { color: '#1E7A40', fontSize: 14, marginBottom: 8 },
  errorMsg: { color: '#c00', fontSize: 14, marginBottom: 8 },
  underDev: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 20px', textAlign: 'center',
  },
  underDevTitle: { fontSize: 20, fontWeight: 700, color: '#031040', margin: '16px 0 8px' },
  underDevText: { color: '#888', fontSize: 14 },
};
