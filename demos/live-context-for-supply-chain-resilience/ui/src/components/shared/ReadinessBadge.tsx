// ui/src/components/shared/ReadinessBadge.tsx
// Coloured status badge for SupplyChainResilienceProfile.readiness_status
import React from 'react';
import type { ReadinessStatus } from '../../types';

const CONFIG: Record<ReadinessStatus, { label: string; className: string }> = {
  CONFIRMED: { label: 'Confirmed', className: 'confirmed' },
  AT_RISK:   { label: 'At Risk', className: 'at-risk' },
  CRITICAL:  { label: 'Critical', className: 'critical' },
  UNKNOWN:   { label: 'Unknown', className: 'unknown' },
};

interface Props {
  status: ReadinessStatus;
}

export const ReadinessBadge: React.FC<Props> = ({ status }) => {
  const { label, className } = CONFIG[status] ?? CONFIG.UNKNOWN;
  return <span className={`tsci-badge tsci-readiness-badge ${className}`}>{label}</span>;
};
