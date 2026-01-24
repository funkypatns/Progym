import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search,
    FileSpreadsheet,
    Loader2,
    Calendar,
    Info,
    RefreshCw,
    Eye,
    TrendingDown,
    Users,
    AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import MemberDetailsModal from './MemberDetailsModal';
import ReportSummaryCards from './ReportSummaryCards';

const RefundsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';
    const alignStart = isRTL ? 'text-right' : 'text-left';
    const alignEnd = isRTL ? 'text-left' : 'text-right';
    const searchIconPosition = isRTL ? 'right-3' : 'left-3';
    const searchPadding = isRTL ? 'pr-10' : 'pl-10';

    const [data, setData] = useState({ rows: [], summary: { totalRefunded: 0, count: 0, thisMonthTotal: 0, thisMonthCount: 0 } });
    const [isLoading, setIsLoading] = useState(false);
    const [admins, setAdmins] = useState([]);
    const [expandedRow, setExpandedRow] = useState(null);
    const [selectedMemberId, setSelectedMemberId] = useState(null);

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
            } catch (err) {}
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
                const payload = response.data.data || {};
                const summary = payload.summary || payload.totals || {};
                setData({
                    rows: Array.isArray(payload.rows) ? payload.rows : [],
                    summary: {
                        totalRefunded: summary.totalRefunded || 0,
                        count: summary.count || 0,
                        thisMonthTotal: summary.thisMonthTotal || 0,
                        thisMonthCount: summary.thisMonthCount || 0
                    }
                });
            } else {
                toast.error(response.data.message || t('common.error', 'Error'));
            }
        } catch (error) {
            toast.error(t('reports.errors.serverError', 'Failed to load report'));
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
            toast.success(t('common.success', 'Success'));
        } catch (error) {
            toast.error(t('common.error', 'Error'));
        }
    };

    if (!isActive) return null;

    const tPath = 'reports.fields.refunds';

    return (
        <div className="space-y-4">
            <MemberDetailsModal
                isOpen={!!selectedMemberId}
                onClose={() => setSelectedMemberId(null)}
                memberId={selectedMemberId}
            />

            {/* Summary Cards */}
            <ReportSummaryCards
                gridClassName="md:grid-cols-3"
                items={[
                    {
                        label: t(`${tPath}.totalRefunded`, 'Total refunded'),
                        value: formatCurrency(data?.summary?.totalRefunded || 0, i18n.language, currencyConf),
                        icon: TrendingDown,
                        iconClassName: 'bg-red-500'
                    },
                    {
                        label: t(`${tPath}.thisMonth`, 'This month'),
                        value: formatCurrency(data?.summary?.thisMonthTotal || 0, i18n.language, currencyConf),
                        icon: Calendar,
                        iconClassName: 'bg-indigo-500'
                    },
                    {
                        label: t(`${tPath}.resultCount`, 'Count'),
                        value: formatNumber(data?.summary?.count || 0, i18n.language),
                        icon: Info,
                        iconClassName: 'bg-amber-500'
                    }
                ]}
            />

            {/* Filters */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {t('reports.from', 'From')}
                        </label>
                        <input
                            type="date"
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {t('reports.to', 'To')}
                        </label>
                        <input
                            type="date"
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Users size={14} />
                            {t('reports.filterByEmployee', 'Filter by employee')}
                        </label>
                        <select
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                            value={filters.adminId}
                            onChange={(e) => setFilters({ ...filters, adminId: e.target.value })}
                        >
                            <option value="all">{t('common.all', 'All')}</option>
                            {admins.map(admin => (
                                <option key={admin.id} value={admin.id}>
                                    {admin.firstName} {admin.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Search size={14} />
                            {t('common.search', 'Search')}
                        </label>
                        <div className="relative">
                            <Search className={`absolute ${searchIconPosition} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                            <input
                                type="text"
                                className={`w-full h-11 ${searchPadding} bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white placeholder:text-gray-500`}
                                placeholder={t(`${tPath}.searchPlaceholder`, 'Search...')}
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && fetchRefunds()}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={fetchRefunds}
                            disabled={isLoading}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                            {t('common.refresh', 'Refresh')}
                        </button>
                        <button
                            onClick={handleExport}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
                            {t(`${tPath}.exportExcel`, t('reports.export', 'Export'))}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900/70 border-b border-slate-700/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 w-10"></th>
                                <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t('reports.fields.paidAt', 'Date')}</th>
                                <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t(`${tPath}.transactionId`, 'Receipt ID')}</th>
                                <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t('reports.fields.memberName', 'Member')}</th>
                                <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignEnd}`}>{t('reports.fields.originalPaid', 'Original paid')}</th>
                                <th className={`px-4 py-3 text-xs font-bold text-red-500 uppercase tracking-wider ${alignEnd}`}>{t(`${tPath}.refundAmount`, t('reports.refunds.refunded', 'Refunded'))}</th>
                                <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignEnd}`}>{t('reports.cumulative', 'Cumulative')}</th>
                                <th className={`px-4 py-3 text-xs font-bold text-emerald-500 uppercase tracking-wider ${alignEnd}`}>{t('reports.netRemaining', 'Net remaining')}</th>
                                <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t(`${tPath}.admin`, t('reports.fields.paidBy', 'Processed by'))}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="9" className="p-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                                        <p className="text-gray-400 font-medium">{t('common.loading', 'Loading...')}</p>
                                    </td>
                                </tr>
                            ) : (!data?.rows || data.rows.length === 0) ? (
                                <tr>
                                    <td colSpan="9" className="p-12 text-center">
                                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                                        <p className="text-gray-400 font-medium">{t('common.noResults', 'No data available')}</p>
                                    </td>
                                </tr>
                            ) : (
                                data.rows.map((row, idx) => (
                                    <React.Fragment key={row.id}>
                                        <tr
                                            className={`hover:bg-slate-700/30 transition-colors cursor-pointer ${expandedRow === row.id ? 'bg-slate-700/30' : ''}`}
                                            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                                        >
                                            <td className="px-4 py-3">
                                                <Info className={`w-4 h-4 transition-transform ${expandedRow === row.id ? 'text-indigo-400 scale-125' : 'text-gray-500'}`} />
                                            </td>
                                            <td className={`px-4 py-3 text-white ${alignStart}`}>
                                                <div>{row.refundedAt ? formatDateTime(row.refundedAt, i18n.language).split(',')[0] : 'N/A'}</div>
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                    {row.refundedAt ? formatDateTime(row.refundedAt, i18n.language).split(',')[1] : ''}
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 font-mono text-xs text-indigo-400 font-bold ${alignStart}`}>
                                                #{row.receiptId || '0000'}
                                            </td>
                                            <td className={`px-4 py-3 ${alignStart}`}>
                                                <div className="flex items-center gap-2 group">
                                                    <div className="font-medium text-white">
                                                        {row.member?.name || t('common.unknown', 'Unknown')}
                                                    </div>
                                                    <span className="text-[10px] px-1 bg-slate-700 rounded text-gray-400 uppercase">{row.member?.code}</span>
                                                    {row.member?.id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedMemberId(row.member.id);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded text-indigo-400 transition-all"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 ${alignEnd} font-mono text-xs text-gray-400`}>
                                                {formatCurrency(row.originalPaid || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className={`px-4 py-3 ${alignEnd} font-mono font-bold text-red-500`}>
                                                {formatCurrency(row.amount || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className={`px-4 py-3 ${alignEnd} font-mono text-xs text-gray-500`}>
                                                {formatCurrency(row.totalRefundedSoFar || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className={`px-4 py-3 ${alignEnd} font-mono font-bold text-emerald-500`}>
                                                {formatCurrency(row.netRemaining || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-gray-400 ${alignStart}`}>
                                                {row.processedBy?.name}
                                            </td>
                                        </tr>

                                        {/* Expansion Detail */}
                                        <AnimatePresence>
                                            {expandedRow === row.id && (
                                                <tr>
                                                    <td colSpan="9" className="p-0 border-none bg-slate-900/30">
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="p-6 border-l-4 border-indigo-500 ml-4 my-2 space-y-4">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <h4 className="text-sm font-bold text-white mb-1">{t('reports.refunds.auditDetails', 'Refund audit details')}</h4>
                                                                        <p className="text-xs text-gray-500">{t('reports.refunds.auditSubtext', 'Transaction details and history.')}</p>
                                                                    </div>
                                                                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                                                                        <span className="text-[10px] text-gray-400 uppercase mr-2">{t('reports.fields.method', 'Method')}:</span>
                                                                        <span className="text-xs font-bold text-white capitalize">{row.method}</span>
                                                                    </div>
                                                                </div>

                                                                {row.reason && (
                                                                    <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                                                        <p className="text-xs font-bold text-red-400 uppercase tracking-tighter mb-1">{t('reports.refunds.reason', 'Reason for refund')}</p>
                                                                        <p className="text-sm text-gray-300 italic">"{row.reason}"</p>
                                                                    </div>
                                                                )}

                                                                <div className="grid grid-cols-4 gap-4">
                                                                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                                                        <p className="text-[10px] text-gray-500 uppercase mb-1">{t('reports.refunds.originalActivity', 'Original activity')}</p>
                                                                        <p className="text-sm font-bold text-white uppercase truncate">{row.subscription?.name}</p>
                                                                    </div>
                                                                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                                                        <p className="text-[10px] text-gray-500 uppercase mb-1">{t('reports.refunds.issuedBy', 'Refund issued by')}</p>
                                                                        <p className="text-sm font-bold text-white">{row.processedBy?.name}</p>
                                                                    </div>
                                                                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                                                        <p className="text-[10px] text-gray-500 uppercase mb-1">{t('reports.refunds.actionDate', 'Action date')}</p>
                                                                        <p className="text-sm font-bold text-white font-mono">{formatDateTime(row.refundedAt, i18n.language)}</p>
                                                                    </div>
                                                                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                                                        <p className="text-[10px] text-gray-500 uppercase mb-1">{t('reports.refunds.auditTrace', 'Audit trace')}</p>
                                                                        <p className="text-sm font-bold text-indigo-400 font-mono">TXN-{row.id}</p>
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
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RefundsReport;
