import React, { useState } from 'react';
import {
  Form,
  NumberInput,
  Button,
  InlineNotification,
  Tile
} from '@carbon/react';
import { Calculator } from '@carbon/react/icons';
import './LoanCalculator.css';

const LoanCalculator = () => {
  const [loanAmount, setLoanAmount] = useState(100000);
  const [interestRate, setInterestRate] = useState(5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [error, setError] = useState('');

  const [results, setResults] = useState({
    monthlyPayment: null,
    totalInterest: null,
    totalPayment: null,
  });

  const handleCalculate = (e) => {
    e.preventDefault();
    setError('');
    
    // Basic Validation
    if (!loanAmount || !interestRate || !loanTerm || loanAmount <= 0 || interestRate <= 0 || loanTerm <= 0) {
      setError('Please fill in all fields with positive values.');
      setResults({ monthlyPayment: null, totalInterest: null, totalPayment: null });
      return;
    }

    // Calculation Logic
    const principal = parseFloat(loanAmount);
    const annualRate = parseFloat(interestRate) / 100;
    const monthlyRate = annualRate / 12;
    const numberOfPayments = parseFloat(loanTerm) * 12;

    let monthlyPayment;
    if (monthlyRate === 0) { // Handle interest-free loans
      monthlyPayment = principal / numberOfPayments;
    } else {
      monthlyPayment =
        principal *
        (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }
    
    const totalPayment = monthlyPayment * numberOfPayments;
    const totalInterest = totalPayment - principal;

    setResults({
      monthlyPayment: monthlyPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      totalPayment: totalPayment.toFixed(2),
    });
  };

  return (
    <div className="calculator-container">
      <div className="calculator-header">
        <h1>Loan Calculator</h1>
        <p>Estimate your monthly loan payments.</p>
      </div>
      <div className="calculator-layout">
        <Form onSubmit={handleCalculate} className="calculator-form">
          <NumberInput
            id="loanAmount"
            label="Loan Amount ($)"
            value={loanAmount}
            onChange={(e, { value }) => setLoanAmount(value)}
            min={1}
            step={1}
            invalidText="Invalid amount"
          />
          <NumberInput
            id="interestRate"
            label="Annual Interest Rate (%)"
            value={interestRate}
            onChange={(e, { value }) => setInterestRate(value)}
            min={0.1}
            step={0.1}
            invalidText="Invalid rate"
          />
          <NumberInput
            id="loanTerm"
            label="Loan Term (Years)"
            value={loanTerm}
            onChange={(e, { value }) => setLoanTerm(value)}
            min={1}
            step={1}
            invalidText="Invalid term"
          />

          {error && (
            <InlineNotification
              kind="error"
              title="Calculation Error"
              subtitle={error}
              hideCloseButton
            />
          )}

          <Button type="submit" renderIcon={Calculator}>
            Calculate
          </Button>
        </Form>
        
        <Tile className="results-card">
          <h2>Your Estimated Results</h2>
          {results.monthlyPayment !== null ? (
            <div className="results-content">
              <div className="result-item">
                <p className="result-label">Monthly Payment</p>
                <p className="monthly-payment-value">
                  ${parseFloat(results.monthlyPayment).toLocaleString('en-US')}
                </p>
              </div>
              <hr />
              <div className="result-item">
                <p className="result-label">Total Principal Paid</p>
                <p className="result-value">
                  ${parseFloat(loanAmount).toLocaleString('en-US')}
                </p>
              </div>
              <div className="result-item">
                <p className="result-label">Total Interest Paid</p>
                <p className="result-value">
                  ${parseFloat(results.totalInterest).toLocaleString('en-US')}
                </p>
              </div>
              <div className="result-item total-payment-item">
                <p className="result-label">Total of All Payments</p>
                <p className="result-value">
                  ${parseFloat(results.totalPayment).toLocaleString('en-US')}
                </p>
              </div>
            </div>
          ) : (
            <p className="no-results-text">
              Enter your loan details and click "Calculate" to see your results.
            </p>
          )}
        </Tile>
      </div>
    </div>
  );
};

export default LoanCalculator;