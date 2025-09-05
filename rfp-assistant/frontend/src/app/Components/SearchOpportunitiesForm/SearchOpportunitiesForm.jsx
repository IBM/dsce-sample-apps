"use client";

import React, { useState , useRef, useEffect} from 'react';
import Image from 'next/image';
import {
  FluidForm,
  TextInput,
  TextArea,
  Button,
  Stack,
  Loading
} from '@carbon/react';

import RfpResultsTable from '../RfpResultsTable/RfpResultsTable';
import RfpSelector from '../RfpSelector/RfpSelector';
import worldIcon from '../Asset/world.png';
import config from '../../config';

const SearchOpportunitiesForm = () => {

 

  const bottomRef = useRef(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false); // ✅ new loading state

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // ⏳ Start loading

    try {
      const res = await fetch(`${config.backendUrl}/search-opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await res.json();
      setResponse(result);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false); // ✅ Stop loading
    }
  };

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [response, loading]); // ⬅️ Step 2: scroll when response or loading changes


  return (
    <div style={{ padding: '2rem 5rem', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3rem' }}>
        {/* <Image
          src={worldIcon}
          alt="RFP Logo"
          style={{ width: '40px', height: '40px', marginRight: '10px' }}
        /> */}
        {/* <h1 style={{ margin: 0 }}>RFP Assistant</h1> */}
        {/* <h1 style={{ 
          margin: 0, 
          textAlign: 'center', 
          fontWeight: 'bold',
          width: '100%'
        }}>
          RFP Assistant
        </h1> */}
      </div>

      <FluidForm onSubmit={handleSubmit}>
        <h3>I. Company Profile</h3>
        <br />
        <div style={{ backgroundColor: '#f4f4f4', padding: '1rem' }}>
          <Stack gap={5}>
            <TextInput
              id="org-name"
              name="name"
              placeholder="Company Name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <br />

            <TextArea
              enableCounter
              helperText="TextArea helper text"
              id="org-description"
              name="description"
              placeholder="Company description. For example: We offer IT services..."
              rows={2}
              warnText="This is a warning message."
              invalidText="Error message that is really long can wrap to more lines but should not be excessively long."
              value={formData.description}
              onChange={handleChange}
              required
            />

            <Button type="submit">Search Opportunities</Button>
          </Stack>
        </div>
      </FluidForm>

      {/* 🔄 Loader shown while waiting for response */}
      {loading && (
        <div style={{ marginTop: '2rem' }}>
          <Loading active description="Searching opportunities..." withOverlay />
        </div>
      )}

      {/* ✅ Response shown once loaded */}
      {response && !loading && (
        <div style={{ marginTop: '2rem' }}>
        <h3>II. Select an Opportunity</h3>
        <br></br>
          <RfpResultsTable opportunities={response} />
          <RfpSelector
            opportunities={response}
            company_name={formData.name}
            company_description={formData.description}
          />
        </div>
      )}
       <div ref={bottomRef} />
    </div>
  );
};

export default SearchOpportunitiesForm;
