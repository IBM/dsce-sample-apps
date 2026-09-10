import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag } from '@carbon/react';
import { Close, Checkmark, Launch } from '@carbon/icons-react';
import axios from 'axios';
import './ActionDetail.scss';

const MCP_URL = import.meta.env.VITE_MCP_SERVER_URL || '';

// ── Tag type helpers ──────────────────────────────────────────────────────
const GAP_STATUS_TYPE  = { 'Gap Identified': 'warm-gray', 'Review Required': 'blue', 'Aligned': 'green' };
const PRIORITY_TYPE    = { 'Critical': 'red', 'High': 'magenta', 'Medium': 'blue', 'Low': 'green' };

// ── Compact stacked field/value pair ─────────────────────────────────────
function Field({ label, value, link = false }) {
  if (!value) return null;
  return (
    <div className="ep-field">
      <span className="ep-field__label">{label}</span>
      {link
        ? <a href="#" className="ep-field__link" onClick={e => e.preventDefault()}>{value}</a>
        : <span className="ep-field__value">{value}</span>
      }
    </div>
  );
}

// ── Section card — bordered block with coloured left accent ──────────────
function Section({ badge, badgeClass, accentClass, heading, children }) {
  return (
    <div className={`ep-section ${accentClass ?? ''}`}>
      <div className="ep-section__meta">
        <span className={`ep-section__tag ${badgeClass}`}>{badge}</span>
        <span className="ep-section__heading">{heading}</span>
      </div>
      <div className="ep-section__body">{children}</div>
    </div>
  );
}

// ── Diff row: shows current → updated with source attribution ─────────────
function DiffRow({ label, current, updated, source }) {
  return (
    <div className="ep-diff-row">
      <span className="ep-diff-row__label">{label}</span>
      <div className="ep-diff-row__values">
        <span className="ep-diff-row__current">{current}</span>
        <span className="ep-diff-row__arrow">→</span>
        <span className="ep-diff-row__updated">{updated}</span>
      </div>
      <span className="ep-diff-row__source">{source}</span>
    </div>
  );
}

// ── Maximo update confirmation modal ─────────────────────────────────────
function MaximoUpdateModal({ data, onConfirm, onCancel, updating, error }) {
  if (!data) return null;
  return createPortal(
    <div className="ep-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm Maximo PM schedule update">
      <div className="ep-modal">
        <div className="ep-modal__header">
          <div className="ep-modal__title-row">
            <span className="ep-modal__badge">Maximo</span>
            <h2 className="ep-modal__title">Update PM Schedule</h2>
          </div>
          <button className="ep-header__close" onClick={onCancel} aria-label="Cancel" disabled={updating}>
            <Close size={20} />
          </button>
        </div>

        <div className="ep-modal__body">
          <p className="ep-modal__jobplan">
            PM Record: <strong>{data.pmNum}</strong>
          </p>
          <p className="ep-modal__subtitle">
            The following fields will be updated in Maximo via the MCP server:
          </p>
          <div className="ep-modal__diff">
            <div className="ep-modal__diff-header">
              <span>Field</span>
              <span>Current Value</span>
              <span></span>
              <span>New Value (OEM)</span>
              <span>Source</span>
            </div>
            {data.fields.map((f, i) => (
              <DiffRow key={i} label={f.label} current={f.current} updated={f.updated} source={f.source} />
            ))}
          </div>
          {error && (
            <div className="ep-modal__error" role="alert">
              <strong>Update failed:</strong> {error}
            </div>
          )}
        </div>

        <div className="ep-modal__footer">
          <button className="ep-modal__cancel" onClick={onCancel} type="button" disabled={updating}>
            Cancel
          </button>
          <button
            className={`ep-modal__confirm${updating ? ' ep-modal__confirm--loading' : ''}`}
            onClick={onConfirm}
            type="button"
            disabled={updating}
          >
            {updating ? (
              <>
                <span className="ep-modal__spinner" aria-hidden="true" />
                Updating…
              </>
            ) : (
              <>
                <Launch size={16} />
                Apply to Maximo
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Success toast notification ────────────────────────────────────────────
function SuccessToast({ pmNum, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return createPortal(
    <div className="ep-toast ep-toast--success" role="status" aria-live="polite">
      <Checkmark size={20} className="ep-toast__icon" />
      <div className="ep-toast__text">
        <strong>{pmNum}</strong> PM schedule updated in Maximo successfully.
      </div>
      <button className="ep-toast__close" onClick={onDismiss} aria-label="Dismiss">
        <Close size={16} />
      </button>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────────────
// Panel is always mounted — CSS transition drives the slide-in/out animation.
// Passing data=null slides it out; passing data slides it in.
export default function EvidencePanel({ data, onClose, onUpdate }) {
  const isOpen = Boolean(data);
  const [showModal, setShowModal]     = useState(false);
  const [showToast, setShowToast]     = useState(false);
  const [pmUpdated, setPmUpdated]     = useState(false);
  const [updating, setUpdating]       = useState(false);
  const [updateError, setUpdateError] = useState(null);

  // Reset local state whenever a new asset is opened
  useEffect(() => {
    if (isOpen) {
      setShowModal(false);
      setShowToast(false);
      setPmUpdated(false);
      setUpdating(false);
      setUpdateError(null);
    }
  }, [data?.asset, isOpen]);

  // Close on Escape key (also close modal first if open)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showModal) setShowModal(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, showModal]);

  function handleUpdatePM() {
    if (data?.maximoUpdates) setShowModal(true);
  }

  async function handleConfirmUpdate() {
    if (!data?.maximoUpdates) return;
    setUpdateError(null);
    setUpdating(true);

    // Group fields by pmNum — each distinct PM record needs its own PATCH request.
    // Fall back to data.maximoUpdates.pmNum for single-record cases.
    const byPm = {};
    for (const f of data.maximoUpdates.fields) {
      const pmNum = f.pmNum ?? data.maximoUpdates.pmNum;
      if (!pmNum) continue;
      if (!byPm[pmNum]) byPm[pmNum] = {};
      const key = f.fieldName ?? f.label;
      byPm[pmNum][key] = key === 'frequency' ? parseInt(f.updated, 10) : f.updated;
      if (key === 'frequency' && f.frequnit) {
        byPm[pmNum]['frequnit'] = f.frequnit;
      }
    }

    try {
      await Promise.all(
        Object.entries(byPm).map(([pmNum, fields]) =>
          axios.post(`${MCP_URL}/api/maximo/pm/update`, { pmNum, fields })
        )
      );
      setUpdating(false);
      setShowModal(false);
      setPmUpdated(true);
      setShowToast(true);
      // Notify parent so it can re-read the updated evidence from the cache
      onUpdate?.(data.maximoUpdates.fields);
    } catch (err) {
      setUpdating(false);
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Update failed. Check the Maximo connection.';
      setUpdateError(detail);
    }
  }

  // Parse asset name into ID + description for the header
  const assetId   = data?.asset?.split('—')[0]?.trim() ?? '';
  const assetName = data?.asset?.split('—')[1]?.trim() ?? data?.asset ?? '';

  // maximoUpdates===null means already applied in Maximo (static data updated);
  // maximoUpdates with fields means pending update available.
  const alreadyApplied  = data?.maximoUpdates === null;
  const hasMaximoUpdate = Boolean(data?.maximoUpdates?.fields?.length);

  const content = (
    <>
      {/* Dim overlay — always in DOM, fades in/out */}
      <div
        className={`ep-overlay${isOpen ? ' ep-overlay--open' : ''}`}
        onClick={() => { if (!showModal) onClose(); }}
        aria-hidden="true"
      />

      {/* Side panel — always in DOM, slides in/out */}
      <aside
        className={`ep-panel${isOpen ? ' ep-panel--open' : ''}`}
        aria-label="Evidence details"
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Sticky header ──────────────────────────────────────────── */}
        <div className="ep-header">
          <div className="ep-header__text">
            <p className="ep-header__title">Evidence</p>
            {assetId && (
              <div className="ep-header__asset">
                <span className="ep-header__asset-id">{assetId}</span>
                {assetName && <span className="ep-header__asset-sep">·</span>}
                {assetName && <span className="ep-header__asset-name">{assetName}</span>}
              </div>
            )}
            {data?.gap && <span className="ep-header__topic">{data.gap}</span>}
          </div>
          <div className="ep-header__right">
            {pmUpdated && (
              <span className="ep-header__updated-badge">
                <Checkmark size={14} />
                PM Schedule Updated
              </span>
            )}
            <button
              className="ep-header__close"
              onClick={onClose}
              aria-label="Close evidence"
              title="Close evidence"
            >
              <Close size={20} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="ep-body">

          {/* 1 — Operational Data */}
          <Section badge="Operational data" badgeClass="ep-tag--operational" accentClass="ep-section--operational" heading="Current Maximo practice">
            <Field label="Asset"               value={data?.currentMaximo?.assetNum ?? data?.asset} />
            <Field label="Asset type"          value={data?.currentMaximo?.assetType} />
            <Field label="Asset status"        value={data?.currentMaximo?.assetStatus} />
            <Field label="Site"                value={data?.currentMaximo?.site} />
            <Field label="Priority"            value={data?.currentMaximo?.priority} />
            <Field label="Install date"        value={data?.currentMaximo?.installDate} />
            <Field label="PM record"           value={data?.currentMaximo?.pmNum} />
            <Field label="Job plan"            value={data?.currentMaximo?.jobPlan}           link />
            <Field label="Lube interval"       value={data?.currentMaximo?.lubricationInterval} />
            <Field label="Next due date"       value={data?.currentMaximo?.nextDueDate} />
            <Field label="Source"              value={data?.currentMaximo?.source} />
            <Field label="Last updated"        value={data?.currentMaximo?.lastUpdated} />
          </Section>

          {/* 2 — Engineering Knowledge */}
          <Section badge="Engineering knowledge" badgeClass="ep-tag--engineering" accentClass="ep-section--engineering" heading="OEM recommendation">
            <Field label="Lube interval"       value={data?.oemRecommendation?.lubricationInterval} />
            <Field label="Inspect frequency"   value={data?.oemRecommendation?.inspectionFrequency} />
            <Field label="Source document"     value={data?.oemRecommendation?.sourceDocument} link />
            <Field label="Section"             value={data?.oemRecommendation?.section} />
            <Field label="Document date"       value={data?.oemRecommendation?.documentDate} />
          </Section>

          {/* 3 — AI Analysis */}
          <Section badge="AI analysis" badgeClass="ep-tag--ai" accentClass="ep-section--ai" heading="Gap analysis">
            <div className="ep-tags-row">
              <Tag type={GAP_STATUS_TYPE['Gap Identified'] ?? 'gray'} size="sm">Gap identified</Tag>
              <Tag type={PRIORITY_TYPE[data?.priority ?? 'High'] ?? 'magenta'} size="sm">
                {data?.priority ?? 'High'}
              </Tag>
            </div>
            {data?.aiAnalysis && (
              <p className="ep-analysis-text">{data.aiAnalysis}</p>
            )}
            <Field label="Confidence"          value={data?.confidence} />
            <Field label="Potential impact"    value={data?.impact} />
          </Section>

          {/* 4 — Recommended Action */}
          <Section badge="Recommended action" badgeClass="ep-tag--action" accentClass="ep-section--action" heading="Next step">
            {data?.recommendedAction && (
              <p className="ep-recommended-text">{data.recommendedAction}</p>
            )}
          </Section>

        </div>

        {/* ── Sticky footer ──────────────────────────────────────────── */}
        <div className="ep-footer">
          {hasMaximoUpdate && !pmUpdated && (
            <button className="ep-footer__update-maximo" onClick={handleUpdatePM} type="button">
              <Launch size={16} />
              Update PM Schedule in Maximo
            </button>
          )}
          {(pmUpdated || alreadyApplied) && (
            <div className="ep-footer__updated">
              <Checkmark size={16} />
              PM schedule updated in Maximo
            </div>
          )}
          <button
            className="ep-footer__create"
            onClick={() => {
              setPmUpdated(false);
              setShowToast(false);
              setUpdateError(null);
              onClose();
            }}
            type="button"
          >
            Create task
          </button>
        </div>
      </aside>

      {/* ── Diff confirmation modal ──────────────────────────────────── */}
      {showModal && (
        <MaximoUpdateModal
          data={data?.maximoUpdates}
          onConfirm={handleConfirmUpdate}
          onCancel={() => { if (!updating) { setShowModal(false); setUpdateError(null); } }}
          updating={updating}
          error={updateError}
        />
      )}

      {/* ── Success toast ─────────────────────────────────────────────── */}
      {showToast && (
        <SuccessToast
          pmNum={data?.maximoUpdates?.pmNum ?? 'PM Record'}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </>
  );

  return createPortal(content, document.body);
}
