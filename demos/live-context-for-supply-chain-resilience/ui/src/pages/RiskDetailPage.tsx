// ui/src/pages/RiskDetailPage.tsx
// Page 2: Risk Detail – risk, work package, resilience posture, options, evidence, approval (spec/07)
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb, BreadcrumbItem, Button, InlineLoading,
  Tag, Tile, InlineNotification,
  Modal, TextInput, ProgressIndicator, ProgressStep,
} from '@carbon/react';
import { ArrowLeft, CheckmarkFilled, WarningFilled } from '@carbon/icons-react';
import {
  getRisk, getRiskOptions, getShipment, getWorkPackage,
  getResilienceProfile, requestApproval, approveRequest,
  rejectRequest, executeTransfer, executeExpedite, markMitigated,
} from '../api/client';
import { SeverityTag } from '../components/shared/SeverityTag';
import { ScoreBar } from '../components/shared/ScoreBar';
import { ReadinessBadge } from '../components/shared/ReadinessBadge';
import type {
  RiskEvent, MitigationOption, WorkPackage, MaterialRequirement,
  Shipment, ApprovalRequest, SupplyChainResilienceProfile,
} from '../types';

const TYPE_LABEL: Record<string, string> = {
  WAIT: 'Wait / Accept Delay',
  EXPEDITE: 'Expedite Shipment',
  TRANSFER: 'Inventory Transfer',
  ALTERNATE_SUPPLIER: 'Alternate Supplier',
  SUBSTITUTE: 'Material Substitute',
};

const DELAY_REASON_LABEL: Record<string, string> = {
  TRANSPORT_DISRUPTION: 'Transport disruption',
  PORT_CONGESTION: 'Port congestion',
  SUPPLIER_DELAY: 'Supplier delay',
  CUSTOMS_HOLD: 'Customs hold',
  FORCE_MAJEURE: 'Force majeure event',
  QUALITY_HOLD: 'Quality hold at supplier',
  CAPACITY_CONSTRAINT: 'Supplier capacity constraint',
};

// Stale-profile threshold in seconds
const STALE_THRESHOLD_SECS = 300;

/** Generates a plain-English one-liner explaining why this option is or isn't the best choice. */
function getOptionDescription(opt: MitigationOption, isBest: boolean): string {
  if (!opt.feasible) {
    const reason = opt.constraint_type
      ? `a ${opt.constraint_type.toLowerCase().replace(/_/g, ' ')} constraint`
      : 'an active constraint';
    const severity = opt.constraint_severity
      ? ` rated ${opt.constraint_severity.toLowerCase()} severity`
      : '';
    return `This option can't be used right now because of ${reason}${severity}. ${
      opt.constraints.length > 0 ? opt.constraints[0] : 'Check the details above for more information.'
    }`;
  }

  const parts: string[] = [];

  if (isBest) {
    parts.push(`This is the recommended option — it has the lowest overall risk score (${opt.total_score.toFixed(1)}).`);
  } else {
    parts.push(`This option is feasible but carries a higher risk score (${opt.total_score.toFixed(1)}) than the best option.`);
  }

  if (opt.incremental_cost != null && opt.incremental_cost > 0) {
    parts.push(`It comes with an extra cost of USD ${opt.incremental_cost.toLocaleString()}.`);
  } else if (opt.incremental_cost === 0) {
    parts.push('There is no additional cost.');
  }

  if (opt.estimated_ready_date) {
    const date = new Date(opt.estimated_ready_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    parts.push(`Materials would be ready by ${date}.`);
  }

  if (opt.requires_engineering_approval || opt.requires_procurement_approval) {
    const who = [
      opt.requires_engineering_approval ? 'engineering' : '',
      opt.requires_procurement_approval ? 'procurement' : '',
    ].filter(Boolean).join(' and ');
    parts.push(`It requires sign-off from ${who} before it can proceed.`);
  }

  return parts.join(' ');
}

/** Returns how many calendar days late the ETA is vs the required date. Positive = late. */
function daysLate(etaStr: string | number, requiredStr: string | number): number {
  return Math.round(
    (new Date(etaStr as string).getTime() - new Date(requiredStr as string).getTime())
    / (1000 * 60 * 60 * 24),
  );
}

export const RiskDetailPage: React.FC = () => {
  const { riskId } = useParams<{ riskId: string }>();
  const navigate = useNavigate();

  const [risk, setRisk] = useState<RiskEvent | null>(null);
  const [options, setOptions] = useState<MitigationOption[]>([]);
  const [nearEquivalent, setNearEquivalent] = useState(false);
  const [wp, setWp] = useState<WorkPackage | null>(null);
  const [reqs, setReqs] = useState<MaterialRequirement[]>([]);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [resProfile, setResProfile] = useState<SupplyChainResilienceProfile | null>(null);
  const [profileAgeSecs, setProfileAgeSecs] = useState<number | null>(null);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [mitigated, setMitigated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approvalModal, setApprovalModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<MitigationOption | null>(null);
  const [approverName, setApproverName] = useState('');
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    kind: 'success' | 'error' | 'warning'; title: string; subtitle: string;
  } | null>(null);

  useEffect(() => {
    if (!riskId) return;
    (async () => {
      setLoading(true);
      try {
        const [r, opts] = await Promise.all([getRisk(riskId), getRiskOptions(riskId)]);
        setRisk(r);
        setOptions(opts.ranked_options);
        setNearEquivalent(opts.near_equivalent_top_two);
        const [wpData, shp, resData] = await Promise.allSettled([
          getWorkPackage(r.work_package_id),
          getShipment(r.shipment_id),
          getResilienceProfile(r.work_package_id, r.material_id),
        ]);
        if (wpData.status === 'fulfilled') {
          setWp(wpData.value.work_package);
          setReqs(wpData.value.requirements);
        }
        if (shp.status === 'fulfilled') setShipment(shp.value);
        if (resData.status === 'fulfilled') {
          setResProfile(resData.value.profile);
          setProfileAgeSecs(resData.value.profile_age_secs);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [riskId]);

  const handleRequestApproval = (option: MitigationOption) => {
    setSelectedOption(option);
    setApprovalModal(true);
  };

  const handleApprove = async () => {
    if (!selectedOption || !risk) return;
    // Close modal immediately so the user sees progress
    setApprovalModal(false);
    try {
      // Step 1: create approval request
      const req = await requestApproval(
        risk.risk_id,
        selectedOption.option_id,
        `Approve ${TYPE_LABEL[selectedOption.type]} for risk ${risk.risk_id}`,
      );

      // Step 2: approve it
      const approved = await approveRequest(req.approval_request_id, approverName || 'Demo User');
      setApproval(approved);
      setNotification({
        kind: 'success',
        title: 'Approval granted',
        subtitle: `${TYPE_LABEL[selectedOption.type]} approved by ${approverName || 'Demo User'}. Executing action…`,
      });

      // Step 3: execute the appropriate action based on option type
      const execPayload = {
        approval_request_id: approved.approval_request_id,
        risk_id: risk.risk_id,
        option_id: selectedOption.option_id,
      };

      if (selectedOption.type === 'TRANSFER') {
        const result = await executeTransfer({
          ...execPayload,
          source_location_id: 'REGIONAL-WH-DEMO',
          destination_location_id: shipment?.destination_location_id ?? 'PEARL-DEMO',
          material_id: risk.material_id,
          quantity: 1,
        });
        setActionResult(result.transfer_request_id);
      } else if (selectedOption.type === 'EXPEDITE' && shipment) {
        // Request ETA 7 days from now as the expedited delivery
        const requestedEta = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        const result = await executeExpedite({
          ...execPayload,
          shipment_id: shipment.shipment_id,
          requested_eta: requestedEta,
        });
        setActionResult(result.expedite_request_id);
      } else {
        // ALTERNATE_SUPPLIER, WAIT, SUBSTITUTE — no dedicated execute endpoint;
        // mark the risk mitigated directly.
        await markMitigated(execPayload);
      }

      // Step 4: update local state to reflect the mitigated outcome, then show banner
      setTimeout(() => {
        // Update risk status
        setRisk(prev => prev ? { ...prev, status: 'MITIGATED' } : prev);

        // Work package is no longer at risk
        setWp(prev => prev ? { ...prev, status: 'CONFIRMED' } : prev);

        // Update facts: units available now covered, shortage cleared
        if (selectedOption?.type === 'TRANSFER') {
          setShipment(prev => prev ? { ...prev, status: 'IN_TRANSIT' } : prev);
        } else if (selectedOption?.type === 'EXPEDITE') {
          const newEta = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          setShipment(prev => prev ? { ...prev, current_eta: newEta, status: 'IN_TRANSIT' } : prev);
        }

        // Resilience posture: warehouse transfer consumed, update availability
        if (selectedOption?.type === 'TRANSFER') {
          setResProfile(prev => prev ? {
            ...prev,
            readiness_status: 'CONFIRMED',
            resilience_score: Math.min(prev.resilience_score + 30, 100),
            feasible_transfer_location_count: Math.max(prev.feasible_transfer_location_count - 1, 0),
          } : prev);
        } else {
          setResProfile(prev => prev ? {
            ...prev,
            readiness_status: 'CONFIRMED',
            resilience_score: Math.min(prev.resilience_score + 25, 100),
          } : prev);
        }

        setMitigated(true);
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Unknown error';
      setApprovalModal(false);
      setNotification({ kind: 'error', title: 'Action failed', subtitle: msg });
    }
  };

  if (loading) return <InlineLoading description="Loading risk…" className="tsci-loading-state" />;
  if (!risk) return <p className="tsci-loading-state">Risk not found.</p>;

  const facts = risk.facts as Record<string, string | number>;
  const currentStep = mitigated ? 4 : approval?.status === 'APPROVED' ? 3 : approval?.status === 'PENDING' ? 2 : 1;
  const profileIsStale = profileAgeSecs != null && profileAgeSecs > STALE_THRESHOLD_SECS;

  // Prefer live shipment ETA over the static fact snapshot (updated after mitigation)
  const displayEta: string | null = shipment?.current_eta
    ? new Date(shipment.current_eta).toLocaleDateString(undefined, { dateStyle: 'long' })
    : facts.current_eta
      ? new Date(facts.current_eta as string).toLocaleDateString(undefined, { dateStyle: 'long' })
      : null;

  const etaDaysLate = (shipment?.current_eta ?? facts.current_eta as string | undefined) && facts.required_by
    ? daysLate(shipment?.current_eta ?? facts.current_eta as string, facts.required_by)
    : null;

  // After a TRANSFER mitigation the shortage is resolved
  const unitsAvailable = mitigated && selectedOption?.type === 'TRANSFER'
    ? 1
    : Number(facts.available_at_destination ?? 0);
  const shortageQty = mitigated && selectedOption?.type === 'TRANSFER'
    ? 0
    : Number(facts.shortage_quantity ?? 0);

  return (
    <div className="tsci-page-content tsci-page-content--detail">
      <Breadcrumb>
        <BreadcrumbItem onClick={() => navigate('/dashboard')}>Dashboard</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>{risk.risk_id}</BreadcrumbItem>
      </Breadcrumb>

      <div className="tsci-page-header">
        <div className="tsci-row">
          <Button kind="ghost" renderIcon={ArrowLeft} iconDescription="Back" hasIconOnly onClick={() => navigate('/dashboard')} />
          <div>
            <h1 className="bob-ask-title">{risk.risk_id}</h1>
            <p className="bob-ask-subtitle">
              correlationId: {risk.correlation_id}
            </p>
          </div>
          <SeverityTag severity={risk.severity} />
          <Tag type="blue" size="sm">{risk.status}</Tag>
        </div>
      </div>

      {notification && (
        <InlineNotification kind={notification.kind} title={notification.title}
          subtitle={notification.subtitle} onClose={() => setNotification(null)}
          className="tsci-notification" />
      )}
      {actionResult && (
        <InlineNotification kind="success" title="Action executed" subtitle={actionResult}
          className="tsci-notification" />
      )}
      {profileIsStale && (
        <InlineNotification kind="warning" title="Resilience profile may be stale"
          subtitle={`Last assessed ${Math.round(profileAgeSecs! / 60)} minutes ago — consider refreshing before deciding.`}
          hideCloseButton className="tsci-notification" />
      )}

      {/* Workflow progress */}
      <ProgressIndicator currentIndex={currentStep} className="tsci-progress">
        <ProgressStep label="Risk Detected" secondaryLabel="Supply chain alert raised" />
        <ProgressStep label="Options Available" secondaryLabel="Mitigation options scored" />
        <ProgressStep label="Approval Granted" secondaryLabel="Decision authorised" />
        <ProgressStep label="Risk Mitigated" secondaryLabel="Action executed" />
      </ProgressIndicator>

      {/* Mitigated banner */}
      {mitigated && (
        <div className="tsci-mitigated-banner">
          <CheckmarkFilled size={24} className="tsci-mitigated-banner__icon" />
          <div>
            <strong>Risk mitigated</strong>
            <p>
              {TYPE_LABEL[selectedOption?.type ?? '']} was approved by {approverName || 'Demo User'} and
              the action has been executed.{' '}
              {actionResult && <span>Transfer ID: <code>{actionResult}</code>.</span>}
              {' '}The work package schedule is no longer at risk.
            </p>
          </div>
        </div>
      )}

      {/* Facts + Work Package */}
      <div className="tsci-grid tsci-grid--two">
        <Tile>
          <h3 className="tsci-card-title">{mitigated ? 'What was resolved' : 'What went wrong'}</h3>
          <dl className="tsci-dl">
            <dt>Material ID</dt><dd><code>{risk.material_id}</code></dd>
            <dt>Needed by</dt>
            <dd>{facts.required_by ? new Date(facts.required_by as string).toLocaleDateString(undefined, { dateStyle: 'long' }) : '—'}</dd>
            <dt>{mitigated ? 'Resolved ETA' : 'Current ETA'}</dt>
            <dd>
              <span className={mitigated && etaDaysLate != null && etaDaysLate <= 0 ? 'tsci-text-success' : 'tsci-text-danger'}>
                {displayEta ?? '—'}
              </span>
              {!mitigated && etaDaysLate != null && etaDaysLate > 0 && (
                <span className="tsci-late-badge"> {etaDaysLate} day{etaDaysLate !== 1 ? 's' : ''} late</span>
              )}
              {mitigated && etaDaysLate != null && etaDaysLate <= 0 && (
                <span className="tsci-late-badge tsci-late-badge--ok"> On time</span>
              )}
            </dd>
            <dt>Units available</dt>
            <dd>
              <span className={shortageQty === 0 ? 'tsci-text-success' : undefined}>
                {unitsAvailable} at destination
              </span>
              {shortageQty > 0 && (
                <span className="tsci-text-danger"> — short by {shortageQty}</span>
              )}
              {mitigated && shortageQty === 0 && (
                <span className="tsci-text-muted"> — shortage resolved</span>
              )}
            </dd>
            <dt>Root cause</dt>
            <dd>{DELAY_REASON_LABEL[String(facts.delay_reason_code)] ?? String(facts.delay_reason_code ?? '—')}</dd>
            {shipment?.port_of_departure && (
              <><dt>Departed from</dt><dd>{shipment.port_of_departure}</dd></>
            )}
            {shipment?.port_of_entry && (
              <><dt>Arriving at</dt><dd>{shipment.port_of_entry}</dd></>
            )}
            {mitigated && selectedOption && (
              <><dt>Resolved by</dt><dd>{TYPE_LABEL[selectedOption.type]}</dd></>
            )}
          </dl>
        </Tile>

        <Tile>
          <h3 className="tsci-card-title">Affected work</h3>
          {wp ? (
            <dl className="tsci-dl">
              <dt>Work package</dt><dd><code>{wp.work_package_id}</code></dd>
              <dt>Turnaround</dt><dd>{wp.turnaround_id}</dd>
              <dt>Asset</dt><dd>{wp.asset_id}</dd>
              <dt>Planned start</dt>
              <dd>{new Date(wp.planned_start).toLocaleDateString(undefined, { dateStyle: 'long' })}</dd>
              <dt>Current status</dt>
              <dd>
                <Tag type={wp.status === 'AT_RISK' ? 'red' : wp.status === 'CONFIRMED' ? 'green' : 'warm-gray'} size="sm">
                  {wp.status === 'AT_RISK' ? 'At risk — needs action' :
                   wp.status === 'CONFIRMED' ? 'Back on track' : wp.status}
                </Tag>
              </dd>
              {mitigated && approval?.approved_at && (
                <><dt>Mitigated at</dt>
                <dd>{new Date(approval.approved_at).toLocaleString()}</dd></>
              )}
              {mitigated && approval?.approver && (
                <><dt>Actioned by</dt><dd>{approval.approver}</dd></>
              )}
            </dl>
          ) : <InlineLoading />}
        </Tile>
      </div>

      {/* Supply Chain Resilience Posture Panel */}
      {resProfile && (
        <div className="tsci-resilience-panel">
          <div className="tsci-resilience-panel-header">
            <div>
              <h3>Supply chain health check</h3>
              <p className="tsci-resilience-panel-desc">
                A snapshot of how many backup options exist right now for this material.
              </p>
            </div>
            <div className="tsci-row tsci-row--tight">
              <ReadinessBadge status={resProfile.readiness_status} />
              <span className="tsci-resilience-score-inline" data-status={resProfile.readiness_status}>
                Score: {Math.round(resProfile.resilience_score)} / 100
              </span>
              {profileIsStale && <Tag type="warm-gray" size="sm">Stale</Tag>}
            </div>
          </div>
          <div className="tsci-resilience-grid">
            <div className="tsci-res-cell">
              <span className="tsci-res-label">Primary supplier</span>
              <span className={`tsci-res-value ${isConstrainedStatus(resProfile.primary_supplier_status) ? 'constrained' : 'ok'}`}>
                {isConstrainedStatus(resProfile.primary_supplier_status) ? 'Blocked' : 'Available'}
              </span>
              <span className="tsci-res-hint">
                {isConstrainedStatus(resProfile.primary_supplier_status)
                  ? 'Cannot fulfil this order right now'
                  : 'Can deliver on time'}
              </span>
            </div>
            {resProfile.secondary_supplier_status && (
              <div className="tsci-res-cell">
                <span className="tsci-res-label">Secondary supplier</span>
                <span className={`tsci-res-value ${isConstrainedStatus(resProfile.secondary_supplier_status) ? 'constrained' : 'ok'}`}>
                  {isConstrainedStatus(resProfile.secondary_supplier_status) ? 'Blocked' : 'Available'}
                </span>
                <span className="tsci-res-hint">
                  {isConstrainedStatus(resProfile.secondary_supplier_status)
                    ? 'Cannot fulfil this order right now'
                    : 'Can deliver on time'}
                </span>
              </div>
            )}
            <div className="tsci-res-cell">
              <span className="tsci-res-label">Approved backup suppliers</span>
              <span className="tsci-res-value" style={{
                color: resProfile.unconstrained_approved_supplier_count === 0
                  ? 'var(--cds-support-error)'
                  : resProfile.unconstrained_approved_supplier_count === 1
                    ? 'var(--cds-support-warning)'
                    : 'var(--cds-support-success)',
              }}>
                {resProfile.unconstrained_approved_supplier_count}
              </span>
              <span className="tsci-res-hint">
                {resProfile.unconstrained_approved_supplier_count === 0
                  ? 'No approved backup — critical gap'
                  : resProfile.unconstrained_approved_supplier_count === 1
                    ? 'Only one backup — limited options'
                    : 'Multiple backups available'}
              </span>
            </div>
            <div className="tsci-res-cell">
              <span className="tsci-res-label">Warehouse transfers</span>
              <span className="tsci-res-value">{resProfile.feasible_transfer_location_count}</span>
              <span className="tsci-res-hint">
                {resProfile.feasible_transfer_location_count === 0
                  ? 'No stock available to transfer'
                  : `${resProfile.feasible_transfer_location_count} location${resProfile.feasible_transfer_location_count !== 1 ? 's' : ''} with spare stock`}
              </span>
            </div>
            <div className="tsci-res-cell">
              <span className="tsci-res-label">Alternate suppliers</span>
              <span className="tsci-res-value">{resProfile.feasible_alternate_supplier_count}</span>
              <span className="tsci-res-hint">
                {resProfile.feasible_alternate_supplier_count === 0
                  ? 'No alternate source found'
                  : `${resProfile.feasible_alternate_supplier_count} alternate source${resProfile.feasible_alternate_supplier_count !== 1 ? 's' : ''} identified`}
              </span>
            </div>
            <div className="tsci-res-cell">
              <span className="tsci-res-label">Time remaining</span>
              <span className="tsci-res-value" style={{ color: resProfile.days_to_required < 7 ? 'var(--cds-support-error)' : 'inherit' }}>
                {resProfile.days_to_required}d
              </span>
              <span className="tsci-res-hint">
                {resProfile.days_to_required < 7
                  ? 'Urgent — less than one week to act'
                  : `${resProfile.days_to_required} days before material is needed`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Near-equivalent notice */}
      {nearEquivalent && (
        <InlineNotification kind="info" title="Near-equivalent options"
          subtitle="Top two options score within 5 points — review both before deciding."
          hideCloseButton className="tsci-notification tsci-notification--top" />
      )}

      {/* Mitigation options */}
      <h2 className="tsci-section-heading">Mitigation Options</h2>
      <div className="tsci-option-grid">
        {options.map((opt, i) => (
          <div
            key={opt.option_id}
            className={[
              'tsci-option-card',
              i === 0 && opt.feasible ? 'tsci-option-card--recommended' : '',
              !opt.feasible ? 'tsci-option-card--infeasible' : '',
            ].filter(Boolean).join(' ')}
          >
            {/* Card header */}
            <div className="tsci-option-card__header">
              <div className="tsci-option-card__badges">
                {i === 0 && opt.feasible && <Tag type="green" size="sm">Best option</Tag>}
                <Tag type={opt.feasible ? 'blue' : 'red'} size="sm">
                  {opt.feasible ? 'Can be done' : 'Not feasible'}
                </Tag>
              </div>
              <strong className="tsci-option-card__name">{TYPE_LABEL[opt.type] || opt.type}</strong>
              <div className="tsci-option-card__score">
                <span className="tsci-option-card__score-value">{opt.total_score.toFixed(1)}</span>
                <span className="tsci-option-card__score-label">Risk score<br />(lower is better)</span>
              </div>
            </div>

            {/* Score bars */}
            <div className="tsci-option-card__bars">
              <ScoreBar label="Schedule Risk" value={opt.schedule_risk_score} weight={0.45} />
              <ScoreBar label="Technical Risk" value={opt.technical_risk_score} weight={0.25} />
              <ScoreBar label="Supply Risk" value={opt.supply_risk_score} weight={0.20} />
              <ScoreBar
                label="Incremental Cost"
                value={opt.incremental_cost ? Math.min((opt.incremental_cost / 50000) * 100, 100) : 0}
                weight={0.10}
              />
            </div>

            {/* Meta info */}
            <div className="tsci-option-card__meta">
              {opt.estimated_ready_date && (
                <p><strong>Ready by:</strong> {new Date(opt.estimated_ready_date).toLocaleDateString()}</p>
              )}
              {opt.incremental_cost != null && (
                <p><strong>Extra cost:</strong> USD {opt.incremental_cost.toLocaleString()}</p>
              )}
              <div className="tsci-option-card__approval-tags">
                {opt.requires_engineering_approval && (
                  <Tag type="magenta" size="sm">Needs Engineering Sign-off</Tag>
                )}
                {opt.requires_procurement_approval && (
                  <Tag type="purple" size="sm">Needs Procurement Sign-off</Tag>
                )}
              </div>
            </div>

            {/* Constraints */}
            {opt.constraints.length > 0 && (
              <div className="tsci-option-card__constraints">
                <strong className="tsci-eyebrow">Why it might not work</strong>
                <ul className="tsci-constraint-list">
                  {opt.constraints.map((c, j) => <li key={j}>{c}</li>)}
                </ul>
              </div>
            )}

            {/* Footer action */}
            <div className="tsci-option-card__footer">
              <p className="tsci-option-card__description">
                {getOptionDescription(opt, i === 0 && opt.feasible)}
              </p>
              {opt.feasible ? (
                <Button kind="primary" size="sm"
                  onClick={() => handleRequestApproval(opt)}>
                  Request Approval
                </Button>
              ) : (
                <InlineNotification kind="warning" title="Not feasible"
                  subtitle={
                    opt.constraint_type
                      ? `Blocked by: ${opt.constraint_type} (${opt.constraint_severity}). ${opt.constraints.join('; ')}`
                      : opt.constraints.join('; ') || 'See details above'
                  }
                  hideCloseButton className="tsci-notification tsci-notification--top-sm" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Approval status */}
      {approval && !mitigated && (
        <div className="tsci-approval-panel">
          <div className="tsci-approval-panel__header">
            <WarningFilled size={20} className="tsci-approval-panel__icon" />
            <div>
              <h3 className="tsci-card-title tsci-card-title--compact">Approval granted — action pending</h3>
              <p className="tsci-approval-panel__subtitle">
                The decision has been recorded. The system is now executing the action.
              </p>
            </div>
          </div>
          <dl className="tsci-dl">
            <dt>Option approved</dt>
            <dd>{selectedOption ? TYPE_LABEL[selectedOption.type] : '—'}</dd>
            <dt>Approved by</dt><dd>{approval.approver ?? '—'}</dd>
            <dt>Approved at</dt>
            <dd>{approval.approved_at ? new Date(approval.approved_at).toLocaleString() : '—'}</dd>
            <dt>Approval expires</dt><dd>{new Date(approval.expiry).toLocaleString()}</dd>
            <dt>Reference ID</dt><dd><code>{approval.approval_request_id}</code></dd>
          </dl>
        </div>
      )}

      {/* Approval modal */}
      <Modal
        open={approvalModal}
        modalHeading="Confirm approval"
        primaryButtonText="Approve & execute"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleApprove}
        onRequestClose={() => setApprovalModal(false)}
        size="sm"
      >
        {selectedOption && (
          <div className="tsci-modal-option-summary">
            <p className="tsci-modal-copy">
              You are approving the following mitigation action for risk <code>{risk.risk_id}</code>:
            </p>
            <div className="tsci-modal-option-card">
              <strong>{TYPE_LABEL[selectedOption.type]}</strong>
              <span>Risk score: {selectedOption.total_score.toFixed(1)}</span>
              {selectedOption.incremental_cost != null && selectedOption.incremental_cost > 0 && (
                <span>Extra cost: USD {selectedOption.incremental_cost.toLocaleString()}</span>
              )}
              {selectedOption.estimated_ready_date && (
                <span>Ready by: {new Date(selectedOption.estimated_ready_date).toLocaleDateString()}</span>
              )}
            </div>
            <p className="tsci-modal-copy tsci-modal-copy--warning">
              Once approved, the action will be executed automatically. This is a simulated demo — no real changes will be made.
            </p>
          </div>
        )}
        <TextInput
          id="approver-name"
          labelText="Your name (approver)"
          placeholder="e.g. Jane Smith"
          value={approverName}
          onChange={e => setApproverName(e.target.value)}
        />
      </Modal>
    </div>
  );
};

// Checks if a supplier status string indicates a constraint
function isConstrainedStatus(status: string): boolean {
  return status.includes('QUALITY_HOLD') || status.includes('PORT_CONGESTION')
    || status.includes('FORCE_MAJEURE') || status.includes('CAPACITY_CONSTRAINT');
}
