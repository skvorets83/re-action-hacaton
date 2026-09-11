import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../api/authApi';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
}