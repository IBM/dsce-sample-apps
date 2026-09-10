import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DSARFormData {
  firstName: string;
  lastName: string;
  customerId: string;
  requestType: string;
  requestDetails: string;
}

const StageDSAR: React.FC = () => {
  const [formData, setFormData] = useState<DSARFormData>({
    firstName: '',
    lastName: '',
    customerId: '',
    requestType: '',
    requestDetails: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);

  const handleInputChange = (field: keyof DSARFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowProcessing(true);
    
    setTimeout(() => {
      setSubmitted(true);
      setShowProcessing(false);
    }, 2000);
  };

  const handleReset = () => {
    setFormData({
      firstName: '',
      lastName: '',
      customerId: '',
      requestType: '',
      requestDetails: ''
    });
    setSubmitted(false);
    setShowProcessing(false);
  };

  const isFormValid = formData.firstName && formData.lastName && formData.customerId && formData.requestType;

  return (
    <div className="space-y-6">
      {/* DSAR Form */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Data Subject Access Request Form</h3>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-ibm-blue to-blue-600 rounded-xl p-6 text-white mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl">📝</div>
            <div>
              <div className="font-semibold text-lg">Submit Your DSAR Request</div>
              <div className="text-sm opacity-90">Exercise your rights under DPDP Act Section §11</div>
            </div>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Instructions:</strong> Please type your name and customer ID to submit DSAR request. 
            Select the type of request and provide any additional details to help us process your request efficiently.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                First Name <span className="text-ibm-red">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter your first name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Last Name <span className="text-ibm-red">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter your last name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          {/* Customer ID */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer ID <span className="text-ibm-red">*</span>
            </label>
            <input
              type="text"
              value={formData.customerId}
              onChange={(e) => handleInputChange('customerId', e.target.value)}
              placeholder="e.g., CUST-1000"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none transition-all"
              required
            />
          </div>

          {/* Request Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Request Type <span className="text-ibm-red">*</span>
            </label>
            <select
              value={formData.requestType}
              onChange={(e) => handleInputChange('requestType', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none transition-all"
              required
            >
              <option value="">Select a request type</option>
              <option value="get_copy">Get copy of my personal data</option>
              <option value="delete_all">Delete all my personal data</option>
              <option value="unsubscribe">Unsubscribe me from marketing communications</option>
            </select>
          </div>

          {/* Request Details */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Request Details
            </label>
            <textarea
              value={formData.requestDetails}
              onChange={(e) => handleInputChange('requestDetails', e.target.value)}
              placeholder="Provide additional details about your request (optional)"
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={!isFormValid || submitted}
              className="flex-1 bg-ibm-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            >
              {showProcessing ? 'Processing...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:border-gray-400 transition-all"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Processing Animation */}
      <AnimatePresence>
        {showProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-4 border-ibm-blue"
          >
            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚙️</span>
              Processing DSAR Request
            </h4>
            
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-ibm-blue bg-opacity-10 border-2 border-ibm-blue rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">1️⃣</div>
                  <div>
                    <div className="font-semibold text-gray-900">Validating Request</div>
                    <div className="text-sm text-gray-600">Verifying customer identity and request details</div>
                  </div>
                  <div className="ml-auto">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="text-ibm-blue text-xl"
                    >
                      ⚙️
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="p-4 bg-ibm-blue bg-opacity-10 border-2 border-ibm-blue rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">2️⃣</div>
                  <div>
                    <div className="font-semibold text-gray-900">Logging in IBM Verify</div>
                    <div className="text-sm text-gray-600">Recording request in DSAR management system</div>
                  </div>
                  <div className="ml-auto">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="text-ibm-blue text-xl"
                    >
                      ⚙️
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
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
              <div className="font-bold text-xl">DSAR Request Submitted Successfully</div>
            </div>
            <div className="text-sm opacity-90 space-y-2">
              <p>
                Your Data Subject Access Request has been received and logged in IBM Verify.
              </p>
              <p>
                <strong>Request ID:</strong> DSAR-{Date.now().toString().slice(-6)}
              </p>
              <p>
                <strong>Request Type:</strong> {
                  formData.requestType === 'get_copy' ? 'Get copy of personal data' :
                  formData.requestType === 'delete_all' ? 'Delete all personal data' :
                  'Unsubscribe from marketing communications'
                }
              </p>
              <p className="pt-2 border-t border-white border-opacity-30">
                DPDP Act Section §11 - Rights of Data Principal: ✓ Compliant
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Information */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="font-bold text-gray-900 mb-4">About DSAR Requests</h4>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <div className="font-semibold text-gray-900 mb-1">What is a DSAR?</div>
                <div className="text-sm text-gray-600">
                  A Data Subject Access Request (DSAR) allows you to exercise your rights under the DPDP Act, 
                  including accessing, correcting, or deleting your personal data held by organizations.
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏱️</span>
              <div>
                <div className="font-semibold text-gray-900 mb-1">Processing Timeline</div>
                <div className="text-sm text-gray-600">
                  Your request will be processed within the timeframe specified by the DPDP Act. 
                  You will receive updates via email at each stage of processing.
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <div className="font-semibold text-gray-900 mb-1">Privacy & Security</div>
                <div className="text-sm text-gray-600">
                  All DSAR requests are handled securely through IBM Verify's consent management system, 
                  ensuring your personal information remains protected throughout the process.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-ibm-blue bg-opacity-10 border-2 border-ibm-blue rounded-lg text-sm text-gray-700">
          <strong>DPDP Act Section §11 - Rights of Data Principal:</strong> 
          <br />
          Data principals have the right to access their personal data, request corrections, 
          and request deletion under specified circumstances. Organizations must respond to 
          such requests in a timely manner as prescribed by the Act.
        </div>
      </div>
    </div>
  );
};

export default StageDSAR;

// Made with Bob