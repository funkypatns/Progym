import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Loader2,
    RefreshCw,
    Download,
    FileSpreadsheet,
    ArrowUpCircle,
    ArrowDownCircle,
    Banknote,
    Filter
} from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useSettingsStore } from '../store';
import { motion } from 'framer-motion';

const CashMovementsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const [data, setData] = useState({ data: [], totals: { payIn: 0, payOut: 0, net: 0 } });
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        type: '',
        employeeId: ''
    });

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams(filters);
            const response = await api.get(`/cash-movements?${params}`);

            // Calculate totals manually if backend doesn't return them for specific filters
            const movements = response.data.data || [];
            const payIn = movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + (m.amount || 0), 0);
            const payOut = movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + (m.amount || 0), 0);

            setData({
                data: movements,
                totals: { payIn, payOut, net: payIn - payOut }
            });

        } catch (error) {
            console.error('Failed to fetch cash movements report', error);
            toast.error(t('reports.errors.serverError') || 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchReport();
        }
    }, [isActive, filters.startDate, filters.endDate, filters.type]);

    const handleExport = () => {
        // Simple CSV Export implementation
        if (!data.data.length) return;

        const headers = ["Date", "Type", "Amount", "Reason", "Notes", "Employee"];
        const rows = data.data.map(m => [
            formatDateTime(m.createdAt, 'en'),
            m.type,
            m.amount,
            `"${m.reason}"`,
            `"${m.notes || ''}"`,
            `"${m.employee?.firstName} ${m.employee?.lastName}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Cash_Movements_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    if (!isActive) return null;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pay In */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4"
                >
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <ArrowDownCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('payInOut.in') || 'Total Pay In'}</p>
                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                            +{formatCurrency(data.totals.payIn, i18n.language, currencyConf)}
                        </h3>
                    </div>
                </motion.div>

                {/* Pay Out */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4"
                >
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
                        <ArrowUpCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('payInOut.out') || 'Total Pay Out'}</p>
                        <h3 className="text-2xl font-bold text-red-600 mt-1">
                            -{formatCurrency(data.totals.payOut, i18n.language, currencyConf)}
                        </h3>
                    </div>
                </motion.div>

                {/* Net */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4"
                >
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                        <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('financials.net') || 'Net Cash Flow'}</p>
                        <h3 className={`text-2xl font-bold mt-1 ${data.totals.net >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                            {formatCurrency(data.totals.net, i18n.language, currencyConf)}
                        </h3>
                    </div>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('reports.from')}</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('reports.to')}</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('payInOut.type') || 'Type'}</label>
                        <select
                            className="input w-full"
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                        >
                            <option value="">{t('common.all') || 'All'}</option>
                            <option value="IN">{t('payInOut.in') || 'Pay In'}</option>
                            <option value="OUT">{t('payInOut.out') || 'Pay Out'}</option>
                        </select>
                    </div>
                    <div className="flex items-end gap-2">
                        <button onClick={fetchReport} disabled={isLoading} className="btn-secondary flex-1">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                            {t('common.refresh')}
                        </button>
                        <button onClick={handleExport} className="btn-primary">
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-700/50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-100 dark:border-dark-700">
                                <th className="p-4">{t('payInOut.date') || 'Date'}</th>
                                <th className="p-4">{t('payInOut.type') || 'Type'}</th>
                                <th className="p-4">{t('payInOut.reason') || 'Reason'}</th>
                                <th className="p-4">{t('payInOut.employee') || 'Employee'}</th>
                                <th className="p-4 text-right">{t('payInOut.amount') || 'Amount'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        {t('common.loading')}
                                    </td>
                                </tr>
                            ) : data.data.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
                                        {t('common.noData')}
                                    </td>
                                </tr>
                            ) : (
                                data.data.map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                        <td className="p-4 text-sm font-mono text-gray-600 dark:text-gray-400">
                                            {formatDateTime(m.createdAt, i18n.language)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${m.type === 'IN'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {m.type === 'IN' ? (t('payInOut.in') || 'PAY IN') : (t('payInOut.out') || 'PAY OUT')}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{m.reason}</div>
                                            {m.notes && <div className="text-xs text-gray-500 mt-0.5">{m.notes}</div>}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                            {m.employee?.firstName} {m.employee?.lastName}
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold">
                                            <span className={m.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}>
                                                {m.type === 'OUT' ? '-' : '+'}{formatCurrency(m.amount, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CashMovementsReport;
