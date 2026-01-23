import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';
import {
    X, Search, Check, CreditCard, User, Banknote, Camera,
    Smartphone, ScanLine, Clock, ChevronRight, UserCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const AddPaymentDialog = ({ open, onClose, onSuccess, initialMember, initialSubscriptionId }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';

    // -- State --
    const [step, setStep] = useState(initialMember ? 2 : 1);

    // Search
    const [memberSearch, setMemberSearch] = useState('');
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Selection
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberSubscriptions, setMemberSubscriptions] = useState([]);
    const [type, setType] = useState('subscription');
    const [selectedSubscriptionId, setSelectedSubscriptionId] = useState('');

    // Payment Details
    const [totalDue, setTotalDue] = useState(0);
    const [paymentMode, setPaymentMode] = useState('full');
    const [payNowAmount, setPayNowAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [transactionRef, setTransactionRef] = useState('');

    // Camera
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef(null);
    const [cameraStream, setCameraStream] = useState(null);

    // Metadata
    const [loading, setLoading] = useState(false);

    // -- Effects --
    useEffect(() => {
        if (open) {
            if (initialMember) {
                setSelectedMember(initialMember);
                setStep(2);
            } else {
                fetchInitialMembers();
            }
        } else {
            resetForm();
        }
    }, [open, initialMember]);

    useEffect(() => {
        if (open && initialSubscriptionId && memberSubscriptions.length > 0) {
            const initialSub = memberSubscriptions.find(s => s.id === parseInt(initialSubscriptionId));
            if (initialSub) {
                handleSubscriptionSelect(initialSub);
            }
        }
    }, [open, initialSubscriptionId, memberSubscriptions]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (memberSearch.trim().length > 0) performSearch(memberSearch);
            else if (memberSearch.trim().length === 0 && open) fetchInitialMembers();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [memberSearch]);

    useEffect(() => {
        if (selectedMember && step === 2) {
            fetchMemberSubscriptions(selectedMember.id);
        }
    }, [selectedMember, step]);

    useEffect(() => {
        if (paymentMode === 'full') {
            setPayNowAmount(totalDue > 0 ? totalDue.toString() : '');
        }
    }, [totalDue, paymentMode]);

    useEffect(() => {
        if (showCamera) startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [showCamera]);

    // -- Logic --
    const resetForm = () => {
        setStep(initialMember ? 2 : 1);
        setMemberSearch('');
        setMembers([]);
        setSelectedMember(initialMember || null);
        setMemberSubscriptions([]);
        setSelectedSubscriptionId('');
        setTotalDue(0);
        setPaymentMode('full');
        setPayNowAmount('');
        setMethod('cash');
        setTransactionRef('');
        setLoading(false);
        setShowCamera(false);
    };

    const fetchInitialMembers = async () => {
        setLoadingMembers(true);
        try {
            const res = await apiClient.get('/members?limit=10');
            if (res.data.success) {
                const data = res.data.data;
                const list = Array.isArray(data) ? data : (data.members || data.docs || []);
                setMembers(list);
            }
        } catch (e) { console.error(e); }
        finally { setLoadingMembers(false); }
    };

    const performSearch = async (q) => {
        setLoadingMembers(true);
        try {
            const res = await apiClient.get(`/members/search/${encodeURIComponent(q)}`);
            if (res.data.success) setMembers(res.data.data || []);
        } catch (e) { setMembers([]); }
        finally { setLoadingMembers(false); }
    };

    const fetchMemberSubscriptions = async (memberId) => {
        try {
            setLoading(true);
            const res = await apiClient.get(`/subscriptions?memberId=${memberId}`);
            if (res.data.success) setMemberSubscriptions(res.data.data.subscriptions || []);
        } catch (error) { toast.error(t('errors.fetchSubscriptions')); }
        finally { setLoading(false); }
    };

    const handleSubscriptionSelect = (sub) => {
        setSelectedSubscriptionId(sub.id);
        const price = sub.price || sub.plan?.price || 0;
        const paid = sub.paidAmount || 0;
        const remaining = Math.max(0, price - paid);
        setTotalDue(remaining);
        setPayNowAmount(remaining.toString());
        setPaymentMode(paid > 0 ? 'partial' : 'full');
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setCameraStream(stream);
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            toast.error("Could not access camera");
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
    };

    const handleSimulateScan = () => {
        const mockRef = "TXN-" + Math.floor(Math.random() * 100000);
        toast.success("Scanned!", { icon: '📷' });
        setTransactionRef(mockRef);
        if (method === 'cash') setMethod('card');
        setShowCamera(false);
    };

    const handleSubmit = async () => {
        if (!selectedMember || !payNowAmount) return;
        if ((method === 'card' || method === 'transfer') && !transactionRef.trim()) {
            toast.error(t('payments.refRequired', 'Transaction Ref is required'));
            return;
        }

        setLoading(true);
        try {
            const payload = {
                memberId: selectedMember.id,
                amount: parseFloat(payNowAmount),
                method,
                type,
                transactionRef: transactionRef || undefined,
                date: new Date().toISOString()
            };

            if (type === 'subscription' && selectedSubscriptionId) {
                payload.subscriptionId = parseInt(selectedSubscriptionId);
            }

            await apiClient.post('/payments', payload);
            toast.success(t('payments.paymentRecorded'));
            if (onSuccess) onSuccess();
            onClose();
        } catch (e) {
            const msg = e.response?.data?.message || t('common.error');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    const renderCamera = () => (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
            <button onClick={() => setShowCamera(false)} className="absolute top-6 right-6 p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition"><X size={24} /></button>
            <div className="w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden relative border border-gray-800 shadow-2xl">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center border-2 border-transparent pointer-events-none">
                    <div className="w-64 h-64 border-2 border-blue-500/50 rounded-2xl relative animate-pulse shadow-[0_0_100px_rgba(59,130,246,0.3)]"></div>
                </div>
            </div>
            <button onClick={handleSimulateScan} className="mt-8 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold flex items-center gap-3 shadow-lg shadow-blue-900/40 transition-all transform hover:scale-105">
                <ScanLine size={24} /> Simulate Scan
            </button>
        </div>
    );

    const activeSubscription = memberSubscriptions.find(s => s.id === parseInt(selectedSubscriptionId));

    return (
        <AnimatePresence>
            {showCamera && renderCamera()}

            <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/80 backdrop-blur-xl transition-all duration-300 ${isRtl ? 'font-sans-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-[440px] bg-[#1e293b] rounded-[24px] shadow-2xl overflow-hidden border border-white/5 flex flex-col max-h-[95vh]"
                >

                    {/* Header */}
                    <div className="p-6 pb-2 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Record Payment</h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Financial Transaction</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">

                        {/* STEP 1: Search */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-500`} size={18} />
                                    <input
                                        className={`w-full ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3.5 bg-slate-900/50 border border-white/5 focus:border-blue-500/50 rounded-2xl text-white placeholder-slate-600 outline-none transition-all`}
                                        placeholder="Search Member..."
                                        value={memberSearch}
                                        onChange={e => setMemberSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2 mt-2">
                                    {members.map(m => (
                                        <div key={m.id} onClick={() => { setSelectedMember(m); setStep(2); }}
                                            className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 cursor-pointer transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                                                    <UserCircle size={24} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm">{m.firstName} {m.lastName}</div>
                                                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{m.memberId}</div>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-600" />
                                        </div>
                                    ))}
                                    {members.length === 0 && !loadingMembers && (
                                        <div className="text-center py-10 opacity-30">
                                            <User size={32} className="mx-auto mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-widest">No members found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Details */}
                        {step === 2 && selectedMember && (
                            <div className="space-y-6">

                                {/* Unified Member & Sub Info */}
                                <div className="p-4 bg-slate-900/30 rounded-2xl border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500">
                                                <User size={18} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white uppercase tracking-tight">{selectedMember.firstName} {selectedMember.lastName}</div>
                                                <div className="text-[10px] font-bold text-slate-500 mb-0.5">{selectedMember.memberId}</div>
                                            </div>
                                        </div>
                                        {!initialMember && (
                                            <button onClick={() => setStep(1)} className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline px-2 py-1">Change</button>
                                        )}
                                    </div>

                                    {activeSubscription ? (
                                        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md uppercase tracking-tight border border-indigo-500/10">
                                                        {activeSubscription.plan?.name}
                                                    </span>
                                                    {totalDue > 0 ? (
                                                        <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-md uppercase tracking-tight border border-orange-500/10">DUE</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md uppercase tracking-tight border border-emerald-500/10">PAID</span>
                                                    )}
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                                    <Clock size={10} /> {new Date(activeSubscription.startDate).toLocaleDateString()} - {new Date(activeSubscription.endDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Remaining</div>
                                                <div className="text-sm font-black text-white">{totalDue.toLocaleString()} EGP</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-3 border-t border-white/5">
                                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center py-2">No active subscription selected</p>
                                        </div>
                                    )}
                                </div>

                                {/* Amount Selector */}
                                <div className="space-y-4">
                                    <div className="flex p-1 bg-slate-900/50 rounded-xl border border-white/5">
                                        <button onClick={() => setPaymentMode('full')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${paymentMode === 'full' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500'}`}>Full Payment</button>
                                        <button onClick={() => setPaymentMode('partial')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${paymentMode === 'partial' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500'}`}>Partial</button>
                                    </div>

                                    <div className="relative group bg-slate-950/30 rounded-3xl p-6 border-2 border-white/5 focus-within:border-blue-500/50 transition-all text-center">
                                        <label className="absolute top-4 left-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount to Pay</label>
                                        <div className="flex items-baseline justify-center gap-2 mt-2">
                                            <span className="text-xl font-black text-blue-500/50 tracking-tighter uppercase">EGP</span>
                                            <input
                                                type="number"
                                                className="bg-transparent border-none text-5xl font-black text-white outline-none w-full text-center placeholder-slate-800"
                                                value={payNowAmount}
                                                onChange={e => {
                                                    setPayNowAmount(e.target.value);
                                                    if (totalDue > 0) setPaymentMode('partial');
                                                }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        {totalDue > 0 && parseFloat(payNowAmount) > 0 && (
                                            <div className="mt-4 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
                                                Remaining After: <span className="text-orange-500 text-xs font-black">{(totalDue - parseFloat(payNowAmount)).toLocaleString()} EGP</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Methods */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'cash', label: 'Cash', icon: Banknote },
                                            { id: 'card', label: 'Card', icon: CreditCard },
                                            { id: 'transfer', label: 'Transfer', icon: Smartphone },
                                        ].map(m => (
                                            <button key={m.id} onClick={() => setMethod(m.id)}
                                                className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all ${method === m.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-900/40' : 'bg-slate-900/50 border-white/5 text-slate-500 hover:text-white hover:bg-slate-900'}`}>
                                                <m.icon size={20} strokeWidth={method === m.id ? 3 : 2} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <AnimatePresence>
                                        {(method === 'card' || method === 'transfer') && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="relative pt-2"
                                            >
                                                <input
                                                    className="w-full px-5 py-3.5 bg-slate-900/50 border border-white/5 rounded-2xl text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-blue-500/50 transition-all"
                                                    placeholder="Transaction Reference Number"
                                                    value={transactionRef}
                                                    onChange={e => setTransactionRef(e.target.value)}
                                                />
                                                <button onClick={() => setShowCamera(true)} className="absolute right-2 top-4 p-2 text-slate-500 hover:text-blue-400"><Camera size={18} /></button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/5 flex flex-col gap-3">
                        {step === 2 && (
                            <button
                                onClick={handleSubmit}
                                disabled={!payNowAmount || loading || ((method === 'card' || method === 'transfer') && !transactionRef)}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/40 transition-all flex justify-center items-center gap-2 active:scale-95"
                            >
                                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <div className="flex items-center gap-2 tracking-tighter font-black uppercase">Confirm Payment <Check size={18} strokeWidth={4} /></div>}
                            </button>
                        )}
                        <button onClick={onClose} className="w-full py-2 text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">
                            Cancel & Exit
                        </button>
                    </div>

                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddPaymentDialog;
