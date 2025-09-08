import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, TextInput, PasswordInput, Button, InlineNotification, DatePicker, DatePickerInput } from '@carbon/react';

export const RegisterPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username || !password) {
            setError('Username and password are required.');
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL;
        
        try {
            const response = await fetch(`${apiUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password,
                    firstName,
                    lastName,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toLocaleDateString('en-CA') : '' // 'en-CA' gives YYYY-MM-DD format
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to register. Please try another username.');
            }
            
            setSuccess('Registration successful! Redirecting to login...');
            
            // Navigate to login page after a short delay
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '4rem auto' }}>
            <h2>Register New Account</h2>
            <Form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                    <TextInput id="firstName" labelText="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <TextInput id="lastName" labelText="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <DatePicker datePickerType="single" onChange={(dates) => setDateOfBirth(dates[0])}>
                        <DatePickerInput id="dateOfBirth" labelText="Date of Birth" placeholder="mm/dd/yyyy" required />
                    </DatePicker>
                </div>
                {/* --------------------------- */}
                <div style={{ marginBottom: '1rem' }}>
                    <TextInput id="username" labelText="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <PasswordInput id="password" labelText="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>

                {error && <InlineNotification kind="error" title="Registration Error" subtitle={error} hideCloseButton={false} onClose={() => setError('')} />}
                {success && <InlineNotification kind="success" title="Success" subtitle={success} hideCloseButton />}
                
                <Button type="submit" style={{ marginTop: '1rem' }} disabled={!!success}>Register</Button>
                <p style={{ marginTop: '1rem' }}>Already have an account? <Link to="/login">Login here</Link></p>
            </Form>
        </div>
    );
};