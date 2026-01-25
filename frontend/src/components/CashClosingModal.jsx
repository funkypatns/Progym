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
import { X, AlertTriangle, DollarSign, TrendingDown, TrendingUp, Minus, Users, CreditCard } from 'lucide-react';
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
            StatusIcon = Minus; // Checkmark or Minus
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

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 p-6 flex items-center justify-between z-10">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {t('cashClosing.createClosing')}
                            </h2>
                            <p className="text-sm text-dark-400 mt-1">
                                {t('cashClosing.immutableWarning')}
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Employee & Period Type */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">{t('cashClosing.employee')}</label>
                                <select
                                    className="input"
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                                >
                                    <option value="">{t('cashClosing.selectEmployee') || 'اختر موظف'}</option>
                                    <option value="all">{t('cashClosing.allEmployees')}</option>
                                    {employees.length > 0 ? (
                                        employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.firstName} {emp.lastName}
                                            </option>
                                        ))
                                    ) : (
                                        <option disabled>{'جاري تحميل الموظفين...'}</option>
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="label">{t('cashClosing.period')}</label>
                                <select
                                    className="input"
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

                        {/* Date Range */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">{t('reports.from')}</label>
                                <input
                                    type="datetime-local"
                                    className="input"
                                    value={formData.startAt}
                                    onChange={(e) => setFormData(prev => ({ ...prev, startAt: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">{t('reports.to')}</label>
                                <input
                                    type="datetime-local"
                                    className="input"
                                    value={formData.endAt}
                                    onChange={(e) => setFormData(prev => ({ ...prev, endAt: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>

                        {/* PREVIEW SECTION (Strict Breakdown) */}
                        <div className="bg-gray-50 dark:bg-dark-900/50 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider border-b border-gray-200 dark:border-dark-700 pb-2">
                                Preview (المعاينة)
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm">
                                    <p className="text-xs text-gray-500 mb-1">{t('cashClosing.expectedCash')}</p>
                                    <p className="text-lg font-bold text-emerald-500">
                                        {formatCurrency(expectedAmounts.expectedCashAmount || 0, i18n.language, currencyConf)}
                                    </p>
                                    <p className="text-[10px] text-gray-400">Cash In - Cash Out</p>
                                </div>
                                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm border-l-2 border-blue-400">
                                    <p className="text-xs text-gray-500 mb-1">{t('cashClosing.expectedNonCash')}</p>
                                    <p className="text-lg font-bold text-blue-500">
                                        {formatCurrency(expectedAmounts.expectedNonCashAmount || 0, i18n.language, currencyConf)}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                        {t('payments.card')}: {formatCurrency(expectedAmounts.cardTotal || 0, i18n.language, currencyConf)} • {t('payments.transfer')}: {formatCurrency(expectedAmounts.transferTotal || 0, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm border-l-2 border-indigo-400">
                                    <p className="text-xs text-gray-500 mb-1">{t('cashClosing.expectedTotal')}</p>
                                    <p className="text-lg font-bold text-gray-700 dark:text-white">
                                        {formatCurrency(expectedAmounts.expectedTotalAmount || 0, i18n.language, currencyConf)}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{t('cashClosing.total') || 'Total'}</p>
                                </div>
                                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm text-center flex flex-col justify-center">
                                    <p className="text-xs text-gray-500 mb-1">{t('cashClosing.paymentsCount') || 'Payments'}</p>
                                    <p className="text-lg font-bold text-gray-700 dark:text-white">
                                        {expectedAmounts.paymentCount || 0}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 border-t border-gray-200 dark:border-dark-700 pt-3">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        {t('cashClosing.salesPreview') || 'Product sales preview'}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {isFetchingSales ? t('common.loading') : `${salesPreview.transactionsCount} ${t('cashClosing.salesCount', 'sales')}`}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm">
                                        <p className="text-xs text-gray-500 mb-1">{t('cashClosing.salesTotal') || 'Sales total'}</p>
                                        <p className="text-lg font-bold text-indigo-500">
                                            {formatCurrency(salesPreview.totalRevenue || 0, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm">
                                        <p className="text-xs text-gray-500 mb-1">{t('cashClosing.unitsSold') || 'Units sold'}</p>
                                        <p className="text-lg font-bold text-gray-700 dark:text-white">
                                            {salesPreview.totalUnits || 0}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm">
                                        <p className="text-xs text-gray-500 mb-1">{t('cashClosing.topProducts') || 'Top products'}</p>
                                        {salesPreview.topProducts.length === 0 ? (
                                            <p className="text-xs text-gray-400">
                                                {t('cashClosing.noSales') || 'No product sales in this period'}
                                            </p>
                                        ) : (
                                            <div className="space-y-1">
                                                {salesPreview.topProducts.slice(0, 3).map((item) => (
                                                    <div key={item.productId} className="flex items-center justify-between text-xs text-gray-500">
                                                        <span className="truncate pr-2">{item.name}</span>
                                                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                            {item.quantity}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Declared Amounts (Input) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label font-bold text-slate-800 dark:text-gray-200">{t('cashClosing.declaredCash')}</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="Enter amount in drawer..."
                                        className="input pl-10 text-lg border-2 focus:border-primary-500"
                                        value={formData.declaredCashAmount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, declaredCashAmount: e.target.value }))}
                                        required
                                    />
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                                </div>
                            </div>
                            <div>
                                <label className="label font-bold text-slate-800 dark:text-gray-200">{t('cashClosing.declaredNonCash')} (Optional)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="input pl-10 text-lg"
                                        value={formData.declaredNonCashAmount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, declaredNonCashAmount: e.target.value }))}
                                    />
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                                </div>
                            </div>
                        </div>

                        {/* Live Difference Preview */}
                        <div className={`p-5 border-2 rounded-2xl transition-all ${status === 'pending' ? 'bg-gray-50 border-gray-200 dark:bg-dark-800 dark:border-dark-700' :
                            status === 'shortage' ? 'bg-red-500/5 border-red-500/20' :
                                status === 'overage' ? 'bg-orange-500/5 border-orange-500/20' :
                                    'bg-emerald-500/5 border-emerald-500/20'
                            }`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${status === 'pending' ? 'bg-gray-200 dark:bg-dark-700' :
                                        status === 'shortage' ? 'bg-red-500/20' :
                                            status === 'overage' ? 'bg-orange-500/20' :
                                                'bg-emerald-500/20'
                                        }`}>
                                        <StatusIcon className={`w-6 h-6 ${statusColor}`} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-dark-500 uppercase tracking-wider font-semibold">
                                            {t('common.status')}
                                        </p>
                                        <h4 className={`text-xl font-black ${statusColor}`}>
                                            {statusText}
                                        </h4>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-dark-500 mb-1">{t('cashClosing.differenceCash')}</p>
                                    <p className={`text-3xl font-black ${statusColor}`}>
                                        {formatSignedDiff(differenceCash)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="flex items-center justify-between bg-white/70 dark:bg-dark-900/50 border border-gray-200/70 dark:border-dark-700/70 rounded-lg px-3 py-2">
                                    <span className="text-xs text-gray-500">{t('cashClosing.declaredTotal')}</span>
                                    <span className={`text-sm font-bold ${hasDeclaredCash ? 'text-gray-700 dark:text-white' : 'text-gray-400'}`}>
                                        {declaredTotalDisplay}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between bg-white/70 dark:bg-dark-900/50 border border-gray-200/70 dark:border-dark-700/70 rounded-lg px-3 py-2">
                                    <span className="text-xs text-gray-500">{t('cashClosing.differenceNonCash')}</span>
                                    <span className={`text-sm font-bold ${hasDeclaredCash ? diffNonCashColor : 'text-gray-400'}`}>
                                        {formatSignedDiff(differenceNonCash)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between bg-white/70 dark:bg-dark-900/50 border border-gray-200/70 dark:border-dark-700/70 rounded-lg px-3 py-2">
                                    <span className="text-xs text-gray-500">{t('cashClosing.differenceTotal')}</span>
                                    <span className={`text-sm font-bold ${hasDeclaredCash ? diffTotalColor : 'text-gray-400'}`}>
                                        {formatSignedDiff(differenceTotal)}
                                    </span>
                                </div>
                            </div>

                            {status === 'pending' && (
                                <p className="text-sm text-center text-gray-500 italic bg-white dark:bg-dark-900/50 p-2 rounded-lg">
                                    {isRTL
                                        ? 'سيتم تحديد العجز أو الزيادة تلقائياً بعد إدخال المبلغ الموجود فعلياً في الدرج.'
                                        : 'Shortage or overage is calculated after entering the cash on hand.'}
                                </p>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="label">{t('cashClosing.notes')}</label>
                            <textarea
                                className="input min-h-[80px]"
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder={t('cashClosing.notes')}
                            />
                        </div>

                        {/* Warning */}
                        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-yellow-400">
                                {t('cashClosing.immutableWarning')}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="btn-secondary"
                                disabled={isLoading}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isLoading || isFetchingExpected || (!formData.employeeId)}
                            >
                                {isLoading ? t('common.loading') : t('cashClosing.confirmCreate')}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CashClosingModal;
