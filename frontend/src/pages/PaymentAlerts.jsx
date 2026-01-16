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
import { motion } from 'framer-motion';
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
    ChevronDown,
    CheckCircle,
    XCircle,
    Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';

const PaymentAlerts = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { getSetting } = useSettingsStore();

    // State
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
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [isSending, setIsSending] = useState(false);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    const [dueSoonDays, setDueSoonDays] = useState(3);

    // Fetch data
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
            toast.error('فشل تحميل البيانات');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = () => {
        fetchMembers();
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
                toast.success(`تم إنشاء ${response.data.data.dueSoon + response.data.data.overdue} تذكير`);
                fetchDashboard();
            }
        } catch (error) {
            toast.error('فشل إنشاء التذكيرات');
        } finally {
            setIsSending(false);
        }
    };

    const getStatusBadge = (member) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endDate = new Date(member.endDate);

        if (endDate < today) {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-red-500/15 text-red-500 border border-red-500/20">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    متأخر
                </span>
            );
        }

        const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntil === 0) {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/20">
                    <Clock className="w-3 h-3 mr-1" />
                    اليوم
                </span>
            );
        }

        if (daysUntil <= dueSoonDays) {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-yellow-500/15 text-yellow-600 border border-yellow-500/20">
                    <CalendarClock className="w-3 h-3 mr-1" />
                    قريباً ({daysUntil} يوم)
                </span>
            );
        }

        return (
            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-500 border border-blue-500/20">
                <CalendarClock className="w-3 h-3 mr-1" />
                {daysUntil} يوم
            </span>
        );
    };

    const getPaymentStatusBadge = (status) => {
        if (status === 'UNPAID') {
            return (
                <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                    غير مسدد
                </span>
            );
        }
        return (
            <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">
                جزئي
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-white" />
                        </div>
                        المتأخرات والتنبيهات
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        متابعة المدفوعات المتبقية وإرسال التذكيرات
                    </p>
                </div>
                <button
                    onClick={handleGenerateReminders}
                    disabled={isSending}
                    className="btn-primary"
                >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    إنشاء التذكيرات
                </button>
                <button
                    onClick={async () => {
                        // Find a member with remaining amount
                        const targetMember = members.find(m => m.remaining > 0);
                        if (!targetMember) {
                            toast.error('لا يوجد أعضاء عليهم مستحقات للاختبار');
                            return;
                        }

                        try {
                            toast.loading('جاري اختبار الصوت...', { id: 'test-voice' });

                            // Use .id (database ID) not .memberId (string code)
                            // backend expects integer ID
                            const response = await api.post('/reminders/test', { memberId: targetMember.id });

                            if (response.data.success) {
                                toast.success('تم إرسال تنبيه الاختبار', { id: 'test-voice' });
                                const notification = response.data.data;

                                // Play beep
                                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC8KEIQ+WFBQZG54d2uDkIpxTDIvKjo8Oz5BWF9pcXx+d2ttaVtIRxEULztBOzQzMj9KVFhdV09FREJBQkBCQ0ZJTVFVWFlaWldWVFJQT05NTk5PUVNVVldYWFlZWllYV1ZVVFRUVFRVVlZXWFhZWVhaWVlZWFhXV1ZWVVVVVVVVVVZWVldXWFhYWFhYWFhXV1dXVldXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXVw==');
                                audio.volume = 0.3;
                                await audio.play().catch(e => console.error('Audio play error:', e));

                                // Speak
                                await import('../utils/tts').then(module => {
                                    module.speakNotification(
                                        notification,
                                        i18n.language,
                                        module.getTTSSettings()
                                    );
                                });
                            }
                        } catch (error) {
                            console.error('[TEST] Error:', error);
                            const msg = error.response?.data?.message || 'فشل الاختبار';
                            toast.error(msg, { id: 'test-voice' });
                        }
                    }}
                    className="btn-secondary ml-2"
                >
                    {i18n.language === 'ar' ? '🔊 اختبار الصوت والتنبيه' : '🔊 Test Sound/Voice'}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Due Today */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-amber-500/15 flex items-center justify-center">
                            <Clock className="w-7 h-7 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">مستحق اليوم</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.dueToday?.count || 0}
                            </p>
                            <p className="text-sm text-amber-500 font-medium">
                                {formatCurrency(stats.dueToday?.total || 0, i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Due Soon */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-blue-500/15 flex items-center justify-center">
                            <CalendarClock className="w-7 h-7 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">مستحق قريباً ({dueSoonDays} أيام)</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.dueSoon?.count || 0}
                            </p>
                            <p className="text-sm text-blue-500 font-medium">
                                {formatCurrency(stats.dueSoon?.total || 0, i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Overdue */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-red-500/15 flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">متأخر</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.overdue?.count || 0}
                            </p>
                            <p className="text-sm text-red-500 font-medium">
                                {formatCurrency(stats.overdue?.total || 0, i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-gray-100 dark:border-dark-700 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute top-1/2 right-3 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="بحث بالاسم أو رقم الهاتف..."
                            className="input w-full pr-10"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        className="input py-2"
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="all">جميع الحالات</option>
                        <option value="dueToday">مستحق اليوم</option>
                        <option value="dueSoon">مستحق قريباً</option>
                        <option value="overdue">متأخر</option>
                    </select>

                    {/* Sort */}
                    <select
                        className="input py-2"
                        value={filters.sortBy}
                        onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                    >
                        <option value="remaining">المبلغ المتبقي</option>
                        <option value="endDate">تاريخ الاستحقاق</option>
                        <option value="memberName">اسم العضو</option>
                    </select>

                    <button onClick={fetchMembers} className="btn-secondary">
                        <RefreshCcw className="w-4 h-4" />
                        تحديث
                    </button>
                </div>
            </div>

            {/* Members Table */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-3" />
                        <p className="text-gray-500">جاري التحميل...</p>
                    </div>
                ) : members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <CheckCircle className="w-16 h-16 text-emerald-500/50 mb-4" />
                        <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">لا توجد متأخرات</p>
                        <p className="text-gray-500">جميع الأعضاء قاموا بالسداد</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700/50">
                                <tr className="text-xs uppercase text-gray-500 font-bold tracking-wider">
                                    <th className="px-4 py-3 text-right">العضو</th>
                                    <th className="px-4 py-3 text-right">الباقة</th>
                                    <th className="px-4 py-3 text-right">الإجمالي</th>
                                    <th className="px-4 py-3 text-right">المدفوع</th>
                                    <th className="px-4 py-3 text-right">المتبقي</th>
                                    <th className="px-4 py-3 text-center">الحالة</th>
                                    <th className="px-4 py-3 text-center">الاستحقاق</th>
                                    <th className="px-4 py-3 text-right">آخر دفعة</th>
                                    <th className="px-4 py-3 text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {members.map((member, idx) => (
                                    <motion.tr
                                        key={`${member.memberId}-${member.subscriptionId}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.02 }}
                                        className="hover:bg-gray-50 dark:hover:bg-dark-700/30"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                                                    <User className="w-5 h-5 text-primary-500" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {member.memberName}
                                                    </p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {member.memberPhone}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                            {member.planName}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(member.total, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-emerald-500 font-medium">
                                            {formatCurrency(member.paid, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-red-500 font-bold">
                                            {formatCurrency(member.remaining, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getPaymentStatusBadge(member.status)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getStatusBadge(member)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {member.lastPaymentDate
                                                ? formatDateTime(member.lastPaymentDate, i18n.language)
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/members/${member.memberId}`)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-primary-500 transition-colors"
                                                    title="عرض الملف"
                                                >
                                                    <User className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/payments?memberId=${member.memberId}`)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-emerald-500 transition-colors"
                                                    title="تسجيل دفعة"
                                                >
                                                    <CreditCard className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Summary Footer */}
            {members.length > 0 && (
                <div className="bg-gradient-to-r from-primary-500/10 to-accent-500/10 rounded-xl p-4 border border-primary-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">إجمالي الأعضاء</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{members.length}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">إجمالي المتبقي</p>
                                <p className="text-lg font-bold text-red-500">
                                    {formatCurrency(members.reduce((sum, m) => sum + m.remaining, 0), i18n.language, currencyConf)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentAlerts;
