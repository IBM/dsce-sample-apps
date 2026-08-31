import React, { useState, useEffect } from 'react';
import './RAGToggle.css';

function RAGToggle({ isEnabled, onToggle }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  const processingSteps = [
    'Preparing product documents...',
    'Chunking data...',
    'Embedding vectors...',
    'Ready!'
  ];

  useEffect(() => {
    if (isEnabled && !isProcessing) {
      // Simulate RAG initialization process
      setIsProcessing(true);
      setProcessingStep(0);

      const stepInterval = setInterval(() => {
        setProcessingStep((prev) => {
          if (prev < processingSteps.length - 1) {
            return prev + 1;
          } else {
            clearInterval(stepInterval);
            setTimeout(() => setIsProcessing(false), 800);
            return prev;
          }
        });
      }, 1200);

      return () => clearInterval(stepInterval);
    }
  }, [isEnabled]);

  const handleToggle = () => {
    if (!isProcessing) {
      onToggle(!isEnabled);
    }
  };

  return (
    <div className="rag-toggle-container">
      <div className="rag-toggle-wrapper">
        <label className="rag-toggle-label">
          <span className="rag-toggle-text">Integrate RAG Intelligence</span>
          <div 
            className={`rag-toggle-switch ${isEnabled ? 'enabled' : ''} ${isProcessing ? 'processing' : ''}`}
            onClick={handleToggle}
          >
            <div className="rag-toggle-slider">
              <div className="rag-toggle-icon">
                {isProcessing ? (
                  <svg className="rag-spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                ) : isEnabled ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </label>
      </div>

      {isProcessing && (
        <div className="rag-processing-status">
          <div className="rag-processing-bar">
            <div 
              className="rag-processing-fill"
              style={{ width: `${((processingStep + 1) / processingSteps.length) * 100}%` }}
            />
          </div>
          <div className="rag-processing-text">
            {processingSteps[processingStep]}
          </div>
        </div>
      )}
    </div>
  );
}

export default RAGToggle;


