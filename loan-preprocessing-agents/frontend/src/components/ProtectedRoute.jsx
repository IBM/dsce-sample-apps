import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
    const { token } = useAuth();

    if (!token) {
        // If no token, redirect to the login page
        return <Navigate to="/login" />;
    }

    // If there is a token, render the child routes
    return <Outlet />;
};

export default ProtectedRoute;