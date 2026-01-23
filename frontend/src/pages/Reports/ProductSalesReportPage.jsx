import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, RefreshCw, Download, ShoppingCart, TrendingUp, Package, Calendar, Search, Loader2, BarChart3 } from 'lucide-react';
import apiClient from '../../utils/api';
import { formatCurrency } from '../../utils/numberFormatter';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ProductSalesReportPage = () => {
    const { t, i18n } = useTranslation();

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [search, setSearch] = useState('');
    const [nameFilter, setNameFilter] = useState('');

    // Fetch report data
    const fetchReport = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (dateRange.startDate) params.append('from', dateRange.startDate);
            if (dateRange.endDate) params.append('to', dateRange.endDate);
            if (search) params.append('search', search);

            const response = await apiClient.get(`/reports/sales/detailed?${params}`);
            setReportData(response.data.data);
            toast.success('Report generated successfully');
        } catch (err) {
            console.error('Failed to fetch product sales report:', err);
            setError(err.response?.data?.message || 'Failed to load report');
            toast.error('Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    // Export to Excel
    const exportToExcel = async () => {
        try {
            const params = new URLSearchParams();
            params.append('format', 'excel');
            if (dateRange.startDate) params.append('from', dateRange.startDate);
            if (dateRange.endDate) params.append('to', dateRange.endDate);
            if (search) params.append('search', search);

            const response = await apiClient.get(`/reports/sales/detailed?${params}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `product-sales-${dateRange.startDate}-${dateRange.endDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Report exported successfully');
        } catch (err) {
            toast.error('Failed to export report');
        }
    };

    // Auto-fetch on mount with today's date
    useEffect(() => {
        fetchReport();
    }, []);

    const rows = reportData?.rows || [];
    const summary = reportData?.summary || { totalRevenue: 0, totalUnits: 0, uniqueProducts: 0 };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950/20 p-4 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl p-8"
                >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl shadow-xl shadow-purple-500/30">
                                <BarChart3 className="text-white" size={36} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-purple-600 dark:from-white dark:to-purple-400 leading-tight">
                                    {i18n.language === 'ar' ? 'مبيعات المنتجات' : 'Product Sales Report'}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 font-medium mt-2">
                                    Detailed breakdown of all product sales with line items
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={exportToExcel}
                            disabled={loading || rows.length === 0}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg transition-all ${rows.length > 0
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-purple-500/30 hover:scale-[1.02]'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <Download size={20} />
                            Export
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
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Calendar size={16} />
                                End Date
                            </label>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* Name Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Search size={16} />
                                Filter by Name
                            </label>
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                            />
                        </div>

                        {/* Search Product/SKU */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Search size={16} />
                                Search Product/SKU
                            </label>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                            />
                        </div>

                        {/* Generate Button */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 opacity-0">Action</label>
                            <button
                                onClick={fetchReport}
                                disabled={loading}
                                className={`w-full h-12 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${loading
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-wait'
                                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-purple-500/30 hover:scale-[1.02]'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={20} />
                                        Generate
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

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg">
                                <TrendingUp className="text-white" size={28} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Revenue</p>
                                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                                    {formatCurrency(summary.totalRevenue)}
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
                            <div className="p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg">
                                <ShoppingCart className="text-white" size={28} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Units Sold</p>
                                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-600">
                                    {summary.totalUnits}
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
                            <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                                <Package className="text-white" size={28} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unique Products</p>
                                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                    {summary.uniqueProducts}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Data Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl overflow-hidden"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-white/5">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qty</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sold By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center">
                                            <Loader2 size={48} className="mx-auto text-purple-500 animate-spin mb-4" />
                                            <p className="text-gray-500 dark:text-gray-400 font-medium">Loading report...</p>
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-16 text-center">
                                            <FileSpreadsheet size={80} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No sales found</h3>
                                            <p className="text-gray-500 dark:text-gray-400">Try adjusting your date range or search filters</p>
                                        </td>
                                    </tr>
                                ) : (
                                    <AnimatePresence>
                                        {rows.filter(row => {
                                            if (!nameFilter) return true;
                                            const searchTerm = nameFilter.toLowerCase();
                                            return (row.soldBy?.toLowerCase().includes(searchTerm) ||
                                                row.productName?.toLowerCase().includes(searchTerm));
                                        }).map((row, index) => (
                                            <motion.tr
                                                key={row.id || index}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: index * 0.02 }}
                                                className="hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
                                            >
                                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                                    {new Date(row.date).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">
                                                    {row.productName}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-mono">
                                                        {row.sku || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-bold">
                                                        {row.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                                    {formatCurrency(row.unitPrice)}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(row.total)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                                    {row.soldBy || '-'}
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default ProductSalesReportPage;
