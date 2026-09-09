// ui/src/components/shared/SeverityTag.tsx
import React from 'react';
import { Tag } from '@carbon/react';
import type { RiskSeverity } from '../../types';

// Carbon Tag type accepts: 'red' | 'magenta' | 'purple' | 'blue' | 'cyan'
// | 'teal' | 'green' | 'gray' | 'cool-gray' | 'warm-gray' | 'high-contrast' | 'outline'
// 'orange' is NOT a valid Carbon Tag type — use 'magenta' for HIGH severity.
const severityType: Record<RiskSeverity, 'red' | 'magenta' | 'warm-gray' | 'green'> = {
  CRITICAL: 'red',
  HIGH: 'magenta',
  MEDIUM: 'warm-gray',
  LOW: 'green',
};

interface Props {
  severity: RiskSeverity;
}

export const SeverityTag: React.FC<Props> = ({ severity }) => (
  <Tag type={severityType[severity]} size="sm">
    {severity}
  </Tag>
);
