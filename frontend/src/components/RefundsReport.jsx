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
    Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import MemberDetailsModal from './MemberDetailsModal'; // Import Modal

const RefundsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const [data, setData] = useState({ rows: [], totals: { totalRefunded: 0, count: 0, thisMonthTotal: 0, thisMonthCount: 0 } });
    const [isLoading, setIsLoading] = useState(false);
    const [admins, setAdmins] = useState([]);
    const [expandedRow, setExpandedRow] = useState(null);
    const [selectedMemberId, setSelectedMemberId] = useState(null); // Modal state

    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        search: '',
        adminId: 'all'
    });

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    // Fetch Admins for filter
    useEffect(() => {
        const fetchAdmins = async () => {
            try {
                const res = await api.get('/users/list');
                setAdmins(res.data.data || []);
            } catch (err) {
                console.error("Failed to load admins list", err);
            }
        };
        if (isActive) fetchAdmins();
    }, [isActive]);

    const fetchRefunds = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                startDate: filters.startDate,
                endDate: filters.endDate,
                search: filters.search,
                adminId: filters.adminId
            });
            const response = await api.get(`/reports/refunds?${params}`);
            if (response.data.success) {
                setData(response.data.data);
            } else {
                toast.error(response.data.message || t('common.error'));
            }
        } catch (error) {
            console.error('Failed to fetch refunds report', error);
            toast.error(t('reports.errors.serverError') || 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchRefunds();
        }
    }, [isActive, filters.startDate, filters.endDate, filters.adminId]);

    const handleExport = async () => {
        try {
            const params = new URLSearchParams({
                startDate: filters.startDate,
                endDate: filters.endDate,
                search: filters.search,
                adminId: filters.adminId,
                format: 'excel'
            });

            const response = await api.get(`/reports/refunds?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Refunds_Report_${new Date().toLocaleDateString()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(t('common.success'));
        } catch (error) {
            toast.error(t('common.error'));
        }
    };

    if (!isActive) return null;

    const tPath = 'reports.fields.refunds';

    return (
        <div className="space-y-6">
            {/* Modal */}
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
                        <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t(`${tPath}.totalRefunded`)}</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {formatCurrency(data?.totals?.totalRefunded || 0, i18n.language, currencyConf)}
                        </h3>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4"
                >
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-primary-600 dark:text-primary-400">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t(`${tPath}.thisMonth`)}</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {formatCurrency(data?.totals?.thisMonthTotal || 0, i18n.language, currencyConf)}
                        </h3>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4"
                >
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400">
                        <Info className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t(`${tPath}.resultCount`)}</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {formatNumber(data?.totals?.count || 0, i18n.language)}
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
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('reports.filterByEmployee')}</label>
                        <select
                            className="input w-full"
                            value={filters.adminId}
                            onChange={(e) => setFilters({ ...filters, adminId: e.target.value })}
                        >
                            <option value="all">{t('common.all')}</option>
                            {admins.map(admin => (
                                <option key={admin.id} value={admin.id}>
                                    {admin.firstName} {admin.lastName}
                                </option>
                            ))}
                        </select>
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
                                onKeyDown={(e) => e.key === 'Enter' && fetchRefunds()}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={fetchRefunds} disabled={isLoading} className="btn-secondary">
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
                                <th className="p-4 w-10"></th>
                                <th className="p-4">{t('reports.fields.paidAt')}</th>
                                <th className="p-4">{t(`${tPath}.transactionId`)}</th>
                                <th className="p-4">{t('reports.fields.memberName')}</th>
                                <th className="p-4 text-right">Original Paid</th>
                                <th className="p-4 text-right text-red-500">Refunded</th>
                                <th className="p-4 text-right">Cumulative</th>
                                <th className="p-4 text-right">Net Remaining</th>
                                <th className="p-4">{t(`${tPath}.admin`)}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700 border-b border-gray-100 dark:border-700">
                            <AnimatePresence mode="popLayout">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="9" className="p-8 text-center text-gray-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            {t('common.loading')}
                                        </td>
                                    </tr>
                                ) : (!data?.rows || data.rows.length === 0) ? (
                                    <tr>
                                        <td colSpan="9" className="p-8 text-center text-gray-500">
                                            <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-20" />
                                            {t('common.noData')}
                                        </td>
                                    </tr>
                                ) : (
                                    data.rows.map((row, idx) => (
                                        <React.Fragment key={row.id}>
                                            <motion.tr
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.01 }}
                                                className={`hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors cursor-pointer ${expandedRow === row.id ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                                                onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                                            >
                                                <td className="p-4">
                                                    <Info className={`w-4 h-4 transition-transform ${expandedRow === row.id ? 'text-primary-500 scale-125' : 'text-gray-300'}`} />
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {row.refundedAt ? formatDateTime(row.refundedAt, i18n.language).split(',')[0] : 'N/A'}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-mono">
                                                        {row.refundedAt ? formatDateTime(row.refundedAt, i18n.language).split(',')[1] : ''}
                                                    </div>
                                                </td>
                                                <td className="p-4 font-mono text-xs text-primary-500 font-bold">
                                                    #{row.receiptId || '0000'}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 group">
                                                        <div className="font-bold text-gray-900 dark:text-white leading-tight">
                                                            {row.member?.name || t('common.unknown')}
                                                        </div>
                                                        <span className="text-[10px] px-1 bg-gray-100 dark:bg-dark-600 rounded text-gray-500 uppercase">{row.member?.code}</span>
                                                        {row.member?.id && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedMemberId(row.member.id);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded text-primary-500 transition-all"
                                                                title="View Details"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono text-xs text-gray-500">
                                                    {formatCurrency(row.originalPaid || 0, i18n.language, currencyConf)}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-red-600 dark:text-red-400">
                                                    {formatCurrency(row.amount || 0, i18n.language, currencyConf)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-xs text-gray-500">
                                                    {formatCurrency(row.totalRefundedSoFar || 0, i18n.language, currencyConf)}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(row.netRemaining || 0, i18n.language, currencyConf)}
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate max-w-[100px]">
                                                        {row.processedBy?.name}
                                                    </div>
                                                </td>
                                            </motion.tr>

                                            {/* Expansion Detail */}
                                            <AnimatePresence>
                                                {expandedRow === row.id && (
                                                    <tr>
                                                        <td colSpan="9" className="p-0 border-none bg-gray-50/50 dark:bg-dark-900/50">
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="p-6 border-l-4 border-primary-500 ml-4 my-2 space-y-4">
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Refund Audit Details</h4>
                                                                            <p className="text-xs text-gray-500">Transaction details and history for this action.</p>
                                                                        </div>
                                                                        <div className="bg-dark-800 p-2 rounded border border-dark-700">
                                                                            <span className="text-[10px] text-gray-400 uppercase mr-2">Method:</span>
                                                                            <span className="text-xs font-bold text-white capitalize">{row.method}</span>
                                                                        </div>
                                                                    </div>

                                                                    {row.reason && (
                                                                        <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/20">
                                                                            <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-tighter mb-1">Reason for Refund</p>
                                                                            <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{row.reason}"</p>
                                                                        </div>
                                                                    )}

                                                                    <div className="grid grid-cols-4 gap-4">
                                                                        <div className="p-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700">
                                                                            <p className="text-[10px] text-gray-400 uppercase mb-1">Original Activity</p>
                                                                            <p className="text-sm font-bold text-gray-900 dark:text-white uppercase truncate">{row.subscription?.name}</p>
                                                                        </div>
                                                                        <div className="p-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700">
                                                                            <p className="text-[10px] text-gray-400 uppercase mb-1">Refund Issued By</p>
                                                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{row.processedBy?.name}</p>
                                                                        </div>
                                                                        <div className="p-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700">
                                                                            <p className="text-[10px] text-gray-400 uppercase mb-1">Action Date</p>
                                                                            <p className="text-sm font-bold text-gray-900 dark:text-white font-mono">{formatDateTime(row.refundedAt, i18n.language)}</p>
                                                                        </div>
                                                                        <div className="p-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700">
                                                                            <p className="text-[10px] text-gray-400 uppercase mb-1">Audit Trace</p>
                                                                            <p className="text-sm font-bold text-primary-500 font-mono">TXN-{row.id}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </AnimatePresence>
                                        </React.Fragment>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RefundsReport;
