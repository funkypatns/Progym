/**
 * ============================================
 * CASH CLOSING MODAL
 * ============================================
 * 
 * Admin-only modal for creating cash closings
 * Features live calculations and immutability warnings
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, DollarSign, TrendingDown, TrendingUp, Minus, Users, CreditCard, FileText, CheckCircle, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore, useAuthStore } from '../store';

const CashClosingModal = ({ isOpen, onClose, onSuccess }) => {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';
    const { getSetting } = useSettingsStore();
    const { user } = useAuthStore();

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    // Form state
    const [formData, setFormData] = useState({
        employeeId: '',
        periodType: 'daily',
        startAt: '',
        endAt: '',
        declaredCashAmount: '', // Empty by default to detect "not entered"
        declaredNonCashAmount: '',
        notes: ''
    });

    // Expected amounts (fetched from API)
    const [expectedAmounts, setExpectedAmounts] = useState({
        expectedCashAmount: 0,
        expectedNonCashAmount: 0,
        expectedTotalAmount: 0,
        cardTotal: 0,
        transferTotal: 0,
        paymentCount: 0
    });
    const [salesPreview, setSalesPreview] = useState({
        totalRevenue: 0,
        totalUnits: 0,
        transactionsCount: 0,
        topProducts: []
    });

    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingExpected, setIsFetchingExpected] = useState(false);
    const [isFetchingSales, setIsFetchingSales] = useState(false);

    // NEW: Financial Snapshot State
    const [financialSnapshot, setFinancialSnapshot] = useState({
        totalSessions: 0,
        grossRevenue: 0,
        totalCoachCommissions: 0,
        gymNetIncome: 0,
        breakdownByCoach: [],
        breakdownByService: []
    });
    const [isFetchingSnapshot, setIsFetchingSnapshot] = useState(false);

    const toLocalInputValue = (date) => {
        const pad = (val) => String(val).padStart(2, '0');
        const d = new Date(date);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const getPeriodRange = (periodType) => {
        const now = new Date();
        if (periodType === 'daily') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            return { startAt: toLocalInputValue(start), endAt: toLocalInputValue(now) };
        }
        if (periodType === 'monthly') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            return { startAt: toLocalInputValue(start), endAt: toLocalInputValue(now) };
        }
        return null;
    };

    const getErrorMessage = (error, fallback) => {
        const response = error?.response?.data;
        if (response?.message) return response.message;
        if (Array.isArray(response?.errors) && response.errors[0]?.msg) return response.errors[0].msg;
        if (error?.message) return error.message;
        return fallback;
    };

    // Fetch employees on mount
    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            const range = getPeriodRange('daily');
            setFormData(prev => ({
                ...prev,
                startAt: range?.startAt || '',
                endAt: range?.endAt || '',
                declaredCashAmount: '',
                declaredNonCashAmount: ''
            }));
        }
    }, [isOpen]);

    // Fetch expected amounts when dates or employee change
    useEffect(() => {
        if (formData.startAt && formData.endAt) {
            fetchExpectedAmounts();
            fetchSalesPreview();
            fetchFinancialSnapshot();
        }
    }, [formData.startAt, formData.endAt, formData.employeeId]);

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/users/list');
            const employeeList = response.data.data || [];
            setEmployees(employeeList);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
            setEmployees([]);
        }
    };

    const fetchExpectedAmounts = async () => {
        if (!formData.startAt || !formData.endAt) return;

        setIsFetchingExpected(true);
        try {
            const params = new URLSearchParams({
                startAt: formData.startAt,
                endAt: formData.endAt
            });

            // Only append employeeId if a specific one is selected (not 'all' or empty)
            if (formData.employeeId && formData.employeeId !== 'all') {
                params.append('employeeId', formData.employeeId);
            }

            const response = await api.get(`/cash-closings/calculate-expected?${params}`);

            // Safe fallback for null/undefined values
            const data = response.data.data || {};
            setExpectedAmounts({
                expectedCashAmount: Number(data.expectedCashAmount) || 0,
                expectedNonCashAmount: Number(data.expectedNonCashAmount) || 0,
                expectedTotalAmount: Number(data.expectedTotalAmount) || 0,
                cardTotal: Number(data.cardTotal) || 0,
                transferTotal: Number(data.transferTotal) || 0,
                paymentCount: Number(data.paymentCount) || 0
            });
        } catch (error) {
            console.error('Failed to fetch expected amounts:', error);
            toast.error(getErrorMessage(error, 'Failed to calculate expected amounts'));
            // Reset to zero on error
            setExpectedAmounts({
                expectedCashAmount: 0,
                expectedNonCashAmount: 0,
                expectedTotalAmount: 0,
                cardTotal: 0,
                transferTotal: 0,
                paymentCount: 0
            });
        } finally {
            setIsFetchingExpected(false);
        }
    };

    const fetchSalesPreview = async () => {
        if (!formData.startAt || !formData.endAt) return;

        setIsFetchingSales(true);
        try {
            const params = new URLSearchParams({
                startAt: formData.startAt,
                endAt: formData.endAt
            });

            if (formData.employeeId && formData.employeeId !== 'all') {
                params.append('employeeId', formData.employeeId);
            }

            const response = await api.get(`/cash-closings/sales-preview?${params}`);
            const data = response.data.data || {};
            setSalesPreview({
                totalRevenue: Number(data.totalRevenue) || 0,
                totalUnits: Number(data.totalUnits) || 0,
                transactionsCount: Number(data.transactionsCount) || 0,
                topProducts: Array.isArray(data.topProducts) ? data.topProducts : []
            });
        } catch (error) {
            console.error('Failed to fetch sales preview:', error);
            setSalesPreview({
                totalRevenue: 0,
                totalUnits: 0,
                transactionsCount: 0,
                topProducts: []
            });
        } finally {
            setIsFetchingSales(false);
        }
    };

    const fetchFinancialSnapshot = async () => {
        if (!formData.startAt || !formData.endAt) return;
        setIsFetchingSnapshot(true);
        try {
            const params = new URLSearchParams({ startAt: formData.startAt, endAt: formData.endAt });
            const response = await api.get(`/cash-closings/financial-preview?${params}`);
            const data = response.data.data || {};
            setFinancialSnapshot({
                totalSessions: Number(data.totalSessions) || 0,
                grossRevenue: Number(data.grossRevenue) || 0,
                totalCoachCommissions: Number(data.totalCoachCommissions) || 0,
                gymNetIncome: Number(data.gymNetIncome) || 0,
                breakdownByCoach: Array.isArray(data.breakdownByCoach) ? data.breakdownByCoach : [],
                breakdownByService: Array.isArray(data.breakdownByService) ? data.breakdownByService : []
            });
        } catch (error) {
            console.error('Failed to fetch financial snapshot:', error);
        } finally {
            setIsFetchingSnapshot(false);
        }
    };

    // Calculate declared total and differences
    // Treat empty string as 0 for calculation, but keep raw for status check
    const rawDeclaredCash = formData.declaredCashAmount;
    const rawDeclaredNonCash = formData.declaredNonCashAmount;
    const valDeclaredCash = rawDeclaredCash === '' ? 0 : parseFloat(rawDeclaredCash);
    const valDeclaredNonCash = rawDeclaredNonCash === '' ? 0 : parseFloat(rawDeclaredNonCash);

    const declaredTotal = valDeclaredCash + valDeclaredNonCash;
    const differenceCash = valDeclaredCash - expectedAmounts.expectedCashAmount;
    const differenceNonCash = valDeclaredNonCash - expectedAmounts.expectedNonCashAmount;
    const differenceTotal = declaredTotal - expectedAmounts.expectedTotalAmount;
    const hasDeclaredCash = rawDeclaredCash !== '';
    const diffNonCashColor = differenceNonCash < -0.01 ? 'text-red-500' : differenceNonCash > 0.01 ? 'text-orange-500' : 'text-emerald-500';
    const diffTotalColor = differenceTotal < -0.01 ? 'text-red-500' : differenceTotal > 0.01 ? 'text-orange-500' : 'text-emerald-500';
    const formatSignedDiff = (value) => {
        if (!hasDeclaredCash) return '--';
        const safeValue = Number.isFinite(value) ? value : 0;
        const sign = safeValue > 0 ? '+' : '';
        return `${sign}${formatCurrency(safeValue, i18n.language, currencyConf)}`;
    };
    const declaredTotalDisplay = hasDeclaredCash
        ? formatCurrency(declaredTotal || 0, i18n.language, currencyConf)
        : '--';

    // Determine status
    let status = 'pending';
    let statusColor = 'text-gray-400';
    let StatusIcon = AlertTriangle; // Neutral icon
    let statusText = t('common.pending') || 'Pending';

    if (hasDeclaredCash) {
        if (differenceCash < -0.01) { // Tolerance
            status = 'shortage';
            statusColor = 'text-red-500';
            StatusIcon = TrendingDown;
            statusText = t('cashClosing.status.shortage') || 'Shortage';
        } else if (differenceCash > 0.01) {
            status = 'overage';
            statusColor = 'text-orange-500';
            StatusIcon = TrendingUp;
            statusText = t('cashClosing.status.overage') || 'Overage';
        } else {
            status = 'balanced';
            statusColor = 'text-emerald-500';
            StatusIcon = CheckCircle;
            statusText = t('cashClosing.status.balanced') || 'Balanced';
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.startAt || !formData.endAt) {
            toast.error('Please select start and end dates');
            return;
        }

        if (formData.declaredCashAmount === '') {
            toast.error(t('cashClosing.enterDeclaredCash') || 'Please enter declared cash amount');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                ...formData,
                employeeId: (formData.employeeId && formData.employeeId !== 'all') ? parseInt(formData.employeeId) : undefined,
                declaredCashAmount: parseFloat(formData.declaredCashAmount || 0),
                declaredNonCashAmount: parseFloat(formData.declaredNonCashAmount || 0)
            };

            await api.post('/cash-closings', payload);
            toast.success(t('cashClosing.closingCreated'));
            onSuccess();
            handleClose();
        } catch (error) {
            console.error('Failed to create closing:', error);
            toast.error(getErrorMessage(error, t('cashClosing.closingFailed')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            employeeId: '',
            periodType: 'daily',
            startAt: '',
            endAt: '',
            declaredCashAmount: '',
            declaredNonCashAmount: '',
            notes: ''
        });
        setExpectedAmounts({
            expectedCashAmount: 0,
            expectedNonCashAmount: 0,
            expectedTotalAmount: 0,
            cardTotal: 0,
            transferTotal: 0,
            paymentCount: 0
        });
        setSalesPreview({
            totalRevenue: 0,
            totalUnits: 0,
            transactionsCount: 0,
            topProducts: []
        });
        onClose();
    };

    const getBadgeStyle = (status) => {
        switch (status) {
            case 'shortage': return 'bg-red-500/10 text-red-400 border border-red-500/20';
            case 'overage': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
            case 'balanced': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
        }
    };



    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 p-6 flex items-center justify-between z-10">
                        <div>
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                {t('cashClosing.createClosing')}
                            </h2>
                            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                                <AlertTriangle size={14} className="text-amber-500" />
                                {t('cashClosing.immutableWarning')}
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-8">

                        {/* 1. Configuration Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('cashClosing.employee')}</label>
                                <select
                                    className="w-full h-11 px-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm text-white"
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                                >
                                    <option value="">{t('cashClosing.selectEmployee') || 'اختر موظف'}</option>
                                    <option value="all">{t('cashClosing.allEmployees')}</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.firstName} {emp.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('cashClosing.period')}</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <select
                                        className="w-full h-11 px-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm text-white"
                                        value={formData.periodType}
                                        onChange={(e) => {
                                            const nextPeriod = e.target.value;
                                            const range = getPeriodRange(nextPeriod);
                                            setFormData(prev => ({
                                                ...prev,
                                                periodType: nextPeriod,
                                                ...(range ? { startAt: range.startAt, endAt: range.endAt } : {})
                                            }));
                                        }}
                                    >
                                        <option value="daily">{t('cashClosing.periodType.daily')}</option>
                                        <option value="monthly">{t('cashClosing.periodType.monthly')}</option>
                                        <option value="custom">{t('cashClosing.periodType.custom')}</option>
                                        <option value="shift">{t('cashClosing.periodType.shift')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Date Range Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400">{t('reports.from')}</label>
                                <input
                                    type="datetime-local"
                                    className="w-full h-10 px-3 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:border-indigo-500 outline-none"
                                    value={formData.startAt}
                                    onChange={(e) => setFormData(prev => ({ ...prev, startAt: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400">{t('reports.to')}</label>
                                <input
                                    type="datetime-local"
                                    className="w-full h-10 px-3 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:border-indigo-500 outline-none"
                                    value={formData.endAt}
                                    onChange={(e) => setFormData(prev => ({ ...prev, endAt: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>


                        {/* 2. Financial Snapshot (Redesigned) */}
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-400 uppercase tracking-widest pl-1">
                                <TrendingUp size={16} />
                                {t('cashClosing.financialSnapshot.title', 'Financial Snapshot (Performance)')}
                            </h4>

                            {isFetchingSnapshot ? (
                                <div className="h-32 flex items-center justify-center bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                                    <div className="flex items-center gap-3 text-indigo-400/70 text-sm animate-pulse">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                                        {t('common.calculating', 'Calculating financial data...')}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Card 1: Total Sessions */}
                                    <div className="group relative bg-slate-800/40 hover:bg-slate-800/60 transition-all duration-300 rounded-2xl p-5 border border-slate-700/50 hover:border-indigo-500/30 overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Users size={48} className="text-white" />
                                        </div>
                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{t('cashClosing.financialSnapshot.totalSessions', 'Total Sessions')}</p>
                                        <p className="text-3xl font-black text-white mb-1">{financialSnapshot.totalSessions}</p>
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 w-fit px-2 py-0.5 rounded-full">
                                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                            {t('cashClosing.financialSnapshot.completedOnly', 'Completed only')}
                                        </div>
                                    </div>

                                    {/* Card 2: Gross Revenue */}
                                    <div className="group relative bg-slate-800/40 hover:bg-slate-800/60 transition-all duration-300 rounded-2xl p-5 border border-slate-700/50 hover:border-blue-500/30 overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <DollarSign size={48} className="text-blue-400" />
                                        </div>
                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{t('cashClosing.financialSnapshot.grossRevenue', 'Gross Revenue')}</p>
                                        <p className="text-3xl font-black text-blue-400 mb-1">{formatCurrency(financialSnapshot.grossRevenue, i18n.language, currencyConf)}</p>
                                        <p className="text-[10px] text-gray-500 font-medium">{t('cashClosing.financialSnapshot.sessionFees', 'Session Fees')}</p>
                                    </div>

                                    {/* Card 3: Commissions */}
                                    <div className="group relative bg-slate-800/40 hover:bg-slate-800/60 transition-all duration-300 rounded-2xl p-5 border border-slate-700/50 hover:border-amber-500/30 overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <CreditCard size={48} className="text-amber-400" />
                                        </div>
                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{t('cashClosing.financialSnapshot.totalCommissions', 'Total Commissions')}</p>
                                        <p className="text-3xl font-black text-amber-500 mb-1">{formatCurrency(financialSnapshot.totalCoachCommissions, i18n.language, currencyConf)}</p>
                                        <p className="text-[10px] text-amber-500/60 font-medium">{t('cashClosing.financialSnapshot.toBePaidOut', 'To be paid out')}</p>
                                    </div>

                                    {/* Card 4: Net Income */}
                                    <div className="group relative bg-gradient-to-br from-emerald-900/20 to-slate-900/40 hover:from-emerald-900/30 transition-all duration-300 rounded-2xl p-5 border border-emerald-500/20 hover:border-emerald-500/40 overflow-hidden">
                                        <div className="absolute -right-4 -bottom-4 opacity-10">
                                            <div className="w-24 h-24 bg-emerald-500 rounded-full blur-2xl"></div>
                                        </div>
                                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">{t('cashClosing.financialSnapshot.gymNetIncome', 'Gym Net Income')}</p>
                                        <p className="text-3xl font-black text-emerald-400 mb-1">{formatCurrency(financialSnapshot.gymNetIncome, i18n.language, currencyConf)}</p>
                                        <p className="text-[10px] text-emerald-400/60 font-medium">{t('cashClosing.financialSnapshot.grossMinusComm', 'Gross - Comm')}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. Preview Section */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1 border-b border-gray-700 pb-2">
                                {t('cashClosing.preview.title', 'Preview')}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Cash Expected */}
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between h-full">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1.5">{t('cashClosing.expectedCash')}</p>
                                        <p className="text-xl font-bold text-emerald-400">
                                            {formatCurrency(expectedAmounts.expectedCashAmount || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-gray-600 font-medium mt-2 pt-2 border-t border-slate-700/50">
                                        {t('cashClosing.preview.cashFormula', 'Cash In - Cash Out')}
                                    </p>
                                </div>

                                {/* Non-Cash Expected */}
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between h-full">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1.5">{t('cashClosing.expectedNonCash')}</p>
                                        <p className="text-xl font-bold text-blue-400">
                                            {formatCurrency(expectedAmounts.expectedNonCashAmount || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="space-y-1 mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-gray-500">
                                        <div className="flex justify-between">
                                            <span>{t('payments.card')}</span>
                                            <span className="text-gray-400">{formatCurrency(expectedAmounts.cardTotal || 0, i18n.language, currencyConf)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{t('payments.transfer')}</span>
                                            <span className="text-gray-400">{formatCurrency(expectedAmounts.transferTotal || 0, i18n.language, currencyConf)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Expected */}
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between h-full relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-indigo-500/10 to-transparent"></div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1.5">{t('cashClosing.expectedTotal')}</p>
                                        <p className="text-xl font-bold text-white">
                                            {formatCurrency(expectedAmounts.expectedTotalAmount || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-indigo-400 font-medium mt-2">{t('cashClosing.preview.total', 'Total')}</p>
                                </div>

                                {/* Transactions Count */}
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
                                    <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center mb-2">
                                        <FileText size={18} className="text-gray-400" />
                                    </div>
                                    <p className="text-2xl font-bold text-white mb-0.5">
                                        {expectedAmounts.paymentCount || 0}
                                    </p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t('cashClosing.preview.paymentsCount', 'Payments')}</p>
                                </div>
                            </div>

                            {/* Sales Preview */}
                            <div className="bg-slate-800/20 rounded-xl p-4 border border-dashed border-slate-700/50 mt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        <TrendingUp size={12} />
                                        {t('cashClosing.salesPreview') || 'Product sales preview'}
                                    </p>
                                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-gray-400 border border-slate-700">
                                        {isFetchingSales ? t('common.loading') : `${salesPreview.transactionsCount} ${t('cashClosing.salesCount', 'sales')}`}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="flex justify-between items-center p-3 bg-slate-800/40 rounded-lg">
                                        <span className="text-xs text-gray-500">{t('cashClosing.salesTotal') || 'Sales total'}</span>
                                        <span className="text-sm font-bold text-indigo-400">{formatCurrency(salesPreview.totalRevenue || 0, i18n.language, currencyConf)}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-800/40 rounded-lg">
                                        <span className="text-xs text-gray-500">{t('cashClosing.unitsSold') || 'Units sold'}</span>
                                        <span className="text-sm font-bold text-white">{salesPreview.totalUnits || 0}</span>
                                    </div>
                                </div>
                                {salesPreview.topProducts.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/30">
                                        <p className="text-[10px] text-gray-500 mb-2 uppercase">{t('cashClosing.topProducts') || 'Top products'}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {salesPreview.topProducts.slice(0, 3).map((item) => (
                                                <div key={item.productId} className="text-xs bg-slate-700/30 px-2 py-1 rounded border border-slate-700/50 text-gray-300 flex items-center gap-2">
                                                    <span className="truncate max-w-[100px]">{item.name}</span>
                                                    <span className="w-1 h-3 bg-slate-600 rounded-full" />
                                                    <span className="font-bold text-white">{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. Declaration Actions (The Cash Drawer) */}
                        <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/40 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-white mb-6 uppercase tracking-wider">
                                <DollarSign size={16} className="text-emerald-500" />
                                {t('cashClosing.declaredTotal') || 'Cash Drawer (Declaration)'}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div className="relative group">
                                    <label className="text-xs font-bold text-emerald-400 mb-2 block uppercase tracking-wide">{t('cashClosing.declaredCash')}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            className="w-full h-14 pl-12 pr-4 bg-slate-900 border-2 border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-2xl font-bold text-white placeholder-gray-600"
                                            value={formData.declaredCashAmount}
                                            onChange={(e) => setFormData(prev => ({ ...prev, declaredCashAmount: e.target.value }))}
                                            required
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-500/20 rounded-lg text-emerald-500">
                                            <DollarSign size={20} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2">Enter the physical cash amount in the drawer.</p>
                                </div>
                                <div className="relative group">
                                    <label className="text-xs font-bold text-blue-400 mb-2 block uppercase tracking-wide">{t('cashClosing.declaredNonCash')} <span className="text-gray-500 font-normal normal-case">(Optional)</span></label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            className="w-full h-14 pl-12 pr-4 bg-slate-900 border-2 border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-2xl font-bold text-white placeholder-gray-600"
                                            value={formData.declaredNonCashAmount}
                                            onChange={(e) => setFormData(prev => ({ ...prev, declaredNonCashAmount: e.target.value }))}
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-blue-500/20 rounded-lg text-blue-500">
                                            <CreditCard size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* LIVE STATUS CARD */}
                            <div className={`relative overflow-hidden rounded-xl border-2 transition-all duration-500 ${status === 'shortage' ? 'bg-red-500/5 border-red-500/30' :
                                status === 'overage' ? 'bg-orange-500/5 border-orange-500/30' :
                                    status === 'balanced' ? 'bg-emerald-500/5 border-emerald-500/30' :
                                        'bg-slate-800/50 border-slate-700'
                                }`}>
                                {/* Background Glow */}
                                <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2 transition-colors duration-500 ${status === 'shortage' ? 'bg-red-500' :
                                    status === 'overage' ? 'bg-orange-500' :
                                        status === 'balanced' ? 'bg-emerald-500' :
                                            'bg-gray-500'
                                    }`}></div>

                                <div className="relative p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-500 ${status === 'shortage' ? 'bg-red-500 text-white' :
                                            status === 'overage' ? 'bg-orange-500 text-white' :
                                                status === 'balanced' ? 'bg-emerald-500 text-white' :
                                                    'bg-slate-700 text-gray-400'
                                            }`}>
                                            <StatusIcon size={32} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('common.status')}</p>
                                            <h3 className={`text-2xl font-black ${statusColor} transition-colors duration-300`}>{statusText}</h3>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 mb-1">{t('cashClosing.differenceCash')}</p>
                                        <p className={`text-4xl font-black ${statusColor} transition-colors duration-300 tracking-tight`}>
                                            {formatSignedDiff(differenceCash)}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-black/20 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400">{t('cashClosing.declaredTotal')}</span>
                                        <span className="text-sm font-bold text-white">{declaredTotalDisplay}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400">{t('cashClosing.differenceNonCash')}</span>
                                        <span className={`text-sm font-bold ${hasDeclaredCash ? diffNonCashColor : 'text-gray-500'}`}>{formatSignedDiff(differenceNonCash)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400">{t('cashClosing.differenceTotal')}</span>
                                        <span className={`text-sm font-bold ${hasDeclaredCash ? diffTotalColor : 'text-gray-500'}`}>{formatSignedDiff(differenceTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('cashClosing.notes')}</label>
                            <textarea
                                className="w-full min-h-[100px] p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all text-sm text-white resize-none"
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder={t('cashClosing.notes')}
                            />
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-6 border-t border-slate-700/50 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-6 py-3 rounded-xl font-semibold text-sm transition-all text-gray-400 hover:text-white hover:bg-slate-800"
                                disabled={isLoading}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                disabled={isLoading || isFetchingExpected || (!formData.employeeId)}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{t('common.loading')}</span>
                                    </div>
                                ) : (
                                    t('cashClosing.confirmCreate')
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CashClosingModal;
