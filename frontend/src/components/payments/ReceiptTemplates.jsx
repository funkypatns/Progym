import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../utils/dateFormatter';
import { formatCurrency, formatMoney } from '../../utils/numberFormatter';

/**
 * 1️⃣ PAYMENT RECEIPT (Thermal 80mm style)
 * Printed when money is paid. 
 * Represents ONLY the current payment action.
 */
export const PaymentReceipt = forwardRef(({ payment, currencyConf, gymName, gymLogoUrl, className = '' }, ref) => {
    const { t, i18n } = useTranslation();

    if (!payment) return null;

    const methodKey = String(payment.method || 'cash').toLowerCase();
    const totalPrice = payment.subscription?.price ?? payment.subscription?.plan?.price;
    const rawPaidToDate = payment.subscription?.paidAmount;
    const rawRemaining = payment.subscription?.remainingAmount;
    const paidNow = Math.abs(Number(payment.amount || 0));
    const isRefund = Number(payment.amount) < 0 || String(payment.status || '').toLowerCase().includes('refund');

    let paidToDate = Number.isFinite(Number(rawPaidToDate)) ? Number(rawPaidToDate) : null;
    let remainingAmount = Number.isFinite(Number(rawRemaining)) ? Number(rawRemaining) : null;

    if (paidToDate === null && Number.isFinite(Number(totalPrice)) && Number.isFinite(Number(remainingAmount))) {
        paidToDate = Math.max(0, Number(totalPrice) - Number(remainingAmount));
    }
    if (remainingAmount === null && Number.isFinite(Number(totalPrice)) && Number.isFinite(Number(paidToDate))) {
        remainingAmount = Math.max(0, Number(totalPrice) - Number(paidToDate));
    }

    const isPartial = !isRefund
        && Number.isFinite(Number(totalPrice))
        && Number.isFinite(Number(paidToDate))
        && paidToDate > 0
        && paidToDate < Number(totalPrice) - 0.01;

    const reference = payment.externalReference || payment.transactionRef || null;
    const staffName = payment.collectorName || (payment.creator ? `${payment.creator.firstName} ${payment.creator.lastName}` : 'System');
    const displayGymName = gymName || t('receipt.companyName', 'GYM MANAGEMENT');

    return (
        <div ref={ref} className={`relative p-8 bg-white text-black font-mono text-sm max-w-[80mm] mx-auto print:p-0 print:max-w-none ${className}`}>
            {isRefund && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 text-5xl font-black tracking-widest text-red-600 rotate-[-20deg]">
                    {t('receipt.refundedWatermark', 'REFUNDED')}
                </div>
            )}
            {/* Header */}
            <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
                {gymLogoUrl ? (
                    <img src={gymLogoUrl} alt={displayGymName} className="h-10 mx-auto object-contain mb-2" />
                ) : (
                    <h2 className="text-xl font-bold uppercase tracking-wider">{displayGymName}</h2>
                )}
                <p className="text-xs mt-1 text-gray-600">{t('receipt.paymentTitle', 'PAYMENT RECEIPT')}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                    {isRefund && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-50 text-red-600 border border-red-100">
                            {t('receipt.refundLabel', 'REFUND')}
                        </span>
                    )}
                    {isPartial && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">
                            {t('receipt.partialPayment', 'PARTIAL PAYMENT')}
                        </span>
                    )}
                </div>
            </div>

            {/* Receipt Info */}
            <div className="flex justify-between mb-2">
                <span className="font-bold">{t('receipt.number', 'Receipt #')}:</span>
                <span>{payment.receiptNumber || `PAY-${payment.id}`}</span>
            </div>
            <div className="flex justify-between mb-4">
                <span className="font-bold">{t('receipt.date', 'Date')}:</span>
                <span>{formatDateTime(payment.paidAt || payment.createdAt, i18n.language)}</span>
            </div>
            {reference && (
                <div className="flex justify-between mb-4 text-xs">
                    <span className="font-bold">{t('receipt.reference', 'Reference')}:</span>
                    <span>{reference}</span>
                </div>
            )}

            <div className="border-b border-dashed border-gray-300 mb-4"></div>

            {/* Member Info */}
            <div className="mb-4 space-y-1">
                <div className="flex justify-between">
                    <span className="font-bold">{t('receipt.memberName', 'Member')}:</span>
                    <span>{payment.member?.firstName} {payment.member?.lastName}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span>{t('receipt.memberId', 'ID')}:</span>
                    <span>{payment.member?.memberId || payment.memberId}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span>{t('receipt.phone', 'Phone')}:</span>
                    <span>{payment.member?.phone}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-gray-300 mb-4"></div>

            {/* Plan Info */}
            {payment.subscription && (
                <div className="mb-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                        {t('receipt.subscriptionDetails', 'Subscription Details')}
                    </div>
                    <div className="flex justify-between font-bold">
                        <span>{payment.subscription.plan?.name}</span>
                        <span>{payment.subscription.plan?.duration} {t('common.days')}</span>
                    </div>
                    {(payment.subscription.startDate || payment.subscription.endDate) && (
                        <div className="flex justify-between text-xs mt-1 text-gray-600">
                            <span>{t('receipt.period', 'Period')}:</span>
                            <span>
                                {payment.subscription.startDate ? formatDateTime(payment.subscription.startDate, i18n.language) : '-'}
                                {' '} - {' '}
                                {payment.subscription.endDate ? formatDateTime(payment.subscription.endDate, i18n.language) : '-'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {Number.isFinite(Number(totalPrice)) && (
                <div className="mb-4 space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span>{t('receipt.total', 'Total')}:</span>
                        <span>{formatMoney(totalPrice, i18n.language, currencyConf)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{t('receipt.paidNow', 'Paid now')}:</span>
                        <span>{formatMoney(paidNow, i18n.language, currencyConf)}</span>
                    </div>
                    {Number.isFinite(Number(paidToDate)) && (
                        <div className="flex justify-between">
                            <span>{t('receipt.paidToDate', 'Paid to date')}:</span>
                            <span>{formatMoney(paidToDate, i18n.language, currencyConf)}</span>
                        </div>
                    )}
                    {Number.isFinite(Number(remainingAmount)) && (
                        <div className="flex justify-between font-bold">
                            <span>{t('receipt.remainingAfter', 'Remaining after')}:</span>
                            <span>{formatMoney(remainingAmount, i18n.language, currencyConf)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Financials */}
            <div className="mb-6 space-y-1">
                <div className="flex justify-between">
                    <span>{t('receipt.paymentMethod', 'Method')}:</span>
                    <span className="capitalize">{t(`payments.${methodKey}`, methodKey)}</span>
                </div>
                <div className="flex justify-between">
                    <span>{t('receipt.paidBy', 'Issued By')}:</span>
                    <span>{staffName}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-100 pt-2 mt-2">
                    <span>{t('receipt.amountPaid', 'Amount')}:</span>
                    <span>{formatMoney(paidNow, i18n.language, currencyConf)}</span>
                </div>
            </div>

            {payment.notes && (
                <div className="mb-4 text-xs">
                    <div className="font-bold mb-1">{t('receipt.notes', 'Notes')}:</div>
                    <div className="text-gray-700 whitespace-pre-wrap">{payment.notes}</div>
                </div>
            )}

            <div className="border-b border-dashed border-gray-300 mb-4"></div>

            {/* Footer */}
            <div className="text-center text-xs space-y-1">
                <p>
                    <span className="font-bold">{t('receipt.paidBy', 'Issued By')}: </span>
                    {staffName}
                </p>
                <div className="mt-6 pt-4 border-t border-gray-100">
                    <p className="font-bold italic">{t('receipt.thankYou', 'Thank you for chosen us!')}</p>
                    <p className="mt-1 opacity-50 text-[10px]">{new Date().toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
});

/**
 * 2️⃣ REFUND RECEIPT (Thermal 80mm style)
 * Printed AFTER each refund action.
 * Represents ONLY the current refund action.
 */
export const RefundReceipt = forwardRef(({ payment, refund, currencyConf }, ref) => {
    const { t, i18n } = useTranslation();

    if (!payment || !refund) return null;

    const remainingAfter = payment.amount - (payment.refundedTotal || 0);

    return (
        <div ref={ref} className="p-8 bg-white text-black font-mono text-sm max-w-[80mm] mx-auto print:p-0 print:max-w-none">
            {/* Header */}
            <div className="text-center mb-4 border-b border-solid border-black pb-4">
                <h2 className="text-xl font-bold uppercase text-red-600">{t('receipt.refundTitle', 'REFUND RECEIPT')}</h2>
                <p className="text-xs mt-1 text-gray-600">#{payment.receiptNumber}</p>
            </div>

            {/* Refund Action Details */}
            <div className="text-center my-6 space-y-1">
                <p className="text-xs text-gray-500 uppercase font-bold">{t('receipt.refundAmount', 'THIS REFUND AMOUNT')}</p>
                <h1 className="text-3xl font-black">{formatCurrency(refund.amount, i18n.language, currencyConf)}</h1>
                <p className="text-xs opacity-60">{formatDateTime(refund.createdAt, i18n.language)}</p>
            </div>

            <div className="border-b border-dashed border-gray-300 mb-4"></div>

            {/* Member Info */}
            <div className="mb-4 space-y-1">
                <div className="flex justify-between">
                    <span className="font-bold">{t('receipt.memberName', 'Member')}:</span>
                    <span>{payment.member?.firstName} {payment.member?.lastName}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span>{t('receipt.memberId', 'ID')}:</span>
                    <span>{payment.member?.memberId}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-gray-300 mb-4 text-xs">
                <div className="flex justify-between mb-1 opacity-60">
                    <span>{t('receipt.originalPaid', 'Original Paid')}:</span>
                    <span>{formatCurrency(payment.amount, i18n.language, currencyConf)}</span>
                </div>
                <div className="flex justify-between mb-2">
                    <span className="font-bold">{t('receipt.remainingBalance', 'Remaining Balance')}:</span>
                    <span className="font-bold">{formatCurrency(remainingAfter, i18n.language, currencyConf)}</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs space-y-2 mt-4">
                <p>
                    <span className="font-bold">{t('receipt.refundedBy', 'Refunded By')}: </span>
                    {refund.user ? `${refund.user.firstName} ${refund.user.lastName}` : (payment.collectorName || 'System')}
                </p>
                {refund.reason && (
                    <p className="text-[10px] italic pt-2 border-t border-gray-50">
                        {t('receipt.reason', 'Reason')}: {refund.reason}
                    </p>
                )}
            </div>

            <div className="mt-8 text-center text-[10px] opacity-40 uppercase tracking-tighter">
                {t('receipt.auditCopy', 'Audit Copy - Valid Transaction')}
            </div>
        </div>
    );
});

/**
 * 3️⃣ SALES RECEIPT (POS)
 * Printed after a POS sale.
 * Lists items purchased.
 */
export const SalesReceipt = forwardRef(({ sale, currencyConf }, ref) => {
    const { t, i18n } = useTranslation();

    if (!sale) return null;

    return (
        <div ref={ref} className="p-8 bg-white text-black font-mono text-sm max-w-[80mm] mx-auto print:p-0 print:max-w-none">
            {/* Header */}
            <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
                <h2 className="text-xl font-bold uppercase tracking-wider">{t('receipt.companyName', 'GYM MARKET')}</h2>
                <p className="text-xs mt-1 text-gray-600">{t('receipt.salesTitle', 'SALES RECEIPT')}</p>
            </div>

            {/* Receipt Info */}
            <div className="flex justify-between mb-4 text-xs">
                <span>{t('receipt.date', 'Date')}:</span>
                <span>{formatDateTime(sale.createdAt, i18n.language)}</span>
            </div>

            <div className="border-b border-black mb-2"></div>

            {/* Items */}
            <div className="mb-4 space-y-2">
                {sale.items?.map((item, idx) => (
                    <div key={idx} className="flex flex-col text-xs">
                        <span className="font-bold">{item.product?.name || `Item #${item.productId}`}</span>
                        <div className="flex justify-between pl-2 text-gray-600">
                            <span>{item.quantity} x {formatCurrency(item.unitPrice, i18n.language, currencyConf)}</span>
                            <span className="text-black font-medium">{formatCurrency(item.lineTotal || (item.quantity * item.unitPrice), i18n.language, currencyConf)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-b border-black mb-2"></div>

            {/* Financials */}
            <div className="mb-6 space-y-1">
                <div className="flex justify-between text-lg font-bold">
                    <span>{t('receipt.total', 'TOTAL')}:</span>
                    <span>{formatCurrency(sale.totalAmount, i18n.language, currencyConf)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>{t('receipt.paymentMethod', 'Paid by')}:</span>
                    <span className="capitalize">{t(`payments.${sale.paymentMethod}`)}</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs space-y-1 pt-4 border-t border-dashed border-gray-300">
                <p>
                    <span className="font-bold">{t('receipt.servedBy', 'Served By')}: </span>
                    {sale.employee ? `${sale.employee.firstName} ${sale.employee.lastName}` : 'Staff'}
                </p>
                <div className="mt-4">
                    <p className="font-bold italic">{t('receipt.thankYou', 'Thank you for shopping!')}</p>
                </div>
            </div>
        </div>
    );
});
