import { Stage } from './types';

export const stages: Stage[] = [
  {
    id: 1,
    name: 'Consent',
    status: 'active',
    product: {
      name: 'IBM Verify',
      logo: '🔐',
      description: 'Identity and Access Management solution for secure consent capture and management'
    },
    personas: [
      { name: 'Priya Sharma', role: 'Customer / Data Principal', avatar: '👩‍💼' }
    ],
    story: {
      title: 'Customer Consent Captured',
      description: 'Priya opens the service portal and provides explicit consent for identity verification and service enrollment. Marketing communications remain unchecked, respecting her privacy preferences.',
      dpdpSection: 'DPDP Act - Consent Requirements',
      impact: 'Consent preferences are stored in IBM Verify and propagated to all downstream systems, ensuring compliance across the entire data lifecycle.'
    }
  },
  {
    id: 2,
    name: 'Discovery',
    status: 'upcoming',
    product: {
      name: 'IBM Guardium DSPM',
      logo: '🔍',
      description: 'Data Security Posture Management for discovering and classifying sensitive data'
    },
    personas: [
      { name: 'Arjun Mehta', role: 'Security Admin', avatar: '👨‍💻' },
      { name: 'Kavitha Iyer', role: 'Data Protection Officer', avatar: '👩‍⚖️' }
    ],
    story: {
      title: 'PII Discovery & DSAR Processing',
      description: 'Automated discovery scans identify 7 databases containing 34 sensitive fields across 2.3 million records. A Data Subject Access Request (DSAR) from customer PRI-8472 is received and processed.',
      dpdpSection: 'DPDP Act - Rights of Data Principal',
      impact: 'Complete visibility into personal data storage enables rapid DSAR response and ensures no PII is stored without proper classification and protection.'
    }
  },
  {
    id: 3,
    name: 'Protection',
    status: 'upcoming',
    product: {
      name: 'IBM Guardium Data Protection',
      logo: '🛡️',
      description: 'Real-time data activity monitoring and dynamic data masking'
    },
    personas: [
      { name: 'Ravi Kumar', role: 'Data Analyst', avatar: '👨‍💼' }
    ],
    story: {
      title: 'Dynamic Data Masking Applied',
      description: 'When Ravi queries customer data for analytics, sensitive fields like National ID and Tax ID numbers are automatically masked based on his role and access policies. He sees XXXX-XXXX-1234 instead of full numbers.',
      dpdpSection: 'DPDP Act - Security Safeguards',
      impact: 'Data protection policies ensure that analysts can perform their work while sensitive PII remains protected, reducing the risk of unauthorized exposure.'
    }
  },
  {
    id: 4,
    name: 'Encryption',
    status: 'upcoming',
    product: {
      name: 'IBM Vault',
      logo: '🔑',
      description: 'Enterprise key management and encryption services'
    },
    personas: [
      { name: 'Arjun Mehta', role: 'Security Admin', avatar: '👨‍💻' }
    ],
    story: {
      title: 'Encryption Key Management',
      description: 'All PII data at rest is encrypted using AES-256 keys managed by IBM Vault. The national-id-key-v1 undergoes automated rotation, ensuring cryptographic best practices are maintained.',
      dpdpSection: 'DPDP Act - Security Safeguards',
      impact: 'Centralized key management ensures that even if data is compromised, it remains unreadable without proper decryption keys, meeting regulatory encryption requirements.'
    }
  },
  {
    id: 5,
    name: 'Breach Detection',
    status: 'upcoming',
    product: {
      name: 'IBM QRadar SIEM',
      logo: '🚨',
      description: 'Security Information and Event Management for threat detection'
    },
    personas: [
      { name: 'Ravi Kumar', role: 'Data Analyst', avatar: '👨‍💼' },
      { name: 'Arjun Mehta', role: 'Security Admin', avatar: '👨‍💻' },
      { name: 'Kavitha Iyer', role: 'Data Protection Officer', avatar: '👩‍⚖️' }
    ],
    story: {
      title: 'Critical Breach Detected & Contained',
      description: 'At 23:47, Ravi attempts to export 48,234 customer records - 847x above his baseline activity. Within 32 seconds, QRadar triggers a critical incident (INC-2024-0891), automatically terminates the session, revokes access, and isolates the endpoint.',
      dpdpSection: 'DPDP Act - Breach Notification',
      impact: 'Automated breach detection and response prevents data exfiltration. The DPO is immediately notified to assess if the 72-hour breach notification requirement to authorities is triggered.'
    }
  },
  {
    id: 6,
    name: 'Compliance',
    status: 'upcoming',
    product: {
      name: 'IBM OpenPages',
      logo: '✅',
      description: 'GRC platform for compliance management and reporting'
    },
    personas: [
      { name: 'Kavitha Iyer', role: 'Data Protection Officer', avatar: '👩‍⚖️' }
    ],
    story: {
      title: 'Compliance Dashboard & Reporting',
      description: 'The DPO reviews the comprehensive compliance dashboard showing: Consent Controls (98%), Protection Controls (95%), Encryption Status (100%), Breach Response (92%), and Rights Requests (94%). Overall DPDP compliance score: 92%.',
      dpdpSection: 'DPDP Act - Overall Compliance',
      impact: 'Automated compliance reporting provides board-level visibility into DPDP adherence, identifies gaps, and generates audit-ready documentation for regulatory reviews.'
    }
  },
  {
    id: 7,
    name: 'Agentic AI',
    status: 'upcoming',
    product: {
      name: 'IBM watsonx Orchestrate',
      logo: '🤖',
      description: 'AI-powered automation platform for intelligent task orchestration'
    },
    personas: [
      { name: 'Priya Sharma', role: 'Customer / Data Principal', avatar: '👩‍💼' },
      { name: 'Arjun Mehta', role: 'Security Admin', avatar: '👨‍💻' },
      { name: 'Shikha Kamboj', role: 'Data Protection Officer', avatar: '👩‍⚖️' }
    ],
    story: {
      title: 'Automated DPDPA Compliance with Agentic AI',
      description: 'The ASK DPDPA master agent orchestrates specialized sub-agents (Consent Agent, Data Protection Agent, Data Discover & Classify Agent, Compliance Agent) to automate manual compliance tasks through conversational AI interfaces.',
      dpdpSection: 'DPDP Act - Automated Compliance',
      impact: 'Agentic AI reduces manual effort by 80%, accelerates DSAR response time from days to minutes, and ensures consistent compliance through intelligent automation and tool orchestration.'
    }
  }
];

// Made with Bob
