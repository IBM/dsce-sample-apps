import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './RiskAssessment.module.scss';

const RiskAssessment = ({ drone, historicalPath }) => {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const prevDroneDataRef = useRef(null);

  const fetchThreatAssessment = useCallback(async () => {
    if (!drone || !drone.lat || !drone.lng) return;

    // For inactive / grounded drones, immediately provide 0 risk score without threat alert
    if (drone._isInactive || (drone.drone_id && drone.drone_id.includes('INACT'))) {
      setAssessment({
        drone_id: drone.drone_id || drone.id,
        threat_level: 'LOW',
        threat_score: 0,
        distance_to_center: 0,
        bearing_to_center: 0,
        is_heading_towards_center: false,
        eta_minutes: null,
        current_speed: 0,
        current_altitude: 0,
        current_direction: 0,
        has_historical_breaches: false,
        has_payload: false,
        risk_factors: ['Drone is inactive / grounded', 'No motion or operational threat detected'],
        recommendations: ['Telemetry archived — no active response needed'],
        ai_powered: false,
        demo_mode: true,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const isLocal = window.location.hostname === 'localhost';
      const baseUrl = isLocal ? 'http://localhost:4000' : '';

      const response = await fetch(`${baseUrl}/api/assess-threat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drone_id: drone.drone_id || drone.id,
          current_position: { lat: drone.lat, lng: drone.lng },
          speed: drone.speed || 0,
          altitude: drone.altitude || 0,
          direction: drone.azimuth || drone.angle || 0,
          flight_history: historicalPath || [],
        }),
      });

      const result = await response.json();
      if (result.success) {
        setAssessment(result.assessment);
      }
    } catch (error) {
      console.error('Error fetching threat assessment:', error);
    } finally {
      setLoading(false);
    }
  }, [drone, historicalPath]);

  useEffect(() => {
    if (!drone) {
      setAssessment(null);
      prevDroneDataRef.current = null;
      return;
    }

    // Create a snapshot of current drone data
    const currentData = {
      id: drone.drone_id || drone.id,
      lat: drone.lat,
      lng: drone.lng,
      speed: drone.speed,
      altitude: drone.altitude,
      direction: drone.azimuth || drone.angle,
    };

    // Check if drone data has changed
    const hasChanged = !prevDroneDataRef.current ||
      prevDroneDataRef.current.id !== currentData.id ||
      prevDroneDataRef.current.lat !== currentData.lat ||
      prevDroneDataRef.current.lng !== currentData.lng ||
      prevDroneDataRef.current.speed !== currentData.speed ||
      prevDroneDataRef.current.altitude !== currentData.altitude ||
      prevDroneDataRef.current.direction !== currentData.direction;

    // Only fetch if data has changed
    if (hasChanged) {
      fetchThreatAssessment();
      prevDroneDataRef.current = currentData;
    }
  }, [drone, fetchThreatAssessment]);

  if (!drone) return null;

  const getThreatColor = (level) => {
    switch (level) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#eab308';
      case 'LOW': return '#22c55e';
      default: return '#6b7280';
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>🎯 RISK ASSESSMENT</span>
        {loading && <span className={styles.loading}>●</span>}
      </div>

      {assessment ? (
        <div>
          <div className={styles.threatLevel} style={{ borderColor: getThreatColor(assessment.threat_level) }}>
            <div className={styles.threatBadge} style={{ background: getThreatColor(assessment.threat_level) }}>
              {assessment.threat_level}
            </div>
            <div className={styles.threatScore}>
              Threat Score: {assessment.threat_score}/100
            </div>
          </div>

          {/* SMS / Email Notification Badge if Score > 30 or Payload Attached (Active Drones Only) */}
          {!drone._isInactive && (assessment.threat_score > 30 || drone.has_payload || assessment.has_payload) && (
            <div className={styles.smsNotificationBanner}>
              <div className={styles.smsHeader}>
                <span className={styles.smsIcon}>📩</span>
                <span className={styles.smsTitle}>
                  {drone.has_payload || assessment.has_payload
                    ? 'SECURITY ALERT: PAYLOAD DETECTED'
                    : 'ELEVATED THREAT NOTIFICATION'}
                </span>
              </div>
              <div className={styles.smsBody}>
                SMS &amp; Email alerts automatically dispatched for Drone ID: <strong>{drone.drone_id || drone.id}</strong>
              </div>
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>CURRENT STATUS</div>
            <div className={styles.grid}>
              <div className={styles.metric}>
                <span className={styles.label}>Speed</span>
                <span className={styles.value}>{assessment.current_speed?.toFixed(1) || 0} mph</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.label}>Altitude</span>
                <span className={styles.value}>{Math.round(assessment.current_altitude || 0)} ft</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.label}>Direction</span>
                <span className={styles.value}>{Math.round(assessment.current_direction || 0)}°</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.label}>Distance to Center</span>
                <span className={styles.value}>{assessment.distance_to_center} m</span>
              </div>
            </div>
          </div>

          {assessment.is_heading_towards_center && assessment.eta_minutes && (
            <div className={styles.warning}>
              ⚠️ Heading towards protected center
              <br />
              ETA: {assessment.eta_minutes} minutes
            </div>
          )}

          {assessment.risk_factors && assessment.risk_factors.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>RISK FACTORS</div>
              <div className={styles.scrollableList}>
                <ul className={styles.list}>
                  {assessment.risk_factors.slice(0, 5).map((factor, index) => (
                    <li key={index}>{factor}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {assessment.recommendations && assessment.recommendations.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>RECOMMENDATIONS</div>
              <div className={styles.scrollableList}>
                <ul className={styles.list}>
                  {assessment.recommendations.slice(0, 4).map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.emptyState}>
          {loading ? 'Analyzing threat...' : 'Select a drone to assess risk'}
        </div>
      )}
    </div>
  );
};

export default RiskAssessment;

// Made with Bob
