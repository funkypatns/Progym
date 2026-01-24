import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Calendar, RefreshCw, Search, Clock, AlertCircle, CheckCircle, Activity, BarChart3 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import ReportSummaryCards from './ReportSummaryCards';

const ShiftReports = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [nameFilter, setNameFilter] = useState('');
    const isRTL = i18n.language === 'ar';
    const alignStart = isRTL ? 'text-right' : 'text-left';
    const alignEnd = isRTL ? 'text-left' : 'text-right';
    const searchInputPadding = isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3';
    const searchIconPosition = isRTL ? 'right-3' : 'left-3';

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
        <div className="w-full px-6 py-6">
            <div className="w-full space-y-5 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <div className={alignStart}>
                            <p className="text-lg font-semibold text-white">
                                {t('reports.shiftReport.title', 'Shift report')}
                            </p>
                            <p className="text-xs text-slate-400">
                                {t('reports.shiftReport.subtitle', 'Cashier shift activity and balances')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-end">
                        <div className="space-y-2">
                            <label className={`text-xs font-semibold text-slate-400 flex items-center gap-1.5 ${alignStart}`}>
                                <Calendar size={14} />
                                {t('reports.from', 'From')}
                            </label>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                className="w-full h-11 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className={`text-xs font-semibold text-slate-400 flex items-center gap-1.5 ${alignStart}`}>
                                <Calendar size={14} />
                                {t('reports.to', 'To')}
                            </label>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                className="w-full h-11 px-3 bg-slate-950/40 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                            />
                        </div>

                        <div className="space-y-2 xl:col-span-2">
                            <label className={`text-xs font-semibold text-slate-400 ${alignStart}`}>
                                {t('reports.filterByName', 'Filter by name')}
                            </label>
                            <div className="relative">
                                <Search size={16} className={`absolute top-1/2 -translate-y-1/2 ${searchIconPosition} text-slate-500`} />
                                <input
                                    type="text"
                                    placeholder={t('reports.searchStaff', 'Search by staff...')}
                                    value={nameFilter}
                                    onChange={(e) => setNameFilter(e.target.value)}
                                    className={`w-full h-11 ${searchInputPadding} bg-slate-950/40 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white placeholder:text-gray-500`}
                                />
                            </div>
                        </div>

                        <div className="flex items-center">
                            <button
                                onClick={fetchShifts}
                                disabled={isLoading}
                                className="h-11 w-full xl:w-auto px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                {t('common.refresh', 'Refresh')}
                            </button>
                        </div>
                    </div>
                </div>

                <ReportSummaryCards
                    gridClassName="md:grid-cols-2 xl:grid-cols-4"
                    items={[
                        {
                            label: t('reports.shifts.total', 'Total shifts'),
                            value: summary.total,
                            icon: Activity,
                            iconClassName: 'bg-indigo-500/15 border border-indigo-500/30',
                            iconColorClassName: 'text-indigo-300'
                        },
                        {
                            label: t('reports.shifts.active', 'Active shifts'),
                            value: summary.active,
                            icon: Clock,
                            iconClassName: 'bg-blue-500/15 border border-blue-500/30',
                            iconColorClassName: 'text-blue-300'
                        },
                        {
                            label: t('cashClosing.status.balanced', 'Balanced'),
                            value: summary.balanced,
                            icon: CheckCircle,
                            iconClassName: 'bg-emerald-500/15 border border-emerald-500/30',
                            iconColorClassName: 'text-emerald-300'
                        },
                        {
                            label: t('reports.shifts.needsReview', 'Needs review'),
                            value: summary.review,
                            icon: AlertCircle,
                            iconClassName: 'bg-amber-500/15 border border-amber-500/30',
                            iconColorClassName: 'text-amber-300'
                        }
                    ]}
                />

                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 overflow-hidden">
                    {isLoading ? (
                        <div className="py-16 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
                            <p className="text-sm text-slate-400">{t('common.loading', 'Loading...')}</p>
                        </div>
                    ) : filteredShifts.length === 0 ? (
                        <div className="py-16 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                            <p className="text-sm text-slate-400">{t('common.noResults', 'No data available')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/70 border-b border-slate-800/70 sticky top-0">
                                    <tr>
                                        <th className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${alignStart}`}>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} />
                                                {t('reports.fields.paidAt', 'Date')}
                                            </div>
                                        </th>
                                        <th className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${alignStart}`}>
                                            {t('auth.role_staff', 'Staff')}
                                        </th>
                                        <th className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${alignEnd}`}>
                                            {t('cashClosing.expectedCash', 'Expected')}
                                        </th>
                                        <th className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${alignEnd}`}>
                                            {t('cashClosing.declaredCash', 'Actual')}
                                        </th>
                                        <th className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${alignEnd}`}>
                                            {t('cashClosing.differenceCash', 'Diff')}
                                        </th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
                                            {t('reports.fields.status', 'Status')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/70">
                                    {filteredShifts.map((shift) => {
                                        const diff = (shift.endedCash || 0) - (shift.expectedCash || 0);
                                        const isBalanced = Math.abs(diff) < 0.01;

                                        return (
                                            <tr key={shift.id} className="hover:bg-slate-800/40 transition-colors">
                                                <td className={`px-4 py-3 ${alignStart}`}>
                                                    <div className="font-medium text-white">
                                                        {formatDateTime(shift.startedAt, i18n.language).split(',')[0]}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {shift.endedAt
                                                            ? formatDateTime(shift.endedAt, i18n.language).split(',')[1]
                                                            : t('reports.status.active', 'Active')}
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-3 ${alignStart}`}>
                                                    <div className="font-medium text-white">
                                                        {shift.opener?.firstName} {shift.opener?.lastName}
                                                    </div>
                                                    <div className="text-xs text-slate-500 capitalize">
                                                        {shift.opener?.role || t('auth.role_staff', 'Staff')}
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-3 ${alignEnd} font-mono text-slate-300`}>
                                                    {formatCurrency(shift.expectedCash || 0, i18n.language, currencyConf)}
                                                </td>
                                                <td className={`px-4 py-3 ${alignEnd} font-mono font-bold text-white`}>
                                                    {shift.endedCash ? formatCurrency(shift.endedCash, i18n.language, currencyConf) : '-'}
                                                </td>
                                                <td className={`px-4 py-3 ${alignEnd} font-mono font-bold ${diff < 0 ? 'text-red-400' : diff > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {Math.abs(diff) > 0 ? (diff > 0 ? '+' : '') + formatCurrency(diff, i18n.language, currencyConf) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {!shift.endedAt ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/20 text-indigo-300">
                                                            {t('reports.status.active', 'Active')}
                                                        </span>
                                                    ) : isBalanced ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                                                            {t('cashClosing.status.balanced', 'Balanced')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-300">
                                                            {t('reports.status.review', 'Review')}
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
                </div>
            </div>
        </div>
    );
};

export default ShiftReports;
