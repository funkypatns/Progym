import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../store';

const CashClosingAdjustmentModal = ({ isOpen, onClose, closingId, onSuccess }) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'ADD', // ADD or SUBTRACT
        amount: '',
        reason: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!closingId) return;

        setIsLoading(true);
        try {
            await api.post(`/cash-closings/${closingId}/adjustments`, {
                type: formData.type,
                amount: parseFloat(formData.amount),
                reason: formData.reason
            });
            toast.success(t('common.saved'));
            onSuccess();
            handleClose();
        } catch (error) {
            console.error(error);
            toast.error(t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({ type: 'ADD', amount: '', reason: '' });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-dark-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                            {t('cashClosing.addAdjustment') || 'Add Adjustment'}
                        </h3>
                        <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Type Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: 'ADD' })}
                                className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.type === 'ADD'
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                        : 'border-gray-200 dark:border-dark-700 text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                <Plus className="w-4 h-4" />
                                <span>{t('common.add') || 'Add (Income)'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: 'SUBTRACT' })}
                                className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.type === 'SUBTRACT'
                                        ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400'
                                        : 'border-gray-200 dark:border-dark-700 text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                <Minus className="w-4 h-4" />
                                <span>{t('common.subtract') || 'Subtract (Expense)'}</span>
                            </button>
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="label">{t('common.amount')}</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                required
                                min="0.01"
                            />
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="label">{t('common.reason') || 'Reason/Note'}</label>
                            <textarea
                                className="input min-h-[80px]"
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                required
                                placeholder="e.g. Forgot to record expense..."
                            />
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p>Adjustments will modify the final balance but keep the original cash closing snapshot intact.</p>
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button type="button" onClick={handleClose} className="btn-secondary">
                                {t('common.cancel')}
                            </button>
                            <button type="submit" disabled={isLoading} className="btn-primary">
                                {isLoading ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CashClosingAdjustmentModal;
