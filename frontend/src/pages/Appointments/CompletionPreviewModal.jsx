import React, { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, X, DollarSign, Calculator, AlertCircle } from 'lucide-react';

const CompletionPreviewModal = ({ open, onClose, onConfirm, data, loading }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';
    const lang = isRtl ? 'ar' : 'en';

    const texts = {
        ar: {
            confirm: 'تأكيد الإكمال والتحصيل',
            cancel: 'إلغاء',
            service: 'الخدمة',
            paidSession: 'جلسة مدفوعة',
            freeSession: 'جلسة مجانية',
            coach: 'المدرب',
            financialImpact: 'الآثار المالية',
            sessionPrice: 'سعر الجلسة',
            commissionRule: 'قاعدة العمولة',
            fixedRate: 'معدل ثابت',
            gymNetIncome: 'صافي النادي',
            trainerGets: 'نصيب المدرب',
            gymGets: 'نصيب النادي',
            completionDisclaimer: 'ستُسجل هذه الجلسة بعد تأكيد الدفع الكامل.',
            paymentRequired: 'الدفع مطلوب',
            remaining: 'المتبقي',
            fullPayment: 'الدفع بالكامل',
            partialPayment: 'جزئي (غير مسموح للجلسات الفردية)',
            method: 'طريقة الدفع',
            methodCash: 'نقداً',
            methodCard: 'بطاقة',
            methodTransfer: 'تحويل',
            amount: 'المبلغ',
            notes: 'ملاحظات',
            amountMessage: 'المبلغ المطلوب تحصيله: كامل قيمة الجلسة',
            paymentHeading: 'الدفع'
        },
        en: {
            confirm: 'Confirm completion & collect',
            cancel: 'Cancel',
            service: 'Service',
            paidSession: 'Paid Session',
            freeSession: 'Free Session',
            coach: 'Coach',
            financialImpact: 'Financial Impact',
            sessionPrice: 'Session Price',
            commissionRule: 'Commission Rule',
            fixedRate: 'Fixed Rate',
            gymNetIncome: 'Gym Net Income',
            trainerGets: 'Trainer gets',
            gymGets: 'Gym gets',
            completionDisclaimer: 'This session will be recorded after confirming payment.',
            paymentRequired: 'Payment required',
            remaining: 'Remaining',
            fullPayment: 'Full Payment',
            partialPayment: 'Partial Payment',
            method: 'Payment method',
            methodCash: 'Cash',
            methodCard: 'Card',
            methodTransfer: 'Transfer',
            amount: 'Amount',
            notes: 'Notes',
            amountMessage: 'Amount to collect: Full session price',
            paymentHeading: 'Payment'
        }
    };

    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentType, setPaymentType] = useState('full'); // full, partial
    const [paymentAmount, setPaymentAmount] = useState(0);

    const defaultAmount = useMemo(() => data ? (data.remainingAmount ?? data.sessionPrice ?? 0) : 0, [data]);

    useEffect(() => {
        if (open && data) {
            setPaymentMethod('cash');
            setPaymentNotes('');
            setPaymentType('full');
            setPaymentAmount(defaultAmount);
        }
    }, [open, data, defaultAmount]);

    const resetState = useCallback(() => {
        setPaymentMethod('cash');
        setPaymentNotes('');
        setPaymentType('full');
        setPaymentAmount(defaultAmount);
    }, [defaultAmount]);

    if (!data) return null;

    const needsPayment = !data.isPaid && data.sessionPrice > 0;
    const isSession = Boolean(data.isSession && !data.isSubscription);
    const remainingAmount = data.remainingAmount ?? data.sessionPrice ?? 0;
    const trainerPayout = Number(data.trainerPayout ?? data.commissionAmount ?? data.coachCommission ?? 0) || 0;
    const gymShare = Number(data.gymShare ?? data.gymNetIncome ?? 0) || 0;
    const commissionPercentUsed = Number(data.commissionPercentUsed ?? data.commissionValue ?? 0) || 0;

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleConfirm = () => {
        const payload = {
            payment: needsPayment ? {
                amount: paymentAmount,
                method: paymentMethod,
                notes: paymentNotes
            } : null
        };
        onConfirm(payload);
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-[60]" onClose={handleClose}>
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className={`w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-emerald-500/30 p-6 text-left align-middle shadow-2xl transition-all ${isRtl ? 'text-right' : ''}`}>

                            <div className="flex items-center gap-3 text-emerald-500 mb-4">
                                <div className="p-3 bg-emerald-500/10 rounded-full">
                                    <CheckCircle size={24} />
                                </div>
                                <Dialog.Title as="h3" className="text-xl font-black uppercase tracking-tight text-white">
                                    {texts[lang].confirm}
                                </Dialog.Title>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">{t('appointments.service', texts[lang].service)}</span>
                                        <span className="text-white font-bold">{data.sessionPrice > 0 ? t('appointments.paidSession', texts[lang].paidSession) : t('appointments.freeSession', texts[lang].freeSession)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">{t('appointments.coach', texts[lang].coach)}</span>
                                        <span className="text-white font-bold">{data.coachName}</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-800 p-3 rounded-lg">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                    <p>{t('appointments.completionDisclaimer', texts[lang].completionDisclaimer)}</p>
                                </div>
                                {isSession && (
                                    <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5 space-y-3">
                                        <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                                            {t('appointments.financialImpact', texts[lang].financialImpact)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-slate-500 text-xs">{texts[lang].trainerGets}</span>
                                                <span className="text-white font-bold">{trainerPayout.toFixed(2)}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-slate-500 text-xs">{texts[lang].gymGets}</span>
                                                <span className="text-white font-bold">{gymShare.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                            {texts[lang].commissionRule}: {commissionPercentUsed}%
                                        </div>
                                    </div>
                                )}
                            </div>

                            {needsPayment && (
                                <div className="mt-4 p-4 bg-slate-800 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-xs tracking-wider">
                                            <DollarSign size={14} />
                                            {t('appointments.paymentRequired', texts[lang].paymentRequired)}
                                        </div>
                                        {!isSession && (
                                            <div className="text-xs text-slate-400">
                                                {t('payments.remaining', texts[lang].remaining)}: <span className="text-white font-mono">{remainingAmount.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {isSession ? (
                                        <div className="space-y-3">
                                            <div className="text-sm font-semibold text-white">{texts[lang].amountMessage}</div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-slate-500 font-bold">{texts[lang].method}</label>
                                                    <select
                                                        value={paymentMethod}
                                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                                    >
                                                        <option value="cash">{texts[lang].methodCash}</option>
                                                        <option value="card">{texts[lang].methodCard}</option>
                                                        <option value="transfer">{texts[lang].methodTransfer}</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-slate-500 font-bold">{texts[lang].amount}</label>
                                                    <input
                                                        type="number"
                                                        value={paymentAmount}
                                                        readOnly
                                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <input
                                                    type="text"
                                                    value={paymentNotes}
                                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                                    placeholder={texts[lang].notes}
                                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex bg-slate-900 p-1 rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => { setPaymentType('full'); setPaymentAmount(data.remainingAmount || 0); }}
                                                    className={`flex-1 py-1 text-xs font-bold rounded-md transition ${paymentType === 'full' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                                                >
                                                    {t('payments.fullPayment', texts[lang].fullPayment)}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPaymentType('partial')}
                                                    className={`flex-1 py-1 text-xs font-bold rounded-md transition ${paymentType === 'partial' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                                                >
                                                    {t('payments.partialPayment', texts[lang].partialPayment)}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-slate-500 font-bold">{t('payments.method', texts[lang].method)}</label>
                                                    <select
                                                        value={paymentMethod}
                                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                                    >
                                                        <option value="cash">{texts[lang].methodCash}</option>
                                                        <option value="card">{texts[lang].methodCard}</option>
                                                        <option value="transfer">{texts[lang].methodTransfer}</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-slate-500 font-bold">{t('payments.amount', texts[lang].amount)}</label>
                                                    <input
                                                        type="number"
                                                        disabled={paymentType === 'full'}
                                                        min="0"
                                                        max={data.remainingAmount}
                                                        step="0.01"
                                                        value={paymentAmount}
                                                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                                                        className={`w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none ${paymentType === 'full' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <input
                                                    type="text"
                                                    value={paymentNotes}
                                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                                    placeholder={texts[lang].notes}
                                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={loading}
                                    className="flex-[2] px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-900/20 flex justify-center items-center gap-2"
                                >
                                    {loading ? t('common.processing') : texts[lang].confirm}
                                </button>
                            </div>

                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default CompletionPreviewModal;
