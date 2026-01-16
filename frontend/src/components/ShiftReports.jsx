import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';

const ShiftReports = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

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
            // Safe access
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
    }, [isActive]); // Removed dateRange from dep array to avoid auto-refetch on typing, user clicks refresh

    if (!isActive) return null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div>
                    <label className="label">{t('reports.from')}</label>
                    <input
                        type="date"
                        className="input"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    />
                </div>
                <div>
                    <label className="label">{t('reports.to')}</label>
                    <input
                        type="date"
                        className="input"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    />
                </div>
                <button onClick={fetchShifts} className="btn-secondary h-[42px] mb-[1px]">
                    <span className="hidden sm:inline">{t('common.refresh')}</span>
                </button>
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-700/50 border-b border-gray-100 dark:border-dark-700 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="p-4">{t('reports.date')}</th>
                                <th className="p-4">{t('auth.role_staff')}</th>
                                <th className="p-4 text-right">Expected</th>
                                <th className="p-4 text-right">Actual</th>
                                <th className="p-4 text-right">Diff</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading...
                                    </td>
                                </tr>
                            ) : shifts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        No shifts found for this period
                                    </td>
                                </tr>
                            ) : (
                                shifts.map(shift => {
                                    const diff = shift.cashDifference || 0;
                                    const status = Math.abs(diff) < 0.01 ? 'MATCHED' : diff > 0 ? 'OVER' : 'SHORT';
                                    const statusColor = status === 'MATCHED' ? 'badge-success' : status === 'OVER' ? 'badge-warning' : 'badge-danger';

                                    return (
                                        <tr key={shift.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {formatDateTime(shift.openedAt, i18n.language)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    to {formatDateTime(shift.closedAt, i18n.language)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                                                        {shift.opener?.firstName?.[0]}
                                                    </div>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        {shift.opener?.firstName} {shift.opener?.lastName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-gray-600 dark:text-gray-400">
                                                {formatCurrency(shift.expectedCash || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(shift.closingCash || 0, i18n.language, currencyConf)}
                                            </td>
                                            <td className={`p-4 text-right font-mono font-bold ${diff > 0 ? 'text-orange-500' : diff < 0 ? 'text-red-500' : 'text-emerald-500'
                                                }`}>
                                                {diff > 0 ? '+' : ''}{formatCurrency(diff, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {shift.activityType === 'NO_ACTIVITY' ? (
                                                    <span className="badge bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                                        NO ACTIVITY
                                                    </span>
                                                ) : (
                                                    <span className={`badge ${statusColor}`}>
                                                        {status}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ShiftReports;
