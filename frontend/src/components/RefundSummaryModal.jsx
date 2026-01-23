import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, Calculator, CheckCircle2, RotateCcw, Calendar, Banknote, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';

/**
 * RefundSummaryModal
 * Shows a read-only preview of the refund calculation before confirming.
 * Now supports configurable Daily Rate!
 */
const RefundSummaryModal = ({ isOpen, onClose, subscriptionId, onSuccess }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [previewData, setPreviewData] = useState(null);
    const [reason, setReason] = useState('');
    const [error, setError] = useState(null);

    // Configurable Daily Rate
    const [dailyRateOverride, setDailyRateOverride] = useState('');

    // Partial Refund & Cancellation
    const [manualRefundAmount, setManualRefundAmount] = useState('');
    const [cancelSub, setCancelSub] = useState(false);

    // Fetch Preview on Open
    useEffect(() => {
        if (isOpen && subscriptionId) {
            fetchPreview();
            setReason('');
            setError(null);
            setDailyRateOverride('');
        } else {
            setPreviewData(null);
        }
    }, [isOpen, subscriptionId]);

    const fetchPreview = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.post('/payments/refund', {
                subscriptionId,
                preview: true
            });
            if (res.data.success) {
                const data = res.data.data;
                setPreviewData(data);
                // Initialize override with server default
                setDailyRateOverride(data.dailyRate?.toFixed(2) || '0.00');

                // Initialize manual amount with max refundable (default behavior)
                const initialRefundable = data.refundableAmount || 0;
                setManualRefundAmount(initialRefundable.toString());
                // Default cancel to true if full refund, false if partial (conceptually)
                setCancelSub(true);
            }
        } catch (e) {
            console.error(e);
            setError(e.response?.data?.message || 'Failed to calculate refund');
        } finally {
            setIsLoading(false);
        }
    };

    // Live Calculations based on Override
    const getCalculations = () => {
        if (!previewData) return null;

        const rate = parseFloat(dailyRateOverride);
        const validRate = !isNaN(rate) && rate >= 0 ? rate : 0;

        const usedAmount = Math.ceil((previewData.usedDays || 0) * validRate); // Ceil to ensure coverage
        const refundable = Math.max(0, (previewData.paidAmount || 0) - usedAmount);
        const canRefund = refundable > 0;

        return {
            validRate,
            usedAmount,
            refundable,
            canRefund
        };
    };

    const calcs = getCalculations();

    const handleConfirm = async () => {
        if (!reason.trim()) {
            toast.error('Refund reason is required');
            return;
        }

        if (!calcs) return;

        if (!window.confirm("This action is irreversible. The subscription will be cancelled and the refund recorded. Proceed?")) return;

        setIsSubmitting(true);
        try {
            const res = await api.post('/payments/refund', {
                subscriptionId,
                reason: reason.trim(),
                dailyRate: calcs.validRate, // Send the overridden rate
                amount: manualRefundAmount ? parseFloat(manualRefundAmount) : undefined, // Send manual amount
                cancelSubscription: cancelSub // Send cancel flag
            });

            if (res.data.success) {
                toast.success('Refund processed successfully');
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Refund failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all" dir={isRtl ? 'rtl' : 'ltr'}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700"
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-red-100 text-red-600 rounded-xl dark:bg-red-900/30 dark:text-red-400 shadow-sm">
                                <RotateCcw size={22} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-none">Process Refund</h2>
                                <p className="text-xs text-gray-500 mt-1">Calculate and issue refund</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4 animate-pulse">
                                    <Calculator className="w-8 h-8 opacity-50" />
                                </div>
                                <span className="text-sm font-medium animate-pulse">Calculating refund details...</span>
                            </div>
                        ) : error ? (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 border border-red-100 dark:border-red-900/30">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold mb-1">Calculation Failed</div>
                                    <div className="text-sm opacity-90">{error}</div>
                                </div>
                            </div>
                        ) : previewData && calcs ? (
                            <div className="space-y-6">
                                {/* Plan Details Card */}
                                <div className="flex gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                    <div className="flex-1">
                                        <div className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide mb-1 flex items-center gap-1.5"><Calendar size={12} /> Plan</div>
                                        <div className="font-bold text-gray-900 dark:text-white text-lg">{previewData.planName}</div>
                                    </div>
                                    <div className="w-px bg-blue-200 dark:bg-blue-800"></div>
                                    <div className="flex-1">
                                        <div className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide mb-1 flex items-center gap-1.5"><Clock size={12} /> Duration</div>
                                        <div className="font-bold text-gray-900 dark:text-white text-lg">{previewData.planDuration} Days</div>
                                    </div>
                                </div>

                                {/* Calculation Cards */}
                                <div className="space-y-3">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Usage Breakdown</div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Total Paid */}
                                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <div className="text-xs text-gray-500 mb-1">Total Paid</div>
                                            <div className="font-bold text-gray-900 dark:text-white">{previewData.paidAmount?.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">EGP</span></div>
                                        </div>

                                        {/* Used Days */}
                                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <div className="text-xs text-gray-500 mb-1">Used Days</div>
                                            <div className="font-bold text-gray-900 dark:text-white">{previewData.usedDays} <span className="text-[10px] font-normal text-gray-400">days</span></div>
                                        </div>

                                        {/* EDITABLE DAILY RATE */}
                                        <div className="p-3 bg-white dark:bg-gray-700 rounded-xl border-2 border-blue-500/20 focus-within:border-blue-500 transition-colors shadow-sm relative overflow-hidden group">
                                            <label className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1 block">Daily Rate (Editable)</label>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="w-full bg-transparent font-bold text-gray-900 dark:text-white outline-none p-0 z-10"
                                                    value={dailyRateOverride}
                                                    onChange={e => setDailyRateOverride(e.target.value)}
                                                />
                                                <span className="text-[10px] font-normal text-gray-400">EGP</span>
                                            </div>
                                            <div className="absolute top-2 right-2 opacity-50"><RefreshCw size={12} className="text-blue-500" /></div>
                                        </div>

                                        {/* Used Amount (Calculated) */}
                                        <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                                            <div className="text-xs text-orange-600 dark:text-orange-400 font-bold mb-1">Consumed Value</div>
                                            <div className="font-bold text-orange-700 dark:text-orange-400">- {calcs.usedAmount.toLocaleString()} <span className="text-[10px] font-normal text-orange-500">EGP</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Refund Result & Toggle */}
                                <div className="space-y-4">
                                    <div className="p-5 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 shadow-sm relative overflow-hidden group focus-within:ring-2 focus-within:ring-green-500/50 transition-all">
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-full text-green-600 dark:text-green-400">
                                                    <Banknote size={24} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-green-800 dark:text-green-300">Refund Amount</div>
                                                    <div className="text-xs text-green-600 dark:text-green-400">Max: {calcs.refundable.toLocaleString()} EGP</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <input
                                                        type="number"
                                                        className="w-32 text-right text-3xl font-extrabold text-green-700 dark:text-green-400 bg-transparent outline-none border-b-2 border-green-500/30 focus:border-green-600 placeholder-green-300"
                                                        value={manualRefundAmount}
                                                        onChange={e => {
                                                            setManualRefundAmount(e.target.value);
                                                            // Auto-enable cancel if full refund
                                                            if (parseFloat(e.target.value) >= calcs.refundable) setCancelSub(true);
                                                        }}
                                                        placeholder="0"
                                                    />
                                                    <span className="text-sm font-bold ml-1 opacity-70 text-green-700 dark:text-green-400">EGP</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cancellation Toggle */}
                                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${cancelSub ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                                                <AlertTriangle size={16} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">Cancel Subscription</div>
                                                <div className="text-xs text-gray-400">Terminates the plan immediately</div>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={cancelSub} onChange={e => setCancelSub(e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                                        </label>
                                    </div>
                                </div>

                                {/* Reason Input */}
                                <div className="pt-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Refund Reason <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Reason for refund (required)..."
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        disabled={!calcs.canRefund}
                                    />
                                    {!reason.trim() && calcs.canRefund && (
                                        <p className="text-xs text-gray-400 mt-1.5 ml-1">Please provide a valid reason for the refund.</p>
                                    )}
                                </div>

                                {!calcs.canRefund && (
                                    <div className="flex items-center gap-2 justify-center text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">
                                        <AlertTriangle size={14} />
                                        Cannot process refund: Usage exceeds paid amount.
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200/50 rounded-xl text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isSubmitting || !calcs?.canRefund || !reason.trim()}
                            className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20 text-sm transition-all flex items-center gap-2 active:scale-95"
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Confirm Refund <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RefundSummaryModal;
