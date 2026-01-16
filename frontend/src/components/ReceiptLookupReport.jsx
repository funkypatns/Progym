import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Loader2, Search, X, AlertCircle, Clock, Phone, Eye,
    CreditCard, User, Banknote, RefreshCcw, Printer, Receipt
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useAuthStore, useSettingsStore } from '../store';
import MemberDetailsModal from './MemberDetailsModal';

const ReceiptLookupReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { user } = useAuthStore();
    const { getSetting } = useSettingsStore();

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
                setError(response.data.message || 'Receipt not found');
                setReceiptData(null);
            }
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to lookup receipt';
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

    const handlePrintPayment = () => {
        // TODO: Integrate with existing receipt printing
        toast.success('Print Payment Receipt triggered');
    };

    const handlePrintRefund = (refundId) => {
        // TODO: Integrate with existing refund receipt printing
        toast.success(`Print Refund Receipt for TXN-${refundId}`);
    };

    if (!isActive) return null;

    const data = receiptData;

    return (
        <div className="space-y-6">
            <MemberDetailsModal
                isOpen={!!viewMemberId}
                onClose={() => setViewMemberId(null)}
                memberId={viewMemberId}
            />
            {/* Search Controls */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                {/* Mode Toggle + Scope Toggle (Admin) */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="flex bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                        <button
                            onClick={() => setMode('scan')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'scan'
                                ? 'bg-primary-500 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Scan
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'manual'
                                ? 'bg-primary-500 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Manual
                        </button>
                    </div>

                    {user?.role === 'admin' && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Scope:</span>
                            <select
                                className="input py-2 px-3 text-sm"
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                            >
                                <option value="allShifts">All Shifts</option>
                                <option value="currentShift">Current Shift</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Search Input */}
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="input w-full pl-12 pr-4 py-3 text-lg"
                            placeholder="Scan / Enter Receipt No or Transaction Code..."
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
                            className="btn-primary px-6"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        </button>
                    )}
                    <button onClick={handleClear} className="btn-secondary px-4">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500" />
                    <p className="text-gray-500 mt-2">Looking up receipt...</p>
                </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                    <AlertCircle className="w-10 h-10 mx-auto text-red-500 mb-3" />
                    <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                </div>
            )}

            {/* Receipt Details Panel */}
            {data && !isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-primary-100 text-sm font-medium">Receipt Number</p>
                                <h2 className="text-2xl font-bold font-mono">{data.payment.receiptNumber}</h2>
                            </div>
                            <div className="flex gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.computed.status === 'Paid' ? 'bg-emerald-500' :
                                    data.computed.status === 'Refunded' ? 'bg-red-500' :
                                        'bg-amber-500'
                                    }`}>
                                    {data.computed.status}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20">
                                    {data.payment.method?.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6">
                        {/* Date & Time */}
                        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                            <Clock className="w-5 h-5" />
                            <span>{formatDateTime(data.payment.paidAt, i18n.language)}</span>
                        </div>

                        {/* Member Info */}
                        {data.member && (
                            <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Member</h4>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-lg">
                                        {data.member.name?.[0]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-900 dark:text-white">{data.member.name}</p>
                                            <button
                                                onClick={() => setViewMemberId(data.member.id)}
                                                className="p-1 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-full transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4 text-primary-500" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500">{data.member.code}</p>
                                    </div>
                                    {data.member.phone && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto">
                                            <Phone className="w-4 h-4" />
                                            {data.member.phone}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Plan Info */}
                        {data.subscription && (
                            <div className="flex items-center gap-3">
                                <CreditCard className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-700 dark:text-gray-300">
                                    {data.subscription.planName} ({data.subscription.duration} days)
                                </span>
                            </div>
                        )}

                        {/* Financial Summary */}
                        <div className="border-t border-gray-100 dark:border-dark-700 pt-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Original Paid</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(data.computed.originalPaid, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Refunded</p>
                                    <p className="text-xl font-bold text-red-500">
                                        -{formatCurrency(data.computed.refundedTotal, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
                                    <p className="text-xl font-bold text-emerald-500">
                                        {formatCurrency(data.computed.remainingBalance, i18n.language, currencyConf)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Paid By / Shift */}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Paid By: <span className="font-medium text-gray-700 dark:text-gray-300">{data.paidBy?.name}</span>
                            </div>
                            {data.shift && (
                                <div className="flex items-center gap-2">
                                    <Banknote className="w-4 h-4" />
                                    Shift: <span className="font-medium text-gray-700 dark:text-gray-300">#{data.shift.id}</span>
                                </div>
                            )}
                            {data.payment.transactionRef && (
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" />
                                    Ref: <span className="font-mono text-gray-700 dark:text-gray-300">{data.payment.transactionRef}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Refund History */}
                    {data.refunds && data.refunds.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-dark-700 p-6">
                            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">Refund History</h4>
                            <div className="space-y-3">
                                {data.refunds.map(refund => (
                                    <div key={refund.id} className="bg-gray-50 dark:bg-dark-700/50 rounded-lg p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                                <RefreshCcw className="w-5 h-5 text-red-500" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-red-500">
                                                    -{formatCurrency(refund.amount, i18n.language, currencyConf)}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDateTime(refund.createdAt, i18n.language)} • {refund.refundedBy}
                                                </p>
                                                {refund.reason && (
                                                    <p className="text-xs text-gray-400 mt-1">Reason: {refund.reason}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono text-gray-400">{refund.auditTrace}</span>
                                            <button
                                                onClick={() => handlePrintRefund(refund.id)}
                                                className="btn-secondary text-xs px-3 py-1.5"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Print Payment Button */}
                    <div className="bg-gray-50 dark:bg-dark-700/50 p-4 flex justify-center">
                        <button onClick={handlePrintPayment} className="btn-primary">
                            <Printer className="w-5 h-5" />
                            Print Payment Receipt
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Empty State */}
            {!data && !isLoading && !error && (
                <div className="bg-white dark:bg-dark-800 p-16 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 text-center">
                    <Receipt className="w-16 h-16 mx-auto text-gray-300 dark:text-dark-500 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Digital Receipt Book</h3>
                    <p className="text-gray-500 dark:text-dark-400">Scan or enter a receipt number to view details</p>
                </div>
            )}
        </div>
    );
};

export default ReceiptLookupReport;
