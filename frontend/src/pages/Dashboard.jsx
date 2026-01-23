import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import { useTranslation } from 'react-i18next';
import { Users, DollarSign, Activity, Calendar, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        members: { total: 0, active: 0, newThisMonth: 0 },
        revenue: { thisMonth: 0, lastMonth: 0 },
        checkIns: { today: 0 }
    });

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
                {/* Main Chart Section */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 cursor-pointer" onClick={() => navigate('/reports')}>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Revenue Analytics</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Monthly revenue breakdown</p>
                        </div>
                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            <TrendingUp className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                        <p className="text-gray-400 font-medium">Click to view Detailed Revenue Report</p>
                    </div>
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
