import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { databases, sensitiveFields, generateCustomerData } from '../../utils/dummyData';

interface DSARFormData {
  firstName: string;
  lastName: string;
  customerId: string;
  requestType: string;
  requestDetails: string;
}

interface Stage2DiscoveryProps {
  onDiscoveryComplete?: (data: any) => void;
}

const Stage2Discovery: React.FC<Stage2DiscoveryProps> = ({ onDiscoveryComplete }) => {
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [dsarSubmitted, setDsarSubmitted] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('PRI-8472');
  const [discoveredData, setDiscoveredData] = useState<any>(null);
  const [formData, setFormData] = useState<DSARFormData>({
    firstName: '',
    lastName: '',
    customerId: '',
    requestType: '',
    requestDetails: ''
  });

  const customerData = generateCustomerData();

  const startScan = () => {
    setScanning(true);
    setScanProgress(0);
    setScanComplete(false);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanning(false);
          setScanComplete(true);
          const data = {
            databases: databases.length,
            sensitiveFields: 34,
            totalRecords: 2300000,
          };
          setDiscoveredData(data);
          if (onDiscoveryComplete) {
            onDiscoveryComplete(data);
          }
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  const handleInputChange = (field: keyof DSARFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const submitDSAR = (e: React.FormEvent) => {
    e.preventDefault();
    setShowProcessing(true);
    
    setTimeout(() => {
      setDsarSubmitted(true);
      setShowProcessing(false);
    }, 2000);
  };

  const resetDemo = () => {
    setScanning(false);
    setScanProgress(0);
    setScanComplete(false);
    setDsarSubmitted(false);
    setShowProcessing(false);
    setDiscoveredData(null);
    setFormData({
      firstName: '',
      lastName: '',
      customerId: '',
      requestType: '',
      requestDetails: ''
    });
  };

  const downloadReport = () => {
    const customer = customerData.find(c => c.id === 'CUST-1000');
    const report = `
DSAR Report - ${selectedCustomer}
Generated: ${new Date().toLocaleString()}

Customer Information:
Name: ${customer?.name}
Email: ${customer?.email}
Phone: ${customer?.phone}

Data Found Across Systems:
- ${databases.length} databases scanned
- 34 sensitive fields identified
- 2,300,000 total records processed

Sensitive Data Categories:
${sensitiveFields.map(field => `- ${field}`).join('\n')}

DPDP Act Section §11 - Rights of Data Principal: Compliant
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DSAR_Report_${selectedCustomer}.txt`;
    a.click();
  };

  const isFormValid = formData.firstName && formData.lastName && formData.customerId && formData.requestType;

  return (
    <div className="space-y-6">
      {/* KPMG DPDPA Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 shadow-lg text-white text-center">
        <h2 className="text-2xl font-bold mb-2">DPDP Compliance Demo</h2>
        <p className="text-lg opacity-90">Powered by IBM Guardium Discover & Classify</p>
      </div>

      {/* DSAR Request Form */}
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

        <form onSubmit={submitDSAR} className="space-y-4">
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
              disabled={!isFormValid || dsarSubmitted}
              className="flex-1 bg-ibm-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            >
              {showProcessing ? 'Processing...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={resetDemo}
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
        {dsarSubmitted && (
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

      {/* IBM Guardium DSPM Dashboard */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">IBM Guardium DSPM - Discovery Scan</h3>
          <button
            onClick={startScan}
            disabled={scanning}
            className="bg-ibm-blue text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-all"
          >
            {scanning ? 'Scanning...' : 'Start Discovery Scan'}
          </button>
        </div>

        {/* Scan Progress */}
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Scanning databases...</span>
              <span className="text-sm font-semibold text-ibm-blue">{scanProgress}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-ibm-blue"
                initial={{ width: 0 }}
                animate={{ width: `${scanProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {/* Database List */}
        <div className="grid grid-cols-1 gap-3">
          {databases.map((db, index) => (
            <motion.div
              key={db.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: scanProgress > (index / databases.length) * 100 ? 1 : 0.3,
                x: 0,
              }}
              className={`p-4 border-2 rounded-lg transition-all ${
                scanProgress > (index / databases.length) * 100
                  ? 'border-ibm-green bg-ibm-green bg-opacity-5'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl ${
                    scanProgress > (index / databases.length) * 100 ? 'text-ibm-green' : 'text-gray-400'
                  }`}>
                    {scanProgress > (index / databases.length) * 100 ? '✓' : '○'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{db.name}</div>
                    <div className="text-sm text-gray-600">
                      {db.records.toLocaleString()} records • {db.sensitiveFields} sensitive fields
                    </div>
                  </div>
                </div>
                {scanProgress > (index / databases.length) * 100 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-3 py-1 bg-ibm-green text-white text-xs font-semibold rounded-full"
                  >
                    Scanned
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Discovery Results */}
      <AnimatePresence>
        {scanComplete && discoveredData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Discovery Results</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-6 bg-ibm-blue bg-opacity-10 rounded-xl">
                <div className="text-4xl font-bold text-ibm-blue mb-2">
                  {discoveredData.databases}
                </div>
                <div className="text-sm font-semibold text-gray-700">Databases Scanned</div>
              </div>
              <div className="text-center p-6 bg-ibm-green bg-opacity-10 rounded-xl">
                <div className="text-4xl font-bold text-ibm-green mb-2">
                  {discoveredData.sensitiveFields}
                </div>
                <div className="text-sm font-semibold text-gray-700">Sensitive Fields</div>
              </div>
              <div className="text-center p-6 bg-purple-100 rounded-xl">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {(discoveredData.totalRecords / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm font-semibold text-gray-700">Total Records</div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Sensitive Data Categories Found:</h4>
              <div className="flex flex-wrap gap-2">
                {sensitiveFields.slice(0, 8).map((field) => (
                  <span
                    key={field}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={downloadReport}
              className="w-full bg-ibm-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <span>📥</span>
              Download DSAR Report
            </button>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
              <strong>DPDP Act Section §11 - Rights of Data Principal:</strong> ✓ Compliant
              <br />
              Complete visibility into personal data storage enables rapid DSAR response.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Stage2Discovery;

// Made with Bob
