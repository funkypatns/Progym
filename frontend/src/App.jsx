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
import PaymentReceiptPage from './pages/Payments/PaymentReceiptPage';
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
import Trainers from './pages/Trainers';

import LicenseExpired from './pages/LicenseExpired';
import Employees from './pages/Employees';
import PermissionsManagement from './pages/PermissionsManagement';
import PaymentAlerts from './pages/PaymentAlerts';
import SubscriptionAlerts from './pages/SubscriptionAlerts';
import PayInOut from './pages/PayInOut';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Appointments from './pages/Appointments';
import Coaches from './pages/Coaches';
import CoachReportsPage from './pages/Reports/CoachReportsPage';
import GymIncomeReport from './pages/Reports/GymIncomeReport';
import SessionNotificationsPage from './pages/Notifications/SessionNotificationsPage';

// Protected Route Component (Exists)
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuthStore();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Permission Guard Component (New)
const PermissionGuard = ({ children, permission, requireAdmin = false }) => {
    const { can, isAdmin } = usePermissions();

    // Check access directly during render
    const hasAccess = (requireAdmin && isAdmin()) || (!requireAdmin && (!permission || can(permission)));

    // Side effect for notification
    React.useEffect(() => {
        if (!hasAccess) {
            toast.error('Access Denied: You do not have permission to view this page.');
        }
    }, [hasAccess]);

    // Conditional return AFTER all hooks
    if (!hasAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="bg-red-500/10 p-6 rounded-full mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-slate-400 max-w-md mb-6">
                    You do not have permission to view this page.
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={() => window.history.back()}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
                    >
                        Go Back
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
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
                <Route path="/payments/:id/receipt" element={
                    <ProtectedRoute>
                        <LicenseGuard>
                            <PermissionGuard permission={PERMISSIONS.PAYMENTS_VIEW}>
                                <PaymentReceiptPage />
                            </PermissionGuard>
                        </LicenseGuard>
                    </ProtectedRoute>
                } />
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
                        <Route path="coach-earnings" element={<CoachReportsPage />} />
                        <Route path="gym-income" element={<GymIncomeReport />} />

                        {/* Admin Only */}
                        <Route path="outstanding" element={<OutstandingReportPage />} />
                        <Route path="cash-closing" element={<CashClosingReportPage />} />

                        {/* Fallback to dashboard */}
                        <Route path="*" element={<Navigate to="/reports" replace />} />
                    </Route>
                    <Route path="/notifications/sessions" element={
                        <PermissionGuard permission={PERMISSIONS.APPOINTMENTS_VIEW}><SessionNotificationsPage /></PermissionGuard>
                    } />
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
                    <Route path="/appointments" element={
                        <PermissionGuard permission={PERMISSIONS.APPOINTMENTS_VIEW}><Appointments /></PermissionGuard>
                    } />
                    <Route path="/coaches" element={
                        <PermissionGuard permission={PERMISSIONS.COACHES_VIEW}><Coaches /></PermissionGuard>
                    } />
                    <Route path="/staff-trainers" element={
                        <PermissionGuard permission={PERMISSIONS.COACHES_VIEW}><Trainers /></PermissionGuard>
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
