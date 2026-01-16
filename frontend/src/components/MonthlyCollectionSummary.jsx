/**
 * ============================================
 * MONTHLY COLLECTION SUMMARY
 * ============================================
 * 
 * Shows monthly payment totals per employee without requiring closings
 * Features: sorting, drill-down, month selection
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatCurrency, formatNumber } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import PaymentDetailsModal from './PaymentDetailsModal';

const MonthlyCollectionSummary = () => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    // Get current month in YYYY-MM format
    const getCurrentMonth = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [summaryData, setSummaryData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Sorting state
    const [sortBy, setSortBy] = useState('total'); // total, cashTotal, nonCashTotal, paymentsCount
    const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

    // Drill-down modal state
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [employeePayments, setEmployeePayments] = useState(null);
    const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
    const [isFetchingPayments, setIsFetchingPayments] = useState(false);

    // Fetch summary when month changes
    useEffect(() => {
        if (selectedMonth) {
            fetchMonthlySummary();
        }
    }, [selectedMonth]);

    const fetchMonthlySummary = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/cash-closings/monthly-summary?month=${selectedMonth}`);
            setSummaryData(response.data.data);
        } catch (error) {
            console.error('Failed to fetch monthly summary:', error);
            toast.error('Failed to load monthly summary');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmployeeClick = async (employee) => {
        setSelectedEmployee(employee);
        setIsFetchingPayments(true);
        setIsPaymentsModalOpen(true);

        try {
            // Calculate month boundaries
            const [year, month] = selectedMonth.split('-');
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

            const response = await api.get(`/cash-closings/employee-payments?employeeId=${employee.employeeId}&startDate=${startDate}&endDate=${endDate}`);
            setEmployeePayments(response.data.data);
        } catch (error) {
            console.error('Failed to fetch employee payments:', error);
            toast.error('Failed to load payment details');
        } finally {
            setIsFetchingPayments(false);
        }
    };

    const handleSort = (column) => {
        if (sortBy === column) {
            // Toggle order
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, default to desc
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    // Sort employees
    const sortedEmployees = summaryData?.employees ? [...summaryData.employees].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }) : [];

    const SortIcon = ({ column }) => {
        if (sortBy !== column) return <ArrowUpDown className="w-4 h-4 text-dark-500" />;
        return sortOrder === 'asc' ?
            <ArrowUp className="w-4 h-4 text-primary-400" /> :
            <ArrowDown className="w-4 h-4 text-primary-400" />;
    };

    return (
        <div className="space-y-6">
            {/* Month Selector */}
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <label className="label">{t('cashClosing.period')}</label>
                    <input
                        type="month"
                        className="input max-w-xs"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
            ) : summaryData ? (
                <>
                    {/* Summary Table */}
                    {sortedEmployees.length > 0 ? (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>{t('cashClosing.employee')}</th>
                                        <th
                                            className="cursor-pointer hover:bg-dark-700 transition-colors"
                                            onClick={() => handleSort('paymentsCount')}
                                        >
                                            <div className="flex items-center gap-2">
                                                {t('cashClosing.period')}
                                                <SortIcon column="paymentsCount" />
                                            </div>
                                        </th>
                                        <th
                                            className="cursor-pointer hover:bg-dark-700 transition-colors"
                                            onClick={() => handleSort('cashTotal')}
                                        >
                                            <div className="flex items-center gap-2">
                                                {t('cashClosing.expectedCash')}
                                                <SortIcon column="cashTotal" />
                                            </div>
                                        </th>
                                        <th
                                            className="cursor-pointer hover:bg-dark-700 transition-colors"
                                            onClick={() => handleSort('nonCashTotal')}
                                        >
                                            <div className="flex items-center gap-2">
                                                {t('cashClosing.expectedNonCash')}
                                                <SortIcon column="nonCashTotal" />
                                            </div>
                                        </th>
                                        <th
                                            className="cursor-pointer hover:bg-dark-700 transition-colors"
                                            onClick={() => handleSort('total')}
                                        >
                                            <div className="flex items-center gap-2">
                                                {t('cashClosing.expectedTotal')}
                                                <SortIcon column="total" />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedEmployees.map((employee) => (
                                        <motion.tr
                                            key={employee.employeeId}
                                            whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                                            className="cursor-pointer"
                                            onClick={() => handleEmployeeClick(employee)}
                                        >
                                            <td className="font-medium">{employee.employeeName}</td>
                                            <td>{formatNumber(employee.paymentsCount, i18n.language)}</td>
                                            <td className="text-emerald-400">
                                                {formatCurrency(employee.cashTotal, i18n.language, currencyConf)}
                                            </td>
                                            <td className="text-blue-400">
                                                {formatCurrency(employee.nonCashTotal, i18n.language, currencyConf)}
                                            </td>
                                            <td className="font-bold text-primary-400">
                                                {formatCurrency(employee.total, i18n.language, currencyConf)}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                                {/* Grand Total Row */}
                                {summaryData.grandTotal && (
                                    <tfoot>
                                        <tr className="bg-dark-900/50 font-bold">
                                            <td>{t('cashClosing.summary')}</td>
                                            <td>{formatNumber(summaryData.grandTotal.paymentsCount, i18n.language)}</td>
                                            <td className="text-emerald-400">
                                                {formatCurrency(summaryData.grandTotal.cashTotal, i18n.language, currencyConf)}
                                            </td>
                                            <td className="text-blue-400">
                                                {formatCurrency(summaryData.grandTotal.nonCashTotal, i18n.language, currencyConf)}
                                            </td>
                                            <td className="text-primary-400">
                                                {formatCurrency(summaryData.grandTotal.grossTotal || summaryData.grandTotal.total, i18n.language, currencyConf)}
                                            </td>
                                        </tr>
                                        {/* Refunds Line Item */}
                                        <tr className="bg-red-50 dark:bg-red-900/20 font-bold border-t border-red-200 dark:border-red-800">
                                            <td colSpan="4" className="text-right pr-4 text-red-600 dark:text-red-300">
                                                {t('reports.totalRefunds', 'Total Refunds')} (-)
                                            </td>
                                            <td className="text-red-600 dark:text-red-400">
                                                {formatCurrency(summaryData.grandTotal.refundsTotal || 0, i18n.language, currencyConf)}
                                            </td>
                                        </tr>
                                        {/* Net Revenue */}
                                        <tr className="bg-emerald-50 dark:bg-emerald-900/20 font-bold border-t border-emerald-200 dark:border-emerald-800 text-lg">
                                            <td colSpan="4" className="text-right pr-4 text-emerald-800 dark:text-emerald-300">
                                                {t('reports.netRevenue', 'Net Revenue')} (=)
                                            </td>
                                            <td className="text-emerald-700 dark:text-emerald-400">
                                                {formatCurrency(summaryData.grandTotal.netRevenue || ((summaryData.grandTotal.grossTotal || summaryData.grandTotal.total) - (summaryData.grandTotal.refundsTotal || 0)), i18n.language, currencyConf)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-dark-500">
                                {t('cashClosing.noClosings', 'لا يوجد تحصيلات في هذا الشهر')}
                            </p>
                        </div>
                    )}
                </>
            ) : null}

            {/* Payment Details Modal */}
            <PaymentDetailsModal
                isOpen={isPaymentsModalOpen}
                onClose={() => {
                    setIsPaymentsModalOpen(false);
                    setSelectedEmployee(null);
                    setEmployeePayments(null);
                }}
                employee={selectedEmployee}
                payments={isFetchingPayments ? null : employeePayments}
                month={selectedMonth}
            />
        </div>
    );
};

export default MonthlyCollectionSummary;
