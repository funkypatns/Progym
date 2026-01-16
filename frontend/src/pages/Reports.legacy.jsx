/**
 * ============================================
 * REPORTS PAGE
 * ============================================
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Users,
    DollarSign,
    UserCheck,
    Calendar,
    CreditCard,
    Download,
    FileSpreadsheet,
    Loader2,
    TrendingDown,
    Plus,
    User,
    Banknote,
    AlertCircle,
    Receipt,
    ArrowLeftRight,
    Search,
    X,
    Printer,
    Phone,
    Clock,
    CheckCircle,
    RefreshCcw,
    Eye,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
const apiClient = api;
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';

import { useAuthStore, useSettingsStore } from '../store';
import CashClosingModal from '../components/CashClosingModal';

// Safe getter to avoid crashes and [object Object]
const safe = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const safeNum = (v) => (v === null || v === undefined || v === '' ? 0 : v);
import MonthlyCollectionSummary from '../components/MonthlyCollectionSummary';
import CashClosingReport from '../components/CashClosingReport';
import RefundsReport from '../components/RefundsReport';
import CancellationsReport from '../components/CancellationsReport';
import MemberLedgerModal from '../components/MemberLedgerModal';
import MemberDetailsModal from '../components/MemberDetailsModal';
import CashMovementsReport from '../components/CashMovementsReport';
import SalesProductReport from '../components/SalesProductReport';
import { useLocation } from 'react-router-dom';

// Helper to normalize backend response to safe defaults
const normalizeReportResponse = (data) => {
    if (!data) return { report: [], rows: [], summary: { count: 0, total: 0 } };

    // Standardize array property: backend might return 'rows', 'report', 'items', or 'data'
    // validArray finds the first property that is an actual array
    const rawList = data.colsings || data.closings || data.rows || data.report || data.data || [];
    const safeList = Array.isArray(rawList) ? rawList : [];

    // Ensure summary object
    const summary = data.summary || { count: 0, total: 0 };

    // Return object with guaranteed array properties aliased for compatibility
    return {
        ...data,
        report: safeList,
        rows: safeList,
        items: safeList,
        summary
    };
};

const ShiftReports = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Date filter state
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    const fetchShifts = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            const response = await apiClient.get(`/pos/shifts?${params}`);
            // Safe access
            setShifts(Array.isArray(response.data?.data) ? response.data.data : []);
        } catch (error) {
            console.error('Failed to fetch shifts', error);
            toast.error('Failed to load shift reports');
            setShifts([]);
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        if (isActive) {
            fetchShifts();
        }
    }, [isActive, dateRange]);

    if (!isActive) return null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div>
                    <label className="label">{t('reports.from')}</label>
                    <input
                        type="date"
                        className="input"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    />
                </div>
                <div>
                    <label className="label">{t('reports.to')}</label>
                    <input
                        type="date"
                        className="input"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    />
                </div>
                <button onClick={fetchShifts} className="btn-secondary h-[42px] mb-[1px]">
                    <span className="hidden sm:inline">{t('common.refresh')}</span>
                </button>
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-700/50 border-b border-gray-100 dark:border-dark-700 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="p-4">{t('reports.date')}</th>
                                <th className="p-4">{t('auth.role_staff')}</th>
                                <th className="p-4 text-right">Expected</th>
                                <th className="p-4 text-right">Actual</th>
                                <th className="p-4 text-right">Diff</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading...
                                    </td>
                                </tr>
                            ) : shifts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        No shifts found for this period
                                    </td>
                                </tr>
                            ) : (
                                shifts.map(shift => {
                                    const diff = shift.cashDifference || 0;
                                    const status = Math.abs(diff) < 0.01 ? 'MATCHED' : diff > 0 ? 'OVER' : 'SHORT';
                                    const statusColor = status === 'MATCHED' ? 'badge-success' : status === 'OVER' ? 'badge-warning' : 'badge-danger';

                                    return (
                                        <tr key={shift.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {formatDateTime(shift.openedAt, i18n.language)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    to {formatDateTime(shift.closedAt, i18n.language)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                                                        {shift.opener?.firstName?.[0]}
                                                    </div>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        {shift.opener?.firstName} {shift.opener?.lastName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-gray-600 dark:text-gray-400">
                                                {formatCurrency(shift.expectedCash || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(shift.closingCash || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className={`p-4 text-right font-mono font-bold ${diff > 0 ? 'text-orange-500' : diff < 0 ? 'text-red-500' : 'text-emerald-500'
                                                }`}>
                                                {diff > 0 ? '+' : ''}{formatCurrency(diff, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {shift.activityType === 'NO_ACTIVITY' ? (
                                                    <span className="badge bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                                        NO ACTIVITY
                                                    </span>
                                                ) : (
                                                    <span className={`badge ${statusColor}`}>
                                                        {status}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ============================================
// PAYMENTS SUMMARY REPORT
// ============================================
const PaymentsSummaryReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { user } = useAuthStore();
    const { getSetting } = useSettingsStore();

    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [employees, setEmployees] = useState([]);

    const [filters, setFilters] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        employeeId: 'all',
        scope: 'allShifts'
    });

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    // Fetch employees for filter (Admin only)
    useEffect(() => {
        const fetchEmployees = async () => {
            if (user?.role !== 'admin') return;
            try {
                const res = await apiClient.get('/users/list');
                setEmployees(res.data.data || []);
            } catch (err) {
                console.error('Failed to load employees', err);
            }
        };
        if (isActive) fetchEmployees();
    }, [isActive, user?.role]);

    const fetchSummary = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                from: filters.from,
                to: filters.to,
                employeeId: filters.employeeId,
                scope: filters.scope
            });
            const response = await apiClient.get(`/reports/payments/summary?${params}`);
            if (response.data.success) {
                setData(response.data.data);
            } else {
                toast.error(response.data.message || t('common.error'));
            }
        } catch (error) {
            console.error('Failed to fetch payments summary', error);
            toast.error('Failed to load payments summary');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) fetchSummary();
    }, [isActive]);

    if (!isActive) return null;

    const byMethod = data?.byMethod || { cash: { count: 0, amount: 0 }, card: { count: 0, amount: 0 }, transfer: { count: 0, amount: 0 } };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('reports.from')}</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={filters.from}
                            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('reports.to')}</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={filters.to}
                            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                        />
                    </div>
                    {user?.role === 'admin' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('reports.filterByEmployee')}</label>
                                <select
                                    className="input w-full"
                                    value={filters.employeeId}
                                    onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                                >
                                    <option value="all">{t('common.all')}</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.firstName} {emp.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Scope</label>
                                <select
                                    className="input w-full"
                                    value={filters.scope}
                                    onChange={(e) => setFilters({ ...filters, scope: e.target.value })}
                                >
                                    <option value="allShifts">All Shifts</option>
                                    <option value="currentShift">Current Shift</option>
                                </select>
                            </div>
                        </>
                    )}
                    <div className="flex items-end">
                        <button onClick={fetchSummary} disabled={isLoading} className="btn-primary w-full">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.refresh')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Total */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-primary-600 dark:text-primary-400">
                            <Receipt className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Successful</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatNumber(data?.successCount || 0, i18n.language)}
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                {formatCurrency(data?.successAmountTotal || 0, i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Cash */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <Banknote className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('payments.cash')}</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatNumber(byMethod.cash.count, i18n.language)}
                            </h3>
                            <p className="text-xs text-emerald-500 mt-1">
                                {formatCurrency(byMethod.cash.amount, i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('payments.card')}</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatNumber(byMethod.card.count, i18n.language)}
                            </h3>
                            <p className="text-xs text-blue-500 mt-1">
                                {formatCurrency(byMethod.card.amount, i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Transfer */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400">
                            <ArrowLeftRight className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('payments.transfer')}</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatNumber(byMethod.transfer.count, i18n.language)}
                            </h3>
                            <p className="text-xs text-purple-500 mt-1">
                                {formatCurrency(byMethod.transfer.amount, i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Method Breakdown Pills */}
            <div className="bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Method Breakdown</h4>
                <div className="flex flex-wrap gap-3">
                    <span className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium">
                        Cash: {byMethod.cash.count}
                    </span>
                    <span className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
                        Card: {byMethod.card.count}
                    </span>
                    <span className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-medium">
                        Transfer: {byMethod.transfer.count}
                    </span>
                </div>
            </div>

            {/* Empty State */}
            {data?.successCount === 0 && (
                <div className="bg-white dark:bg-dark-800 p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 text-center">
                    <Receipt className="w-12 h-12 mx-auto text-gray-300 dark:text-dark-500 mb-4" />
                    <p className="text-gray-500 dark:text-dark-400">No successful payments in selected range</p>
                </div>
            )}
        </div>
    );
};

// ============================================
// RECEIPT LOOKUP REPORT (Digital Receipt Book)
// ============================================
const ReceiptLookupReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { user } = useAuthStore();
    const { getSetting } = useSettingsStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [mode, setMode] = useState('scan'); // 'scan' or 'manual'
    const [scope, setScope] = useState('allShifts');
    const [isLoading, setIsLoading] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [error, setError] = useState(null);
    const [viewMemberId, setViewMemberId] = useState(null);

    const inputRef = React.useRef(null);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    // Auto-focus on mount
    useEffect(() => {
        if (isActive && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isActive]);

    const lookupReceipt = async (query) => {
        if (!query || !query.trim()) return;

        // Normalize scanner input: trim, remove invisible chars
        const cleanQuery = query.trim().replace(/[\x00-\x1F\x7F]/g, '');

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                q: cleanQuery,
                scope: user?.role === 'admin' ? scope : 'currentShift'
            });
            const response = await apiClient.get(`/reports/receipts/lookup?${params}`);

            if (response.data.success) {
                setReceiptData(response.data.data);
            } else {
                setError(response.data.message || 'Receipt not found');
                setReceiptData(null);
            }
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to lookup receipt';
            setError(message);
            setReceiptData(null);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            lookupReceipt(searchQuery);
        }
    };

    const handleClear = () => {
        setSearchQuery('');
        setReceiptData(null);
        setError(null);
        if (inputRef.current) inputRef.current.focus();
    };

    const handlePrintPayment = () => {
        // TODO: Integrate with existing receipt printing
        toast.success('Print Payment Receipt triggered');
    };

    const handlePrintRefund = (refundId) => {
        // TODO: Integrate with existing refund receipt printing
        toast.success(`Print Refund Receipt for TXN-${refundId}`);
    };

    if (!isActive) return null;

    const data = receiptData;

    return (
        <div className="space-y-6">
            <MemberDetailsModal
                isOpen={!!viewMemberId}
                onClose={() => setViewMemberId(null)}
                memberId={viewMemberId}
            />
            {/* Search Controls */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                {/* Mode Toggle + Scope Toggle (Admin) */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="flex bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                        <button
                            onClick={() => setMode('scan')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'scan'
                                ? 'bg-primary-500 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Scan
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'manual'
                                ? 'bg-primary-500 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Manual
                        </button>
                    </div>

                    {user?.role === 'admin' && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Scope:</span>
                            <select
                                className="input py-2 px-3 text-sm"
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                            >
                                <option value="allShifts">All Shifts</option>
                                <option value="currentShift">Current Shift</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Search Input */}
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="input w-full pl-12 pr-4 py-3 text-lg"
                            placeholder="Scan / Enter Receipt No or Transaction Code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>
                    {mode === 'manual' && (
                        <button
                            onClick={() => lookupReceipt(searchQuery)}
                            disabled={isLoading}
                            className="btn-primary px-6"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        </button>
                    )}
                    <button onClick={handleClear} className="btn-secondary px-4">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500" />
                    <p className="text-gray-500 mt-2">Looking up receipt...</p>
                </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                    <AlertCircle className="w-10 h-10 mx-auto text-red-500 mb-3" />
                    <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                </div>
            )}

            {/* Receipt Details Panel */}
            {data && !isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-primary-100 text-sm font-medium">Receipt Number</p>
                                <h2 className="text-2xl font-bold font-mono">{data.payment.receiptNumber}</h2>
                            </div>
                            <div className="flex gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.computed.status === 'Paid' ? 'bg-emerald-500' :
                                    data.computed.status === 'Refunded' ? 'bg-red-500' :
                                        'bg-amber-500'
                                    }`}>
                                    {data.computed.status}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20">
                                    {data.payment.method?.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6">
                        {/* Date & Time */}
                        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                            <Clock className="w-5 h-5" />
                            <span>{formatDateTime(data.payment.paidAt, i18n.language)}</span>
                        </div>

                        {/* Member Info */}
                        {data.member && (
                            <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Member</h4>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-lg">
                                        {data.member.name?.[0]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-900 dark:text-white">{data.member.name}</p>
                                            <button
                                                onClick={() => setViewMemberId(data.member.id)}
                                                className="p-1 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-full transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4 text-primary-500" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500">{data.member.code}</p>
                                    </div>
                                    {data.member.phone && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto">
                                            <Phone className="w-4 h-4" />
                                            {data.member.phone}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Plan Info */}
                        {data.subscription && (
                            <div className="flex items-center gap-3">
                                <CreditCard className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-700 dark:text-gray-300">
                                    {data.subscription.planName} ({data.subscription.duration} days)
                                </span>
                            </div>
                        )}

                        {/* Financial Summary */}
                        <div className="border-t border-gray-100 dark:border-dark-700 pt-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Original Paid</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(data.computed.originalPaid, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Refunded</p>
                                    <p className="text-xl font-bold text-red-500">
                                        -{formatCurrency(data.computed.refundedTotal, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
                                    <p className="text-xl font-bold text-emerald-500">
                                        {formatCurrency(data.computed.remainingBalance, i18n.language, currencyConf)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Paid By / Shift */}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Paid By: <span className="font-medium text-gray-700 dark:text-gray-300">{data.paidBy?.name}</span>
                            </div>
                            {data.shift && (
                                <div className="flex items-center gap-2">
                                    <Banknote className="w-4 h-4" />
                                    Shift: <span className="font-medium text-gray-700 dark:text-gray-300">#{data.shift.id}</span>
                                </div>
                            )}
                            {data.payment.transactionRef && (
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" />
                                    Ref: <span className="font-mono text-gray-700 dark:text-gray-300">{data.payment.transactionRef}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Refund History */}
                    {data.refunds && data.refunds.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-dark-700 p-6">
                            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">Refund History</h4>
                            <div className="space-y-3">
                                {data.refunds.map(refund => (
                                    <div key={refund.id} className="bg-gray-50 dark:bg-dark-700/50 rounded-lg p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                                <RefreshCcw className="w-5 h-5 text-red-500" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-red-500">
                                                    -{formatCurrency(refund.amount, i18n.language, currencyConf)}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDateTime(refund.createdAt, i18n.language)} • {refund.refundedBy}
                                                </p>
                                                {refund.reason && (
                                                    <p className="text-xs text-gray-400 mt-1">Reason: {refund.reason}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono text-gray-400">{refund.auditTrace}</span>
                                            <button
                                                onClick={() => handlePrintRefund(refund.id)}
                                                className="btn-secondary text-xs px-3 py-1.5"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Print Payment Button */}
                    <div className="bg-gray-50 dark:bg-dark-700/50 p-4 flex justify-center">
                        <button onClick={handlePrintPayment} className="btn-primary">
                            <Printer className="w-5 h-5" />
                            Print Payment Receipt
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Empty State */}
            {!data && !isLoading && !error && (
                <div className="bg-white dark:bg-dark-800 p-16 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 text-center">
                    <Receipt className="w-16 h-16 mx-auto text-gray-300 dark:text-dark-500 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Digital Receipt Book</h3>
                    <p className="text-gray-500 dark:text-dark-400">Scan or enter a receipt number to view details</p>
                </div>
            )}
        </div>
    );
};

// ============================================
// PAYMENT REMAINING REPORT (تقرير المديونية)
// Admin-only: Outstanding & Settled Dues
// ============================================
const PaymentRemainingReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { user } = useAuthStore();
    const { getSetting } = useSettingsStore();

    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    const [filters, setFilters] = useState({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        search: '',
        planId: '',
        status: [],
        employeeId: '',
        remainingOnly: false
    });
    const [plans, setPlans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [ledgerTarget, setLedgerTarget] = useState(null); // { memberId, subscriptionId, memberName }
    const [viewMemberId, setViewMemberId] = useState(null);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    useEffect(() => {
        if (isActive) {
            fetchPlans();
            fetchEmployees();
        }
    }, [isActive]);

    const fetchPlans = async () => {
        try {
            const res = await apiClient.get('/plans');
            setPlans(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchEmployees = async () => {
        try {
            const res = await apiClient.get('/users/list');
            setEmployees(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                from: filters.from,
                to: filters.to
            });
            if (filters.search) params.append('search', filters.search);
            if (filters.planId) params.append('planId', filters.planId);
            if (filters.status.length > 0) params.append('status', filters.status.join(','));
            if (filters.employeeId) params.append('employeeId', filters.employeeId);
            if (filters.remainingOnly) params.append('remainingOnly', 'true');

            const res = await apiClient.get(`/reports/payment-remaining?${params}`);
            setData(normalizeReportResponse(res.data.success ? res.data.data : null));
        } catch (error) {
            console.error('Payment remaining report error:', error);
            toast.error('Failed to fetch report');
            setData(normalizeReportResponse(null)); // Safe default
        } finally {
            setIsLoading(false);
        }
    };

    const exportExcel = async () => {
        try {
            const params = new URLSearchParams({
                from: filters.from,
                to: filters.to,
                format: 'excel'
            });
            if (filters.search) params.append('search', filters.search);
            if (filters.planId) params.append('planId', filters.planId);
            if (filters.status.length > 0) params.append('status', filters.status.join(','));
            if (filters.employeeId) params.append('employeeId', filters.employeeId);
            if (filters.remainingOnly) params.append('remainingOnly', 'true');

            const res = await apiClient.get(`/reports/payment-remaining?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'payment-remaining-report.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Report exported');
        } catch (error) {
            toast.error('Export failed');
        }
    };

    const getStatusBadge = (status) => {
        const configs = {
            unpaid: { label: 'غير مسدد', class: 'bg-red-500/20 text-red-400' },
            partial: { label: 'سداد جزئي', class: 'bg-amber-500/20 text-amber-400' },
            settled: { label: 'تم السداد', class: 'bg-emerald-500/20 text-emerald-400' },
            overpaid: { label: 'دفع زائد', class: 'bg-blue-500/20 text-blue-400' }
        };
        const cfg = configs[status] || configs.unpaid;
        return <span className={`px-2 py-1 rounded-full text-xs font-bold ${cfg.class}`}>{cfg.label}</span>;
    };

    const toggleStatus = (s) => {
        setFilters(prev => ({
            ...prev,
            status: prev.status.includes(s)
                ? prev.status.filter(x => x !== s)
                : [...prev.status, s]
        }));
    };

    if (!isActive) return null;

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="label">من</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={filters.from}
                            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">إلى</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={filters.to}
                            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">بحث عن عضو</label>
                        <input
                            type="text"
                            className="input w-full"
                            placeholder="اسم / رقم عضوية / هاتف"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">الباقة</label>
                        <select
                            className="input w-full"
                            value={filters.planId}
                            onChange={(e) => setFilters({ ...filters, planId: e.target.value })}
                        >
                            <option value="">جميع الباقات</option>
                            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Status Multi-Select */}
                    <div className="flex gap-2">
                        {['unpaid', 'partial', 'settled', 'overpaid'].map(s => (
                            <button
                                key={s}
                                onClick={() => toggleStatus(s)}
                                className={`px-3 py-1.5 text-xs rounded-md transition-all ${filters.status.includes(s)
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                    }`}
                            >
                                {s === 'unpaid' ? 'غير مسدد' : s === 'partial' ? 'جزئي' : s === 'settled' ? 'تم السداد' : 'زائد'}
                            </button>
                        ))}
                    </div>

                    {/* Employee Filter */}
                    <select
                        className="input py-2 text-sm"
                        value={filters.employeeId}
                        onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                    >
                        <option value="">جميع الموظفين</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                    </select>

                    {/* Remaining Only Toggle */}
                    <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={filters.remainingOnly}
                            onChange={(e) => setFilters({ ...filters, remainingOnly: e.target.checked })}
                            className="rounded"
                        />
                        إظهار المتبقي فقط
                    </label>

                    <div className="flex-1" />

                    <button onClick={fetchReport} disabled={isLoading} className="btn-primary">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        تحديث
                    </button>
                    <button onClick={exportExcel} className="btn-secondary">
                        <Download className="w-4 h-4" />
                        تصدير Excel
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                        <p className="text-sm text-gray-500">إجمالي المستحق</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(data.summary.totalDue, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                        <p className="text-sm text-gray-500">المدفوع</p>
                        <p className="text-2xl font-bold text-emerald-500">
                            {formatCurrency(data.summary.totalPaid, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                        <p className="text-sm text-gray-500">المتبقي</p>
                        <p className="text-2xl font-bold text-red-500">
                            {formatCurrency(data.summary.totalRemaining, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                        <p className="text-sm text-gray-500">عدد الحالات</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">{data.summary.countUnpaid}</span>
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">{data.summary.countPartial}</span>
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{data.summary.countSettled}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            {isLoading ? (
                <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500" />
                </div>
            ) : data && data.rows && data.rows.length > 0 ? (
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700/50">
                                <tr>
                                    <th className="px-4 py-3 text-right">اسم العضو</th>
                                    <th className="px-4 py-3 text-right">رقم العضوية</th>
                                    <th className="px-4 py-3 text-right">الباقة</th>
                                    <th className="px-4 py-3 text-right">إجمالي</th>
                                    <th className="px-4 py-3 text-right">مدفوع</th>
                                    <th className="px-4 py-3 text-right">متبقي</th>
                                    <th className="px-4 py-3 text-center">الحالة</th>
                                    <th className="px-4 py-3 text-right">آخر دفعة</th>
                                    <th className="px-4 py-3 text-right">تم بواسطة</th>
                                    <th className="px-4 py-3 text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {data.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-700/30">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.member.name}</td>
                                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.member.memberId}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.plan.name}</td>
                                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                                            {formatCurrency(row.financial.total, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-emerald-500 font-medium">
                                            {formatCurrency(row.financial.paid, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-red-500 font-bold">
                                            {formatCurrency(row.financial.remaining, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-center">{getStatusBadge(row.financial.status)}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {row.timeline.lastPaymentDate ? formatDateTime(row.timeline.lastPaymentDate, i18n.language) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{row.audit.collectorName || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setLedgerTarget({
                                                    memberId: row.member.id,
                                                    subscriptionId: row.subscription.id,
                                                    memberName: row.member.name
                                                })}
                                                className="text-primary-500 hover:text-primary-400 text-xs font-bold underline mr-3"
                                            >
                                                سجل العمليات
                                            </button>
                                            <button
                                                onClick={() => setViewMemberId(row.member.id)}
                                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : data ? (
                <div className="bg-white dark:bg-dark-800 p-12 rounded-2xl text-center">
                    <p className="text-gray-500">لا توجد نتائج</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-dark-800 p-12 rounded-2xl text-center">
                    <DollarSign className="w-12 h-12 mx-auto text-gray-300 dark:text-dark-500 mb-4" />
                    <p className="text-gray-500">اختر نطاق التاريخ ثم اضغط "تحديث"</p>
                </div>
            )}

            {/* Ledger Modal */}
            <MemberLedgerModal
                isOpen={!!ledgerTarget}
                onClose={() => setLedgerTarget(null)}
                memberId={ledgerTarget?.memberId}
                subscriptionId={ledgerTarget?.subscriptionId}
                memberName={ledgerTarget?.memberName}
            />
            <MemberDetailsModal
                isOpen={!!viewMemberId}
                onClose={() => setViewMemberId(null)}
                memberId={viewMemberId}
            />
        </div>
    );
};

const Reports = () => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const { user } = useAuthStore();
    const { getSetting } = useSettingsStore();

    // Parse query params for default report type
    const getInitialReport = () => {
        const params = new URLSearchParams(location.search);
        return params.get('type') || 'members';
    };

    const [selectedReport, setSelectedReport] = useState(getInitialReport());

    // Update selected report when URL changes
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const type = params.get('type');
        if (type) setSelectedReport(type);
    }, [location.search]);
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: '',
    });
    const [employees, setEmployees] = useState([]);
    const [attributionFilters, setAttributionFilters] = useState({
        method: ''
    });

    React.useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await apiClient.get('/users/list');
            setEmployees(res.data.data);
        } catch (e) {
            console.error("Failed to fetch employees");
        }
    };

    // Currency Config
    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };
    const [searchQuery, setSearchQuery] = useState('');
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

    // Cash Closing Sub-tabs
    const [cashClosingTab, setCashClosingTab] = useState('summary'); // 'summary' or 'closings'

    const reportTypes = [
        { id: 'members', name: t('reports.memberReport'), icon: Users },
        { id: 'revenue', name: t('reports.revenueReport'), icon: DollarSign },
        { id: 'paymentsSummary', name: 'ملخص المدفوعات', icon: Receipt },
        { id: 'paymentReceipts', name: 'سجل الإيصالات', icon: FileSpreadsheet },
        ...(user?.role === 'admin' ? [{ id: 'paymentRemaining', name: 'تقرير المديونية', icon: AlertCircle }] : []),
        { id: 'employeeCollections', name: "تحصيل الموظفين", icon: UserCheck },
        { id: 'attendance', name: t('reports.attendanceReport'), icon: Calendar },
        { id: 'subscriptions', name: t('reports.subscriptionReport'), icon: CreditCard },
        { id: 'cancellations', name: i18n.language === 'ar' ? 'إلغاءات الشهر' : 'Cancellations', icon: XCircle },
        { id: 'shifts', name: "Shift Reports", icon: Banknote },
        { id: 'payInOut', name: t('payInOut.title') || 'Pay In / Out', icon: ArrowLeftRight },
        { id: 'sales/products', name: i18n.language === 'ar' ? 'مبيعات المنتجات' : 'Sales (Products)', icon: Banknote },
        { id: 'refunds', name: t('reports.fields.refunds.title'), icon: AlertCircle },
        ...(user?.role === 'admin' ? [{ id: 'cashClosing', name: t('cashClosing.title'), icon: TrendingDown }] : []),
    ];

    const aggregatedData = React.useMemo(() => {
        if (selectedReport !== 'employeeCollections' || !reportData) return [];

        // SAFE ACCESS: Ensure report is an array
        const list = Array.isArray(reportData.report) ? reportData.report : [];

        const groups = {};
        list.forEach(payment => {
            // Priority for employee identification
            const empName = payment.paidBy || payment.collectorEmployeeName || payment.employeeName || payment.createdByName || payment.username || t('payments.unknown');

            if (!groups[empName]) {
                groups[empName] = { name: empName, count: 0, cash: 0, nonCash: 0, total: 0 };
            }

            groups[empName].count++;
            const amount = parseFloat(payment.amount || payment.price || 0);
            const method = String(payment.paymentMethod || payment.method || '').toLowerCase();

            // Match 'cash' case-insensitive or Arabic equivalent
            if (method.includes('cash') || method === 'نقدي' || method === 'manual') {
                groups[empName].cash += amount;
            } else {
                groups[empName].nonCash += amount;
            }
            groups[empName].total += amount;
        });

        return Object.values(groups).sort((a, b) => b.total - a.total);
    }, [reportData, selectedReport, t]);

    const generateReport = async () => {
        setIsLoading(true);
        setReportData(null); // Reset before fetch to avoid stale data issues

        try {
            const params = new URLSearchParams();
            if (dateRange.startDate) {
                params.append('startDate', dateRange.startDate);
                params.append('from', dateRange.startDate); // Backend inconsistent naming support
            }
            if (dateRange.endDate) {
                params.append('endDate', dateRange.endDate);
                params.append('to', dateRange.endDate); // Backend inconsistent naming support
            }

            console.log(`[Report Debug] Generating report: ${selectedReport}`, { dateRange, searchQuery });

            // For cash closing, fetch from different endpoint
            if (selectedReport === 'cashClosing') {
                if (searchQuery) params.append('employeeId', searchQuery); // Use search for employee filter

                console.log('[Report Debug] Endpoint: /api/cash-closings', params.toString());
                const response = await apiClient.get(`/cash-closings?${params}`);
                setReportData(normalizeReportResponse(response.data.data)); // NORMALIZE

            } else {
                // For employeeCollections, we fetch revenue data and aggregate in frontend
                let endpoint = selectedReport === 'employeeCollections' ? 'revenue' : selectedReport;

                // Redirect Product Sales to Detailed View
                if (selectedReport === 'sales/products' || selectedReport === 'sales') {
                    endpoint = 'sales/detailed';
                }

                // For employee collections, use searchQuery as collectorId
                if (selectedReport === 'employeeCollections' && searchQuery) {
                    params.append('collectorId', searchQuery);
                } else if (searchQuery) {
                    params.append('search', searchQuery);
                }

                console.log(`[Report Debug] Endpoint: /api/reports/${endpoint}`, params.toString());
                const response = await apiClient.get(`/reports/${endpoint}?${params}`);
                setReportData(normalizeReportResponse(response.data.data)); // NORMALIZE
            }
        } catch (error) {
            console.error('Report generation error:', error);

            // Temporary debug logging for user
            console.log('[Report Debug] Failed:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });

            if (error.response) {
                const { status, data } = error.response;
                if (data && data.message) {
                    toast.error(`Error: ${data.message}`);
                } else if (status === 400) {
                    toast.error(t('errors.invalidInput') || 'Invalid request parameters');
                } else if (status === 401 || status === 403) {
                    toast.error(t('auth.unauthorized') || 'Access denied');
                } else if (status >= 500) {
                    toast.error(t('errors.serverError') || 'Server error occurred');
                } else {
                    toast.error('Failed to generate report');
                }
            } else if (error.request) {
                toast.error(t('errors.networkError') || 'Network error, please check connection');
            } else {
                toast.error('Failed to generate report');
            }

            setReportData(normalizeReportResponse(null)); // Set empty safe state
        } finally {
            setIsLoading(false);
        }
    };


    const exportToExcel = async () => {
        try {
            const params = new URLSearchParams({ format: 'excel' });
            if (dateRange.startDate) params.append('startDate', dateRange.startDate);
            if (dateRange.endDate) params.append('endDate', dateRange.endDate);

            // For employee collections, use searchQuery as collectorId
            if (selectedReport === 'employeeCollections' && searchQuery) {
                params.append('collectorId', searchQuery);
            } else if (searchQuery) {
                params.append('search', searchQuery);
            }

            if (attributionFilters.method) params.append('method', attributionFilters.method);

            const endpoint = selectedReport === 'employeeCollections' ? 'revenue' : selectedReport;
            const response = await apiClient.get(`/reports/${endpoint}?${params}`, {
                responseType: 'blob',
            });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${selectedReport}-report.xlsx`);

            // Append to body and click for download
            document.body.appendChild(link);
            link.click();

            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('Report exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export report');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('reports.title')}</h1>
                <p className="text-slate-500 dark:text-dark-400 mt-1">Generate and export reports</p>
            </div>

            {/* Report Type Selector */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {reportTypes.map((report) => (
                    <motion.button
                        key={report.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            setSelectedReport(report.id);
                            setReportData(null);
                            setSearchQuery(''); // Reset filter on switch
                        }}
                        className={`p-4 rounded-xl border transition-all text-left ${selectedReport === report.id
                            ? 'bg-primary-50 dark:bg-primary-600/20 border-primary-500'
                            : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                            }`}
                    >
                        <report.icon className={`w-8 h-8 mb-3 ${selectedReport === report.id ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-dark-400'
                            }`} />
                        <p className={`font-medium ${selectedReport === report.id ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-white'
                            }`}>
                            {report.name}
                        </p>
                    </motion.button>
                ))}
            </div>

            {/* Filters */}
            {selectedReport !== 'shifts' && selectedReport !== 'refunds' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('reports.dateRange')}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="label">{t('reports.from')}</label>
                            <input
                                type="datetime-local"
                                className="input"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="label">{t('reports.to')}</label>
                            <input
                                type="datetime-local"
                                className="input"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                        </div>

                        <div>
                            {selectedReport === 'employeeCollections' ? (
                                <>
                                    <label className="label">اختر الموظف</label>
                                    <select
                                        className="input"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    >
                                        <option value="">{t('common.all')}</option>
                                        {employees.map((emp) => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.firstName} {emp.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            ) : (
                                <>
                                    <label className="label">{t('common.search') || 'Search'}</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder={t('members.searchPlaceholder') || 'Search by name/phone...'}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </>
                            )}
                        </div>

                        {(selectedReport === 'revenue' || selectedReport === 'subscriptions' || selectedReport === 'employeeCollections') && (
                            <div>
                                <label className="label">{t('payments.method')}</label>
                                <select
                                    className="input"
                                    value={attributionFilters.method}
                                    onChange={(e) => setAttributionFilters({ ...attributionFilters, method: e.target.value })}
                                >
                                    <option value="">{t('common.all')}</option>
                                    <option value="cash">{t('payments.cash')}</option>
                                    <option value="card">{t('payments.card')}</option>
                                    <option value="transfer">{t('payments.transfer')}</option>
                                </select>
                            </div>
                        )}

                        <div className="flex items-end gap-2">
                            <button
                                onClick={generateReport}
                                disabled={isLoading}
                                className="btn-primary flex-1 text-white"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <BarChart3 className="w-5 h-5" />
                                        {t('reports.generate')}
                                    </>
                                )}
                            </button>

                            {reportData && selectedReport !== 'employeeCollections' && (
                                <button onClick={exportToExcel} className="btn-secondary">
                                    <FileSpreadsheet className="w-5 h-5" />
                                    Excel
                                </button>
                            )}

                            {/* Add Create Closing button for cashClosing report */}
                            {selectedReport === 'cashClosing' && user?.role === 'admin' && (
                                <button
                                    onClick={() => setIsClosingModalOpen(true)}
                                    className="btn-primary"
                                >
                                    <Plus className="w-5 h-5" />
                                    {t('cashClosing.createClosing')}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Employee Collections Summary */}
            {reportData && selectedReport === 'employeeCollections' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">تحصيل الموظفين</h3>
                        <p className="text-sm text-slate-500 dark:text-dark-400">ملخص تحصيل الموظفين في الفترة المحددة</p>
                    </div>

                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>الموظف</th>
                                    <th>عدد العمليات</th>
                                    <th>نقدي</th>
                                    <th>بطاقة/غير نقدي</th>
                                    <th>الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggregatedData.map((row, index) => (
                                    <tr key={index}>
                                        <td className="font-medium text-slate-900 dark:text-white">{row.name}</td>
                                        <td>{formatNumber(row.count, i18n.language)}</td>
                                        <td className="text-emerald-500 font-mono">
                                            {formatCurrency(row.cash, i18n.language, currencyConf)}
                                        </td>
                                        <td className="text-blue-500 font-mono">
                                            {formatCurrency(row.nonCash, i18n.language, currencyConf)}
                                        </td>
                                        <td className="font-bold text-slate-900 dark:text-white font-mono">
                                            {formatCurrency(row.total, i18n.language, currencyConf)}
                                        </td>
                                    </tr>
                                ))}
                                {aggregatedData.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="text-center py-8 text-slate-500">
                                            لا توجد بيانات تحصيل في هذه الفترة
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {/* Report Results */}
            {selectedReport === 'shifts' && <ShiftReports isActive={true} />}
            {selectedReport === 'payInOut' && <CashMovementsReport isActive={true} />}
            {selectedReport === 'refunds' && <RefundsReport isActive={true} />}
            {selectedReport === 'paymentsSummary' && <PaymentsSummaryReport isActive={true} />}
            {selectedReport === 'cancellations' && <CancellationsReport isActive={true} />}
            {selectedReport === 'paymentReceipts' && <ReceiptLookupReport isActive={true} />}
            {selectedReport === 'paymentRemaining' && <PaymentRemainingReport isActive={true} />}
            {selectedReport === 'sales/products' && <SalesProductReport data={reportData} />}
            {selectedReport === 'cashClosing' && <CashClosingReport data={reportData} onRefresh={generateReport} />}

            {reportData && selectedReport !== 'cashClosing' && selectedReport !== 'employeeCollections' && selectedReport !== 'sales/products' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    {/* Summary */}
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-dark-900/50 rounded-xl">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">{t('reports.summary') || 'Summary'}</h3>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
                            {Object.entries(reportData.summary).map(([key, value]) => {
                                if (typeof value === 'object') return null;
                                // Translate summary keys if possible, falling back to capitalized
                                const label = t(`reports.fields.${key}`, { defaultValue: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) });
                                return (
                                    <div key={key} className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm flex flex-col justify-center h-full">
                                        <p className="text-slate-500 dark:text-dark-400 text-sm font-medium capitalize mb-1">{label}</p>
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white truncate" title={typeof value === 'number' ? value.toLocaleString() : value}>
                                            {typeof value === 'number' ? value.toLocaleString() : value}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Data Table */}
                    {(selectedReport === 'sales/products' || selectedReport === 'sales') && reportData ? (
                        <SalesProductReport data={reportData} />
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        {reportData.report && reportData.report.length > 0 &&
                                            Object.keys(reportData.report[0]).map((key) => (
                                                <th key={key}>
                                                    {/* Try to translate key using standard mappings */}
                                                    {t(`members.${key}`, {
                                                        defaultValue: t(`reports.fields.${key}`, {
                                                            defaultValue: t(`common.${key}`, {
                                                                defaultValue: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                                                            })
                                                        })
                                                    })}
                                                </th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(reportData.report || []).slice(0, 50).map((row, index) => (
                                        <tr key={index}>
                                            {Object.entries(row).map(([key, value], i) => {
                                                // 1) Handle specific objects based on key name
                                                if (key === 'member' && typeof value === 'object') {
                                                    return (
                                                        <td key={i} className="px-4 py-3">
                                                            <div className="font-semibold text-slate-900 dark:text-white">
                                                                {safe(value.fullName || value.name)}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-mono">
                                                                ID: {safe(value.memberId || value.code)} • {safe(value.phone)}
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                if (key === 'plan' && typeof value === 'object') {
                                                    return (
                                                        <td key={i} className="px-4 py-3">
                                                            <div className="font-medium text-slate-700 dark:text-slate-200">
                                                                {safe(value.name)}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500">
                                                                {value.durationDays || value.days || value.duration || '—'} {t('common.days')}
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                if ((key === 'financials' || key === 'financial') && typeof value === 'object') {
                                                    return (
                                                        <td key={i} className="px-4 py-3 text-right font-mono">
                                                            <div className="text-xs font-bold text-emerald-500">
                                                                {t('payments.paid')}: {formatCurrency(safeNum(value.paidAmount || value.paid), i18n.language, currencyConf)}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {t('reports.fields.refunds.title')}: {formatCurrency(safeNum(value.refundedAmount || value.refunded), i18n.language, currencyConf)}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-slate-600 dark:text-dark-300">
                                                                {t('reports.fields.net_revenue')}: {formatCurrency(safeNum(value.netRevenue || value.netPaid || value.net), i18n.language, currencyConf)}
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                // 2) Default formatting for primitives
                                                return (
                                                    <td key={i} className="px-4 py-3 text-slate-700 dark:text-dark-300">
                                                        {(key.toLowerCase().includes('date') || key.toLowerCase().includes('time') || key === 'checkIn' || key === 'checkOut' || key === 'paidAt' || key === 'canceledAt') && value && value !== 'N/A'
                                                            ? formatDateTime(value, i18n.language)
                                                            : key === 'paidBy' || key === 'processedBy'
                                                                ? <div className="flex items-center gap-2 font-medium"><User className="w-3.5 h-3.5 text-dark-400" /> {typeof value === 'object' ? value.name : safe(value)}</div>
                                                                : key === 'paymentMethod'
                                                                    ? <div className="flex items-center gap-2 text-xs">{value === 'cash' ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />} {t(`payments.${value}`)}</div>
                                                                    : (key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('cost') || key === 'originalPaid') && typeof value === 'number'
                                                                        ? formatCurrency(value, i18n.language, currencyConf)
                                                                        : (typeof value === 'number' ? formatNumber(value, i18n.language) : (key === 'status' ? t(`members.${value}`, { defaultValue: value }) : safe(value)))}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}


                    {reportData.report.length > 50 && (
                        <p className="text-slate-500 dark:text-dark-400 text-sm mt-4 text-center">
                            Showing first 50 rows of {reportData.report.length} total
                        </p>
                    )}
                </motion.div>
            )}

            {/* Cash Closing Report (Admin Only) - Tabbed Interface */}
            {selectedReport === 'cashClosing' && user?.role === 'admin' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {t('cashClosing.title')}
                        </h3>
                    </div>

                    {/* Sub-tabs for Cash Closing */}
                    <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-dark-700">
                        <button
                            onClick={() => setCashClosingTab('summary')}
                            className={`px-4 py-2 transition-colors ${cashClosingTab === 'summary'
                                ? 'border-b-2 border-primary-500 text-primary-500 font-medium'
                                : 'text-dark-400 hover:text-white'
                                }`}
                        >
                            {t('cashClosing.monthlySummary') || 'ملخص التحصيل الشهري'}
                        </button>
                        <button
                            onClick={() => setCashClosingTab('closings')}
                            className={`px-4 py-2 transition-colors ${cashClosingTab === 'closings'
                                ? 'border-b-2 border-primary-500 text-primary-500 font-medium'
                                : 'text-dark-400 hover:text-white'
                                }`}
                        >
                            {t('cashClosing.createClosingTab') || 'إنشاء تقفيل'}
                        </button>
                    </div>

                    {/* Tab Content */}
                    {cashClosingTab === 'summary' ? (
                        <MonthlyCollectionSummary />
                    ) : (
                        <>
                            {/* Create Closing Button */}
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => setIsClosingModalOpen(true)}
                                    className="btn-primary"
                                >
                                    <Plus className="w-5 h-5" />
                                    {t('cashClosing.createClosing')}
                                </button>
                            </div>

                            {/* Existing Closings Table */}
                            {reportData && reportData.closings && reportData.closings.length > 0 ? (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>{t('cashClosing.employee')}</th>
                                                <th>{t('cashClosing.period')}</th>
                                                <th>{t('cashClosing.expectedCash')}</th>
                                                <th>{t('cashClosing.expectedNonCash')}</th>
                                                <th>{t('cashClosing.expectedTotal')}</th>
                                                <th>{t('cashClosing.declaredCash')}</th>
                                                <th>{t('cashClosing.declaredNonCash')}</th>
                                                <th>{t('cashClosing.declaredTotal')}</th>
                                                <th>{t('cashClosing.differenceTotal')}</th>
                                                <th>{t('common.status')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.closings.map((closing) => (
                                                <tr key={closing.id}>
                                                    <td>{closing.employeeName || t('cashClosing.allEmployees')}</td>
                                                    <td className="text-xs">
                                                        {formatDateTime(closing.startAt, i18n.language)}
                                                        <br />→ {formatDateTime(closing.endAt, i18n.language)}
                                                    </td>
                                                    <td>{formatCurrency(closing.expectedCashAmount, i18n.language, currencyConf)}</td>
                                                    <td>{formatCurrency(closing.expectedNonCashAmount, i18n.language, currencyConf)}</td>
                                                    <td className="font-semibold">{formatCurrency(closing.expectedTotalAmount, i18n.language, currencyConf)}</td>
                                                    <td>{formatCurrency(closing.declaredCashAmount, i18n.language, currencyConf)}</td>
                                                    <td>{formatCurrency(closing.declaredNonCashAmount, i18n.language, currencyConf)}</td>
                                                    <td className="font-semibold">{formatCurrency(closing.declaredTotalAmount, i18n.language, currencyConf)}</td>
                                                    <td className={`font-bold ${closing.differenceTotal < 0 ? 'text-red-400' : closing.differenceTotal > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                        {closing.differenceTotal >= 0 ? '+' : ''}{formatCurrency(closing.differenceTotal, i18n.language, currencyConf)}
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${closing.status === 'shortage' ? 'badge-error' :
                                                            closing.status === 'overage' ? 'badge-warning' :
                                                                'badge-success'
                                                            }`}>
                                                            {t(`cashClosing.status.${closing.status}`)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {/* Summary Row */}
                                        {reportData.summary && (
                                            <tfoot>
                                                <tr className="bg-dark-900/50 font-bold">
                                                    <td colSpan="2">{t('cashClosing.summary')}</td>
                                                    <td>{formatCurrency(reportData.summary.totalExpectedCash, i18n.language, currencyConf)}</td>
                                                    <td>{formatCurrency(reportData.summary.totalExpectedNonCash, i18n.language, currencyConf)}</td>
                                                    <td>{formatCurrency(reportData.summary.totalExpected, i18n.language, currencyConf)}</td>
                                                    <td>{formatCurrency(reportData.summary.totalDeclaredCash, i18n.language, currencyConf)}</td>
                                                    <td>{formatCurrency(reportData.summary.totalDeclaredNonCash, i18n.language, currencyConf)}</td>
                                                    <td>{formatCurrency(reportData.summary.totalDeclared, i18n.language, currencyConf)}</td>
                                                    <td className={`${reportData.summary.totalDifference < 0 ? 'text-red-400' : reportData.summary.totalDifference > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                        {reportData.summary.totalDifference >= 0 ? '+' : ''}{formatCurrency(reportData.summary.totalDifference, i18n.language, currencyConf)}
                                                    </td>
                                                    <td>-</td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-dark-500">{t('cashClosing.noClosings')}</p>
                                    <button
                                        onClick={() => setIsClosingModalOpen(true)}
                                        className="btn-primary mt-4"
                                    >
                                        <Plus className="w-5 h-5" />
                                        {t('cashClosing.createClosing')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            )}

            {/* Cash Closing Modal */}
            <CashClosingModal
                isOpen={isClosingModalOpen}
                onClose={() => setIsClosingModalOpen(false)}
                onSuccess={() => {
                    generateReport(); // Refresh the list
                }}
            />
        </div>
    );
};

export default Reports;
