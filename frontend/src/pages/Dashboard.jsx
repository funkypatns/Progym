import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import { useTranslation } from 'react-i18next';
import {
    Users, DollarSign, Activity, Calendar,
    TrendingUp, TrendingDown, Briefcase,
    Shield, CreditCard, Inbox, AlertCircle,
    Percent, RotateCcw, FileWarning, Clock,
    UserPlus, CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePermissions } from '../hooks/usePermissions';
import { useSettingsStore } from '../store';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';

// Reusing the existing StatCard or enhanced version
import StatCard from '../components/StatCard'; // Make sure this path is correct. Original was defined inline? No, imported? 
// Original file had internal StatCard? Let's check imports in original `Dashboard.jsx` view. 
// It had inline `StatCard` definition (lines 99-122). 
// I SHOULD extracting it to a component is better, but to keep it simple and consistent with previous, I'll use the imported `StatCard` if available or redefine it. 
// Step 12229 showed `src/components/StatCard.jsx` EXISTS. So I should import it.

const Dashboard = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { can, PERMISSIONS } = usePermissions();
    const { getSetting } = useSettingsStore();

    // Initial State matching backend structure
    const [stats, setStats] = useState({
        members: { total: 0, active: 0, newThisMonth: 0, inactive: 0 },
        subscriptions: { active: 0, expiring: 0, expired: 0, outstanding: 0 },
        checkIns: { today: 0 },
        financials: { netIncome: 0, grossRevenue: 0, coachCommissions: 0, expenseRatio: 0, discounts: 0, refunds: 0 },
        operations: { activeShifts: 0, sessionCompletion: 0, manualTransactions: 0, cashStatus: 'Open' },
        revenue: { today: 0, thisMonth: 0, todayGross: 0 }
    });

    const [loading, setLoading] = useState(true);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    const hasFinancials = can(PERMISSIONS.DASHBOARD_VIEW_FINANCIALS);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await apiClient.get('/dashboard/stats');
                if (res.data.success) {
                    setStats(res.data.data);
                }
            } catch (error) {
                console.error('Error loading dashboard stats', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    // Helper to format currency
    const money = (val) => formatCurrency(val || 0, i18n.language, currencyConf);
    const num = (val) => formatNumber(val || 0, i18n.language);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const sectionTitle = (title) => (
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 px-1">{title}</h3>
    );

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.welcome')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {new Date().toLocaleDateString(i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        {t('dashboard.systemOnline', 'System Online')}
                    </span>
                </div>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-8"
            >
                {/* Row 1: Financial Health (Admin Only) */}
                {hasFinancials && (
                    <div>
                        {sectionTitle(t('dashboard.financials', 'Financial Health'))}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            <StatCard
                                title={t('dashboard.netIncome')}
                                value={money(stats.financials.netIncome)}
                                icon={TrendingUp}
                                color="emerald"
                                subtitle={t('dashboard.thisMonth', 'This Month')}
                                link="/reports/revenue"
                            />
                            <StatCard
                                title={t('dashboard.grossRevenue')}
                                value={money(stats.financials.grossRevenue)}
                                icon={DollarSign}
                                color="blue"
                                subtitle={t('dashboard.thisMonth', 'This Month')}
                                link="/reports/revenue"
                            />
                            <StatCard
                                title={t('dashboard.coachEarnings')}
                                value={money(stats.financials.coachCommissions)}
                                icon={Briefcase}
                                color="orange"
                                subtitle={t('dashboard.thisMonth', 'This Month')}
                                link="/reports/coach"
                            />
                            <StatCard
                                title={t('dashboard.expenseRatio')}
                                value={`${stats.financials.expenseRatio}%`}
                                icon={TrendingDown}
                                color="rose"
                                subtitle={t('dashboard.refunds') + ': ' + money(stats.financials.refunds)}
                                link="/reports/refunds"
                            />
                        </div>
                    </div>
                )}

                {/* Row 2: Customer Growth */}
                <div>
                    {sectionTitle(t('dashboard.growth', 'Customer Growth'))}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        <StatCard
                            title={t('dashboard.activeMembers')}
                            value={num(stats.members.active)}
                            icon={Users}
                            color="indigo"
                            subtitle={`${num(stats.members.total)} ${t('dashboard.totalMembers')}`}
                            link="/members"
                        />
                        <StatCard
                            title={t('dashboard.newMembers')}
                            value={num(stats.members.newThisMonth)}
                            icon={UserPlus}
                            color="teal"
                            subtitle={t('dashboard.thisMonth')}
                            link="/reports/members"
                        />
                        <StatCard
                            title={t('dashboard.expiringSoon')}
                            value={num(stats.subscriptions.expiring)}
                            icon={Clock}
                            color="amber"
                            subtitle={t('dashboard.next7Days', 'Next 7 Days')}
                            link="/subscriptions?status=expiring"
                        />
                        <StatCard
                            title={t('dashboard.todayCheckIns')}
                            value={num(stats.checkIns.today)}
                            icon={Activity}
                            color="purple"
                            subtitle={t('dashboard.today', 'Today')}
                            link="/check-in"
                        />
                    </div>
                </div>

                {/* Row 3: Operations */}
                <div>
                    {sectionTitle(t('dashboard.operations', 'Operations'))}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        <StatCard
                            title={t('dashboard.cashStatus')}
                            value={stats.operations.cashStatus || 'Open'}
                            icon={Inbox}
                            color="slate"
                            subtitle={t('nav.dashboard')}
                            onClick={() => window.dispatchEvent(new Event('shift:open'))} // Trigger Cash Closing Modal
                        />
                        <StatCard
                            title={t('dashboard.activeShifts')}
                            value={num(stats.operations.activeShifts)}
                            icon={Shield}
                            color="cyan"
                            subtitle={t('dashboard.staffOnline', 'Staff Online')}
                            link="/reports/shifts"
                        />
                        <StatCard
                            title={t('dashboard.completionRate')}
                            value={`${stats.operations.sessionCompletion}%`}
                            icon={CheckCircle}
                            color="lime"
                            subtitle={t('dashboard.sessionsToday', 'Sessions Today')}
                        />
                        <StatCard
                            title={t('dashboard.todayRevenue')} // Fallback for Staff Collections or general Daily Flow
                            value={money(stats.revenue.todayGross)}
                            icon={CreditCard}
                            color="violet"
                            subtitle={t('dashboard.collectedToday', 'Collected Today')}
                            link="/reports/pay-in-out"
                        />
                    </div>
                </div>

                {/* Row 4: Auditing (Admin Only) */}
                {hasFinancials && (
                    <div>
                        {sectionTitle(t('dashboard.auditing', 'Auditing & Control'))}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            <StatCard
                                title={t('dashboard.outstanding')}
                                value={num(stats.subscriptions.outstanding)}
                                icon={AlertCircle}
                                color="red"
                                subtitle={t('dashboard.unpaidSubscriptions', 'Unpaid Subscriptions')}
                                link="/reports/outstanding"
                            />
                            <StatCard
                                title={t('dashboard.discounts')}
                                value={money(stats.financials.discounts)}
                                icon={Percent}
                                color="pink"
                                subtitle={t('dashboard.givenThisMonth', 'Given This Month')}
                                link="/reports"
                            />
                            <StatCard
                                title={t('dashboard.refunds')}
                                value={money(stats.financials.refunds)}
                                icon={RotateCcw}
                                color="rose"
                                subtitle={t('dashboard.totalVolume', 'Total Volume')}
                                link="/reports/refunds"
                            />
                            <StatCard
                                title={t('dashboard.manualTx')}
                                value={num(stats.operations.manualTransactions)}
                                icon={FileWarning}
                                color="yellow"
                                subtitle={t('dashboard.todayRisk', 'Today\'s Risk')}
                                link="/reports/audit" // Or relevant audit page
                            />
                        </div>
                    </div>
                )}
            </motion.div>
        </div >
    );
};

export default Dashboard;
