import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BobIcon from './BobIcon';

interface Message {
  id: string;
  sender: 'user' | 'bob';
  text: string;
  timestamp: Date;
  isLoading?: boolean;
}

const BobAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bob',
      text: 'Hi! I\'m BOB, your Agentic SDLC partner! 👋\n\nI can help you create and deploy agents for your DPDP compliance needs. What would you like to do today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [showOptions, setShowOptions] = useState(true);
  const [conversationState, setConversationState] = useState<'initial' | 'creating' | 'deploy-confirm' | 'deployed'>('initial');
  const [currentAgentType, setCurrentAgentType] = useState<string>('');

  const agentOptions = [
    'Create Data Security Agent',
    'Create Compliance Monitoring Agent',
    'Create DSAR Processing Agent',
    'Create Breach Detection Agent'
  ];

  const addMessage = (text: string, sender: 'user' | 'bob', isLoading: boolean = false) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      sender,
      text,
      timestamp: new Date(),
      isLoading
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  const removeMessage = (id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };

  const handleOptionSelect = (option: string) => {
    setShowOptions(false);
    addMessage(option, 'user');
    setCurrentAgentType(option.replace('Create ', ''));
    
    // Show creating message
    setConversationState('creating');
    const loadingId = addMessage('Creating agent...', 'bob', true);
    
    // Simulate agent creation
    setTimeout(() => {
      removeMessage(loadingId);
      addMessage(
        `✅ ${option.replace('Create ', '')} created successfully!\n\n` +
        `Agent Configuration:\n` +
        `• Type: ${option.replace('Create ', '')}\n` +
        `• Framework: IBM watsonx Orchestrate\n` +
        `• Status: Ready for deployment\n\n` +
        `Would you like to deploy this agent?`,
        'bob'
      );
      setConversationState('deploy-confirm');
      setShowOptions(true);
    }, 2500);
  };

  const handleDeployConfirm = (confirm: boolean) => {
    setShowOptions(false);
    addMessage(confirm ? 'Yes, deploy the agent' : 'No, cancel deployment', 'user');
    
    if (confirm) {
      const loadingId = addMessage('Deploying agent...', 'bob', true);
      
      setTimeout(() => {
        removeMessage(loadingId);
        addMessage(
          `🚀 Agent deployed successfully on watsonx Orchestrate!\n\n` +
          `Deployment Details:\n` +
          `• Agent: ${currentAgentType}\n` +
          `• Status: Active\n` +
          `• Endpoint: https://api.dpdp-demo.com/agents/${currentAgentType.toLowerCase().replace(/\s+/g, '-')}\n\n` +
          `Your agent is now live and ready to handle DPDP compliance tasks!`,
          'bob'
        );
        setConversationState('deployed');
        
        // Reset after showing success
        setTimeout(() => {
          addMessage(
            'Great! Would you like to create another agent?',
            'bob'
          );
          setConversationState('initial');
          setShowOptions(true);
        }, 3000);
      }, 2000);
    } else {
      addMessage(
        'Deployment cancelled. The agent configuration has been saved for later.\n\n' +
        'Would you like to create a different agent?',
        'bob'
      );
      setConversationState('initial');
      setShowOptions(true);
    }
  };

  const handleUserInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    addMessage(inputValue, 'user');
    const userMessage = inputValue.toLowerCase();
    setInputValue('');

    // Handle deployment confirmation
    if (conversationState === 'deploy-confirm') {
      if (userMessage.includes('yes') || userMessage.includes('deploy')) {
        handleDeployConfirm(true);
      } else if (userMessage.includes('no') || userMessage.includes('cancel')) {
        handleDeployConfirm(false);
      } else {
        addMessage(
          'Please confirm if you want to deploy the agent. Type "yes" to deploy or "no" to cancel.',
          'bob'
        );
      }
      return;
    }

    // Simple keyword matching for agent creation
    if (userMessage.includes('security') || userMessage.includes('data security')) {
      handleOptionSelect('Create Data Security Agent');
    } else if (userMessage.includes('compliance') || userMessage.includes('monitor')) {
      handleOptionSelect('Create Compliance Monitoring Agent');
    } else if (userMessage.includes('dsar') || userMessage.includes('request')) {
      handleOptionSelect('Create DSAR Processing Agent');
    } else if (userMessage.includes('breach') || userMessage.includes('detect')) {
      handleOptionSelect('Create Breach Detection Agent');
    } else {
      addMessage(
        'I can help you create agents for DPDP compliance. Please select from the options below or describe what kind of agent you need.',
        'bob'
      );
      setShowOptions(true);
    }
  };

  const getQuickOptions = () => {
    if (conversationState === 'deploy-confirm') {
      return [
        { label: 'Yes, deploy the agent', action: () => handleDeployConfirm(true) },
        { label: 'No, cancel deployment', action: () => handleDeployConfirm(false) }
      ];
    } else if (conversationState === 'initial') {
      return agentOptions.map(option => ({
        label: option,
        action: () => handleOptionSelect(option)
      }));
    }
    return [];
  };

  return (
    <>
      {/* BOB Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <BobIcon size={48} className="drop-shadow-lg" />
      </motion.button>

      {/* BOB Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                  <BobIcon size={40} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">IBM BOB</h3>
                  <p className="text-xs text-blue-100">Agentic SDLC Platform</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] ${
                      message.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white text-gray-900 border border-gray-200'
                    } rounded-2xl p-3 shadow-sm`}>
                      {message.isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <motion.div
                              className="w-2 h-2 bg-blue-600 rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                            />
                            <motion.div
                              className="w-2 h-2 bg-blue-600 rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                            />
                            <motion.div
                              className="w-2 h-2 bg-blue-600 rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                            />
                          </div>
                          <span className="text-sm">{message.text}</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-line">{message.text}</p>
                          <p className={`text-xs mt-1 ${
                            message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Quick Options */}
              {showOptions && getQuickOptions().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-xs text-gray-500 font-medium">Quick Actions:</p>
                  {getQuickOptions().map((option, index) => (
                    <button
                      key={index}
                      onClick={option.action}
                      className="w-full text-left px-4 py-2 bg-white hover:bg-blue-50 rounded-lg border border-gray-200 text-sm transition-colors shadow-sm"
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
              <form onSubmit={handleUserInput} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BobAssistant;

// Made with Bob
