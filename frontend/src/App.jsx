/**
 * ============================================
 * MAIN APP COMPONENT
 * ============================================
 */

import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster, toast } from 'react-hot-toast';
import { useAuthStore, useThemeStore, useLicenseStore } from './store';
import { usePermissions } from './hooks/usePermissions';
import { PERMISSIONS } from './utils/permissions';
import ErrorBoundary from './components/ErrorBoundary';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import LicenseGuard from './components/LicenseGuard';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberForm from './pages/Members/MemberForm';
import MemberProfile from './pages/Members/MemberProfile';
import Subscriptions from './pages/Subscriptions';
import CheckIn from './pages/CheckIn';
import Payments from './pages/Payments';
import ReportsLayout from './layouts/ReportsLayout';
import ReportsDashboard from './pages/Reports/index';
// Report Pages
import ProductSalesReportPage from './pages/Reports/ProductSalesReportPage';
import StandardReportPage from './pages/Reports/StandardReportPage';
import EmployeeCollectionsPage from './pages/Reports/EmployeeCollectionsPage';
import ShiftReportsPage from './pages/Reports/ShiftReportsPage';
import ReceiptLookupPage from './pages/Reports/ReceiptLookupPage';
import OutstandingReportPage from './pages/Reports/OutstandingReportPage';
import PayInOutReportPage from './pages/Reports/PayInOutReportPage';
import CashClosingReportPage from './pages/Reports/CashClosingReportPage';
import RefundsReportPage from './pages/Reports/RefundsReportPage';
import CancellationsReportPage from './pages/Reports/CancellationsReportPage';

import Settings from './pages/Settings';
import Plans from './pages/Plans';
import Packages from './pages/Packages';

import LicenseExpired from './pages/LicenseExpired';
import Employees from './pages/Employees';
import PermissionsManagement from './pages/PermissionsManagement';
import PaymentAlerts from './pages/PaymentAlerts';
import SubscriptionAlerts from './pages/SubscriptionAlerts';
import PayInOut from './pages/PayInOut';
import Products from './pages/Products';
import Sales from './pages/Sales';

// Protected Route Component (Exists)
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuthStore();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Permission Guard Component (New)
const PermissionGuard = ({ children, permission, requireAdmin = false }) => {
    const { can, isAdmin } = usePermissions();
    const [denied, setDenied] = React.useState(false);

    React.useEffect(() => {
        if (requireAdmin && !isAdmin()) {
            setDenied(true);
        } else if (permission && !can(permission)) {
            setDenied(true);
        }
    }, [permission, requireAdmin, can, isAdmin]);

    if (denied) {
        return <Navigate to="/" replace />;
    }

    // Prevent flicker or premature redirect while checking? 
    // can() is sync if user is loaded. user is loaded by ProtectedRoute.

    // Check access
    const hasAccess = (requireAdmin && isAdmin()) || (!requireAdmin && (!permission || can(permission)));


    useEffect(() => {
        if (!hasAccess) {
            toast.error('Access Denied: You do not have permission to view this page.');
        }
    }, [hasAccess]);

    if (!hasAccess) {
        return <Navigate to="/" replace />;
    }

    return children;
};

function App() {
    const { initAuth, refreshSession, isAuthenticated } = useAuthStore();
    const { theme } = useThemeStore();
    const { checkLicense } = useLicenseStore();
    const { i18n } = useTranslation();
    const location = useLocation();

    // Initialize auth on mount
    useEffect(() => {
        initAuth();
        refreshSession();
    }, [initAuth, refreshSession]);

    // Reactive Permission Update: Listen for 403
    useEffect(() => {
        const handleForbidden = () => {
            refreshSession();
        };
        window.addEventListener('auth:forbidden', handleForbidden);
        return () => window.removeEventListener('auth:forbidden', handleForbidden);
    }, [refreshSession]);

    // Proactive Permission Update: Refresh on Navigation
    useEffect(() => {
        if (isAuthenticated) {
            refreshSession();
        }
    }, [location.pathname, isAuthenticated, refreshSession]);

    // Check license on mount
    useEffect(() => {
        checkLicense();
    }, [checkLicense]);

    // Apply theme
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // Ensure direction is correct
    useEffect(() => {
        document.documentElement.dir = i18n.dir();
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);



    return (
        <ErrorBoundary>
            <Toaster position="top-right" />
            <Routes>
                {/* Auth Routes */}
                <Route element={<AuthLayout />}>
                    <Route
                        path="/login"
                        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
                    />
                </Route>

                {/* License Expired Page */}
                <Route path="/license-expired" element={<LicenseExpired />} />

                {/* Protected Routes */}
                <Route
                    element={
                        <ProtectedRoute>
                            <LicenseGuard>
                                <MainLayout />
                            </LicenseGuard>
                        </ProtectedRoute>
                    }
                >
                    <Route path="/" element={
                        <PermissionGuard permission={PERMISSIONS.DASHBOARD_VIEW_BASIC}><Dashboard /></PermissionGuard>
                    } />

                    {/* Members */}
                    <Route path="/members" element={
                        <PermissionGuard permission={PERMISSIONS.MEMBERS_VIEW}><Members /></PermissionGuard>
                    } />
                    <Route path="/members/new" element={
                        <PermissionGuard permission={PERMISSIONS.MEMBERS_CREATE}><MemberForm /></PermissionGuard>
                    } />
                    <Route path="/members/:id" element={
                        <PermissionGuard permission={PERMISSIONS.MEMBERS_VIEW}><MemberProfile /></PermissionGuard>
                    } />
                    <Route path="/members/:id/edit" element={
                        <PermissionGuard permission={PERMISSIONS.MEMBERS_EDIT}><MemberForm /></PermissionGuard>
                    } />

                    {/* Subscriptions */}
                    <Route path="/subscriptions" element={
                        <PermissionGuard permission={PERMISSIONS.SUBSCRIPTIONS_VIEW}><Subscriptions /></PermissionGuard>
                    } />

                    {/* Operations */}
                    <Route path="/checkin" element={
                        <PermissionGuard permission={PERMISSIONS.CHECKINS_VIEW}><CheckIn /></PermissionGuard>
                    } />
                    <Route path="/payments" element={
                        <PermissionGuard permission={PERMISSIONS.PAYMENTS_VIEW}><Payments /></PermissionGuard>
                    } />

                    {/* Reports - Nested Routes */}
                    <Route path="/reports" element={
                        <PermissionGuard permission={PERMISSIONS.REPORTS_VIEW}>
                            <ReportsLayout />
                        </PermissionGuard>
                    }>
                        <Route index element={<ReportsDashboard />} />

                        {/* Dedicated Reports */}
                        <Route path="product-sales" element={<ProductSalesReportPage />} />
                        <Route path="revenue" element={<StandardReportPage type="revenue" />} />
                        <Route path="members" element={<StandardReportPage type="members" />} />
                        <Route path="subscriptions" element={<StandardReportPage type="subscriptions" />} />
                        <Route path="attendance" element={<StandardReportPage type="attendance" />} />
                        <Route path="payments-summary" element={<StandardReportPage type="payments-summary" />} />

                        {/* Complex Reports */}
                        <Route path="employee-collections" element={<EmployeeCollectionsPage />} />
                        <Route path="shifts" element={<ShiftReportsPage />} />
                        <Route path="receipts" element={<ReceiptLookupPage />} />
                        <Route path="pay-in-out" element={<PayInOutReportPage />} />
                        <Route path="refunds" element={<RefundsReportPage />} />
                        <Route path="cancellations" element={<CancellationsReportPage />} />

                        {/* Admin Only */}
                        <Route path="outstanding" element={<OutstandingReportPage />} />
                        <Route path="cash-closing" element={<CashClosingReportPage />} />

                        {/* Fallback to dashboard */}
                        <Route path="*" element={<Navigate to="/reports" replace />} />
                    </Route>
                    <Route path="/payment-alerts" element={
                        <PermissionGuard permission={PERMISSIONS.REPORTS_VIEW}><PaymentAlerts /></PermissionGuard>
                    } />
                    <Route path="/subscription-alerts" element={
                        <PermissionGuard permission={PERMISSIONS.SUBSCRIPTIONS_VIEW}><SubscriptionAlerts /></PermissionGuard>
                    } />
                    <Route path="/pay-in-out" element={
                        <PermissionGuard permission={PERMISSIONS.PAYMENTS_VIEW}><PayInOut /></PermissionGuard>
                    } />
                    <Route path="/settings" element={
                        <PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><Settings /></PermissionGuard>
                    } />
                    <Route path="/plans" element={
                        <PermissionGuard permission={PERMISSIONS.PLANS_VIEW}><Plans /></PermissionGuard>
                    } />
                    <Route path="/products" element={
                        <PermissionGuard permission={PERMISSIONS.PLANS_VIEW}><Products /></PermissionGuard>
                    } />
                    <Route path="/sales" element={
                        <PermissionGuard permission={PERMISSIONS.PAYMENTS_VIEW}><Sales /></PermissionGuard>
                    } />

                    {/* Admin Only */}
                    <Route path="/employees" element={
                        <PermissionGuard requireAdmin={true}><Employees /></PermissionGuard>
                    } />
                    <Route path="/permissions" element={
                        <PermissionGuard requireAdmin={true}><PermissionsManagement /></PermissionGuard>
                    } />

                    {/* Packages (Hidden/Admin?) */}
                    <Route path="/packages" element={
                        <PermissionGuard requireAdmin={true}><Packages /></PermissionGuard>
                    } />
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </ErrorBoundary>
    );
}

export default App;
