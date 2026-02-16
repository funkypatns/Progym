import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Check, CreditCard, Banknote, Smartphone, ScanLine, Loader2, ChevronRight, Calculator, Camera, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../utils/api';
import { useSettingsStore } from '../store';
import { PaymentReceipt } from './payments/ReceiptTemplates';

/**
 * AssignPlanModal (Refactored State Machine)
 * 
 * Flow:
 * 1. Member Search (Live, Debounced, Abortable)
 * 2. Plan Selection (Only after member selected)
 * 3. Payment (Only after plan selected)
 */
const AssignPlanModal = ({ isOpen, onClose, onSuccess, initialMember = null, isRenewMode = false, initialPlanId = null, initialMode = 'subscription' }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';
    const { getSetting } = useSettingsStore();
    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };
    const gymName = getSetting('gym_name', t('receipt.companyName', 'GYM MANAGEMENT'));
    const gymLogoUrl = getSetting('gym_logo', '');

    // -- 1. State Machine --
    const [step, setStep] = useState(1);
    const [assignType, setAssignType] = useState(initialMode === 'package' ? 'package' : 'subscription');

    // Member State
    const [searchTerm, setSearchTerm] = useState('');
    const [members, setMembers] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);
    const searchAbortCtrl = useRef(null); // Requests cancellation

    // Plan State
    const [plans, setPlans] = useState([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [packagePlans, setPackagePlans] = useState([]);
    const [isLoadingPackagePlans, setIsLoadingPackagePlans] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [preferredPlanId, setPreferredPlanId] = useState(null);
    const [paymentDraft, setPaymentDraft] = useState(null);
    const [draftApplied, setDraftApplied] = useState(false);

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'card' | 'transfer'
    const [paymentMode, setPaymentMode] = useState('full'); // 'full' | 'partial'
    const [transactionRef, setTransactionRef] = useState('');
    const [notes, setNotes] = useState('');
    const [manualAmount, setManualAmount] = useState('');

    // Receipt State
    const [receiptPayment, setReceiptPayment] = useState(null);
    const [receiptLoading, setReceiptLoading] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [lastReceiptError, setLastReceiptError] = useState('');
    const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);

    // Submission State
    const [isSubmitting, setIsSubmitting] = useState(false);

    const receiptRef = useRef(null);

    // -- Helper: Safe Translation --
    const safeT = (key, fallback) => {
        const val = t(key);
        return (val && val !== key) ? val : fallback;
    };

    // -- 2. Lifecycle & Resets --

    // Reset Everything on Open
    useEffect(() => {
        if (isOpen) {
            console.debug('[AssignPlan] Modal Opened - Resetting State');
            const resolvedMode = isRenewMode ? 'subscription' : (initialMode === 'package' ? 'package' : 'subscription');
            setAssignType(resolvedMode);
            if (initialMember) {
                setSelectedMember(initialMember);
                setStep(2);
            } else {
                setSelectedMember(null);
                setStep(1);
            }
            setPaymentMethod('cash');
            setPaymentMode('full');
            setTransactionRef('');
            setNotes('');
            setManualAmount('');
            setIsSubmitting(false);
            setSelectedPlan(null);
            setSelectedPackage(null);
            setPreferredPlanId(null);
            setPaymentDraft(null);
            setDraftApplied(false);
            setReceiptPayment(null);
            setReceiptLoading(false);
            setShowReceipt(false);
            setLastReceiptError('');
            setAutoPrintReceipt(false);
            setPackagePlans([]);
            setIsLoadingPackagePlans(false);

            // Pre-fetch plans so they are ready
            fetchPlans();
            if (resolvedMode === 'package') {
                fetchPackagePlans();
            }
        } else {
            // Cleanup on close
            if (searchAbortCtrl.current) searchAbortCtrl.current.abort();
        }
    }, [isOpen]);

    // Cleanup on Unmount
    useEffect(() => {
        return () => {
            if (searchAbortCtrl.current) searchAbortCtrl.current.abort();
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        if (assignType !== 'package') return;
        if (packagePlans.length > 0 || isLoadingPackagePlans) return;
        fetchPackagePlans();
    }, [assignType, isOpen, packagePlans.length, isLoadingPackagePlans]);

    useEffect(() => {
        if (!isOpen) return;
        const storedPlanId = initialMember?.id
            ? parseInt(localStorage.getItem(`gym:memberPlanPref:${initialMember.id}`) || '', 10)
            : null;
        const parsedInitial = initialPlanId ? parseInt(initialPlanId, 10) : null;
        const resolved = Number.isFinite(parsedInitial) ? parsedInitial : (Number.isFinite(storedPlanId) ? storedPlanId : null);
        setPreferredPlanId(resolved);
        if (initialMember?.id) {
            try {
                const draftRaw = localStorage.getItem(`gym:memberPaymentPref:${initialMember.id}`);
                setPaymentDraft(draftRaw ? JSON.parse(draftRaw) : null);
            } catch (err) {
                setPaymentDraft(null);
            }
        }
    }, [isOpen, initialPlanId, initialMember]);

    useEffect(() => {
        if (!selectedPlan) return;
        const totalValue = Number(selectedPlan.price);
        const amountValue = paymentMode === 'full'
            ? totalValue
            : (manualAmount === '' || manualAmount === null ? 0 : Number(manualAmount));
        const hasPayment = Number.isFinite(amountValue) && amountValue > 0;

        if ((!hasPayment || paymentMethod === 'cash') && transactionRef) {
            setTransactionRef('');
        }
    }, [manualAmount, paymentMethod, paymentMode, selectedPlan, transactionRef]);

    useEffect(() => {
        if (!isOpen) return;
        if (assignType !== 'subscription') return;
        if (selectedPlan || plans.length === 0) return;
        const fallbackStored = selectedMember?.id
            ? parseInt(localStorage.getItem(`gym:memberPlanPref:${selectedMember.id}`) || '', 10)
            : null;
        const targetId = Number.isFinite(preferredPlanId) ? preferredPlanId : (Number.isFinite(fallbackStored) ? fallbackStored : null);
        if (!Number.isFinite(targetId)) return;
        const match = plans.find(p => p.id === targetId);
        if (!match) return;
        setSelectedPlan(match);
        const totalPrice = Number(match.price);
        const safeTotal = Number.isFinite(totalPrice) ? totalPrice : 0;
        const draftAmount = paymentDraft && paymentDraft.paidAmount !== null && paymentDraft.paidAmount !== undefined
            ? Number(paymentDraft.paidAmount)
            : null;
        if (Number.isFinite(draftAmount)) {
            const cappedDraft = safeTotal > 0 && draftAmount > safeTotal ? safeTotal : draftAmount;
            const isPartial = safeTotal > 0 && cappedDraft < safeTotal;
            const nextMode = isPartial ? 'partial' : 'full';
            setPaymentMode(nextMode);
            setManualAmount(nextMode === 'full' ? safeTotal : cappedDraft);
        } else {
            setPaymentMode('full');
            setManualAmount(safeTotal);
        }
    }, [isOpen, plans, preferredPlanId, selectedMember, selectedPlan, paymentDraft]);

    useEffect(() => {
        if (!isOpen || !selectedMember || draftApplied) return;
        if (assignType !== 'subscription') return;
        if (paymentDraft?.method) {
            const normalized = ['cash', 'card', 'transfer', 'other'].includes(paymentDraft.method)
                ? paymentDraft.method
                : 'cash';
            setPaymentMethod(normalized);
        }
        if (paymentDraft?.transactionRef && String(paymentDraft.transactionRef).trim()) {
            setTransactionRef(String(paymentDraft.transactionRef).trim());
        }
        setDraftApplied(true);
    }, [isOpen, selectedMember, paymentDraft, draftApplied]);

    useEffect(() => {
        if (!autoPrintReceipt) return;
        if (!receiptPayment || !receiptRef.current) return;
        const timeoutId = setTimeout(() => {
            handlePrintReceipt();
            setAutoPrintReceipt(false);
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [autoPrintReceipt, receiptPayment]);
    // -- 3. Actions & Logic --

    const fetchPlans = async () => {
        setIsLoadingPlans(true);
        try {
            const res = await apiClient.get('/plans?active=true');
            if (res.data.success) {
                setPlans(res.data.data || []);
            }
        } catch (err) {
            console.error('[AssignPlan] Fetch Plans Error:', err);
        } finally {
            setIsLoadingPlans(false);
        }
    };
    const fetchPackagePlans = async () => {
        setIsLoadingPackagePlans(true);
        try {
            const res = await apiClient.get('/package-plans');
            if (res.data.success) {
                setPackagePlans(res.data.data || []);
            }
        } catch (err) {
            console.error('[AssignPlan] Fetch Package Plans Error:', err);
        } finally {
            setIsLoadingPackagePlans(false);
        }
    };

    const handleSearch = (val) => {
        setSearchTerm(val);

        // Cancel previous pending request
        if (searchAbortCtrl.current) {
            searchAbortCtrl.current.abort();
        }

        // Clear if empty
        if (!val.trim()) {
            setMembers([]);
            setIsSearching(false);
            return;
        }

        // New AbortController
        const controller = new AbortController();
        searchAbortCtrl.current = controller;

        setIsSearching(true);

        // Debounce (300ms)
        setTimeout(async () => {
            if (controller.signal.aborted) return;

            try {
                // Use quick search endpoint which returns flat array
                const url = `/members/search/${encodeURIComponent(val.trim())}`;
                const res = await apiClient.get(url, {
                    signal: controller.signal
                });

                if (res.data.success) {
                    const found = res.data.data || [];
                    setMembers(found);

                    // Auto-select exact match scanner logic
                    if (found.length === 1) {
                        const m = found[0];
                        if (
                            String(m.memberId) === val ||
                            String(m.phone) === val ||
                            val.toUpperCase() === `GYM-${m.memberId}`
                        ) {
                            handleSelectMember(m);
                            toast.dismiss();
                            toast.success(`${safeT('members.memberFound', 'Member Found')}: ${m.firstName}`);
                        }
                    }
                }
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                    // Ignore cancelled
                } else {
                    console.error('[AssignPlan] Search Error:', err);
                }
            } finally {
                // Only unset loading if this is still the active controller
                if (!controller.signal.aborted) {
                    setIsSearching(false);
                }
            }
        }, 300);
    };

    const handleSelectMember = (m) => {
        if (assignType === 'subscription' && m.isActive) {
            toast.error(safeT('members.alreadyActive', 'This member already has an active subscription. You cannot assign a new one while active.'));
            return;
        }

        console.debug('[AssignPlan] Selected Member:', m.id);
        setSelectedMember(m);
        const storedPlanId = parseInt(localStorage.getItem(`gym:memberPlanPref:${m.id}`) || '', 10);
        setPreferredPlanId(Number.isFinite(storedPlanId) ? storedPlanId : null);
        try {
            const draftRaw = localStorage.getItem(`gym:memberPaymentPref:${m.id}`);
            setPaymentDraft(draftRaw ? JSON.parse(draftRaw) : null);
        } catch (err) {
            setPaymentDraft(null);
        }
        setDraftApplied(false);
        setSearchTerm('');
        setMembers([]); // Clear dropdown
        setStep(2); // Auto-advance
    };

    const handleSelectPlan = (p) => {
        console.debug('[AssignPlan] Selected Plan:', p.id);
        setSelectedPlan(p);
        setPaymentMode('full');
        setManualAmount(p.price);
        setStep(3); // Auto-advance optional? User asked to "reveal", but auto-advance is smoother. 
    };
    const handleSelectPackage = (p) => {
        console.debug('[AssignPlan] Selected Package:', p.id);
        setSelectedPackage(p);
        setStep(3);
    };
    const handleAssignTypeChange = (nextType) => {
        if (isRenewMode) return;
        if (nextType === assignType) return;
        setAssignType(nextType);
        setSelectedPlan(null);
        setSelectedPackage(null);
        setPaymentMode('full');
        setManualAmount('');
        setTransactionRef('');
        setStep(selectedMember ? 2 : 1);
    };

    const handleResetMember = () => {
        setSelectedMember(null);
        setSelectedPlan(null);
        setSelectedPackage(null);
        setStep(1); // Go back to start
    };

    const handlePaymentModeChange = (mode) => {
        if (mode === paymentMode) return;
        setPaymentMode(mode);
        if (!selectedPlan) return;
        if (mode === 'full') {
            setManualAmount(Number(selectedPlan.price));
        } else {
            setManualAmount('');
        }
    };

    const handleSubmit = async () => {
        if (!selectedMember || !selectedPlan) return;
        if (isSubmitting) return; // STRICT GUARD
        setLastReceiptError('');

        try {
            const resolvedMemberId = Number.parseInt(selectedMember.id ?? selectedMember.memberId, 10);
            const resolvedPlanId = Number.parseInt(selectedPlan.id ?? selectedPlan.planId, 10);
            const planPrice = Number(selectedPlan.price);

            if (!Number.isInteger(resolvedMemberId) || !Number.isInteger(resolvedPlanId)) {
                toast.error(safeT('errors.invalidSelection', 'Invalid member or plan selection'));
                return;
            }

            if (!Number.isFinite(planPrice)) {
                toast.error(safeT('errors.invalidPlanPrice', 'Invalid plan price'));
                return;
            }

            const amountInput = paymentMode === 'full'
                ? planPrice
                : (manualAmount === '' || manualAmount === null ? 0 : Number(manualAmount));
            const finalAmount = Number.isFinite(amountInput) ? amountInput : NaN;
            if (!Number.isFinite(finalAmount)) {
                toast.error(safeT('errors.invalidAmount', 'Invalid payment amount'));
                return;
            }

            if (paymentMode === 'partial' && planPrice > 0) {
                if (finalAmount < 0) {
                    toast.error(safeT('errors.invalidAmount', 'Invalid payment amount'));
                    return;
                }
                if (finalAmount >= planPrice) {
                    toast.error(safeT('errors.partialAmountRange', 'Partial payment must be less than total'));
                    return;
                }
            }

            let status = 'paid';
            if (planPrice === 0) status = 'paid';
            else if (finalAmount <= 0) status = 'unpaid';
            else if (finalAmount < planPrice) status = 'partial';

            if (finalAmount > planPrice) {
                toast.error(safeT('errors.invalidAmount', 'Paid amount cannot exceed total price'));
                return;
            }

            const normalizedMethod = ['cash', 'card', 'transfer', 'other'].includes(paymentMethod)
                ? paymentMethod
                : 'cash';
            const hasPayment = finalAmount > 0;
            if (normalizedMethod !== 'cash' && hasPayment && !transactionRef.trim()) {
                toast.error(safeT('errors.missingReference', 'Transaction reference is required for non-cash payments'));
                return;
            }
            const cleanedTransactionRef = normalizedMethod !== 'cash' && hasPayment && transactionRef.trim()
                ? transactionRef.trim()
                : undefined;

            setIsSubmitting(true);
            const payload = {
                memberId: resolvedMemberId,
                planId: resolvedPlanId,
                startDate: new Date().toISOString(),
                method: normalizedMethod,
                transactionRef: cleanedTransactionRef,
                paymentStatus: status,
                paidAmount: finalAmount,
                notes: notes || undefined
            };

            const res = await apiClient.post('/subscriptions', payload);
            if (res.data.success) {
                if (selectedMember?.id) {
                    localStorage.removeItem(`gym:memberPlanPref:${selectedMember.id}`);
                    localStorage.removeItem(`gym:memberPaymentPref:${selectedMember.id}`);
                }
                toast.success(safeT('subscriptions.created', 'Subscription assigned successfully'));
                const paymentId = res.data?.data?.payment?.id;
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('payments:updated'));
                }
                if (onSuccess) onSuccess();
                if (paymentId) {
                    setReceiptLoading(true);
                    setShowReceipt(true);
                    try {
                        const detailRes = await apiClient.get(`/payments/${paymentId}`);
                        if (detailRes.data.success) {
                            setReceiptPayment(detailRes.data.data);
                        } else {
                            setReceiptPayment(null);
                        }
                    } catch (err) {
                        toast.error(safeT('payments.receiptNotFound', 'Receipt not found'));
                        setReceiptPayment(null);
                    } finally {
                        setReceiptLoading(false);
                    }
                    setAutoPrintReceipt(false);
                    return;
                }
                onClose();
            }
        } catch (err) {
            console.error('[AssignPlan] Submit Error:', err);
            toast.error(err.response?.data?.message || safeT('errors.serverError', 'Failed to assign subscription'));
        } finally {
            setIsSubmitting(false);
        }
    };
    const handlePackageAssign = async () => {
        if (!selectedMember || !selectedPackage) return;
        if (isSubmitting) return;
        try {
            const resolvedMemberId = Number.parseInt(selectedMember.id ?? selectedMember.memberId, 10);
            const resolvedPlanId = Number.parseInt(selectedPackage.id ?? selectedPackage.packagePlanId, 10);
            if (!Number.isInteger(resolvedMemberId) || !Number.isInteger(resolvedPlanId)) {
                toast.error(safeT('errors.invalidSelection', 'Invalid member or plan selection'));
                return;
            }
            setIsSubmitting(true);
            const payload = {
                packagePlanId: resolvedPlanId,
                startDate: new Date().toISOString()
            };
            const res = await apiClient.post(`/members/${resolvedMemberId}/packages`, payload);
            if (res.data.success) {
                toast.success(safeT('packagePlans.assigned', 'Package assigned successfully'));
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast.error(res.data.message || safeT('errors.serverError', 'Failed to assign package'));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || safeT('errors.serverError', 'Failed to assign package'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // -- 4. Render Logic (Guards) --

    if (!isOpen) return null;

    const isNextDisabled = () => {
        if (step === 1) return !selectedMember;
        if (step === 2) return assignType === 'package' ? !selectedPackage : !selectedPlan;
        return false;
    };

    const isConfirmDisabled = () => {
        if (isSubmitting) return true;
        if (assignType === 'package') {
            return !selectedPackage;
        }
        const totalValue = Number(selectedPlan?.price || 0);
        const amountValue = paymentMode === 'full'
            ? totalValue
            : (manualAmount === '' || manualAmount === null ? 0 : Number(manualAmount));
        const hasPayment = Number.isFinite(amountValue) && amountValue > 0;
        if (paymentMode === 'partial' && Number.isFinite(totalValue) && Number.isFinite(amountValue)) {
            if (amountValue < 0) return true;
            if (totalValue > 0 && amountValue >= totalValue) return true;
        }
        if ((paymentMethod === 'card' || paymentMethod === 'transfer') && hasPayment && !transactionRef.trim()) return true;
        return false;
    };

    const totalValue = Number(selectedPlan?.price || 0);
    const amountValue = paymentMode === 'full'
        ? totalValue
        : (manualAmount === '' || manualAmount === null ? 0 : Number(manualAmount));
    const hasPayment = Number.isFinite(amountValue) && amountValue > 0;
    const canPrintLastReceipt = step === 3 && !showReceipt && selectedMember && assignType === 'subscription';

    // Sub-renderers
    const renderMemberSearch = () => (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="relative">
                <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-3.5 text-gray-400`} size={20} />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={safeT('members.searchPlaceholder', 'Find Member (Name, ID, Phone)...')}
                    className={`w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white`}
                    autoFocus
                />
                {isSearching && (
                    <div className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-3.5`}>
                        <Loader2 size={20} className="animate-spin text-blue-500" />
                    </div>
                )}
            </div>

            {/* Results List */}
            {members.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700 max-h-[300px] overflow-y-auto">
                    {members.map(m => (
                        <div
                            key={m.id}
                            onClick={() => handleSelectMember(m)}
                            className={`p-4 flex justify-between items-center transition-colors group border-b border-gray-100 last:border-0 ${(assignType === 'subscription' && m.isActive)
                                ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-slate-800/50 grayscale-[0.5]'
                                : 'hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer'
                                }`}
                        >
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {m.firstName} {m.lastName}
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {m.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                    ID: {m.memberId} | 📞 {m.phone}
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {searchTerm.length > 1 && members.length === 0 && !isSearching && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                    <p>{safeT('common.noResults', 'No members found')}</p>
                </div>
            )}
        </div>
    );

    const renderPlanSelection = () => {
        const isPackage = assignType === 'package';
        const planSource = isPackage ? packagePlans : plans;
        const safePlans = Array.isArray(planSource) ? planSource : [];
        if (!selectedMember) {
            return (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                    {safeT('members.selectMember', 'Select a member first')}
                </div>
            );
        }
        const memberFirstName = (selectedMember.firstName || selectedMember.name || '').trim();
        const memberLastName = (selectedMember.lastName || '').trim();
        const memberLabel = `${memberFirstName} ${memberLastName}`.trim() || safeT('members.member', 'Member');
        const memberInitial = memberFirstName ? memberFirstName[0] : '?';
        const memberCode = selectedMember.memberId || selectedMember.code || '-';
        const noPlansFallback = i18n.language === 'ar'
            ? 'لا توجد خطط متاحة حاليًا'
            : 'No active plans available.';
        const noPackagesFallback = i18n.language === 'ar'
            ? 'لا توجد باقات متاحة حاليًا'
            : 'No active packages available.';
        const isLoadingList = isPackage ? isLoadingPackagePlans : isLoadingPlans;
        const selectedItem = isPackage ? selectedPackage : selectedPlan;

        return (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                {/* Selected Member Summary */}
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
                            {memberInitial}
                        </div>
                        <div>
                            <div className="font-bold text-gray-900 dark:text-white">{memberLabel}</div>
                            <div className="text-xs text-blue-600 dark:text-blue-300">{memberCode}</div>
                        </div>
                    </div>
                    {!isRenewMode && (
                        <button onClick={handleResetMember} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            {safeT('common.change', 'Change')}
                        </button>
                    )}
                </div>

                {!isRenewMode && (
                    <div className="flex w-fit gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-slate-950/50 border border-gray-200 dark:border-white/5">
                        <button
                            type="button"
                            onClick={() => handleAssignTypeChange('subscription')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${assignType === 'subscription' ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            {safeT('subscriptions.modeSubscription', 'Subscription')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAssignTypeChange('package')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${assignType === 'package' ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            {safeT('subscriptions.modePackage', 'Package')}
                        </button>
                    </div>
                )}

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isLoadingList ? (
                        <div className="col-span-2 flex justify-center py-10">
                            <Loader2 className="animate-spin text-blue-500" />
                        </div>
                    ) : safePlans.length === 0 ? (
                        <div className="col-span-2 text-center py-10 text-gray-500">
                            {isPackage ? safeT('packagePlans.noPlans', noPackagesFallback) : safeT('plans.noPlans', noPlansFallback)}
                        </div>
                    ) : (
                        safePlans.map(plan => (
                            <div
                                key={plan.id}
                                onClick={() => isPackage ? handleSelectPackage(plan) : handleSelectPlan(plan)}
                                className={`
                                    relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                                    ${selectedItem?.id === plan.id
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-1 ring-blue-500'
                                        : 'border-gray-100 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                                    {selectedItem?.id === plan.id && (
                                        <div className="bg-blue-500 text-white p-1 rounded-full">
                                            <Check size={12} />
                                        </div>
                                    )}
                                </div>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                                    {plan.price} <span className="text-sm font-normal text-gray-500">{safeT('common.currency', 'EGP')}</span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {isPackage
                                        ? `${plan.totalSessions} ${safeT('packagePlans.sessions', 'Sessions')}`
                                        : `${plan.duration} ${safeT('common.days', 'Days')}`}
                                </div>
                                {isPackage && (
                                    <div className="text-xs text-gray-400 mt-1">
                                        {plan.validityDays
                                            ? `${plan.validityDays} ${safeT('common.days', 'Days')}`
                                            : safeT('packagePlans.noValidity', 'No expiry')}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const renderPackageConfirm = () => {
        if (!selectedPackage || !selectedMember) return null;
        return (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500 text-sm">{safeT('packagePlans.tab', 'Package')}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{selectedPackage.name}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500 text-sm">{safeT('members.member', 'Member')}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{selectedMember.firstName} {selectedMember.lastName}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500 text-sm">{safeT('packagePlans.totalSessions', 'Total Sessions')}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{selectedPackage.totalSessions}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500 text-sm">{safeT('packagePlans.validityDays', 'Validity Days')}</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                            {selectedPackage.validityDays ? selectedPackage.validityDays : safeT('packagePlans.noValidity', 'No expiry')}
                        </span>
                    </div>
                    <div className="my-2 border-t border-gray-200 dark:border-slate-700"></div>
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-bold text-gray-900 dark:text-white">{safeT('common.total', 'Total')}</span>
                        <span className="font-bold text-blue-600">{selectedPackage.price} {safeT('common.currency', 'EGP')}</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderPayment = () => {
        if (!selectedPlan || !selectedMember) return null;
        return (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Summary Box */}
            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 text-sm">Plan</span>
                    <span className="font-bold text-gray-900 dark:text-white">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 text-sm">Member</span>
                    <span className="font-bold text-gray-900 dark:text-white">{selectedMember.firstName} {selectedMember.lastName}</span>
                </div>
                <div className="my-2 border-t border-gray-200 dark:border-slate-700"></div>
                <div className="flex justify-between items-center text-lg">
                    <span className="font-bold text-gray-900 dark:text-white">Total</span>
                    <span className="font-bold text-blue-600">{selectedPlan.price} EGP</span>
                </div>
            </div>

            {/* Payment Inputs */}
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {safeT('finance.paymentMode', 'Payment mode')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => handlePaymentModeChange('full')}
                        className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${paymentMode === 'full'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400'}`}
                    >
                        {safeT('finance.fullPayment', 'Full')}
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePaymentModeChange('partial')}
                        className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${paymentMode === 'partial'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400'}`}
                    >
                        {safeT('finance.partialPayment', 'Partial')}
                    </button>
                </div>
            </div>

            {paymentMode === 'partial' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {safeT('finance.amountPaidNow', 'Amount paid now')} ({safeT('common.currency', 'EGP')})
                    </label>
                    <input
                        type="number"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        placeholder={safeT('finance.amountPaidNowPlaceholder', '0')}
                        className="block w-full rounded-xl border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-3 px-4 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
                    />
                </div>
            )}

            <div className="grid grid-cols-3 gap-3">
                {[
                    { id: 'cash', icon: Banknote, label: 'Cash' },
                    { id: 'card', icon: CreditCard, label: 'Visa / Card' },
                    { id: 'transfer', icon: Smartphone, label: 'Transfer' }
                ].map(method => (
                    <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`
                            flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all
                            ${paymentMethod === method.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400'}
                        `}
                    >
                        <method.icon size={24} className="mb-2" />
                        <span className="text-xs font-bold">{method.label}</span>
                    </button>
                ))}
            </div>

            {(paymentMethod === 'card' || paymentMethod === 'transfer') && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {paymentMethod === 'card' ? 'Transaction No.' : 'Reference ID'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        placeholder="Scan or type reference..."
                        className="w-full rounded-xl border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-3 px-4 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
                    />
                </div>
            )}
            </div>
        );
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

    const fetchLatestReceipt = async (options = {}) => {
        const { autoPrint = false } = options;
        if (!selectedMember?.id) return;
        setLastReceiptError('');
        setReceiptLoading(true);
        try {
            const res = await apiClient.get(`/payments/latest?memberId=${selectedMember.id}`);
            if (res.data.success && res.data.data) {
                setReceiptPayment(res.data.data);
                setShowReceipt(true);
                if (autoPrint) setAutoPrintReceipt(true);
            } else {
                setReceiptPayment(null);
                setLastReceiptError(safeT('payments.noReceiptAvailable', 'No receipt available'));
            }
        } catch (err) {
            setReceiptPayment(null);
            setLastReceiptError(safeT('payments.noReceiptAvailable', 'No receipt available'));
        } finally {
            setReceiptLoading(false);
        }
    };
    const renderReceipt = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest">
                    {safeT('payments.receipt', 'Receipt')}
                </h3>
                {receiptPayment?.receiptNumber && (
                    <span className="text-xs font-mono text-gray-400">{receiptPayment.receiptNumber}</span>
                )}
            </div>
            {receiptLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500" />
                </div>
            ) : receiptPayment ? (
                <div ref={receiptRef} className="bg-white rounded-xl p-4 border border-gray-200">
                    <PaymentReceipt
                        payment={receiptPayment}
                        currencyConf={currencyConf}
                        gymName={gymName}
                        gymLogoUrl={gymLogoUrl}
                        className="max-w-full"
                    />
                </div>
            ) : (
                <div className="text-center text-xs text-gray-500">
                    {safeT('payments.receiptNotFound', 'Receipt not found')}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* 1. Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {isRenewMode
                                ? safeT('subscriptions.renewSubscription', 'Renew Subscription')
                                : (assignType === 'package'
                                    ? safeT('packagePlans.assignPackage', 'Assign Package')
                                    : safeT('subscriptions.assignSubscription', 'Assign Subscription'))}
                        </h2>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {!isRenewMode && (
                                <>
                                    <span className={step >= 1 ? 'text-blue-600 font-bold' : ''}>1. Member</span>
                                    <ChevronRight size={14} />
                                </>
                            )}
                            <span className={step >= 2 ? 'text-blue-600 font-bold' : ''}>
                                {isRenewMode ? '1' : '2'}. {assignType === 'package' ? safeT('packagePlans.tab', 'Package') : safeT('subscriptions.plan', 'Plan')}
                            </span>
                            <ChevronRight size={14} />
                            <span className={step >= 3 ? 'text-blue-600 font-bold' : ''}>
                                {isRenewMode ? '2' : '3'}. {assignType === 'package' ? safeT('common.confirm', 'Confirm') : safeT('common.pay', 'Pay')}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* 2. Body */}
                <div className="p-6 overflow-y-auto flex-1 min-h-[400px]">
                    {step === 1 && renderMemberSearch()}
                    {step === 2 && renderPlanSelection()}
                    {step === 3 && (assignType === 'package' ? renderPackageConfirm() : (showReceipt ? renderReceipt() : renderPayment()))}
                </div>

                {/* 3. Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50 rounded-b-2xl">
                    {step > (isRenewMode ? 2 : 1) && !showReceipt ? (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="px-6 py-2.5 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white"
                        >
                            {safeT('common.back', 'Back')}
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={isNextDisabled()}
                            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all"
                        >
                            {safeT('common.next', 'Next')}
                            <ChevronRight size={18} />
                        </button>
                    ) : showReceipt ? (
                        <div className="flex gap-3">
                            <button
                                onClick={handlePrintReceipt}
                                disabled={!receiptPayment || receiptLoading}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all"
                            >
                                <Printer size={18} />
                                {safeT('payments.printReceipt', 'Print Receipt')}
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                            >
                                {safeT('common.close', 'Done')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-end gap-2">
                            <button
                                onClick={assignType === 'package' ? handlePackageAssign : handleSubmit}
                                disabled={isConfirmDisabled()}
                                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                {safeT('common.confirm', 'Confirm')}
                            </button>
                            {canPrintLastReceipt && (
                                <div className="w-full space-y-1">
                                    <button
                                        onClick={() => fetchLatestReceipt({ autoPrint: true })}
                                        disabled={receiptLoading}
                                        className="w-full px-4 py-2 text-[10px] font-black text-emerald-600 hover:text-emerald-500 uppercase tracking-widest transition-colors"
                                    >
                                        {safeT('payments.printLastReceipt', 'Print Last Receipt')}
                                    </button>
                                    {lastReceiptError && (
                                        <div className="text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                            {lastReceiptError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssignPlanModal;
