import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, Search, X, AlertCircle, Clock, Phone, Eye,
    CreditCard, User, Banknote, RefreshCcw, Scan
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useAuthStore, useSettingsStore } from '../store';
import MemberDetailsModal from './MemberDetailsModal';
import ReportSummaryCards from './ReportSummaryCards';

const ReceiptLookupReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { user } = useAuthStore();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';
    const alignStart = isRTL ? 'text-right' : 'text-left';
    const searchIconPosition = isRTL ? 'right-4' : 'left-4';
    const searchPadding = isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4';
    const iconMargin = isRTL ? 'ml-2' : 'mr-2';

    const [searchQuery, setSearchQuery] = useState('');
    const [mode, setMode] = useState('scan'); // 'scan' or 'manual'
    const [scope, setScope] = useState('allShifts');
    const [isLoading, setIsLoading] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [error, setError] = useState(null);
    const [viewMemberId, setViewMemberId] = useState(null);

    const inputRef = useRef(null);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    // Auto-focus on mount
    useEffect(() => {
        if (isActive && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isActive]);

    const lookupReceipt = async (query) => {
        if (!query || !query.trim()) return;

        // Normalize scanner input: trim, remove invisible chars
        const cleanQuery = query.trim().replace(/[\x00-\x1F\x7F]/g, '');

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                q: cleanQuery,
                scope: user?.role === 'admin' ? scope : 'currentShift'
            });
            const response = await apiClient.get(`/reports/receipts/lookup?${params}`);

            if (response.data.success) {
                setReceiptData(response.data.data);
            } else {
                setError(response.data.message || t('reports.receipts.notFound', 'Receipt not found'));
                setReceiptData(null);
            }
        } catch (err) {
            const message = err.response?.data?.message || t('reports.receipts.lookupFailed', 'Failed to lookup receipt');
            setError(message);
            setReceiptData(null);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            lookupReceipt(searchQuery);
        }
    };

    const handleClear = () => {
        setSearchQuery('');
        setReceiptData(null);
        setError(null);
        if (inputRef.current) inputRef.current.focus();
    };

    if (!isActive) return null;

    const data = receiptData;
    const statusMap = {
        Paid: t('common.paid', 'Paid'),
        Refunded: t('reports.refunds.refunded', 'Refunded'),
        Pending: t('common.pending', 'Pending')
    };

    return (
        <div className="space-y-6">
            <MemberDetailsModal
                isOpen={!!viewMemberId}
                onClose={() => setViewMemberId(null)}
                memberId={viewMemberId}
            />

            {/* Summary Cards */}
            <ReportSummaryCards
                gridClassName="md:grid-cols-3"
                items={[
                    {
                        label: t('reports.receipts.found', 'Receipts found'),
                        value: data ? 1 : 0,
                        icon: Search,
                        iconClassName: 'bg-indigo-500'
                    },
                    {
                        label: t('reports.fields.amount', 'Amount'),
                        value: formatCurrency(data?.computed?.originalPaid || 0, i18n.language, currencyConf),
                        icon: Banknote,
                        iconClassName: 'bg-emerald-500'
                    },
                    {
                        label: t('reports.refunds.refunded', 'Refunded'),
                        value: formatCurrency(data?.computed?.refundedTotal || 0, i18n.language, currencyConf),
                        icon: CreditCard,
                        iconClassName: 'bg-red-500'
                    }
                ]}
            />

            {/* Search Controls */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
                {/* Mode Toggle + Scope Toggle (Admin) */}
                <div className="flex flex-wrap items-center gap-4 mb-6">
                    <div className="inline-flex bg-slate-900/50 rounded-xl p-1 border border-slate-700">
                        <button
                            onClick={() => setMode('scan')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'scan'
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-slate-700'
                                }`}
                        >
                            <Scan className={`w-4 h-4 inline-block ${iconMargin}`} />
                            {t('reports.receipts.scan', 'Scan')}
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'manual'
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-slate-700'
                                }`}
                        >
                            <Search className={`w-4 h-4 inline-block ${iconMargin}`} />
                            {t('reports.receipts.manual', 'Manual')}
                        </button>
                    </div>

                    {user?.role === 'admin' && (
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-400">
                                {t('reports.scope', 'Scope')}:
                            </span>
                            <select
                                className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm font-medium text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                            >
                                <option value="allShifts">{t('reports.receipts.allShifts', 'All shifts')}</option>
                                <option value="currentShift">{t('reports.receipts.currentShift', 'Current shift')}</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Search Input */}
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className={`absolute ${searchIconPosition} top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400`} />
                        <input
                            ref={inputRef}
                            type="text"
                            className={`w-full ${searchPadding} py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-lg font-medium text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all`}
                            placeholder={t('reports.receipts.searchPlaceholder', 'Scan / enter receipt no or transaction code...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>
                    {mode === 'manual' && (
                        <button
                            onClick={() => lookupReceipt(searchQuery)}
                            disabled={isLoading}
                            className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                        </button>
                    )}
                    <button
                        onClick={handleClear}
                        className="px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl border border-slate-600 transition-all"
                        title={t('common.clear', 'Clear')}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Error State */}
            <AnimatePresence>
                {error && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center"
                    >
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <p className="text-red-400 font-bold text-lg">{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Receipt Details Panel */}
            <AnimatePresence>
                {data && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-slate-800/40 rounded-xl shadow-xl border border-slate-700/50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-slate-900/50 p-6 border-b border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">
                                        {t('reports.receipts.receiptNumber', 'Receipt number')}
                                    </p>
                                    <h2 className="text-3xl font-bold text-white font-mono tracking-wider">{data.payment.receiptNumber}</h2>
                                </div>
                                <div className="flex gap-3">
                                    <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${data.computed.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' :
                                        data.computed.status === 'Refunded' ? 'bg-red-500/20 text-red-400' :
                                            'bg-amber-500/20 text-amber-400'
                                        }`}>
                                        {statusMap[data.computed.status] || data.computed.status}
                                    </span>
                                    <span className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-700 text-gray-300">
                                        {data.payment.method?.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {/* Date & Time */}
                            <div className={`flex items-center gap-3 text-gray-400 ${alignStart}`}>
                                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <span className="font-semibold text-white">{formatDateTime(data.payment.paidAt, i18n.language)}</span>
                            </div>

                            {/* Member Info */}
                            {data.member && (
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                                    <h4 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest">
                                        {t('reports.fields.memberName', 'Member')}
                                    </h4>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                            {data.member.name?.[0]}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-white text-lg">{data.member.name}</p>
                                                <button
                                                    onClick={() => setViewMemberId(data.member.id)}
                                                    className="p-1 hover:bg-slate-700 rounded transition-colors group"
                                                    title={t('common.viewDetails', 'View details')}
                                                >
                                                    <Eye className="w-4 h-4 text-indigo-400" />
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-400 font-mono">{data.member.code}</p>
                                        </div>
                                        {data.member.phone && (
                                            <div className="flex items-center gap-2 text-sm text-gray-400 font-semibold">
                                                <Phone className="w-4 h-4" />
                                                {data.member.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Plan Info */}
                            {data.subscription && (
                                <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                    <div className="p-2 bg-indigo-500 rounded-lg">
                                        <CreditCard className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-white font-semibold">
                                        {data.subscription.planName} ({data.subscription.duration} {t('common.days', 'days')})
                                    </span>
                                </div>
                            )}

                            {/* Financial Summary */}
                            <div className="border-t border-slate-700 pt-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                        <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                                            {t('reports.fields.originalPaid', 'Original paid')}
                                        </p>
                                        <p className="text-xl font-bold text-white">
                                            {formatCurrency(data.computed.originalPaid, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                        <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                                            {t('reports.refunds.refunded', 'Refunded')}
                                        </p>
                                        <p className="text-xl font-bold text-red-400">
                                            -{formatCurrency(data.computed.refundedTotal, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                    <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                        <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                                            {t('reports.remaining', 'Remaining')}
                                        </p>
                                        <p className="text-xl font-bold text-emerald-400">
                                            {formatCurrency(data.computed.remainingBalance, i18n.language, currencyConf)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Paid By / Shift */}
                            <div className="flex flex-wrap gap-4 text-sm">
                                <div className={`flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-400">{t('reports.fields.paidBy', 'Paid by')}:</span>
                                    <span className="font-bold text-white">{data.paidBy?.name}</span>
                                </div>
                                {data.shift && (
                                    <div className={`flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <Banknote className="w-4 h-4 text-gray-400" />
                                        <span className="text-gray-400">{t('reports.shift', 'Shift')}:</span>
                                        <span className="font-bold text-white">#{data.shift.id}</span>
                                    </div>
                                )}
                                {data.payment.transactionRef && (
                                    <div className={`flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <CreditCard className="w-4 h-4 text-gray-400" />
                                        <span className="text-gray-400">{t('reports.reference', 'Ref')}:</span>
                                        <span className="font-mono font-bold text-white">{data.payment.transactionRef}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Refund History */}
                        {data.refunds && data.refunds.length > 0 && (
                            <div className="border-t border-slate-700 bg-slate-800/30 p-6">
                                <h4 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest flex items-center gap-2">
                                    <RefreshCcw className="w-4 h-4" />
                                    {t('reports.refunds.history', 'Refund history')}
                                </h4>
                                <div className="space-y-3">
                                    {data.refunds.map((refund) => (
                                        <div key={refund.id} className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-bold text-white">{formatCurrency(refund.amount, i18n.language, currencyConf)}</p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDateTime(refund.refundedAt, i18n.language)} {t('reports.by', 'by')} {refund.processedBy?.name}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs bg-slate-700 px-2 py-1 rounded text-gray-300 capitalize">{refund.method}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReceiptLookupReport;
