import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../utils/dateFormatter';
import { formatMoney } from '../../utils/numberFormatter';

const ThermalReceipt = forwardRef(({ receipt, currencyConf, gymName, gymPhone, isCopy = false }, ref) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    if (!receipt) return null;

    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const totals = receipt.totals || {};
    const customerName = receipt.customerName || t('receipt.walkIn', 'Walk-in Customer');
    const methodKey = String(receipt.paymentMethod || 'cash').toLowerCase();
    const receiptDate = receipt.createdAt || receipt.date;

    return (
        <div
            ref={ref}
            dir={isRtl ? 'rtl' : 'ltr'}
            className="relative p-6 bg-white text-black font-mono text-[11px] max-w-[80mm] mx-auto print:p-0 print:max-w-none"
        >
            {isCopy && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 text-4xl font-black tracking-widest text-slate-500 rotate-[-15deg]">
                    {t('receipt.copy', 'COPY')}
                </div>
            )}

            <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-3">
                <h2 className="text-lg font-bold uppercase tracking-wider">
                    {gymName || t('receipt.companyName', 'GYM MANAGEMENT')}
                </h2>
                {gymPhone && (
                    <p className="text-[10px] text-gray-600">{gymPhone}</p>
                )}
                <p className="text-[10px] mt-1 text-gray-600">{t('receipt.title', 'Receipt')}</p>
            </div>

            <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                    <span className="font-bold">{t('receipt.number', 'Receipt #')}:</span>
                    <span>{receipt.receiptNo}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-bold">{t('receipt.transactionId', 'Transaction')}:</span>
                    <span>{receipt.transactionId}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-bold">{t('receipt.date', 'Date')}:</span>
                    <span>{formatDateTime(receiptDate, i18n.language)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-bold">{t('receipt.staff', 'Cashier')}:</span>
                    <span>{receipt.staffName || 'System'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-bold">{t('receipt.paymentMethod', 'Method')}:</span>
                    <span className="capitalize">{t(`payments.${methodKey}`, methodKey)}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-gray-300 my-3"></div>

            <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                    <span className="font-bold">{t('receipt.customer', 'Customer')}:</span>
                    <span>{customerName}</span>
                </div>
                {receipt.customerCode && (
                    <div className="flex justify-between text-[10px]">
                        <span>{t('receipt.memberId', 'ID')}:</span>
                        <span>{receipt.customerCode}</span>
                    </div>
                )}
                {receipt.customerPhone && (
                    <div className="flex justify-between text-[10px]">
                        <span>{t('receipt.phone', 'Phone')}:</span>
                        <span>{receipt.customerPhone}</span>
                    </div>
                )}
            </div>

            <div className="border-b border-dashed border-gray-300 my-3"></div>

            <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    {t('receipt.items', 'Items')}
                </div>
                <div className="space-y-2">
                    {items.length === 0 ? (
                        <div className="text-[10px] text-gray-500">
                            {t('receipt.noItems', 'No items')}
                        </div>
                    ) : items.map((item, idx) => (
                        <div key={`${item.name}-${idx}`} className="text-[10px]">
                            <div className="font-bold">{item.name}</div>
                            {item.type === 'subscription' && (item.duration || item.startDate || item.endDate) && (
                                <div className="text-[9px] text-gray-500">
                                    {item.duration ? `${item.duration} ${t('common.days', 'days')}` : ''}
                                    {item.startDate && item.endDate && (
                                        <>
                                            {' | '}
                                            {formatDateTime(item.startDate, i18n.language)} - {formatDateTime(item.endDate, i18n.language)}
                                        </>
                                    )}
                                </div>
                            )}
                            <div className="flex justify-between text-gray-600">
                                <span>
                                    {item.qty} x {formatMoney(item.unitPrice || 0, i18n.language, currencyConf)}
                                </span>
                                <span className="text-black font-medium">
                                    {formatMoney(item.lineTotal || 0, i18n.language, currencyConf)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-b border-dashed border-gray-300 my-3"></div>

            <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                    <span>{t('receipt.subtotal', 'Subtotal')}:</span>
                    <span>{formatMoney(totals.subtotal || 0, i18n.language, currencyConf)}</span>
                </div>
                <div className="flex justify-between">
                    <span>{t('receipt.discount', 'Discount')}:</span>
                    <span>{formatMoney(totals.discount || 0, i18n.language, currencyConf)}</span>
                </div>
                <div className="flex justify-between">
                    <span>{t('receipt.tax', 'Tax')}:</span>
                    <span>{formatMoney(totals.tax || 0, i18n.language, currencyConf)}</span>
                </div>
                <div className="flex justify-between font-bold text-[12px] border-t border-gray-200 pt-2 mt-2">
                    <span>{t('receipt.total', 'TOTAL')}:</span>
                    <span>{formatMoney(totals.total || 0, i18n.language, currencyConf)}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>{t('receipt.paid', 'PAID')}:</span>
                    <span>{formatMoney(totals.paid || 0, i18n.language, currencyConf)}</span>
                </div>
                <div className="flex justify-between">
                    <span>{t('receipt.remaining', 'Remaining')}:</span>
                    <span>{formatMoney(totals.remaining || 0, i18n.language, currencyConf)}</span>
                </div>
                <div className="flex justify-between">
                    <span>{t('receipt.change', 'Change')}:</span>
                    <span>{formatMoney(totals.change || 0, i18n.language, currencyConf)}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-gray-300 my-3"></div>

            <div className="text-center text-[10px] space-y-1">
                <p className="font-bold">{t('receipt.thankYou', 'Thank you!')}</p>
                <p className="text-gray-500">{new Date().toLocaleString()}</p>
            </div>
        </div>
    );
});

export default ThermalReceipt;
