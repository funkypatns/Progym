import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Calendar, RefreshCw, Search, Clock, AlertCircle, CheckCircle, Activity, BarChart3 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import ReportLayout from './Reports/ReportLayout';

const ShiftReports = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [nameFilter, setNameFilter] = useState('');
    const isRTL = i18n.language === 'ar';

    // Date filter state
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    const fetchShifts = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            const response = await apiClient.get(`/pos/shifts?${params}`);
            setShifts(Array.isArray(response.data?.data) ? response.data.data : []);
        } catch (error) {
            toast.error(t('reports.errors.serverError', 'Failed to load shift reports'));
            setShifts([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchShifts();
        }
    }, [isActive]);

    // Client-side name filtering
    const filteredShifts = useMemo(() => {
        if (!nameFilter.trim()) return shifts;
        const lowerFilter = nameFilter.toLowerCase();
        return shifts.filter(shift => {
            const firstName = shift.opener?.firstName?.toLowerCase() || '';
            const lastName = shift.opener?.lastName?.toLowerCase() || '';
            const fullName = `${firstName} ${lastName}`;
            return firstName.includes(lowerFilter) || lastName.includes(lowerFilter) || fullName.includes(lowerFilter);
        });
    }, [shifts, nameFilter]);

    const summary = useMemo(() => {
        return filteredShifts.reduce((acc, shift) => {
            const expected = shift.expectedCash || 0;
            const actual = shift.endedCash || 0;
            const diff = actual - expected;
            acc.total += 1;
            acc.expected += expected;
            acc.actual += actual;
            acc.diff += diff;
            if (!shift.endedAt) {
                acc.active += 1;
            } else if (Math.abs(diff) < 0.01) {
                acc.balanced += 1;
            } else {
                acc.review += 1;
            }
            return acc;
        }, {
            total: 0,
            active: 0,
            balanced: 0,
            review: 0,
            expected: 0,
            actual: 0,
            diff: 0
        });
    }, [filteredShifts]);

    if (!isActive) return null;

    return (
        <ReportLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <ReportLayout.Header
                    icon={BarChart3}
                    title={t('reports.shiftReport.title', 'Shift report')}
                    subtitle={t('reports.shiftReport.subtitle', 'Cashier shift salary and balance')}
                />

                {/* Filter Bar */}
                <ReportLayout.FilterBar>
                    <ReportLayout.DateInput
                        label={t('reports.startDate', 'تاريخ البدء')}
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                        icon={Calendar}
                    />
                    <ReportLayout.DateInput
                        label={t('reports.endDate', 'تاريخ الانتهاء')}
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                        icon={Calendar}
                    />
                    <ReportLayout.SearchInput
                        label={t('reports.filterByName', 'Filter by name')}
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        placeholder={t('reports.searchStaff', 'Search by staff...')}
                        icon={Search}
                    />
                    <ReportLayout.RefreshButton
                        onClick={fetchShifts}
                        loading={isLoading}
                        icon={RefreshCw}
                    >
                        {t('common.refresh', 'تحديث')}
                    </ReportLayout.RefreshButton>
                </ReportLayout.FilterBar>

                {/* Metrics Grid */}
                <ReportLayout.MetricsGrid>
                    <ReportLayout.MetricCard
                        icon={Activity}
                        label={t('reports.shifts.total', 'TOTAL SHIFTS')}
                        value={summary.total}
                        color="blue"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={Clock}
                        label={t('reports.shifts.active', 'ACTIVE SHIFTS')}
                        value={summary.active}
                        color="teal"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={CheckCircle}
                        label={t('cashClosing.status.balanced', 'مكتمل')}
                        value={summary.balanced}
                        color="emerald"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={AlertCircle}
                        label={t('reports.shifts.needsReview', 'NEEDS REVIEW')}
                        value={summary.review}
                        color="amber"
                        loading={isLoading}
                    />
                </ReportLayout.MetricsGrid>

                {/* Content */}
                <ReportLayout.Content>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                        </div>
                    ) : filteredShifts.length === 0 ? (
                        <ReportLayout.EmptyState
                            icon={AlertCircle}
                            title={t('reports.noData', 'لا توجد بيانات')}
                            subtitle={t('reports.adjustFilters', 'اضغط على تحديث او اضبط المرشحات لعرض البيانات')}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 border-b border-white/5">
                                    <tr className={isRTL ? 'text-right' : 'text-left'}>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('cashClosing.table.shift', 'Shift')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('cashClosing.table.cashier', 'Cashier')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('cashClosing.table.startTime', 'Start time')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {t('cashClosing.table.endTime', 'End time')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('cashClosing.table.expected', 'Expected')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('cashClosing.table.actual', 'Actual')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                                            {t('cashClosing.table.difference', 'Difference')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('cashClosing.table.status', 'Status')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredShifts.map((shift) => {
                                        const expected = shift.expectedCash || 0;
                                        const actual = shift.endedCash || 0;
                                        const diff = actual - expected;
                                        const isBalanced = Math.abs(diff) < 0.01;
                                        const isActive = !shift.endedAt;

                                        return (
                                            <tr key={shift.id} className="hover:bg-white/5 transition">
                                                <td className="p-4 text-white font-medium">#{shift.id}</td>
                                                <td className="p-4 text-slate-300">
                                                    {shift.opener?.firstName} {shift.opener?.lastName}
                                                </td>
                                                <td className="p-4 text-slate-400 font-mono text-xs">
                                                    {formatDateTime(shift.createdAt)}
                                                </td>
                                                <td className="p-4 text-slate-400 font-mono text-xs">
                                                    {shift.endedAt ? formatDateTime(shift.endedAt) : '-'}
                                                </td>
                                                <td className="p-4 text-right text-white font-medium">
                                                    {formatCurrency(expected, currencyConf)}
                                                </td>
                                                <td className="p-4 text-right text-white font-medium">
                                                    {shift.endedAt ? formatCurrency(actual, currencyConf) : '-'}
                                                </td>
                                                <td className={`p-4 text-right font-bold ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {shift.endedAt ? (diff > 0 ? '+' : '') + formatCurrency(diff, currencyConf) : '-'}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {isActive ? (
                                                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                            {t('cashClosing.status.active', 'Active')}
                                                        </span>
                                                    ) : isBalanced ? (
                                                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            {t('cashClosing.status.balanced', 'Balanced')}
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                            {t('cashClosing.status.review', 'Review')}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </ReportLayout.Content>
            </div>
        </ReportLayout>
    );
};

export default ShiftReports;
