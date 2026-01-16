import React from 'react';
import {
    User,
    CreditCard,
    Calendar,
    Clock,
    ArrowRightLeft,
    CheckCircle,
    AlertTriangle,
    FileText,
    Receipt
} from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatter';

const ReceiptDetailsPanel = ({ payment, onRefundClick, currencySymbol = '$' }) => {
    if (!payment) return null;

    const totalRefunded = payment.refundedTotal || 0;
    const remainingRefundable = payment.remainingRefundable || 0;
    const isFullyRefunded = payment.status === 'refunded' || remainingRefundable <= 0.01;

    return (
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg mb-6">
            {/* Header */}
            <div className="bg-dark-900/50 p-4 border-b border-dark-700 flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {payment.receiptNumber}
                            {isFullyRefunded && <span className="badge badge-error text-xs">REFUNDED</span>}
                        </h3>
                        <p className="text-dark-400 text-sm flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(payment.paidAt)}
                        </p>
                    </div>
                </div>
                {remainingRefundable > 0 && (
                    <button
                        onClick={() => onRefundClick(payment)}
                        className="btn-secondary text-red-400 hover:bg-red-900/20 hover:text-red-300 border-dark-600"
                    >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Process Refund
                    </button>
                )}
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1: Member & Sub */}
                <div className="space-y-6">
                    <div>
                        <h4 className="text-dark-400 text-xs uppercase font-bold tracking-wider mb-3">Member Details</h4>
                        <div className="flex items-center gap-3 bg-dark-900/50 p-3 rounded-lg border border-dark-800">
                            <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-white font-bold">
                                {payment.member?.firstName?.[0]}
                            </div>
                            <div>
                                <p className="text-white font-medium">{payment.member?.firstName} {payment.member?.lastName}</p>
                                <p className="text-dark-400 text-xs">{payment.member?.phone}</p>
                                <p className="text-dark-500 text-[10px]">ID: {payment.member?.memberId}</p>
                            </div>
                        </div>
                    </div>

                    {payment.subscription && (
                        <div>
                            <h4 className="text-dark-400 text-xs uppercase font-bold tracking-wider mb-3">Subscription</h4>
                            <div className="bg-dark-900/50 p-3 rounded-lg border border-dark-800 text-sm">
                                <p className="text-white font-semibold mb-1">{payment.subscription.plan?.name}</p>
                                <div className="space-y-1 text-dark-300 text-xs">
                                    <p className="flex justify-between">
                                        <span>Start:</span>
                                        <span>{new Date(payment.subscription.startDate).toLocaleDateString()}</span>
                                    </p>
                                    <p className="flex justify-between">
                                        <span>End:</span>
                                        <span>{new Date(payment.subscription.endDate).toLocaleDateString()}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Column 2: Payment Details */}
                <div className="space-y-6">
                    <div>
                        <h4 className="text-dark-400 text-xs uppercase font-bold tracking-wider mb-3">Payment Info</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm py-2 border-b border-dark-800">
                                <span className="text-dark-400">Original Amount</span>
                                <span className="text-emerald-400 font-bold">{currencySymbol}{payment.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm py-2 border-b border-dark-800">
                                <span className="text-dark-400">Method</span>
                                <span className="text-white capitalize">{payment.method}</span>
                            </div>
                            <div className="flex justify-between text-sm py-2 border-b border-dark-800">
                                <span className="text-dark-400">Received By</span>
                                <span className="text-white">{payment.collectorName || payment.creator?.firstName || 'System'}</span>
                            </div>
                            {payment.shift && (
                                <div className="flex justify-between text-sm py-2 border-b border-dark-800">
                                    <span className="text-dark-400">Shift ID</span>
                                    <span className="text-white">#{payment.shift.id}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: Refund Status & History */}
                <div className="bg-dark-900/30 rounded-xl border border-dark-800 p-4">
                    <h4 className="text-dark-400 text-xs uppercase font-bold tracking-wider mb-4 flex items-center justify-between">
                        Refund Summary
                        {totalRefunded > 0 && <span className="text-red-400">Total: -{currencySymbol}{totalRefunded.toFixed(2)}</span>}
                    </h4>

                    {payment.refunds && payment.refunds.length > 0 ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                {payment.refunds.map(refund => (
                                    <div key={refund.id} className="bg-dark-800 p-2 rounded border-l-2 border-red-500 text-xs">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-red-400 font-bold">-{currencySymbol}{refund.amount.toFixed(2)}</span>
                                            <span className="text-dark-500">{formatDateTime(refund.createdAt)}</span>
                                        </div>
                                        <div className="text-dark-300 italic">"{refund.reason}"</div>
                                        <div className="text-dark-500 mt-1 text-[10px]">By: {refund.user?.firstName || 'Admin'}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-3 border-t border-dark-700 flex justify-between items-center text-sm">
                                <span className="text-dark-400">Remaining Refundable:</span>
                                <span className={`${remainingRefundable > 0 ? 'text-green-400' : 'text-dark-500'} font-bold`}>
                                    {currencySymbol}{remainingRefundable.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-dark-500 italic text-sm">
                            No refunds recorded this payment.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiptDetailsPanel;
