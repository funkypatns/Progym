import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search,
    Download,
    FileSpreadsheet,
    Loader2,
    Calendar,
    User,
    Banknote,
    Receipt,
    Users,
    AlertCircle,
    Info,
    RefreshCw,
    Eye,
    XCircle,
    ArrowDownRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import MemberDetailsModal from './MemberDetailsModal';

const CancellationsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const [data, setData] = useState({ report: [], summary: { totalCancellations: 0, totalRefunded: 0, netRevenueImpact: 0 } });
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState(null);

    const tPath = 'reports.fields.cancellations';

    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        search: ''
    });

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    const fetchCancellations = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                from: filters.startDate,
                to: filters.endDate,
                search: filters.search
            });
            const response = await api.get(`/reports/cancellations?${params}`);
            if (response.data.success) {
                setData(response.data.data);
            } else {
                toast.error(response.data.message || t('common.error'));
            }
        } catch (error) {
            console.error('Failed to fetch cancellations report', error);
            toast.error(t('reports.errors.serverError') || 'Failed to load cancellations report');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchCancellations();
        }
    }, [isActive, filters.startDate, filters.endDate]);

    const handleExport = async () => {
        try {
            const params = new URLSearchParams({
                from: filters.startDate,
                to: filters.endDate,
                search: filters.search,
                format: 'excel'
            });
            const response = await api.get(`/reports/cancellations?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Cancellations_Report_${new Date().toLocaleDateString()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(t('common.success'));
        } catch (error) {
            toast.error(t('common.error'));
        }
    };

    if (!isActive) return null;

    return (
        <div className="space-y-6">
            <MemberDetailsModal
                isOpen={!!selectedMemberId}
                onClose={() => setSelectedMemberId(null)}
                memberId={selectedMemberId}
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4"
                >
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
                        <XCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t(`${tPath}.totalCancellations`)}</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {formatNumber(data?.summary?.totalCancellations || 0, i18n.language)}
                        </h3>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4"
                >
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400">
                        <ArrowDownRight className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t(`${tPath}.totalRefunded`)}</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {formatCurrency(data?.summary?.totalRefunded || 0, i18n.language, currencyConf)}
                        </h3>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4"
                >
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t(`${tPath}.netRevenueImpact`)}</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {formatCurrency(data?.summary?.netRevenueImpact || 0, i18n.language, currencyConf)}
                        </h3>
                    </div>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.search')}</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                className="input w-full pl-10"
                                placeholder={t(`${tPath}.searchPlaceholder`)}
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && fetchCancellations()}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={fetchCancellations} disabled={isLoading} className="btn-secondary">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                        {t('common.refresh')}
                    </button>
                    <button onClick={handleExport} className="btn-primary">
                        <FileSpreadsheet className="w-5 h-5" />
                        {t(`${tPath}.exportExcel`)}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-700/50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-100 dark:border-dark-700">
                                <th className="p-4">{t(`${tPath}.canceledAt`)}</th>
                                <th className="p-4">{t(`${tPath}.member`)}</th>
                                <th className="p-4">{t(`${tPath}.phone`)}</th>
                                <th className="p-4">{t(`${tPath}.plan`)}</th>
                                <th className="p-4">{t(`${tPath}.status`)}</th>
                                <th className="p-4 text-right">{t(`${tPath}.paid`)}</th>
                                <th className="p-4 text-right">{t(`${tPath}.refunded`)}</th>
                                <th className="p-4 text-right">{t(`${tPath}.net`)}</th>
                                <th className="p-4">{t(`${tPath}.by`)}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700 border-b border-gray-100 dark:border-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        {t('common.loading')}
                                    </td>
                                </tr>
                            ) : (!data?.report || data.report.length === 0) ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-gray-500">
                                        {t('common.noData')}
                                    </td>
                                </tr>
                            ) : (
                                data.report.map((row, idx) => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                        <td className="p-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {formatDateTime(row.canceledAt, i18n.language)}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-gray-900 dark:text-white leading-tight">
                                                    {row.member?.name}
                                                </div>
                                                <span className="text-[10px] px-1 bg-gray-100 dark:bg-dark-600 rounded text-gray-500 uppercase">{row.member?.memberId}</span>
                                                <button
                                                    onClick={() => setSelectedMemberId(row.member.id)}
                                                    className="p-1 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded text-primary-500 transition-all"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500">{row.member?.phone}</td>
                                        <td className="p-4 text-sm text-gray-700 dark:text-gray-300">{row.plan?.name}</td>
                                        <td className="p-4">
                                            <span className={`badge ${row.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                                                {row.status === 'cancelled' ? 'CANCELED' : 'ENDED'}
                                            </span>
                                            <div className="text-[10px] text-gray-400 mt-1 uppercase">{row.cancelSource}</div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-sm">
                                            {formatCurrency(row.financials.paidAmount, i18n.language, currencyConf)}
                                        </td>
                                        <td className="p-4 text-right font-mono text-sm text-red-500">
                                            -{formatCurrency(row.financials.refundedAmount, i18n.language, currencyConf)}
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(row.financials.netRevenue, i18n.language, currencyConf)}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                            {row.processedBy}
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

export default CancellationsReport;
