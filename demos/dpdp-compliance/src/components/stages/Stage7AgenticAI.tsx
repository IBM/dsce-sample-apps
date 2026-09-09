import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WatsonxIcon } from '../WatsonxIcon';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
  toolExecution?: {
    tool: string;
    status: string;
    response: any;
  };
}

interface ChatbotProps {
  persona: {
    name: string;
    role: string;
    avatar: string;
  };
  personaType: 'user' | 'security' | 'dpo';
}

const Chatbot: React.FC<ChatbotProps> = ({ persona, personaType }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: personaType === 'user' 
        ? 'Hello! I am your ASK DPDPA assistant. How may I help you today?'
        : 'Hello! I am your ASK DPDPA assistant. How may I assist you?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(true);
  const [showForm, setShowForm] = useState<'dsar' | 'grievance' | null>(null);
  const [showExplainability, setShowExplainability] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<string>('initial');
  const [selectedDsarId, setSelectedDsarId] = useState<string>('');

  // Form states
  const [dsarForm, setDsarForm] = useState({
    firstName: '',
    lastName: '',
    customerId: '',
    requestType: '',
    requestDetails: ''
  });

  const [grievanceForm, setGrievanceForm] = useState({
    subject: '',
    description: ''
  });

  const addMessage = (text: string, sender: 'user' | 'agent', toolExecution?: any) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      sender,
      text,
      timestamp: new Date(),
      toolExecution
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleDropdownSelect = (option: string) => {
    setShowDropdown(false);
    addMessage(option, 'user');

    if (personaType === 'user') {
      if (option === 'Raise DSAR Request') {
        setShowForm('dsar');
        addMessage('Please fill out the DSAR request form below:', 'agent');
      } else if (option === 'Raise Grievance Form') {
        setShowForm('grievance');
        addMessage('Please fill out the grievance form below:', 'agent');
      }
    } else if (personaType === 'security') {
      if (option === 'Show me active DSAR requests') {
        setConversationState('show-dsar-list');
        setTimeout(() => {
          const toolExecution = {
            tool: 'get_active_dsar_requests',
            status: 'success',
            response: {
              requests: [
                { id: 'DSAR-2024-001', user: 'Priya Sharma', type: 'Data Access', date: '2024-06-01' },
                { id: 'DSAR-2024-002', user: 'Rahul Verma', type: 'Data Deletion', date: '2024-06-03' },
                { id: 'DSAR-2024-003', user: 'Anjali Patel', type: 'Data Portability', date: '2024-06-05' },
                { id: 'DSAR-2024-004', user: 'Vikram Singh', type: 'Data Access', date: '2024-06-07' }
              ]
            }
          };
          addMessage(
            'Here are the active DSAR requests:\n\n' +
            '1. DSAR-2024-001 - Priya Sharma (Data Access) - 2024-06-01\n' +
            '2. DSAR-2024-002 - Rahul Verma (Data Deletion) - 2024-06-03\n' +
            '3. DSAR-2024-003 - Anjali Patel (Data Portability) - 2024-06-05\n' +
            '4. DSAR-2024-004 - Vikram Singh (Data Access) - 2024-06-07\n\n' +
            'Please type the DSAR ID you would like to process.',
            'agent',
            toolExecution
          );
        }, 1000);
      } else if (option === 'Scan all systems and get DSAR report') {
        handleScanAndReport();
      } else if (option === 'Send DSAR report to user in email') {
        handleSendEmail();
      }
    } else if (personaType === 'dpo') {
      if (option === 'View top 3 breaches list') {
        setTimeout(() => {
          const toolExecution = {
            tool: 'get_top_breaches',
            status: 'success',
            response: {
              breaches: [
                { id: 'BR-2024-089', date: '2024-05-28', records: 15420, severity: 'Critical', status: 'Under Investigation' },
                { id: 'BR-2024-076', date: '2024-05-15', records: 8930, severity: 'High', status: 'Remediated' },
                { id: 'BR-2024-063', date: '2024-05-02', records: 5210, severity: 'High', status: 'Closed' }
              ]
            }
          };
          addMessage(
            'Here are the top 3 breaches:\n\n' +
            '1. BR-2024-089 - Date: 2024-05-28, Affected Records: 15,420, Severity: Critical, Status: Under Investigation\n' +
            '2. BR-2024-076 - Date: 2024-05-15, Affected Records: 8,930, Severity: High, Status: Remediated\n' +
            '3. BR-2024-063 - Date: 2024-05-02, Affected Records: 5,210, Severity: High, Status: Closed',
            'agent',
            toolExecution
          );
          setShowDropdown(true);
        }, 1000);
      } else if (option === 'View breach details') {
        const toolExecution = {
          tool: 'get_breach_details',
          status: 'success',
          response: {
            breach_id: 'BR-2024-089',
            details: {
              attack_vector: 'SQL Injection',
              affected_systems: ['Customer DB', 'Payment Gateway'],
              data_types: ['PII', 'Financial Data'],
              mitigation_steps: ['Patched vulnerability', 'Reset credentials', 'Enhanced monitoring']
            }
          }
        };
        addMessage(
          'Breach Details for BR-2024-089:\n\n' +
          'Attack Vector: SQL Injection\n' +
          'Affected Systems: Customer DB, Payment Gateway\n' +
          'Data Types Compromised: PII, Financial Data\n' +
          'Mitigation Steps: Patched vulnerability, Reset credentials, Enhanced monitoring',
          'agent',
          toolExecution
        );
      } else if (option === 'Generate compliance report') {
        const toolExecution = {
          tool: 'generate_compliance_report',
          status: 'success',
          response: {
            report_id: 'RPT-2024-156',
            format: 'PDF',
            sections: ['Executive Summary', 'Breach Analysis', 'Remediation Actions', 'Compliance Status']
          }
        };
        addMessage(
          'Compliance report generated successfully!\n\n' +
          'Report ID: RPT-2024-156\n' +
          'Format: PDF\n' +
          'Sections: Executive Summary, Breach Analysis, Remediation Actions, Compliance Status\n\n' +
          'The report has been saved to your dashboard.',
          'agent',
          toolExecution
        );
      } else if (option === 'Initiate breach notification workflow') {
        const toolExecution = {
          tool: 'initiate_notification_workflow',
          status: 'success',
          response: {
            workflow_id: 'WF-2024-089',
            notifications: ['Data Board', 'Affected Users', 'Regulatory Authority'],
            status: 'Initiated'
          }
        };
        addMessage(
          'Breach notification workflow initiated!\n\n' +
          'Workflow ID: WF-2024-089\n' +
          'Notifications will be sent to: Data Board, Affected Users, Regulatory Authority\n' +
          'Status: Initiated\n\n' +
          'You will receive updates as notifications are sent.',
          'agent',
          toolExecution
        );
      }
    }
  };

  const handleScanAndReport = () => {
    addMessage('Scanning all databases for sensitive PII data and generating DSAR report...', 'agent');
    setTimeout(() => {
      const toolExecution = {
        tool: 'scan_and_generate_dsar_report',
        status: 'success',
        response: {
          scan_results: {
            databases_scanned: 12,
            records_found: 847,
            pii_types: ['Name', 'Email', 'Phone', 'Address', 'Aadhaar Card', 'PAN Card'],
            report_generated: true
          }
        }
      };
      addMessage(
        'DSAR report generated successfully!\n\n' +
        'Databases Scanned: 12\n' +
        'Records Found: 847\n' +
        'PII Types: Name, Email, Phone, Address, Aadhaar Card, PAN Card\n\n' +
        'Would you like me to send the report to the user via email?',
        'agent',
        toolExecution
      );
      setConversationState('ask-send-email');
      setShowDropdown(true);
    }, 2000);
  };

  const handleSendEmail = () => {
    addMessage('Sending DSAR report to user via email...', 'agent');
    setTimeout(() => {
      const toolExecution = {
        tool: 'send_dsar_report_email',
        status: 'success',
        response: {
          email_sent: true,
          recipient: 'user@example.com',
          timestamp: new Date().toISOString()
        }
      };
      addMessage(
        'Report has been successfully emailed to the user!\n\n' +
        'Recipient: user@example.com\n' +
        'Timestamp: ' + new Date().toLocaleString(),
        'agent',
        toolExecution
      );
      setConversationState('initial');
      setShowDropdown(true);
    }, 1500);
  };

  const handleDsarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowForm(null);
    addMessage('DSAR request submitted successfully!', 'agent');
    addMessage(
      `Your DSAR request has been received and is being processed.\n\n` +
      `Request Details:\n` +
      `Name: ${dsarForm.firstName} ${dsarForm.lastName}\n` +
      `Customer ID: ${dsarForm.customerId}\n` +
      `Request Type: ${dsarForm.requestType}\n\n` +
      `You will receive a confirmation email shortly.`,
      'agent'
    );
    setDsarForm({ firstName: '', lastName: '', customerId: '', requestType: '', requestDetails: '' });
    setShowDropdown(true);
  };

  const handleGrievanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowForm(null);
    addMessage('Grievance submitted successfully!', 'agent');
    addMessage(
      `Your grievance has been recorded and will be reviewed by our team.\n\n` +
      `Subject: ${grievanceForm.subject}\n\n` +
      `You will receive a response within 48 hours.`,
      'agent'
    );
    setGrievanceForm({ subject: '', description: '' });
    setShowDropdown(true);
  };

  const handleUserInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    addMessage(inputValue, 'user');
    const input = inputValue.trim();
    setInputValue('');

    if (personaType === 'security' && conversationState === 'show-dsar-list') {
      if (input.match(/DSAR-2024-\d{3}/)) {
        setSelectedDsarId(input);
        setConversationState('ask-generate-report');
        addMessage(
          `Would you like me to get the DSAR report for ${input}?`,
          'agent'
        );
        setShowDropdown(true);
      }
    }
  };

  const getDropdownOptions = () => {
    if (personaType === 'user') {
      return ['Raise DSAR Request', 'Raise Grievance Form'];
    } else if (personaType === 'security') {
      if (conversationState === 'ask-generate-report') {
        return ['Yes, generate DSAR report', 'No, cancel'];
      } else if (conversationState === 'ask-send-email') {
        return ['Yes, send email', 'No, cancel'];
      }
      return ['Show me active DSAR requests', 'Scan all systems and get DSAR report', 'Send DSAR report to user in email'];
    } else if (personaType === 'dpo') {
      return ['View top 3 breaches list', 'View breach details', 'Generate compliance report', 'Initiate breach notification workflow'];
    }
    return [];
  };

  const handleSecurityDropdownSelect = (option: string) => {
    setShowDropdown(false);
    addMessage(option, 'user');

    if (option === 'Yes, generate DSAR report') {
      handleScanAndReport();
    } else if (option === 'Yes, send email') {
      handleSendEmail();
    } else if (option === 'No, cancel') {
      addMessage('Operation cancelled.', 'agent');
      setConversationState('initial');
      setShowDropdown(true);
    } else {
      handleDropdownSelect(option);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 h-[600px] flex flex-col">
      {/* Persona Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
        <div className="text-4xl">{persona.avatar}</div>
        <div>
          <h3 className="font-semibold text-gray-900">{persona.name}</h3>
          <p className="text-sm text-gray-600">{persona.role}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-3`}>
                <p className="text-sm whitespace-pre-line">{message.text}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
                {message.toolExecution && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <button
                      onClick={() => setShowExplainability(showExplainability === message.id ? null : message.id)}
                      className="text-xs bg-white text-gray-900 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      {showExplainability === message.id ? '🔽 Hide' : '🔍 Show'} Tool Execution
                    </button>
                    {showExplainability === message.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 bg-gray-900 text-green-400 p-2 rounded text-xs font-mono overflow-x-auto"
                      >
                        <div className="mb-1">
                          <span className="text-yellow-400">Tool:</span> {message.toolExecution.tool}
                        </div>
                        <div className="mb-1">
                          <span className="text-yellow-400">Status:</span> {message.toolExecution.status}
                        </div>
                        <div>
                          <span className="text-yellow-400">Response:</span>
                          <pre className="mt-1 whitespace-pre-wrap">
                            {JSON.stringify(message.toolExecution.response, null, 2)}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Dropdown Menu */}
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
          >
            <p className="text-sm text-gray-600 mb-2">Quick Actions:</p>
            <div className="space-y-2">
              {getDropdownOptions().map((option, index) => (
                <button
                  key={index}
                  onClick={() => personaType === 'security' && (conversationState === 'ask-generate-report' || conversationState === 'ask-send-email')
                    ? handleSecurityDropdownSelect(option)
                    : handleDropdownSelect(option)}
                  className="w-full text-left px-3 py-2 bg-white hover:bg-blue-50 rounded border border-gray-200 text-sm transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* DSAR Form */}
        {showForm === 'dsar' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
          >
            <form onSubmit={handleDsarSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={dsarForm.firstName}
                  onChange={(e) => setDsarForm({ ...dsarForm, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={dsarForm.lastName}
                  onChange={(e) => setDsarForm({ ...dsarForm, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                <input
                  type="text"
                  required
                  value={dsarForm.customerId}
                  onChange={(e) => setDsarForm({ ...dsarForm, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
                <select
                  required
                  value={dsarForm.requestType}
                  onChange={(e) => setDsarForm({ ...dsarForm, requestType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select type</option>
                  <option value="Data Access">Data Access</option>
                  <option value="Data Deletion">Data Deletion</option>
                  <option value="Data Portability">Data Portability</option>
                  <option value="Data Correction">Data Correction</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Details</label>
                <textarea
                  required
                  value={dsarForm.requestDetails}
                  onChange={(e) => setDsarForm({ ...dsarForm, requestDetails: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Submit DSAR Request
              </button>
            </form>
          </motion.div>
        )}

        {/* Grievance Form */}
        {showForm === 'grievance' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
          >
            <form onSubmit={handleGrievanceSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={grievanceForm.subject}
                  onChange={(e) => setGrievanceForm({ ...grievanceForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  value={grievanceForm.description}
                  onChange={(e) => setGrievanceForm({ ...grievanceForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={4}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Submit Grievance
              </button>
            </form>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      {conversationState === 'show-dsar-list' && (
        <form onSubmit={handleUserInput} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type DSAR ID (e.g., DSAR-2024-001)..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
};

const Stage7AgenticAI: React.FC = () => {
  const personas = [
    { name: 'Priya Sharma', role: 'Customer / Data Principal', avatar: '👩‍💼', type: 'user' as const },
    { name: 'Arjun Mehta', role: 'Security Admin', avatar: '👨‍💻', type: 'security' as const },
    { name: 'Shikha Kamboj', role: 'Data Protection Officer', avatar: '👩‍⚖️', type: 'dpo' as const }
  ];

  return (
    <div className="space-y-6">
      {/* KPMG Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-2">DPDP Compliance Demo</h2>
        <p className="text-blue-100">Powered by IBM watsonx Orchestrate</p>
      </div>

      {/* Master Agent Description */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
        <div className="flex items-center gap-3 mb-3">
          <WatsonxIcon size={40} />
          <div>
            <h3 className="text-xl font-bold text-gray-900">ASK DPDPA Master Agent</h3>
            <p className="text-sm text-gray-600">Intelligent orchestration of specialized compliance agents</p>
          </div>
        </div>
        <p className="text-gray-700 mb-3">
          The ASK DPDPA master agent coordinates specialized sub-agents to automate DPDPA compliance tasks:
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-lg border border-purple-200">
            <div className="font-semibold text-purple-900 mb-1">🔐 Consent Agent</div>
            <p className="text-xs text-gray-600">Manages consent workflows and DSAR requests</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-purple-200">
            <div className="font-semibold text-purple-900 mb-1">🛡️ Data Protection Agent</div>
            <p className="text-xs text-gray-600">Handles data security and encryption tasks</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-purple-200">
            <div className="font-semibold text-purple-900 mb-1">🔍 Data Discover & Classify Agent</div>
            <p className="text-xs text-gray-600">Scans and classifies sensitive data across systems</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-purple-200">
            <div className="font-semibold text-purple-900 mb-1">📊 Compliance Agent</div>
            <p className="text-xs text-gray-600">Monitors compliance and generates reports</p>
          </div>
        </div>
      </div>

      {/* Chatbots Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {personas.map((persona) => (
          <Chatbot key={persona.name} persona={persona} personaType={persona.type} />
        ))}
      </div>
    </div>
  );
};

export default Stage7AgenticAI;

// Made with Bob
