import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Calendar, DollarSign, Filter, CheckCircle, AlertCircle, User, RefreshCw, TrendingUp } from 'lucide-react';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';
import ReportLayout from '../../components/Reports/ReportLayout';

const CoachReportsPage = () => {
    const [loading, setLoading] = useState(false);
    const [coaches, setCoaches] = useState([]);
    const [selectedCoachId, setSelectedCoachId] = useState('');
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState('all');
    const [reportData, setReportData] = useState(null);
    const [settling, setSettling] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    useEffect(() => {
        fetchCoaches();
        fetchReport();
    }, []);

    useEffect(() => {
        if (hasLoadedOnce) {
            fetchReport();
        }
    }, [selectedCoachId, startDate, endDate, statusFilter]);

    const { t } = useTranslation();

    const fetchCoaches = async () => {
        try {
            const res = await apiClient.get('/coaches');
            if (res.data.success) {
                setCoaches(res.data.data);
            }
        } catch (error) {
            console.warn('Failed to fetch coaches', error);
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            let from = startDate;
            let to = endDate;
            if (new Date(from) > new Date(to)) {
                [from, to] = [to, from];
                setStartDate(to);
                setEndDate(from);
                toast.error(t('errors.dateRangeReversed', 'Date range was reversed - automatically corrected'));
            }

            const query = new URLSearchParams({
                startDate: from,
                endDate: to,
                status: statusFilter === 'all' ? '' : statusFilter
            });

            let endpoint = '/coaches/earnings';
            if (selectedCoachId) {
                endpoint = `/coaches/${selectedCoachId}/earnings`;
            }

            const res = await apiClient.get(`${endpoint}?${query.toString()}`);
            if (res.data.success) {
                setReportData(res.data.data);
                setHasLoadedOnce(true);
            }
        } catch (error) {
            toast.error(t('reports.errors.serverError', 'Failed to load report'));
            setReportData({ summary: { sessionsCount: 0, totalEarnings: 0, pendingEarnings: 0, paidEarnings: 0 }, rows: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleSettle = async () => {
        if (!selectedCoachId) {
            toast.error(t('reports.errors.selectCoach', 'Please select a specific coach to settle'));
            return;
        }

        if (!reportData?.summary?.pendingEarnings) return;

        if (!confirm(t('reports.settleConfirm', `Confirm settlement of ${reportData.summary.pendingEarnings.toLocaleString()} EGP? This will create an expense record.`))) return;

        setSettling(true);
        try {
            await apiClient.post('/coaches/settle', {
                coachId: selectedCoachId,
                startDate,
                endDate
            });
            toast.success(t('reports.settleSuccess', 'Settlement processed successfully'));
            fetchReport();
        } catch (error) {
            toast.error(error.response?.data?.message || t('reports.errors.settleFailed', 'Settlement failed'));
        } finally {
            setSettling(false);
        }
    };

    return (
        <ReportLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <ReportLayout.Header
                    icon={TrendingUp}
                    title={t('reports.coachEarnings.title', 'Coach Earnings Report')}
                    subtitle={t('reports.coachEarnings.subtitle', 'View commissions and process settlements')}
                />

                <ReportLayout.FilterBar>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <User size={14} />
                            {t('reports.gymIncome.coach', 'Coach')}
                        </label>
                        <select
                            value={selectedCoachId}
                            onChange={(e) => setSelectedCoachId(e.target.value)}
                            className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                        >
                            <option value="">{t('common.all', 'All Coaches')}</option>
                            {coaches.map(c => (
                                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                            ))}
                        </select>
                    </div>

                    <ReportLayout.DateInput
                        label={t('reports.from', 'From')}
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        icon={Calendar}
                    />

                    <ReportLayout.DateInput
                        label={t('reports.to', 'To')}
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        icon={Calendar}
                    />

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Filter size={14} />
                            {t('common.status', 'Status')}
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                        >
                            <option value="all">{t('common.all', 'All')}</option>
                            <option value="pending">{t('common.pending', 'Pending')}</option>
                            <option value="paid">{t('common.paid', 'Paid')}</option>
                        </select>
                    </div>

                    <ReportLayout.RefreshButton
                        onClick={fetchReport}
                        loading={loading}
                        icon={RefreshCw}
                    >
                        {t('common.refresh', 'Refresh')}
                    </ReportLayout.RefreshButton>
                </ReportLayout.FilterBar>

                <ReportLayout.MetricsGrid>
                    <ReportLayout.MetricCard
                        icon={TrendingUp}
                        label="Total Sessions"
                        value={reportData?.summary?.sessionsCount || 0}
                        color="blue"
                        loading={loading}
                    />
                    <ReportLayout.MetricCard
                        icon={DollarSign}
                        label="Total Earnings"
                        value={`${(reportData?.summary?.totalEarnings || 0).toLocaleString()} EGP`}
                        color="emerald"
                        loading={loading}
                    />
                    <div className="bg-amber-500/10 border-amber-500/20 border rounded-2xl p-6 relative flex flex-col justify-between h-full backdrop-blur-sm transition-all hover:scale-[1.02]">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 text-left">
                                <div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-3 text-amber-400">
                                    Pending Payout
                                </div>
                                {loading ? (
                                    <div className="h-9 w-24 bg-white/10 rounded animate-pulse"></div>
                                ) : (
                                    <div className="text-3xl font-black text-white leading-none">
                                        {(reportData?.summary?.pendingEarnings || 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">EGP</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-amber-400">
                                <AlertCircle size={20} strokeWidth={2} />
                            </div>
                        </div>

                        {reportData?.summary?.pendingEarnings > 0 && selectedCoachId && (
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={handleSettle}
                                    disabled={settling}
                                    className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2 group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {settling ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4" />
                                    )}
                                    <span>{settling ? 'Processing...' : 'Settle Now'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <ReportLayout.MetricCard
                        icon={CheckCircle}
                        label="Paid Earnings"
                        value={`${(reportData?.summary?.paidEarnings || 0).toLocaleString()} EGP`}
                        color="slate"
                        loading={loading}
                    />
                </ReportLayout.MetricsGrid>

                <ReportLayout.Content>
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="w-8 h-8 text-teal-500 animate-spin" />
                        </div>
                    ) : !hasLoadedOnce ? (
                        <ReportLayout.EmptyState
                            icon={TrendingUp}
                            title="Click Refresh to load data"
                            subtitle="Select filters and click refresh to view earnings report"
                        />
                    ) : reportData?.rows?.length === 0 ? (
                        <ReportLayout.EmptyState
                            icon={AlertCircle}
                            title="No coach earnings found"
                            subtitle="No earnings found for this period. Adjust filters and try again."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 font-bold border-b border-white/5">
                                    <tr>
                                        <th className="p-4">Date</th>
                                        {!selectedCoachId && <th className="p-4">Coach</th>}
                                        <th className="p-4">Source</th>
                                        <th className="p-4">Customer</th>
                                        <th className="p-4">Time</th>
                                        <th className="p-4 text-right">Session Price</th>
                                        <th className="p-4 text-right">Commission</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4">Rule</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {reportData?.rows?.map((row) => (
                                        <tr key={row.id} className="hover:bg-white/5 transition">
                                            <td className="p-4 text-slate-300">
                                                {format(parseISO(row.date), 'yyyy-MM-dd')}
                                                <div className="text-xs text-slate-500">{format(parseISO(row.date), 'HH:mm')}</div>
                                            </td>
                                            {!selectedCoachId && (
                                                <td className="p-4 text-white font-medium">{row.coachName}</td>
                                            )}
                                            <td className="p-4">
                                                <span className="text-white font-medium">{row.sourceRef}</span>
                                                <div className="text-xs text-blue-400">{row.sourceType} #{row.appointmentId || '-'}</div>
                                            </td>
                                            <td className="p-4 text-slate-300">{row.customerName}</td>
                                            <td className="p-4 text-slate-400 text-xs font-mono">
                                                {row.startTime && row.endTime ? (
                                                    <>{format(parseISO(row.startTime), 'HH:mm')} - {format(parseISO(row.endTime), 'HH:mm')}</>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4 text-right text-slate-400 font-mono">
                                                {row.basisAmount?.toLocaleString() || '-'}
                                            </td>
                                            <td className="p-4 text-right font-bold text-emerald-400">
                                                +{row.earningAmount?.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${row.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-500 text-xs">{row.ruleText || '-'}</td>
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

export default CoachReportsPage;
