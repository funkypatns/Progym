import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search,
    FileSpreadsheet,
    Loader2,
    Calendar,
    Banknote,
    AlertCircle,
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
import MemberDetailsModal from './MemberDetailsModal';
import ReportSummaryCards from './ReportSummaryCards';

const CancellationsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';
    const alignStart = isRTL ? 'text-right' : 'text-left';
    const alignEnd = isRTL ? 'text-left' : 'text-right';
    const searchIconPosition = isRTL ? 'right-3' : 'left-3';
    const searchPadding = isRTL ? 'pr-10' : 'pl-10';

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
                toast.error(response.data.message || t('common.error', 'Error'));
            }
        } catch (error) {
            toast.error(t('reports.errors.serverError', 'Failed to load cancellations report'));
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
            toast.success(t('common.success', 'Success'));
        } catch (error) {
            toast.error(t('common.error', 'Error'));
        }
    };

    if (!isActive) return null;

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
                        label: t(`${tPath}.totalCancellations`, 'Total cancellations'),
                        value: formatNumber(data?.summary?.totalCancellations || 0, i18n.language),
                        icon: XCircle,
                        iconClassName: 'bg-red-500'
                    },
                    {
                        label: t(`${tPath}.totalRefunded`, 'Total refunded'),
                        value: formatCurrency(data?.summary?.totalRefunded || 0, i18n.language, currencyConf),
                        icon: ArrowDownRight,
                        iconClassName: 'bg-orange-500'
                    },
                    {
                        label: t(`${tPath}.netRevenueImpact`, 'Net revenue impact'),
                        value: formatCurrency(data?.summary?.netRevenueImpact || 0, i18n.language, currencyConf),
                        icon: Banknote,
                        iconClassName: 'bg-emerald-500'
                    }
                ]}
            />

            {/* Toolbar */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {t('reports.from', 'From')}
                        </label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        />
                    </div>
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {t('reports.to', 'To')}
                        </label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        />
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
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder={t(`${tPath}.searchPlaceholder`, 'Search by name...')}
                                className={`w-full h-11 ${searchPadding} bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white placeholder:text-gray-500`}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={fetchCancellations}
                            disabled={isLoading}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            <RefreshCw size={18} />
                            {t('common.refresh', 'Refresh')}
                        </button>
                        <button
                            onClick={handleExport}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        >
                            <FileSpreadsheet size={18} />
                            {t(`${tPath}.exportExcel`, t('reports.export', 'Export'))}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">{t('common.loading', 'Loading...')}</p>
                    </div>
                ) : data.report.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <AlertCircle className="w-12 h-12 text-gray-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">{t('common.noResults', 'No data available')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900/70 border-b border-slate-700/50 sticky top-0">
                                <tr>
                                    <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t(`${tPath}.canceledAt`, 'Date')}</th>
                                    <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t(`${tPath}.member`, 'Member')}</th>
                                    <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t(`${tPath}.plan`, 'Plan')}</th>
                                    <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t(`${tPath}.status`, 'Status')}</th>
                                    <th className={`px-4 py-3 text-xs font-bold text-emerald-400 uppercase tracking-wider ${alignEnd}`}>{t(`${tPath}.paid`, 'Paid')}</th>
                                    <th className={`px-4 py-3 text-xs font-bold text-red-400 uppercase tracking-wider ${alignEnd}`}>{t(`${tPath}.refunded`, 'Refunded')}</th>
                                    <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignEnd}`}>{t(`${tPath}.net`, 'Net')}</th>
                                    <th className={`px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t('common.actions', 'Action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {data.report.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors group">
                                        {(() => {
                                            const memberName = item.member?.name
                                                || [item.member?.firstName, item.member?.lastName].filter(Boolean).join(' ')
                                                || '-';
                                            const memberPhone = item.member?.phone || '';
                                            const planName = item.plan?.name_ar || item.plan?.name_en || item.plan?.name || '-';
                                            const paidAmount = item.paid ?? item.financials?.paidAmount ?? 0;
                                            const refundedAmount = item.refunded ?? item.financials?.refundedAmount ?? 0;
                                            const netAmount = item.net ?? item.financials?.netRevenue ?? 0;

                                            return (
                                                <>
                                        <td className={`px-4 py-3 text-white ${alignStart}`}>
                                            <span className="text-sm font-medium">{formatDateTime(item.canceledAt, i18n.language)}</span>
                                        </td>
                                        <td className={`px-4 py-3 ${alignStart}`}>
                                            <div>
                                                <p className="text-sm font-medium text-white">{memberName}</p>
                                                {memberPhone && (
                                                    <p className="text-xs text-gray-400">{memberPhone}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 text-white text-sm ${alignStart}`}>{planName}</td>
                                        <td className={`px-4 py-3 ${alignStart}`}>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${item.status === 'cancelled'
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {item.status === 'cancelled'
                                                    ? t('reports.status.cancelled', 'Cancelled')
                                                    : t('reports.status.ended', 'Ended')}
                                            </span>
                                            <div className="mt-1 text-[10px] text-gray-400 space-y-0.5">
                                                <div>
                                                    {t(`${tPath}.reason`, 'Reason')}: {item.cancelReason || t(`${tPath}.noReason`, 'Not specified')}
                                                </div>
                                                <div>
                                                    {t(`${tPath}.source`, 'Source')}: {item.cancelSource || t(`${tPath}.unknownSource`, 'Unknown')}
                                                </div>
                                                <div>
                                                    {t(`${tPath}.processedBy`, 'Processed by')}: {item.processedBy || t('common.unknown', 'Unknown')}
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 ${alignEnd}`}>
                                            <span className="font-mono font-semibold text-emerald-400">
                                                {formatCurrency(paidAmount, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 ${alignEnd}`}>
                                            <span className="font-mono font-semibold text-red-400">
                                                {formatCurrency(refundedAmount, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 ${alignEnd}`}>
                                            <span className="font-mono font-semibold text-white">
                                                {formatCurrency(netAmount, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 ${alignStart}`}>
                                            <button
                                                onClick={() => setSelectedMemberId(item.member?.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-600 rounded-lg"
                                            >
                                                <Eye className="w-4 h-4 text-gray-300" />
                                            </button>
                                        </td>
                                                </>
                                            );
                                        })()}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CancellationsReport;
