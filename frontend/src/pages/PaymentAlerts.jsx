/**
 * ============================================
 * PAYMENT ALERTS PAGE
 * ============================================
 *
 * Displays members with outstanding payments grouped by status
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    AlertTriangle,
    Clock,
    CalendarClock,
    Search,
    Send,
    User,
    CreditCard,
    RefreshCcw,
    Loader2,
    Phone,
    CheckCircle,
    Mail,
    Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { speakNotification, getTTSSettings } from '../utils/tts';
import { useSettingsStore } from '../store';
import { reportStyles, iconBadgeColors } from '../styles/reportStyles';
import MemberCodeChip from '../components/MemberCodeChip';
import StatusChip from '../components/StatusChip';

const PaymentAlerts = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';

    const [isLoading, setIsLoading] = useState(false);
    const [members, setMembers] = useState([]);
    const [stats, setStats] = useState({
        dueToday: { count: 0, total: 0 },
        dueSoon: { count: 0, total: 0 },
        overdue: { count: 0, total: 0 }
    });
    const [filters, setFilters] = useState({
        status: 'all',
        search: '',
        sortBy: 'remaining',
        sortOrder: 'desc'
    });
    const [isSending, setIsSending] = useState(false);
    const [dueSoonDays, setDueSoonDays] = useState(3);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    const alignStart = isRTL ? 'text-right' : 'text-left';
    const alignEnd = isRTL ? 'text-left' : 'text-right';
    const searchIconPosition = isRTL ? 'right-3' : 'left-3';
    const searchPadding = isRTL ? 'pr-9' : 'pl-9';

    useEffect(() => {
        fetchDashboard();
        fetchMembers();
    }, [filters.status, filters.sortBy, filters.sortOrder]);

    const fetchDashboard = async () => {
        try {
            const response = await api.get('/reminders/dashboard');
            if (response.data.success) {
                setStats(response.data.data);
                setDueSoonDays(response.data.data.dueSoonDays || 3);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard:', error);
        }
    };

    const fetchMembers = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status !== 'all') params.append('status', filters.status);
            if (filters.search) params.append('search', filters.search);
            params.append('sortBy', filters.sortBy);
            params.append('sortOrder', filters.sortOrder);

            const response = await api.get(`/reminders/members?${params}`);
            if (response.data.success) {
                setMembers(response.data.data.members);
            }
        } catch (error) {
            console.error('Failed to fetch members:', error);
            toast.error(isRTL ? 'فشل تحميل البيانات' : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            fetchMembers();
        }
    };

    const handleGenerateReminders = async () => {
        try {
            setIsSending(true);
            const response = await api.post('/reminders/generate');
            if (response.data.success) {
                const remindersCount = (response.data.data.dueSoon || 0) + (response.data.data.overdue || 0);
                toast.success(isRTL ? `تم إنشاء ${remindersCount} تذكير` : `Generated ${remindersCount} reminders`);
                fetchDashboard();
            }
        } catch (error) {
            toast.error(isRTL ? 'فشل إنشاء التذكيرات' : 'Failed to generate reminders');
        } finally {
            setIsSending(false);
        }
    };

    const handleTestVoice = async () => {
        const targetMember = members.find(m => m.remaining > 0);
        if (!targetMember) {
            toast.error(isRTL ? 'لا يوجد أعضاء لديهم مستحقات للاختبار' : 'No members with remaining balance to test');
            return;
        }

        try {
            toast.loading(isRTL ? 'جارٍ اختبار الصوت...' : 'Testing voice...', { id: 'test-voice' });

            const response = await api.post('/reminders/test', { memberId: targetMember.memberId });

            if (response.data.success) {
                toast.success(isRTL ? 'تم إرسال تنبيه الاختبار' : 'Test alert sent', { id: 'test-voice' });
                const notification = response.data.data;

                await speakNotification(
                    notification,
                    i18n.language,
                    getTTSSettings()
                );
            }
        } catch (error) {
            console.error('[TEST] Error:', error);
            const msg = error.response?.data?.message || (isRTL ? 'فشل الاختبار' : 'Test failed');
            toast.error(msg, { id: 'test-voice' });
        }
    };

    const getStatusBadge = (member) => {
        if (!member?.endDate) {
            return <StatusChip variant="neutral" label={t('common.unknown') || 'Unknown'} />;
        }

        const endDate = new Date(member.endDate);
        if (Number.isNaN(endDate.getTime())) {
            return <StatusChip variant="neutral" label={t('common.unknown') || 'Unknown'} />;
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const dueSoonDate = new Date(today);
        dueSoonDate.setDate(today.getDate() + dueSoonDays);

        if (endDate < today) {
            return <StatusChip variant="danger" label={isRTL ? 'متأخر' : 'Overdue'} />;
        }

        if (endDate >= today && endDate < tomorrow) {
            return <StatusChip variant="warning" label={isRTL ? 'مستحق اليوم' : 'Due Today'} />;
        }

        if (endDate >= tomorrow && endDate <= dueSoonDate) {
            return <StatusChip variant="info" label={isRTL ? 'مستحق قريباً' : 'Due Soon'} />;
        }

        return <StatusChip variant="neutral" label={isRTL ? 'قادم' : 'Upcoming'} />;
    };

    const getPaymentStatusBadge = (status) => {
        const normalized = (status || '').toUpperCase();

        if (normalized === 'PAID') {
            return <StatusChip variant="success" label={t('common.paid') || 'Paid'} />;
        }

        if (normalized === 'PARTIAL') {
            return <StatusChip variant="warning" label={t('common.partial') || 'Partial'} />;
        }

        if (normalized === 'REFUNDED') {
            return <StatusChip variant="danger" label={t('common.refunded') || 'Refunded'} />;
        }

        if (normalized === 'UNPAID') {
            return <StatusChip variant="danger" label={isRTL ? 'غير مدفوع' : 'Unpaid'} />;
        }

        return <StatusChip variant="neutral" label={status || '-'} />;
    };

    return (
        <div className={reportStyles.container}>
            {/* Header */}
            <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                    <Bell className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white">
                        {isRTL ? 'المدفوعات المتأخرة والتنبيهات' : 'Overdue Payments & Alerts'}
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">
                        {isRTL ? 'متابعة الأرصدة المتبقية وإرسال التنبيهات للفريق' : 'Track outstanding balances and notify the team'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        onClick={handleGenerateReminders}
                        disabled={isSending}
                        className={reportStyles.primaryButton}
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isRTL ? 'إنشاء التذكيرات' : 'Generate Reminders'}
                    </button>
                    <button onClick={handleTestVoice} className={reportStyles.secondaryButton}>
                        {isRTL ? 'اختبار الصوت والتنبيه' : 'Test Sound/Voice'}
                    </button>
                    <button onClick={fetchMembers} className={reportStyles.secondaryButton}>
                        <RefreshCcw className="w-4 h-4" />
                        {isRTL ? 'تحديث' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={reportStyles.summaryCard}>
                    <div>
                        <p className={reportStyles.cardLabel}>{isRTL ? 'مستحق اليوم' : 'Due Today'}</p>
                        <p className={reportStyles.cardValue}>{stats.dueToday?.count || 0}</p>
                        <p className="text-xs font-semibold text-amber-400">
                            {formatCurrency(stats.dueToday?.total || 0, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className={`${reportStyles.iconBadge} ${iconBadgeColors.orange}`}>
                        <Clock className="w-5 h-5 text-white" />
                    </div>
                </div>

                <div className={reportStyles.summaryCard}>
                    <div>
                        <p className={reportStyles.cardLabel}>
                            {isRTL ? `مستحق قريباً (${dueSoonDays} أيام)` : `Due Soon (${dueSoonDays} days)`}
                        </p>
                        <p className={reportStyles.cardValue}>{stats.dueSoon?.count || 0}</p>
                        <p className="text-xs font-semibold text-blue-400">
                            {formatCurrency(stats.dueSoon?.total || 0, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className={`${reportStyles.iconBadge} ${iconBadgeColors.blue}`}>
                        <CalendarClock className="w-5 h-5 text-white" />
                    </div>
                </div>

                <div className={reportStyles.summaryCard}>
                    <div>
                        <p className={reportStyles.cardLabel}>{isRTL ? 'متأخر' : 'Overdue'}</p>
                        <p className={reportStyles.cardValue}>{stats.overdue?.count || 0}</p>
                        <p className="text-xs font-semibold text-red-400">
                            {formatCurrency(stats.overdue?.total || 0, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className={`${reportStyles.iconBadge} ${iconBadgeColors.red}`}>
                        <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className={reportStyles.toolbar}>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[220px] space-y-1.5">
                        <label className={reportStyles.label}>{isRTL ? 'بحث' : 'Search'}</label>
                        <div className="relative">
                            <Search className={`absolute top-1/2 ${searchIconPosition} -translate-y-1/2 w-4 h-4 text-gray-400`} />
                            <input
                                type="text"
                                placeholder={isRTL ? 'ابحث بالاسم أو الهاتف...' : 'Search name or phone...'}
                                className={`${reportStyles.input} ${searchPadding}`}
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </div>

                    <div className="min-w-[160px] space-y-1.5">
                        <label className={reportStyles.label}>{isRTL ? 'الحالة' : 'Status'}</label>
                        <select
                            className={reportStyles.input}
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        >
                            <option value="all">{isRTL ? 'كل الحالات' : 'All Statuses'}</option>
                            <option value="dueToday">{isRTL ? 'مستحق اليوم' : 'Due Today'}</option>
                            <option value="dueSoon">{isRTL ? 'مستحق قريباً' : 'Due Soon'}</option>
                            <option value="overdue">{isRTL ? 'متأخر' : 'Overdue'}</option>
                        </select>
                    </div>

                    <div className="min-w-[180px] space-y-1.5">
                        <label className={reportStyles.label}>{isRTL ? 'ترتيب حسب' : 'Sort By'}</label>
                        <select
                            className={reportStyles.input}
                            value={filters.sortBy}
                            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                        >
                            <option value="remaining">{isRTL ? 'المتبقي' : 'Remaining'}</option>
                            <option value="endDate">{isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}</option>
                            <option value="memberName">{isRTL ? 'اسم العضو' : 'Member Name'}</option>
                        </select>
                    </div>

                    <div className="min-w-[140px] space-y-1.5">
                        <label className={reportStyles.label}>{isRTL ? 'الترتيب' : 'Order'}</label>
                        <select
                            className={reportStyles.input}
                            value={filters.sortOrder}
                            onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
                        >
                            <option value="desc">{isRTL ? 'تنازلي' : 'Desc'}</option>
                            <option value="asc">{isRTL ? 'تصاعدي' : 'Asc'}</option>
                        </select>
                    </div>

                    <button onClick={fetchMembers} className={reportStyles.secondaryButton}>
                        <RefreshCcw className="w-4 h-4" />
                        {isRTL ? 'تحديث' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Members Table */}
            <div className={reportStyles.table}>
                {isLoading ? (
                    <div className={reportStyles.emptyState}>
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                        <p className={reportStyles.emptyText}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</p>
                    </div>
                ) : members.length === 0 ? (
                    <div className={reportStyles.emptyState}>
                        <CheckCircle className="w-12 h-12 text-emerald-500/60 mb-3" />
                        <p className="text-lg font-bold text-white">{isRTL ? 'لا توجد متأخرات' : 'No overdue payments'}</p>
                        <p className={reportStyles.emptyText}>{isRTL ? 'جميع الأعضاء قاموا بالسداد' : 'All members are settled'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className={reportStyles.tableHeader}>
                                <tr>
                                    <th className={`${reportStyles.tableHeaderCell} ${alignStart}`}>{isRTL ? 'العضو' : 'Member'}</th>
                                    <th className={`${reportStyles.tableHeaderCell} ${alignStart}`}>{isRTL ? 'الاشتراك' : 'Subscription'}</th>
                                    <th className={`${reportStyles.tableHeaderCell} ${alignEnd}`}>{isRTL ? 'المبالغ' : 'Amounts'}</th>
                                    <th className={`${reportStyles.tableHeaderCell} text-center`}>{isRTL ? 'الزيارات' : 'Visits'}</th>
                                    <th className={`${reportStyles.tableHeaderCell} text-center`}>{isRTL ? 'الدفع' : 'Payment'}</th>
                                    <th className={`${reportStyles.tableHeaderCell} text-center`}>{isRTL ? 'الاستحقاق' : 'Due'}</th>
                                    <th className={`${reportStyles.tableHeaderCell} text-center`}>{isRTL ? 'الإجراءات' : 'Actions'}</th>
                                </tr>
                            </thead>
                            <tbody className={reportStyles.tableBody}>
                                {members.map((member) => (
                                    <tr key={`${member.memberId}-${member.subscriptionId}`} className={reportStyles.tableRow}>
                                        <td className={`${reportStyles.tableCell} ${alignStart}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                                    <User className="w-5 h-5 text-indigo-400" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-semibold text-white">{member.memberName}</p>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                                        <MemberCodeChip code={member.memberCode} />
                                                        {member.memberPhone && (
                                                            <span className="flex items-center gap-1">
                                                                <Phone className="w-3 h-3" />
                                                                {member.memberPhone}
                                                            </span>
                                                        )}
                                                        {member.memberEmail && (
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="w-3 h-3" />
                                                                {member.memberEmail}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`${reportStyles.tableCell} ${alignStart}`}>
                                            <div className="space-y-1">
                                                <p className="font-semibold text-white">{member.planName || '-'}</p>
                                                <p className="text-xs text-gray-400">
                                                    {isRTL ? 'ينتهي' : 'Ends'}: {member.endDate ? formatDateTime(member.endDate, i18n.language).split(',')[0] : '-'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className={`${reportStyles.tableCell} ${alignEnd}`}>
                                            <div className="space-y-1">
                                                <p className="text-xs text-gray-400">{isRTL ? 'الإجمالي' : 'Total'}: {formatCurrency(member.total, i18n.language, currencyConf)}</p>
                                                <p className="text-xs text-emerald-400">{isRTL ? 'المدفوع' : 'Paid'}: {formatCurrency(member.paid, i18n.language, currencyConf)}</p>
                                                <p className="text-xs text-red-400 font-semibold">{isRTL ? 'المتبقي' : 'Remaining'}: {formatCurrency(member.remaining, i18n.language, currencyConf)}</p>
                                                <p className="text-[10px] text-gray-500">
                                                    {isRTL ? 'آخر دفعة' : 'Last payment'}: {member.lastPaymentDate ? formatDateTime(member.lastPaymentDate, i18n.language).split(',')[0] : '-'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className={`${reportStyles.tableCell} text-center`}>
                                            <div className="inline-flex items-center gap-2 text-xs text-gray-300">
                                                <Activity className="w-4 h-4 text-indigo-400" />
                                                <span className="font-semibold">
                                                    {member.visits?.subscription ?? 0} / {member.visits?.allTime ?? 0}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`${reportStyles.tableCell} text-center`}>
                                            {getPaymentStatusBadge(member.status)}
                                        </td>
                                        <td className={`${reportStyles.tableCell} text-center`}>
                                            {getStatusBadge(member)}
                                        </td>
                                        <td className={`${reportStyles.tableCell} text-center`}>
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/members/${member.memberId}`)}
                                                    className="p-2 rounded-lg hover:bg-slate-700/40 text-gray-400 hover:text-white transition-colors"
                                                    title={isRTL ? 'عرض الملف' : 'View Profile'}
                                                >
                                                    <User className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/payments?memberId=${member.memberId}`)}
                                                    className="p-2 rounded-lg hover:bg-slate-700/40 text-emerald-400 hover:text-emerald-300 transition-colors"
                                                    title={isRTL ? 'تسجيل دفعة' : 'Record Payment'}
                                                >
                                                    <CreditCard className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Summary Footer */}
            {members.length > 0 && (
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
                    <div className="flex flex-wrap items-center gap-6">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">{isRTL ? 'إجمالي الأعضاء' : 'Total Members'}</p>
                            <p className="text-lg font-bold text-white">{members.length}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">{isRTL ? 'إجمالي المتبقي' : 'Total Remaining'}</p>
                            <p className="text-lg font-bold text-red-400">
                                {formatCurrency(members.reduce((sum, m) => sum + m.remaining, 0), i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentAlerts;
