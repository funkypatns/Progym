/**
 * ============================================
 * MEMBER FORM (ADD/EDIT)
 * ============================================
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, Upload, X, CreditCard, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { usePlanStore, useSettingsStore } from '../../store';
import { formatCurrency } from '../../utils/numberFormatter';

const MemberForm = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const { plans, fetchPlans } = usePlanStore();
    const { getSetting } = useSettingsStore();
    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [photoPreview, setPhotoPreview] = useState(null);

    const initialFormData = {
        firstName: '',
        lastName: '',
        phone: '',
        memberId: '', // Display only for edit
        email: '',
        gender: '',
        dateOfBirth: '',
        address: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        notes: '',
        photo: null,
    };

    // Subscription State (only for new members or if we want to allow adding sub here)
    // For now, focusing on the "Add Member" flow requiring these fields
    const initialSubData = {
        planId: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endDate: '',
        endTime: '23:59',
        price: '',
        paidAmount: '',
        method: 'cash',
        transactionRef: '',
    };

    const [formData, setFormData] = useState(initialFormData);
    const [subData, setSubData] = useState(initialSubData);
    const [nextAction, setNextAction] = useState('membership');
    const [createdMemberId, setCreatedMemberId] = useState(null);

    useEffect(() => {
        fetchPlans(true); // Fetch active plans
        if (isEdit) {
            fetchMember();
        }
    }, [id]);

    // Auto-calculate End Date and Price when Plan or Start Date changes
    useEffect(() => {
        if (!subData.planId) return;

        const selectedPlan = plans.find(p => p.id === parseInt(subData.planId));
        if (selectedPlan) {
            // Update price if not manually edited (simple check: if it matches plan price or is empty)
            // Ideally we'd track "isPriceEdited", but for now let's just reset to plan price on plan change
            // User can edit afterwards.
            setSubData(prev => ({ ...prev, price: selectedPlan.price }));

            // Calculate End Date
            if (subData.startDate) {
                const start = new Date(subData.startDate);
                const end = new Date(start);
                end.setDate(start.getDate() + selectedPlan.duration);
                setSubData(prev => ({
                    ...prev,
                    endDate: end.toISOString().split('T')[0]
                }));
            }
        }
    }, [subData.planId, subData.startDate, plans]);

    useEffect(() => {
        const paidVal = parseFloat(subData.paidAmount);
        const hasPayment = Number.isFinite(paidVal) && paidVal > 0;

        if (!hasPayment && subData.method !== 'cash') {
            setSubData(prev => ({ ...prev, method: 'cash', transactionRef: '' }));
            return;
        }

        if (subData.method === 'cash' && subData.transactionRef) {
            setSubData(prev => ({ ...prev, transactionRef: '' }));
        }
    }, [subData.paidAmount, subData.method, subData.transactionRef]);

    const fetchMember = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/members/${id}`);
            const member = response.data.data;

            setFormData({
                firstName: member.firstName || '',
                lastName: member.lastName || '',
                phone: member.phone || '',
                memberId: member.memberId || '',
                email: member.email || '',
                gender: member.gender || '',
                dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
                address: member.address || '',
                emergencyContactName: member.emergencyContactName || '',
                emergencyContactPhone: member.emergencyContactPhone || '',
                notes: member.notes || '',
                photo: null,
            });

            if (member.photo) {
                setPhotoPreview(member.photo);
            }
        } catch (error) {
            toast.error('Failed to load member');
            navigate('/members');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubChange = (e) => {
        const { name, value } = e.target;
        setSubData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormData(prev => ({ ...prev, photo: file }));
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const removePhoto = () => {
        setFormData(prev => ({ ...prev, photo: null }));
        setPhotoPreview(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving) return; // STRICT GUARD against double clicks
        setIsSaving(true);

        try {
            // 1. Create/Update Member
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (key !== 'memberId' && formData[key] !== null && formData[key] !== '') {
                    data.append(key, formData[key]);
                }
            });

            let memberIdResponse;

            if (isEdit) {
                await api.put(`/members/${id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                toast.success(t('members.memberUpdated'));
                navigate('/members'); // Return early for edit
                return;
            } else {
                const res = await api.post('/members', data, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                memberIdResponse = res.data.data.id;
                setCreatedMemberId(memberIdResponse);
                toast.success(t('members.memberCreated'));
            }

            return;
        } catch (error) {
            const message = error.response?.data?.message
                || error.response?.data?.errors?.[0]?.msg
                || 'Failed to save member';
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleNextStep = () => {
        if (!createdMemberId) return;

        if (nextAction === 'membership') {
            if (subData.planId) {
                const selectedPlan = plans.find(p => p.id === parseInt(subData.planId));
                const priceInput = parseFloat(subData.price);
                const total = Number.isFinite(priceInput) ? priceInput : selectedPlan?.price;
                if (!Number.isFinite(total)) {
                    toast.error('Invalid plan price');
                    return;
                }

                const paidInput = parseFloat(subData.paidAmount);
                const paid = Number.isFinite(paidInput) ? paidInput : null;
                if (Number.isFinite(paid) && paid > total) {
                    toast.error('Paid amount cannot exceed total price');
                    return;
                }

                const allowedMethods = ['cash', 'card', 'transfer', 'other'];
                const normalizedMethod = allowedMethods.includes(subData.method) ? subData.method : 'cash';

                localStorage.setItem(`gym:memberPlanPref:${createdMemberId}`, String(subData.planId));
                localStorage.setItem(
                    `gym:memberPaymentPref:${createdMemberId}`,
                    JSON.stringify({
                        paidAmount: Number.isFinite(paid) ? paid : null,
                        method: normalizedMethod,
                        transactionRef: subData.transactionRef ? subData.transactionRef.trim() : null
                    })
                );
            }

            navigate(`/subscriptions?memberId=${encodeURIComponent(createdMemberId)}`);
            return;
        }

        navigate(`/appointments?memberId=${encodeURIComponent(createdMemberId)}`);
    };

    const handleAddAnother = () => {
        setFormData(initialFormData);
        setSubData(initialSubData);
        setPhotoPreview(null);
        setCreatedMemberId(null);
        setNextAction('membership');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-dark-400" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="btn-icon hover:bg-dark-800 text-dark-400"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {isEdit ? t('members.editMember') : t('members.addMember')}
                    </h1>
                </div>
            </div>

            {/* Form */}
            <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="card space-y-8"
            >
                {/* 1. Photo & Basic Headers */}
                <div className="flex flex-col sm:flex-row gap-8">
                    {/* Photo Upload */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center overflow-hidden border-4 border-white dark:border-dark-600 shadow-lg">
                                {photoPreview ? (
                                    <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl text-gray-400 dark:text-dark-400 font-bold">
                                        {formData.firstName?.[0]?.toUpperCase() || '?'}
                                    </span>
                                )}
                            </div>
                            {photoPreview && (
                                <button
                                    type="button"
                                    onClick={removePhoto}
                                    className="absolute top-0 right-0 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600 shadow-md transform translate-x-1/4 -translate-y-1/4"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <label className="btn-secondary cursor-pointer text-sm py-2">
                            <Upload className="w-4 h-4" />
                            {t('members.uploadPhoto')}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                className="hidden"
                            />
                        </label>
                    </div>

                    {/* Main Fields Flow - As requested */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. First Name */}
                        <div>
                            <label className="label">{t('members.firstName')} *</label>
                            <input
                                type="text"
                                name="firstName"
                                className="input"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* 2. Last Name */}
                        <div>
                            <label className="label">{t('members.lastName')} *</label>
                            <input
                                type="text"
                                name="lastName"
                                className="input"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* 3. Phone Number */}
                        <div>
                            <label className="label">{t('members.phone')} *</label>
                            <input
                                type="tel"
                                name="phone"
                                className="input"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* 4. Membership ID */}
                        <div>
                            <label className="label">{t('members.memberId')}</label>
                            <input
                                type="text"
                                className="input bg-gray-50 dark:bg-dark-800/50 text-gray-500 cursor-not-allowed"
                                value={isEdit ? formData.memberId : 'Auto-generated'}
                                disabled
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-dark-700"></div>

                {/* 5. Plan & Subscription (Show only on Create for now or if we want to support unified edit later) */}
                {!isEdit && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                                <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Membership Plan</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
                            {/* 5. Plan */}
                            <div className="lg:col-span-8">
                                <label className="label">Select Plan</label>
                                <select
                                    name="planId"
                                    className="input"
                                    value={subData.planId}
                                    onChange={handleSubChange}
                                >
                                    <option value="">-- Choose a Plan --</option>
                                    {(plans || []).map(plan => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.name} ({plan.duration} Days) - {formatCurrency(plan.price, i18n.language, currencyConf)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Price (Editable) */}
                            <div className="lg:col-span-4">
                                <label className="label">Price ({currencyConf.symbol})</label>
                                <input
                                    type="number"
                                    name="price"
                                    className="input"
                                    value={subData.price}
                                    onChange={handleSubChange}
                                    disabled={!subData.planId}
                                />
                            </div>

                            {/* 6. Start Date */}
                            <div className="lg:col-span-3">
                                <label className="label">Start Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        name="startDate"
                                        className="input pl-10"
                                        value={subData.startDate}
                                        onChange={handleSubChange}
                                        disabled={!subData.planId}
                                    />
                                </div>
                            </div>

                            {/* 7. Start Time */}
                            <div className="lg:col-span-3">
                                <label className="label">Start Time</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        name="startTime"
                                        className="input pl-10"
                                        value={subData.startTime}
                                        onChange={handleSubChange}
                                        disabled={!subData.planId}
                                    />
                                </div>
                            </div>

                            {/* 8. End Date */}
                            <div className="lg:col-span-3">
                                <label className="label">End Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        name="endDate"
                                        className="input pl-10"
                                        value={subData.endDate}
                                        onChange={handleSubChange}
                                        readOnly
                                    />
                                </div>
                            </div>

                            {/* 9. End Time */}
                            <div className="lg:col-span-3">
                                <label className="label">End Time</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        name="endTime"
                                        className="input pl-10"
                                        value={subData.endTime}
                                        onChange={handleSubChange}
                                        disabled={!subData.planId}
                                    />
                                </div>
                            </div>

                            {/* Payment Integration Fields */}
                            <div className="lg:col-span-6">
                                <label className="label">Amount Paid Now ({currencyConf.symbol})</label>
                                <input
                                    type="number"
                                    name="paidAmount"
                                    className="input font-bold text-green-600 dark:text-green-400"
                                    placeholder="0.00"
                                    value={subData.paidAmount}
                                    onChange={handleSubChange}
                                    disabled={!subData.planId}
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave empty or 0 to create a pending invoice.</p>
                            </div>

                            <div className="lg:col-span-6">
                                <label className="label">Payment Method</label>
                                <select
                                    name="method"
                                    className="input"
                                    value={subData.method}
                                    onChange={handleSubChange}
                                    disabled={!subData.planId || !subData.paidAmount || parseFloat(subData.paidAmount) <= 0}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="card">Card / POS</option>
                                    <option value="transfer">Bank Transfer</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            {subData.method !== 'cash' && parseFloat(subData.paidAmount) > 0 && (
                                <div className="lg:col-span-12">
                                    <label className="label">Transaction Reference *</label>
                                    <input
                                        type="text"
                                        name="transactionRef"
                                        className="input"
                                        value={subData.transactionRef}
                                        onChange={handleSubChange}
                                        placeholder="Enter reference number"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="border-t border-gray-200 dark:border-dark-700 mt-6"></div>
                    </div>

                )}

                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="label">{t('members.email')}</label>
                        <input
                            type="email"
                            name="email"
                            className="input"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="label">
                            {t('members.gender')}
                            <span className="text-xs text-gray-400 font-normal ml-2">({t('common.optional')})</span>
                        </label>
                        <select
                            name="gender"
                            className="input"
                            value={formData.gender}
                            onChange={handleChange}
                        >
                            <option value="">{t('common.select')}</option>
                            <option value="male">{t('members.male', 'Male')}</option>
                            <option value="female">{t('members.female', 'Female')}</option>
                            <option value="unknown">{t('members.unknown', 'Unknown')}</option>
                        </select>
                    </div>
                </div>

                {/* 10. Notes */}
                <div>
                    <label className="label">{t('members.notes')}</label>
                    <textarea
                        name="notes"
                        className="input min-h-[100px]"
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Any medical conditions or special notes..."
                    />
                </div>

                {/* Actions */}
                {!isEdit && (
                    <div className="flex flex-col gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            بعد إنشاء الحساب:
                        </span>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                <input
                                    type="radio"
                                    name="nextAction"
                                    value="membership"
                                    checked={nextAction === 'membership'}
                                    onChange={() => setNextAction('membership')}
                                    className="accent-primary-600"
                                />
                                اشتراك (Membership)
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                <input
                                    type="radio"
                                    name="nextAction"
                                    value="session"
                                    checked={nextAction === 'session'}
                                    onChange={() => setNextAction('session')}
                                    className="accent-primary-600"
                                />
                                حجز جلسة (Session)
                            </label>
                        </div>
                    </div>
                )}

                {createdMemberId && !isEdit && (
                    <div className="mt-4 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-900/20">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-3">
                            تم إنشاء العضو بنجاح
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button type="button" className="btn-primary" onClick={handleNextStep}>
                                {nextAction === 'membership' ? 'اذهب للاشتراك' : 'اذهب لحجز جلسة'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={handleAddAnother}>
                                إضافة عضو آخر
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="btn-secondary"
                    >
                        {t('common.cancel')}
                    </button>
                    <button type="submit" disabled={isSaving || (!isEdit && Boolean(createdMemberId))} className="btn-primary">
                        {isSaving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                {t('common.save')}
                            </>
                        )}
                    </button>
                </div>
            </motion.form>
        </div>
    );
};

export default MemberForm;
