/**
 * ============================================
 * STANDARD REPORT PAGE - Premium Redesign
 * ============================================
 * 
 * Reusable page template for standard table-based reports.
 * Modern Tailwind CSS design with gradients and glassmorphism.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
    BarChart3,
    FileSpreadsheet,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Users,
    Calendar,
    Loader2,
    RefreshCw,
    Download,
    CreditCard,
    Package,
    Search,
    Filter
} from 'lucide-react';
import apiClient from '../../utils/api';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../utils/numberFormatter';
import { REPORTS_REGISTRY } from '../../config/reportsRegistry';
import { motion, AnimatePresence } from 'framer-motion';

// KPI Card Component
const KPICard = ({ label, value, icon: Icon, gradient, isCurrency = false, delay = 0 }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
        >
            <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${gradient} shadow-lg`}>
                    <Icon className="text-white" size={28} strokeWidth={2.5} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        {label}
                    </p>
                    <p className={`text-3xl font-black ${gradient} bg-clip-text text-transparent`}>
                        {isCurrency ? formatCurrency(value) : (typeof value === 'number' ? value.toLocaleString() : value)}
                    </p>
                </div>
            </div>

                    {isRevenueReport && activeTab === "payments" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Filter size={16} />
                                    {i18n.language === "ar" ? "نوع الدفع" : "Payment Type"}
                                </label>
                                <select
                                    value={paymentType}
                                    onChange={(e) => setPaymentType(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                                >
                                    <option value="">{i18n.language === "ar" ? "الكل" : "All"}</option>
                                    <option value="SESSION">{i18n.language === "ar" ? "جلسة" : "Session"}</option>
                                    <option value="SUBSCRIPTION">{i18n.language === "ar" ? "اشتراك" : "Membership"}</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Users size={16} />
                                    {i18n.language === "ar" ? "الموظف" : "Employee"}
                                </label>
                                <select
                                    value={employeeFilter}
                                    onChange={(e) => setEmployeeFilter(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                                >
                                    <option value="">{i18n.language === "ar" ? "الكل" : "All"}</option>
                                    {employees.map((employee) => (
                                        <option key={employee.id} value={employee.id}>
                                            {`${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username || employee.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
        </motion.div>
    );
};

const StandardReportPage = ({ type }) => {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    // Identify current report
    const pathId = location.pathname.split('/').pop();
    const config = REPORTS_REGISTRY.find(r => r.id === (type || pathId));

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportData, setReportData] = useState(null);

    // Filters
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [paymentMethod, setPaymentMethod] = useState('');
    const [nameFilter, setNameFilter] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [employees, setEmployees] = useState([]);
    const [paymentType, setPaymentType] = useState('');
    const [employeeFilter, setEmployeeFilter] = useState('');
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [paymentsRows, setPaymentsRows] = useState([]);
    const [paymentsSummary, setPaymentsSummary] = useState({ count: 0, total: 0, average: 0 });

    const reportTitle = i18n.language === 'ar' ? config?.titleAr : config?.titleEn;
    const reportDesc = i18n.language === 'ar' ? config?.descriptionAr : config?.descriptionEn;

    const toStartOfDay = (value) => (value ? `${value}T00:00:00` : '');
    const toEndOfDay = (value) => (value ? `${value}T23:59:59.999` : '');

    const normalizePaymentsSummary = (payload) => {
        const reportData = payload?.data || {};
        const summary = {
            successCount: reportData.successCount ?? reportData.total?.count ?? 0,
            successAmountTotal: reportData.successAmountTotal ?? reportData.total?.amount ?? 0,
            successNetTotal: reportData.successNetTotal ?? reportData.total?.net ?? 0,
            refundedTotal: reportData.total?.refunded ?? 0
        };
        const rows = Object.entries(reportData.byMethod || {}).map(([method, stats]) => ({
            method,
            count: stats?.count ?? 0,
            amount: stats?.amount ?? 0
        }));

        return { data: { summary, rows } };
    };

    const fetchPaymentsLedger = async () => {
        setPaymentsLoading(true);
        try {
            const params = new URLSearchParams();
            const startDate = toStartOfDay(dateRange.startDate);
            const endDate = toEndOfDay(dateRange.endDate);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (paymentType) params.append('type', paymentType);
            params.append('page', '1');
            params.append('limit', '10000');

            const response = await apiClient.get(`/payments?${params.toString()}`);
            const rawData = response.data?.data;
            const payments = Array.isArray(rawData)
                ? rawData
                : (rawData?.payments || rawData?.docs || []);

            const normalizedMethod = paymentMethod ? paymentMethod.toLowerCase() : '';
            const normalizedSearch = nameFilter.trim().toLowerCase();
            const employeeId = employeeFilter ? String(employeeFilter) : '';

            const filtered = payments.filter((payment) => {
                if (normalizedMethod && String(payment.method || '').toLowerCase() !== normalizedMethod) {
                    return false;
                }
                if (employeeId) {
                    const creatorId = payment.creator?.id ? String(payment.creator.id) : (payment.createdBy ? String(payment.createdBy) : '');
                    const completedId = payment.appointment?.completedByEmployee?.id ? String(payment.appointment.completedByEmployee.id) : '';
                    if (creatorId !== employeeId && completedId !== employeeId) return false;
                }
                if (normalizedSearch) {
                    const member = payment.member || {};
                    const haystack = `${member.firstName || ''} ${member.lastName || ''} ${member.memberId || ''} ${member.phone || ''}`.toLowerCase();
                    if (!haystack.includes(normalizedSearch)) return false;
                }
                return true;
            });

            const rows = filtered.map((payment) => {
                const member = payment.member || {};
                const customerName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
                const creatorName = payment.creator
                    ? `${payment.creator.firstName || ''} ${payment.creator.lastName || ''}`.trim()
                    : '';
                const completedByName = payment.appointment?.completedByEmployee
                    ? `${payment.appointment.completedByEmployee.firstName || ''} ${payment.appointment.completedByEmployee.lastName || ''}`.trim()
                    : '';
                const typeLabel = payment.appointmentId
                    ? (i18n.language === 'ar' ? 'Ø¬Ù„Ø³Ø©' : 'Session')
                    : payment.subscriptionId
                        ? (i18n.language === 'ar' ? 'Ø§Ø´ØªØ±Ø§Ùƒ' : 'Membership')
                        : (i18n.language === 'ar' ? 'Ø£Ø®Ø±Ù‰' : 'Other');

                return {
                    id: payment.id,
                    paidAt: payment.paidAt,
                    customerLabel: member.memberId ? `${customerName} (${member.memberId})` : customerName,
                    type: typeLabel,
                    amount: payment.amount || 0,
                    method: payment.method || '',
                    employee: creatorName || completedByName || '-',
                    reference: payment.appointmentId || payment.receiptNumber || payment.id
                };
            });

            const total = rows.reduce((sum, row) => sum + (row.amount || 0), 0);
            const count = rows.length;
            const average = count ? total / count : 0;

            setPaymentsRows(rows);
            setPaymentsSummary({ count, total, average });
        } catch (err) {
            console.error('Failed to fetch payments ledger', err);
            toast.error(i18n.language === 'ar' ? 'ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ø¯ÙØªØ± Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª' : 'Failed to load payments ledger');
            setPaymentsRows([]);
            setPaymentsSummary({ count: 0, total: 0, average: 0 });
        } finally {
            setPaymentsLoading(false);
        }
    };

    const fetchReport = async () => {
        if (!config?.endpoint) {
            setError('Report endpoint configuration missing');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.append('from', dateRange.startDate);
            params.append('to', dateRange.endDate);
            if (paymentMethod) params.append('method', paymentMethod);
            if (config?.id === 'payments-summary') params.append('_ts', Date.now().toString());

            const requestConfig = config?.id === 'payments-summary'
                ? { headers: { 'Cache-Control': 'no-cache' } }
                : undefined;
            const response = await apiClient.get(`/reports${config.endpoint}?${params}`, requestConfig);
            if (config?.id === 'payments-summary') {
                setReportData(normalizePaymentsSummary(response.data));
            } else {
                setReportData(response.data);
            }
            toast.success(i18n.language === 'ar' ? 'ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ØªÙ‚Ø±ÙŠØ±' : 'Report generated');
        } catch (err) {
            console.error(`Failed to fetch report:`, err);
            setError(err.response?.data?.message || 'Failed to generate report');
            toast.error(i18n.language === 'ar' ? 'ÙØ´Ù„ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ØªÙ‚Ø±ÙŠØ±' : 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const exportExcel = async () => {
        if (!config?.endpoint) return;
        try {
            const params = new URLSearchParams();
            params.append('from', dateRange.startDate);
            params.append('to', dateRange.endDate);
            params.append('format', 'excel');

            const response = await apiClient.get(`/reports${config.endpoint}?${params}`, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${config.id}-report.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(i18n.language === 'ar' ? 'ØªÙ… Ø§Ù„ØªØµØ¯ÙŠØ± Ø¨Ù†Ø¬Ø§Ø­' : 'Exported successfully');
        } catch (err) {
            toast.error(i18n.language === 'ar' ? 'ÙØ´Ù„ Ø§Ù„ØªØµØ¯ÙŠØ±' : 'Export failed');
        }
    };

    useEffect(() => {
        if (config) fetchReport();
    }, [config?.id]);

    useEffect(() => {
        if (config?.id === 'revenue') {
            setActiveTab('overview');
        }
    }, [config?.id]);

    useEffect(() => {
        if (config?.id !== 'revenue') return;
        const loadEmployees = async () => {
            try {
                const res = await apiClient.get('/users/list');
                if (res.data?.data) {
                    setEmployees(res.data.data || []);
                }
            } catch (error) {
                console.warn('Failed to load employees', error);
            }
        };
        loadEmployees();
    }, [config?.id]);

    useEffect(() => {
        if (config?.id !== 'revenue') return;
        if (activeTab !== 'payments') return;
        fetchPaymentsLedger();
    }, [
        config?.id,
        activeTab,
        dateRange.startDate,
        dateRange.endDate,
        paymentMethod,
        paymentType,
        employeeFilter,
        nameFilter
    ]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!config || config.id !== 'payments-summary') return;
        const handlePaymentsUpdated = () => {
            fetchReport();
        };
        window.addEventListener('payments:updated', handlePaymentsUpdated);
        return () => window.removeEventListener('payments:updated', handlePaymentsUpdated);
    }, [config?.id, dateRange.startDate, dateRange.endDate, paymentMethod]);

    if (!config) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-2xl p-6">
                    <p className="text-red-600 dark:text-red-400 font-semibold">Report not found</p>
                </div>
            </div>
        );
    }

    const isRevenueReport = config?.id === 'revenue';
    const nameFilterLabel = isRevenueReport && activeTab === 'payments'
        ? (i18n.language === 'ar' ? 'بحث' : 'Search')
        : (i18n.language === 'ar' ? 'فلتر بالاسم' : 'Filter by Name');
    const nameFilterPlaceholder = isRevenueReport && activeTab === 'payments'
        ? (i18n.language === 'ar' ? 'اسم / كود / تليفون' : 'Name / code / phone')
        : (i18n.language === 'ar' ? 'بحث بالاسم...' : 'Search by name...');

    // RENDER KPI CARDS
    const renderKPICards = () => {
        if (!reportData?.data?.summary) return null;
        const s = reportData.data.summary;

        const kpiItems = Object.entries(s)
            .filter(([key, value]) => key !== 'currency' && typeof value !== 'object')
            .slice(0, 6)
            .map(([key, value], idx) => {
                const isCurrency = key.toLowerCase().includes('total') ||
                    key.toLowerCase().includes('revenue') ||
                    key.toLowerCase().includes('amount') ||
                    key.toLowerCase().includes('paid') ||
                    key.toLowerCase().includes('refund');

                const gradients = [
                    'bg-gradient-to-br from-emerald-500 to-teal-600',
                    'bg-gradient-to-br from-blue-500 to-indigo-600',
                    'bg-gradient-to-br from-purple-500 to-pink-600',
                    'bg-gradient-to-br from-orange-500 to-red-600',
                    'bg-gradient-to-br from-cyan-500 to-blue-600',
                    'bg-gradient-to-br from-rose-500 to-pink-600'
                ];
                const icons = [DollarSign, TrendingUp, Users, CreditCard, TrendingDown, Package];

                return (
                    <KPICard
                        key={key}
                        label={key.replace(/([A-Z])/g, ' $1').trim()}
                        value={value}
                        icon={icons[idx % icons.length]}
                        gradient={gradients[idx % gradients.length]}
                        isCurrency={isCurrency}
                        delay={0.3 + (idx * 0.05)}
                    />
                );
            });

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {kpiItems}
            </div>
        );
    };

    // RENDER TABLE
    const renderTable = () => {
        const rows = reportData?.data?.rows || reportData?.data?.report || [];

        if (!loading && (!rows || rows.length === 0)) {
            return (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-20 text-center"
                >
                    <Calendar size={80} className="mx-auto text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {i18n.language === 'ar' ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ù„Ù‡Ø°Ù‡ Ø§Ù„ÙØªØ±Ø©' : 'No data available for this period'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {i18n.language === 'ar' ? 'Ø­Ø§ÙˆÙ„ ØªØºÙŠÙŠØ± Ù†Ø·Ø§Ù‚ Ø§Ù„ØªØ§Ø±ÙŠØ®' : 'Try adjusting the date range'}
                    </p>
                </motion.div>
            );
        }

        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return (
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-white/5">
                            {columns.map(col => (
                                <th
                                    key={col}
                                    className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                                >
                                    {col.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        <AnimatePresence>
                            {rows.map((row, idx) => (
                                <motion.tr
                                    key={idx}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.02 }}
                                    className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors"
                                >
                                    {columns.map(col => (
                                        <td key={col} className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                            {(() => {
                                                const val = row[col];
                                                const lowerCol = col.toLowerCase();
                                                const isCurrency = typeof val === 'number' && (lowerCol.includes('amount') || lowerCol.includes('price') || lowerCol.includes('total'));
                                                const isDate = typeof val === 'string' && (lowerCol.includes('date') || lowerCol.includes('at') || lowerCol.match(/^\d{4}-\d{2}-\d{2}/));

                                                if (isCurrency) return formatCurrency(val);
                                                if (isDate) {
                                                    const d = new Date(val);
                                                    if (!isNaN(d.getTime())) {
                                                        return d.toLocaleDateString(i18n.language, {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        });
                                                    }
                                                }
                                                return val ?? '-';
                                            })()}
                                        </td>
                                    ))}
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
        );
    };

    const exportPaymentsCsv = () => {
        if (!paymentsRows.length) {
            toast.error(i18n.language === 'ar' ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ù„Ù„ØªØµØ¯ÙŠØ±' : 'No data to export');
            return;
        }
        const headers = [
            i18n.language === 'ar' ? 'Ø§Ù„ØªØ§Ø±ÙŠØ®/Ø§Ù„ÙˆÙ‚Øª' : 'Date/Time',
            i18n.language === 'ar' ? 'Ø§Ù„Ø¹Ù…ÙŠÙ„' : 'Customer',
            i18n.language === 'ar' ? 'Ø§Ù„Ù†ÙˆØ¹' : 'Type',
            i18n.language === 'ar' ? 'Ø§Ù„Ù…Ø¨Ù„Øº' : 'Amount',
            i18n.language === 'ar' ? 'Ø§Ù„Ø·Ø±ÙŠÙ‚Ø©' : 'Method',
            i18n.language === 'ar' ? 'Ø§Ù„Ù…ÙˆØ¸Ù' : 'Employee',
            i18n.language === 'ar' ? 'Ø§Ù„Ù…Ø±Ø¬Ø¹' : 'Reference'
        ];
        const csvRows = [headers.join(',')];
        paymentsRows.forEach((row) => {
            const line = [
                row.paidAt,
                row.customerLabel || '',
                row.type || '',
                row.amount ?? 0,
                row.method || '',
                row.employee || '',
                row.reference || ''
            ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
            csvRows.push(line);
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'payments-ledger.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const renderPaymentsTab = () => {
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <KPICard
                        label={i18n.language === 'ar' ? 'Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª' : 'Payments Count'}
                        value={paymentsSummary.count}
                        icon={CreditCard}
                        gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
                        delay={0.2}
                    />
                    <KPICard
                        label={i18n.language === 'ar' ? 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª' : 'Total Amount'}
                        value={paymentsSummary.total}
                        icon={DollarSign}
                        gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
                        isCurrency
                        delay={0.25}
                    />
                    <KPICard
                        label={i18n.language === 'ar' ? 'Ù…ØªÙˆØ³Ø· Ø§Ù„Ø¯ÙØ¹' : 'Average Payment'}
                        value={paymentsSummary.average}
                        icon={TrendingUp}
                        gradient="bg-gradient-to-br from-purple-500 to-pink-600"
                        isCurrency
                        delay={0.3}
                    />
                </div>

                <div className="flex items-center justify-end mb-4">
                    <button
                        onClick={exportPaymentsCsv}
                        disabled={!paymentsRows.length}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all ${paymentsRows.length
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/30'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <Download size={18} />
                        {i18n.language === 'ar' ? 'ØªØµØ¯ÙŠØ± CSV' : 'Export CSV'}
                    </button>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl overflow-hidden">
                    {paymentsLoading ? (
                        <div className="py-20 text-center">
                            <Loader2 size={64} className="mx-auto text-indigo-500 animate-spin mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">
                                {i18n.language === 'ar' ? 'Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø¯ÙØªØ± Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª...' : 'Loading payments ledger...'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-white/5">
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {i18n.language === 'ar' ? 'Ø§Ù„ØªØ§Ø±ÙŠØ®/Ø§Ù„ÙˆÙ‚Øª' : 'Date/Time'}
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {i18n.language === 'ar' ? 'Ø§Ù„Ø¹Ù…ÙŠÙ„' : 'Customer'}
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {i18n.language === 'ar' ? 'Ø§Ù„Ù†ÙˆØ¹' : 'Type'}
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {i18n.language === 'ar' ? 'Ø§Ù„Ù…Ø¨Ù„Øº' : 'Amount'}
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {i18n.language === 'ar' ? 'Ø§Ù„Ø·Ø±ÙŠÙ‚Ø©' : 'Method'}
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {i18n.language === 'ar' ? 'Ø§Ù„Ù…ÙˆØ¸Ù' : 'Employee'}
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {i18n.language === 'ar' ? 'Ø§Ù„Ù…Ø±Ø¬Ø¹' : 'Reference'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {paymentsRows.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                                {i18n.language === 'ar' ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø¯ÙÙˆØ¹Ø§Øª ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„ÙØªØ±Ø©' : 'No payments in this period'}
                                            </td>
                                        </tr>
                                    )}
                                    {paymentsRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                {row.paidAt}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                {row.customerLabel || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                {row.type}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                {formatCurrency(row.amount || 0)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                {row.method || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                {row.employee || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                {row.reference || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </>
        );
    };

    const handleGenerate = () => {
        fetchReport();
        if (config?.id === 'revenue' && activeTab === 'payments') {
            fetchPaymentsLedger();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 p-4 lg:p-8">
            <div className="w-full space-y-6">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl p-8"
                >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl shadow-indigo-500/30">
                                <BarChart3 className="text-white" size={36} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-indigo-600 dark:from-white dark:to-indigo-400 leading-tight">
                                    {reportTitle || 'Report'}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 font-medium mt-2">
                                    {reportDesc || 'Detailed report data'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={exportExcel}
                            disabled={loading || !reportData}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg transition-all ${reportData
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/30 hover:scale-[1.02]'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <Download size={20} />
                            {i18n.language === 'ar' ? 'ØªØµØ¯ÙŠØ± Excel' : 'Export Excel'}
                        </button>
                    </div>

                    {isRevenueReport && activeTab === "payments" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Filter size={16} />
                                    {i18n.language === "ar" ? "نوع الدفع" : "Payment Type"}
                                </label>
                                <select
                                    value={paymentType}
                                    onChange={(e) => setPaymentType(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                                >
                                    <option value="">{i18n.language === "ar" ? "الكل" : "All"}</option>
                                    <option value="SESSION">{i18n.language === "ar" ? "جلسة" : "Session"}</option>
                                    <option value="SUBSCRIPTION">{i18n.language === "ar" ? "اشتراك" : "Membership"}</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Users size={16} />
                                    {i18n.language === "ar" ? "الموظف" : "Employee"}
                                </label>
                                <select
                                    value={employeeFilter}
                                    onChange={(e) => setEmployeeFilter(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                                >
                                    <option value="">{i18n.language === "ar" ? "الكل" : "All"}</option>
                                    {employees.map((employee) => (
                                        <option key={employee.id} value={employee.id}>
                                            {`${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username || employee.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl p-6"
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Start Date */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Calendar size={16} />
                                {i18n.language === 'ar' ? 'Ù…Ù†' : 'From'}
                            </label>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Calendar size={16} />
                                {i18n.language === 'ar' ? 'Ø¥Ù„Ù‰' : 'To'}
                            </label>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* Name Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Search size={16} />
                                {nameFilterLabel}
                            </label>
                            <input
                                type="text"
                                placeholder={nameFilterPlaceholder}
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                            />
                        </div>

                        {/* Payment Method (conditional) */}
                        {(config.id === 'revenue' || config.id === 'subscriptions' || config.id === 'payments-summary') && (
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <CreditCard size={16} />
                                    {i18n.language === 'ar' ? 'Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹' : 'Payment Method'}
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                                >
                                    <option value="">{i18n.language === 'ar' ? 'Ø§Ù„ÙƒÙ„' : 'All'}</option>
                                    <option value="cash">{i18n.language === 'ar' ? 'Ù†Ù‚Ø¯ÙŠ' : 'Cash'}</option>
                                    <option value="card">{i18n.language === 'ar' ? 'Ø¨Ø·Ø§Ù‚Ø©' : 'Card'}</option>
                                    <option value="transfer">{i18n.language === 'ar' ? 'ØªØ­ÙˆÙŠÙ„' : 'Transfer'}</option>
                                </select>
                            </div>
                        )}

                        {/* Generate Button */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 opacity-0">Action</label>
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className={`w-full h-12 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${loading
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-wait'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/30 hover:scale-[1.02]'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        {i18n.language === 'ar' ? 'Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„...' : 'Loading...'}
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={20} />
                                        {i18n.language === 'ar' ? 'ØªØ­Ø¯ÙŠØ«' : 'Generate'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {isRevenueReport && activeTab === "payments" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Filter size={16} />
                                    {i18n.language === "ar" ? "نوع الدفع" : "Payment Type"}
                                </label>
                                <select
                                    value={paymentType}
                                    onChange={(e) => setPaymentType(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                                >
                                    <option value="">{i18n.language === "ar" ? "الكل" : "All"}</option>
                                    <option value="SESSION">{i18n.language === "ar" ? "جلسة" : "Session"}</option>
                                    <option value="SUBSCRIPTION">{i18n.language === "ar" ? "اشتراك" : "Membership"}</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Users size={16} />
                                    {i18n.language === "ar" ? "الموظف" : "Employee"}
                                </label>
                                <select
                                    value={employeeFilter}
                                    onChange={(e) => setEmployeeFilter(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                                >
                                    <option value="">{i18n.language === "ar" ? "الكل" : "All"}</option>
                                    {employees.map((employee) => (
                                        <option key={employee.id} value={employee.id}>
                                            {`${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username || employee.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </motion.div>


                {isRevenueReport && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl inline-flex gap-1">
                            {[{ id: "overview", label: i18n.language === "ar" ? "ملخص" : "Overview" }, { id: "payments", label: i18n.language === "ar" ? "دفتر المدفوعات" : "Payments" }].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {/* Error Alert */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-2xl p-4"
                    >
                        <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
                    </motion.div>
                )}

                {(!isRevenueReport || activeTab === "overview") && (
                    <>
                        {/* KPI Cards */}
                        {!loading && reportData && renderKPICards()}

                        {/* Data Table */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl overflow-hidden"
                        >
                            {loading ? (
                                <div className="py-20 text-center">
                                    <Loader2 size={64} className="mx-auto text-indigo-500 animate-spin mb-4" />
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                                        {i18n.language === "ar" ? "جاري تحميل التقرير..." : "Loading report..."}
                                    </p>
                                </div>
                            ) : (
                                renderTable()
                            )}
                        </motion.div>
                    </>
                )}

                {isRevenueReport && activeTab === "payments" && renderPaymentsTab()}
            </div>
        </div>
    );
};

export default StandardReportPage;





