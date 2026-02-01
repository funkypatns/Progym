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
    ArrowDownRight,
    Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import MemberDetailsModal from './MemberDetailsModal';
import ReportLayout from './Reports/ReportLayout';

const CancellationsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';

    const [data, setData] = useState({ report: [], summary: { totalCancellations: 0, totalRefunded: 0, netRevenueImpact: 0 } });
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState(null);

    const tPath = 'reports.fields.cancellations';

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
    }, [isActive]);

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
        <ReportLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <MemberDetailsModal
                    isOpen={!!selectedMemberId}
                    onClose={() => setSelectedMemberId(null)}
                    memberId={selectedMemberId}
                />

                <ReportLayout.Header
                    icon={XCircle}
                    title={t('reports.cancellations.title', 'Cancellations')}
                    subtitle={t('reports.cancellations.subtitle', 'Monthly cancellation report')}
                />

                <ReportLayout.FilterBar>
                    <ReportLayout.SearchInput
                        label={t('reports.searchByName', 'Search by name')}
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        placeholder={t('reports.searchNamePlaceholder', 'Search by member name...')}
                        icon={Search}
                    />

                    <ReportLayout.DateInput
                        label={t('reports.startDate', 'تاريخ البدء')}
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        icon={Calendar}
                    />

                    <ReportLayout.DateInput
                        label={t('reports.endDate', 'تاريخ الانتهاء')}
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        icon={Calendar}
                    />

                    <div className="flex gap-2">
                        <ReportLayout.RefreshButton
                            onClick={fetchCancellations}
                            loading={isLoading}
                            icon={RefreshCw}
                        >
                            {t('common.refresh', 'تحديث')}
                        </ReportLayout.RefreshButton>

                        <button
                            onClick={handleExport}
                            disabled={!data.report?.length}
                            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
                        >
                            <Download size={18} />
                            {t('common.export', 'تصدير')}
                        </button>
                    </div>
                </ReportLayout.FilterBar>

                <ReportLayout.MetricsGrid className="lg:grid-cols-3">
                    <ReportLayout.MetricCard
                        icon={XCircle}
                        label={t('reports.cancellations.totalCancellations', 'Total Cancellations')}
                        value={formatNumber(data?.summary?.totalCancellations || 0, i18n.language)}
                        color="red"
                        loading={isLoading}
                        center={true}
                    />
                    <ReportLayout.MetricCard
                        icon={ArrowDownRight}
                        label={t('reports.cancellations.totalRefunded', 'Total Refunded')}
                        value={formatCurrency(data?.summary?.totalRefunded || 0, i18n.language, currencyConf)}
                        color="amber"
                        loading={isLoading}
                        center={true}
                    />
                    <ReportLayout.MetricCard
                        icon={Banknote}
                        label={t('reports.cancellations.netRevenueImpact', 'Net Revenue Impact')}
                        value={formatCurrency(data?.summary?.netRevenueImpact || 0, i18n.language, currencyConf)}
                        color="emerald"
                        loading={isLoading}
                        center={true}
                        subtitle={t('reports.cancellations.netSubtitle', 'Gross - Refunded')}
                    />
                </ReportLayout.MetricsGrid>

                <ReportLayout.Content>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                        </div>
                    ) : !data.report || data.report.length === 0 ? (
                        <ReportLayout.EmptyState
                            icon={AlertCircle}
                            title={t('reports.noData', 'لا توجد بيانات')}
                            subtitle={t('reports.noCancellations', 'لا توجد إلغاءات في هذه الفترة')}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 border-b border-white/5">
                                    <tr className={isRTL ? 'text-right' : 'text-left'}>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('reports.fields.member', 'Member')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('reports.fields.email', 'Email')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('reports.fields.cancelledAt', 'Cancelled At')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('reports.fields.refundedAmount', 'Refunded Amount')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('reports.fields.reason', 'Reason')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('common.actions', 'Actions')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.report.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/5 transition">
                                            <td className="p-4 text-white font-medium">
                                                {item.memberName || `${item.member?.firstName} ${item.member?.lastName}`}
                                            </td>
                                            <td className="p-4 text-slate-300 text-xs">{item.memberEmail || item.member?.email}</td>
                                            <td className="p-4 text-slate-400 font-mono text-xs">
                                                {formatDateTime(item.cancelledAt || item.createdAt)}
                                            </td>
                                            <td className="p-4 text-right font-bold text-red-400">
                                                -{formatCurrency(item.refundedAmount || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-slate-500 italic text-xs max-w-[250px] truncate">
                                                {item.reason || item.cancellationReason || '-'}
                                            </td>
                                            <td className="p-4 text-center">
                                                {item.memberId && (
                                                    <button
                                                        onClick={() => setSelectedMemberId(item.memberId)}
                                                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold mx-auto"
                                                    >
                                                        <Eye size={14} />
                                                        {t('common.view', 'View')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </ReportLayout.Content>
            </div>
        </ReportLayout>
    );
};

export default CancellationsReport;
