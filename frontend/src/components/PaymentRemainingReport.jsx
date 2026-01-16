import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Loader2, RefreshCcw, Download, DollarSign, Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatCurrency } from '../utils/numberFormatter'; // Removed formatNumber since it was not used or can use formatCurrency
import { formatDateTime } from '../utils/dateFormatter';
import { useAuthStore, useSettingsStore } from '../store';
import MemberLedgerModal from './MemberLedgerModal';
import MemberDetailsModal from './MemberDetailsModal';

// Helper to normalize backend response to safe defaults
const normalizeReportResponse = (data) => {
    if (!data) return null;
    return {
        rows: Array.isArray(data.rows) ? data.rows : [],
        summary: {
            totalDue: data.summary?.totalDue || 0,
            totalPaid: data.summary?.totalPaid || 0,
            totalRemaining: data.summary?.totalRemaining || 0,
            countUnpaid: data.summary?.countUnpaid || 0,
            countPartial: data.summary?.countPartial || 0,
            countSettled: data.summary?.countSettled || 0
        },
        metadata: {
            generatedAt: data.metadata?.generatedAt || new Date().toISOString(),
            recordCount: data.metadata?.recordCount || 0
        }
    };
};

const PaymentRemainingReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { user } = useAuthStore();
    const { getSetting } = useSettingsStore();

    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    const [filters, setFilters] = useState({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        search: '',
        planId: '',
        status: [],
        employeeId: '',
        remainingOnly: false
    });
    const [plans, setPlans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [ledgerTarget, setLedgerTarget] = useState(null); // { memberId, subscriptionId, memberName }
    const [viewMemberId, setViewMemberId] = useState(null);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    useEffect(() => {
        if (isActive) {
            fetchPlans();
            fetchEmployees();
        }
    }, [isActive]);

    const fetchPlans = async () => {
        try {
            const res = await apiClient.get('/plans');
            setPlans(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchEmployees = async () => {
        try {
            const res = await apiClient.get('/users/list');
            setEmployees(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                from: filters.from,
                to: filters.to
            });
            if (filters.search) params.append('search', filters.search);
            if (filters.planId) params.append('planId', filters.planId);
            if (filters.status.length > 0) params.append('status', filters.status.join(','));
            if (filters.employeeId) params.append('employeeId', filters.employeeId);
            if (filters.remainingOnly) params.append('remainingOnly', 'true');

            const res = await apiClient.get(`/reports/payment-remaining?${params}`);
            setData(normalizeReportResponse(res.data.success ? res.data.data : null));
        } catch (error) {
            console.error('Payment remaining report error:', error);
            toast.error('Failed to fetch report');
            setData(normalizeReportResponse(null)); // Safe default
        } finally {
            setIsLoading(false);
        }
    };

    const exportExcel = async () => {
        try {
            const params = new URLSearchParams({
                from: filters.from,
                to: filters.to,
                format: 'excel'
            });
            if (filters.search) params.append('search', filters.search);
            if (filters.planId) params.append('planId', filters.planId);
            if (filters.status.length > 0) params.append('status', filters.status.join(','));
            if (filters.employeeId) params.append('employeeId', filters.employeeId);
            if (filters.remainingOnly) params.append('remainingOnly', 'true');

            const res = await apiClient.get(`/reports/payment-remaining?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'payment-remaining-report.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Report exported');
        } catch (error) {
            toast.error('Export failed');
        }
    };

    const getStatusBadge = (status) => {
        const configs = {
            unpaid: { label: 'غير مسدد', class: 'bg-red-500/20 text-red-400' },
            partial: { label: 'سداد جزئي', class: 'bg-amber-500/20 text-amber-400' },
            settled: { label: 'تم السداد', class: 'bg-emerald-500/20 text-emerald-400' },
            overpaid: { label: 'دفع زائد', class: 'bg-blue-500/20 text-blue-400' }
        };
        const cfg = configs[status] || configs.unpaid;
        return <span className={`px-2 py-1 rounded-full text-xs font-bold ${cfg.class}`}>{cfg.label}</span>;
    };

    const toggleStatus = (s) => {
        setFilters(prev => ({
            ...prev,
            status: prev.status.includes(s)
                ? prev.status.filter(x => x !== s)
                : [...prev.status, s]
        }));
    };

    if (!isActive) return null;

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="label">من</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={filters.from}
                            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">إلى</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={filters.to}
                            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">بحث عن عضو</label>
                        <input
                            type="text"
                            className="input w-full"
                            placeholder="اسم / رقم عضوية / هاتف"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">الباقة</label>
                        <select
                            className="input w-full"
                            value={filters.planId}
                            onChange={(e) => setFilters({ ...filters, planId: e.target.value })}
                        >
                            <option value="">جميع الباقات</option>
                            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Status Multi-Select */}
                    <div className="flex gap-2">
                        {['unpaid', 'partial', 'settled', 'overpaid'].map(s => (
                            <button
                                key={s}
                                onClick={() => toggleStatus(s)}
                                className={`px-3 py-1.5 text-xs rounded-md transition-all ${filters.status.includes(s)
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                    }`}
                            >
                                {s === 'unpaid' ? 'غير مسدد' : s === 'partial' ? 'جزئي' : s === 'settled' ? 'تم السداد' : 'زائد'}
                            </button>
                        ))}
                    </div>

                    {/* Employee Filter */}
                    <select
                        className="input py-2 text-sm"
                        value={filters.employeeId}
                        onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                    >
                        <option value="">جميع الموظفين</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                    </select>

                    {/* Remaining Only Toggle */}
                    <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={filters.remainingOnly}
                            onChange={(e) => setFilters({ ...filters, remainingOnly: e.target.checked })}
                            className="rounded"
                        />
                        إظهار المتبقي فقط
                    </label>

                    <div className="flex-1" />

                    <button onClick={fetchReport} disabled={isLoading} className="btn-primary">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        تحديث
                    </button>
                    <button onClick={exportExcel} className="btn-secondary">
                        <Download className="w-4 h-4" />
                        تصدير Excel
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                        <p className="text-sm text-gray-500">إجمالي المستحق</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(data.summary.totalDue, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                        <p className="text-sm text-gray-500">المدفوع</p>
                        <p className="text-2xl font-bold text-emerald-500">
                            {formatCurrency(data.summary.totalPaid, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                        <p className="text-sm text-gray-500">المتبقي</p>
                        <p className="text-2xl font-bold text-red-500">
                            {formatCurrency(data.summary.totalRemaining, i18n.language, currencyConf)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                        <p className="text-sm text-gray-500">عدد الحالات</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">{data.summary.countUnpaid}</span>
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">{data.summary.countPartial}</span>
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{data.summary.countSettled}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            {isLoading ? (
                <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500" />
                </div>
            ) : data && data.rows && data.rows.length > 0 ? (
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700/50">
                                <tr>
                                    <th className="px-4 py-3 text-right">اسم العضو</th>
                                    <th className="px-4 py-3 text-right">رقم العضوية</th>
                                    <th className="px-4 py-3 text-right">الباقة</th>
                                    <th className="px-4 py-3 text-right">إجمالي</th>
                                    <th className="px-4 py-3 text-right">مدفوع</th>
                                    <th className="px-4 py-3 text-right">متبقي</th>
                                    <th className="px-4 py-3 text-center">الحالة</th>
                                    <th className="px-4 py-3 text-right">آخر دفعة</th>
                                    <th className="px-4 py-3 text-right">تم بواسطة</th>
                                    <th className="px-4 py-3 text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {data.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-700/30">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.member.name}</td>
                                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.member.memberId}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.plan.name}</td>
                                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                                            {formatCurrency(row.financial.total, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-emerald-500 font-medium">
                                            {formatCurrency(row.financial.paid, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-red-500 font-bold">
                                            {formatCurrency(row.financial.remaining, i18n.language, currencyConf)}
                                        </td>
                                        <td className="px-4 py-3 text-center">{getStatusBadge(row.financial.status)}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {row.timeline.lastPaymentDate ? formatDateTime(row.timeline.lastPaymentDate, i18n.language) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{row.audit.collectorName || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setLedgerTarget({
                                                    memberId: row.member.id,
                                                    subscriptionId: row.subscription.id,
                                                    memberName: row.member.name
                                                })}
                                                className="text-primary-500 hover:text-primary-400 text-xs font-bold underline mr-3"
                                            >
                                                سجل العمليات
                                            </button>
                                            <button
                                                onClick={() => setViewMemberId(row.member.id)}
                                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : data ? (
                <div className="bg-white dark:bg-dark-800 p-12 rounded-2xl text-center">
                    <p className="text-gray-500">لا توجد نتائج</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-dark-800 p-12 rounded-2xl text-center">
                    <DollarSign className="w-12 h-12 mx-auto text-gray-300 dark:text-dark-500 mb-4" />
                    <p className="text-gray-500">اختر نطاق التاريخ ثم اضغط "تحديث"</p>
                </div>
            )}

            {/* Ledger Modal */}
            <MemberLedgerModal
                isOpen={!!ledgerTarget}
                onClose={() => setLedgerTarget(null)}
                memberId={ledgerTarget?.memberId}
                subscriptionId={ledgerTarget?.subscriptionId}
                memberName={ledgerTarget?.memberName}
            />
            <MemberDetailsModal
                isOpen={!!viewMemberId}
                onClose={() => setViewMemberId(null)}
                memberId={viewMemberId}
            />
        </div>
    );
};

export default PaymentRemainingReport;
