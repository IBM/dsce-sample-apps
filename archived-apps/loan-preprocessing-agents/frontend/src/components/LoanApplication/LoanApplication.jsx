import React, { useState, useEffect } from 'react';
import {
  Button,
  TextInput,
  Select,
  SelectItem,
  NumberInput,
  DatePicker,
  DatePickerInput,
  Checkbox,
  RadioButton,
  RadioButtonGroup,
  ProgressIndicator,
  ProgressStep,
  FormGroup,
  Heading,
  Section,
  Modal,
  Loading,
  FileUploader,
  Tile,
  InlineNotification
} from '@carbon/react';
import { User, Settings, Help, DocumentPdf, Document } from '@carbon/react/icons';
import { authFetch } from '../../services/api';

// Import the new CSS file
import './LoanApplication.css';

const LoanApplication = () => {
  const [applicationMode, setApplicationMode] = useState(null); // 'form' or 'pdf'
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedAppId, setSubmittedAppId] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState({
    applicationPdf: null,
    idProof: null,
    incomeProof: null,
    addressProof: null,
    additionalDocs: []
  });
  
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    ssn: '',
    maritalStatus: '',
    
    // Employment Information
    employmentStatus: '',
    employer: '',
    jobTitle: '',
    monthlyIncome: 0,
    employmentDuration: '',
    
    // Loan Information
    loanType: '',
    loanAmount: 0,
    loanPurpose: '',
    downPayment: 0,
    
    // Financial Information
    monthlyExpenses: 0,
    creditScore: '',
    bankingRelationship: false,
    hasOtherLoans: false,
    
    // Terms Agreement
    agreeToTerms: false,
    agreeToCredit: false
  });

  const [errors, setErrors] = useState({});

  const formSteps = [
    'Personal Information',
    'Employment Details',
    'Loan Information',
    'Financial Details',
    'Document Upload',
    'Review & Submit'
  ];

  const pdfSteps = [
    'Upload Application',
    'Supporting Documents',
    'Review & Submit'
  ];

  const steps = applicationMode === 'form' ? formSteps : pdfSteps;

  useEffect(() => {
    const fetchUserData = async () => {
      const apiUrl = import.meta.env.VITE_API_URL;
      try {
        const response = await authFetch(`${apiUrl}/users/me`);
        if (!response.ok) {
          throw new Error("Could not fetch user data.");
        }
        const userData = await response.json();
        
        // Pre-fill the form data with the fetched user details
        setFormData(prevData => ({
          ...prevData,
          // Map backend snake_case names to frontend camelCase names
          firstName: userData.first_name || '',
          lastName: userData.last_name || '',
          dateOfBirth: userData.date_of_birth ? new Date(userData.date_of_birth) : '',
        }));

      } catch (error) {
        console.error("Error pre-filling user data:", error);
      }
    };

    fetchUserData();
  }, []);

  const handleFileUpload = (fileType, files) => {
    if (files.length > 0) {
      if (fileType === 'additionalDocs') {
        const newFiles = Array.from(files);
        setUploadedFiles(prev => ({
          ...prev,
          additionalDocs: [...prev.additionalDocs, ...newFiles]
        }));
      } else {
        const file = files[0];
        setUploadedFiles(prev => ({
          ...prev,
          [fileType]: file
        }));
      }
    }
  };

  const removeFile = (fileType, index = null) => {
    if (fileType === 'additionalDocs' && index !== null) {
      setUploadedFiles(prev => ({
        ...prev,
        additionalDocs: prev.additionalDocs.filter((_, i) => i !== index)
      }));
    } else {
      setUploadedFiles(prev => ({
        ...prev,
        [fileType]: null
      }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    if (applicationMode === 'form') {
      switch(step) {
        case 0: // Personal Information
          if (!formData.firstName) newErrors.firstName = 'First name is required';
          if (!formData.lastName) newErrors.lastName = 'Last name is required';
          if (!formData.email) newErrors.email = 'Email is required';
          if (!formData.phone) newErrors.phone = 'Phone number is required';
          if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
          if (!formData.ssn) newErrors.ssn = 'SSN is required';
          if (!formData.maritalStatus) newErrors.maritalStatus = 'Marital status is required';
          break;
          
        case 1: // Employment
          if (!formData.employmentStatus) newErrors.employmentStatus = 'Employment status is required';
          if (!formData.employer) newErrors.employer = 'Employer is required';
          if (!formData.jobTitle) newErrors.jobTitle = 'Job title is required';
          if (!formData.monthlyIncome || formData.monthlyIncome <= 0) newErrors.monthlyIncome = 'Valid monthly income is required';
          break;
          
        case 2: // Loan Information
          if (!formData.loanType) newErrors.loanType = 'Loan type is required';
          if (!formData.loanAmount || formData.loanAmount <= 0) newErrors.loanAmount = 'Valid loan amount is required';
          if (!formData.loanPurpose) newErrors.loanPurpose = 'Loan purpose is required';
          break;
          
        case 3: // Financial Details
          if (formData.monthlyExpenses < 0) newErrors.monthlyExpenses = 'Monthly expenses is required';
          if (!formData.creditScore) newErrors.creditScore = 'Credit score range is required';
          break;
          
        case 4: // Document Upload
          if (!uploadedFiles.idProof) newErrors.idProof = 'ID proof is required';
          if (!uploadedFiles.incomeProof) newErrors.incomeProof = 'Income proof is required';
          if (!uploadedFiles.addressProof) newErrors.addressProof = 'Address proof is required';
          break;
          
        case 5: // Review & Submit
          if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to terms and conditions';
          if (!formData.agreeToCredit) newErrors.agreeToCredit = 'You must agree to credit check';
          break;
      }
    } else {
      switch(step) {
        case 0: // Upload Application
          if (!uploadedFiles.applicationPdf) newErrors.applicationPdf = 'Application PDF is required';
          break;
          
        case 1: // Supporting Documents
          if (!uploadedFiles.idProof) newErrors.idProof = 'ID proof is required';
          if (!uploadedFiles.incomeProof) newErrors.incomeProof = 'Income proof is required';
          if (!uploadedFiles.addressProof) newErrors.addressProof = 'Address proof is required';
          break;
          
        case 2: // Review & Submit
          if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to terms and conditions';
          if (!formData.agreeToCredit) newErrors.agreeToCredit = 'You must agree to credit check';
          break;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    // 1. Validate the current step's inputs first
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    const data = new FormData();
    let endpoint = '';
    const apiUrl = import.meta.env.VITE_API_URL;

    try {
        // 2. Build the FormData object based on the application mode
        if (applicationMode === 'form') {
            endpoint = `${apiUrl}/submit_form`;
            
            // Append the form field data as a single JSON string
            data.append('formDataJson', JSON.stringify(formData));

            // --- THIS IS THE COMPLETED FILE APPENDING LOGIC FOR 'FORM' MODE ---
            // Check if each file exists before appending to avoid errors
            if (uploadedFiles.idProof) {
                data.append('idProof', uploadedFiles.idProof);
            }
            if (uploadedFiles.incomeProof) {
                data.append('incomeProof', uploadedFiles.incomeProof);
            }
            if (uploadedFiles.addressProof) {
                data.append('addressProof', uploadedFiles.addressProof);
            }
            // Loop through the additionalDocs array and append each file
            // The backend (FastAPI with List[UploadFile]) will correctly handle multiple files with the same key.
            uploadedFiles.additionalDocs.forEach((file) => {
                data.append('additionalDocs', file);
            });
            // -------------------------------------------------------------

        } else if (applicationMode === 'pdf') {
            endpoint = `${apiUrl}/submit_pdf_form`;

            // --- THIS IS THE COMPLETED FILE APPENDING LOGIC FOR 'PDF' MODE ---
            if (uploadedFiles.applicationPdf) {
                data.append('applicationPdf', uploadedFiles.applicationPdf);
            }
            if (uploadedFiles.idProof) {
                data.append('idProof', uploadedFiles.idProof);
            }
            if (uploadedFiles.incomeProof) {
                data.append('incomeProof', uploadedFiles.incomeProof);
            }
            if (uploadedFiles.addressProof) {
                data.append('addressProof', uploadedFiles.addressProof);
            }
            uploadedFiles.additionalDocs.forEach((file) => {
                data.append('additionalDocs', file);
            });
            // -----------------------------------------------------------
        }

        // 3. Make the API call using the centralized authFetch service
        const response = await authFetch(endpoint, {
            method: 'POST',
            body: data,
            // Reminder: Do not manually set the 'Content-Type' header for FormData.
            // The browser sets it automatically with the correct boundary.
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Something went wrong with the submission.');
        }

        const result = await response.json();
        setSubmittedAppId(result.application_id);
        setShowSuccessModal(true);

    } catch (error) {
        // 5. Handle errors
        console.error('Submission failed:', error);
        alert(`Submission failed: ${error.message}`); // You can replace this with a more elegant notification
    } finally {
        // 6. Always stop the loading indicator
        setIsSubmitting(false);
    }
  };

  const renderModeSelection = () => (
    <div className="form-step-container centered-content">
      <div className="text-center">
        <Heading>Choose Your Application Method</Heading>
        <p className="page-subtitle">Select how you'd like to submit your loan application</p>
      </div>
      
      <div className="mode-selection-grid">
        <Tile className="mode-selection-tile" onClick={() => setApplicationMode('form')}>
          <Document size={48} className="tile-icon icon-blue" />
          <Heading className="tile-heading">Fill Application Form</Heading>
          <p>Complete the application form step by step online</p>
        </Tile>
        
        <Tile className="mode-selection-tile" onClick={() => setApplicationMode('pdf')}>
          <DocumentPdf size={48} className="tile-icon icon-red" />
          <Heading className="tile-heading">Upload Filled PDF</Heading>
          <p>Upload your completed application form as PDF</p>
        </Tile>
      </div>
    </div>
  );

  const renderDocumentUpload = () => (
    <div className="form-step-container">
      <Heading>Document Upload</Heading>
      <p className="page-subtitle">Please upload the required documents to complete your application</p>
      
      <div className="document-upload-grid">
        <FormGroup legendText="ID Proof *">
          <FileUploader
            accept={['.pdf', '.jpg', '.jpeg', '.png']}
            buttonLabel="Choose file" filenameStatus="edit" iconDescription="Clear file"
            labelDescription="Upload your ID proof (PDF, JPG, PNG)"
            onChange={(e) => handleFileUpload('idProof', e.target.files)}
            onDelete={() => removeFile('idProof')} size="md"
          />
          {uploadedFiles.idProof && (
            <InlineNotification kind="success" title="File uploaded:" subtitle={uploadedFiles.idProof.name} hideCloseButton />
          )}
        </FormGroup>
        
        <FormGroup legendText="Income Proof *">
          <FileUploader
            accept={['.pdf', '.jpg', '.jpeg', '.png']}
            buttonLabel="Choose file" filenameStatus="edit" iconDescription="Clear file"
            labelDescription="Upload your income proof (PDF, JPG, PNG)"
            onChange={(e) => handleFileUpload('incomeProof', e.target.files)}
            onDelete={() => removeFile('incomeProof')} size="md"
          />
          {uploadedFiles.incomeProof && (
            <InlineNotification kind="success" title="File uploaded:" subtitle={uploadedFiles.incomeProof.name} hideCloseButton />
          )}
        </FormGroup>
        
        <FormGroup legendText="Address Proof *">
          <FileUploader
            accept={['.pdf', '.jpg', '.jpeg', '.png']}
            buttonLabel="Choose file" filenameStatus="edit" iconDescription="Clear file"
            labelDescription="Upload your address proof (PDF, JPG, PNG)"
            onChange={(e) => handleFileUpload('addressProof', e.target.files)}
            onDelete={() => removeFile('addressProof')} size="md"
          />
          {uploadedFiles.addressProof && (
            <InlineNotification kind="success" title="File uploaded:" subtitle={uploadedFiles.addressProof.name} hideCloseButton />
          )}
        </FormGroup>
        
        <FormGroup legendText="Additional Documents (Optional)">
          <FileUploader
            accept={['.pdf', '.jpg', '.jpeg', '.png']}
            buttonLabel="Choose file" filenameStatus="edit" iconDescription="Clear file"
            labelDescription="Upload any additional documents (PDF, JPG, PNG)"
            onChange={(e) => handleFileUpload('additionalDocs', e.target.files)} size="md" multiple
          />
          {uploadedFiles.additionalDocs.map((file, index) => (
            <InlineNotification key={index} kind="success" title="File uploaded:" subtitle={file.name} onClose={() => removeFile('additionalDocs', index)} />
          ))}
        </FormGroup>
      </div>
    </div>
  );

  const renderPdfUpload = () => (
    <div className="form-step-container">
      <Heading>Upload Application PDF</Heading>
      <p className="page-subtitle">Please upload your completed loan application form</p>
      
      <FormGroup legendText="Application PDF *">
        <FileUploader
          accept={['.pdf']} buttonLabel="Choose PDF file" filenameStatus="edit" iconDescription="Clear file"
          labelDescription="Upload your filled application form (PDF only)"
          onChange={(e) => handleFileUpload('applicationPdf', e.target.files)}
          onDelete={() => removeFile('applicationPdf')} size="lg"
        />
        {uploadedFiles.applicationPdf && (
          <InlineNotification kind="success" title="Application PDF uploaded:" subtitle={uploadedFiles.applicationPdf.name} hideCloseButton />
        )}
      </FormGroup>
    </div>
  );

  const renderPersonalInformation = () => (
    <div className="form-step-container">
      <Heading>Personal Information</Heading>
      
      <TextInput
        id="firstName" labelText="First Name *" value={formData.firstName}
        onChange={(e) => handleInputChange('firstName', e.target.value)}
        invalid={!!errors.firstName} invalidText={errors.firstName}
      />
      
      <TextInput
        id="lastName" labelText="Last Name *" value={formData.lastName}
        onChange={(e) => handleInputChange('lastName', e.target.value)}
        invalid={!!errors.lastName} invalidText={errors.lastName}
      />
      
      <TextInput
        id="email" labelText="Email Address *" type="email" value={formData.email}
        onChange={(e) => handleInputChange('email', e.target.value)}
        invalid={!!errors.email} invalidText={errors.email}
      />
      
      <TextInput
        id="phone" labelText="Phone Number *" type="tel" value={formData.phone}
        onChange={(e) => handleInputChange('phone', e.target.value)}
        invalid={!!errors.phone} invalidText={errors.phone}
      />
      
      <DatePicker datePickerType="single" onChange={(dates) => handleInputChange('dateOfBirth', dates[0])} value={formData.dateOfBirth ? [formData.dateOfBirth] : []}>
        <DatePickerInput
          id="dateOfBirth" labelText="Date of Birth *" placeholder="mm/dd/yyyy"
          invalid={!!errors.dateOfBirth} invalidText={errors.dateOfBirth}
        />
      </DatePicker>
      
      <TextInput
        id="ssn" labelText="Social Security Number *" type="password" value={formData.ssn}
        onChange={(e) => handleInputChange('ssn', e.target.value)}
        invalid={!!errors.ssn} invalidText={errors.ssn}
      />
      
      <Select
        id="maritalStatus" labelText="Marital Status *" value={formData.maritalStatus}
        onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
        invalid={!!errors.maritalStatus} invalidText={errors.maritalStatus}
      >
        <SelectItem value="" text="Select marital status" />
        <SelectItem value="single" text="Single" />
        <SelectItem value="married" text="Married" />
        <SelectItem value="divorced" text="Divorced" />
        <SelectItem value="widowed" text="Widowed" />
      </Select>
    </div>
  );

  const renderEmploymentDetails = () => (
    <div className="form-step-container">
        <Heading>Employment Details</Heading>
        <Select id="employmentStatus" labelText="Employment Status *" value={formData.employmentStatus}
          onChange={(e) => handleInputChange('employmentStatus', e.target.value)}
          invalid={!!errors.employmentStatus} invalidText={errors.employmentStatus}>
          <SelectItem value="" text="Select employment status" />
          <SelectItem value="employed" text="Employed" />
          <SelectItem value="self-employed" text="Self Employed" />
          <SelectItem value="unemployed" text="Unemployed" />
          <SelectItem value="retired" text="Retired" />
          <SelectItem value="student" text="Student" />
        </Select>
        <TextInput id="employer" labelText="Employer Name *" value={formData.employer}
          onChange={(e) => handleInputChange('employer', e.target.value)}
          invalid={!!errors.employer} invalidText={errors.employer}/>
        <TextInput id="jobTitle" labelText="Job Title *" value={formData.jobTitle}
          onChange={(e) => handleInputChange('jobTitle', e.target.value)}
          invalid={!!errors.jobTitle} invalidText={errors.jobTitle}/>
        <NumberInput id="monthlyIncome" label="Monthly Income *" value={formData.monthlyIncome}
          onChange={(e, { value }) => handleInputChange('monthlyIncome', value)}
          min={0} step={100} invalid={!!errors.monthlyIncome} invalidText={errors.monthlyIncome}/>
        <Select id="employmentDuration" labelText="How long have you been with current employer?" value={formData.employmentDuration}
          onChange={(e) => handleInputChange('employmentDuration', e.target.value)}>
          <SelectItem value="" text="Select duration" />
          <SelectItem value="less-than-1" text="Less than 1 year" />
          <SelectItem value="1-2" text="1-2 years" />
          <SelectItem value="2-5" text="2-5 years" />
          <SelectItem value="5-10" text="5-10 years" />
          <SelectItem value="more-than-10" text="More than 10 years" />
        </Select>
    </div>
  );

  const renderLoanInformation = () => (
    <div className="form-step-container">
        <Heading>Loan Information</Heading>
        <Select id="loanType" labelText="Loan Type *" value={formData.loanType}
          onChange={(e) => handleInputChange('loanType', e.target.value)}
          invalid={!!errors.loanType} invalidText={errors.loanType}>
          <SelectItem value="" text="Select loan type" />
          <SelectItem value="Personal" text="Personal Loan" />
          <SelectItem value="Auto" text="Auto Loan" />
          <SelectItem value="Home" text="Home Loan" />
          <SelectItem value="Business" text="Business Loan" />
        </Select>
        <NumberInput id="loanAmount" label="Loan Amount Requested *" value={formData.loanAmount}
          onChange={(e, { value }) => handleInputChange('loanAmount', value)}
          min={1000} step={1000} invalid={!!errors.loanAmount} invalidText={errors.loanAmount}/>
        <TextInput id="loanPurpose" labelText="Purpose of Loan *" value={formData.loanPurpose}
          onChange={(e) => handleInputChange('loanPurpose', e.target.value)}
          invalid={!!errors.loanPurpose} invalidText={errors.loanPurpose}
          helperText="Please describe how you plan to use the loan"/>
        <NumberInput id="downPayment" label="Down Payment (if applicable)" value={formData.downPayment}
          onChange={(e, { value }) => handleInputChange('downPayment', value)} min={0} step={500}/>
    </div>
  );

  const renderFinancialDetails = () => (
    <div className="form-step-container">
        <Heading>Financial Details</Heading>
        <NumberInput id="monthlyExpenses" label="Monthly Expenses *" value={formData.monthlyExpenses}
          onChange={(e, { value }) => handleInputChange('monthlyExpenses', value)}
          min={0} step={100} invalid={!!errors.monthlyExpenses} invalidText={errors.monthlyExpenses}
          helperText="Include rent, utilities, food, transportation, etc."/>
        <RadioButtonGroup legendText="Credit Score Range *" name="creditScore"
          valueSelected={formData.creditScore} onChange={(value) => handleInputChange('creditScore', value)}>
          <RadioButton labelText="Excellent (750+)" value="excellent" />
          <RadioButton labelText="Good (700-749)" value="good" />
          <RadioButton labelText="Fair (650-699)" value="fair" />
          <RadioButton labelText="Poor (Below 650)" value="poor" />
          <RadioButton labelText="Don't know" value="unknown" />
        </RadioButtonGroup>
        <FormGroup legendText="Additional Information">
          <Checkbox id="bankingRelationship" labelText="I have an existing banking relationship with this institution"
            checked={formData.bankingRelationship}
            onChange={(e, { checked }) => handleInputChange('bankingRelationship', checked)}/>
          <Checkbox id="hasOtherLoans" labelText="I currently have other outstanding loans"
            checked={formData.hasOtherLoans}
            onChange={(e, { checked }) => handleInputChange('hasOtherLoans', checked)}/>
        </FormGroup>
    </div>
  );

  const renderReviewSubmit = () => (
    <div className="form-step-container review-container">
        <Heading>Review Your Application</Heading>
        <div className="review-sections-wrapper">
          {applicationMode === 'form' && (
            <>
              <Section level={4} className="review-section">
                <Heading>Personal Information</Heading>
                <p><strong>Name:</strong> {formData.firstName} {formData.lastName}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                <p><strong>Phone:</strong> {formData.phone}</p>
                <p><strong>Marital Status:</strong> {formData.maritalStatus}</p>
              </Section>
              
              <Section level={4} className="review-section">
                <Heading>Employment</Heading>
                <p><strong>Status:</strong> {formData.employmentStatus}</p>
                <p><strong>Employer:</strong> {formData.employer}</p>
                <p><strong>Job Title:</strong> {formData.jobTitle}</p>
                <p><strong>Monthly Income:</strong> ${formData.monthlyIncome?.toLocaleString()}</p>
              </Section>
              
              <Section level={4} className="review-section">
                <Heading>Loan Details</Heading>
                <p><strong>Type:</strong> {formData.loanType}</p>
                <p><strong>Amount:</strong> ${formData.loanAmount?.toLocaleString()}</p>
                <p><strong>Purpose:</strong> {formData.loanPurpose}</p>
                {formData.downPayment > 0 && <p><strong>Down Payment:</strong> ${formData.downPayment?.toLocaleString()}</p>}
              </Section>
              
              <Section level={4} className="review-section">
                <Heading>Financial Information</Heading>
                <p><strong>Monthly Expenses:</strong> ${formData.monthlyExpenses?.toLocaleString()}</p>
                <p><strong>Credit Score:</strong> {formData.creditScore}</p>
              </Section>
            </>
          )}
          
          <Section level={4} className="review-section">
            <Heading>Uploaded Documents</Heading>
            {applicationMode === 'pdf' && uploadedFiles.applicationPdf && (
              <p><strong>Application PDF:</strong> {uploadedFiles.applicationPdf.name}</p>
            )}
            {uploadedFiles.idProof && <p><strong>ID Proof:</strong> {uploadedFiles.idProof.name}</p>}
            {uploadedFiles.incomeProof && <p><strong>Income Proof:</strong> {uploadedFiles.incomeProof.name}</p>}
            {uploadedFiles.addressProof && <p><strong>Address Proof:</strong> {uploadedFiles.addressProof.name}</p>}
            {uploadedFiles.additionalDocs.length > 0 && (
              <div>
                <strong>Additional Documents:</strong>
                <ul className="review-doc-list">
                  {uploadedFiles.additionalDocs.map((file, index) => (
                    <li key={index}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        </div>
        
        <FormGroup legendText="Required Agreements">
          <Checkbox id="agreeToTerms" labelText="I agree to the terms and conditions"
            checked={formData.agreeToTerms}
            onChange={(e, { checked }) => handleInputChange('agreeToTerms', checked)}
            invalid={!!errors.agreeToTerms} invalidText={errors.agreeToTerms}/>
          <Checkbox id="agreeToCredit" labelText="I authorize a credit check to be performed"
            checked={formData.agreeToCredit}
            onChange={(e, { checked }) => handleInputChange('agreeToCredit', checked)}
            invalid={!!errors.agreeToCredit} invalidText={errors.agreeToCredit}/>
        </FormGroup>
    </div>
  );

  const renderStepContent = () => {
    if (!applicationMode) {
      return renderModeSelection();
    }

    if (applicationMode === 'form') {
      switch(currentStep) {
        case 0: return renderPersonalInformation();
        case 1: return renderEmploymentDetails();
        case 2: return renderLoanInformation();
        case 3: return renderFinancialDetails();
        case 4: return renderDocumentUpload();
        case 5: return renderReviewSubmit();
        default: return null;
      }
    } else {
      switch(currentStep) {
        case 0: return renderPdfUpload();
        case 1: return renderDocumentUpload();
        case 2: return renderReviewSubmit();
        default: return null;
      }
    }
  };

  const resetApplication = () => {
    setApplicationMode(null);
    setCurrentStep(0);
    setErrors({});
    setUploadedFiles({ applicationPdf: null, idProof: null, incomeProof: null, addressProof: null, additionalDocs: [] });
  };

  return (
    <>
      <main className="main-content-container">
        {!applicationMode ? (
          renderStepContent()
        ) : (
          <>
            <div className="page-header">
              <div>
                <Heading>Loan Application</Heading>
                <p className="page-subtitle">
                  {applicationMode === 'form' 
                    ? 'Complete the form below to apply for your loan' 
                    : 'Upload your completed application and supporting documents'
                  }
                </p>
                <Button kind="ghost" size="sm" onClick={resetApplication}>
                  Change Method
                </Button>
              </div>
            </div>
            
            <ProgressIndicator currentIndex={currentStep}>
              {steps.map((step, index) => (
                <ProgressStep key={index} label={step} complete={index < currentStep}/>
              ))}
            </ProgressIndicator>
            
            <div className="form-content-wrapper">
              {renderStepContent()}
              
              <div className="button-container">
                <Button kind="secondary" onClick={handlePrevious} disabled={currentStep === 0}>
                  Previous
                </Button>
                
                {currentStep < steps.length - 1 ? (
                  <Button onClick={handleNext}>Next</Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <Loading small withOverlay={false} /> : 'Submit Application'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </main>
      
      <Modal
        open={showSuccessModal} onRequestClose={() => setShowSuccessModal(false)}
        modalHeading="Application Submitted Successfully" primaryButtonText="Close"
        onRequestSubmit={() => { setShowSuccessModal(false); resetApplication(); setSubmittedAppId(null); }}>
        <div className="modal-content">
          <p>Thank you for submitting your loan application. We will review your information and contact you within 2-3 business days with next steps.</p>
          {submittedAppId && (
            <p>
                Your application reference number is: <strong>{submittedAppId}</strong>
            </p>
          )}
        </div>
      </Modal>
    </>
  );
};

export default LoanApplication;