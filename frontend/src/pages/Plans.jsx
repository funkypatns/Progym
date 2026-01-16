
/**
 * ============================================
 * PLANS MANAGEMENT PAGE
 * ============================================
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Edit2,
    Trash2,
    CheckCircle,
    XCircle,
    Loader2,
    Save,
    X,
    CreditCard,
    Calendar,
    DollarSign,
    Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlanStore, useSettingsStore } from '../store';
import { formatCurrency } from '../utils/numberFormatter';

const Plans = () => {
    const { t, i18n } = useTranslation();
    const { plans, fetchPlans, createPlan, updatePlan, deletePlan, isLoading } = usePlanStore();
    const { getSetting } = useSettingsStore();

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
        fetchPlans(); // Fetch all plans (active & inactive)
    }, []);

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

        let result;
        if (editingPlan) {
            result = await updatePlan(editingPlan.id, data);
        } else {
            result = await createPlan(data);
        }

        setIsSaving(false);

        if (result.success) {
            toast.success(editingPlan ? 'Plan updated successfully' : 'Plan created successfully');
            setShowModal(false);
        } else {
            toast.error(result.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this plan?')) {
            const result = await deletePlan(id);
            if (result.success) {
                toast.success('Plan deleted (soft delete)');
            } else {
                toast.error(result.message);
            }
        }
    };

    const toggleStatus = async (plan) => {
        const result = await updatePlan(plan.id, { isActive: !plan.isActive });
        if (result.success) {
            toast.success(`Plan ${plan.isActive ? 'deactivated' : 'activated'}`);
        } else {
            toast.error(result.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {t('plans.title') || 'Plans Management'} / إدارة الخطط
                    </h1>
                    <p className="text-slate-500 dark:text-dark-400 mt-1">
                        Create and manage subscription plans
                    </p>
                </div>

                <button onClick={() => handleOpenModal()} className="btn-primary">
                    <Plus className="w-5 h-5" />
                    {t('plans.addPlan') || 'Add New Plan'}
                </button>
            </div>

            {/* Plans Grid */}
            {isLoading && plans.length === 0 ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-dark-400" />
                </div>
            ) : plans.length === 0 ? (
                <div className="text-center py-20 text-slate-500 dark:text-dark-400 border-2 border-dashed border-gray-200 dark:border-dark-700 rounded-xl">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No plans found. Create your first plan!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`card relative overflow-hidden group flex flex-col justify-between ${!plan.isActive ? 'opacity-60 grayscale' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-4 gap-4">
                                <div className="min-w-0">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 truncate" title={plan.name}>
                                        {plan.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-dark-400 line-clamp-2 min-h-[1.25rem]">
                                        {plan.description || 'No description'}
                                    </p>
                                </div>

                                {/* Status & Actions */}
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => toggleStatus(plan)}
                                        className={`p-1.5 rounded-full transition-colors ${plan.isActive
                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-red-100 hover:text-red-500'
                                            : 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400 hover:bg-emerald-100 hover:text-emerald-500'
                                            }`}
                                        title={plan.isActive ? 'Deactivate' : 'Activate'}
                                    >
                                        {plan.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal(plan)}
                                        className="p-1.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                        title="Edit"
                                        style={{ pointerEvents: 'auto' }} // Ensure clickable
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(plan.id)}
                                        className="p-1.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mt-auto pt-4 border-t border-gray-100 dark:border-dark-800">
                                <div className="flex items-center gap-2 text-slate-700 dark:text-dark-200">
                                    <Clock className="w-4 h-4 text-primary-500" />
                                    <span className="font-medium">{plan.duration} Days</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700 dark:text-dark-200">
                                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(plan.price, i18n.language, currencyConf)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="modal-content p-6 max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                    {editingPlan ? 'Edit Plan' : 'Create New Plan'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="label">Plan Name</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g. Monthly Standard"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Duration (Days)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="input"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Price</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="input pl-8"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                required
                                            />
                                            <span className="absolute left-3 top-3 text-slate-400 text-sm">
                                                {currencyConf.symbol}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Description (Optional)</label>
                                    <textarea
                                        className="input min-h-[80px]"
                                        placeholder="Plan details..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                {editingPlan && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                        <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-dark-300">
                                            Active Plan (Available for new subscriptions)
                                        </label>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-100 dark:border-dark-700">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="btn-primary"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                <span>{editingPlan ? 'Update Plan' : 'Create Plan'}</span>
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
