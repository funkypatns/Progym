import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Calendar, RefreshCw, Search, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';

const ShiftReports = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [nameFilter, setNameFilter] = useState('');

    // Date filter state
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    const fetchShifts = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            const response = await apiClient.get(`/pos/shifts?${params}`);
            setShifts(Array.isArray(response.data?.data) ? response.data.data : []);
        } catch (error) {
            console.error('Failed to fetch shifts', error);
            toast.error('Failed to load shift reports');
            setShifts([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchShifts();
        }
    }, [isActive]);

    // Client-side name filtering
    const filteredShifts = useMemo(() => {
        if (!nameFilter.trim()) return shifts;
        const lowerFilter = nameFilter.toLowerCase();
        return shifts.filter(shift => {
            const firstName = shift.opener?.firstName?.toLowerCase() || '';
            const lastName = shift.opener?.lastName?.toLowerCase() || '';
            const fullName = `${firstName} ${lastName}`;
            return firstName.includes(lowerFilter) || lastName.includes(lowerFilter) || fullName.includes(lowerFilter);
        });
    }, [shifts, nameFilter]);

    if (!isActive) return null;

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Start Date */}
                    <div className="flex-1 min-w-[150px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {i18n.language === 'ar' ? 'من' : 'From'}
                        </label>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        />
                    </div>

                    {/* End Date */}
                    <div className="flex-1 min-w-[150px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {i18n.language === 'ar' ? 'إلى' : 'To'}
                        </label>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        />
                    </div>

                    {/* Name Filter */}
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Search size={14} />
                            {i18n.language === 'ar' ? 'فلتر بالاسم' : 'Filter by Name'}
                        </label>
                        <input
                            type="text"
                            placeholder={i18n.language === 'ar' ? 'بحث بالموظف...' : 'Search by staff...'}
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white placeholder:text-gray-500"
                        />
                    </div>

                    {/* Generate Button */}
                    <div className="flex items-center ml-auto">
                        <button
                            onClick={fetchShifts}
                            disabled={isLoading}
                            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                            {i18n.language === 'ar' ? 'تحديث' : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 border-b border-slate-700/50">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} />
                                        {t('reports.date')}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    {t('auth.role_staff')}
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                                    Expected
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                                    Actual
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                                    Diff
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            <AnimatePresence>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
                                            <p className="text-gray-400 font-medium">Loading shifts...</p>
                                        </td>
                                    </tr>
                                ) : filteredShifts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center">
                                            <AlertCircle className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                                            <p className="text-gray-400 font-medium">{t('common.noData')}</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredShifts.map((shift, idx) => {
                                        const diff = (shift.endedCash || 0) - (shift.expectedCash || 0);
                                        const isBalanced = Math.abs(diff) < 0.01;

                                        return (
                                            <motion.tr
                                                key={shift.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.03 }}
                                                className="hover:bg-slate-700/30 transition-colors"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-white">
                                                        {formatDateTime(shift.startedAt, i18n.language).split(',')[0]}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {shift.endedAt ? formatDateTime(shift.endedAt, i18n.language).split(',')[1] : 'Active'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-white">
                                                        {shift.opener?.firstName} {shift.opener?.lastName}
                                                    </div>
                                                    <div className="text-xs text-gray-500 capitalize">{shift.opener?.role || 'Staff'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-300">
                                                    {formatCurrency(shift.expectedCash || 0, i18n.language, currencyConf)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-white">
                                                    {shift.endedCash ? formatCurrency(shift.endedCash, i18n.language, currencyConf) : '-'}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-mono font-bold ${diff < 0 ? 'text-red-400' : diff > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                                                    {Math.abs(diff) > 0 ? (diff > 0 ? '+' : '') + formatCurrency(diff, i18n.language, currencyConf) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {!shift.endedAt ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-indigo-500/20 text-indigo-400">
                                                            Active
                                                        </span>
                                                    ) : isBalanced ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">
                                                            Balanced
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400">
                                                            Review
                                                        </span>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        );
                                    })
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ShiftReports;
