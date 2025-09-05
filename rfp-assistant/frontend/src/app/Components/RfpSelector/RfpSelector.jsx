"use client";

import React, { useState , useRef, useEffect} from 'react';
import {
  RadioButtonGroup,
  RadioButton,
  TextInput,
  Button,
  FormGroup,
  Stack,
  FormItem,
  FileUploaderDropContainer,
  TextArea
} from '@carbon/react';
import config from '../../config';

import GeneratedResponseModal from '../GeneratedResponseModal/GeneratedResponseModal';
const RfpSelector = ({ opportunities, company_name, company_description }) => {
  const [selected, setSelected] = useState(null);
  const [selectedRfp, setSelectedRfp] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [responseUrl, setResponseUrl] = useState(null);
  const bottomRef = useRef(null);

  const handleRadioChange = (refNumber) => {
    setSelected(refNumber);
    const rfp = opportunities.find((item) => item.ref_number === refNumber);
    setSelectedRfp(rfp);
  };

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      const isValidType =
        uploadedFile.type === 'application/pdf' ||
        uploadedFile.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (isValidType) {
        setFile(uploadedFile);
      } else {
        alert('Only PDF or DOCX files are allowed.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedRfp || !company_name || !company_description) {
      alert('Missing data: make sure company info and RFP are selected.');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('title', selectedRfp.title);
    formData.append('description', selectedRfp.description);
    formData.append('customer', selectedRfp.customer);
    formData.append('ref_number', selectedRfp.ref_number);
    formData.append('company_name', company_name);
    formData.append('company_description', company_description);
    if (file) {
      formData.append('rfp_file', file);
    }

    try {
      const res = await fetch(`${config.backendUrl}/generate-rfp-response`, {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      setResponseUrl(result?.file_url || null);
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Failed to generate RFP response.');
    } finally {
      setLoading(false);
    }
  };

  if (!opportunities || opportunities.length === 0) {
    return <p>No RFPs available for selection.</p>;
  }

  useEffect(() => {
  if (bottomRef.current) {
    bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }
}, [selectedRfp, responseUrl]);

  return (
    <div style={{ padding: '1rem' }}>
      <RadioButtonGroup
        legendText="Select an RFP Opportunity to proceed"
        name="rfp-radio-group"
        orientation="vertical"
        onChange={handleRadioChange}
        valueSelected={selected}
      >
        {opportunities.map((item, index) => (
          <RadioButton
            key={index}
            labelText={item.title}
            value={item.ref_number}
            id={`radio-${index}`}
          />
        ))}
      </RadioButtonGroup>

      {selectedRfp && (

        <>  
        <br></br>  <br></br>    <h3>III. Generate RFP Response</h3>
        <br></br>
                <div style={{ backgroundColor: '#f4f4f4', padding: '1rem' }}>

        <form onSubmit={handleSubmit} >
          <FormGroup
            legendId="rfp-form"
          >
            <Stack gap={7}>
              <TextInput
                id="title"
                labelText="Title"
                value={selectedRfp.title}
                readOnly
              />
              <TextArea
  id="description"
  labelText="Description"
  value={selectedRfp.description}
  readOnly
  rows={4}
/>
              <TextInput
                id="customer"
                labelText="Customer"
                value={selectedRfp.customer}
                readOnly
              />
              <TextInput
                id="ref_number"
                labelText="Reference Number"
                value={selectedRfp.ref_number}
                readOnly
              />

              {/* <FormItem>
                <p className="cds--file--label">Upload supporting documents</p>
                <p className="cds--label-description">
                  Max file size is 200 MB. Supported file types: .pdf, .docx
                </p>
                <FileUploaderDropContainer
                  accept={['.pdf', '.docx']}
                  labelText="Drag and drop or click to upload"
                  multiple={false}
                  onAddFiles={handleFileChange}
                  name="rfp_file"
                />
              </FormItem> */}

              <Button type="submit" disabled={loading}>
                {loading ? 'Generating...' : 'Generate Response'}
              </Button>

              {responseUrl && <GeneratedResponseModal fileUrl={responseUrl} />}

            </Stack>
          </FormGroup>
        </form>
        </div>
        </>
      )}
      <div ref={bottomRef} />

    </div>
  );
};

export default RfpSelector;
