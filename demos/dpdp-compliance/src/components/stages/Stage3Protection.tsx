import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateCustomerData, maskAadhaar, maskPAN } from '../../utils/dummyData';

interface Stage3ProtectionProps {
  onMaskingChange?: (masked: boolean) => void;
}

const Stage3Protection: React.FC<Stage3ProtectionProps> = ({ onMaskingChange }) => {
  const [maskingEnabled, setMaskingEnabled] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'analyst' | 'admin' | 'dpo'>('analyst');
  const [queryExecuting, setQueryExecuting] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const customerData = generateCustomerData().slice(0, 5);

  const handleMaskingToggle = () => {
    const newState = !maskingEnabled;
    setMaskingEnabled(newState);
    if (onMaskingChange) {
      onMaskingChange(newState);
    }
  };

  const getRoleMaskingLevel = () => {
    switch (selectedRole) {
      case 'analyst':
        return { aadhaar: true, pan: true, account: false };
      case 'admin':
        return { aadhaar: true, pan: false, account: false };
      case 'dpo':
        return { aadhaar: false, pan: false, account: false };
      default:
        return { aadhaar: true, pan: true, account: true };
    }
  };

  const maskingLevel = getRoleMaskingLevel();

  return (
    <div className="space-y-6">
      {/* KPMG DPDPA Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 shadow-lg text-white text-center">
        <h2 className="text-2xl font-bold mb-2">DPDP Compliance Demo</h2>
        <p className="text-lg opacity-90">Powered by IBM Guardium Data Protection</p>
      </div>

      {/* Role Selector */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">IBM Guardium Data Protection - Role-Based Access</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select User Role:
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedRole('analyst')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRole === 'analyst'
                    ? 'border-ibm-blue bg-ibm-blue bg-opacity-10'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-3xl mb-2">👨‍💼</div>
                <div className="font-semibold text-gray-900">Data Analyst</div>
                <div className="text-xs text-gray-600 mt-1">Ravi Kumar</div>
              </button>
              <button
                onClick={() => setSelectedRole('admin')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRole === 'admin'
                    ? 'border-ibm-blue bg-ibm-blue bg-opacity-10'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-3xl mb-2">👨‍💻</div>
                <div className="font-semibold text-gray-900">Security Admin</div>
                <div className="text-xs text-gray-600 mt-1">Arjun Mehta</div>
              </button>
              <button
                onClick={() => setSelectedRole('dpo')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRole === 'dpo'
                    ? 'border-ibm-blue bg-ibm-blue bg-opacity-10'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-3xl mb-2">👩‍⚖️</div>
                <div className="font-semibold text-gray-900">DPO</div>
                <div className="text-xs text-gray-600 mt-1">Kavitha Iyer</div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-semibold text-gray-900">Dynamic Data Redaction</div>
              <div className="text-sm text-gray-600">Apply role-based redaction policies</div>
            </div>
            <button
              onClick={handleMaskingToggle}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                maskingEnabled ? 'bg-ibm-green' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  maskingEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl p-6 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Customer Data Query Results</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className={`px-3 py-1 rounded-full font-semibold ${
              maskingEnabled ? 'bg-ibm-green text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {maskingEnabled ? '🛡️ Protected' : '⚠️ Unmasked'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Customer ID</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Name</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">National ID</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Tax ID</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Reference No.</th>
              </tr>
            </thead>
            <tbody>
              {customerData.map((customer, index) => (
                <motion.tr
                  key={customer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="p-3 text-sm">{customer.id}</td>
                  <td className="p-3 text-sm font-medium">{customer.name}</td>
                  <td className="p-3 text-sm font-mono">
                    <motion.span
                      key={`${customer.id}-nationalId-${maskingEnabled}-${maskingLevel.aadhaar}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={maskingEnabled && maskingLevel.aadhaar ? 'text-ibm-red' : 'text-gray-900'}
                    >
                      {maskingEnabled && maskingLevel.aadhaar
                        ? maskAadhaar(customer.nationalId)
                        : customer.nationalId}
                    </motion.span>
                  </td>
                  <td className="p-3 text-sm font-mono">
                    <motion.span
                      key={`${customer.id}-taxId-${maskingEnabled}-${maskingLevel.pan}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={maskingEnabled && maskingLevel.pan ? 'text-ibm-red' : 'text-gray-900'}
                    >
                      {maskingEnabled && maskingLevel.pan
                        ? maskPAN(customer.taxId)
                        : customer.taxId}
                    </motion.span>
                  </td>
                  <td className="p-3 text-sm font-mono">
                    {maskingEnabled && maskingLevel.account
                      ? `REF****${customer.referenceNumber.slice(-4)}`
                      : customer.referenceNumber}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Redaction Policy Info */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="font-bold text-gray-900 mb-4">Active Redaction Policies</h4>
        <div className="space-y-3">
          <div className={`p-4 rounded-lg border-2 ${
            maskingLevel.aadhaar ? 'border-ibm-red bg-ibm-red bg-opacity-5' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">National ID Redaction</div>
                <div className="text-sm text-gray-600">Format: XXXX XXXX 1234</div>
              </div>
              <div className={`text-2xl ${maskingLevel.aadhaar ? 'text-ibm-red' : 'text-gray-400'}`}>
                {maskingLevel.aadhaar ? '🛡️' : '○'}
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 ${
            maskingLevel.pan ? 'border-ibm-red bg-ibm-red bg-opacity-5' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">Tax ID Redaction</div>
                <div className="text-sm text-gray-600">Format: ABXXX1234C</div>
              </div>
              <div className={`text-2xl ${maskingLevel.pan ? 'text-ibm-red' : 'text-gray-400'}`}>
                {maskingLevel.pan ? '🛡️' : '○'}
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 ${
            maskingLevel.account ? 'border-ibm-red bg-ibm-red bg-opacity-5' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">Reference Number Redaction</div>
                <div className="text-sm text-gray-600">Format: REF****1234</div>
              </div>
              <div className={`text-2xl ${maskingLevel.account ? 'text-ibm-red' : 'text-gray-400'}`}>
                {maskingLevel.account ? '🛡️' : '○'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <strong>DPDP Act Section §8 - Security Safeguards:</strong> ✓ Compliant
          <br />
          Data protection policies ensure analysts can work while sensitive PII remains protected.
        </div>
      </div>

      {/* SQL Query Simulator */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-lg text-white font-mono text-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-ibm-green">●</span>
            <span className="font-semibold">SQL Query Console</span>
          </div>
          <button
            onClick={() => {
              setQueryExecuting(true);
              setShowBeforeAfter(true);
              setTimeout(() => {
                setQueryExecuting(false);
              }, 2000);
            }}
            disabled={queryExecuting}
            className="px-4 py-2 bg-ibm-green text-white rounded-lg font-sans text-sm font-semibold hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
          >
            {queryExecuting ? '⏳ Executing...' : '▶️ Execute Query'}
          </button>
        </div>
        <div className="bg-black bg-opacity-50 p-4 rounded-lg cursor-pointer hover:bg-opacity-70 transition-all"
             onClick={() => {
               setQueryExecuting(true);
               setShowBeforeAfter(true);
               setTimeout(() => {
                 setQueryExecuting(false);
               }, 2000);
             }}>
          <div className="text-ibm-green">SELECT</div>
          <div className="ml-4 text-gray-300">
            customer_id, name,
            <br />
            {maskingEnabled && maskingLevel.aadhaar ? (
              <span className="text-ibm-red">MASK_NATIONAL_ID(national_id)</span>
            ) : (
              <span>national_id</span>
            )} AS national_id,
            <br />
            {maskingEnabled && maskingLevel.pan ? (
              <span className="text-ibm-red">MASK_TAX_ID(tax_id)</span>
            ) : (
              <span>tax_id</span>
            )} AS tax_id,
            <br />
            reference_number
          </div>
          <div className="text-ibm-green">FROM</div>
          <div className="ml-4 text-gray-300">customers</div>
          <div className="text-ibm-green">WHERE</div>
          <div className="ml-4 text-gray-300">status = 'ACTIVE'</div>
          <div className="text-ibm-green">LIMIT 5;</div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          <span>Policy: {selectedRole === 'analyst' ? 'ANALYST_RESTRICTED' : selectedRole === 'admin' ? 'ADMIN_PARTIAL' : 'DPO_FULL_ACCESS'}</span>
          {queryExecuting && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-ibm-green"
            >
              ⚡ Applying redaction policies...
            </motion.span>
          )}
        </div>
      </div>

      {/* Before/After Comparison */}
      <AnimatePresence>
        {showBeforeAfter && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-4 border-ibm-blue"
          >
            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              Real-Time Data Redaction Comparison
            </h4>

            <div className="grid grid-cols-2 gap-4">
              {/* Before - Unredacted */}
              <div className="border-2 border-ibm-red rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">⚠️</span>
                  <span className="font-semibold text-gray-900">Before Redaction</span>
                  <span className="ml-auto text-xs px-2 py-1 bg-ibm-red text-white rounded-full">Exposed</span>
                </div>
                <div className="space-y-2 text-sm font-mono">
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">National ID:</span> <span className="text-ibm-red font-semibold">{customerData[0].nationalId}</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">Tax ID:</span> <span className="text-ibm-red font-semibold">{customerData[0].taxId}</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">Reference No.:</span> <span className="text-ibm-red font-semibold">{customerData[0].referenceNumber}</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600 bg-ibm-red bg-opacity-10 p-2 rounded">
                  ❌ Full PII visible - Non-compliant with DPDP Act §8
                </div>
              </div>

              {/* After - Redacted */}
              <div className="border-2 border-ibm-green rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🛡️</span>
                  <span className="font-semibold text-gray-900">After Redaction</span>
                  <span className="ml-auto text-xs px-2 py-1 bg-ibm-green text-white rounded-full">Protected</span>
                </div>
                <div className="space-y-2 text-sm font-mono">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-2 bg-gray-50 rounded"
                  >
                    <span className="text-gray-600">National ID:</span> <span className="text-ibm-green font-semibold">{maskAadhaar(customerData[0].nationalId)}</span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-2 bg-gray-50 rounded"
                  >
                    <span className="text-gray-600">Tax ID:</span> <span className="text-ibm-green font-semibold">{maskPAN(customerData[0].taxId)}</span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 }}
                    className="p-2 bg-gray-50 rounded"
                  >
                    <span className="text-gray-600">Reference No.:</span> <span className="text-ibm-green font-semibold">REF****{customerData[0].referenceNumber.slice(-4)}</span>
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="mt-3 text-xs text-gray-600 bg-ibm-green bg-opacity-10 p-2 rounded"
                >
                  ✓ PII protected - Compliant with DPDP Act §8
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-4 p-4 bg-ibm-blue bg-opacity-10 border-2 border-ibm-blue rounded-lg"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div className="text-sm">
                  <div className="font-semibold text-gray-900 mb-1">Real-Time Redaction Applied</div>
                  <div className="text-gray-600">
                    IBM Guardium Data Protection automatically redacted sensitive PII fields based on the {selectedRole === 'analyst' ? 'Data Analyst' : selectedRole === 'admin' ? 'Security Admin' : 'DPO'}'s role permissions.
                    The query returned redacted data without exposing actual National IDs, Tax IDs, or full reference numbers.
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowBeforeAfter(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                Close Comparison
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Stage3Protection;

// Made with Bob
