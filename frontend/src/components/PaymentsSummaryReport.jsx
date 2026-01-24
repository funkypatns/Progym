import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Loader2, Receipt, Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatNumber, formatCurrency } from '../utils/numberFormatter';
import { useAuthStore, useSettingsStore } from '../store';

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

    const fetchSummary = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                from: filters.from,
                to: filters.to,
                employeeId: filters.employeeId,
                scope: filters.scope
            });
            params.append('_ts', Date.now().toString());
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
    }, [filters, t]);

    useEffect(() => {
        if (isActive) fetchSummary();
    }, [isActive, fetchSummary]);

    useEffect(() => {
        if (!isActive) return;
        const handlePaymentsUpdated = () => {
            fetchSummary();
        };
        window.addEventListener('payments:updated', handlePaymentsUpdated);
        return () => window.removeEventListener('payments:updated', handlePaymentsUpdated);
    }, [isActive, fetchSummary]);

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

export default PaymentsSummaryReport;
