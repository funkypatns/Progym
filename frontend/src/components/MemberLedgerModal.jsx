import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X,
    Loader2,
    FileSpreadsheet,
    Banknote,
    ArrowDownLeft,
    ArrowUpRight,
    Receipt,
    Calendar,
    User,
    Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';

/**
 * MemberLedgerModal - Shows full payment/refund timeline for a member or subscription
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   memberId: number (optional)
 *   subscriptionId: number (optional)
 *   memberName: string (for display)
 */
const MemberLedgerModal = ({ isOpen, onClose, memberId, subscriptionId, memberName }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const [data, setData] = useState({ events: [], summary: {} });
    const [isLoading, setIsLoading] = useState(false);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    useEffect(() => {
        if (isOpen && (memberId || subscriptionId)) {
            fetchLedger();
        }
    }, [isOpen, memberId, subscriptionId]);

    const fetchLedger = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (memberId) params.append('memberId', memberId);
            if (subscriptionId) params.append('subscriptionId', subscriptionId);

            const response = await api.get(`/reports/ledger?${params}`);
            if (response.data.success) {
                setData(response.data.data);
            } else {
                toast.error(response.data.message || 'Failed to load ledger');
            }
        } catch (error) {
            console.error('Failed to fetch ledger:', error);
            toast.error('Failed to load ledger');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const params = new URLSearchParams();
            if (memberId) params.append('memberId', memberId);
            if (subscriptionId) params.append('subscriptionId', subscriptionId);
            params.append('format', 'excel');

            const response = await api.get(`/reports/ledger?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Ledger_${memberName || 'Member'}_${new Date().toLocaleDateString()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('تم التصدير بنجاح');
        } catch (error) {
            toast.error('فشل التصدير');
        }
    };

    if (!isOpen) return null;

    const { events, summary } = data;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-dark-700"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700 bg-gradient-to-r from-primary-500/10 to-transparent">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Receipt className="w-6 h-6 text-primary-500" />
                                سجل السداد والاسترداد
                            </h2>
                            {memberName && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {memberName}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExport}
                                className="btn-secondary text-sm"
                                disabled={isLoading || events.length === 0}
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                تصدير Excel
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-gray-200 dark:border-dark-700">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                                <ArrowDownLeft className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase">إجمالي المدفوع</span>
                            </div>
                            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                                {formatCurrency(summary.totalPaid || 0, i18n.language, currencyConf)}
                            </p>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                                <ArrowUpRight className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase">إجمالي المسترد</span>
                            </div>
                            <p className="text-xl font-bold text-red-700 dark:text-red-300">
                                {formatCurrency(summary.totalRefunded || 0, i18n.language, currencyConf)}
                            </p>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                                <Banknote className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase">الصافي</span>
                            </div>
                            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                {formatCurrency(summary.net || 0, i18n.language, currencyConf)}
                            </p>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                                <Info className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase">المتبقي</span>
                            </div>
                            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                                {formatCurrency(summary.remaining || 0, i18n.language, currencyConf)}
                            </p>
                        </div>
                    </div>

                    {/* Timeline Table */}
                    <div className="flex-1 overflow-auto p-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-3" />
                                <p className="text-gray-500">جاري التحميل...</p>
                            </div>
                        ) : events.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Receipt className="w-12 h-12 text-gray-300 mb-3" />
                                <p className="text-gray-500">لا توجد عمليات</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-dark-700/50 text-xs uppercase text-gray-500 font-bold tracking-wider">
                                        <th className="p-3 text-right">التاريخ/الوقت</th>
                                        <th className="p-3 text-center">النوع</th>
                                        <th className="p-3 text-right">المبلغ</th>
                                        <th className="p-3 text-center">طريقة الدفع</th>
                                        <th className="p-3 text-right">رقم الإيصال</th>
                                        <th className="p-3 text-right">الموظف</th>
                                        <th className="p-3 text-right">الباقة</th>
                                        <th className="p-3 text-right">إجمالي المدفوع</th>
                                        <th className="p-3 text-right">إجمالي المسترد</th>
                                        <th className="p-3 text-right">الصافي</th>
                                        <th className="p-3 text-right">المتبقي</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                    {events.map((event, idx) => (
                                        <motion.tr
                                            key={event.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className={`hover:bg-gray-50 dark:hover:bg-dark-700/30 ${event.type === 'refund' ? 'bg-red-50/30 dark:bg-red-900/10' : ''
                                                }`}
                                        >
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <div className="text-gray-900 dark:text-white font-medium">
                                                    {formatDateTime(event.date, i18n.language).split(',')[0]}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono">
                                                    {formatDateTime(event.date, i18n.language).split(',')[1]}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                {event.type === 'payment' ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                                                        <ArrowDownLeft className="w-3 h-3 mr-1" />
                                                        سداد
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-red-500/15 text-red-500 border border-red-500/20">
                                                        <ArrowUpRight className="w-3 h-3 mr-1" />
                                                        استرداد
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`p-3 text-right font-bold font-mono ${event.type === 'refund' ? 'text-red-500' : 'text-emerald-500'
                                                }`}>
                                                {event.amount >= 0 ? '+' : ''}{formatCurrency(event.amount, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="text-xs capitalize text-gray-600 dark:text-gray-400">
                                                    {event.method}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono text-xs text-primary-500">
                                                {event.receiptNumber || '-'}
                                            </td>
                                            <td className="p-3 text-right text-gray-600 dark:text-gray-400">
                                                {event.employee}
                                            </td>
                                            <td className="p-3 text-right text-gray-600 dark:text-gray-400">
                                                {event.subscription?.planName || '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(event.runningPaid, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-3 text-right font-mono text-xs text-red-600 dark:text-red-400">
                                                {formatCurrency(event.runningRefunded, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-3 text-right font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                                                {formatCurrency(event.net, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-3 text-right font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                                                {formatCurrency(event.remainingAfter, i18n.language, currencyConf)}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-dark-700 text-center text-xs text-gray-400">
                        عدد العمليات: {events.length} |
                        إجمالي الاشتراك: {formatCurrency(summary.subscriptionTotal || 0, i18n.language, currencyConf)}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default MemberLedgerModal;
