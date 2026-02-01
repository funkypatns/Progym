/**
 * ============================================
 * PLANS MANAGEMENT - GLASS ENTERPRISE EDITION
 * ============================================
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Edit2, Trash2, CheckCircle, XCircle, Loader2,
    Save, X, CreditCard, Calendar, DollarSign, Clock,
    Activity, Layers, TrendingUp, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlanStore, useSettingsStore } from '../store';
import { formatCurrency } from '../utils/numberFormatter';
import StatCard from '../components/StatCard';

const Plans = () => {
    const { t, i18n } = useTranslation();
    const { plans, fetchPlans, createPlan, updatePlan, deletePlan, isLoading } = usePlanStore();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.dir() === 'rtl';

    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    const [formData, setFormData] = useState({
        name: '',
        duration: 30,
        price: 0,
        description: '',
        isActive: true
    });

    useEffect(() => {
        fetchPlans();
    }, []);

    // --- DERIVED STATS ---
    const stats = useMemo(() => {
        const total = plans.length;
        const active = plans.filter(p => p.isActive).length;
        const avgPrice = total > 0
            ? plans.reduce((acc, p) => acc + parseFloat(p.price || 0), 0) / total
            : 0;

        return { total, active, avgPrice };
    }, [plans]);

    const handleOpenModal = (plan = null) => {
        if (plan) {
            setEditingPlan(plan);
            setFormData({
                name: plan.name,
                duration: plan.duration,
                price: plan.price,
                description: plan.description || '',
                isActive: plan.isActive
            });
        } else {
            setEditingPlan(null);
            setFormData({
                name: '',
                duration: 30,
                price: 0,
                description: '',
                isActive: true
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const data = {
            ...formData,
            duration: parseInt(formData.duration),
            price: parseFloat(formData.price)
        };
        let result = editingPlan
            ? await updatePlan(editingPlan.id, data)
            : await createPlan(data);
        setIsSaving(false);
        if (result.success) {
            toast.success(editingPlan ? t('plans.planUpdated', 'Plan updated successfully') : t('plans.planCreated', 'Plan created successfully'));
            setShowModal(false);
        } else {
            toast.error(result.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm(t('plans.confirmDelete', 'Are you sure?'))) {
            const result = await deletePlan(id);
            if (result.success) toast.success(t('plans.planDeleted', 'Plan deleted'));
            else toast.error(result.message);
        }
    };

    const toggleStatus = async (plan) => {
        const result = await updatePlan(plan.id, { isActive: !plan.isActive });
        if (result.success) toast.success(`Plan ${plan.isActive ? 'deactivated' : 'activated'}`);
        else toast.error(result.message);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* HEADER & STATS */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                            {t('plans.title', 'Plans Management')}
                        </h1>
                        <p className="text-gray-400 mt-1 text-sm font-medium tracking-wide">
                            {t('plans.subtitle', 'Create and manage subscription packages')}
                        </p>
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="group relative flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white font-bold shadow-lg shadow-blue-900/20 hover:shadow-blue-600/40 hover:scale-105 active:scale-95 transition-all duration-300"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                        <span>{t('plans.addPlan', 'Add New Plan')}</span>
                    </button>
                </div>

                {/* DASHBOARD STATS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        title={t('plans.stats.total', 'Total Plans')}
                        value={stats.total}
                        icon={Layers}
                        color="blue"
                        loading={isLoading}
                    />
                    <StatCard
                        title={t('plans.stats.active', 'Active Plans')}
                        value={stats.active}
                        icon={CheckCircle}
                        color="green"
                        loading={isLoading}
                    />
                    <StatCard
                        title={t('plans.stats.avgPrice', 'Avg. Price')}
                        value={formatCurrency(stats.avgPrice, i18n.language, currencyConf)}
                        icon={TrendingUp}
                        color="purple" // Consistent with GymReport
                        loading={isLoading}
                    />
                </div>
            </div>

            {/* PLANS GRID */}
            {isLoading && plans.length === 0 ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                </div>
            ) : plans.length === 0 ? (
                <div className="text-center py-20 text-gray-500 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No plans found. Create your first plan!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -5 }}
                            className={`
                                relative overflow-hidden rounded-2xl p-6 transition-all duration-300 group
                                border border-white/10 backdrop-blur-xl shadow-xl
                                ${plan.isActive
                                    ? 'bg-slate-900/60 hover:shadow-blue-500/20 hover:border-blue-500/30'
                                    : 'bg-slate-900/30 opacity-75 grayscale hover:grayscale-0'}
                            `}
                        >
                            {/* Glow Effect */}
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <CreditCard className="w-24 h-24 text-white transform rotate-12 translate-x-4 -translate-y-4" />
                            </div>

                            <div className="relative z-10 flex flex-col h-full">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-xl font-bold text-white mb-1 truncate" title={plan.name}>
                                            {plan.name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                            {plan.isActive ? (
                                                <span className="text-emerald-400 flex items-center gap-1">
                                                    <CheckCircle size={12} /> {t('plans.active', 'Active')}
                                                </span>
                                            ) : (
                                                <span className="text-gray-500 flex items-center gap-1">
                                                    <XCircle size={12} /> {t('plans.inactive', 'Inactive')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenModal(plan)}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(plan.id)}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="mb-6">
                                    <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                                        {formatCurrency(plan.price, i18n.language, currencyConf)}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="mt-auto space-y-3">
                                    <div className="flex items-center gap-3 text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                                        <Clock className="w-5 h-5 text-indigo-400" />
                                        <span className="font-medium">{plan.duration} {t('common.days', 'Days')}</span>
                                    </div>
                                    {plan.description && (
                                        <p className="text-sm text-gray-500 line-clamp-2 h-10 leading-relaxed px-1">
                                            {plan.description}
                                        </p>
                                    )}
                                </div>

                                {/* Toggle Status Button (Bottom) */}
                                <button
                                    onClick={() => toggleStatus(plan)}
                                    className={`mt-4 w-full py-2.5 rounded-lg font-bold text-sm transition-all border
                                        ${plan.isActive
                                            ? 'bg-white/5 border-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                                            : 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                                        }`}
                                >
                                    {plan.isActive ? t('plans.deactivate', 'Deactivate Plan') : t('plans.activate', 'Activate Plan')}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* CREATE/EDIT MODAL - GLASS STYLE */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-lg bg-gray-900/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold text-white">
                                        {editingPlan ? t('plans.editPlan', 'Edit Plan') : t('plans.addPlan', 'Create Plan')}
                                    </h3>
                                    <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-bold">
                                        {editingPlan ? 'Configure Package Details' : 'New Subscription Package'}
                                    </p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="p-8 space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">{t('plans.name', 'Plan Name')}</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="e.g. Gold Membership"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-300 mb-2">{t('plans.duration', 'Duration (Days)')}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                                value={formData.duration}
                                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                                required
                                            />
                                            <Calendar className="absolute left-3 top-3.5 text-gray-500 w-4 h-4" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-300 mb-2">{t('plans.price', 'Price')}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                required
                                            />
                                            <DollarSign className="absolute left-3 top-3.5 text-gray-500 w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">{t('plans.description', 'Description')}</label>
                                    <textarea
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                                        placeholder="Features included..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                {editingPlan && (
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                                        <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                            <input
                                                type="checkbox"
                                                id="isActive"
                                                className="peer absolute opacity-0 w-0 h-0"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            />
                                            <label htmlFor="isActive" className={`block w-12 h-6 rounded-full cursor-pointer transition-colors ${formData.isActive ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                                            <span className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </div>
                                        <label htmlFor="isActive" className="text-sm font-medium text-gray-300 cursor-pointer select-none">
                                            {t('plans.activeStatus', 'Plan is Active & Visible')}
                                        </label>
                                    </div>
                                )}

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5"
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/30 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                <span>{editingPlan ? t('common.save', 'Save Changes') : t('common.create', 'Create Plan')}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Plans;
