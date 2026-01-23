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
        <div className="space-y-4">
            <MemberDetailsModal
                isOpen={!!selectedMemberId}
                onClose={() => setSelectedMemberId(null)}
                memberId={selectedMemberId}
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Cancellations */}
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 flex items-center just ify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {t(`${tPath}.totalCancellations`)}
                        </p>
                        <h3 className="text-2xl font-bold text-white">
                            {formatNumber(data?.summary?.totalCancellations || 0, i18n.language)}
                        </h3>
                    </div>
                    <div className="p-3 bg-red-500 rounded-xl">
                        <XCircle className="w-6 h-6 text-white" />
                    </div>
                </div>

                {/* Total Refunded */}
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {t(`${tPath}.totalRefunded`)}
                        </p>
                        <h3 className="text-2xl font-bold text-white">
                            {formatCurrency(data?.summary?.totalRefunded || 0, i18n.language, currencyConf)}
                        </h3>
                    </div>
                    <div className="p-3 bg-orange-500 rounded-xl">
                        <ArrowDownRight className="w-6 h-6 text-white" />
                    </div>
                </div>

                {/* Net Revenue Impact */}
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {t(`${tPath}.netRevenueImpact`)}
                        </p>
                        <h3 className="text-2xl font-bold text-white">
                            {formatCurrency(data?.summary?.netRevenueImpact || 0, i18n.language, currencyConf)}
                        </h3>
                    </div>
                    <div className="p-3 bg-emerald-500 rounded-xl">
                        <Banknote className="w-6 h-6 text-white" />
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {i18n.language === 'ar' ? 'من' : 'From'}
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
                            {i18n.language === 'ar' ? 'إلى' : 'To'}
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
                            {i18n.language === 'ar' ? 'بحث' : 'Search'}
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder={i18n.language === 'ar' ? 'ابحث بالاسم...' : 'Search by name...'}
                                className="w-full h-11 pl-10 pr-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white placeholder:text-gray-500"
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
                            {i18n.language === 'ar' ? 'تحديث' : 'Refresh'}
                        </button>
                        <button
                            onClick={handleExport}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        >
                            <FileSpreadsheet size={18} />
                            {i18n.language === 'ar' ? 'تصدير' : 'Export'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">Loading...</p>
                    </div>
                ) : data.report.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <AlertCircle className="w-12 h-12 text-gray-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">{i18n.language === 'ar' ? 'لا توجد بيانات' : 'No data available'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900/50 border-b border-slate-700/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'تاريخ الإلغاء' : 'Date'}</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'العضو' : 'Member'}</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'الباقة' : 'Plan'}</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'الحالة' : 'Status'}</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-emerald-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'مدفوع' : 'Paid'}</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-red-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'مسترد' : 'Refunded'}</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'صافي' : 'Net'}</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'الإجراء' : 'Action'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {data.report.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-4 py-3 text-white">
                                            <span className="text-sm font-medium">{formatDateTime(item.canceledAt, i18n.language)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-white">{item.member?.firstName} {item.member?.lastName}</p>
                                                <p className="text-xs text-gray-400">{item.member?.phone}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-white text-sm">{item.plan?.name_ar || item.plan?.name_en}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${item.status === 'cancelled'
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {item.status === 'cancelled' ? (i18n.language === 'ar' ? 'ملغي' : 'Cancelled') : (i18n.language === 'ar' ? 'منتهي' : 'Ended')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-mono font-semibold text-emerald-400">
                                                {formatCurrency(item.paid, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-mono font-semibold text-red-400">
                                                {formatCurrency(item.refunded, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-mono font-semibold text-white">
                                                {formatCurrency(item.net, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setSelectedMemberId(item.member?.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-600 rounded-lg"
                                            >
                                                <Eye className="w-4 h-4 text-gray-300" />
                                            </button>
                                        </td>
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
