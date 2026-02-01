import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search,
    FileSpreadsheet,
    Loader2,
    Calendar,
    RefreshCw,
    Eye,
    TrendingDown,
    Users,
    AlertCircle,
    Download,
    DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import MemberDetailsModal from './MemberDetailsModal';
import ReportLayout from './Reports/ReportLayout';

const RefundsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';

    const [data, setData] = useState({ rows: [], summary: { totalRefunded: 0, count: 0, thisMonthTotal: 0, thisMonthCount: 0 } });
    const [isLoading, setIsLoading] = useState(false);
    const [admins, setAdmins] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState(null);

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

    useEffect(() => {
        const fetchAdmins = async () => {
            try {
                const res = await api.get('/users/list');
                setAdmins(res.data.data || []);
            } catch (err) { }
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
    }, [isActive]);

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

    return (
        <ReportLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <MemberDetailsModal
                    isOpen={!!selectedMemberId}
                    onClose={() => setSelectedMemberId(null)}
                    memberId={selectedMemberId}
                />

                <ReportLayout.Header
                    icon={TrendingDown}
                    title={t('refunds.title')}
                    subtitle={t('refunds.subtitle')}
                />

                <ReportLayout.FilterBar>
                    <ReportLayout.SearchInput
                        label={t('refunds.memberName')}
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        placeholder={t('refunds.searchByMemberName')}
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
                            onClick={fetchRefunds}
                            loading={isLoading}
                            icon={RefreshCw}
                        >
                            {t('common.refresh', 'تحديث')}
                        </ReportLayout.RefreshButton>

                        <button
                            onClick={handleExport}
                            disabled={!data.rows.length}
                            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
                        >
                            <Download size={18} />
                            {t('common.export', 'تصدير')}
                        </button>
                    </div>
                </ReportLayout.FilterBar>

                <ReportLayout.MetricsGrid>
                    <ReportLayout.MetricCard
                        icon={FileSpreadsheet}
                        label={t('refunds.totalRefunds')}
                        value={formatNumber(data?.summary?.count || 0, i18n.language)}
                        color="amber"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={DollarSign}
                        label={t('refunds.totalAmount')}
                        value={formatCurrency(data?.summary?.totalRefunded || 0, i18n.language, currencyConf)}
                        color="red"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={Calendar}
                        label={t('refunds.thisMonth')}
                        value={formatCurrency(data?.summary?.thisMonthTotal || 0, i18n.language, currencyConf)}
                        color="teal"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={AlertCircle}
                        label={t('refunds.count')}
                        value={formatNumber(data?.summary?.thisMonthCount || 0, i18n.language)}
                        color="blue"
                        loading={isLoading}
                    />
                </ReportLayout.MetricsGrid>

                <ReportLayout.Content>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                        </div>
                    ) : data.rows.length === 0 ? (
                        <ReportLayout.EmptyState
                            icon={AlertCircle}
                            title={t('reports.noData', 'لا توجد بيانات')}
                            subtitle={t('reports.adjustFilters', 'اضبط المرشحات او اختر نطاق تاريخ اخر')}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 border-b border-white/5">
                                    <tr className={isRTL ? 'text-right' : 'text-left'}>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('refunds.transactionId')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('refunds.memberName')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('refunds.createdAt')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('refunds.originalPaidAmount')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('refunds.refundedAmount')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('refunds.remainingAmount')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('refunds.notes')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('common.actions')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.rows.map((refund) => (
                                        <tr key={refund.id} className="hover:bg-white/5 transition">
                                            <td className="p-4 text-white font-medium">
                                                #{refund.receiptId || refund.paymentId || refund.id || t('refunds.noValue')}
                                            </td>
                                            <td className="p-4 text-slate-300 font-medium">
                                                {refund.member?.name || t('refunds.notAvailable')}
                                            </td>
                                            <td className="p-4 text-slate-400 font-mono text-xs">
                                                {refund.refundedAt ? formatDateTime(refund.refundedAt, i18n.language) : t('refunds.noValue')}
                                            </td>
                                            <td className="p-4 text-right text-slate-300">
                                                {refund.originalPaid ? formatCurrency(refund.originalPaid, i18n.language, currencyConf) : t('refunds.noValue')}
                                            </td>
                                            <td className="p-4 text-right font-bold text-red-400">
                                                {refund.amount ? `-${formatCurrency(refund.amount, i18n.language, currencyConf)}` : t('refunds.noValue')}
                                            </td>
                                            <td className="p-4 text-right text-slate-300">
                                                {(refund.netRemaining !== undefined && refund.netRemaining !== null) ? formatCurrency(refund.netRemaining, i18n.language, currencyConf) : t('refunds.noValue')}
                                            </td>
                                            <td className="p-4 text-slate-500 italic text-xs max-w-[200px] truncate">
                                                {refund.reason || refund.notes || t('refunds.noValue')}
                                            </td>
                                            <td className="p-4 text-center">
                                                {refund.member?.id && (
                                                    <button
                                                        onClick={() => setSelectedMemberId(refund.member.id)}
                                                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold mx-auto"
                                                    >
                                                        <Eye size={14} />
                                                        {t('common.view')}
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

export default RefundsReport;
