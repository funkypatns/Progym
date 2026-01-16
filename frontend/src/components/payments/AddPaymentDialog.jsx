import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Search, Check, CreditCard, User, Banknote, Calendar } from 'lucide-react';

const AddPaymentDialog = ({ open, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [memberSearch, setMemberSearch] = useState('');
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [type, setType] = useState('subscription');
    const [loading, setLoading] = useState(false);

    const searchMembers = async (q) => {
        setMemberSearch(q);
        if (q.length > 1) {
            try {
                const res = await apiClient.get(`/members?search=${q}`);
                const data = res.data.success ? (Array.isArray(res.data.data) ? res.data.data : res.data.data.docs) : [];
                const filtered = data.filter(m =>
                    m.firstName.toLowerCase().includes(q.toLowerCase()) ||
                    m.lastName.toLowerCase().includes(q.toLowerCase()) ||
                    m.phone?.includes(q)
                );
                setMembers(filtered);
            } catch (e) { console.error(e); }
        } else {
            setMembers([]);
        }
    };

    const handleSubmit = async () => {
        if (!selectedMember || !amount) return;
        setLoading(true);
        try {
            await apiClient.post('/payments', {
                memberId: selectedMember.id,
                amount: parseFloat(amount),
                method,
                type,
                date: new Date().toISOString()
            });
            toast.success(t('payments.paymentRecorded'));
            onSuccess();
            onClose();
            setStep(1); setSelectedMember(null); setAmount('');
        } catch (e) {
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300" dir="rtl">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="font-bold text-xl text-gray-900 dark:text-white">{t('payments.recordPayment')}</h3>
                        <p className="text-sm text-gray-500">{step} / 2</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('members.searchPlaceholder')}</label>
                                <div className="relative">
                                    <Search className="absolute right-3 top-3.5 text-gray-400 w-5 h-5" />
                                    <input
                                        className="w-full pr-10 pl-4 py-3 border rounded-xl text-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-shadow shadow-sm"
                                        placeholder={t('common.search') + "..."}
                                        value={memberSearch}
                                        onChange={e => searchMembers(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {members.map(m => (
                                    <div key={m.id}
                                        onClick={() => { setSelectedMember(m); setStep(2); }}
                                        className="flex items-center gap-4 p-4 border rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                            {m.firstName[0]}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600">{m.firstName} {m.lastName}</div>
                                            <div className="text-sm text-gray-500">{m.phone || 'No phone'}</div>
                                        </div>
                                        <User size={18} className="text-gray-300 group-hover:text-blue-400" />
                                    </div>
                                ))}
                                {memberSearch.length > 1 && members.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">{t('common.noData')}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && selectedMember && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-xl border border-blue-100 dark:border-blue-800">
                                <User size={20} />
                                <span className="font-medium">{t('members.memberDetails')}: <b>{selectedMember.firstName} {selectedMember.lastName}</b></span>
                                <button onClick={() => setStep(1)} className="mr-auto text-xs underline hover:text-blue-600">{t('common.edit')}</button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('payments.amount')} (EGP)</label>
                                <div className="relative">
                                    <span className="absolute right-4 top-3.5 text-gray-500 font-bold">EGP</span>
                                    <input
                                        type="number"
                                        className="w-full pr-14 pl-4 py-3 border-2 border-gray-200 rounded-xl text-2xl font-bold focus:border-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('payments.method')}</label>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => setMethod('cash')}
                                            className={`p-3 rounded-lg border flex items-center gap-2 font-medium transition-all ${method === 'cash' ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            <Banknote size={18} /> {t('payments.cash')}
                                        </button>
                                        <button
                                            onClick={() => setMethod('card')}
                                            className={`p-3 rounded-lg border flex items-center gap-2 font-medium transition-all ${method === 'card' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            <CreditCard size={18} /> {t('payments.card')}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('payInOut.type')}</label>
                                    <select
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={type}
                                        onChange={e => setType(e.target.value)}
                                    >
                                        <option value="subscription">{t('nav.subscriptions')}</option>
                                        <option value="product">Product</option>
                                        <option value="service">Service</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors">
                        {t('common.cancel')}
                    </button>
                    {step === 2 && (
                        <button
                            onClick={handleSubmit}
                            disabled={!amount || loading}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <Check size={18} />}
                            {t('common.confirm')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
export default AddPaymentDialog;
