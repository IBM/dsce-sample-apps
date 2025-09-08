// src/pages/LoginPage.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Form, TextInput, PasswordInput, Button, InlineNotification } from '@carbon/react';

export const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const apiUrl = import.meta.env.VITE_API_URL;

        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await fetch(`${apiUrl}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to login');
            }
            
            const data = await response.json();
            login(data.access_token);
            navigate('/apply');
        } catch (err) {
            setError(err.message);
        }
    };
    const apiUrl = import.meta.env.VITE_API_URL;
    const downloadUrl = `${apiUrl}/download_sample_documents`;
    // ... return a form JSX similar to your other components
    return (
        <div style={{ maxWidth: '600px', margin: '4rem auto' }}>
            <h4>Sample Username, Password and Documents for Testing -</h4>
            <h5>Username: <b>tom_miller</b></h5>
            <h5>Password: <b>Pass1234</b></h5>
            <br></br>
            <h5><a href={downloadUrl} download="sample.zip" className="text-blue-600 underline hover:text-blue-800">Click here</a> to download the sample documents for submitting loan application. 
            </h5>
            <br/><br/>
            <h2>Login</h2>
            <Form onSubmit={handleSubmit}>
                <TextInput id="username" labelText="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <PasswordInput id="password" labelText="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <InlineNotification kind="error" title="Login Error" subtitle={error} />}
                <Button type="submit" style={{ marginTop: '1rem' }}>Login</Button>
                <p style={{ marginTop: '1rem' }}>Don't have an account? <Link to="/register">Register here</Link></p>
            </Form>
        </div>
    );
};