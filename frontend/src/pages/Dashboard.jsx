import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import { useTranslation } from 'react-i18next';
import { Users, DollarSign, Activity, Calendar, ArrowUpRight, ArrowDownRight, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';
import { usePermissions } from '../hooks/usePermissions';
import { useSettingsStore } from '../store';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';

const Dashboard = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { can, PERMISSIONS } = usePermissions();
    const { getSetting } = useSettingsStore();
    const [stats, setStats] = useState({
        members: { total: 0, active: 0, newThisMonth: 0 },
        revenue: { thisMonth: 0, lastMonth: 0 },
        checkIns: { today: 0 }
    });
    const [charts, setCharts] = useState({ net: [], refunds: [], members: [] });
    const [chartsLoading, setChartsLoading] = useState(false);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };
    const hasFinancials = can(PERMISSIONS.DASHBOARD_VIEW_FINANCIALS);
    const hasMembers = can(PERMISSIONS.MEMBERS_VIEW);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await apiClient.get('/dashboard/stats');
                if (res.data.success) {
                    setStats(res.data.data);
                }
            } catch (error) {
                console.error('Error loading dashboard stats', error);
            }
        };
        fetchStats();
    }, []);

    useEffect(() => {
        const fetchCharts = async () => {
            if (!hasFinancials && !hasMembers) {
                setCharts({ net: [], refunds: [], members: [] });
                return;
            }

            setChartsLoading(true);
            try {
                const netPromise = hasFinancials
                    ? apiClient.get('/dashboard/chart/net?period=month')
                    : Promise.resolve({ data: { data: [] } });
                const refundsPromise = hasFinancials
                    ? apiClient.get('/dashboard/chart/refunds?period=month')
                    : Promise.resolve({ data: { data: [] } });
                const membersPromise = hasMembers
                    ? apiClient.get('/dashboard/chart/members?period=month')
                    : Promise.resolve({ data: { data: [] } });

                const [netRes, refundsRes, membersRes] = await Promise.all([
                    netPromise,
                    refundsPromise,
                    membersPromise
                ]);

                setCharts({
                    net: netRes?.data?.data || [],
                    refunds: refundsRes?.data?.data || [],
                    members: membersRes?.data?.data || []
                });
            } catch (error) {
                console.error('Error loading dashboard charts', error);
                setCharts({ net: [], refunds: [], members: [] });
            } finally {
                setChartsLoading(false);
            }
        };

        fetchCharts();
    }, [hasFinancials, hasMembers]);

    const StatCard = ({ title, value, icon: Icon, color, trend }) => (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-black/50 border border-gray-100 dark:border-gray-800 relative overflow-hidden group"
        >
            <div className={`absolute -right-6 -top-6 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl group-hover:bg-${color}-500/20 transition-all duration-500`}></div>

            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-sm mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{value}</h3>
                    {trend && (
                        <div className={`flex items-center gap-1 text-xs font-bold ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            <span>{Math.abs(trend)}% vs last month</span>
                        </div>
                    )}
                </div>
                <div className={`p-4 rounded-2xl bg-${color}-50 dark:bg-${color}-900/20 text-${color}-600 dark:text-${color}-400`}>
                    <Icon size={24} strokeWidth={2} />
                </div>
            </div>
        </motion.div>
    );

    const chartThemes = {
        emerald: {
            stroke: '#10b981',
            fill: 'rgba(16, 185, 129, 0.18)',
            halo: 'bg-emerald-500/10',
            badge: 'bg-emerald-500/15 text-emerald-500'
        },
        rose: {
            stroke: '#f43f5e',
            fill: 'rgba(244, 63, 94, 0.18)',
            halo: 'bg-rose-500/10',
            badge: 'bg-rose-500/15 text-rose-500'
        },
        blue: {
            stroke: '#3b82f6',
            fill: 'rgba(59, 130, 246, 0.18)',
            halo: 'bg-blue-500/10',
            badge: 'bg-blue-500/15 text-blue-500'
        }
    };

    const ChartCard = ({
        title,
        subtitle,
        value,
        valueLabel,
        icon: Icon,
        data,
        dataKey,
        theme,
        type = 'line',
        formatter,
        onClick
    }) => {
        const palette = chartThemes[theme] || chartThemes.blue;
        const isEmpty = !data || data.length === 0;

        return (
            <motion.div
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl shadow-gray-200/40 dark:shadow-black/40 border border-gray-100 dark:border-gray-800 relative overflow-hidden group cursor-pointer"
                onClick={onClick}
            >
                <div className={`absolute -right-10 -top-10 w-32 h-32 ${palette.halo} rounded-full blur-3xl transition-all duration-500 group-hover:scale-125`}></div>
                <div className="flex items-start justify-between relative z-10">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">{title}</p>
                        <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                            {value}
                        </div>
                        {valueLabel && (
                            <p className="text-xs text-gray-400 mt-1">{valueLabel}</p>
                        )}
                        {subtitle && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{subtitle}</p>
                        )}
                    </div>
                    <div className={`p-3 rounded-2xl ${palette.badge}`}>
                        <Icon size={22} strokeWidth={2.2} />
                    </div>
                </div>

                <div className="mt-6 h-40">
                    {chartsLoading ? (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400">
                            Loading chart...
                        </div>
                    ) : isEmpty ? (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400">
                            No data available
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            {type === 'area' ? (
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id={`${dataKey}-fill`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={palette.stroke} stopOpacity={0.5} />
                                            <stop offset="95%" stopColor={palette.stroke} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <Tooltip
                                        cursor={{ stroke: palette.stroke, strokeWidth: 1, strokeDasharray: '4 4' }}
                                        formatter={(val) => (formatter ? formatter(val) : val)}
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            color: '#e2e8f0',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Area type="monotone" dataKey={dataKey} stroke={palette.stroke} fill={`url(#${dataKey}-fill)`} strokeWidth={2} />
                                </AreaChart>
                            ) : type === 'bar' ? (
                                <BarChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                                        formatter={(val) => (formatter ? formatter(val) : val)}
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            color: '#e2e8f0',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Bar dataKey={dataKey} fill={palette.stroke} radius={[6, 6, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            ) : (
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <Tooltip
                                        cursor={{ stroke: palette.stroke, strokeWidth: 1, strokeDasharray: '4 4' }}
                                        formatter={(val) => (formatter ? formatter(val) : val)}
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            color: '#e2e8f0',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Line type="monotone" dataKey={dataKey} stroke={palette.stroke} strokeWidth={2.5} dot={false} />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.welcome')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Here's what's happening in your gym today.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold dark:bg-green-900/30 dark:text-green-400">
                        System Online
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date().toLocaleDateString()}
                    </span>
                </div>
            </div>

            {/* Stats Grid - 4 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div onClick={() => navigate('/members')} className="cursor-pointer">
                    <StatCard
                        title={t('dashboard.totalMembers')}
                        value={stats.members?.total || 0}
                        icon={Users}
                        color="blue"
                        trend={12}
                    />
                </div>
                <div onClick={() => navigate('/members')} className="cursor-pointer">
                    <StatCard
                        title={t('dashboard.activeMembers')}
                        value={stats.members?.active || 0}
                        icon={Activity}
                        color="green"
                        trend={5}
                    />
                </div>
                <div onClick={() => navigate('/reports')} className="cursor-pointer">
                    <StatCard
                        title={t('dashboard.monthlyRevenue')}
                        value={`$${stats.revenue?.thisMonth?.toLocaleString() || 0}`}
                        icon={DollarSign}
                        color="amber"
                    />
                </div>
                <div onClick={() => navigate('/check-in')} className="cursor-pointer">
                    <StatCard
                        title={t('dashboard.todayCheckIns')}
                        value={stats.checkIns?.today || 0}
                        icon={Calendar}
                        color="purple"
                        trend={-2}
                    />
                </div>
            </div>

            {/* Content Section - 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Charts Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ChartCard
                            title="Net Revenue"
                            subtitle="Gross minus refunds"
                            value={formatCurrency(stats.revenue?.thisMonth || 0, i18n.language, currencyConf)}
                            valueLabel="This month"
                            icon={DollarSign}
                            data={charts.net}
                            dataKey="net"
                            theme="emerald"
                            type="area"
                            formatter={(val) => formatCurrency(val, i18n.language, currencyConf)}
                            onClick={() => navigate('/reports/revenue')}
                        />
                        <ChartCard
                            title="Refunds"
                            subtitle="Refund volume trend"
                            value={formatCurrency(stats.revenue?.monthlyRefunds || 0, i18n.language, currencyConf)}
                            valueLabel="This month"
                            icon={TrendingDown}
                            data={charts.refunds}
                            dataKey="amount"
                            theme="rose"
                            type="bar"
                            formatter={(val) => formatCurrency(val, i18n.language, currencyConf)}
                            onClick={() => navigate('/reports/refunds')}
                        />
                    </div>
                    <ChartCard
                        title="New Members"
                        subtitle="Daily sign-ups"
                        value={formatNumber(stats.members?.newThisMonth || 0, i18n.language)}
                        valueLabel="This month"
                        icon={Users}
                        data={charts.members}
                        dataKey="count"
                        theme="blue"
                        type="line"
                        formatter={(val) => formatNumber(val, i18n.language)}
                        onClick={() => navigate('/members')}
                    />
                </div>

                {/* Right Side - Quick Actions / Recent */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => navigate('/members/new')} className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-bold flex flex-col items-center gap-2">
                                <Users size={20} />
                                Add Member
                            </button>
                            <button onClick={() => navigate('/payments')} className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-sm font-bold flex flex-col items-center gap-2">
                                <DollarSign size={20} />
                                New Payment
                            </button>
                            <button onClick={() => navigate('/check-in')} className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-sm font-bold flex flex-col items-center gap-2">
                                <Calendar size={20} />
                                Attendance
                            </button>
                            <button onClick={() => window.dispatchEvent(new Event('shift:open'))} className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-sm font-bold flex flex-col items-center gap-2">
                                <DollarSign size={20} />
                                Cash Closing
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900 dark:text-white">Recent Activity</h3>
                            <button className="text-xs font-bold text-blue-500 hover:text-blue-600">View All</button>
                        </div>
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-500 text-xs">U{i}</div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">New Check-in</p>
                                        <p className="text-xs text-gray-500 text-emerald-500">Just now</p>
                                    </div>
                                    <ArrowUpRight size={16} className="text-gray-400" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
