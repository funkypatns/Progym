import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
const TrainerReportPage = () => {
    const { i18n } = useTranslation();
    const language = i18n.language || 'en';
    const isRTL = i18n.dir() === 'rtl';

    const [trainers, setTrainers] = useState([]);
    const [services, setServices] = useState([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [serviceFilter, setServiceFilter] = useState('');
    const [search, setSearch] = useState('');
    const [dateRange, setDateRange] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

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

    useEffect(() => {
        const loadInitial = async () => {
            try {
                const [trainerRes, serviceRes] = await Promise.all([
                    getStaffTrainers(),
                    apiClient.get('/services?type=SESSION&active=true')
                ]);

                if (trainerRes.data?.success) {
                    setTrainers(trainerRes.data.data || []);
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
        if (!selectedTrainerId) {
            setSummary({ unpaidTotal: 0, paidTotal: 0, sessionsCount: 0, payoutsTotal: 0 });
            setEarnings([]);
            setPayouts([]);
            return;
        }

        const params = new URLSearchParams();
        params.append('trainerId', selectedTrainerId);
        params.append('from', dateRange.from);
        params.append('to', dateRange.to);
        if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
        if (serviceFilter) params.append('serviceId', serviceFilter);
        if (search) params.append('q', search);

        setLoading(true);
        try {
            const [earningsRes, payoutsRes] = await Promise.all([
                apiClient.get(`/reports/trainer-earnings?${params.toString()}`),
                apiClient.get(`/reports/trainer-payouts?trainerId=${selectedTrainerId}&from=${dateRange.from}&to=${dateRange.to}`)
            ]);

            const earningsData = earningsRes.data?.data;
            const payoutData = payoutsRes.data?.data;

            setEarnings(Array.isArray(earningsData?.rows) ? earningsData.rows : []);
            setPayouts(Array.isArray(payoutData?.rows) ? payoutData.rows : []);

            setSummary({
                unpaidTotal: earningsData?.summary?.unpaidTotal || 0,
                paidTotal: earningsData?.summary?.paidTotal || 0,
                sessionsCount: earningsData?.summary?.sessionsCount || 0,
                payoutsTotal: payoutData?.totals?.totalAmount || 0
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
    }, [selectedTrainerId, statusFilter, serviceFilter, search, dateRange.from, dateRange.to]);

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
            CommissionPercent: row.commissionPercent ?? '',
            CommissionAmount: row.commissionAmount,
            Status: row.status,
            Employee: row.employeeName || ''
        }));
        exportCsv('trainer-earnings.csv', rows);
    };

    const handleExportPayouts = () => {
        const rows = payouts.map((row) => ({
            Date: formatDateTime(row.paidAt, language),
            Trainer: row.trainerName,
            PaidBy: row.paidByName,
            Amount: row.totalAmount,
            Method: row.method,
            Note: row.note || ''
        }));
        exportCsv('trainer-payouts.csv', rows);
    };

    const handleOpenDetails = (row) => {
        setSelectedEarning(row);
        setDetailsOpen(true);
    };

    const handlePayoutConfirm = async ({ earningIds, amount, method, note }) => {
        if (!selectedTrainerId) return;
        setPayoutLoading(true);
        try {
            await apiClient.post(`/trainers/${selectedTrainerId}/payout`, {
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
                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        icon={Calendar}
                    />

                    <ReportsToolbar.DateRange
                        label={isRTL ? 'إلى' : 'To'}
                        value={dateRange.to}
                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        icon={Calendar}
                    />

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
                        <ReportsTableContainer.Table>
                            <ReportsTableContainer.Head>
                                <ReportsTableContainer.Row>
                                    <ReportsTableContainer.Header>{isRTL ? 'الوقت' : 'Date/Time'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'العميل' : 'Customer'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'الخدمة' : 'Service'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'الأساس' : 'Base Amount'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'نسبة العمولة' : 'Commission %'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'قيمة العمولة' : 'Commission Amount'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'الحالة' : 'Status'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'الموظف' : 'Employee'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header></ReportsTableContainer.Header>
                                </ReportsTableContainer.Row>
                            </ReportsTableContainer.Head>
                            <ReportsTableContainer.Body>
                                {earnings.length === 0 && (
                                    <ReportsTableContainer.Row>
                                        <ReportsTableContainer.Cell colSpan={9}>
                                            <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                                                {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : (isRTL ? 'لا توجد بيانات' : 'No data available')}
                                            </div>
                                        </ReportsTableContainer.Cell>
                                    </ReportsTableContainer.Row>
                                )}
                                {earnings.map((row) => (
                                    <ReportsTableContainer.Row key={row.id}>
                                        <ReportsTableContainer.Cell>{formatDateTime(row.sessionDate, language)}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>
                                            {row.customerCode ? `${row.customerName} (${row.customerCode})` : row.customerName}
                                        </ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{row.serviceName || '-'}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{formatMoney(row.baseAmount, language, { code: 'EGP', symbol: 'EGP' })}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{row.commissionPercent !== null ? `${row.commissionPercent}%` : '-'}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{formatMoney(row.commissionAmount, language, { code: 'EGP', symbol: 'EGP' })}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{row.status}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{row.employeeName || '-'}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>
                                            <button
                                                onClick={() => handleOpenDetails(row)}
                                                className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
                                            >
                                                {isRTL ? 'عرض' : 'View'}
                                            </button>
                                        </ReportsTableContainer.Cell>
                                    </ReportsTableContainer.Row>
                                ))}
                            </ReportsTableContainer.Body>
                        </ReportsTableContainer.Table>
                    </ReportsTableContainer>

                    <ReportsTableContainer
                        title={isRTL ? 'سجل السدادات' : 'Payouts Log'}
                        subtitle={isRTL ? 'عمليات سداد المدربين' : 'Payout transactions'}
                    >
                        <ReportsTableContainer.Table>
                            <ReportsTableContainer.Head>
                                <ReportsTableContainer.Row>
                                    <ReportsTableContainer.Header>{isRTL ? 'المبلغ' : 'Amount'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'التاريخ' : 'Date'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'الموظف' : 'Paid By'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'المدرب' : 'Trainer'}</ReportsTableContainer.Header>
                                    <ReportsTableContainer.Header>{isRTL ? 'ملاحظة' : 'Notes'}</ReportsTableContainer.Header>
                                </ReportsTableContainer.Row>
                            </ReportsTableContainer.Head>
                            <ReportsTableContainer.Body>
                                {payouts.length === 0 && (
                                    <ReportsTableContainer.Row>
                                        <ReportsTableContainer.Cell colSpan={5}>
                                            <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                                                {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : (isRTL ? 'لا توجد سدادات' : 'No payouts available')}
                                            </div>
                                        </ReportsTableContainer.Cell>
                                    </ReportsTableContainer.Row>
                                )}
                                {payouts.map((row) => (
                                    <ReportsTableContainer.Row key={row.id}>
                                        <ReportsTableContainer.Cell>{formatMoney(row.totalAmount, language, { code: 'EGP', symbol: 'EGP' })}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{formatDateTime(row.paidAt, language)}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{row.paidByName || '-'}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{row.trainerName || '-'}</ReportsTableContainer.Cell>
                                        <ReportsTableContainer.Cell>{row.note || '-'}</ReportsTableContainer.Cell>
                                    </ReportsTableContainer.Row>
                                ))}
                            </ReportsTableContainer.Body>
                        </ReportsTableContainer.Table>
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
