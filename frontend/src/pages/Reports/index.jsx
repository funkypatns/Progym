import React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Activity, DollarSign, Users, CreditCard, Clipboard, Calendar, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const ReportCard = ({ title, desc, icon: Icon, color, to, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
    >
        <Link
            to={to}
            className="group relative bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/50 border border-gray-100 dark:border-gray-800 transition-all duration-300 flex flex-col items-start overflow-hidden h-full"
        >
            <div className={`absolute -right-10 -top-10 w-40 h-40 bg-${color}-500/5 rounded-full blur-3xl group-hover:bg-${color}-500/10 transition-colors`}></div>

            <div className={`p-4 rounded-2xl bg-${color}-50 dark:bg-${color}-900/20 text-${color}-600 dark:text-${color}-400 mb-6 group-hover:scale-110 transition-transform`}>
                <Icon size={28} strokeWidth={2} />
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 pr-8">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed flex-1">{desc}</p>

            <div className={`flex items-center gap-2 text-sm font-bold text-${color}-600 dark:text-${color}-400 mt-auto group-hover:translate-x-2 transition-transform`}>
                View Report <ArrowRight size={16} />
            </div>
        </Link>
    </motion.div>
);

const ReportsDashboard = () => {
    const { t } = useTranslation();

    const reports = [
        {
            title: t('reports.revenueReport') || "Revenue Report",
            desc: "Analyze income streams, payment trends, and financial health.",
            icon: DollarSign,
            color: "green",
            to: "/reports/revenue"
        },
        {
            title: t('reports.attendanceReport') || "Member Attendance",
            desc: "Track visits, peak hours, and member engagement metrics.",
            icon: Activity,
            color: "blue",
            to: "/reports/attendance"
        },
        {
            title: t('nav.products') || "Product Sales",
            desc: "Inventory performance, best-selling items, and stock analysis.",
            icon: BarChart,
            color: "purple",
            to: "/reports/product-sales"
        },
        {
            title: t('reports.subscriptionReport') || "Subscriptions",
            desc: "Monitor new signups, renewals, expirations, and retention.",
            icon: CreditCard,
            color: "orange",
            to: "/reports/subscriptions"
        },
        {
            title: t('reports.memberReport') || "Member Demographics",
            desc: "Insights into member age, gender, and location distribution.",
            icon: Users,
            color: "teal",
            to: "/reports/members"
        },
        {
            title: t('cashClosing.title') || "Shift & Cash Closing",
            desc: "Daily register closures, staff shifts, and cash reconciliation.",
            icon: Clipboard,
            color: "gray",
            to: "/reports/cash-closing"
        }
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('reports.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Access detailed analytics and operational intelligence.</p>
                </div>
                <div className="text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl flex items-center gap-2">
                    <TrendingUp size={16} />
                    <span>Real-time Analytics</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report, idx) => (
                    <ReportCard
                        key={idx}
                        {...report}
                        delay={idx * 0.1}
                    />
                ))}
            </div>
        </div>
    );
};

export default ReportsDashboard;
