import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useLicenseStore } from '../store';
import { ShieldAlert } from 'lucide-react';

const LicenseGuard = ({ children }) => {
    const { isValid, isLoading, license, checkLicense } = useLicenseStore();
    const location = useLocation();

    useEffect(() => {
        // Re-check license on mount if not valid or unknown
        if (!isValid) {
            checkLicense();
        }
    }, [checkLicense, isValid]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    // Check if expired
    const isExpired = license?.expiresAt && new Date(license.expiresAt) < new Date();

    if (!isValid || isExpired) {
        // Allow access to settings/license/support to recover from invalid or expired licenses.
        if (location.pathname === '/settings' || location.pathname === '/license-expired' || location.pathname === '/support') {
            return children || <Outlet />;
        }
        return <Navigate to="/license-expired" replace />;
    }

    return children || <Outlet />;
};

export default LicenseGuard;
