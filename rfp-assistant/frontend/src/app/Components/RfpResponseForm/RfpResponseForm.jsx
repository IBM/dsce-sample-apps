"use client";

import React, { useState } from 'react';
import {
  TextInput,
  Button,
  FormGroup,
  Stack,
  FormItem,
  FileUploaderDropContainer
} from '@carbon/react';

const RfpResponseForm = ({ selectedRfp }) => {
  const [formData, setFormData] = useState({
    title: selectedRfp.title || '',
    description: selectedRfp.description || '',
    customer: selectedRfp.customer || '',
    ref_number: selectedRfp.ref_number || '',
    file: null
  });

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value
    }));
  };

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      const isValidType =
        uploadedFile.type === 'application/pdf' ||
        uploadedFile.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (isValidType) {
        setFormData((prev) => ({ ...prev, file: uploadedFile }));
      } else {
        alert('Only PDF or DOCX files are allowed.');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 🔁 send formData to your backend
    console.log('Submitted:', formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormGroup
        legendId="rfp-form"
        legendText="RFP Response Details"
        style={{ maxWidth: '600px' }}
      >
        <Stack gap={7}>
          <TextInput
            id="title"
            labelText="Title"
            value={formData.title}
            onChange={handleInputChange}
            readOnly
          />

          <TextInput
            id="description"
            labelText="Description"
            value={formData.description}
            onChange={handleInputChange}
            readOnly
          />

          <TextInput
            id="customer"
            labelText="Customer"
            value={formData.customer}
            onChange={handleInputChange}
            readOnly
          />

          <TextInput
            id="ref_number"
            labelText="Reference Number"
            value={formData.ref_number}
            onChange={handleInputChange}
            readOnly
          />

          {/* <FormItem>
            <p className="cds--file--label">Upload supporting documents</p>
            <p className="cds--label-description">
              Max file size is 5 MB. Supported file types are .pdf and .docx.
            </p>
            <FileUploaderDropContainer
              accept={['.pdf', '.docx']}
              labelText="Drag and drop a file here or click to upload"
              multiple={false}
              onAddFiles={handleFileChange}
              name="supporting-file"
            />
          </FormItem> */}

          <Button type="submit">Generate Response</Button>
        </Stack>
      </FormGroup>
    </form>
  );
};

export default RfpResponseForm;
