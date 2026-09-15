/**
 * AdminPanel.jsx
 * Password-gated admin panel rendered as a full-screen overlay.
 * Sections:
 *  1. Agent Controls — PII Filter, Content Guardrails, Secrets Detector toggles
 *  2. Board Management — Reset Board (with confirmation modal)
 *
 * Accessed by clicking the Settings icon in the Carbon Header.
 * Password: stored in env as ADMIN_PASSWORD (default: ibmdemo)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Loading,
  InlineNotification,
  Toggle,
  Modal,
  Tag,
} from '@carbon/react';
import {
  Close,
  Settings,
  Security,
  Filter,
  Password,
  TrashCan,
  Renew,
  CheckmarkFilled,
  WarningFilled,
} from '@carbon/icons-react';
import { adminLogin, getAdminConfig, updateAdminConfig, resetBoard } from '../services/api';

// ── Control definitions ───────────────────────────────────────────────────────
const CONTROLS = [
  {
    key: 'pii_filter',
    label: 'PII Filter',
    description: 'Automatically masks personally identifiable information — IP addresses, email addresses, and phone numbers — before they reach the agent or appear in responses.',
    icon: <Filter size={20} />,
    tagLabel: 'Privacy',
    tagType: 'blue',
  },
  {
    key: 'guardrails',
    label: 'Content Guardrails',
    description: 'Blocks jailbreak attempts, prompt injection attacks, and harmful or off-topic content. Ensures the agent stays within its incident resolution scope.',
    icon: <Security size={20} />,
    tagLabel: 'Safety',
    tagType: 'teal',
  },
  {
    key: 'secrets_detection',
    label: 'Secrets Detector',
    description: 'Redacts sensitive credentials — API keys, JWT tokens, connection strings, and private keys — to prevent accidental exposure in logs or responses.',
    icon: <Password size={20} />,
    tagLabel: 'Security',
    tagType: 'purple',
  },
];

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onSuccess }) {
  const [password, setPassword]   = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await adminLogin(password.trim());
      onSuccess(password.trim());
    } catch (err) {
      setError('Incorrect password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <div className="admin-login__icon">
          <Settings size={32} />
        </div>
        <h2 className="admin-login__title">Admin Panel</h2>
        <p className="admin-login__subtitle">Enter the admin password to continue</p>

        {error && (
          <div className="admin-login__error">
            <WarningFilled size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login__form">
          <input
            type="password"
            className="admin-login__input"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            disabled={isLoading}
          />
          <Button
            type="submit"
            kind="primary"
            disabled={isLoading || !password.trim()}
            className="admin-login__btn"
          >
            {isLoading ? <Loading small withOverlay={false} /> : 'Unlock Panel'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Control toggle card ───────────────────────────────────────────────────────
function ControlCard({ ctrl, enabled, onChange, isSaving }) {
  return (
    <div className={`control-card ${enabled ? 'control-card--active' : ''}`}>
      <div className="control-card__header">
        <div className="control-card__icon-wrap">
          {ctrl.icon}
        </div>
        <div className="control-card__info">
          <div className="control-card__title-row">
            <span className="control-card__label">{ctrl.label}</span>
            <Tag type={ctrl.tagType} size="sm">{ctrl.tagLabel}</Tag>
          </div>
          <p className="control-card__description">{ctrl.description}</p>
        </div>
        <div className="control-card__toggle">
          <Toggle
            id={`toggle-${ctrl.key}`}
            labelA="Off"
            labelB="On"
            toggled={enabled}
            onToggle={(val) => onChange(ctrl.key, val)}
            disabled={isSaving}
            size="sm"
            hideLabel
          />
        </div>
      </div>
      <div className={`control-card__status ${enabled ? 'control-card__status--on' : 'control-card__status--off'}`}>
        {enabled ? (
          <><CheckmarkFilled size={14} /> Active — agent controls enforced</>
        ) : (
          <><span className="control-card__status-dot" /> Inactive — control not applied</>
        )}
      </div>
    </div>
  );
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────
export default function AdminPanel({ isOpen, onClose, onBoardReset }) {
  const [isAuthed, setIsAuthed]       = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // Controls state
  const [config, setConfig]           = useState({ pii_filter: false, guardrails: false, secrets_detection: false });
  const [isSaving, setIsSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Reset state
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting]       = useState(false);
  const [resetSuccess, setResetSuccess]     = useState(null);
  const [resetError, setResetError]         = useState(null);

  // Load config on auth
  useEffect(() => {
    if (isAuthed && isOpen) {
      setIsLoadingConfig(true);
      getAdminConfig()
        .then((cfg) => setConfig(cfg))
        .catch(() => {})
        .finally(() => setIsLoadingConfig(false));
    }
  }, [isAuthed, isOpen]);

  // Reset local state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSaveSuccess(false);
      setSaveError(null);
      setResetSuccess(null);
      setResetError(null);
    }
  }, [isOpen]);

  const handleLoginSuccess = useCallback((pwd) => {
    setAdminPassword(pwd);
    setIsAuthed(true);
  }, []);

  const handleToggle = useCallback(async (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const saved = await updateAdminConfig(newConfig, adminPassword);
      setConfig(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(err.message);
      // Revert on failure
      setConfig(config);
    } finally {
      setIsSaving(false);
    }
  }, [config, adminPassword]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      const result = await resetBoard();
      setResetSuccess(`Board reset — ${result.count} incidents restored`);
      setShowResetModal(false);
      if (onBoardReset) onBoardReset();
    } catch (err) {
      setResetError(err.message);
      setShowResetModal(false);
    } finally {
      setIsResetting(false);
    }
  }, [onBoardReset]);

  if (!isOpen) return null;

  const activeCount = Object.values(config).filter(Boolean).length;

  return (
    <>
      {/* Backdrop */}
      <div className="admin-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="admin-panel">
        {/* Header */}
        <div className="admin-panel__header">
          <div className="admin-panel__header-left">
            <Settings size={20} className="admin-panel__header-icon" />
            <div>
              <h2 className="admin-panel__title">Admin Panel</h2>
              <p className="admin-panel__subtitle">
                {isAuthed
                  ? `Manage SRE Copilot controls and board configuration`
                  : 'Authentication required'}
              </p>
            </div>
          </div>
          <button className="admin-panel__close-btn" onClick={onClose} aria-label="Close admin panel">
            <Close size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="admin-panel__body">
          {!isAuthed ? (
            <LoginScreen onSuccess={handleLoginSuccess} />
          ) : (
            <>
              {/* ── Section 1: Agent Controls ── */}
              <section className="admin-section">
                <div className="admin-section__heading">
                  <Security size={18} />
                  <h3>Agent Controls</h3>
                  {activeCount > 0 && (
                    <Tag type="green" size="sm">{activeCount} Active</Tag>
                  )}
                </div>
                <p className="admin-section__description">
                  Toggle real-time safety and privacy controls on the watsonx Orchestrate agent.
                  Changes apply immediately to all subsequent analyses.
                </p>

                {/* Status bar */}
                {saveSuccess && (
                  <div className="admin-save-status admin-save-status--ok">
                    <CheckmarkFilled size={16} /> Controls updated successfully
                  </div>
                )}
                {saveError && (
                  <div className="admin-save-status admin-save-status--err">
                    <WarningFilled size={16} /> {saveError}
                  </div>
                )}

                {isLoadingConfig ? (
                  <div className="admin-section__loading">
                    <Loading small withOverlay={false} />
                    <span>Loading control settings…</span>
                  </div>
                ) : (
                  <div className="control-cards">
                    {CONTROLS.map((ctrl) => (
                      <ControlCard
                        key={ctrl.key}
                        ctrl={ctrl}
                        enabled={!!config[ctrl.key]}
                        onChange={handleToggle}
                        isSaving={isSaving}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ── Section 2: Board Management ── */}
              <section className="admin-section admin-section--danger">
                <div className="admin-section__heading">
                  <TrashCan size={18} />
                  <h3>Board Management</h3>
                </div>
                <p className="admin-section__description">
                  Restore the incident board to its original demo state.
                  All generated incidents will be removed and the 8 seed incidents will be restored.
                </p>

                {resetSuccess && (
                  <div className="admin-save-status admin-save-status--ok">
                    <CheckmarkFilled size={16} /> {resetSuccess}
                  </div>
                )}
                {resetError && (
                  <div className="admin-save-status admin-save-status--err">
                    <WarningFilled size={16} /> {resetError}
                  </div>
                )}

                <div className="admin-reset-row">
                  <div className="admin-reset-info">
                    <span className="admin-reset-info__label">Current state</span>
                    <span className="admin-reset-info__hint">
                      Resets to 8 seed incidents • Clears auto-generated incidents • Resets ID counter
                    </span>
                  </div>
                  <Button
                    kind="danger"
                    renderIcon={Renew}
                    onClick={() => setShowResetModal(true)}
                    disabled={isResetting}
                    size="md"
                  >
                    {isResetting ? 'Resetting…' : 'Reset Board'}
                  </Button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── Reset confirmation modal ── */}
      <Modal
        open={showResetModal}
        danger
        modalHeading="Reset Incident Board?"
        primaryButtonText={isResetting ? 'Resetting…' : 'Yes, Reset Board'}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleReset}
        onRequestClose={() => setShowResetModal(false)}
        onSecondarySubmit={() => setShowResetModal(false)}
        primaryButtonDisabled={isResetting}
      >
        <p>
          This will <strong>permanently remove all generated incidents</strong> and restore
          the board to the original 8 seed incidents. The incident ID counter will also reset.
        </p>
        <p style={{ marginTop: '0.75rem', color: '#6f6f6f' }}>
          This action cannot be undone. Proceed?
        </p>
      </Modal>
    </>
  );
}
