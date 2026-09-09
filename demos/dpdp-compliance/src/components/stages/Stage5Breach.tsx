import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Stage5BreachProps {
  onBreachDetected?: (detected: boolean) => void;
}

const Stage5Breach: React.FC<Stage5BreachProps> = ({ onBreachDetected }) => {
  const [breachSimulated, setBreachSimulated] = useState(false);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [responseActions, setResponseActions] = useState<string[]>([]);
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [hoursRemaining, setHoursRemaining] = useState(72);
  const [openPagesCase, setOpenPagesCase] = useState<string | null>(null);
  const [dpoNotified, setDpoNotified] = useState(false);
  const [showIntegrationFlow, setShowIntegrationFlow] = useState(false);

  const simulateBreach = () => {
    setBreachSimulated(true);
    setResponseActions([]);
    setTimelineProgress(0);

    // Trigger alert after 2 seconds
    setTimeout(() => {
      setAlertTriggered(true);
      if (onBreachDetected) {
        onBreachDetected(true);
      }
      
      // Automated response actions
      const actions = [
        { time: 500, action: 'Session terminated' },
        { time: 1000, action: 'Access revoked' },
        { time: 1500, action: 'Endpoint isolated' },
        { time: 2000, action: 'DPO notified' },
        { time: 2500, action: 'Incident logged' },
      ];

      actions.forEach(({ time, action }) => {
        setTimeout(() => {
          setResponseActions(prev => [...prev, action]);
          
          // Create OpenPages case when incident is logged
          if (action === 'Incident logged') {
            setTimeout(() => {
              const caseNumber = `CASE-${Date.now().toString().slice(-6)}`;
              setOpenPagesCase(caseNumber);
              setShowIntegrationFlow(true);
            }, 500);
          }
          
          // Show DPO notification
          if (action === 'DPO notified') {
            setTimeout(() => {
              setDpoNotified(true);
            }, 300);
          }
        }, time);
      });

      // Start 72-hour countdown
      setHoursRemaining(72);
      const countdownInterval = setInterval(() => {
        setHoursRemaining(prev => {
          if (prev <= 0) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 100); // Faster for demo purposes
    }, 2000);
  };

  const resetDemo = () => {
    setBreachSimulated(false);
    setAlertTriggered(false);
    setResponseActions([]);
    setTimelineProgress(0);
    setHoursRemaining(72);
    setOpenPagesCase(null);
    setDpoNotified(false);
    setShowIntegrationFlow(false);
    if (onBreachDetected) {
      onBreachDetected(false);
    }
  };

  useEffect(() => {
    if (alertTriggered) {
      const interval = setInterval(() => {
        setTimelineProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [alertTriggered]);

  return (
    <div className="space-y-6">
      {/* KPMG DPDPA Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 shadow-lg text-white text-center">
        <h2 className="text-2xl font-bold mb-2">DPDP Compliance Demo</h2>
        <p className="text-lg opacity-90">Powered by IBM QRadar SIEM</p>
      </div>

      {/* Breach Simulation Control */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">IBM QRadar SIEM - Security Monitoring</h3>
        
        <div className="p-6 bg-gray-50 rounded-xl mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl">👨‍💼</div>
            <div>
              <div className="font-semibold text-gray-900">Ravi Kumar - Data Analyst</div>
              <div className="text-sm text-gray-600">Attempting to export customer records...</div>
            </div>
          </div>
          
          <button
            onClick={simulateBreach}
            disabled={breachSimulated}
            className="w-full bg-ibm-red text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 transition-all flex items-center justify-center gap-2"
          >
            <span>⚠️</span>
            {breachSimulated ? 'Breach Detected - Monitoring Active' : 'Simulate Unauthorized Export (48,234 records)'}
          </button>
        </div>

        {!breachSimulated && (
          <div className="text-sm text-gray-600 text-center">
            Click to simulate an unauthorized data export attempt
          </div>
        )}
      </div>

      {/* Real-time Alert */}
      <AnimatePresence>
        {alertTriggered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="bg-ibm-red text-white rounded-2xl p-6 shadow-2xl border-4 border-red-600"
          >
            <div className="flex items-center gap-4 mb-4">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-5xl"
              >
                🚨
              </motion.div>
              <div className="flex-1">
                <div className="text-2xl font-bold mb-1">CRITICAL SECURITY INCIDENT</div>
                <div className="text-lg opacity-90">INC-2026-0891</div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-90">Detected at</div>
                <div className="text-xl font-bold">23:47:32</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <div className="text-sm opacity-90">Records Attempted</div>
                <div className="text-3xl font-bold">48,234</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <div className="text-sm opacity-90">Above Baseline</div>
                <div className="text-3xl font-bold">847x</div>
              </div>
            </div>

            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="font-semibold mb-2">Threat Details:</div>
              <div className="text-sm space-y-1">
                <div>• User: Ravi Kumar (ANALYST)</div>
                <div>• Action: Bulk data export</div>
                <div>• Source: 192.168.1.45</div>
                <div>• Target: External USB device</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Automated Response Timeline */}
      <AnimatePresence>
        {alertTriggered && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <h4 className="font-bold text-gray-900 mb-4">Automated Response Actions</h4>
            
            <div className="space-y-3">
              {[
                { time: '23:47:00', action: 'Export attempt initiated', icon: '📤', status: 'detected' },
                { time: '23:47:32', action: 'Anomaly detected - 847x baseline', icon: '🔍', status: 'detected' },
                { time: '23:47:33', action: 'Session terminated', icon: '🛑', status: responseActions.includes('Session terminated') ? 'completed' : 'pending' },
                { time: '23:47:34', action: 'Access revoked', icon: '🔒', status: responseActions.includes('Access revoked') ? 'completed' : 'pending' },
                { time: '23:47:35', action: 'Endpoint isolated', icon: '🔌', status: responseActions.includes('Endpoint isolated') ? 'completed' : 'pending' },
                { time: '23:47:36', action: 'DPO notified', icon: '📧', status: responseActions.includes('DPO notified') ? 'completed' : 'pending' },
                { time: '23:47:37', action: 'Incident logged', icon: '📝', status: responseActions.includes('Incident logged') ? 'completed' : 'pending' },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 ${
                    item.status === 'completed' ? 'border-ibm-green bg-ibm-green bg-opacity-5' :
                    item.status === 'detected' ? 'border-ibm-red bg-ibm-red bg-opacity-5' :
                    'border-gray-200'
                  }`}
                >
                  <div className="text-2xl">{item.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{item.action}</div>
                    <div className="text-sm text-gray-600">{item.time}</div>
                  </div>
                  {item.status === 'completed' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-2xl text-ibm-green"
                    >
                      ✓
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-ibm-green bg-opacity-10 border-2 border-ibm-green rounded-lg">
              <div className="flex items-center gap-2 text-ibm-green font-semibold">
                <span className="text-xl">✓</span>
                Threat Contained - No Data Exfiltration
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 72-Hour Breach Notification Countdown */}
      <AnimatePresence>
        {alertTriggered && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <h4 className="font-bold text-gray-900 mb-4">DPDP Act §8(6) - Breach Notification Requirement</h4>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Time Remaining to Notify Authorities</span>
                <span className={`text-2xl font-bold ${hoursRemaining <= 24 ? 'text-ibm-red' : 'text-ibm-blue'}`}>
                  {hoursRemaining} hours
                </span>
              </div>
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${hoursRemaining <= 24 ? 'bg-ibm-red' : 'bg-ibm-blue'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${(hoursRemaining / 72) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Incident Severity</div>
                <div className="text-xl font-bold text-ibm-red">Critical</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Data Principals Affected</div>
                <div className="text-xl font-bold text-gray-900">0</div>
                <div className="text-xs text-ibm-green">Threat contained</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 border-2 border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Notify Data Protection Board</div>
                    <div className="text-sm text-gray-600">Within 72 hours of detection</div>
                  </div>
                  <div className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
                    Pending
                  </div>
                </div>
              </div>

              <div className="p-4 border-2 border-ibm-green bg-ibm-green bg-opacity-5 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Notify Affected Data Principals</div>
                    <div className="text-sm text-gray-600">No breach occurred - threat contained</div>
                  </div>
                  <div className="px-3 py-1 bg-ibm-green text-white text-sm font-semibold rounded-full">
                    Not Required
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIEM → OpenPages Integration Flow */}
      <AnimatePresence>
        {showIntegrationFlow && openPagesCase && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-4 border-ibm-blue"
          >
            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🔗</span>
              SIEM → OpenPages Integration
            </h4>

            <div className="space-y-4">
              {/* Integration Flow Visualization */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 bg-ibm-red rounded-full flex items-center justify-center text-white text-2xl mb-2">
                    🚨
                  </div>
                  <div className="text-sm font-semibold">QRadar SIEM</div>
                  <div className="text-xs text-gray-600">Breach Detected</div>
                </motion.div>

                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex-1 h-1 bg-ibm-blue mx-4 relative"
                >
                  <motion.div
                    initial={{ left: 0 }}
                    animate={{ left: '100%' }}
                    transition={{ delay: 0.5, duration: 1, repeat: Infinity }}
                    className="absolute top-0 w-2 h-2 bg-ibm-blue rounded-full -mt-0.5"
                  />
                </motion.div>

                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 bg-ibm-blue rounded-full flex items-center justify-center text-white text-2xl mb-2">
                    📋
                  </div>
                  <div className="text-sm font-semibold">OpenPages</div>
                  <div className="text-xs text-gray-600">Case Created</div>
                </motion.div>
              </div>

              {/* OpenPages Case Details */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="p-4 bg-ibm-blue bg-opacity-10 border-2 border-ibm-blue rounded-lg"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-lg text-gray-900">OpenPages Incident Case</div>
                  <div className="px-3 py-1 bg-ibm-blue text-white text-sm font-semibold rounded-full">
                    {openPagesCase}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-600">Case Type</div>
                    <div className="font-semibold text-gray-900">Data Breach Attempt</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Priority</div>
                    <div className="font-semibold text-ibm-red">Critical</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Status</div>
                    <div className="font-semibold text-yellow-600">Under Investigation</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Assigned To</div>
                    <div className="font-semibold text-gray-900">Kavitha Iyer (DPO)</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Created</div>
                    <div className="font-semibold text-gray-900">{new Date().toLocaleTimeString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Source</div>
                    <div className="font-semibold text-gray-900">IBM QRadar SIEM</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="text-gray-600 text-xs mb-1">Case Description</div>
                  <div className="text-sm text-gray-900">
                    Unauthorized bulk data export attempt detected. User Ravi Kumar attempted to export 48,234 customer records (847x above baseline).
                    Automated response successfully contained the threat. No data exfiltration occurred.
                  </div>
                </div>
              </motion.div>

              {/* Integration Success */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="p-4 bg-ibm-green bg-opacity-10 border-2 border-ibm-green rounded-lg"
              >
                <div className="flex items-center gap-2 text-ibm-green font-semibold">
                  <span className="text-xl">✓</span>
                  Incident automatically escalated to OpenPages for compliance tracking and DPO review
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DPO Notification */}
      <AnimatePresence>
        {dpoNotified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-4 border-yellow-500"
          >
            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📧</span>
              DPO Notification Sent
            </h4>

            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border-2 border-yellow-500 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">👩‍⚖️</div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">Kavitha Iyer - Data Protection Officer</div>
                    <div className="text-sm text-gray-600 mb-3">kavitha.iyer@example.com</div>
                    
                    <div className="bg-white p-3 rounded border border-yellow-300">
                      <div className="text-xs text-gray-600 mb-2">Email Subject:</div>
                      <div className="font-semibold text-sm text-gray-900 mb-3">
                        🚨 URGENT: Critical Security Incident - INC-2026-0891
                      </div>
                      
                      <div className="text-xs text-gray-600 mb-1">Message:</div>
                      <div className="text-sm text-gray-700 space-y-2">
                        <p>Dear Kavitha,</p>
                        <p>A critical security incident has been detected and automatically contained:</p>
                        <ul className="list-disc ml-4 space-y-1">
                          <li>Incident ID: INC-2026-0891</li>
                          <li>User: Ravi Kumar (Data Analyst)</li>
                          <li>Action: Unauthorized bulk export attempt (48,234 records)</li>
                          <li>Status: Threat contained - No data exfiltration</li>
                          <li>OpenPages Case: {openPagesCase || 'Creating...'}</li>
                        </ul>
                        <p className="font-semibold text-ibm-red">
                          Immediate action required: Review incident details and determine if DPDP Board notification is necessary within 72 hours.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-4 p-4 bg-ibm-green bg-opacity-10 border-2 border-ibm-green rounded-lg"
              >
                <div className="text-2xl">✓</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Notification Delivered</div>
                  <div className="text-sm text-gray-600">DPO alerted via email, SMS, and OpenPages dashboard</div>
                </div>
                <div className="text-xs text-gray-600">{new Date().toLocaleTimeString()}</div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Button */}
      {breachSimulated && (
        <div className="flex justify-center">
          <button
            onClick={resetDemo}
            className="px-8 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 transition-all"
          >
            Reset Breach Simulation
          </button>
        </div>
      )}

      {/* Compliance Info */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="font-bold text-gray-900 mb-4">Breach Detection & Response Compliance</h4>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start gap-3">
            <span className="text-ibm-green text-xl">✓</span>
            <div>
              <strong>Real-time Monitoring:</strong> Continuous surveillance of data access patterns
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-ibm-green text-xl">✓</span>
            <div>
              <strong>Automated Response:</strong> Immediate threat containment within seconds
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-ibm-green text-xl">✓</span>
            <div>
              <strong>Incident Logging:</strong> Complete audit trail for regulatory compliance
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-ibm-green text-xl">✓</span>
            <div>
              <strong>DPDP Act §8(6):</strong> 72-hour breach notification tracking
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stage5Breach;

// Made with Bob
