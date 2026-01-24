import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Users, DollarSign, Banknote, CreditCard, Calendar, Loader2, RefreshCw, TrendingUp, Search } from 'lucide-react';
import apiClient from '../../utils/api';
import { formatCurrency, formatNumber } from '../../utils/numberFormatter';
import { useSettingsStore } from '../../store';
import { motion, AnimatePresence } from 'framer-motion';

const EmployeeCollectionsPage = () => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [nameFilter, setNameFilter] = useState('');

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await apiClient.get('/users/list');
            setEmployees(res.data.data);
        } catch (e) {
            console.error("Failed to fetch employees");
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('type', 'employeeCollections');
            params.append('startDate', dateRange.startDate);
            params.append('endDate', dateRange.endDate);
            if (selectedEmployee) params.append('employeeId', selectedEmployee);

            const response = await apiClient.get(`/reports/employee-collections?${params}`);
            setReportData(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Aggregate Data
    const aggregatedData = useMemo(() => {
        if (!reportData || !Array.isArray(reportData.report)) return [];
        return reportData.report;
    }, [reportData]);

    // Calculate totals
    const totals = useMemo(() => {
        if (!aggregatedData.length) return { count: 0, cash: 0, nonCash: 0, total: 0 };
        return aggregatedData.reduce((acc, row) => ({
            count: acc.count + (row.count || 0),
            cash: acc.cash + (row.cash || 0),
            nonCash: acc.nonCash + (row.nonCash || 0),
            total: acc.total + (row.total || 0)
        }), { count: 0, cash: 0, nonCash: 0, total: 0 });
    }, [aggregatedData]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20 p-4 lg:p-8">
            <div className="w-full space-y-6">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl p-8"
                >
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-3xl shadow-xl shadow-teal-500/30">
                            <Users className="text-white" size={36} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-teal-600 dark:from-white dark:to-teal-400 leading-tight">
                                تحصيل الموظفين
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 font-medium mt-2">
                                ملخص تحصيل الموظفين في الفترة المحددة
                            </p>
                        </div>
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
                                {t('reports.from') || 'من'}
                            </label>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Calendar size={16} />
                                {t('reports.to') || 'إلى'}
                            </label>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* Name Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Search size={16} />
                                فلتر بالاسم
                            </label>
                            <input
                                type="text"
                                placeholder="بحث بالاسم..."
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                            />
                        </div>

                        {/* Employee Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Users size={16} />
                                الموظف
                            </label>
                            <select
                                value={selectedEmployee}
                                onChange={(e) => setSelectedEmployee(e.target.value)}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-gray-900 dark:text-white"
                            >
                                <option value="">{t('common.all') || 'الكل'}</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.firstName} {emp.lastName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Generate Button */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 opacity-0">Action</label>
                            <button
                                onClick={fetchReport}
                                disabled={loading}
                                className={`w-full h-12 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${loading
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-wait'
                                    : 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-teal-500/30 hover:scale-[1.02]'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        جاري التحميل...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={20} />
                                        {t('reports.generate') || 'إنشاء'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Summary Cards */}
                {reportData && aggregatedData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                                    <TrendingUp className="text-white" size={28} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">عدد العمليات</p>
                                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                        {formatNumber(totals.count, i18n.language)}
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg">
                                    <Banknote className="text-white" size={28} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">نقدي</p>
                                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                                        {formatCurrency(totals.cash, i18n.language, currencyConf)}
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg">
                                    <CreditCard className="text-white" size={28} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">غير نقدي</p>
                                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                                        {formatCurrency(totals.nonCash, i18n.language, currencyConf)}
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 shadow-xl shadow-teal-500/30"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl">
                                    <DollarSign className="text-white" size={28} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white/80 uppercase tracking-wider">الإجمالي</p>
                                    <p className="text-3xl font-black text-white">
                                        {formatCurrency(totals.total, i18n.language, currencyConf)}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Data Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl overflow-hidden"
                >
                    {loading ? (
                        <div className="py-20 text-center">
                            <Loader2 size={64} className="mx-auto text-teal-500 animate-spin mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">جاري تحميل التقرير...</p>
                        </div>
                    ) : reportData ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-white/5">
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الموظف</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">عدد العمليات</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">نقدي</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">بطاقة/غير نقدي</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {aggregatedData.length > 0 ? (
                                        <AnimatePresence>
                                            {aggregatedData.filter(row => {
                                                if (!nameFilter) return true;
                                                const searchTerm = nameFilter.toLowerCase();
                                                return row.name?.toLowerCase().includes(searchTerm);
                                            }).map((row, index) => (
                                                <motion.tr
                                                    key={index}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: index * 0.03 }}
                                                    className="hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-colors"
                                                >
                                                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white text-right">
                                                        {row.name}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-bold">
                                                            {formatNumber(row.count, i18n.language)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                        {formatCurrency(row.cash, i18n.language, currencyConf)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-sm font-bold text-purple-600 dark:text-purple-400 font-mono">
                                                        {formatCurrency(row.nonCash, i18n.language, currencyConf)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-sm font-black text-teal-600 dark:text-teal-400 font-mono">
                                                        {formatCurrency(row.total, i18n.language, currencyConf)}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-16 text-center">
                                                <Users size={80} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">لا توجد بيانات</h3>
                                                <p className="text-gray-500 dark:text-gray-400">لا توجد بيانات تحصيل في هذه الفترة</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-20 text-center">
                            <BarChart3 size={80} className="mx-auto text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">استخدم الفلاتر لإنشاء التقرير</h3>
                            <p className="text-gray-500 dark:text-gray-400">اختر الفترة والموظف ثم اضغط على إنشاء</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default EmployeeCollectionsPage;
