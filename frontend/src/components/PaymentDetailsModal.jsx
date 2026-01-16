/**
 * ============================================
 * PAYMENT DETAILS MODAL
 * ============================================
 * 
 * Drill-down modal showing individual payments for an employee
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';

const PaymentDetailsModal = ({ isOpen, onClose, employee, payments, month }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    if (!isOpen) return null;

    const cashTotal = payments?.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0) || 0;
    const nonCashTotal = payments?.filter(p => p.method !== 'cash').reduce((sum, p) => sum + p.amount, 0) || 0;
    const total = cashTotal + nonCashTotal;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 p-6 flex items-center justify-between z-10">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {employee?.employeeName}
                            </h2>
                            <p className="text-sm text-dark-400 mt-1">
                                {month} • {payments?.length || 0} {t('cashClosing.period')}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Summary Cards */}
                    <div className="p-6 bg-gray-50 dark:bg-dark-900/50">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-white dark:bg-dark-800 rounded-xl">
                                <p className="text-xs text-dark-500">{t('cashClosing.expectedCash')}</p>
                                <p className="text-xl font-bold text-emerald-400">
                                    {formatCurrency(cashTotal, i18n.language, currencyConf)}
                                </p>
                            </div>
                            <div className="p-4 bg-white dark:bg-dark-800 rounded-xl">
                                <p className="text-xs text-dark-500">{t('cashClosing.expectedNonCash')}</p>
                                <p className="text-xl font-bold text-blue-400">
                                    {formatCurrency(nonCashTotal, i18n.language, currencyConf)}
                                </p>
                            </div>
                            <div className="p-4 bg-white dark:bg-dark-800 rounded-xl">
                                <p className="text-xs text-dark-500">{t('cashClosing.expectedTotal')}</p>
                                <p className="text-2xl font-bold text-primary-400">
                                    {formatCurrency(total, i18n.language, currencyConf)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Payments List */}
                    <div className="p-6">
                        {payments && payments.length > 0 ? (
                            <div className="space-y-3">
                                {payments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-900/50 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-900 transition-colors"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${payment.method === 'cash' ? 'bg-emerald-500/20' : 'bg-blue-500/20'
                                                }`}>
                                                <DollarSign className={`w-5 h-5 ${payment.method === 'cash' ? 'text-emerald-400' : 'text-blue-400'
                                                    }`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-white">
                                                        {payment.member ? `${payment.member.firstName} ${payment.member.lastName}` : 'N/A'}
                                                    </p>
                                                    <span className="text-xs text-dark-500">#{payment.receiptNumber}</span>
                                                </div>
                                                <p className="text-xs text-dark-400">
                                                    {formatDateTime(payment.paidAt, i18n.language)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-white">
                                                {formatCurrency(payment.amount, i18n.language, currencyConf)}
                                            </p>
                                            <p className={`text-xs ${payment.method === 'cash' ? 'text-emerald-400' : 'text-blue-400'
                                                }`}>
                                                {payment.method?.toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-dark-500 py-8">
                                {t('payments.noPayments')}
                            </p>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PaymentDetailsModal;
