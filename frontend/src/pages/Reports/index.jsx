import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    BarChart,
    Activity,
    DollarSign,
    Users,
    CreditCard,
    Clipboard,
    Calendar,
    ArrowRight,
    TrendingUp,
    Package,
    FileText,
    PieChart,
    Target,
    Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const ReportCard = ({ title, desc, icon: Icon, gradient, to, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
    >
        <Link
            to={to}
            className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg hover:shadow-2xl border border-gray-200/50 dark:border-white/10 transition-all duration-300 flex flex-col overflow-hidden h-full hover:-translate-y-2"
        >
            {/* Gradient Background Blob */}
            <div className={`absolute -right-20 -top-20 w-64 h-64 ${gradient} opacity-10 dark:opacity-5 rounded-full blur-3xl group-hover:opacity-20 dark:group-hover:opacity-10 transition-opacity duration-500`}></div>

            {/* Icon */}
            <div className={`relative p-4 rounded-2xl ${gradient} mb-6 inline-flex w-fit shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={32} className="text-white" strokeWidth={2.5} />
            </div>

            {/* Content */}
            <div className="relative z-10 flex-1 flex flex-col">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 leading-tight">
                    {title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1 mb-6">
                    {desc}
                </p>

                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:gap-4 transition-all">
                    {t('reports.viewReport', 'View Report')}
                    <ArrowRight size={16} className="text-indigo-600 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>

            {/* Hover Border Effect */}
            <div className={`absolute inset-0 rounded-3xl ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10`}></div>
        </Link>
    </motion.div>
);

const ReportsDashboard = () => {
    const { t } = useTranslation();

    const reports = [
        {
            title: t('reports.revenueReport', 'Revenue Report'),
            desc: t('reports.descriptions.revenue', 'Analyze income streams, payment trends, and financial health'),
            icon: DollarSign,
            gradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
            to: "/reports/revenue"
        },
        {
            title: t('reports.attendanceReport', 'Attendance Report'),
            desc: t('reports.descriptions.attendance', 'Track visits, peak hours, and member engagement metrics'),
            icon: Activity,
            gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
            to: "/reports/attendance"
        },
        {
            title: t('nav.products', 'Product Sales'),
            desc: t('reports.descriptions.productSales', 'Inventory performance, best selling items, and stock analysis'),
            icon: Package,
            gradient: "bg-gradient-to-br from-purple-500 to-pink-600",
            to: "/reports/product-sales"
        },
        {
            title: t('reports.subscriptionReport', 'Subscriptions'),
            desc: t('reports.descriptions.subscriptions', 'Monitor new signups, renewals, expirations, and retention'),
            icon: CreditCard,
            gradient: "bg-gradient-to-br from-orange-500 to-red-600",
            to: "/reports/subscriptions"
        },
        {
            title: t('reports.trainersReport', 'Trainer Report'),
            desc: t('reports.descriptions.trainers', 'Trainer commissions, payouts, and session earnings'),
            icon: Users,
            gradient: "bg-gradient-to-br from-indigo-500 to-blue-600",
            to: "/reports/trainers"
        },
        {
            title: t('reports.pendingCompletion', 'Pending Completion'),
            desc: t('reports.descriptions.pendingCompletion', 'Sessions ended but not completed yet'),
            icon: Clock,
            gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
            to: "/reports/pending-completion"
        },
        {
            title: t('reports.gymIncomeSessions', 'Gym Income - Sessions'),
            desc: t('reports.descriptions.gymIncomeSessions', 'Paid session revenue with filters and totals'),
            icon: DollarSign,
            gradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
            to: "/reports/gym-income-sessions"
        },
        {
            title: t('reports.memberReport', 'Members Analytics'),
            desc: t('reports.descriptions.members', 'Insights into member demographics and distribution'),
            icon: Users,
            gradient: "bg-gradient-to-br from-cyan-500 to-blue-600",
            to: "/reports/members"
        },
        {
            title: t('cashClosing.title', 'Cash Closing'),
            desc: t('reports.descriptions.cashClosing', 'Daily register closures, staff shifts, and cash reconciliation'),
            icon: Clipboard,
            gradient: "bg-gradient-to-br from-slate-500 to-gray-700",
            to: "/reports/cash-closing"
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 p-4 lg:p-8">
            <div className="w-full space-y-8">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl p-8"
                >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl shadow-indigo-500/30">
                                <BarChart className="text-white" size={40} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-indigo-600 dark:from-white dark:to-indigo-400 leading-tight">
                                    {t('reports.title', 'Reports & Analytics')}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 font-medium mt-2 text-lg">
                                    {t('reports.subtitle', 'Access detailed analytics and operational intelligence')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center gap-3">
                                <TrendingUp size={20} strokeWidth={2.5} />
                                <div>
                                    <p className="text-xs font-semibold opacity-90">Real-time</p>
                                    <p className="text-sm font-black">Analytics</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                <FileText className="text-blue-600 dark:text-blue-400" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('reports.title', 'Reports')}
                                </p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{reports.length}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 }}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                                <PieChart className="text-purple-600 dark:text-purple-400" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('reports.categories', 'Categories')}
                                </p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">6</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                <Target className="text-emerald-600 dark:text-emerald-400" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Insights</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">Live</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25 }}
                        className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 shadow-xl shadow-indigo-500/30"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                                <Activity className="text-white" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white/80 uppercase tracking-wider">Status</p>
                                <p className="text-2xl font-black text-white">Active</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Reports Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {reports.map((report, idx) => (
                        <ReportCard
                            key={idx}
                            {...report}
                            delay={0.3 + (idx * 0.08)}
                        />
                    ))}
                </div>

                {/* Footer Info */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-lg p-6 text-center"
                >
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        📊 All reports update in real-time with the latest data from your gym operations
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default ReportsDashboard;
