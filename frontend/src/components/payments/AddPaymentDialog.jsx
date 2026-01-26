import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';
import {
    X, Search, Check, CreditCard, User, Banknote, Camera,
    Smartphone, ScanLine, Clock, ChevronRight, UserCircle, Printer, Eye, RotateCcw, CheckCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettingsStore } from '../../store';
import ThermalReceipt from '../receipts/ThermalReceipt';

const AddPaymentDialog = ({ open, onClose, onSuccess, initialMember, initialSubscriptionId }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';
    const { getSetting } = useSettingsStore();
    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };
    const gymName = getSetting('gym_name', t('receipt.companyName', 'GYM MANAGEMENT'));
    const gymPhone = getSetting('gym_phone', '');
    const roundMoney = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return Math.round((num + Number.EPSILON) * 100) / 100;
    };

    // -- State --
    const [step, setStep] = useState(initialMember ? 2 : 1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitLockRef = useRef(false);
    const partialSubmitRef = useRef(false);
    const successToastRef = useRef(false);
    const abortControllerRef = useRef(null);

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
    const [receiptData, setReceiptData] = useState(null);
    const [receiptStatus, setReceiptStatus] = useState('idle');
    const [receiptMessage, setReceiptMessage] = useState('');
    const [receiptCreated, setReceiptCreated] = useState(false);
    const [receiptTransactionId, setReceiptTransactionId] = useState('');
    const [receiptIsCopy, setReceiptIsCopy] = useState(false);
    const [hasPrintedReceipt, setHasPrintedReceipt] = useState(false);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [receiptLoading, setReceiptLoading] = useState(false);
    const [lastReceiptError, setLastReceiptError] = useState('');
    const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);

    // Camera
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef(null);
    const [cameraStream, setCameraStream] = useState(null);
    const receiptRef = useRef(null);

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
        if (memberSubscriptions.length === 1 && !selectedSubscriptionId) {
            handleSubscriptionSelect(memberSubscriptions[0]);
        }
    }, [memberSubscriptions, selectedSubscriptionId]);

    useEffect(() => {
        if (paymentMode === 'full') {
            setPayNowAmount(totalDue > 0 ? totalDue.toString() : '');
            return;
        }
        if (paymentMode === 'partial') {
            setPayNowAmount('');
        }
    }, [totalDue, paymentMode]);

    useEffect(() => {
        if (showCamera) startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [showCamera]);

    useEffect(() => {
        if (!autoPrintReceipt) return;
        if (!receiptData || !receiptRef.current) return;
        const timeoutId = setTimeout(() => {
            handlePrintReceipt();
            setHasPrintedReceipt(true);
            setAutoPrintReceipt(false);
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [autoPrintReceipt, receiptData]);

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
        setReceiptData(null);
        setReceiptStatus('idle');
        setReceiptMessage('');
        setReceiptCreated(false);
        setReceiptTransactionId('');
        setReceiptIsCopy(false);
        setHasPrintedReceipt(false);
        setShowReceiptPreview(false);
        setReceiptLoading(false);
        setLastReceiptError('');
        setAutoPrintReceipt(false);
        submitLockRef.current = false;
        successToastRef.current = false;
        partialSubmitRef.current = false;
        setIsSubmitting(false);
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
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
            if (res.data.success) {
                const rawSubs = res.data.data.subscriptions || [];
                const sorted = [...rawSubs].sort((a, b) => {
                    const rank = (s) => (s.status === 'active' ? 0 : 1);
                    const byStatus = rank(a) - rank(b);
                    if (byStatus !== 0) return byStatus;
                    const endA = a.endDate ? new Date(a.endDate).getTime() : 0;
                    const endB = b.endDate ? new Date(b.endDate).getTime() : 0;
                    return endB - endA;
                });
                setMemberSubscriptions(sorted);
            }
        } catch (error) { toast.error(t('errors.fetchSubscriptions')); }
        finally { setLoading(false); }
    };

    const getSubscriptionMeta = (sub) => {
        const total = roundMoney(Number.isFinite(sub.price) ? sub.price : (Number.isFinite(sub.plan?.price) ? sub.plan.price : 0));
        const paid = roundMoney(Number.isFinite(sub.paidAmount) ? sub.paidAmount : 0);
        const remaining = roundMoney(Math.max(0, total - paid));
        return { total, paid, remaining };
    };

    const handleSubscriptionSelect = (sub) => {
        setSelectedSubscriptionId(sub.id);
        const meta = getSubscriptionMeta(sub);
        setTotalDue(meta.remaining);
        setPaymentMode('full');
        setLastReceiptError('');
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

    const handlePrintReceipt = () => {
        if (!receiptRef.current) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.setAttribute('title', 'receipt-print');
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(node => node.outerHTML)
            .join('');
        const printStyles = `
            @page { margin: 12mm; }
            body { margin: 0; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        `;

        doc.open();
        doc.write(`<!doctype html><html><head>${styles}<style>${printStyles}</style></head><body dir="${isRtl ? 'rtl' : 'ltr'}">${receiptRef.current.innerHTML}</body></html>`);
        doc.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    };

    const fetchReceiptByTransaction = async () => {
        if (!receiptTransactionId) return null;
        setReceiptLoading(true);
        try {
            const res = await apiClient.post('/receipts/from-transaction', {
                transactionId: receiptTransactionId,
                type: 'payment'
            });
            if (res.data.success) {
                const payload = res.data.data || {};
                setReceiptData(payload.receipt || null);
                setReceiptStatus(payload.receiptStatus || 'ready');
                setReceiptMessage(payload.receiptMessage || '');
                setReceiptCreated(Boolean(payload.receiptCreated));
                setReceiptTransactionId(payload.transactionId || receiptTransactionId);
                setReceiptIsCopy(!payload.receiptCreated && Boolean(payload.receipt));
                return payload.receipt || null;
            }
            return null;
        } catch (err) {
            return null;
        } finally {
            setReceiptLoading(false);
        }
    };

    const handleCloseModal = () => {
        resetForm();
        submitLockRef.current = false;
        successToastRef.current = false;
        onClose();
    };

    const requestPrintReceipt = async () => {
        if (receiptStatus === 'not_initialized') {
            toast.error(receiptMessage || t('payments.receiptsNotReady', 'Receipts are not initialized.'));
            return;
        }
        let receipt = receiptData;
        if (!receipt) {
            receipt = await fetchReceiptByTransaction();
        }
        if (!receipt) {
            toast.error(t('payments.noReceiptAvailable', 'No receipt available'));
            return;
        }
        if (hasPrintedReceipt && !receiptIsCopy) {
            setReceiptIsCopy(true);
            setAutoPrintReceipt(true);
            return;
        }
        handlePrintReceipt();
        setHasPrintedReceipt(true);
    };

    const handleViewReceipt = async () => {
        if (receiptStatus === 'not_initialized') {
            toast.error(receiptMessage || t('payments.receiptsNotReady', 'Receipts are not initialized.'));
            return;
        }
        if (!receiptData) {
            const fetched = await fetchReceiptByTransaction();
            if (!fetched) {
                toast.error(t('payments.noReceiptAvailable', 'No receipt available'));
                return;
            }
        }
        setShowReceiptPreview(prev => !prev);
    };

    const handleNewPayment = () => {
        resetForm();
    };

    const fetchLatestReceipt = async (options = {}) => {
        const { autoPrint = false } = options;
        const query = selectedSubscriptionId
            ? `subscriptionId=${selectedSubscriptionId}`
            : (selectedMember?.id ? `memberId=${selectedMember.id}` : '');
        if (!query) return;
        setLastReceiptError('');
        setReceiptLoading(true);
        try {
            const res = await apiClient.get(`/payments/latest?${query}`);
            const payment = res.data?.data;
            if (!res.data.success || !payment?.id) {
                setReceiptData(null);
                setLastReceiptError(t('payments.noReceiptAvailable', 'No receipt available'));
                return;
            }

            const receiptRes = await apiClient.post('/receipts/from-transaction', {
                transactionId: payment.id,
                type: 'payment'
            });
            if (receiptRes.data.success) {
                const payload = receiptRes.data.data || {};
                setReceiptData(payload.receipt || null);
                setReceiptStatus(payload.receiptStatus || 'ready');
                setReceiptMessage(payload.receiptMessage || '');
                setReceiptCreated(Boolean(payload.receiptCreated));
                setReceiptTransactionId(payload.transactionId || '');
                setReceiptIsCopy(!payload.receiptCreated && Boolean(payload.receipt));
                setHasPrintedReceipt(false);
                setShowReceiptPreview(false);
                setStep(3);
                if (autoPrint && payload.receipt) setAutoPrintReceipt(true);
            } else {
                setReceiptData(null);
                setLastReceiptError(t('payments.noReceiptAvailable', 'No receipt available'));
            }
        } catch (err) {
            setReceiptData(null);
            setLastReceiptError(t('payments.noReceiptAvailable', 'No receipt available'));
        } finally {
            setReceiptLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (submitLockRef.current || isSubmitting) return;
        if (paymentMode === 'partial' && partialSubmitRef.current) return;
        submitLockRef.current = true;
        setIsSubmitting(true);
        setLoading(true);

        const abortSubmit = () => {
            submitLockRef.current = false;
            setIsSubmitting(false);
            setLoading(false);
            abortControllerRef.current = null;
        };

        try {
            if (!selectedMember) {
                abortSubmit();
                return;
            }
            setLastReceiptError('');
            if (!selectedSubscriptionId) {
                toast.error(t('payments.selectSubscription', 'Select a subscription first'));
                abortSubmit();
                return;
            }
            const amountValue = roundMoney(payNowAmount);
            if (!Number.isFinite(amountValue) || amountValue <= 0) {
                toast.error(t('payments.invalidAmount', 'Enter a valid amount'));
                abortSubmit();
                return;
            }
            if (totalDue <= 0) {
                toast.error(t('payments.alreadyPaid', 'Subscription is already fully paid'));
                abortSubmit();
                return;
            }
            if (amountValue > totalDue + 0.01) {
                toast.error(t('payments.amountExceedsRemaining', 'Amount exceeds remaining balance'));
                abortSubmit();
                return;
            }
            if ((method === 'card' || method === 'transfer') && !transactionRef.trim()) {
                toast.error(t('payments.refRequired', 'Transaction Ref is required'));
                abortSubmit();
                return;
            }

            const payload = {
                memberId: selectedMember.id,
                amount: amountValue,
                method,
                type,
                paymentMode,
                transactionRef: transactionRef || undefined,
                date: new Date().toISOString()
            };

            if (type === 'subscription') {
                payload.subscriptionId = parseInt(selectedSubscriptionId, 10);
            }

            abortControllerRef.current?.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;
            const idempotencyKey = window.crypto?.randomUUID?.() || `payment-${Date.now()}`;
            const res = await apiClient.post('/payments', payload, {
                headers: {
                    'Idempotency-Key': idempotencyKey
                },
                signal: controller.signal
            });
            if (!successToastRef.current) {
                toast.success(t('payments.paymentRecorded'));
                successToastRef.current = true;
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('payments:updated'));
            }
            if (onSuccess) onSuccess();

            const responseData = res.data?.data || {};
            const receipt = responseData.receipt || null;
            const status = responseData.receiptStatus || (receipt ? 'ready' : 'missing');
            setReceiptData(receipt);
            setReceiptStatus(status);
            setReceiptMessage(responseData.receiptMessage || '');
            setReceiptCreated(Boolean(responseData.receiptCreated));
            setReceiptTransactionId(responseData.transactionId || responseData.paymentId || responseData.id || '');
            setReceiptIsCopy(!responseData.receiptCreated && Boolean(receipt));
            setHasPrintedReceipt(false);
            setShowReceiptPreview(false);
            setStep(3);
            if (paymentMode === 'partial') {
                partialSubmitRef.current = true;
            }
        } catch (e) {
            const msg = e.response?.data?.message || t('common.error');
            toast.error(msg);
            abortSubmit();
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

    const renderReceipt = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">
                            {t('payments.successTitle', 'Payment successful')}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {t('payments.successSubtitle', 'Choose an action')}
                        </p>
                    </div>
                </div>
                {receiptData?.receiptNo && (
                    <span className="text-xs font-mono text-slate-400">{receiptData.receiptNo}</span>
                )}
            </div>

            {receiptStatus === 'not_initialized' && (
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                    {receiptMessage || t('payments.receiptsNotReady', 'Receipts are not initialized.')}
                </div>
            )}

            {receiptLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
            ) : showReceiptPreview && receiptData ? (
                <div className="bg-white rounded-2xl p-4">
                    <ThermalReceipt
                        receipt={receiptData}
                        currencyConf={currencyConf}
                        gymName={gymName}
                        gymPhone={gymPhone}
                        isCopy={receiptIsCopy}
                    />
                </div>
            ) : (!receiptData && receiptStatus !== 'not_initialized') ? (
                <div className="text-center text-xs text-slate-400">
                    {t('payments.receiptNotFound', 'Receipt not found')}
                </div>
            ) : null}

            {receiptData && (
                <div className="hidden">
                    <div ref={receiptRef}>
                        <ThermalReceipt
                            receipt={receiptData}
                            currencyConf={currencyConf}
                            gymName={gymName}
                            gymPhone={gymPhone}
                            isCopy={receiptIsCopy}
                        />
                    </div>
                </div>
            )}
        </div>
    );

    const selectedSubscription = memberSubscriptions.find(s => s.id === parseInt(selectedSubscriptionId));
    const selectedMeta = selectedSubscription ? getSubscriptionMeta(selectedSubscription) : null;
    const isSubscriptionMissing = memberSubscriptions.length === 0;
    const isSubscriptionSelected = Boolean(selectedSubscriptionId);
    const isFullyPaid = totalDue <= 0;
    const amountValue = roundMoney(payNowAmount);
    const isAmountValid = Number.isFinite(amountValue) && amountValue > 0 && amountValue <= totalDue + 0.01;
    const isConfirmDisabled = step !== 2 || !isSubscriptionSelected || isFullyPaid || !isAmountValid || loading || isSubmitting || ((method === 'card' || method === 'transfer') && !transactionRef);
    const isButtonBusy = isSubmitting || loading;

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
                        <button onClick={handleCloseModal} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
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

                                    {selectedSubscription ? (
                                        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md uppercase tracking-tight border border-indigo-500/10">
                                                        {selectedSubscription.plan?.name}
                                                    </span>
                                                    {totalDue > 0 ? (
                                                        <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-md uppercase tracking-tight border border-orange-500/10">DUE</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md uppercase tracking-tight border border-emerald-500/10">PAID</span>
                                                    )}
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                                    <Clock size={10} /> {new Date(selectedSubscription.startDate).toLocaleDateString()} - {new Date(selectedSubscription.endDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Remaining</div>
                                                <div className="text-sm font-black text-white">{totalDue.toLocaleString()} EGP</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-3 border-t border-white/5">
                                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center py-2">No subscription selected</p>
                                        </div>
                                    )}
                                </div>

                                {/* Subscription Selector */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subscription</label>
                                    {isSubscriptionMissing ? (
                                        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-bold uppercase tracking-widest text-center">
                                            No subscription found. Create subscription first from Subscriptions.
                                        </div>
                                    ) : (
                                        <select
                                            className="w-full px-4 py-3 bg-slate-900/50 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500/50 transition-all"
                                            value={selectedSubscriptionId}
                                            onChange={(e) => {
                                                const sub = memberSubscriptions.find(s => s.id === parseInt(e.target.value));
                                                if (sub) handleSubscriptionSelect(sub);
                                                else {
                                                    setSelectedSubscriptionId('');
                                                    setTotalDue(0);
                                                    setPaymentMode('full');
                                                    setPayNowAmount('');
                                                }
                                            }}
                                        >
                                            <option value="">Select a subscription...</option>
                                            {memberSubscriptions.map(sub => {
                                                const meta = getSubscriptionMeta(sub);
                                                const status = (sub.status || '').toUpperCase();
                                                return (
                                                    <option key={sub.id} value={sub.id}>
                                                        {sub.plan?.name || 'Plan'} • {meta.remaining} / {meta.total} EGP • {status}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    )}
                                    {selectedMeta && (
                                        <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-400">
                                            <div className="p-2 bg-slate-900/40 rounded-xl text-center">Total: {selectedMeta.total}</div>
                                            <div className="p-2 bg-slate-900/40 rounded-xl text-center text-emerald-400">Paid: {selectedMeta.paid}</div>
                                            <div className="p-2 bg-slate-900/40 rounded-xl text-center text-orange-400">Remaining: {selectedMeta.remaining}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Amount Selector */}
                                <div className="space-y-4">
                                    <div className="flex p-1 bg-slate-900/50 rounded-xl border border-white/5">
                                        <button
                                            onClick={() => setPaymentMode('full')}
                                            disabled={isFullyPaid || !isSubscriptionSelected}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${paymentMode === 'full' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500'} ${isFullyPaid || !isSubscriptionSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            Full Payment
                                        </button>
                                        <button
                                            onClick={() => setPaymentMode('partial')}
                                            disabled={isFullyPaid || !isSubscriptionSelected}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${paymentMode === 'partial' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500'} ${isFullyPaid || !isSubscriptionSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            Partial
                                        </button>
                                    </div>
                                    {isFullyPaid && isSubscriptionSelected && (
                                        <div className="text-center text-xs font-bold text-emerald-400 uppercase tracking-widest">
                                            Already paid
                                        </div>
                                    )}

                                    <div className="relative group bg-slate-950/30 rounded-3xl p-6 border-2 border-white/5 focus-within:border-blue-500/50 transition-all text-center">
                                        <label className="absolute top-4 left-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount to Pay</label>
                                        <div className="flex items-baseline justify-center gap-2 mt-2">
                                            <span className="text-xl font-black text-blue-500/50 tracking-tighter uppercase">EGP</span>
                                            <input
                                                type="number"
                                                className="bg-transparent border-none text-5xl font-black text-white outline-none w-full text-center placeholder-slate-800"
                                                value={payNowAmount}
                                                readOnly={paymentMode === 'full'}
                                                onChange={e => {
                                                    if (paymentMode === 'full') return;
                                                    setPayNowAmount(e.target.value);
                                                    if (totalDue > 0) setPaymentMode('partial');
                                                }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        {paymentMode === 'partial' && totalDue > 0 && (
                                            <div className="mt-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                Remaining: <span className="text-orange-500">{totalDue.toLocaleString()} EGP</span>
                                            </div>
                                        )}
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

                        {/* STEP 3: Receipt */}
                        {step === 3 && renderReceipt()}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/5 flex flex-col gap-3">
                        {step === 2 && (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isConfirmDisabled}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/40 transition-all flex justify-center items-center gap-2 active:scale-95"
                            >
                                {isButtonBusy ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <div className="flex items-center gap-2 tracking-tighter font-black uppercase">
                                        Confirm Payment
                                        <Check size={18} strokeWidth={4} />
                                    </div>
                                )}
                            </button>
                        )}
                        {step === 2 && isFullyPaid && isSubscriptionSelected && (
                            <div className="space-y-1">
                                <button
                                    onClick={() => fetchLatestReceipt({ autoPrint: true })}
                                    disabled={receiptLoading}
                                    className="w-full py-2.5 text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest transition-colors"
                                >
                                    {t('payments.printLastReceipt', 'Print Last Receipt')}
                                </button>
                                {lastReceiptError && (
                                    <div className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        {lastReceiptError}
                                    </div>
                                )}
                            </div>
                        )}
                        {step === 3 && (
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <button
                                        onClick={requestPrintReceipt}
                                        disabled={receiptLoading || receiptStatus === 'not_initialized'}
                                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Printer size={16} /> {t('payments.printReceipt', 'Print Receipt')}
                                    </button>
                                    <button
                                        onClick={handleViewReceipt}
                                        disabled={receiptLoading || receiptStatus === 'not_initialized'}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-900/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Eye size={16} /> {t('payments.viewReceipt', 'View Receipt')}
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleNewPayment}
                                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                    >
                                        <RotateCcw size={16} /> {t('payments.newPayment', 'New Payment')}
                                    </button>
                                    <button
                                        onClick={handleCloseModal}
                                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                    >
                                        {t('common.close', 'Close')}
                                    </button>
                                </div>
                            </div>
                        )}
                        {step !== 3 && (
                            <button onClick={handleCloseModal} className="w-full py-2 text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">
                                Cancel & Exit
                            </button>
                        )}
                    </div>

                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddPaymentDialog;
