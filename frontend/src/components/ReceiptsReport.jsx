import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FileSpreadsheet,
    FileText,
    Search,
    Printer,
    Eye,
    RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { formatDateTime } from '../utils/dateFormatter';
import { formatMoney } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';
import ReportSummaryCards from './ReportSummaryCards';
import ThermalReceipt from './receipts/ThermalReceipt';
import toast from 'react-hot-toast';

const ReceiptsReport = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRtl = i18n.language === 'ar';
    const alignStart = isRtl ? 'text-right' : 'text-left';
    const alignEnd = isRtl ? 'text-left' : 'text-right';

    const [tab, setTab] = useState('sales');
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({ count: 0, totalSales: 0, totalPaid: 0, totalRefunded: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        staffId: '',
        search: ''
    });

    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [autoPrint, setAutoPrint] = useState(false);
    const [isCopy, setIsCopy] = useState(false);
    const receiptRef = useRef(null);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };
    const gymName = getSetting('gym_name', t('receipt.companyName', 'GYM MANAGEMENT'));
    const gymPhone = getSetting('gym_phone', '');

    const tabType = tab === 'sales' ? 'sale' : 'general';
    const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/users/list');
            setEmployees(response.data.data || []);
        } catch (error) {
            setEmployees([]);
        }
    };

    const fetchReceipts = async () => {
        if (!isActive) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                type: tabType,
                startDate: filters.startDate,
                endDate: filters.endDate
            });
            if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
            if (filters.staffId) params.append('staffId', filters.staffId);
            if (filters.search) params.append('search', filters.search);

            const response = await api.get(`/receipts?${params}`);
            const data = response.data.data || {};
            setRows(data.rows || []);
            setSummary(data.summary || { count: 0, totalSales: 0, totalPaid: 0, totalRefunded: 0 });
        } catch (error) {
            toast.error(t('reports.errors.serverError', 'Failed to load receipts'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchEmployees();
        }
    }, [isActive]);

    useEffect(() => {
        fetchReceipts();
    }, [isActive, tab, filters.startDate, filters.endDate, filters.paymentMethod, filters.staffId]);

    const handleExport = async (format) => {
        try {
            const params = new URLSearchParams({
                type: tabType,
                startDate: filters.startDate,
                endDate: filters.endDate,
                format
            });
            if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
            if (filters.staffId) params.append('staffId', filters.staffId);
            if (filters.search) params.append('search', filters.search);

            const url = `${apiBase}/receipts?${params.toString()}`;
            window.open(url, '_blank');
        } catch (error) {
            toast.error(t('reports.exportFailed', 'Export failed'));
        }
    };

    const handlePrint = () => {
        if (!receiptRef.current) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.setAttribute('title', 'receipt-print');
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(node => node.outerHTML)
            .join('');
        const printStyles = `
            @page { margin: 10mm; }
            body { margin: 0; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        `;

        doc.open();
        doc.write(`<!doctype html><html><head>${styles}<style>${printStyles}</style></head><body dir="${i18n.language === 'ar' ? 'rtl' : 'ltr'}">${receiptRef.current.innerHTML}</body></html>`);
        doc.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    };

    useEffect(() => {
        if (!autoPrint || !selectedReceipt) return;
        let tries = 0;
        let timer = null;

        const attemptPrint = () => {
            if (receiptRef.current) {
                handlePrint();
                setAutoPrint(false);
                return;
            }
            tries += 1;
            if (tries <= 10) {
                timer = setTimeout(attemptPrint, 50);
            } else {
                setAutoPrint(false);
            }
        };

        attemptPrint();

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [autoPrint, selectedReceipt]);

    const handleView = (receipt) => {
        setSelectedReceipt(receipt);
        setIsCopy(false);
        setShowReceiptModal(true);
    };

    const handleReprint = (receipt) => {
        setSelectedReceipt(receipt);
        setIsCopy(true);
        setShowReceiptModal(true);
        setAutoPrint(true);
    };

    if (!isActive) return null;

    return (
        <div className="space-y-4">
            <ReportSummaryCards
                gridClassName="md:grid-cols-4"
                items={[
                    {
                        label: t('reports.receipts.count', 'Receipts'),
                        value: summary.count,
                        icon: FileText,
                        iconClassName: 'bg-indigo-500'
                    },
                    {
                        label: t('reports.receipts.totalSales', 'Total sales'),
                        value: formatMoney(summary.totalSales || 0, i18n.language, currencyConf),
                        icon: FileSpreadsheet,
                        iconClassName: 'bg-emerald-500'
                    },
                    {
                        label: t('reports.receipts.totalPaid', 'Total paid'),
                        value: formatMoney(summary.totalPaid || 0, i18n.language, currencyConf),
                        icon: Printer,
                        iconClassName: 'bg-blue-500'
                    },
                    {
                        label: t('reports.receipts.totalRefunded', 'Total refunded'),
                        value: formatMoney(summary.totalRefunded || 0, i18n.language, currencyConf),
                        icon: RefreshCw,
                        iconClassName: 'bg-red-500'
                    }
                ]}
            />

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setTab('sales')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm ${tab === 'sales'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900/40 text-gray-400 hover:text-white'
                            }`}
                    >
                        {t('reports.receipts.salesTab', 'Sales Receipts')}
                    </button>
                    <button
                        onClick={() => setTab('general')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm ${tab === 'general'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900/40 text-gray-400 hover:text-white'
                            }`}
                    >
                        {t('reports.receipts.generalTab', 'General Receipts')}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label className="label">{t('reports.from')}</label>
                        <input
                            type="date"
                            className="input"
                            value={filters.startDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="label">{t('reports.to')}</label>
                        <input
                            type="date"
                            className="input"
                            value={filters.endDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="label">{t('reports.fields.paymentMethod', 'Method')}</label>
                        <select
                            className="input"
                            value={filters.paymentMethod}
                            onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        >
                            <option value="">{t('common.all', 'All')}</option>
                            <option value="cash">{t('payments.cash', 'Cash')}</option>
                            <option value="card">{t('payments.card', 'Card')}</option>
                            <option value="transfer">{t('payments.transfer', 'Transfer')}</option>
                            <option value="other">{t('payments.other', 'Other')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">{t('reports.filterByEmployee', 'Filter by Employee')}</label>
                        <select
                            className="input"
                            value={filters.staffId}
                            onChange={(e) => setFilters(prev => ({ ...prev, staffId: e.target.value }))}
                        >
                            <option value="">{t('common.all', 'All')}</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.firstName} {emp.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 relative">
                        <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                        <input
                            type="text"
                            className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-white placeholder:text-gray-500`}
                            placeholder={t('reports.receipts.searchPlaceholder', 'Receipt / Transaction / Customer')}
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        />
                    </div>
                    <button
                        onClick={fetchReceipts}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold"
                    >
                        {t('reports.generate', 'Generate')}
                    </button>
                    <button
                        onClick={() => handleExport('excel')}
                        className="px-4 py-2 rounded-xl bg-slate-700 text-white font-bold"
                    >
                        {t('reports.exportExcel', 'Export Excel')}
                    </button>
                    <button
                        onClick={() => handleExport('pdf')}
                        className="px-4 py-2 rounded-xl bg-slate-700 text-white font-bold"
                    >
                        {t('reports.exportPdf', 'Export PDF')}
                    </button>
                </div>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${alignStart}`}>{t('receipt.number', 'Receipt #')}</th>
                                <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${alignStart}`}>{t('receipt.transactionId', 'Transaction')}</th>
                                <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${alignStart}`}>{t('receipt.customer', 'Customer')}</th>
                                <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${alignStart}`}>{t('receipt.staff', 'Cashier')}</th>
                                <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${alignStart}`}>{t('reports.fields.paymentMethod', 'Method')}</th>
                                <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${alignEnd}`}>{t('receipt.total', 'Total')}</th>
                                <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${alignStart}`}>{t('receipt.date', 'Date')}</th>
                                <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${alignEnd}`}>{t('common.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan="8" className="text-center text-gray-400 py-6">
                                        {t('reports.noData', 'No data')}
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60">
                                    <td className={`px-4 py-3 ${alignStart}`}>{row.receiptNo}</td>
                                    <td className={`px-4 py-3 ${alignStart}`}>{row.transactionId}</td>
                                    <td className={`px-4 py-3 ${alignStart}`}>
                                        {row.customerName || t('receipt.walkIn', 'Walk-in Customer')}
                                    </td>
                                    <td className={`px-4 py-3 ${alignStart}`}>{row.staffName || '-'}</td>
                                    <td className={`px-4 py-3 ${alignStart}`}>{row.paymentMethod || '-'}</td>
                                    <td className={`px-4 py-3 ${alignEnd}`}>
                                        {formatMoney(row.totals?.total || 0, i18n.language, currencyConf)}
                                    </td>
                                    <td className={`px-4 py-3 ${alignStart}`}>
                                        {formatDateTime(row.createdAt, i18n.language)}
                                    </td>
                                    <td className={`px-4 py-3 ${alignEnd}`}>
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleView(row)}
                                                className="p-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
                                                title={t('payments.receipt', 'View Receipt')}
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleReprint(row)}
                                                className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                                title={t('payments.printReceipt', 'Print Receipt')}
                                            >
                                                <Printer size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {showReceiptModal && selectedReceipt && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                        onClick={() => setShowReceiptModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-white/10"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                                <h3 className="font-black text-xl text-gray-900 dark:text-white">
                                    {t('payments.receipt', 'Receipt')}
                                </h3>
                                <button
                                    onClick={() => setShowReceiptModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                                >
                                    <span className="text-gray-500">x</span>
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="hidden">
                                    <div ref={receiptRef}>
                                        <ThermalReceipt
                                            receipt={selectedReceipt}
                                            currencyConf={currencyConf}
                                            gymName={gymName}
                                            gymPhone={gymPhone}
                                            isCopy={isCopy}
                                        />
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-gray-200 dark:border-white/10">
                                    <ThermalReceipt
                                        receipt={selectedReceipt}
                                        currencyConf={currencyConf}
                                        gymName={gymName}
                                        gymPhone={gymPhone}
                                        isCopy={isCopy}
                                    />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={handlePrint}
                                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                                    >
                                        {t('payments.printReceipt', 'Print Receipt')}
                                    </button>
                                    <button
                                        onClick={() => setShowReceiptModal(false)}
                                        className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-bold"
                                    >
                                        {t('common.close', 'Close')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReceiptsReport;
