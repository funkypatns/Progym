import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';

const TrainerPayoutModal = ({ open, onClose, trainer, onSuccess }) => {
    const { i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [method, setMethod] = useState('CASH');
    const [note, setNote] = useState('');
    const [earningsData, setEarningsData] = useState({
        totals: { unpaidAmount: 0, unpaidCount: 0, paidAmount: 0, paidCount: 0 },
        earnings: []
    });

    useEffect(() => {
        if (open && trainer?.id) {
            fetchUnpaidEarnings();
        }
    }, [open, trainer]);

    const fetchUnpaidEarnings = async () => {
        if (!trainer?.id) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/staff-trainers/${trainer.id}/earnings`, {
                params: { status: 'UNPAID' }
            });
            if (res.data.success) {
                setEarningsData(res.data.data);
            }
        } catch (error) {
            toast.error('Failed to load unpaid earnings');
        } finally {
            setLoading(false);
        }
    };

    const unpaidAmount = earningsData?.totals?.unpaidAmount || 0;
    const unpaidCount = earningsData?.totals?.unpaidCount || 0;
    const earnings = earningsData?.earnings || [];

    const handleConfirm = async () => {
        if (!trainer?.id || unpaidAmount <= 0) return;
        setSubmitting(true);
        try {
            const earningIds = earnings.map(item => item.id);
            const res = await apiClient.post(`/staff-trainers/${trainer.id}/payout`, {
                method,
                note,
                earningIds
            });
            if (res.data.success) {
                toast.success(isRtl ? 'تم سداد المستحقات بنجاح' : 'Payout completed');
                onSuccess?.();
                onClose();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create payout');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl transition-all">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900">
                                <div>
                                    <Dialog.Title as="h3" className="text-xl font-black text-white uppercase tracking-tight">
                                        {isRtl ? 'سداد مستحقات المدرب' : 'Trainer Payout'}
                                    </Dialog.Title>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                        {trainer?.name || 'Trainer'}
                                    </p>
                                </div>
                                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-bold text-amber-400 uppercase">{isRtl ? 'إجمالي غير مسدد' : 'Unpaid Total'}</div>
                                        <div className="text-2xl font-black text-white">{unpaidAmount.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-500 mt-1">{unpaidCount} {isRtl ? 'جلسة' : 'sessions'}</div>
                                    </div>
                                    <DollarSign size={28} className="text-amber-400" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{isRtl ? 'طريقة السداد' : 'Payment Method'}</label>
                                    <select
                                        value={method}
                                        onChange={e => setMethod(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-white text-sm"
                                    >
                                        <option value="CASH">{isRtl ? 'نقداً' : 'Cash'}</option>
                                        <option value="TRANSFER">{isRtl ? 'تحويل' : 'Transfer'}</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{isRtl ? 'ملاحظة' : 'Note'}</label>
                                    <textarea
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none"
                                        placeholder={isRtl ? 'ملاحظة اختيارية...' : 'Optional note...'}
                                    />
                                </div>

                                <div className="text-xs text-slate-500">
                                    {isRtl ? 'سيتم سداد كل المستحقات غير المسددة.' : 'All unpaid earnings will be settled.'}
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/5 bg-slate-900 flex items-center justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition"
                                >
                                    {isRtl ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={submitting || unpaidAmount <= 0 || loading}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${submitting || unpaidAmount <= 0 || loading ? 'bg-amber-500/30 text-amber-200 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400'}`}
                                >
                                    {submitting ? '...' : (isRtl ? 'تأكيد السداد' : 'Confirm Payout')}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default TrainerPayoutModal;
