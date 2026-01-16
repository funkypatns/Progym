import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../utils/api';
import toast from 'react-hot-toast';
import { X, Search, Check, User, Crown } from 'lucide-react';

const AssignPlanModal = ({ open, onClose, onSuccess, initialMember = null }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [memberSearch, setMemberSearch] = useState('');
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(initialMember);
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setStep(initialMember ? 2 : 1);
            fetchPlans();
        } else {
            reset();
        }
    }, [open, initialMember]);

    const reset = () => {
        setStep(1);
        setMemberSearch('');
        setMembers([]);
        setSelectedMember(initialMember || null);
        setSelectedPlan(null);
    };

    const fetchPlans = async () => {
        try {
            const res = await apiClient.get('/plans?active=true');
            if (res.data.success) setPlans(res.data.data);
        } catch (e) { console.error(e); }
    };

    const searchMembers = async (q) => {
        setMemberSearch(q);
        if (q.length > 1) {
            try {
                const res = await apiClient.get(`/members?search=${q}`);
                const data = res.data.success ? (Array.isArray(res.data.data) ? res.data.data : res.data.data.docs) : [];
                const filtered = data.filter(m =>
                    m.firstName.toLowerCase().includes(q.toLowerCase()) ||
                    m.lastName.toLowerCase().includes(q.toLowerCase())
                );
                setMembers(filtered);
            } catch (e) {
                setMembers([]);
            }
        }
    };

    const handleAssign = async () => {
        if (!selectedMember || !selectedPlan) return;
        setLoading(true);
        try {
            await apiClient.post('/subscriptions', {
                memberId: selectedMember.id,
                planId: selectedPlan.id,
                startDate: new Date().toISOString()
            });
            toast.success(t('subscriptions.success') || "Subscription Assigned");
            onSuccess();
            onClose();
        } catch (e) {
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity" dir="rtl">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
                    <div>
                        <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                            <Crown className="text-yellow-500" size={24} /> {t('subscriptions.assignSubscription')}
                        </h3>
                        {selectedMember && step === 2 && (
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">
                                {t('subscriptions.member')}: {selectedMember.firstName} {selectedMember.lastName}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"><X size={20} className="text-gray-500" /></button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {step === 1 && !initialMember && (
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300">{t('members.searchPlaceholder')}</h4>
                            <div className="relative">
                                <Search className="absolute right-3 top-3.5 text-gray-400" size={20} />
                                <input
                                    className="w-full pr-10 pl-4 py-3 border rounded-xl text-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm transition-all"
                                    placeholder={t('common.search') + "..."}
                                    value={memberSearch}
                                    onChange={e => searchMembers(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2 max-h-[400px] overflow-auto pl-2">
                                {members.map(m => (
                                    <div key={m.id} onClick={() => { setSelectedMember(m); setStep(2); }}
                                        className="p-3 border rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 cursor-pointer dark:border-gray-700 transition-all group flex items-center gap-3"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                            {m.firstName[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold dark:text-white group-hover:text-blue-700 transition-colors">{m.firstName} {m.lastName}</div>
                                            <div className="text-xs text-gray-500">{m.phone}</div>
                                        </div>
                                    </div>
                                ))}
                                {memberSearch.length > 1 && members.length === 0 && (
                                    <div className="text-center py-10 text-gray-400">{t('common.noData')}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-gray-700 dark:text-gray-300">{t('subscriptions.plans')}</h4>
                                {!initialMember && (
                                    <button onClick={() => setStep(1)} className="text-xs font-bold text-blue-600 hover:underline">{t('common.edit')}</button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-auto pl-2">
                                {plans.map(p => (
                                    <div key={p.id}
                                        onClick={() => setSelectedPlan(p)}
                                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all relative ${selectedPlan?.id === p.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md transform scale-[1.02]'
                                                : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        {selectedPlan?.id === p.id && (
                                            <div className="absolute top-2 left-2 text-blue-600"><Check size={20} /></div>
                                        )}
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-lg dark:text-white">{p.name}</span>
                                            <span className="font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded text-sm">{p.price} EGP</span>
                                        </div>
                                        <div className="text-sm text-gray-500">{p.duration} {t('common.days')}  •  {p.description}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-medium text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition">{t('common.cancel')}</button>
                    {step === 2 && (
                        <button
                            onClick={handleAssign}
                            disabled={!selectedPlan || loading}
                            className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
                        >
                            {loading ? t('common.loading') : t('common.confirm')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
export default AssignPlanModal;
