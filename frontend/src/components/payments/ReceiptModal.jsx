import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer, RefreshCw, User, CreditCard, Banknote, Building, FileText, ArrowRight } from 'lucide-react';

const ReceiptModal = ({ payment, onClose, onRefund, onDownload, currencySymbol = 'EGP' }) => {
    const { t } = useTranslation();
    const modalRef = useRef(null);

    if (!payment) return null;

    const totalRefunded = payment.refunds?.reduce((sum, r) => sum + r.amount, 0) || 0;
    const remaining = payment.amount - totalRefunded;
    const isFullyRefunded = remaining <= 0;

    const getMethodIcon = (method) => {
        switch (method) {
            case 'cash': return <Banknote size={16} />;
            case 'card': return <CreditCard size={16} />;
            case 'transfer': return <Building size={16} />;
            default: return <CreditCard size={16} />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300" dir="rtl">
            <div ref={modalRef} className="bg-white dark:bg-gray-800 w-full sm:max-w-md h-[90vh] sm:h-auto sm:rounded-2xl shadow-2xl flex flex-col transform transition-all animate-slide-in-right sm:animate-fade-in sm:translate-x-0">

                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                            <FileText size={20} className="text-blue-500" /> {t('payments.receipt')}
                        </h3>
                        <p className="text-xs font-mono text-gray-500 mt-1">{payment.receiptNumber || `REC-${payment.id}`}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Member Card */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            {payment.member?.firstName?.[0]}
                        </div>
                        <div>
                            <div className="font-bold text-gray-900 dark:text-white">{payment.member?.firstName} {payment.member?.lastName}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                <User size={12} /> #{payment.member?.memberId || payment.member?.id.slice(-4)} • {payment.member?.phone}
                            </div>
                        </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">{t('dashboard.recentPayments')}</h4>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            <div className="py-2 flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.date')}</span>
                                <span className="text-sm font-mono text-gray-900 dark:text-white">{new Date(payment.paidAt || payment.createdAt).toLocaleString('ar-EG')}</span>
                            </div>
                            <div className="py-2 flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">{t('payments.paidBy')}</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{payment.collectorName || 'Admin'}</span>
                            </div>
                            <div className="py-2 flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">{t('payments.method')}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-medium capitalize">
                                    {getMethodIcon(payment.method)} {t(`payments.${payment.method}`) || payment.method}
                                </span>
                            </div>
                            {payment.subscription && (
                                <div className="py-2 flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('subscriptions.plan')}</span>
                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{payment.subscription.plan?.name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Financials */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{t('payments.amount')}</span>
                            <span className="font-bold text-green-600 dark:text-green-400">{payment.amount?.toFixed(2)} {currencySymbol}</span>
                        </div>
                        {totalRefunded > 0 && (
                            <div className="flex justify-between items-center text-red-500">
                                <span className="text-sm">{t('memberDetails.totalRefunded')}</span>
                                <span className="font-bold">-{totalRefunded.toFixed(2)} {currencySymbol}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                            <span className="font-bold text-gray-900 dark:text-white">{t('memberDetails.netPaid')}</span>
                            <span className="font-bold text-xl text-blue-600 dark:text-blue-400">{Math.max(0, remaining).toFixed(2)} {currencySymbol}</span>
                        </div>
                    </div>

                    {/* Printer Actions */}
                    <button
                        onClick={() => onDownload(payment.id)}
                        className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
                    >
                        <Printer size={20} className="group-hover:scale-110 transition-transform" />
                        {t('payments.downloadReceipt')}
                    </button>

                    {/* Refunds Section */}
                    {!isFullyRefunded && onRefund && (
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => onRefund(payment)}
                                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={18} /> {t('memberDetails.refunds')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
