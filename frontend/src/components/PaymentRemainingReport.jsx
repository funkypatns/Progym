import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Loader2, RefreshCcw, FileSpreadsheet, DollarSign, Eye, Calendar, Search, Users, AlertCircle, Banknote
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/api';
import { formatCurrency } from '../utils/numberFormatter'; // Removed formatNumber since it was not used or can use formatCurrency
import { formatDateTime } from '../utils/dateFormatter';
import { useAuthStore, useSettingsStore } from '../store';
import MemberLedgerModal from './MemberLedgerModal';
import MemberDetailsModal from './MemberDetailsModal';
import { motion, AnimatePresence } from 'framer-motion';

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
        return <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${cfg.class}`}>{cfg.label}</span>;
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
        <div className="space-y-4">
            {ledgerTarget && (
                <MemberLedgerModal
                    isOpen={!!ledgerTarget}
                    onClose={() => setLedgerTarget(null)}
                    memberId={ledgerTarget.memberId}
                    subscriptionId={ledgerTarget.subscriptionId}
                    memberName={ledgerTarget.memberName}
                />
            )}

            {viewMemberId && (
                <MemberDetailsModal
                    isOpen={!!viewMemberId}
                    onClose={() => setViewMemberId(null)}
                    memberId={viewMemberId}
                />
            )}

            {/* Summary Cards */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Total Due */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                                إجمالي المستحق
                            </p>
                            <h3 className="text-2xl font-bold text-white">
                                {formatCurrency(data.summary.totalDue, i18n.language, currencyConf)}
                            </h3>
                        </div>
                        <div className="p-3 bg-indigo-500 rounded-xl">
                            <Banknote className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    {/* Paid */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                                المدفوع
                            </p>
                            <h3 className="text-2xl font-bold text-white">
                                {formatCurrency(data.summary.totalPaid, i18n.language, currencyConf)}
                            </h3>
                        </div>
                        <div className="p-3 bg-emerald-500 rounded-xl">
                            <DollarSign className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    {/* Remaining */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                                المتبقي
                            </p>
                            <h3 className="text-2xl font-bold text-white">
                                {formatCurrency(data.summary.totalRemaining, i18n.language, currencyConf)}
                            </h3>
                        </div>
                        <div className="p-3 bg-red-500 rounded-xl">
                            <AlertCircle className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    {/* Count */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                                عدد الحالات
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400">{data.summary.countUnpaid}</span>
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-400">{data.summary.countPartial}</span>
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">{data.summary.countSettled}</span>
                            </div>
                        </div>
                        <div className="p-3 bg-indigo-500 rounded-xl">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
                <div className="flex flex-wrap items-end gap-3 mb-4">
                    <div className="flex-1 min-w-[150px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            من
                        </label>
                        <input
                            type="date"
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                            value={filters.from}
                            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                        />
                    </div>
                    <div className="flex-1 min-w-[150px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            إلى
                        </label>
                        <input
                            type="date"
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                            value={filters.to}
                            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                            <Search size={14} />
                            بحث عن عضو
                        </label>
                        <input
                            type="text"
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white placeholder:text-gray-500"
                            placeholder="اسم / رقم عضوية / هاتف"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                    <div className="flex-1 min-w-[150px] space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">الباقة</label>
                        <select
                            className="w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
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
                                className={`px-3 py-2 text-xs rounded-lg font-bold transition-all ${filters.status.includes(s)
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    }`}
                            >
                                {s === 'unpaid' ? 'غير مسدد' : s === 'partial' ? 'جزئي' : s === 'settled' ? 'تم السداد' : 'زائد'}
                            </button>
                        ))}
                    </div>

                    {/* Employee Filter */}
                    <select
                        className="h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white"
                        value={filters.employeeId}
                        onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                    >
                        <option value="">جميع الموظفين</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                    </select>

                    {/* Remaining Only Toggle */}
                    <label className="flex items-center gap-2 text-sm text-gray-300 font-medium cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={filters.remainingOnly}
                            onChange={(e) => setFilters({ ...filters, remainingOnly: e.target.checked })}
                            className="rounded w-4 h-4 accent-indigo-600 bg-slate-700 border-slate-600"
                        />
                        إظهار المتبقي فقط
                    </label>

                    <div className="flex-1" />

                    <button
                        onClick={fetchReport}
                        disabled={isLoading}
                        className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                        تحديث
                    </button>
                    <button
                        onClick={exportExcel}
                        className="h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                        تصدير Excel
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">جاري التحميل...</p>
                    </div>
                ) : data && data.rows && data.rows.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-900/50 border-b border-slate-700/50">
                                <tr>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">اسم العضو</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">رقم العضوية</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">الباقة</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">إجمالي</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-emerald-500 uppercase tracking-wider">مدفوع</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-red-500 uppercase tracking-wider">متبقي</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">الحالة</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">آخر دفعة</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">تم بواسطة</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                <AnimatePresence>
                                    {data.rows.map((row, idx) => (
                                        <motion.tr
                                            key={row.subscriptionId}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className="hover:bg-slate-700/30 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-right font-medium text-white">{row.memberName}</td>
                                            <td className="px-4 py-3 text-right text-gray-400 text-xs font-mono">{row.memberCode || '-'}</td>
                                            <td className="px-4 py-3 text-right text-white">{row.planName}</td>
                                            <td className="px-4 py-3 text-right font-mono text-white">
                                                {formatCurrency(row.price, i18n.language, currencyConf)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-500">
                                                {formatCurrency(row.paidAmount, i18n.language, currencyConf)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-red-500">
                                                {formatCurrency(row.remainingAmount, i18n.language, currencyConf)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {getStatusBadge(row.status)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-gray-400 font-mono">
                                                {row.lastPaymentDate ? formatDateTime(row.lastPaymentDate, i18n.language) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-gray-400">
                                                {row.employeeName || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setLedgerTarget({
                                                            memberId: row.memberId,
                                                            subscriptionId: row.subscriptionId,
                                                            memberName: row.memberName
                                                        })}
                                                        className="p-1.5 hover:bg-slate-600 rounded text-indigo-400 transition-all text-xs border border-transparent hover:border-indigo-500/20"
                                                        title="سجل الدفعات"
                                                    >
                                                        سجل
                                                    </button>
                                                    <button
                                                        onClick={() => setViewMemberId(row.memberId)}
                                                        className="p-1.5 hover:bg-slate-600 rounded text-gray-400 hover:text-white transition-all"
                                                        title="عرض العضو"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <AlertCircle className="w-12 h-12 text-gray-600 mb-3" />
                        <p className="text-sm text-gray-400 font-medium">لا توجد بيانات متاحة</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentRemainingReport;
