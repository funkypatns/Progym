import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar,
    Download,
    Filter,
    User,
    Users,
    Wallet,
    CreditCard,
    Eye,
    X
} from 'lucide-react';
import apiClient, { getStaffTrainers } from '../../utils/api';
import ReportsPageShell from '../../components/Reports/ReportsPageShell';
import ReportsToolbar from '../../components/Reports/ReportsToolbar';
import VirtualizedTable from '../../components/Reports/VirtualizedTable';
import { formatMoney } from '../../utils/numberFormatter';
import toast from 'react-hot-toast';

const SummaryCard = ({ label, value, icon: Icon }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Icon size={18} />
            </div>
            <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
            </div>
        </div>
    </div>
);

const parseContentDispositionFilename = (headerValue, fallbackName) => {
    if (!headerValue || typeof headerValue !== 'string') return fallbackName;
    const match = headerValue.match(/filename="(.+?)"/i);
    return match?.[1] || fallbackName;
};

const SessionLedgerDrawer = ({
    open,
    onClose,
    loading,
    error,
    data,
    isRTL,
    language,
    t,
    methodLabel,
    formatDate,
    formatTime
}) => {
    if (!open) return null;

    const customerLabel = data?.customerCode ? `${data.customerName || ''} (${data.customerCode})` : (data?.customerName || '—');
    const paymentTimeline = Array.isArray(data?.paymentTimeline) ? data.paymentTimeline : [];
    const basePrice = Number(data?.originalPrice ?? data?.finalPrice ?? 0);
    const finalPriceFromData = Number(data?.finalPrice ?? basePrice);
    const discountAmount = Math.max(0, basePrice - finalPriceFromData);
    const finalPrice = discountAmount > 0 ? (basePrice - discountAmount) : finalPriceFromData;
    const paidAmount = paymentTimeline.reduce((sum, item) => {
        const normalizedStatus = String(item?.status || '').toLowerCase();
        if (normalizedStatus !== 'completed' && normalizedStatus !== 'paid') return sum;
        return sum + Number(item?.amount || 0);
    }, 0);
    // Validation examples:
    // final=300, paid=300 => diff=0 (paid in full)
    // final=300, paid=250 => diff=50 (due)
    // final=300, paid=340 => diff=-40 (overpaid / زيادة)
    const diffAmount = Number((finalPrice - paidAmount).toFixed(2));
    const statusRaw = String(data?.appointmentStatus || '').toLowerCase();
    const isCompleted = statusRaw.includes('complete');

    return (
        <div className="fixed inset-0 z-50">
            <button
                type="button"
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
                aria-label={t('reports.gymIncomeSessionsLedger.close', 'Close')}
            />
            <aside
                className={`absolute top-0 h-full w-full max-w-[640px] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 ${isRTL ? 'left-0 border-r border-l-0' : 'right-0'}`}
                dir={isRTL ? 'rtl' : 'ltr'}
            >
                <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {t('reports.gymIncomeSessionsLedger.title', 'Session Ledger')}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {t('reports.gymIncomeSessionsLedger.subtitle', 'Full details for this session')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                            aria-label={t('reports.gymIncomeSessionsLedger.close', 'Close')}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        {loading && (
                            <div className="py-8 text-sm text-gray-600 dark:text-gray-300">
                                {t('reports.gymIncomeSessionsLedger.loading', 'Loading details...')}
                            </div>
                        )}

                        {!loading && error && (
                            <div className="py-4 text-sm text-red-700 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        {!loading && !error && data && (
                            <>
                                <section className="space-y-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-base font-semibold text-gray-900 dark:text-white">{customerLabel}</div>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold ${isCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                                            {data.appointmentStatus || (isRTL ? 'مكتملة' : 'Completed')}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">{t('reports.fields.phone', 'Phone')}: </span>
                                            <span className="text-gray-900 dark:text-white">{data.customerPhone || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">{t('reports.fields.service', 'Service')}: </span>
                                            <span className="text-gray-900 dark:text-white">{data.serviceName || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">{t('reports.gymIncome.coach', 'Coach')}: </span>
                                            <span className="text-gray-900 dark:text-white">{data.trainerName || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">{t('reports.fields.paidAt', 'Date')}: </span>
                                            <span className="text-gray-900 dark:text-white">{formatDate(data.sessionDate)} {formatTime(data.sessionDate)}</span>
                                        </div>
                                    </div>
                                </section>

                                <section className="py-4 border-b border-gray-200 dark:border-gray-700">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('reports.gymIncomeSessionsLedger.priceBreakdown', 'Price Breakdown')}</div>
                                    <div className="grid gap-3 text-sm grid-cols-2 lg:grid-cols-4">
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">{t('reports.gymIncomeSessionsLedger.finalPrice', 'Final Price')}</div>
                                            <div className="font-semibold text-gray-900 dark:text-white">{formatMoney(finalPrice, language, { code: 'EGP', symbol: 'EGP' })}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">{t('reports.fields.paidAmount', 'Paid Amount')}</div>
                                            <div className="font-semibold text-gray-900 dark:text-white">{formatMoney(paidAmount, language, { code: 'EGP', symbol: 'EGP' })}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">{t('payments.discount', 'Discount')}</div>
                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                {discountAmount > 0 ? formatMoney(discountAmount, language, { code: 'EGP', symbol: 'EGP' }) : '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">{isRTL ? 'الفرق' : 'Difference'}</div>
                                            <div className="flex items-center gap-2">
                                                {diffAmount === 0 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                        {isRTL ? 'مدفوع بالكامل' : 'Paid in full'}
                                                    </span>
                                                )}
                                                {diffAmount > 0 && (
                                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                        {formatMoney(diffAmount, language, { code: 'EGP', symbol: 'EGP' })}
                                                    </span>
                                                )}
                                                {diffAmount < 0 && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                            {formatMoney(Math.abs(diffAmount), language, { code: 'EGP', symbol: 'EGP' })}
                                                        </span>
                                                        <span className="text-[10px] text-blue-600 dark:text-blue-400">
                                                            {isRTL ? 'زيادة' : 'Overpaid'}
                                                        </span>
                                                    </span>
                                                )}
                                                {diffAmount === 0 && (
                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                        {formatMoney(0, language, { code: 'EGP', symbol: 'EGP' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="pt-4">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('reports.gymIncomeSessionsLedger.paymentTimeline', 'Payment Timeline')}</div>
                                    {paymentTimeline.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {paymentTimeline.map((item) => (
                                                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                                                    <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                                                        {methodLabel(item.method)}
                                                    </span>
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {formatMoney(Number(item.amount || 0), language, { code: 'EGP', symbol: 'EGP' })}
                                                    </span>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300">
                                                        {item.status || '—'}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                        {formatDate(item.paidAt)} {formatTime(item.paidAt)}
                                                    </span>
                                                    <span className={`text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ${isRTL ? 'mr-auto text-left' : 'ml-auto text-right'}`}>
                                                        {t('reports.fields.paidBy', 'Paid By')}: {item.paidBy || '—'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {t('reports.gymIncomeSessionsLedger.noPayments', 'No payments recorded for this session')}
                                        </div>
                                    )}
                                </section>
                            </>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
};

const GymIncomeSessionsReportPage = () => {
    const { t, i18n } = useTranslation();
    const language = i18n.language || 'en';
    const isRTL = i18n.dir() === 'rtl';

    const [trainers, setTrainers] = useState([]);
    const [services, setServices] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState({
        totalRevenue: 0,
        sessionsCount: 0,
        averagePrice: 0,
        byMethod: { CASH: 0, CARD: 0, TRANSFER: 0 }
    });
    const [rows, setRows] = useState([]);
    const [ledgerOpen, setLedgerOpen] = useState(false);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [ledgerError, setLedgerError] = useState('');
    const [ledgerData, setLedgerData] = useState(null);
    const [filters, setFilters] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        trainerId: '',
        serviceId: '',
        employeeId: '',
        method: '',
        search: ''
    });
    const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
    const reportAbortRef = useRef(null);

    const currency = { code: 'EGP', symbol: 'EGP' };
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
        const loadFilters = async () => {
            try {
                const [trainersRes, servicesRes, employeesRes] = await Promise.all([
                    getStaffTrainers(),
                    apiClient.get('/services?type=SESSION&active=true'),
                    apiClient.get('/users/list')
                ]);

                if (trainersRes.data?.success) {
                    setTrainers(trainersRes.data.data || []);
                }
                if (servicesRes.data?.success) {
                    setServices(servicesRes.data.data || []);
                }
                if (employeesRes.data?.data) {
                    setEmployees(employeesRes.data.data || []);
                }
            } catch (error) {
                console.warn('Failed to load filters', error);
            }
        };

        loadFilters();
    }, []);

    const fetchReport = async () => {
        if (reportAbortRef.current) {
            reportAbortRef.current.abort();
        }
        const controller = new AbortController();
        reportAbortRef.current = controller;
        const normalized = normalizeRange(filters.from, filters.to);
        if (normalized.swapped) {
            setFilters((prev) => ({ ...prev, from: normalized.from, to: normalized.to }));
            return;
        }
        setLoading(true);
        try {
            const normalizedMethod = filters.method ? filters.method.toLowerCase() : '';
            const trainerId = filters.trainerId ? String(filters.trainerId) : '';
            const employeeId = filters.employeeId ? String(filters.employeeId) : '';
            const serviceId = filters.serviceId ? String(filters.serviceId) : '';
            const searchValue = debouncedSearch.trim().toLowerCase();

            const params = new URLSearchParams({
                from: toStartOfDay(normalized.from),
                to: toEndOfDay(normalized.to)
            });
            if (trainerId) params.set('trainerId', trainerId);
            if (serviceId) params.set('serviceId', serviceId);
            if (employeeId) params.set('employeeId', employeeId);
            if (normalizedMethod) params.set('method', normalizedMethod);

            const response = await apiClient.get(`/reports/gym-income-sessions?${params.toString()}`, { signal: controller.signal });
            const reportData = response.data?.data || {};
            const sourceRows = Array.isArray(reportData.rows) ? reportData.rows : [];
            const byMethod = reportData.summary?.byMethod || { CASH: 0, CARD: 0, TRANSFER: 0 };

            const rows = sourceRows.filter((row) => {
                if (!searchValue) return true;
                const haystack = `${row.customerName || ''} ${row.customerCode || ''} ${row.customerPhone || ''}`.toLowerCase();
                return haystack.includes(searchValue);
            });

            const totalRevenue = rows.reduce((sum, row) => {
                const rowValue = Number(row.finalPrice ?? row.amount ?? 0);
                return sum + (Number.isFinite(rowValue) ? rowValue : 0);
            }, 0);
            const sessionsCount = rows.length;
            const averagePrice = sessionsCount ? totalRevenue / sessionsCount : 0;

            setSummary({
                totalRevenue,
                sessionsCount,
                averagePrice,
                byMethod
            });
            setRows(rows);
        } catch (error) {
            if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
            toast.error(isRTL ? 'فشل تحميل تقرير دخل الجلسات' : 'Failed to load sessions income report');
            setSummary({ totalRevenue: 0, sessionsCount: 0, averagePrice: 0, byMethod: { CASH: 0, CARD: 0, TRANSFER: 0 } });
            setRows([]);
        } finally {
            setLoading(false);
            if (reportAbortRef.current === controller) {
                reportAbortRef.current = null;
            }
        }
    };

    useEffect(() => {
        fetchReport();
    }, [filters.from, filters.to, filters.trainerId, filters.serviceId, filters.employeeId, filters.method, debouncedSearch]);

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(filters.search);
        }, 300);
        return () => clearTimeout(handle);
    }, [filters.search]);

    const methodLabel = useCallback((value) => {
        const normalized = (value || '').toUpperCase();
        const map = {
            CASH: isRTL ? 'نقدي' : 'Cash',
            CARD: isRTL ? 'بطاقة' : 'Card',
            TRANSFER: isRTL ? 'تحويل' : 'Transfer',
            MIXED: isRTL ? 'متعدد' : 'Mixed'
        };
        return map[normalized] || normalized || '-';
    }, [isRTL]);

    const formatDate = useCallback((value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }, [language]);

    const formatTime = useCallback((value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }, [language]);

    const closeLedger = useCallback(() => {
        setLedgerOpen(false);
        setLedgerError('');
    }, []);

    const openLedger = useCallback(async (row) => {
        if (!row?.appointmentId) return;
        setLedgerOpen(true);
        setLedgerLoading(true);
        setLedgerError('');
        setLedgerData({
            appointmentId: row.appointmentId,
            customerName: row.customerName || '',
            customerCode: row.customerCode || '',
            serviceName: row.serviceName || '',
            trainerName: row.trainerName || '',
            sessionDate: row.sessionDate || row.paidAt || null,
            originalPrice: Number(row.originalPrice || 0),
            finalPrice: Number(row.finalPrice ?? row.amount ?? 0),
            adjustmentDifference: Number(row.adjustmentDifference || 0),
            adjustedBy: row.adjustedBy || '',
            adjustmentReason: row.adjustmentReason || '',
            adjustedAt: row.adjustedAt || null,
            paymentTimeline: [],
            adjustmentHistory: []
        });
        try {
            const response = await apiClient.get(`/reports/gym-income-sessions/${row.appointmentId}/ledger`);
            if (response.data?.success && response.data?.data) {
                setLedgerData(response.data.data);
                return;
            }
            throw new Error('Failed to load details');
        } catch (error) {
            setLedgerError(t('reports.gymIncomeSessionsLedger.loadFailed', 'Failed to load ledger details'));
        } finally {
            setLedgerLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (!ledgerOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeLedger();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [ledgerOpen, closeLedger]);

    const exportExcel = async () => {
        if (!rows.length) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }
        try {
            const normalized = normalizeRange(filters.from, filters.to);
            if (normalized.swapped) {
                setFilters((prev) => ({ ...prev, from: normalized.from, to: normalized.to }));
                return;
            }

            const params = new URLSearchParams({
                from: toStartOfDay(normalized.from),
                to: toEndOfDay(normalized.to),
                format: 'excel'
            });
            if (filters.trainerId) params.set('trainerId', String(filters.trainerId));
            if (filters.serviceId) params.set('serviceId', String(filters.serviceId));
            if (filters.employeeId) params.set('employeeId', String(filters.employeeId));
            if (filters.method) params.set('method', String(filters.method));
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

            const response = await apiClient.get(`/reports/gym-income-sessions?${params.toString()}`, {
                responseType: 'blob'
            });

            const fallbackName = `gym-income-sessions-${normalized.from || 'report'}.xlsx`;
            const filename = parseContentDispositionFilename(response.headers?.['content-disposition'], fallbackName);
            const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(isRTL ? 'تم التصدير بنجاح' : 'Exported successfully');
        } catch (error) {
            toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
        }
    };

    const byMethod = useMemo(() => {
        return summary.byMethod || { CASH: 0, CARD: 0, TRANSFER: 0 };
    }, [summary.byMethod]);

    const tableColumns = useMemo(() => ([
        {
            key: 'index',
            label: '#',
            width: 56,
            align: 'center',
            headerClassName: 'px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap text-center',
            cellClassName: 'px-3 py-3 text-gray-500 dark:text-gray-400 text-center font-mono text-xs',
            render: (_, index) => (index + 1).toString().padStart(2, '0')
        },
        {
            key: 'sessionDate',
            label: isRTL ? 'التاريخ والوقت' : 'Date & Time',
            width: 'minmax(170px, 1fr)',
            headerClassName: 'px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap',
            cellClassName: 'px-3 py-3 text-gray-900 dark:text-white whitespace-nowrap',
            align: 'right',
            render: (row) => (
                <div>
                    <div className="font-semibold">{formatDate(row.sessionDate || row.paidAt)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatTime(row.sessionDate || row.paidAt)}</div>
                </div>
            )
        },
        {
            key: 'customerName',
            label: isRTL ? 'العميل' : 'Customer',
            width: 'minmax(190px, 1.1fr)',
            headerClassName: 'px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap',
            cellClassName: 'px-3 py-3 text-gray-900 dark:text-white',
            align: 'right',
            render: (row) => {
                const customerLabel = row.customerCode
                    ? `${row.customerName} (${row.customerCode})`
                    : row.customerName;
                return customerLabel || '—';
            }
        },
        {
            key: 'serviceName',
            label: isRTL ? 'الخدمة' : 'Service',
            width: 'minmax(160px, 1fr)',
            headerClassName: 'px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap',
            cellClassName: 'px-3 py-3 text-gray-600 dark:text-gray-300',
            align: 'right',
            render: (row) => row.serviceName || '—'
        },
        {
            key: 'paymentMethod',
            label: isRTL ? 'الدفع' : 'Method',
            width: 'minmax(120px, 0.8fr)',
            headerClassName: 'px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap',
            cellClassName: 'px-3 py-3',
            align: 'right',
            render: (row) => {
                const method = row.paymentMethod?.toLowerCase();
                const badgeClass = method === 'cash'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : method === 'card'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : method === 'transfer'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
                return (
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badgeClass}`}>
                        {methodLabel(row.paymentMethod)}
                    </span>
                );
            }
        },
        {
            key: 'amount',
            label: isRTL ? 'السعر النهائي' : 'Final',
            width: 'minmax(130px, 0.8fr)',
            headerClassName: 'px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap text-center',
            cellClassName: 'px-3 py-3 text-center whitespace-nowrap',
            align: 'center',
            render: (row) => {
                const finalPrice = Number(row.finalPrice ?? row.amount ?? 0);
                if (!Number.isFinite(finalPrice)) return '—';
                return (
                    <span className="font-bold text-gray-900 dark:text-white">
                        {formatMoney(finalPrice, language, { code: 'EGP', symbol: 'EGP' })}
                    </span>
                );
            }
        },
        {
            key: 'adjustmentDifference',
            label: isRTL ? 'التعديل' : 'Adj.',
            width: 'minmax(120px, 0.7fr)',
            headerClassName: 'px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap text-center',
            cellClassName: 'px-3 py-3 text-center whitespace-nowrap text-xs',
            align: 'center',
            render: (row) => {
                const diff = Number(row.adjustmentDifference || 0);
                if (!diff) return <span className="text-gray-400">—</span>;
                return (
                    <span className={diff > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
                        {diff > 0 ? '+' : '-'}{formatMoney(Math.abs(diff), language, { code: 'EGP', symbol: 'EGP' })}
                    </span>
                );
            }
        },
        {
            key: 'actions',
            label: t('reports.actions', 'Actions'),
            width: 'minmax(150px, 0.9fr)',
            headerClassName: 'px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap text-center',
            cellClassName: 'px-3 py-3 text-center',
            align: 'center',
            render: (row) => (
                <button
                    type="button"
                    onClick={() => openLedger(row)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                >
                    <Eye size={14} />
                    {t('reports.gymIncomeSessionsLedger.open', 'View Ledger')}
                </button>
            )
        }
    ]), [formatDate, formatTime, isRTL, methodLabel, language, openLedger, t]);

    const rowClassName = useCallback((_, index) => (
        `hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/30'}`
    ), []);

    return (
        <ReportsPageShell
            title={isRTL ? 'دخل الجيم - الجلسات' : 'Gym Income - Sessions'}
            subtitle={isRTL ? 'إيرادات الجلسات المدفوعة فقط' : 'Paid session revenue only'}
        >
            <div className="sticky top-0 z-20">
                <ReportsToolbar className="shadow-sm">
                    <ReportsToolbar.DateRange
                        label={isRTL ? 'من' : 'From'}
                        value={filters.from}
                        onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
                        icon={Calendar}
                    />

                    <ReportsToolbar.DateRange
                        label={isRTL ? 'إلى' : 'To'}
                        value={filters.to}
                        onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value }))}
                        icon={Calendar}
                    />

                    <ReportsToolbar.Select
                        label={isRTL ? 'المدرب' : 'Trainer'}
                        value={filters.trainerId}
                        onChange={(e) => setFilters(prev => ({ ...prev, trainerId: e.target.value }))}
                        options={trainers.map((trainer) => ({ value: trainer.id, label: trainer.name }))}
                        icon={Users}
                        placeholder={isRTL ? 'الكل' : 'All'}
                    />

                    {services.length > 0 && (
                        <ReportsToolbar.Select
                            label={isRTL ? 'الخدمة' : 'Service'}
                            value={filters.serviceId}
                            onChange={(e) => setFilters(prev => ({ ...prev, serviceId: e.target.value }))}
                            options={services.map((service) => ({ value: service.id, label: service.name }))}
                            icon={Filter}
                            placeholder={isRTL ? 'الكل' : 'All'}
                        />
                    )}

                    <ReportsToolbar.Select
                        label={isRTL ? 'الموظف' : 'Employee'}
                        value={filters.employeeId}
                        onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                        options={employees.map((employee) => ({
                            value: employee.id,
                            label: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.username || employee.email
                        }))}
                        icon={User}
                        placeholder={isRTL ? 'الكل' : 'All'}
                    />

                    <ReportsToolbar.Select
                        label={isRTL ? 'طريقة الدفع' : 'Payment Method'}
                        value={filters.method}
                        onChange={(e) => setFilters(prev => ({ ...prev, method: e.target.value }))}
                        options={[
                            { value: 'cash', label: isRTL ? 'نقدي' : 'Cash' },
                            { value: 'card', label: isRTL ? 'بطاقة' : 'Card' },
                            { value: 'transfer', label: isRTL ? 'تحويل' : 'Transfer' }
                        ]}
                        icon={CreditCard}
                        placeholder={isRTL ? 'الكل' : 'All'}
                    />

                    <ReportsToolbar.SearchInput
                        label={isRTL ? 'بحث' : 'Search'}
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        placeholder={isRTL ? 'اسم / كود / تليفون' : 'Name / code / phone'}
                    />

                    <ReportsToolbar.Actions>
                        <ReportsToolbar.Button
                            variant="secondary"
                            icon={Download}
                            onClick={exportExcel}
                            disabled={!rows.length}
                        >
                            {isRTL ? 'تصدير Excel' : 'Export Excel'}
                        </ReportsToolbar.Button>
                    </ReportsToolbar.Actions>
                </ReportsToolbar>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                    label={isRTL ? 'إجمالي الإيراد' : 'Total Revenue'}
                    value={formatMoney(summary.totalRevenue, language, currency)}
                    icon={Wallet}
                />
                <SummaryCard
                    label={isRTL ? 'عدد الجلسات المدفوعة' : 'Paid Sessions'}
                    value={summary.sessionsCount}
                    icon={Calendar}
                />
                <SummaryCard
                    label={isRTL ? 'متوسط سعر الجلسة' : 'Average Price'}
                    value={formatMoney(summary.averagePrice, language, currency)}
                    icon={Wallet}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                    label={isRTL ? 'نقدي' : 'Cash'}
                    value={formatMoney(byMethod.CASH || 0, language, currency)}
                    icon={Wallet}
                />
                <SummaryCard
                    label={isRTL ? 'بطاقة' : 'Card'}
                    value={formatMoney(byMethod.CARD || 0, language, currency)}
                    icon={Wallet}
                />
                <SummaryCard
                    label={isRTL ? 'تحويل' : 'Transfer'}
                    value={formatMoney(byMethod.TRANSFER || 0, language, currency)}
                    icon={Wallet}
                />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                {!loading && rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 flex-1 h-full">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <CreditCard className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {isRTL ? 'لا توجد جلسات مدفوعة خلال هذه الفترة' : 'No paid sessions in this period'}
                        </h3>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1 h-full">
                        <VirtualizedTable
                            columns={tableColumns}
                            rows={rows}
                            rowHeight={62}
                            maxHeight={560}
                            className={`text-sm ${isRTL ? 'text-right' : 'text-left'}`}
                            headerClassName="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm"
                            baseRowClassName="border-b border-gray-200 dark:border-gray-700"
                            rowClassName={rowClassName}
                            getRowKey={(row, index) => `${row.appointmentId}-${row.paidAt}-${index}`}
                        />
                    </div>
                )}
            </div>

            <SessionLedgerDrawer
                open={ledgerOpen}
                onClose={closeLedger}
                loading={ledgerLoading}
                error={ledgerError}
                data={ledgerData}
                isRTL={isRTL}
                language={language}
                t={t}
                methodLabel={methodLabel}
                formatDate={formatDate}
                formatTime={formatTime}
            />
        </ReportsPageShell>
    );
};

export default GymIncomeSessionsReportPage;



