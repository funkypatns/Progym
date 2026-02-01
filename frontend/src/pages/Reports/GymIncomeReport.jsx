import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar, Download, Filter, TrendingUp,
    DollarSign, User, Activity, Briefcase, Search, AlertCircle
} from 'lucide-react';
import apiClient from '../../utils/api';
import { useAuthStore } from '../../store';
import StatCard from '../../components/StatCard';

const GymIncomeReport = () => {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.dir() === 'rtl';
    const isDark = useAuthStore((state) => state.theme === 'dark');

    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'coach', 'period'
    const [periodMode, setPeriodMode] = useState('day'); // 'day', 'month'
    const [searchTerm, setSearchTerm] = useState('');

    // States
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [rows, setRows] = useState([]);
    const [coaches, setCoaches] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        coachId: 'all',
        serviceType: 'all'
    });

    // Helper: Currency Formatter
    const formatMoney = (amount) => {
        return new Intl.NumberFormat(i18n.language, {
            style: 'currency',
            currency: 'EGP'
        }).format(amount || 0);
    };

    // Helper: Date Formatter
    const formatDate = (dateString, mode = 'full') => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        // User requested: "28 Jan 2026, 10:15 AM"
        if (mode === 'month') {
            return date.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long' });
        } else if (mode === 'day') {
            return date.toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });
        }
        return date.toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Load Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                from: filters.startDate,
                to: filters.endDate,
                coachId: filters.coachId,
                serviceType: filters.serviceType
            });
            const { data } = await apiClient.get(`/reports/gym-income?${query}`);

            // The backend already returns flattened rows with memberName, coachName, commission, netIncome
            const rawRows = data.data.rows || [];

            // Just ensure dates are valid objects for sorting/filtering if needed, 
            // though strings work for many things.
            // But 'periodStats' uses 'new Date(r.date)', so string is fine.

            setRows(rawRows);

            // Fetch Coaches if needed
            if (coaches.length === 0) {
                const coachesRes = await apiClient.get('/users?role=coach');
                const coachesData = coachesRes.data.success
                    ? (coachesRes.data.data || [])
                    : (Array.isArray(coachesRes.data) ? coachesRes.data : []);
                setCoaches(Array.isArray(coachesData) ? coachesData : []);
            }
        } catch (error) {
            console.warn('Failed to load report:', error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filters.startDate, filters.endDate, filters.coachId, filters.serviceType]);

    // --- CLIENT SIDE FILTERING & AGGREGATION ---

    // 1. Filter Rows by Search Term
    const filteredRows = React.useMemo(() => {
        if (!searchTerm) return rows;
        const lowerTerm = searchTerm.toLowerCase();
        return rows.filter(row =>
            (row.memberName && row.memberName.toLowerCase().includes(lowerTerm)) ||
            (row.coachName && row.coachName.toLowerCase().includes(lowerTerm)) ||
            (row.service && row.service.toLowerCase().includes(lowerTerm))
        );
    }, [rows, searchTerm]);

    // Helper: Parse Amount Safely (Handles strings with currency, potential nulls)
    const parseAmount = (val) => {
        if (typeof val === 'number') return val;
        // If it's a string, strip potential currency text like "EGP"
        if (typeof val === 'string') {
            const clean = val.replace(/[^0-9.-]/g, '');
            return parseFloat(clean) || 0;
        }
        return 0;
    };

    // 2. Calculate Stats from Filtered Rows (Source of Truth)
    const derivedStats = React.useMemo(() => {
        // Debugging logs to verify data integrity
        if (filteredRows.length > 0) {
            console.log('GymIncomeReport: Recalculating Stats. Rows:', filteredRows.length);
            console.log('GymIncomeReport: Sample Row:', filteredRows[0]);
        }

        return filteredRows.reduce((acc, row) => {
            // Using robust parsing to ensure summary matches table
            const gross = parseAmount(row.sessionPrice);
            const comm = parseAmount(row.commission);
            const net = Math.max(0, parseAmount(row.netIncome));

            return {
                totalGrossRevenue: acc.totalGrossRevenue + gross,
                totalCommissions: acc.totalCommissions + comm,
                totalNetIncome: acc.totalNetIncome + net,
                totalSessions: acc.totalSessions + 1
            };
        }, { totalGrossRevenue: 0, totalCommissions: 0, totalNetIncome: 0, totalSessions: 0 });
    }, [filteredRows]);

    // 3. Grouping for Tabs
    const coachStats = React.useMemo(() => {
        const map = {};
        filteredRows.forEach(r => {
            const key = r.coachId || r.coachName || 'Unknown';
            if (!map[key]) {
                map[key] = { name: r.coachName || 'Unknown', sessions: 0, gross: 0, commission: 0, net: 0 };
            }
            const gross = parseAmount(r.sessionPrice);
            const comm = parseAmount(r.commission);
            const net = Math.max(0, parseAmount(r.netIncome));

            map[key].sessions += 1;
            map[key].gross += gross;
            map[key].commission += comm;
            map[key].net += net;
        });
        return Object.values(map).sort((a, b) => b.net - a.net);
    }, [filteredRows]);

    const periodStats = React.useMemo(() => {
        const map = {};
        filteredRows.forEach(r => {
            if (!r.date) return;
            const d = new Date(r.date);
            if (isNaN(d.getTime())) return;

            let key = periodMode === 'day'
                ? d.toISOString().split('T')[0]
                : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            if (!map[key]) {
                map[key] = { date: key, sessions: 0, gross: 0, commission: 0, net: 0 };
            }
            const gross = parseAmount(r.sessionPrice);
            const comm = parseAmount(r.commission);
            const net = Math.max(0, parseAmount(r.netIncome));

            map[key].sessions += 1;
            map[key].gross += gross;
            map[key].commission += comm;
            map[key].net += net;
        });
        return Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [filteredRows, periodMode]);

    const handleExport = async () => {
        try {
            const query = new URLSearchParams({
                from: filters.startDate,
                to: filters.endDate,
                coachId: filters.coachId,
                serviceType: filters.serviceType,
                format: 'excel'
            });
            const response = await apiClient.get(`/reports/gym-income?${query}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `gym-income-${filters.startDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.warn('Export failed:', error);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1) TITLE SECTION */}
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center ${isRTL ? 'text-right' : 'text-left'}`}>
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-teal-500">
                        {t('reports.gymIncome.title', 'Gym Income Report')}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {t('reports.gymIncome.subtitle', 'Net income from sessions after commissions')}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-lg mt-4 md:mt-0">
                    {[
                        { id: 'overview', label: t('reports.gymIncome.tabs.overview', 'Overview'), icon: Briefcase },
                        { id: 'coach', label: t('reports.gymIncome.tabs.byCoach', 'By Coach'), icon: User },
                        { id: 'period', label: t('reports.gymIncome.tabs.byPeriod', 'By Period'), icon: Calendar }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 shadow text-green-600 dark:text-green-400'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                                }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2) CLEAN FILTER BAR */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">

                    {/* Left: Search & Dates */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('common.search', 'Search by name...')}
                                className={`w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-gray-700 rounded-lg text-sm py-2 px-9 focus:ring-green-500 transition-shadow ${isRTL ? 'text-right' : 'text-left'}`}
                            />
                            <Search size={16} className={`absolute top-2.5 text-gray-400 pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`} />
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            <Calendar size={16} className="text-gray-400 mx-2" />
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="bg-transparent border-none text-sm focus:ring-0 p-1 w-28 lg:w-32"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="bg-transparent border-none text-sm focus:ring-0 p-1 w-28 lg:w-32"
                            />
                        </div>
                    </div>

                    {/* Right: Filters & Actions */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                        <select
                            value={filters.coachId}
                            onChange={(e) => setFilters({ ...filters, coachId: e.target.value })}
                            className="bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-gray-700 rounded-lg text-sm py-2 px-3 focus:ring-green-500"
                        >
                            <option value="all">{t('common.allCoaches', 'All Coaches')}</option>
                            {coaches.map(c => (
                                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                            ))}
                        </select>

                        <select
                            value={filters.serviceType}
                            onChange={(e) => setFilters({ ...filters, serviceType: e.target.value })}
                            className="bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-gray-700 rounded-lg text-sm py-2 px-3 focus:ring-green-500"
                        >
                            <option value="all">{t('common.allServices', 'All Services')}</option>
                            <option value="PT">PT Session</option>
                            <option value="Class">Class</option>
                            <option value="Consultation">Consultation</option>
                        </select>

                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block mx-1"></div>

                        {/* Refresh */}
                        <button
                            onClick={fetchData}
                            className="p-2 text-gray-500 hover:text-green-600 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                            title={t('common.refresh', 'Refresh')}
                        >
                            <Filter size={18} />
                        </button>

                        {/* Export */}
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
                        >
                            <Download size={16} />
                            <span className="hidden sm:inline">{t('common.export', 'Export')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 3) Summary Cards - Derived Dynamically */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title={t('reports.gymIncome.grossRevenue', 'Total Gross Revenue')}
                    value={formatMoney(derivedStats.totalGrossRevenue)}
                    icon={DollarSign}
                    color="blue"
                    loading={loading}
                />
                <StatCard
                    title={t('reports.gymIncome.totalCommissions', 'Coach Commissions')}
                    value={formatMoney(derivedStats.totalCommissions)}
                    icon={User}
                    color="orange"
                    loading={loading}
                />
                <StatCard
                    title={t('reports.gymIncome.netIncome', 'Net Gym Income')}
                    value={formatMoney(derivedStats.totalNetIncome)}
                    icon={TrendingUp}
                    color="green" // Requested Green
                    loading={loading}
                    trend="Profit"
                    className="ring-2 ring-green-500/20"
                />
                <StatCard
                    title={t('reports.gymIncome.totalSessions', 'Total Completed Sessions')}
                    value={derivedStats.totalSessions}
                    icon={Activity}
                    color="purple"
                    loading={loading}
                />
            </div>

            {/* 4) Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Period Switcher (Only visible in Period tab) */}
                {activeTab === 'period' && (
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                        <button onClick={() => setPeriodMode('day')} className={`px-3 py-1 text-xs font-bold rounded-lg border ${periodMode === 'day' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent'}`}>{t('reports.gymIncome.period.day', 'Daily')}</button>
                        <button onClick={() => setPeriodMode('month')} className={`px-3 py-1 text-xs font-bold rounded-lg border ${periodMode === 'month' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent'}`}>{t('reports.gymIncome.period.month', 'Monthly')}</button>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className={`bg-gray-50 dark:bg-slate-900/50 text-gray-500 uppercase font-bold text-xs border-b border-gray-100 dark:border-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <tr>
                                {activeTab === 'overview' && (
                                    <>
                                        <th className="px-6 py-4">{t('common.date', 'Date')}</th>
                                        <th className="px-6 py-4">{t('reports.gymIncome.member', 'Member Name')}</th>
                                        <th className="px-6 py-4">{t('reports.gymIncome.coach', 'Coach Name')}</th>
                                        <th className="px-6 py-4">{t('reports.gymIncome.service', 'Service')}</th>
                                        <th className="px-6 py-4 text-right">{t('reports.gymIncome.sessionPrice', 'Session Price')}</th>
                                        <th className="px-6 py-4 text-right text-orange-600">{t('reports.gymIncome.commission', 'Coach Commission')}</th>
                                        <th className="px-6 py-4 text-right text-green-600">{t('reports.gymIncome.net', 'Gym Net Income')}</th>
                                        <th className="px-6 py-4 text-center">{t('common.status', 'Status')}</th>
                                    </>
                                )}
                                {activeTab === 'coach' && (
                                    <>
                                        <th className="px-6 py-4">{t('reports.gymIncome.coach', 'Coach')}</th>
                                        <th className="px-6 py-4 text-center">{t('reports.gymIncome.totalSessions', 'Sessions')}</th>
                                        <th className="px-6 py-4 text-right">{t('reports.gymIncome.grossRevenue', 'Revenue')}</th>
                                        <th className="px-6 py-4 text-right text-orange-600">{t('reports.gymIncome.commission', 'Commission')}</th>
                                        <th className="px-6 py-4 text-right text-green-600">{t('reports.gymIncome.net', 'Net Profit')}</th>
                                    </>
                                )}
                                {activeTab === 'period' && (
                                    <>
                                        <th className="px-6 py-4">{t('reports.gymIncome.period.date', 'Period')}</th>
                                        <th className="px-6 py-4 text-center">{t('reports.gymIncome.totalSessions', 'Sessions')}</th>
                                        <th className="px-6 py-4 text-right">{t('reports.gymIncome.period.totalRevenue', 'Revenue')}</th>
                                        <th className="px-6 py-4 text-right text-orange-600">{t('reports.gymIncome.commission', 'Commission')}</th>
                                        <th className="px-6 py-4 text-right text-green-600">{t('reports.gymIncome.period.totalProfit', 'Profit')}</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-400">{t('common.loading', 'Loading data...')}</td></tr>
                            ) : filteredRows.length === 0 ? (
                                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-400">{t('common.noResults', 'No completed sessions match your search')}</td></tr>
                            ) : (
                                <>
                                    {activeTab === 'overview' && filteredRows.map((row) => {
                                        const netIncome = parseAmount(row.netIncome);
                                        const isNegative = netIncome < 0;
                                        const displayNet = Math.max(0, netIncome);

                                        return (
                                            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">{formatDate(row.date)}</td>
                                                <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{row.memberName}</td>
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{row.coachName}</td>
                                                <td className="px-6 py-4"><span className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-xs text-gray-600 dark:text-gray-300">{row.service}</span></td>
                                                <td className="px-6 py-4 text-right font-medium">{formatMoney(parseAmount(row.sessionPrice))}</td>
                                                <td className="px-6 py-4 text-right font-medium text-orange-600">- {formatMoney(parseAmount(row.commission))}</td>
                                                <td className="px-6 py-4 text-right font-bold text-green-600 flex items-center justify-end gap-2">
                                                    {formatMoney(displayNet)}
                                                    {isNegative && (
                                                        <div className="group relative">
                                                            <AlertCircle size={16} className="text-red-500 cursor-help" />
                                                            <span className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-normal text-center">
                                                                {t('reports.gymIncome.warnings.commissionExceeds', 'Commission exceeds session price')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${row.status === 'paid' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {row.status === 'paid' ? t('common.paid', 'PAID') : t('common.pending', 'PENDING')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Coach & Period Tabs use Aggregated Data */}
                                    {activeTab === 'coach' && coachStats.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{stat.name}</td>
                                            <td className="px-6 py-4 text-center">{stat.sessions}</td>
                                            <td className="px-6 py-4 text-right font-medium">{formatMoney(stat.gross)}</td>
                                            <td className="px-6 py-4 text-right text-orange-600 font-medium">- {formatMoney(stat.commission)}</td>
                                            <td className="px-6 py-4 text-right text-green-600 font-black">{formatMoney(stat.net)}</td>
                                        </tr>
                                    ))}

                                    {activeTab === 'period' && periodStats.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                {periodMode === 'day' ? formatDate(stat.date, 'day') : formatDate(stat.date + '-01', 'month')}
                                            </td>
                                            <td className="px-6 py-4 text-center">{stat.sessions}</td>
                                            <td className="px-6 py-4 text-right font-medium">{formatMoney(stat.gross)}</td>
                                            <td className="px-6 py-4 text-right text-orange-600 font-medium">- {formatMoney(stat.commission)}</td>
                                            <td className="px-6 py-4 text-right text-green-600 font-black">{formatMoney(stat.net)}</td>
                                        </tr>
                                    ))}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GymIncomeReport;
