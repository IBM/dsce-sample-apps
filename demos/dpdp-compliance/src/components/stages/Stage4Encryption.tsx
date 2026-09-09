import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Stage4EncryptionProps {
  onEncryptionChange?: (encrypted: boolean) => void;
}

const Stage4Encryption: React.FC<Stage4EncryptionProps> = ({ onEncryptionChange }) => {
  const [inputText, setInputText] = useState('');
  const [encryptedText, setEncryptedText] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [keyRotationProgress, setKeyRotationProgress] = useState(0);
  const [showKeyRotation, setShowKeyRotation] = useState(false);

  const keys = [
    { id: 'national-id-key-v1', algorithm: 'AES-256', status: 'Active', lastRotation: '2026-01-15', nextRotation: '2026-04-15' },
    { id: 'tax-id-key-v1', algorithm: 'AES-256', status: 'Active', lastRotation: '2026-02-01', nextRotation: '2026-05-01' },
    { id: 'reference-key-v1', algorithm: 'AES-256', status: 'Active', lastRotation: '2026-01-20', nextRotation: '2026-04-20' },
  ];

  const simpleEncrypt = (text: string): string => {
    return btoa(text).split('').reverse().join('') + '==';
  };

  const simpleDecrypt = (text: string): string => {
    try {
      const cleaned = text.replace(/=+$/, '');
      return atob(cleaned.split('').reverse().join(''));
    } catch {
      return 'Invalid encrypted text';
    }
  };

  const handleEncrypt = () => {
    if (inputText) {
      const encrypted = simpleEncrypt(inputText);
      setEncryptedText(encrypted);
      setIsEncrypted(true);
      if (onEncryptionChange) {
        onEncryptionChange(true);
      }
    }
  };

  const handleDecrypt = () => {
    if (encryptedText) {
      const decrypted = simpleDecrypt(encryptedText);
      setInputText(decrypted);
      setIsEncrypted(false);
      if (onEncryptionChange) {
        onEncryptionChange(false);
      }
    }
  };

  const handleReset = () => {
    setInputText('');
    setEncryptedText('');
    setIsEncrypted(false);
  };

  const startKeyRotation = () => {
    setShowKeyRotation(true);
    setKeyRotationProgress(0);

    const interval = setInterval(() => {
      setKeyRotationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setShowKeyRotation(false), 2000);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* KPMG DPDPA Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 shadow-lg text-white text-center">
        <h2 className="text-2xl font-bold mb-2">DPDP Compliance Demo</h2>
        <p className="text-lg opacity-90">Powered by IBM Vault</p>
      </div>

      {/* Encryption/Decryption Simulator */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">IBM Vault - Encryption Simulator</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Plain Text Input
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter sensitive data to encrypt (e.g., National ID: 1234 5678 9012)"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none font-mono text-sm"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleEncrypt}
              disabled={!inputText || isEncrypted}
              className="flex-1 bg-ibm-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition-all flex items-center justify-center gap-2"
            >
              <span>🔒</span>
              Encrypt with AES-256
            </button>
            <button
              onClick={handleDecrypt}
              disabled={!encryptedText || !isEncrypted}
              className="flex-1 bg-ibm-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 transition-all flex items-center justify-center gap-2"
            >
              <span>🔓</span>
              Decrypt
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:border-gray-400 transition-all"
            >
              Reset
            </button>
          </div>

          <AnimatePresence>
            {encryptedText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Encrypted Output
                </label>
                <div className="relative">
                  <textarea
                    value={encryptedText}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-ibm-green bg-ibm-green bg-opacity-5 rounded-lg font-mono text-sm"
                    rows={3}
                  />
                  <div className="absolute top-2 right-2 px-3 py-1 bg-ibm-green text-white text-xs font-semibold rounded-full">
                    AES-256 Encrypted
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Key Management Dashboard */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Encryption Key Management</h3>
          <button
            onClick={startKeyRotation}
            disabled={showKeyRotation}
            className="bg-ibm-blue text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-all"
          >
            {showKeyRotation ? 'Rotating...' : 'Rotate Keys'}
          </button>
        </div>

        <div className="space-y-3">
          {keys.map((key, index) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-ibm-blue transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl">🔑</div>
                    <div>
                      <div className="font-semibold text-gray-900">{key.id}</div>
                      <div className="text-sm text-gray-600">{key.algorithm}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Last Rotation:</span>
                      <span className="ml-2 font-medium">{key.lastRotation}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Next Rotation:</span>
                      <span className="ml-2 font-medium">{key.nextRotation}</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-ibm-green text-white text-sm font-semibold rounded-full">
                  {key.status}
                </div>
              </div>

              {showKeyRotation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Rotation Progress</span>
                    <span className="text-sm font-semibold text-ibm-blue">{keyRotationProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-ibm-blue"
                      initial={{ width: 0 }}
                      animate={{ width: `${keyRotationProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Key Rotation Timeline */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="font-bold text-gray-900 mb-4">90-Day Key Rotation Cycle</h4>
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
          
          <div className="space-y-6">
            {[
              { date: '2026-01-15', event: 'Key Created', status: 'completed' },
              { date: '2026-02-15', event: '30-Day Check', status: 'completed' },
              { date: '2026-03-15', event: '60-Day Check', status: 'completed' },
              { date: '2026-04-15', event: 'Key Rotation Due', status: 'active' },
              { date: '2026-07-15', event: 'Next Rotation', status: 'upcoming' },
            ].map((item, index) => (
              <div key={index} className="relative flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full border-4 z-10 ${
                  item.status === 'completed' ? 'bg-ibm-green border-ibm-green' :
                  item.status === 'active' ? 'bg-ibm-blue border-ibm-blue animate-pulse' :
                  'bg-white border-gray-300'
                }`}></div>
                <div className="flex-1 p-3 bg-gray-50 rounded-lg">
                  <div className="font-semibold text-gray-900">{item.event}</div>
                  <div className="text-sm text-gray-600">{item.date}</div>
                </div>
                {item.status === 'active' && (
                  <div className="px-3 py-1 bg-ibm-blue text-white text-xs font-semibold rounded-full">
                    Current
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-lg text-white font-mono text-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-ibm-green">●</span>
          <span className="font-semibold">Key Access Audit Log</span>
        </div>
        <div className="space-y-2">
          <div className="text-gray-400">
            [2026-03-15 14:23:45] <span className="text-ibm-blue">INFO</span> Key accessed: national-id-key-v1
          </div>
          <div className="text-gray-400">
            [2026-03-15 14:23:46] <span className="text-ibm-green">SUCCESS</span> Encryption operation completed
          </div>
          <div className="text-gray-400">
            [2026-03-15 14:23:47] <span className="text-ibm-blue">INFO</span> Key usage logged for compliance
          </div>
        </div>

        <div className="mt-6 p-4 bg-black bg-opacity-50 rounded-lg text-xs text-gray-400">
          <strong className="text-white">DPDP Act Section §8 - Security Safeguards:</strong> ✓ Compliant
          <br />
          Centralized key management ensures data remains unreadable without proper decryption keys.
        </div>
      </div>
    </div>
  );
};

export default Stage4Encryption;

// Made with Bob
