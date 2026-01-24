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
import ReportSummaryCards from './ReportSummaryCards';

const CashMovementsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';
    const alignStart = isRTL ? 'text-right' : 'text-left';
    const alignEnd = isRTL ? 'text-left' : 'text-right';

    const [data, setData] = useState({ data: [], totals: { payIn: 0, payOut: 0, net: 0, count: 0 } });
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
                totals: { payIn, payOut, net: payIn - payOut, count: movements.length }
            });

        } catch (error) {
            toast.error(t('reports.errors.serverError', 'Failed to load report'));
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
            <ReportSummaryCards
                gridClassName="md:grid-cols-2 xl:grid-cols-4"
                items={[
                    {
                        label: t('payInOut.totalIn', 'Total pay in'),
                        value: `+${formatCurrency(data.totals.payIn, i18n.language, currencyConf)}`,
                        icon: ArrowDownCircle,
                        iconClassName: 'bg-emerald-500'
                    },
                    {
                        label: t('payInOut.totalOut', 'Total pay out'),
                        value: `-${formatCurrency(data.totals.payOut, i18n.language, currencyConf)}`,
                        icon: ArrowUpCircle,
                        iconClassName: 'bg-red-500'
                    },
                    {
                        label: t('payInOut.net', 'Net'),
                        value: formatCurrency(data.totals.net, i18n.language, currencyConf),
                        icon: Banknote,
                        iconClassName: 'bg-indigo-500'
                    },
                    {
                        label: t('reports.fields.count', 'Transactions'),
                        value: formatNumber(data.totals.count || 0, i18n.language),
                        icon: FileSpreadsheet,
                        iconClassName: 'bg-slate-600'
                    }
                ]}
            />

            {/* Toolbar */}
            <div className="bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {t('reports.from', 'From')}
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
                            {t('reports.to', 'To')}
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
                            {t('reports.type', 'Type')}
                        </label>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        >
                            <option value="">{t('common.all', 'All')}</option>
                            <option value="IN">{t('payInOut.in', 'Pay in')}</option>
                            <option value="OUT">{t('payInOut.out', 'Pay out')}</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={fetchReport}
                            disabled={isLoading}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            <RefreshCw size={18} />
                            {t('common.refresh', 'Refresh')}
                        </button>
                        <button
                            onClick={handleExport}
                            className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        >
                            <FileSpreadsheet size={18} />
                            {t('reports.export', 'Export')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 overflow-hidden">
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">{t('common.loading', 'Loading...')}</p>
                    </div>
                ) : data.data.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Banknote className="w-12 h-12 text-gray-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">{t('common.noResults', 'No data available')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900/70 border-b border-slate-700/50 sticky top-0">
                                <tr>
                                    <th className={`px-4 py-3  text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>
                                        {t('reports.fields.date', 'Date')}
                                    </th>
                                    <th className={`px-4 py-3  text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>
                                        {t('reports.type', 'Type')}
                                    </th>
                                    <th className={`px-4 py-3  text-xs font-bold text-gray-400 uppercase tracking-wider ${alignEnd}`}>
                                        {t('reports.fields.amount', 'Amount')}
                                    </th>
                                    <th className={`px-4 py-3  text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>
                                        {t('reports.fields.reason', 'Reason')}
                                    </th>
                                    <th className={`px-4 py-3  text-xs font-bold text-gray-400 uppercase tracking-wider ${alignStart}`}>
                                        {t('reports.fields.employee', 'Employee')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {data.data.map((movement, idx) => (
                                    <tr key={movement.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className={`px-4 py-3 text-white ${alignStart}`}>
                                            <span className="text-sm font-medium">
                                                {formatDateTime(movement.createdAt, i18n.language)}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 ${alignStart}`}>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${movement.type === 'IN'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {movement.type === 'IN' ? (t('payInOut.in', 'Pay in')) : (t('payInOut.out', 'Pay out'))}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3  ${alignEnd}`}>
                                            <span className={`font-mono font-semibold ${movement.type === 'IN' ? 'text-emerald-400' : 'text-red-400'
                                                }`}>
                                                {movement.type === 'IN' ? '+' : '-'}{formatCurrency(movement.amount, i18n.language, currencyConf)}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 ${alignStart}`}>
                                            <div>
                                                <p className="text-sm font-medium text-white">{movement.reason}</p>
                                                {movement.notes && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{movement.notes}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 ${alignStart}`}>
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

