import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowUpCircle,
    ArrowDownCircle,
    History,
    Plus,
    Filter,
    Calendar,
    User,
    FileText,
    Loader2
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
            toast.error('Failed to load history');
        } finally {
            setHistoryLoading(false);
        }
    };

    const onSubmit = async (data) => {
        if (!currentShift) {
            toast.error('No active shift found');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/cash-movements', {
                ...data,
                amount: parseFloat(data.amount)
            });
            toast.success(t('payInOut.success'));
            reset();
            // Optional: Switch to history or just showing last added?
        } catch (error) {
            toast.error(error.response?.data?.message || t('payInOut.error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {t('payInOut.title', 'Pay In / Pay Out')}
                </h1>
                <p className="text-slate-500 dark:text-dark-400 mt-1">
                    {t('payInOut.subtitle', 'Manage cash drawer adjustments')}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-dark-700">
                <button
                    onClick={() => setActiveTab('entry')}
                    className={`pb-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'entry'
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-dark-400'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        {t('payInOut.newEntry', 'New Entry')}
                    </span>
                    {activeTab === 'entry' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'history'
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-dark-400'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <History className="w-4 h-4" />
                        {t('payInOut.history', 'History')}
                    </span>
                    {activeTab === 'history' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-500" />
                    )}
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'entry' ? (
                <div className="max-w-2xl mx-auto mt-8">
                    <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-800 p-6 md:p-8">
                        {!currentShift ? (
                            <div className="text-center py-8 text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl">
                                <p className="font-semibold">Shift Not Active</p>
                                <p className="text-sm mt-1">Please open a shift to record cash movements.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {/* Type Selection */}
                                <div className="grid grid-cols-2 gap-4">
                                    <label className={`
                                        cursor-pointer relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all
                                        ${watchType === 'OUT'
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/10 dark:border-red-500/50'
                                            : 'border-gray-200 dark:border-dark-700 hover:border-red-200'}
                                    `}>
                                        <input type="radio" value="OUT" {...register('type')} className="sr-only" />
                                        <ArrowUpCircle className={`w-8 h-8 ${watchType === 'OUT' ? 'text-red-500' : 'text-gray-400'}`} />
                                        <div className="text-center">
                                            <span className={`block font-bold ${watchType === 'OUT' ? 'text-red-700 dark:text-red-400' : 'text-gray-500'}`}>{t('payInOut.out')}</span>
                                        </div>
                                    </label>

                                    <label className={`
                                        cursor-pointer relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all
                                        ${watchType === 'IN'
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-500/50'
                                            : 'border-gray-200 dark:border-dark-700 hover:border-emerald-200'}
                                    `}>
                                        <input type="radio" value="IN" {...register('type')} className="sr-only" />
                                        <ArrowDownCircle className={`w-8 h-8 ${watchType === 'IN' ? 'text-emerald-500' : 'text-gray-400'}`} />
                                        <div className="text-center">
                                            <span className={`block font-bold ${watchType === 'IN' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}`}>{t('payInOut.in')}</span>
                                        </div>
                                    </label>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="label">{t('payInOut.amount')}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input text-lg font-mono pl-8"
                                            placeholder="0.00"
                                            {...register('amount', { required: t('errors.required'), min: 0.01 })}
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                            {i18n.language === 'ar' ? 'ج.م' : '$'}
                                        </span>
                                    </div>
                                    {errors.amount && <p className="error-text">{errors.amount.message}</p>}
                                </div>

                                {/* Reason */}
                                <div>
                                    <label className="label">{t('payInOut.reason')}</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder={t('payInOut.reason')}
                                        {...register('reason', { required: t('errors.required') })}
                                    />
                                    {errors.reason && <p className="error-text">{errors.reason.message}</p>}
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="label">{t('payInOut.notes')} <span className="text-gray-400 font-normal">({t('common.optional')})</span></label>
                                    <textarea
                                        className="input h-24 resize-none"
                                        placeholder=""
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
                                        `${t('common.confirm')} - ${watchType === 'OUT' ? t('payInOut.out') : t('payInOut.in')}`
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-800 p-6">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-6">
                        <div className="flex-1 min-w-[200px]">
                            <label className="label text-xs mb-1">Date Range</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    className="input py-1.5"
                                    value={filters.startDate}
                                    onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                />
                                <span className="text-gray-400">to</span>
                                <input
                                    type="date"
                                    className="input py-1.5"
                                    value={filters.endDate}
                                    onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="w-32">
                            <label className="label text-xs mb-1">Type</label>
                            <select
                                className="input py-1.5"
                                value={filters.type}
                                onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
                            >
                                <option value="">All</option>
                                <option value="IN">In</option>
                                <option value="OUT">Out</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-gray-100 dark:border-dark-800">
                                <tr>
                                    <th className="pb-3 text-xs font-semibold text-gray-500">Date/Time</th>
                                    <th className="pb-3 text-xs font-semibold text-gray-500">Type</th>
                                    <th className="pb-3 text-xs font-semibold text-gray-500">Reason</th>
                                    <th className="pb-3 text-xs font-semibold text-gray-500">Employee</th>
                                    <th className="pb-3 text-xs font-semibold text-gray-500 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-dark-800">
                                {historyLoading ? (
                                    <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                                ) : movements.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-gray-400">No records found</td></tr>
                                ) : (
                                    movements.map(m => (
                                        <tr key={m.id} className="group hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                                            <td className="py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                                {formatDate(m.createdAt)}
                                            </td>
                                            <td className="py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold
                                                    ${m.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                                                `}>
                                                    {m.type}
                                                </span>
                                            </td>
                                            <td className="py-3 text-sm text-gray-900 dark:text-white font-medium">
                                                {m.reason}
                                                {m.notes && <p className="text-xs text-gray-400 font-normal mt-0.5">{m.notes}</p>}
                                            </td>
                                            <td className="py-3 text-sm text-gray-600 dark:text-gray-400">
                                                {m.employee.firstName}
                                            </td>
                                            <td className="py-3 text-right font-mono font-medium">
                                                <span className={m.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}>
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
