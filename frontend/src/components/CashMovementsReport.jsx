import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Loader2,
    RefreshCw,
    FileSpreadsheet,
    ArrowDownCircle,
    ArrowUpCircle,
    Banknote,
    Calendar,
    Download
} from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatter';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useSettingsStore } from '../store';
import ReportLayout from './Reports/ReportLayout';

const parseContentDispositionFilename = (headerValue, fallbackName) => {
    if (!headerValue || typeof headerValue !== 'string') return fallbackName;
    const match = headerValue.match(/filename="(.+?)"/i);
    return match?.[1] || fallbackName;
};

const CashMovementsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';

    const [data, setData] = useState({ data: [], totals: { payIn: 0, payOut: 0, net: 0, count: 0 } });
    const [isLoading, setIsLoading] = useState(false);

    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        type: ''
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
    }, [isActive]);

    const handleExport = async () => {
        if (!data.data.length) return;
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);
            if (filters.type) params.set('type', filters.type);
            params.set('format', 'excel');

            const response = await api.get(`/reports/payInOut?${params.toString()}`, {
                responseType: 'blob'
            });

            const fallbackName = `cash-movements-${new Date().toISOString().split('T')[0]}.xlsx`;
            const filename = parseContentDispositionFilename(response.headers?.['content-disposition'], fallbackName);
            const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(t('reports.exportSuccess', 'Exported successfully'));
        } catch (error) {
            toast.error(t('reports.exportFailed', 'Export failed'));
        }
    };

    if (!isActive) return null;

    return (
        <ReportLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <ReportLayout.Header
                    icon={Banknote}
                    title={t('payInOut.title', 'النقدية الخاص')}
                    subtitle={t('payInOut.subtitle', 'Cash drawer manual movements')}
                />

                <ReportLayout.FilterBar>
                    <ReportLayout.DateInput
                        label={t('reports.startDate', 'تاريخ البدء')}
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        icon={Calendar}
                    />
                    <ReportLayout.DateInput
                        label={t('reports.endDate', 'تاريخ الانتهاء')}
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        icon={Calendar}
                    />

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <FileSpreadsheet size={14} />
                            {t('payInOut.type', 'Type')}
                        </label>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                        >
                            <option value="">{t('common.all', 'الكل')}</option>
                            <option value="IN">{t('payInOut.in', 'In')}</option>
                            <option value="OUT">{t('payInOut.out', 'Out')}</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <ReportLayout.RefreshButton
                            onClick={fetchReport}
                            loading={isLoading}
                            icon={RefreshCw}
                        >
                            {t('common.refresh', 'تحديث')}
                        </ReportLayout.RefreshButton>

                        <button
                            onClick={handleExport}
                            disabled={!data.data.length}
                            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
                        >
                            <Download size={18} />
                            {t('common.export', 'تصدير')}
                        </button>
                    </div>
                </ReportLayout.FilterBar>

                <ReportLayout.MetricsGrid>
                    <ReportLayout.MetricCard
                        icon={FileSpreadsheet}
                        label={t('reports.fields.count', 'TRANSACTIONS')}
                        value={formatNumber(data.totals.count || 0, i18n.language)}
                        color="blue"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={Banknote}
                        label={t('payInOut.net', 'NET')}
                        value={formatCurrency(data.totals.net, i18n.language, currencyConf)}
                        color="teal"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={ArrowDownCircle}
                        label={t('payInOut.totalIn', 'TOTAL PAY IN')}
                        value={`+${formatCurrency(data.totals.payIn, i18n.language, currencyConf)}`}
                        color="emerald"
                        loading={isLoading}
                    />
                    <ReportLayout.MetricCard
                        icon={ArrowUpCircle}
                        label={t('payInOut.totalOut', 'TOTAL PAY OUT')}
                        value={`-${formatCurrency(data.totals.payOut, i18n.language, currencyConf)}`}
                        color="red"
                        loading={isLoading}
                    />
                </ReportLayout.MetricsGrid>

                <ReportLayout.Content>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                        </div>
                    ) : data.data.length === 0 ? (
                        <ReportLayout.EmptyState
                            icon={Banknote}
                            title={t('reports.noData', 'لا توجد بيانات')}
                            subtitle={t('reports.adjustFilters', 'اضبط المرشحات او اختر نطاق تاريخ اخر')}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 border-b border-white/5">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('reports.fields.date', 'Date')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('payInOut.type', 'Type')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('reports.fields.amount', 'Amount')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('payInOut.reason', 'Reason')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('reports.fields.notes', 'Notes')}
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                            {t('reports.fields.employee', 'Employee')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.data.map((movement) => (
                                        <tr key={movement.id} className="hover:bg-white/5 transition">
                                            <td className="p-4 text-slate-300 font-mono text-xs text-center">
                                                {formatDateTime(movement.createdAt)}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex justify-center">
                                                    {movement.type === 'IN' ? (
                                                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                                                            <ArrowDownCircle size={14} />
                                                            {t('payInOut.in', 'In')}
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-fit">
                                                            <ArrowUpCircle size={14} />
                                                            {t('payInOut.out', 'Out')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`p-4 text-center font-bold ${movement.type === 'IN' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {movement.type === 'IN' ? '+' : '-'}{formatCurrency(movement.amount, i18n.language, currencyConf)}
                                            </td>
                                            <td className="p-4 text-white text-center">{movement.reason}</td>
                                            <td className="p-4 text-slate-400 italic text-xs text-center">{movement.notes || '-'}</td>
                                            <td className="p-4 text-slate-300 text-center">
                                                {movement.employee ? `${movement.employee.firstName} ${movement.employee.lastName}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </ReportLayout.Content>
            </div>
        </ReportLayout>
    );
};

export default CashMovementsReport;
