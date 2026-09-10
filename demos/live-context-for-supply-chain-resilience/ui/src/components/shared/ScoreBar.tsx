// ui/src/components/shared/ScoreBar.tsx
// Visual score breakdown for a mitigation option (spec/07)
import React from 'react';

interface ScoreBarProps {
  label: string;
  value: number;  // 0–100
  weight: number; // fractional weight e.g. 0.45
}

export const ScoreBar: React.FC<ScoreBarProps> = ({ label, value, weight }) => {
  const colour = value < 30 ? 'var(--cds-support-success)'
    : value < 60 ? 'var(--cds-support-warning)'
    : 'var(--cds-support-error)';

  return (
<div className="tsci-score-item">
<div className="tsci-score-row">
        <span>{label} <span className="tsci-score-weight">({Math.round(weight * 100)}% weight)</span></span>
        <span className="tsci-score-value">{Math.round(value)}</span>
      </div>
      <div className="tsci-score-bar">
        <div
          className="tsci-score-fill"
          style={{ width: `${value}%`, backgroundColor: colour }}
        />
      </div>
    </div>
  );
};
