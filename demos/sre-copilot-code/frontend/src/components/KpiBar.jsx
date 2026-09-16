/**
 * KpiBar.jsx
 * Executive summary strip rendered just below the Carbon header.
 * Shows live counts per severity, SLA breach risk badges, and avg MTTR.
 * Numbers count up on mount for a polished "dashboard loading" feel.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Tag } from '@carbon/react';
import { Warning, Time, Lightning, Security } from '@carbon/icons-react';

// Fake but plausible MTTR values per severity (minutes)
const MTTR_BY_SEV = { Critical: 8, High: 22, Medium: 47, Low: 110 };

// SLA thresholds — if count >= threshold, show breach-risk badge
const SLA_BREACH_THRESHOLD = { Critical: 2, High: 3 };

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    startRef.current = null;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

function KpiTile({ label, count, color, icon, slaRisk }) {
  const animated = useCountUp(count);
  return (
    <div className={`kpi-tile kpi-tile--${color}`}>
      <div className="kpi-tile__icon">{icon}</div>
      <div className="kpi-tile__body">
        <span className="kpi-tile__count">{animated}</span>
        <span className="kpi-tile__label">{label}</span>
        {slaRisk && (
          <div className="kpi-tile__sla">
            <Lightning size={9} />
            <span>SLA Risk</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KpiBar({ incidents, controlsActive = false }) {
  const counts = {
    Critical: incidents.filter((i) => i.severity === 'Critical').length,
    High:     incidents.filter((i) => i.severity === 'High').length,
    Medium:   incidents.filter((i) => i.severity === 'Medium').length,
    Low:      incidents.filter((i) => i.severity === 'Low').length,
  };

  // Weighted avg MTTR across all open incidents
  const openIncidents = incidents.filter((i) => i.status !== 'Resolved');
  const avgMttr = openIncidents.length === 0 ? 0 :
    Math.round(
      openIncidents.reduce((sum, i) => sum + (MTTR_BY_SEV[i.severity] || 30), 0)
      / openIncidents.length
    );
  const animatedMttr = useCountUp(avgMttr, 1000);

  const totalOpen = openIncidents.length;
  const animatedOpen = useCountUp(totalOpen, 600);

  const slaBreachCount = (counts.Critical >= SLA_BREACH_THRESHOLD.Critical ? 1 : 0)
                       + (counts.High     >= SLA_BREACH_THRESHOLD.High     ? 1 : 0);

  return (
    <div className="kpi-bar">
      {/* Severity tiles */}
      <KpiTile
        label="Critical"
        count={counts.Critical}
        color="critical"
        icon="🔴"
        slaRisk={counts.Critical >= SLA_BREACH_THRESHOLD.Critical}
      />
      <KpiTile
        label="High"
        count={counts.High}
        color="high"
        icon="🟠"
        slaRisk={counts.High >= SLA_BREACH_THRESHOLD.High}
      />
      <KpiTile
        label="Medium"
        count={counts.Medium}
        color="medium"
        icon="🟡"
      />
      <KpiTile
        label="Low"
        count={counts.Low}
        color="low"
        icon="🟢"
      />

      {/* Divider */}
      <div className="kpi-bar__divider" />

      {/* Open incidents */}
      <div className="kpi-stat">
        <span className="kpi-stat__value">{animatedOpen}</span>
        <span className="kpi-stat__label">Open Incidents</span>
      </div>

      {/* Avg MTTR */}
      <div className="kpi-stat">
        <Time size={14} className="kpi-stat__icon" />
        <span className="kpi-stat__value">{animatedMttr}m</span>
        <span className="kpi-stat__label">Avg MTTR</span>
      </div>

      {/* SLA breach risk */}
      {slaBreachCount > 0 && (
        <div className="kpi-stat kpi-stat--alert">
          <Warning size={14} />
          <span className="kpi-stat__value">{slaBreachCount}</span>
          <span className="kpi-stat__label">SLA Breach Risk</span>
        </div>
      )}

      {/* Controls Active badge */}
      {controlsActive && (
        <div className="kpi-stat kpi-stat--controls">
          <Security size={14} />
          <span className="kpi-stat__label kpi-stat__label--controls">🔒 Controls Active</span>
        </div>
      )}
    </div>
  );
}
