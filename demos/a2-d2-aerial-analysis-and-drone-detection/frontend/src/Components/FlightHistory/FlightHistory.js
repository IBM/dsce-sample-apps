import React, { useState, useEffect } from 'react';
import { useData } from '../../DataContext';
import styles from './FlightHistory.module.scss';

const FlightHistory = ({ flightId, droneId }) => {
  const { setHistoricalPaths } = useData();
  const [flights, setFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded && droneId) {
      fetchDroneFlights();
    }
  }, [expanded, droneId]);

  const fetchDroneFlights = async () => {
    if (!droneId) return;

    setLoading(true);
    setError(null);

    try {
      const isLocal = window.location.hostname === 'localhost';
      const baseUrl = isLocal ? 'http://localhost:4000' : '';

      // Fetch all flights for this drone
      const response = await fetch(`${baseUrl}/api/drone-flights/${droneId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load flight history');
      }

      const result = await response.json();
      
      if (result.success) {
        setFlights(result.flights || []);
        
        if (result.flights.length === 0) {
          setError('No flight history available for this drone.');
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching drone flights:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFlightClick = async (flight) => {
    setSelectedFlight(flight.flight_id);
    
    try {
      const isLocal = window.location.hostname === 'localhost';
      const baseUrl = isLocal ? 'http://localhost:4000' : '';

      // Fetch the complete flight data with route
      const response = await fetch(`${baseUrl}/api/flight-history/${flight.flight_id}`);
      
      if (!response.ok) {
        throw new Error('Failed to load flight route');
      }

      const result = await response.json();
      
      if (result.success && result.data.route) {
        // Extract coordinates from route
        const pathCoordinates = result.data.route
          .filter(point => point.lat && point.lng)
          .map(point => [
            parseFloat(point.lat),
            parseFloat(point.lng)
          ]);
        
        // Update historical paths in context for map visualization
        setHistoricalPaths(prev => ({
          ...prev,
          [droneId]: pathCoordinates
        }));
        
        console.log(`📍 Loaded ${pathCoordinates.length} points for flight ${flight.flight_id}`);
      }
    } catch (err) {
      console.error('Error loading flight route:', err);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className={styles.flightHistorySection}>
      <div className={styles.sectionHeader}>
        <button
          className={styles.headerButton}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={styles.sectionTitle}>Flight History</span>
          <span className={styles.expandIcon}>{expanded ? '▼' : '▶'}</span>
        </button>
        {droneId && (
          <span className={styles.sectionHint}>
            {droneId}
          </span>
        )}
      </div>

      {expanded && (
        <div className={styles.historyContent}>
          {!droneId ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyTitle}>No drone selected</span>
              <span className={styles.emptyText}>
                Select a drone from the Active or Inactive Drones list to view its flight history.
              </span>
            </div>
          ) : loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <span className={styles.loadingText}>Loading flight history...</span>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <span className={styles.errorTitle}>Error: {error}</span>
              <button
                className={styles.retryButton}
                onClick={fetchDroneFlights}
              >
                Retry
              </button>
            </div>
          ) : flights.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyTitle}>No flight history</span>
              <span className={styles.emptyText}>
                No flight history available for this drone.
              </span>
            </div>
          ) : (
            <div className={styles.historyCard}>
              <div className={styles.historySummary}>
                Total Flights: <strong>{flights.length}</strong>
              </div>
              <div className={styles.historyTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Flight ID</div>
                  <div className={styles.tableCell}>Start Time</div>
                  <div className={styles.tableCell}>End Time</div>
                  <div className={styles.tableCell}>Duration</div>
                  <div className={styles.tableCell}>Points</div>
                  <div className={styles.tableCell}>Sensor</div>
                  <div className={styles.tableCell}>Status</div>
                  <div className={styles.tableCell}>Action</div>
                </div>
                <div className={styles.tableBody}>
                  {flights.map((flight, index) => (
                    <div 
                      key={index} 
                      className={`${styles.tableRow} ${selectedFlight === flight.flight_id ? styles.selectedRow : ''}`}
                    >
                      <div className={styles.tableCell} title={flight.flight_id}>
                        {flight.flight_id.substring(0, 20)}...
                      </div>
                      <div className={styles.tableCell}>
                        {formatTimestamp(flight.start_time)}
                      </div>
                      <div className={styles.tableCell}>
                        {formatTimestamp(flight.end_time)}
                      </div>
                      <div className={styles.tableCell}>
                        {formatDuration(flight.summary?.duration_seconds)}
                      </div>
                      <div className={styles.tableCell}>
                        {flight.summary?.total_points || 0}
                      </div>
                      <div className={styles.tableCell}>
                        {flight.sensor_type || '-'}
                      </div>
                      <div className={styles.tableCell}>
                        <span className={flight.status === 'active' ? styles.statusActive : styles.statusHistorical}>
                          {flight.status === 'active' ? 'Active' : 'Completed'}
                        </span>
                      </div>
                      <div className={styles.tableCell}>
                        <button
                          className={styles.viewButton}
                          onClick={() => handleFlightClick(flight)}
                          disabled={!flight.summary?.total_points || flight.summary.total_points === 0}
                        >
                          View Path
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FlightHistory;

// Made with Bob
