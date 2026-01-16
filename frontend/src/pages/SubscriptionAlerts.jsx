import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Bell,
    User,
    Phone,
    RefreshCw,
    CheckCircle,
    Loader2,
    Volume2,
    VolumeX,
    Eye
} from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';
import { usePermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../utils/permissions';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionAlerts } from '../hooks/useSubscriptionAlerts';

const SubscriptionAlerts = () => {
    const { t, i18n } = useTranslation();
    const { can } = usePermissions();
    const navigate = useNavigate();

    // Use Global Hook
    const {
        unreadAlerts: alerts,
        fetchUnreadAlerts,
        markAsRead,
        isPolling,
        soundEnabled,
        setSoundEnabled
    } = useSubscriptionAlerts();

    // Initial Fetch
    useEffect(() => {
        fetchUnreadAlerts();
    }, [fetchUnreadAlerts]);

    const handleAcknowledge = async (id) => {
        await markAsRead([id]);
    };

    const handleAcknowledgeAll = async () => {
        if (alerts.length === 0) return;
        const ids = alerts.map(a => a.id);
        await markAsRead(ids);
    };

    const isRTL = i18n.language === 'ar';

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Bell className="w-6 h-6 text-primary-400" />
                        {isRTL ? 'تنبيهات انتهاء الاشتراك' : 'Subscription Expiration Alerts'}
                    </h1>
                    <p className="text-dark-400 mt-1">
                        {isRTL ? 'قائمة الأعضاء الذين انتهت صلاحية اشتراكاتهم ولم تتم مراجعتهم بعد' : 'Members with expired subscriptions requiring review'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2.5 rounded-xl border transition-all ${soundEnabled ? 'bg-primary-500/10 border-primary-500/20 text-primary-400' : 'bg-dark-800 border-dark-700 text-dark-400'}`}
                        title={soundEnabled ? 'Mute' : 'Unmute'}
                    >
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={handleAcknowledgeAll}
                        disabled={alerts.length === 0 || isPolling}
                        className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                    >
                        <CheckCircle className="w-4 h-4" />
                        {isRTL ? 'تحديد الكل كمُراجع' : 'Mark all as Reviewed'}
                    </button>

                    <button
                        onClick={() => fetchUnreadAlerts()}
                        disabled={isPolling}
                        className="p-2.5 rounded-xl bg-dark-800 border border-dark-700 text-dark-400 hover:text-white transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-5 h-5 ${isPolling ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-dark-900 rounded-2xl border border-dark-800 overflow-hidden shadow-xl flex-1 flex flex-col min-h-0">
                <div className="overflow-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-dark-800/80 backdrop-blur sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{isRTL ? 'العضو' : 'Member'}</th>
                                <th className="p-4 text-xs font-semibold text-dark-400 uppercase tracking-wider text-center">{isRTL ? 'الباقة' : 'Plan'}</th>
                                <th className="p-4 text-xs font-semibold text-dark-400 uppercase tracking-wider text-center">{isRTL ? 'تاريخ الانتهاء' : 'End Date'}</th>
                                <th className="p-4 text-xs font-semibold text-dark-400 uppercase tracking-wider text-center">{isRTL ? 'أيام التأخير' : 'Overdue'}</th>
                                <th className="p-4 text-xs font-semibold text-dark-400 uppercase tracking-wider text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                <th className="p-4 text-xs font-semibold text-dark-400 uppercase tracking-wider text-right">{isRTL ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-800/50">
                            {alerts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                                                <CheckCircle className="w-8 h-8 text-emerald-500" />
                                            </div>
                                            <p className="text-white font-medium mb-1">{isRTL ? 'كل الاشتراكات مراجعة' : 'All subscriptions reviewed'}</p>
                                            <p className="text-dark-400 text-sm">{isRTL ? 'لا يوجد أعضاء منتهي اشتراكهم غير مراجعين حالياً' : 'No unacknowledged expired members at the moment'}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                alerts.map((alert, idx) => (
                                    <motion.tr
                                        key={alert.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="hover:bg-dark-800/30 transition-colors group"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center border border-dark-700">
                                                    <User className="w-5 h-5 text-dark-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{alert.member?.firstName} {alert.member?.lastName}</p>
                                                    <div className="flex items-center gap-2 text-xs text-dark-400 font-mono">
                                                        <span>#{alert.member?.memberId}</span>
                                                        {alert.member?.phone && (
                                                            <>
                                                                <span className="opacity-30">•</span>
                                                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {alert.member.phone}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1 bg-dark-800 border border-dark-700 rounded-lg text-xs text-white">
                                                {alert.planName || '-'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-sm text-dark-300 font-mono">
                                            {formatDate(alert.endDate, i18n.language)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`font-mono font-bold ${alert.daysOverdue > 7 ? 'text-red-500' : 'text-yellow-500'}`}>
                                                {alert.daysOverdue} {isRTL ? 'أيام' : 'days'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${alert.type === 'expired'
                                                ? 'bg-red-500/10 border-red-500/20 text-red-500'
                                                : 'bg-gray-500/10 border-gray-500/20 text-gray-500'
                                                }`}>
                                                {alert.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/members/${alert.member?.id}`)}
                                                    className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-all"
                                                    title="View Profile"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>

                                                {can(PERMISSIONS.SUBSCRIPTIONS_CREATE) && alert.type === 'expired' && (
                                                    <button
                                                        onClick={() => navigate('/subscriptions', { state: { memberId: alert.member?.id, showRenew: true, subId: alert.id } })}
                                                        className="p-1.5 text-primary-400 hover:text-white hover:bg-primary-500/10 rounded-lg transition-all"
                                                        title="Renew"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => handleAcknowledge(alert.id)}
                                                    className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-500 hover:text-white transition-all"
                                                >
                                                    {isRTL ? 'مراجعة' : 'Review'}
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionAlerts;
