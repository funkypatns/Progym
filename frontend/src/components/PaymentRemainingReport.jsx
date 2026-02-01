import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Loader2, RefreshCw, FileSpreadsheet, DollarSign, Eye, Calendar, Search, Users, AlertCircle, Banknote, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatCurrency } from '../utils/numberFormatter';
import { formatDateTime } from '../utils/dateFormatter';
import { useAuthStore, useSettingsStore } from '../store';
import MemberLedgerModal from './MemberLedgerModal';
import MemberDetailsModal from './MemberDetailsModal';
import ReportLayout from './Reports/ReportLayout';

const normalizeReportResponse = (data) => {
    if (!data) return null;
    return {
        rows: Array.isArray(data.rows) ? data.rows : [],
        summary: {
            totalDue: data.summary?.totalDue || 0,
            totalPaid: data.summary?.totalPaid || 0,
            totalRemaining: data.summary?.totalRemaining || 0,
            countUnpaid: data.summary?.countUnpaid || 0,
            countPartial: data.summary?.countPartial || 0,
            countSettled: data.summary?.countSettled || 0
        },
        metadata: {
            generatedAt: data.metadata?.generatedAt || new Date().toISOString(),
            recordCount: data.metadata?.recordCount || 0
        }
    };
};

const PaymentRemainingReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { user } = useAuthStore();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';

    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    const [filters, setFilters] = useState({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        search: '',
        planId: '',
        status: [],
        employeeId: '',
        remainingOnly: false
    });
    const [plans, setPlans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [ledgerTarget, setLedgerTarget] = useState(null);
    const [viewMemberId, setViewMemberId] = useState(null);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    useEffect(() => {
        if (isActive) {
            fetchPlans();
            fetchEmployees();
        }
    }, [isActive]);

    const fetchPlans = async () => {
        try {
            const res = await apiClient.get('/plans');
            setPlans(res.data.data || []);
        } catch (e) { }
    };

    const fetchEmployees = async () => {
        try {
            const res = await apiClient.get('/users/list');
            setEmployees(res.data.data || []);
        } catch (e) { }
    };

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                from: filters.from,
                to: filters.to
            });
            if (filters.search) params.append('search', filters.search);
            if (filters.planId) params.append('planId', filters.planId);
            if (filters.status.length > 0) params.append('status', filters.status.join(','));
            if (filters.employeeId) params.append('employeeId', filters.employeeId);
            if (filters.remainingOnly) params.append('remainingOnly', 'true');
            params.append('_ts', Date.now().toString());

            const res = await apiClient.get(`/reports/payment-remaining?${params}`);
            setData(normalizeReportResponse(res.data.success ? res.data.data : null));
        } catch (error) {
            toast.error(t('reports.errors.serverError', 'Failed to load report'));
            setData(normalizeReportResponse(null));
        } finally {
            setIsLoading(false);
        }
    }, [filters, t]);

    useEffect(() => {
        if (isActive) fetchReport();
    }, [isActive]);

    useEffect(() => {
        if (!isActive) return;
        const handlePaymentsUpdated = () => {
            fetchReport();
        };
        window.addEventListener('payments:updated', handlePaymentsUpdated);
        return () => window.removeEventListener('payments:updated', handlePaymentsUpdated);
    }, [isActive, fetchReport]);

    const exportExcel = async () => {
        try {
            const params = new URLSearchParams({
                from: filters.from,
                to: filters.to,
                format: 'excel'
            });
            if (filters.search) params.append('search', filters.search);
            if (filters.planId) params.append('planId', filters.planId);
            if (filters.status.length > 0) params.append('status', filters.status.join(','));
            if (filters.employeeId) params.append('employeeId', filters.employeeId);
            if (filters.remainingOnly) params.append('remainingOnly', 'true');

            const res = await apiClient.get(`/reports/payment-remaining?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'payment-remaining-report.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(t('reports.exportSuccess', 'Report exported'));
        } catch (error) {
            toast.error(t('reports.exportFailed', 'Export failed'));
        }
    };

    const getStatusBadge = (status) => {
        const configs = {
            unpaid: { label: t('reports.status.unpaid', 'Unpaid'), class: 'bg-red-500/10 text-red-400 border-red-500/20' },
            partial: { label: t('reports.status.partial', 'Partial'), class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
            settled: { label: t('reports.status.settled', 'Settled'), class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
            overpaid: { label: t('reports.status.overpaid', 'Overpaid'), class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
        };
        const cfg = configs[status] || configs.unpaid;
        return <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${cfg.class}`}>{cfg.label}</span>;
    };

    const toggleStatus = (s) => {
        setFilters(prev => ({
            ...prev,
            status: prev.status.includes(s)
                ? prev.status.filter(x => x !== s)
                : [...prev.status, s]
        }));
    };

    const statusLabels = {
        unpaid: t('reports.status.unpaid', 'Unpaid'),
        partial: t('reports.status.partial', 'Partial'),
        settled: t('reports.status.settled', 'Settled'),
        overpaid: t('reports.status.overpaid', 'Overpaid')
    };

    if (!isActive) return null;

    return (
        <ReportLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {ledgerTarget && (
                    <MemberLedgerModal
                        isOpen={!!ledgerTarget}
                        onClose={() => setLedgerTarget(null)}
                        memberId={ledgerTarget.memberId}
                        subscriptionId={ledgerTarget.subscriptionId}
                        memberName={ledgerTarget.memberName}
                    />
                )}

                {viewMemberId && (
                    <MemberDetailsModal
                        isOpen={!!viewMemberId}
                        onClose={() => setViewMemberId(null)}
                        memberId={viewMemberId}
                    />
                )}

                <ReportLayout.Header
                    icon={AlertCircle}
                    title={t('reports.outstanding.title', 'Outstanding payments')}
                    subtitle={t('reports.outstanding.subtitle', 'Track unpaid and partial subscriptions')}
                />

                {/* Filter Bar */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <ReportLayout.DateInput
                            label={t('reports.from', 'From')}
                            value={filters.from}
                            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                            icon={Calendar}
                        />

                        <ReportLayout.DateInput
                            label={t('reports.to', 'To')}
                            value={filters.to}
                            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                            icon={Calendar}
                        />

                        <ReportLayout.SearchInput
                            label={t('common.search', 'Search')}
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            placeholder={t('reports.searchPlaceholder', 'Search name, code, or phone...')}
                            icon={Search}
                        />

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <FileSpreadsheet size={14} />
                                {t('reports.fields.planName', 'Plan')}
                            </label>
                            <select
                                value={filters.planId}
                                onChange={(e) => setFilters({ ...filters, planId: e.target.value })}
                                className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                            >
                                <option value="">{t('reports.allPlans', 'All plans')}</option>
                                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Status Multi-Select */}
                        <div className="flex gap-2">
                            {['unpaid', 'partial', 'settled', 'overpaid'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => toggleStatus(s)}
                                    className={`px-3 py-2 text-xs rounded-lg font-bold transition-all ${filters.status.includes(s)
                                        ? 'bg-teal-500 text-white'
                                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                        }`}
                                >
                                    {statusLabels[s]}
                                </button>
                            ))}
                        </div>

                        {/* Employee Filter */}
                        <select
                            value={filters.employeeId}
                            onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                            className="h-[42px] px-4 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-colors text-sm text-white"
                        >
                            <option value="">{t('reports.allEmployees', 'All employees')}</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                        </select>

                        {/* Remaining Only Toggle */}
                        <label className="flex items-center gap-2 text-sm text-gray-300 font-medium cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={filters.remainingOnly}
                                onChange={(e) => setFilters({ ...filters, remainingOnly: e.target.checked })}
                                className="rounded w-4 h-4 accent-teal-500 bg-slate-700 border-slate-600"
                            />
                            {t('reports.remainingOnly', 'Remaining only')}
                        </label>

                        <div className="flex-1" />

                        <div className="flex gap-2">
                            <ReportLayout.RefreshButton
                                onClick={fetchReport}
                                loading={isLoading}
                                icon={RefreshCw}
                            >
                                {t('common.refresh', 'Refresh')}
                            </ReportLayout.RefreshButton>

                            <button
                                onClick={exportExcel}
                                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 h-[42px]"
                            >
                                <Download size={18} />
                                {t('reports.export', 'Export')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                {data && (
                    <ReportLayout.MetricsGrid>
                        <ReportLayout.MetricCard
                            icon={Banknote}
                            label={t('reports.totalDue', 'TOTAL DUE')}
                            value={formatCurrency(data.summary.totalDue, i18n.language, currencyConf)}
                            color="blue"
                            loading={isLoading}
                        />
                        <ReportLayout.MetricCard
                            icon={DollarSign}
                            label={t('common.paid', 'PAID')}
                            value={formatCurrency(data.summary.totalPaid, i18n.language, currencyConf)}
                            color="emerald"
                            loading={isLoading}
                        />
                        <ReportLayout.MetricCard
                            icon={AlertCircle}
                            label={t('reports.remaining', 'REMAINING')}
                            value={formatCurrency(data.summary.totalRemaining, i18n.language, currencyConf)}
                            color="red"
                            loading={isLoading}
                        />
                        <div className="bg-slate-700/30 border-slate-600/20 border rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm transition-all hover:scale-[1.02]">
                            <div className="flex items-center gap-4">
                                <div className="flex-1 text-left">
                                    <div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-3 text-slate-400">
                                        {t('reports.cases', 'DATES')}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/20">{data.summary.countUnpaid}</span>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20">{data.summary.countPartial}</span>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">{data.summary.countSettled}</span>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                                    <Users size={20} strokeWidth={2} />
                                </div>
                            </div>
                        </div>
                    </ReportLayout.MetricsGrid>
                )}

                {/* Table */}
                <ReportLayout.Content>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                        </div>
                    ) : !data || data.rows.length === 0 ? (
                        <ReportLayout.EmptyState
                            icon={AlertCircle}
                            title={t('reports.noData', 'No data found')}
                            subtitle={t('reports.adjustFilters', 'Adjust filters or select a different date range')}
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
                                            {t('reports.fields.planName', 'Plan')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('reports.fields.lastPayment', 'Last Payment')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('reports.fields.totalDue', 'Total')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('reports.fields.paid', 'Paid')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('reports.fields.remaining', 'Remaining')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('reports.fields.status', 'Status')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('common.actions', 'Actions')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-white/5 transition">
                                            <td className="p-4 text-white font-medium">{row.memberName}</td>
                                            <td className="p-4 text-slate-300">{row.planName}</td>
                                            <td className="p-4 text-slate-400 font-mono text-xs">
                                                {row.lastPaymentDate ? formatDateTime(row.lastPaymentDate) : '-'}
                                            </td>
                                            <td className="p-4 text-right text-white font-medium">
                                                {formatCurrency(row.totalDue || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-right text-emerald-400 font-bold">
                                                {formatCurrency(row.paid || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-right text-red-400 font-bold">
                                                {formatCurrency(row.remaining || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {getStatusBadge(row.status)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setLedgerTarget({
                                                            memberId: row.memberId,
                                                            subscriptionId: row.subscriptionId,
                                                            memberName: row.memberName
                                                        })}
                                                        className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold"
                                                    >
                                                        <FileSpreadsheet size={14} />
                                                        Ledger
                                                    </button>
                                                    <button
                                                        onClick={() => setViewMemberId(row.memberId)}
                                                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold"
                                                    >
                                                        <Eye size={14} />
                                                        View
                                                    </button>
                                                </div>
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

export default PaymentRemainingReport;
