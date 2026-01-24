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
    Search
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

    const reportTitle = i18n.language === 'ar' ? config?.titleAr : config?.titleEn;
    const reportDesc = i18n.language === 'ar' ? config?.descriptionAr : config?.descriptionEn;

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

            const response = await apiClient.get(`/reports${config.endpoint}?${params}`);
            setReportData(response.data);
            toast.success(i18n.language === 'ar' ? 'تم إنشاء التقرير' : 'Report generated');
        } catch (err) {
            console.error(`Failed to fetch report:`, err);
            setError(err.response?.data?.message || 'Failed to generate report');
            toast.error(i18n.language === 'ar' ? 'فشل إنشاء التقرير' : 'Failed to generate report');
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
            toast.success(i18n.language === 'ar' ? 'تم التصدير بنجاح' : 'Exported successfully');
        } catch (err) {
            toast.error(i18n.language === 'ar' ? 'فشل التصدير' : 'Export failed');
        }
    };

    useEffect(() => {
        if (config) fetchReport();
    }, [config?.id]);

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
                        {i18n.language === 'ar' ? 'لا توجد بيانات لهذه الفترة' : 'No data available for this period'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {i18n.language === 'ar' ? 'حاول تغيير نطاق التاريخ' : 'Try adjusting the date range'}
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
                                            {typeof row[col] === 'number' &&
                                                (col.toLowerCase().includes('amount') ||
                                                    col.toLowerCase().includes('price') ||
                                                    col.toLowerCase().includes('total'))
                                                ? formatCurrency(row[col])
                                                : (row[col] ?? '-')}
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
                            {i18n.language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                        </button>
                    </div>
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
                                {i18n.language === 'ar' ? 'من' : 'From'}
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
                                {i18n.language === 'ar' ? 'إلى' : 'To'}
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
                                {i18n.language === 'ar' ? 'فلتر بالاسم' : 'Filter by Name'}
                            </label>
                            <input
                                type="text"
                                placeholder={i18n.language === 'ar' ? 'بحث بالاسم...' : 'Search by name...'}
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
                                    {i18n.language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                                >
                                    <option value="">{i18n.language === 'ar' ? 'الكل' : 'All'}</option>
                                    <option value="cash">{i18n.language === 'ar' ? 'نقدي' : 'Cash'}</option>
                                    <option value="card">{i18n.language === 'ar' ? 'بطاقة' : 'Card'}</option>
                                    <option value="transfer">{i18n.language === 'ar' ? 'تحويل' : 'Transfer'}</option>
                                </select>
                            </div>
                        )}

                        {/* Generate Button */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 opacity-0">Action</label>
                            <button
                                onClick={fetchReport}
                                disabled={loading}
                                className={`w-full h-12 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${loading
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-wait'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/30 hover:scale-[1.02]'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        {i18n.language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={20} />
                                        {i18n.language === 'ar' ? 'تحديث' : 'Generate'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>

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
                                {i18n.language === 'ar' ? 'جاري تحميل التقرير...' : 'Loading report...'}
                            </p>
                        </div>
                    ) : (
                        renderTable()
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default StandardReportPage;
