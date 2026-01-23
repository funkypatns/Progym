import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Loader2,
    RefreshCw,
    FileSpreadsheet,
    ArrowDownCircle,
    ArrowUpCircle,
    Banknote,
    Calendar
} from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useSettingsStore } from '../store';

const CashMovementsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const [data, setData] = useState({ data: [], totals: { payIn: 0, payOut: 0, net: 0 } });
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        type: '',
        employeeId: ''
    });

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams(filters);
            const response = await api.get(`/cash-movements?${params}`);

            // Calculate totals manually if backend doesn't return them for specific filters
            const movements = response.data.data || [];
            const payIn = movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + (m.amount || 0), 0);
            const payOut = movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + (m.amount || 0), 0);

            setData({
                data: movements,
                totals: { payIn, payOut, net: payIn - payOut }
            });

        } catch (error) {
            console.error('Failed to fetch cash movements report', error);
            toast.error(t('reports.errors.serverError') || 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchReport();
        }
    }, [isActive, filters.startDate, filters.endDate, filters.type]);

    const handleExport = () => {
        if (!data.data.length) return;

        const headers = ["Date", "Type", "Amount", "Reason", "Notes", "Employee"];
        const rows = data.data.map(m => [
            formatDateTime(m.createdAt, 'en'),
            m.type,
            m.amount,
            `"${m.reason}"`,
            `"${m.notes || ''}"`,
            `"${m.employee?.firstName} ${m.employee?.lastName}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Cash_Movements_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    if (!isActive) return null;

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pay In */}
                <div className="bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 p-5 flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {t('payInOut.in') || 'Total Pay In'}
                        </p>
                        <h3 className="text-2xl font-bold text-white">
                            +{formatCurrency(data.totals.payIn, i18n.language, currencyConf)}
                        </h3>
                    </div>
                    <div className="p-3 bg-emerald-500 rounded-xl">
                        <ArrowDownCircle className="w-6 h-6 text-white" />
                    </div>
                </div>

                {/* Pay Out */}
                <div className="bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 p-5 flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {t('payInOut.out') || 'Total Pay Out'}
                        </p>
                        <h3 className="text-2xl font-bold text-white">
                            -{formatCurrency(data.totals.payOut, i18n.language, currencyConf)}
                        </h3>
                    </div>
                    <div className="p-3 bg-red-500 rounded-xl">
                        <ArrowUpCircle className="w-6 h-6 text-white" />
                    </div>
                </div>

                {/* Net */}
                <div className="bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 p-5 flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {t('payInOut.net') || 'Net'}
                        </p>
                        <h3 className="text-2xl font-bold text-white">
                            {formatCurrency(data.totals.net, i18n.language, currencyConf)}
                        </h3>
                    </div>
                    <div className="p-3 bg-indigo-500 rounded-xl">
                        <Banknote className="w-6 h-6 text-white" />
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {i18n.language === 'ar' ? 'من' : 'From'}
                        </label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        />
                    </div>
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {i18n.language === 'ar' ? 'إلى' : 'To'}
                        </label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        />
                    </div>
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">
                            {i18n.language === 'ar' ? 'النوع' : 'Type'}
                        </label>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        >
                            <option value="">{i18n.language === 'ar' ? 'الكل' : 'All'}</option>
                            <option value="IN">{t('payInOut.in') || 'Pay In'}</option>
                            <option value="OUT">{t('payInOut.out') || 'Pay Out'}</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={fetchReport}
                            disabled={isLoading}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            <RefreshCw size={18} />
                            {i18n.language === 'ar' ? 'تحديث' : 'Refresh'}
                        </button>
                        <button
                            onClick={handleExport}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        >
                            <FileSpreadsheet size={18} />
                            {i18n.language === 'ar' ? 'تصدير' : 'Export'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 overflow-hidden">
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">Loading...</p>
                    </div>
                ) : data.data.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Banknote className="w-12 h-12 text-gray-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">{i18n.language === 'ar' ? 'لا توجد بيانات' : 'No data available'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900/50 border-b border-slate-700/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {i18n.language === 'ar' ? 'التاريخ' : 'Date'}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {i18n.language === 'ar' ? 'النوع' : 'Type'}
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {i18n.language === 'ar' ? 'المبلغ' : 'Amount'}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {i18n.language === 'ar' ? 'السبب' : 'Reason'}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {i18n.language === 'ar' ? 'الموظف' : 'Employee'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {data.data.map((movement, idx) => (
                                    <tr key={movement.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3 text-white">
                                            <span className="text-sm font-medium">
                                                {formatDateTime(movement.createdAt, i18n.language)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${movement.type === 'IN'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {movement.type === 'IN' ? (t('payInOut.in') || 'Pay In') : (t('payInOut.out') || 'Pay Out')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-mono font-semibold ${movement.type === 'IN' ? 'text-emerald-400' : 'text-red-400'
                                                }`}>
                                                {movement.type === 'IN' ? '+' : '-'}{formatCurrency(movement.amount, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-white">{movement.reason}</p>
                                                {movement.notes && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{movement.notes}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-300">
                                                {movement.employee?.firstName} {movement.employee?.lastName}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CashMovementsReport;
