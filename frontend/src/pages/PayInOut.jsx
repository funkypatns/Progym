import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowUpCircle,
    ArrowDownCircle,
    History,
    Plus,
    Loader2,
    AlertCircle,
    Banknote
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { usePosStore } from '../store';
import { formatDate } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';

const PayInOut = () => {
    const { t, i18n } = useTranslation();
    const { currentShift } = usePosStore();
    const [activeTab, setActiveTab] = useState('entry'); // entry, history
    const [isLoading, setIsLoading] = useState(false);

    // History State
    const [movements, setMovements] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [filters, setFilters] = useState({
        type: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const isRTL = i18n.language === 'ar';
    const alignStart = isRTL ? 'text-right' : 'text-left';
    const alignEnd = isRTL ? 'text-left' : 'text-right';

    // Form
    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
        defaultValues: {
            type: 'OUT',
            amount: '',
            reason: '',
            notes: ''
        }
    });

    const watchType = watch('type');

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, filters]);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const params = new URLSearchParams(filters);
            if (currentShift) params.append('shiftId', currentShift.id); // Default to current shift or remove to see all?
            // Let's show all for the date range
            const response = await api.get(`/cash-movements?${params}`);
            setMovements(response.data.data);
        } catch (error) {
            toast.error(t('payInOut.historyError', 'Failed to load history'));
        } finally {
            setHistoryLoading(false);
        }
    };

    const onSubmit = async (data) => {
        if (!currentShift) {
            toast.error(t('payInOut.noActiveShift', 'No active shift found'));
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/cash-movements', {
                ...data,
                amount: parseFloat(data.amount)
            });
            toast.success(t('payInOut.success', 'Cash movement saved'));
            reset();
            // Optional: Switch to history or just showing last added?
        } catch (error) {
            toast.error(error.response?.data?.message || t('payInOut.error', 'Failed to save cash movement'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Banknote className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                        {t('payInOut.title', 'Pay in / pay out')}
                    </h1>
                    <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
                        {t('payInOut.subtitle', 'Manage cash drawer adjustments')}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-center">
                <div className="inline-flex bg-slate-800/40 border border-slate-700/50 rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab('entry')}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'entry'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                    >
                        <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Plus className="w-4 h-4" />
                            {t('payInOut.newEntry', 'New entry')}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'history'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                    >
                        <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <History className="w-4 h-4" />
                            {t('payInOut.history', 'History')}
                        </span>
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'entry' ? (
                <div className="max-w-3xl mx-auto">
                    <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 md:p-8 shadow-lg">
                        {!currentShift ? (
                            <div className="text-center py-8 text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <p className="font-semibold">{t('payInOut.shiftInactive', 'Shift not active')}</p>
                                <p className="text-sm mt-1 text-amber-300">
                                    {t('payInOut.shiftInactiveHint', 'Please open a shift to record cash movements.')}
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {/* Type Selection */}
                                <div className="grid grid-cols-2 gap-4">
                                    <label className={`
                                        cursor-pointer relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all
                                        ${watchType === 'OUT'
                                            ? 'border-red-500/60 bg-red-500/10'
                                            : 'border-slate-700/50 bg-slate-900/40 hover:border-red-500/40'}
                                    `}>
                                        <input type="radio" value="OUT" {...register('type')} className="sr-only" />
                                        <ArrowUpCircle className={`w-8 h-8 ${watchType === 'OUT' ? 'text-red-500' : 'text-gray-400'}`} />
                                        <div className="text-center">
                                            <span className={`block font-bold ${watchType === 'OUT' ? 'text-red-400' : 'text-gray-400'}`}>
                                                {t('payInOut.out', 'Pay out')}
                                            </span>
                                        </div>
                                    </label>

                                    <label className={`
                                        cursor-pointer relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all
                                        ${watchType === 'IN'
                                            ? 'border-emerald-500/60 bg-emerald-500/10'
                                            : 'border-slate-700/50 bg-slate-900/40 hover:border-emerald-500/40'}
                                    `}>
                                        <input type="radio" value="IN" {...register('type')} className="sr-only" />
                                        <ArrowDownCircle className={`w-8 h-8 ${watchType === 'IN' ? 'text-emerald-500' : 'text-gray-400'}`} />
                                        <div className="text-center">
                                            <span className={`block font-bold ${watchType === 'IN' ? 'text-emerald-400' : 'text-gray-400'}`}>
                                                {t('payInOut.in', 'Pay in')}
                                            </span>
                                        </div>
                                    </label>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="label">{t('payInOut.amount', 'Amount')}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input text-lg font-mono pl-8"
                                            placeholder={t('payInOut.amountPlaceholder', '0.00')}
                                            {...register('amount', { required: t('errors.required', 'Required'), min: 0.01 })}
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                            {i18n.language === 'ar' ? 'ج.م' : '$'}
                                        </span>
                                    </div>
                                    {errors.amount && <p className="error-text">{errors.amount.message}</p>}
                                </div>

                                {/* Reason */}
                                <div>
                                    <label className="label">{t('payInOut.reason', 'Reason')}</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder={t('payInOut.reason', 'Reason')}
                                        {...register('reason', { required: t('errors.required', 'Required') })}
                                    />
                                    {errors.reason && <p className="error-text">{errors.reason.message}</p>}
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="label">
                                        {t('payInOut.notes', 'Notes')} <span className="text-gray-400 font-normal">({t('common.optional', 'Optional')})</span>
                                    </label>
                                    <textarea
                                        className="input h-24 resize-none"
                                        placeholder={t('payInOut.notesPlaceholder', '')}
                                        {...register('notes')}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl hover:translate-y-[-1px] active:translate-y-[0px]
                                        ${watchType === 'OUT'
                                            ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'}
                                    `}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                    ) : (
                                        `${t('common.confirm', 'Confirm')} - ${watchType === 'OUT'
                                            ? t('payInOut.out', 'Pay out')
                                            : t('payInOut.in', 'Pay in')}`
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 shadow-lg">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-6">
                        <div className="flex-1 min-w-[200px]">
                            <label className="label text-xs mb-1">{t('reports.dateRange', 'Date range')}</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    className="input py-1.5"
                                    value={filters.startDate}
                                    onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                />
                                <span className="text-gray-400">{t('reports.to', 'to')}</span>
                                <input
                                    type="date"
                                    className="input py-1.5"
                                    value={filters.endDate}
                                    onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="w-32">
                            <label className="label text-xs mb-1">{t('reports.type', 'Type')}</label>
                            <select
                                className="input py-1.5"
                                value={filters.type}
                                onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
                            >
                                <option value="">{t('common.all', 'All')}</option>
                                <option value="IN">{t('payInOut.in', 'Pay in')}</option>
                                <option value="OUT">{t('payInOut.out', 'Pay out')}</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900/70 border-b border-slate-700/50 sticky top-0">
                                <tr>
                                    <th className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t('reports.fields.paidAt', 'Date')}</th>
                                    <th className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t('reports.type', 'Type')}</th>
                                    <th className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t('reports.fields.reason', 'Reason')}</th>
                                    <th className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${alignStart}`}>{t('reports.fields.employee', 'Employee')}</th>
                                    <th className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${alignEnd}`}>{t('reports.fields.amount', 'Amount')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {historyLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                                            <p className="text-sm text-gray-400">{t('common.loading', 'Loading...')}</p>
                                        </td>
                                    </tr>
                                ) : movements.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center">
                                            <AlertCircle className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                                            <p className="text-sm text-gray-400">{t('common.noResults', 'No records found')}</p>
                                        </td>
                                    </tr>
                                ) : (
                                    movements.map(m => (
                                        <tr key={m.id} className="group hover:bg-slate-700/30 transition-colors">
                                            <td className={`px-4 py-3 text-sm text-gray-300 font-mono ${alignStart}`}>
                                                {formatDate(m.createdAt)}
                                            </td>
                                            <td className={`px-4 py-3 ${alignStart}`}>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold
                                                    ${m.type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
                                                `}>
                                                    {m.type === 'IN' ? t('payInOut.in', 'Pay in') : t('payInOut.out', 'Pay out')}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-white font-medium ${alignStart}`}>
                                                {m.reason}
                                                {m.notes && <p className="text-xs text-gray-400 font-normal mt-0.5">{m.notes}</p>}
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-gray-400 ${alignStart}`}>
                                                {m.employee?.firstName} {m.employee?.lastName}
                                            </td>
                                            <td className={`px-4 py-3 font-mono font-medium ${alignEnd}`}>
                                                <span className={m.type === 'IN' ? 'text-emerald-400' : 'text-red-400'}>
                                                    {m.type === 'OUT' ? '-' : '+'}{formatCurrency(m.amount)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayInOut;
