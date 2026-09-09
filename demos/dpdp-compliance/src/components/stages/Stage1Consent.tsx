import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConsentState {
  identityVerification: boolean;
  serviceEnrollment: boolean;
  marketing: boolean;
}

interface ConsentLedgerEntry {
  id: string;
  type: 'identityVerification' | 'serviceEnrollment' | 'marketing';
  action: 'granted' | 'revoked';
  timestamp: string;
  label: string;
}

interface Stage1ConsentProps {
  onConsentChange?: (consents: ConsentState) => void;
}

const Stage1Consent: React.FC<Stage1ConsentProps> = ({ onConsentChange }) => {
  const [consents, setConsents] = useState<ConsentState>({
    identityVerification: false,
    serviceEnrollment: false,
    marketing: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [consentLedger, setConsentLedger] = useState<ConsentLedgerEntry[]>([]);
  const [revokingConsent, setRevokingConsent] = useState<string | null>(null);

  const handleConsentChange = (key: keyof ConsentState) => {
    const newConsents = { ...consents, [key]: !consents[key] };
    setConsents(newConsents);
    if (onConsentChange) {
      onConsentChange(newConsents);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setShowFlow(true);
    
    // Add granted consents to ledger
    const newEntries: ConsentLedgerEntry[] = [];
    const consentLabels = {
      identityVerification: 'Identity Verification',
      serviceEnrollment: 'Service Enrollment',
      marketing: 'Marketing Communications'
    };
    
    Object.entries(consents).forEach(([key, value]) => {
      if (value) {
        newEntries.push({
          id: `${key}-${Date.now()}`,
          type: key as 'identityVerification' | 'serviceEnrollment' | 'marketing',
          action: 'granted',
          timestamp: new Date().toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
          }),
          label: consentLabels[key as keyof typeof consentLabels]
        });
      }
    });
    
    setConsentLedger([...newEntries, ...consentLedger]);
    setTimeout(() => setShowFlow(false), 3000);
  };

  const handleRevokeIndividual = (consentType: keyof ConsentState) => {
    setRevokingConsent(consentType);
    
    setTimeout(() => {
      const newConsents = { ...consents, [consentType]: false };
      setConsents(newConsents);
      
      if (onConsentChange) {
        onConsentChange(newConsents);
      }
      
      // Add revoked entry to ledger
      const consentLabels = {
        identityVerification: 'Identity Verification',
        serviceEnrollment: 'Service Enrollment',
        marketing: 'Marketing Communications'
      };
      
      const revokedEntry: ConsentLedgerEntry = {
        id: `${consentType}-revoked-${Date.now()}`,
        type: consentType,
        action: 'revoked',
        timestamp: new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }),
        label: consentLabels[consentType]
      };
      
      setConsentLedger([revokedEntry, ...consentLedger]);
      
      // Check if all consents are revoked
      const allRevoked = Object.values(newConsents).every(v => !v);
      if (allRevoked) {
        setSubmitted(false);
      }
      
      setRevokingConsent(null);
    }, 1000);
  };

  const handleReset = () => {
    setConsents({ identityVerification: false, serviceEnrollment: false, marketing: false });
    setSubmitted(false);
    setShowFlow(false);
  };

  return (
    <div className="space-y-6">
      {/* KPMG DPDPA Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 shadow-lg text-white text-center">
        <h2 className="text-2xl font-bold mb-2">DPDP Compliance Demo</h2>
        <p className="text-lg opacity-90">Powered by IBM Verify</p>
      </div>

      {/* Service Portal Simulator */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Service Portal</h3>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-ibm-blue to-blue-600 rounded-xl p-6 text-white mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl">👩‍💼</div>
            <div>
              <div className="font-semibold">Welcome, Priya Sharma</div>
              <div className="text-sm opacity-90">Customer ID: CUST-1000</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-gray-900 text-lg">Consent Preferences</h4>
          <p className="text-sm text-gray-600">
            We need your consent to process your personal data. You can update these preferences anytime.
          </p>

          {/* Consent Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-ibm-blue cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={consents.identityVerification}
                onChange={() => handleConsentChange('identityVerification')}
                className="mt-1 w-5 h-5 text-ibm-blue rounded focus:ring-ibm-blue"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Identity Verification</div>
                <div className="text-sm text-gray-600">
                  Process identity documents and personal identifiers for account verification
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-ibm-blue cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={consents.serviceEnrollment}
                onChange={() => handleConsentChange('serviceEnrollment')}
                className="mt-1 w-5 h-5 text-ibm-blue rounded focus:ring-ibm-blue"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Service Enrollment</div>
                <div className="text-sm text-gray-600">
                  Use personal data to enroll you in requested services and personalise your experience
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-ibm-blue cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={consents.marketing}
                onChange={() => handleConsentChange('marketing')}
                className="mt-1 w-5 h-5 text-ibm-blue rounded focus:ring-ibm-blue"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Marketing Communications</div>
                <div className="text-sm text-gray-600">
                  Receive promotional offers, product updates, and personalized recommendations
                </div>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={!consents.identityVerification && !consents.serviceEnrollment && !consents.marketing}
              className="flex-1 bg-ibm-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            >
              Submit Consent
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:border-gray-400 transition-all"
            >
              Reset
            </button>
          </div>

          {/* Individual Consent Withdrawal Controls */}
          {submitted && (
            <div className="mt-6 pt-6 border-t-2 border-gray-200">
              <h4 className="font-bold text-gray-900 mb-3">Withdraw Individual Consents</h4>
              <div className="space-y-2">
                {consents.identityVerification && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-ibm-green">✓</span>
                      <span className="text-sm font-semibold">Identity Verification</span>
                    </div>
                    <button
                      onClick={() => handleRevokeIndividual('identityVerification')}
                      disabled={revokingConsent === 'identityVerification'}
                      className="px-4 py-2 bg-ibm-red text-white text-sm rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 transition-all"
                    >
                      {revokingConsent === 'identityVerification' ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                )}
                {consents.serviceEnrollment && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-ibm-green">✓</span>
                      <span className="text-sm font-semibold">Service Enrollment</span>
                    </div>
                    <button
                      onClick={() => handleRevokeIndividual('serviceEnrollment')}
                      disabled={revokingConsent === 'serviceEnrollment'}
                      className="px-4 py-2 bg-ibm-red text-white text-sm rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 transition-all"
                    >
                      {revokingConsent === 'serviceEnrollment' ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                )}
                {consents.marketing && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-ibm-green">✓</span>
                      <span className="text-sm font-semibold">Marketing Communications</span>
                    </div>
                    <button
                      onClick={() => handleRevokeIndividual('marketing')}
                      disabled={revokingConsent === 'marketing'}
                      className="px-4 py-2 bg-ibm-red text-white text-sm rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 transition-all"
                    >
                      {revokingConsent === 'marketing' ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Consent Status */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-ibm-green text-white rounded-2xl p-6 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl">✓</div>
              <div className="font-bold text-xl">Consent Captured Successfully</div>
            </div>
            <div className="text-sm opacity-90">
              Your consent preferences have been recorded and stored in IBM Verify.
              <br />
              DPDP Act Section §6 - Consent Requirements: ✓ Compliant
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Flow Visualization */}
      <AnimatePresence>
        {showFlow && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <h4 className="font-bold text-gray-900 mb-4">Consent Data Flow</h4>
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-ibm-blue rounded-full flex items-center justify-center text-white text-2xl mb-2">
                  📱
                </div>
                <div className="text-sm font-semibold">Customer App</div>
              </motion.div>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3 }}
                className="flex-1 h-1 bg-ibm-blue mx-4"
              />

              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-ibm-blue rounded-full flex items-center justify-center text-white text-2xl mb-2">
                  🔐
                </div>
                <div className="text-sm font-semibold">IBM Verify</div>
              </motion.div>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.9 }}
                className="flex-1 h-1 bg-ibm-blue mx-4"
              />

              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.2 }}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-ibm-green rounded-full flex items-center justify-center text-white text-2xl mb-2">
                  💾
                </div>
                <div className="text-sm font-semibold">Consent Repository</div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PII Data Collected & Downstream Apps */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="font-bold text-gray-900 mb-4">PII Data Collected & Usage</h4>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm font-semibold text-gray-700 mb-3">Personal Data Collected</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-ibm-blue">•</span>
                <span>Name: Priya Sharma</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ibm-blue">•</span>
                <span>Email: priya.sharma@example.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ibm-blue">•</span>
                <span>Phone: +91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ibm-blue">•</span>
                <span>National ID: 1234 5678 9012</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ibm-blue">•</span>
                <span>Tax ID: ABCDE1234F</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm font-semibold text-gray-700 mb-3">Downstream Applications</div>
            <div className="space-y-2">
              <div className={`p-3 rounded-lg border-2 transition-all ${
                consents.identityVerification ? 'border-ibm-green bg-ibm-green bg-opacity-10' : 'border-gray-300 bg-gray-100 opacity-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Identity Verification System</div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    consents.identityVerification ? 'bg-ibm-green text-white' : 'bg-gray-400 text-white'
                  }`}>
                    {consents.identityVerification ? 'Active' : 'Blocked'}
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-1">Uses: National ID, Tax ID, Name</div>
              </div>

              <div className={`p-3 rounded-lg border-2 transition-all ${
                consents.serviceEnrollment ? 'border-ibm-green bg-ibm-green bg-opacity-10' : 'border-gray-300 bg-gray-100 opacity-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Service Enrollment System</div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    consents.serviceEnrollment ? 'bg-ibm-green text-white' : 'bg-gray-400 text-white'
                  }`}>
                    {consents.serviceEnrollment ? 'Active' : 'Blocked'}
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-1">Uses: Tax ID, Phone, Email</div>
              </div>

              <div className={`p-3 rounded-lg border-2 transition-all ${
                consents.marketing ? 'border-ibm-green bg-ibm-green bg-opacity-10' : 'border-gray-300 bg-gray-100 opacity-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Marketing Engine</div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    consents.marketing ? 'bg-ibm-green text-white' : 'bg-gray-400 text-white'
                  }`}>
                    {consents.marketing ? 'Active' : 'Blocked'}
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-1">Uses: Email, Phone, Name</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Consent Ledger */}
      {consentLedger.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📋</span>
            Consent Ledger - IBM Verify Consent Manager
          </h4>
          <div className="text-sm text-gray-600 mb-4">
            Real-time consent records showing all grant and revocation events
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <AnimatePresence>
              {consentLedger.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border-2 ${
                    entry.action === 'granted'
                      ? 'border-ibm-green bg-ibm-green bg-opacity-5'
                      : 'border-ibm-red bg-ibm-red bg-opacity-5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl ${
                        entry.action === 'granted' ? 'text-ibm-green' : 'text-ibm-red'
                      }`}>
                        {entry.action === 'granted' ? '✓' : '✗'}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {entry.label}
                        </div>
                        <div className="text-xs text-gray-600">
                          Customer ID: CUST-1000 | Priya Sharma
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        entry.action === 'granted'
                          ? 'bg-ibm-green text-white'
                          : 'bg-ibm-red text-white'
                      }`}>
                        {entry.action === 'granted' ? 'GRANTED' : 'REVOKED'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {entry.timestamp}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          <div className="mt-4 p-3 bg-ibm-blue bg-opacity-10 border-2 border-ibm-blue rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <span className="text-ibm-blue text-xl">ℹ️</span>
              <div className="text-gray-700">
                <strong>Ledger Status:</strong> All consent changes are immediately recorded and propagated to downstream systems in real-time.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consent Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="font-bold text-gray-900 mb-4">Current Consent Status</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className={`text-3xl mb-2 ${consents.identityVerification ? 'text-ibm-green' : 'text-gray-400'}`}>
              {consents.identityVerification ? '✓' : '○'}
            </div>
            <div className="text-sm font-semibold">Identity Verification</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className={`text-3xl mb-2 ${consents.serviceEnrollment ? 'text-ibm-green' : 'text-gray-400'}`}>
              {consents.serviceEnrollment ? '✓' : '○'}
            </div>
            <div className="text-sm font-semibold">Service Enrollment</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className={`text-3xl mb-2 ${consents.marketing ? 'text-ibm-green' : 'text-gray-400'}`}>
              {consents.marketing ? '✓' : '○'}
            </div>
            <div className="text-sm font-semibold">Marketing</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stage1Consent;

// Made with Bob
