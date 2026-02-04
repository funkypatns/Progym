import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
    Calendar,
    Download,
    Filter,
    Users,
    Wallet,
    FileText,
    CheckCircle,
    X,
    ClipboardList
} from 'lucide-react';
import apiClient, { getStaffTrainers } from '../../utils/api';
import ReportsPageShell from '../../components/Reports/ReportsPageShell';
import ReportsToolbar from '../../components/Reports/ReportsToolbar';
import ReportsTableContainer from '../../components/Reports/ReportsTableContainer';
import VirtualizedTable from '../../components/Reports/VirtualizedTable';
import { formatDateTime, formatMoney } from '../../utils/numberFormatter';
import toast from 'react-hot-toast';

const SummaryCard = ({ label, value, icon: Icon }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Icon size={18} />
            </div>
            <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
            </div>
        </div>
    </div>
);

const TrainerDetailsModal = ({ isOpen, onClose, earning, language }) => {
    if (!isOpen || !earning) return null;
    const appointment = earning.appointment || {};
    const payments = Array.isArray(appointment.payments) ? appointment.payments : [];
    const customerLabel = earning.customerCode
        ? `${earning.customerName} (${earning.customerCode})`
        : earning.customerName;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                        <FileText size={18} />
                        {language === 'ar' ? 'تفاصيل الجلسة' : 'Session Details'}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {language === 'ar' ? 'العميل' : 'Customer'}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">{customerLabel || '-'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {language === 'ar' ? 'المدرب' : 'Trainer'}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">{earning.trainerName || '-'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {language === 'ar' ? 'الخدمة' : 'Service'}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">{earning.serviceName || '-'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {language === 'ar' ? 'الوقت' : 'Date/Time'}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                                {formatDateTime(earning.sessionDate, language)}
                            </div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {language === 'ar' ? 'السعر' : 'Price'}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                                {formatMoney(appointment.price || earning.baseAmount, language, { code: 'EGP', symbol: 'EGP' })}
                            </div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {language === 'ar' ? 'حالة الدفع' : 'Payment Status'}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">{earning.paymentStatus || '-'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {language === 'ar' ? 'حالة الجلسة' : 'Session Status'}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">{earning.appointmentStatus || '-'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {language === 'ar' ? 'الموظف' : 'Employee'}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">{earning.employeeName || '-'}</div>
                        </div>
                    </div>

                    {payments.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                {language === 'ar' ? 'المدفوعات' : 'Payments'}
                            </div>
                            <div className="space-y-2 text-sm">
                                {payments.map((payment) => (
                                    <div key={payment.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                                        <div className="text-gray-600 dark:text-gray-300">
                                            {payment.method || '-'} · {payment.status || '-'}
                                        </div>
                                        <div className="font-semibold text-gray-900 dark:text-white">
                                            {formatMoney(payment.amount || 0, language, { code: 'EGP', symbol: 'EGP' })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
const TrainerPayoutModal = ({ isOpen, onClose, trainer, pendingEarnings, onConfirm, isSubmitting, language }) => {
    const [payAll, setPayAll] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('CASH');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const ids = pendingEarnings.map(item => item.id);
        const total = pendingEarnings.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);
        setPayAll(true);
        setSelectedIds(ids);
        setAmount(total ? total.toFixed(2) : '');
        setMethod('CASH');
        setNote('');
    }, [isOpen, pendingEarnings]);

    if (!isOpen) return null;

    const effectiveIds = payAll ? pendingEarnings.map(item => item.id) : selectedIds;
    const effectiveTotal = pendingEarnings
        .filter(item => effectiveIds.includes(item.id))
        .reduce((sum, item) => sum + (item.commissionAmount || 0), 0);

    const canSubmit = effectiveIds.length > 0 && effectiveTotal > 0;

    const toggleId = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleConfirm = () => {
        const numericAmount = amount !== '' ? parseFloat(amount) : effectiveTotal;
        onConfirm({
            earningIds: effectiveIds,
            amount: Number.isNaN(numericAmount) ? effectiveTotal : numericAmount,
            method,
            note
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                        <Wallet size={18} />
                        {language === 'ar' ? 'سداد مستحقات المدرب' : 'Trainer Payout'}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-600 dark:text-gray-300">
                            {language === 'ar' ? 'المدرب' : 'Trainer'}
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">{trainer?.name || '-'}</div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-600 dark:text-gray-300">
                            {language === 'ar' ? 'المتأخرات' : 'Pending Total'}
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                            {formatMoney(effectiveTotal, language, { code: 'EGP', symbol: 'EGP' })}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={payAll}
                            onChange={(e) => setPayAll(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {language === 'ar' ? 'سداد كل المستحقات' : 'Pay all pending earnings'}
                        </span>
                    </div>

                    {!payAll && (
                        <div className="max-h-52 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            {pendingEarnings.map((item) => (
                                <label key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => toggleId(item.id)}
                                    />
                                    <span className="flex-1 text-gray-700 dark:text-gray-300">
                                        {item.customerName || '-'} · {formatDateTime(item.sessionDate, language)}
                                    </span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {formatMoney(item.commissionAmount || 0, language, { code: 'EGP', symbol: 'EGP' })}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                                {language === 'ar' ? 'المبلغ' : 'Payout Amount'}
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                                {language === 'ar' ? 'طريقة الدفع' : 'Method'}
                            </label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            >
                                <option value="CASH">{language === 'ar' ? 'نقدي' : 'Cash'}</option>
                                <option value="TRANSFER">{language === 'ar' ? 'تحويل' : 'Transfer'}</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                            {language === 'ar' ? 'ملاحظة' : 'Note'}
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full min-h-[80px] p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canSubmit || isSubmitting}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? <CheckCircle size={16} /> : <Wallet size={16} />}
                        {language === 'ar' ? 'تأكيد السداد' : 'Confirm Payout'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TRAINER_REPORT_FILTERS_KEY = 'trainerReportFilters';
const TRAINER_REPORT_FILTERS_USER_SET_KEY = 'trainerReportFiltersUserSet';

const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const buildDefaultRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
        from: formatDateInput(start),
        to: formatDateInput(today)
    };
};

const isValidDateValue = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 1 || year > currentYear + 1) return null;
    return parsed;
};

const isValidRange = (range) => {
    if (!range || !range.from || !range.to) return false;
    const start = isValidDateValue(range.from);
    const end = isValidDateValue(range.to);
    if (!start || !end) return false;
    return true;
};

const normalizeRangeForInput = (range) => {
    if (!range || !range.from || !range.to) return null;
    const start = isValidDateValue(range.from);
    const end = isValidDateValue(range.to);
    if (!start || !end) return null;
    return {
        from: formatDateInput(start),
        to: formatDateInput(end)
    };
};
\r\n};

const getRangeFromQuery = (search) => {
    if (!search) return null;
    const params = new URLSearchParams(search);
    const from = params.get('from') || params.get('startDate');
    const to = params.get('to') || params.get('endDate');
    if (!from || !to) return null;
    return { from, to };
};

const getStoredRange = () => {
    try {
        const raw = localStorage.getItem(TRAINER_REPORT_FILTERS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.from !== 'string' || typeof parsed.to !== 'string') {
            return null;
        }
        return parsed;
    } catch (error) {
        return null;
    }
};

const clearStoredRange = () => {
    try {
        localStorage.removeItem(TRAINER_REPORT_FILTERS_KEY);
        localStorage.removeItem(TRAINER_REPORT_FILTERS_USER_SET_KEY);
    } catch (error) {
        // ignore
    }
};

const resolveInitialRange = (search) => {
    const urlRange = getRangeFromQuery(search);
    if (isValidRange(urlRange)) {
        return { range: normalizeRangeForInput(urlRange), source: 'url' };
    }

    const userSet = localStorage.getItem(TRAINER_REPORT_FILTERS_USER_SET_KEY) === 'true';
    if (userSet) {
        const stored = getStoredRange();
        if (isValidRange(stored)) {
            return { range: normalizeRangeForInput(stored), source: 'storage' };
        }
        clearStoredRange();
    }

    return { range: buildDefaultRange(), source: 'default' };
};

const TrainerReportPage = () => {
    const { i18n, t } = useTranslation();
    const language = i18n.language || 'en';
    const isRTL = i18n.dir() === 'rtl';
    const location = useLocation();
    const didInitRef = useRef(false);

    const [trainers, setTrainers] = useState([]);
    const [services, setServices] = useState([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [serviceFilter, setServiceFilter] = useState('');
    const [search, setSearch] = useState('');
    const defaultRange = useMemo(() => buildDefaultRange(), []);
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [filtersReady, setFiltersReady] = useState(false);
    const [refreshSeed, setRefreshSeed] = useState(0);

    const [summary, setSummary] = useState({ unpaidTotal: 0, paidTotal: 0, sessionsCount: 0, payoutsTotal: 0 });
    const [earnings, setEarnings] = useState([]);
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [payoutLoading, setPayoutLoading] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedEarning, setSelectedEarning] = useState(null);
    const [payoutModalOpen, setPayoutModalOpen] = useState(false);

    const selectedTrainer = useMemo(() => {
        return trainers.find((trainer) => String(trainer.id) === String(selectedTrainerId)) || null;
    }, [trainers, selectedTrainerId]);

    const pendingEarnings = useMemo(() => {
        return earnings.filter(item => item.status === 'UNPAID');
    }, [earnings]);

    const isDefaultRange = dateRange.from === defaultRange.from && dateRange.to === defaultRange.to;

    const persistDateRange = useCallback((range) => {
        try {
            localStorage.setItem(TRAINER_REPORT_FILTERS_USER_SET_KEY, 'true');
            localStorage.setItem(TRAINER_REPORT_FILTERS_KEY, JSON.stringify(range));
        } catch (error) {
            // ignore storage errors
        }
    }, []);

    const toStartOfDay = (value) => (value ? `${value}T00:00:00` : '');
    const toEndOfDay = (value) => (value ? `${value}T23:59:59.999` : '');
    const normalizeRange = (from, to) => {
        if (!from || !to) return { from, to, swapped: false };
        const start = new Date(from);
        const end = new Date(to);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return { from, to, swapped: false };
        }
        if (start > end) return { from: to, to: from, swapped: true };
        return { from, to, swapped: false };
    };

    useEffect(() => {
        if (didInitRef.current) return;
        const resolved = resolveInitialRange(location.search);
        setDateRange(resolved.range);
        setFiltersReady(true);
        didInitRef.current = true;
    }, [location.search]);

    useEffect(() => {
        const loadInitial = async () => {
            try {
                const [trainerRes, serviceRes] = await Promise.all([
                    getStaffTrainers(),
                    apiClient.get('/services?type=SESSION&active=true')
                ]);

                if (trainerRes.data?.success) {
                    const trainerList = trainerRes.data.data || [];
                    setTrainers(trainerList);
                    if (!selectedTrainerId && trainerList.length > 0) {
                        setSelectedTrainerId(String(trainerList[0].id));
                    }
                }
                if (serviceRes.data?.success) {
                    setServices(serviceRes.data.data || []);
                }
            } catch (error) {
                console.warn('Failed to load report filters', error);
            }
        };
        loadInitial();
    }, []);

    const fetchReport = async () => {
        if (!filtersReady || !dateRange.from || !dateRange.to) {
            return;
        }
        if (!selectedTrainerId) {
            setSummary({ unpaidTotal: 0, paidTotal: 0, sessionsCount: 0, payoutsTotal: 0 });
            setEarnings([]);
            setPayouts([]);
            return;
        }

        const params = new URLSearchParams();
        const normalized = normalizeRange(dateRange.from, dateRange.to);
        if (normalized.swapped) {
            setDateRange({ from: normalized.from, to: normalized.to });
            return;
        }
        const startDate = toStartOfDay(normalized.from);
        const endDate = toEndOfDay(normalized.to);
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);

        setLoading(true);
        try {
            const [earningsRes, payoutsRes] = await Promise.all([
                apiClient.get(`/staff-trainers/${selectedTrainerId}/earnings?${params.toString()}`),
                apiClient.get(`/staff-trainers/${selectedTrainerId}/payouts?startDate=${startDate}&endDate=${endDate}`)
            ]);

            const earningsData = earningsRes.data?.data;
            const payoutList = Array.isArray(payoutsRes.data?.data) ? payoutsRes.data.data : [];

            const serviceName = serviceFilter
                ? (services.find(item => String(item.id) === String(serviceFilter))?.name || '')
                : '';
            const normalizedSearch = search.trim().toLowerCase();

            const normalizedEarnings = (Array.isArray(earningsData?.earnings) ? earningsData.earnings : [])
                .map((item) => ({
                    id: item.id,
                    appointmentId: item.appointmentId,
                    sessionDate: item.date,
                    customerName: item.customerName || '',
                    customerCode: item.customerCode || '',
                    serviceName: item.sourceRef || '',
                    baseAmount: item.basisAmount || 0,
                    ruleText: item.ruleText || '',
                    commissionAmount: item.earningAmount || 0,
                    status: item.status === 'paid' ? 'PAID' : 'UNPAID',
                    employeeName: item.employeeName || '',
                    trainerName: selectedTrainer?.name || ''
                }))
                .filter((item) => {
                    if (serviceName && !String(item.serviceName || '').toLowerCase().includes(serviceName.toLowerCase())) {
                        return false;
                    }
                    if (normalizedSearch) {
                        const haystack = `${item.customerName} ${item.customerCode} ${item.serviceName}`.toLowerCase();
                        if (!haystack.includes(normalizedSearch)) return false;
                    }
                    return true;
                });

            const filteredPayouts = payoutList.filter((payout) => {
                if (!payout?.paidAt) return false;
                const paidAt = new Date(payout.paidAt);
                if (Number.isNaN(paidAt.getTime())) return false;
                return paidAt >= new Date(startDate) && paidAt <= new Date(endDate);
            });

            const unpaidTotal = normalizedEarnings
                .filter(item => item.status === 'UNPAID')
                .reduce((sum, item) => sum + (item.commissionAmount || 0), 0);
            const paidTotal = normalizedEarnings
                .filter(item => item.status === 'PAID')
                .reduce((sum, item) => sum + (item.commissionAmount || 0), 0);

            setEarnings(normalizedEarnings);
            setPayouts(filteredPayouts);

            setSummary({
                unpaidTotal,
                paidTotal,
                sessionsCount: normalizedEarnings.length,
                payoutsTotal: filteredPayouts.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
            });
        } catch (error) {
            toast.error(language === 'ar' ? 'فشل تحميل تقرير المدربين' : 'Failed to load trainer report');
            setSummary({ unpaidTotal: 0, paidTotal: 0, sessionsCount: 0, payoutsTotal: 0 });
            setEarnings([]);
            setPayouts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [filtersReady, refreshSeed, selectedTrainerId, statusFilter, serviceFilter, search, dateRange.from, dateRange.to]);

    const exportCsv = (filename, rows) => {
        if (!rows.length) {
            toast.error(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }
        const headers = Object.keys(rows[0]);
        const csvRows = [
            headers.join(','),
            ...rows.map(row =>
                headers.map((header) => {
                    const value = row[header] ?? '';
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(',')
            )
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportEarnings = () => {
        const rows = earnings.map((row) => ({
            Date: formatDateTime(row.sessionDate, language),
            Customer: row.customerCode ? `${row.customerName} (${row.customerCode})` : row.customerName,
            Service: row.serviceName,
            BaseAmount: row.baseAmount,
            Rule: row.ruleText || '',
            CommissionAmount: row.commissionAmount,
            Status: row.status,
            Employee: row.employeeName || ''
        }));
        exportCsv('trainer-earnings.csv', rows);
    };

    const handleExportPayouts = () => {
        const rows = payouts.map((row) => ({
            Date: formatDateTime(row.paidAt, language),
            Trainer: row.trainer?.name || selectedTrainer?.name || '',
            PaidBy: row.paidByEmployee
                ? `${row.paidByEmployee.firstName || ''} ${row.paidByEmployee.lastName || ''}`.trim()
                : '',
            Amount: row.totalAmount,
            Method: row.method,
            Note: row.note || ''
        }));
        exportCsv('trainer-payouts.csv', rows);
    };

    const handleOpenDetails = useCallback((row) => {
        setSelectedEarning(row);
        setDetailsOpen(true);
    }, []);

    const earningsColumns = useMemo(() => ([
        {
            key: 'sessionDate',
            label: isRTL ? 'الوقت' : 'Date/Time',
            width: 'minmax(160px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => formatDateTime(row.sessionDate, language)
        },
        {
            key: 'customerName',
            label: isRTL ? 'العميل' : 'Customer',
            width: 'minmax(180px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => row.customerCode ? `${row.customerName} (${row.customerCode})` : row.customerName
        },
        {
            key: 'serviceName',
            label: isRTL ? 'الخدمة' : 'Service',
            width: 'minmax(140px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => row.serviceName || '-'
        },
        {
            key: 'baseAmount',
            label: isRTL ? 'الأساس' : 'Base Amount',
            width: 'minmax(120px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => formatMoney(row.baseAmount, language, { code: 'EGP', symbol: 'EGP' })
        },
        {
            key: 'ruleText',
            label: isRTL ? 'قاعدة العمولة' : 'Commission Rule',
            width: 'minmax(160px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => row.ruleText || '-'
        },
        {
            key: 'commissionAmount',
            label: isRTL ? 'قيمة العمولة' : 'Commission Amount',
            width: 'minmax(140px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => formatMoney(row.commissionAmount, language, { code: 'EGP', symbol: 'EGP' })
        },
        {
            key: 'status',
            label: isRTL ? 'الحالة' : 'Status',
            width: 'minmax(120px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => row.status
        },
        {
            key: 'employeeName',
            label: isRTL ? 'الموظف' : 'Employee',
            width: 'minmax(160px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => row.employeeName || '-'
        },
        {
            key: 'action',
            label: '',
            width: 120,
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => (
                <button
                    onClick={() => handleOpenDetails(row)}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
                >
                    {isRTL ? 'عرض' : 'View'}
                </button>
            )
        }
    ]), [isRTL, language, handleOpenDetails]);

    const payoutsColumns = useMemo(() => ([
        {
            key: 'totalAmount',
            label: isRTL ? 'المبلغ' : 'Amount',
            width: 'minmax(140px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => formatMoney(row.totalAmount, language, { code: 'EGP', symbol: 'EGP' })
        },
        {
            key: 'paidAt',
            label: isRTL ? 'التاريخ' : 'Date',
            width: 'minmax(160px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => formatDateTime(row.paidAt, language)
        },
        {
            key: 'paidByEmployee',
            label: isRTL ? 'الموظف' : 'Paid By',
            width: 'minmax(160px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => row.paidByEmployee
                ? `${row.paidByEmployee.firstName || ''} ${row.paidByEmployee.lastName || ''}`.trim()
                : '-'
        },
        {
            key: 'trainerName',
            label: isRTL ? 'المدرب' : 'Trainer',
            width: 'minmax(160px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => row.trainer?.name || selectedTrainer?.name || '-'
        },
        {
            key: 'note',
            label: isRTL ? 'ملاحظة' : 'Notes',
            width: 'minmax(200px, 1fr)',
            headerClassName: 'px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider',
            cellClassName: 'px-4 py-3 text-gray-900 dark:text-white',
            align: 'left',
            render: (row) => row.note || '-'
        }
    ]), [isRTL, language, selectedTrainer?.name]);

    const handlePayoutConfirm = async ({ earningIds, amount, method, note }) => {
        if (!selectedTrainerId) return;
        setPayoutLoading(true);
        try {
            await apiClient.post(`/staff-trainers/${selectedTrainerId}/payout`, {
                earningIds,
                amount,
                method,
                note
            });
            toast.success(language === 'ar' ? 'تم السداد بنجاح' : 'Payout completed');
            setPayoutModalOpen(false);
            fetchReport();
        } catch (error) {
            toast.error(error.response?.data?.message || (language === 'ar' ? 'فشل تسوية العمولات' : 'Failed to payout'));
        } finally {
            setPayoutLoading(false);
        }
    };

    const trainerRequiredMessage = isRTL ? 'اختر مدرب لعرض التقرير' : 'Select a trainer to view report';

    const handleDateChange = useCallback((field) => (event) => {
        const value = event.target.value;
        const nextRange = { ...dateRange, [field]: value };
        setDateRange(nextRange);
        persistDateRange(nextRange);
    }, [dateRange, persistDateRange]);

    const handleResetToCurrentMonth = useCallback(() => {
        const nextRange = buildDefaultRange();
        setDateRange(nextRange);
        persistDateRange(nextRange);
        setRefreshSeed((prev) => prev + 1);
    }, [persistDateRange]);

    return (
        <ReportsPageShell
            title={isRTL ? 'تقرير المدربين' : 'Trainer Report'}
            subtitle={isRTL ? 'تقرير العمولات والسدادات' : 'Commissions and payout analytics'}
        >
            <div className="sticky top-0 z-20">
                <ReportsToolbar className="shadow-sm">
                    <ReportsToolbar.Select
                        label={isRTL ? 'المدرب' : 'Trainer'}
                        value={selectedTrainerId}
                        onChange={(e) => setSelectedTrainerId(e.target.value)}
                        options={trainers.map((trainer) => ({ value: trainer.id, label: trainer.name }))}
                        icon={Users}
                        placeholder={isRTL ? 'اختر مدرب' : 'Select trainer'}
                    />

                    <ReportsToolbar.DateRange
                        label={isRTL ? 'من' : 'From'}
                        value={dateRange.from}
                        onChange={handleDateChange('from')}
                        icon={Calendar}
                    />

                    <ReportsToolbar.DateRange
                        label={isRTL ? 'إلى' : 'To'}
                        value={dateRange.to}
                        onChange={handleDateChange('to')}
                        icon={Calendar}
                    />

                    <ReportsToolbar.Button
                        variant="secondary"
                        onClick={handleResetToCurrentMonth}
                        className="h-10 px-3"
                    >
                        {isRTL ? 'هذا الشهر' : 'This Month'}
                    </ReportsToolbar.Button>

                    <ReportsToolbar.Select
                        label={isRTL ? 'الحالة' : 'Status'}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        options={[
                            { value: 'ALL', label: isRTL ? 'الكل' : 'All' },
                            { value: 'UNPAID', label: isRTL ? 'غير مدفوع' : 'Unpaid' },
                            { value: 'PAID', label: isRTL ? 'مدفوع' : 'Paid' }
                        ]}
                        icon={Filter}
                    />

                    {services.length > 0 && (
                        <ReportsToolbar.Select
                            label={isRTL ? 'الخدمة' : 'Service'}
                            value={serviceFilter}
                            onChange={(e) => setServiceFilter(e.target.value)}
                            options={services.map((service) => ({ value: service.id, label: service.name }))}
                            icon={ClipboardList}
                            placeholder={isRTL ? 'الكل' : 'All services'}
                        />
                    )}

                    <ReportsToolbar.SearchInput
                        label={isRTL ? 'بحث' : 'Search'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={isRTL ? 'اسم / كود / تليفون' : 'Name / code / phone'}
                    />

                    <ReportsToolbar.Actions>
                        <ReportsToolbar.Button
                            variant="secondary"
                            icon={Download}
                            onClick={handleExportEarnings}
                            disabled={!earnings.length}
                        >
                            {isRTL ? 'تصدير جلسات' : 'Export Earnings'}
                        </ReportsToolbar.Button>
                        <ReportsToolbar.Button
                            variant="secondary"
                            icon={Download}
                            onClick={handleExportPayouts}
                            disabled={!payouts.length}
                        >
                            {isRTL ? 'تصدير السدادات' : 'Export Payouts'}
                        </ReportsToolbar.Button>
                        <ReportsToolbar.Button
                            icon={Wallet}
                            onClick={() => setPayoutModalOpen(true)}
                            disabled={!pendingEarnings.length || !selectedTrainerId}
                        >
                            {isRTL ? 'تسوية عمولات' : 'Settle Commissions'}
                        </ReportsToolbar.Button>
                    </ReportsToolbar.Actions>
                </ReportsToolbar>
            </div>

            {!selectedTrainerId ? (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center text-gray-500 dark:text-gray-400">
                    {trainerRequiredMessage}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <SummaryCard
                            label={isRTL ? 'إجمالي غير مدفوع' : 'Total Unpaid'}
                            value={formatMoney(summary.unpaidTotal, language, { code: 'EGP', symbol: 'EGP' })}
                            icon={Wallet}
                        />
                        <SummaryCard
                            label={isRTL ? 'إجمالي مدفوع' : 'Total Paid'}
                            value={formatMoney(summary.paidTotal, language, { code: 'EGP', symbol: 'EGP' })}
                            icon={CheckCircle}
                        />
                        <SummaryCard
                            label={isRTL ? 'عدد الجلسات' : 'Sessions Count'}
                            value={summary.sessionsCount}
                            icon={Calendar}
                        />
                        <SummaryCard
                            label={isRTL ? 'إجمالي السدادات' : 'Total Payouts'}
                            value={formatMoney(summary.payoutsTotal, language, { code: 'EGP', symbol: 'EGP' })}
                            icon={Wallet}
                        />
                    </div>

                    <ReportsTableContainer
                        title={isRTL ? 'جلسات العمولات' : 'Commission Sessions'}
                        subtitle={isRTL ? 'تفاصيل كل جلسة وعمولتها' : 'Each commission earning item'}
                    >
                        <VirtualizedTable
                            columns={earningsColumns}
                            rows={earnings}
                            rowHeight={52}
                            maxHeight={520}
                            headerClassName="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
                            headerCellClassName="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                            baseRowClassName="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            emptyMessage={loading
                                ? (isRTL ? 'جاري التحميل...' : 'Loading...')
                                : (isDefaultRange
                                    ? t('reports.trainerReport.emptyLast30Days')
                                    : (isRTL ? 'لا توجد بيانات' : 'No data available'))}
                            emptyClassName="py-6 text-center text-gray-500 dark:text-gray-400"
                            getRowKey={(row) => row.id}
                        />
                    </ReportsTableContainer>

                    <ReportsTableContainer
                        title={isRTL ? 'سجل السدادات' : 'Payouts Log'}
                        subtitle={isRTL ? 'عمليات سداد المدربين' : 'Payout transactions'}
                    >
                        <VirtualizedTable
                            columns={payoutsColumns}
                            rows={payouts}
                            rowHeight={52}
                            maxHeight={420}
                            headerClassName="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
                            headerCellClassName="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                            baseRowClassName="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            emptyMessage={loading
                                ? (isRTL ? 'جاري التحميل...' : 'Loading...')
                                : (isDefaultRange
                                    ? t('reports.trainerReport.emptyLast30DaysPayouts')
                                    : (isRTL ? 'لا توجد سدادات' : 'No payouts available'))}
                            emptyClassName="py-6 text-center text-gray-500 dark:text-gray-400"
                            getRowKey={(row) => row.id}
                        />
                    </ReportsTableContainer>
                </>
            )}

            <TrainerDetailsModal
                isOpen={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                earning={selectedEarning}
                language={language}
            />

            <TrainerPayoutModal
                isOpen={payoutModalOpen}
                onClose={() => setPayoutModalOpen(false)}
                trainer={selectedTrainer}
                pendingEarnings={pendingEarnings}
                onConfirm={handlePayoutConfirm}
                isSubmitting={payoutLoading}
                language={language}
            />
        </ReportsPageShell>
    );
};

export default TrainerReportPage;







