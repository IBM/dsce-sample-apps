import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ConsentState {
  identityVerification: boolean;
  serviceEnrollment: boolean;
  marketing: boolean;
  timestamp?: string;
}

interface DemoContextType {
  // Stage 1 - Consent
  consents: ConsentState;
  setConsents: (consents: ConsentState) => void;
  
  // Stage 2 - Discovery
  discoveredRecords: number;
  setDiscoveredRecords: (count: number) => void;
  
  // Stage 3 - Masking
  maskingEnabled: boolean;
  setMaskingEnabled: (enabled: boolean) => void;
  
  // Stage 4 - Encryption
  encryptedData: string[];
  addEncryptedData: (data: string) => void;
  
  // Stage 5 - Breach
  breachDetected: boolean;
  setBreachDetected: (detected: boolean) => void;
  
  // Stage 6 - Compliance
  complianceScore: number;
  updateComplianceScore: () => void;
  
  // Toast notifications
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const useDemoContext = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemoContext must be used within DemoProvider');
  }
  return context;
};

interface DemoProviderProps {
  children: ReactNode;
}

export const DemoProvider: React.FC<DemoProviderProps> = ({ children }) => {
  const [consents, setConsents] = useState<ConsentState>({
    identityVerification: false,
    serviceEnrollment: false,
    marketing: false,
  });
  
  const [discoveredRecords, setDiscoveredRecords] = useState(0);
  const [maskingEnabled, setMaskingEnabled] = useState(false);
  const [encryptedData, setEncryptedData] = useState<string[]>([]);
  const [breachDetected, setBreachDetected] = useState(false);
  const [complianceScore, setComplianceScore] = useState(0);

  const addEncryptedData = (data: string) => {
    setEncryptedData(prev => [...prev, data]);
  };

  const updateComplianceScore = () => {
    let score = 0;
    
    // Consent score (20 points)
    if (consents.identityVerification || consents.serviceEnrollment || consents.marketing) {
      score += 20;
    }
    
    // Discovery score (20 points)
    if (discoveredRecords > 0) {
      score += 20;
    }
    
    // Masking score (20 points)
    if (maskingEnabled) {
      score += 20;
    }
    
    // Encryption score (20 points)
    if (encryptedData.length > 0) {
      score += 20;
    }
    
    // Breach response score (20 points)
    if (breachDetected) {
      score += 20;
    }
    
    setComplianceScore(score);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    // This will be implemented with a toast component
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  const value: DemoContextType = {
    consents,
    setConsents,
    discoveredRecords,
    setDiscoveredRecords,
    maskingEnabled,
    setMaskingEnabled,
    encryptedData,
    addEncryptedData,
    breachDetected,
    setBreachDetected,
    complianceScore,
    updateComplianceScore,
    showToast,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

// Made with Bob
