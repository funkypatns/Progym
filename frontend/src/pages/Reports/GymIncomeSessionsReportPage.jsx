import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar,
    Download,
    Filter,
    User,
    Users,
    Wallet,
    CreditCard
} from 'lucide-react';
import apiClient, { getStaffTrainers } from '../../utils/api';
import ReportsPageShell from '../../components/Reports/ReportsPageShell';
import ReportsToolbar from '../../components/Reports/ReportsToolbar';
import ReportsTableContainer from '../../components/Reports/ReportsTableContainer';
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

const GymIncomeSessionsReportPage = () => {
    const { i18n } = useTranslation();
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
    const [filters, setFilters] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        trainerId: '',
        serviceId: '',
        employeeId: '',
        method: '',
        search: ''
    });

    const currency = { code: 'EGP', symbol: 'EGP' };
    const toStartOfDay = (value) => (value ? `${value}T00:00:00` : '');
    const toEndOfDay = (value) => (value ? `${value}T23:59:59.999` : '');

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
        setLoading(true);
        try {
            const startDate = toStartOfDay(filters.from);
            const endDate = toEndOfDay(filters.to);
            const params = new URLSearchParams({
                type: 'SESSION',
                startDate,
                endDate,
                page: '1',
                limit: '10000'
            });

            if (import.meta.env.DEV) {
                console.log('[REPORTS][gym-income-sessions] request', {
                    startDate,
                    endDate,
                    type: 'SESSION'
                });
            }

            const response = await apiClient.get(`/payments?${params.toString()}`);
            const rawData = response.data?.data;
            const payments = Array.isArray(rawData)
                ? rawData
                : (rawData?.payments || rawData?.docs || []);

            const normalizedMethod = filters.method ? filters.method.toLowerCase() : '';
            const trainerId = filters.trainerId ? String(filters.trainerId) : '';
            const employeeId = filters.employeeId ? String(filters.employeeId) : '';
            const serviceName = filters.serviceId
                ? (services.find(service => String(service.id) === String(filters.serviceId))?.name || '').toLowerCase()
                : '';
            const searchValue = filters.search.trim().toLowerCase();

            const byMethod = { CASH: 0, CARD: 0, TRANSFER: 0 };
            const rowsMap = new Map();

            payments.forEach((payment) => {
                if (!payment?.appointmentId) return;
                if (normalizedMethod && String(payment.method || '').toLowerCase() !== normalizedMethod) return;

                const appointment = payment.appointment || {};
                const member = payment.member || {};
                const appointmentTrainerId = appointment.trainer?.id ? String(appointment.trainer.id) : '';
                if (trainerId && trainerId !== appointmentTrainerId) return;

                const creatorId = payment.createdBy ? String(payment.createdBy) : '';
                const completedById = appointment.completedByEmployee?.id ? String(appointment.completedByEmployee.id) : '';
                if (employeeId && employeeId !== creatorId && employeeId !== completedById) return;

                const appointmentTitle = String(appointment.title || '').toLowerCase();
                if (serviceName && !appointmentTitle.includes(serviceName)) return;

                const methodKey = String(payment.method || '').toUpperCase();
                if (byMethod[methodKey] !== undefined) {
                    byMethod[methodKey] += payment.amount || 0;
                }

                if (!rowsMap.has(payment.appointmentId)) {
                    rowsMap.set(payment.appointmentId, {
                        appointmentId: payment.appointmentId,
                        paidAt: payment.paidAt,
                        sessionDate: appointment.start || payment.paidAt,
                        methods: new Set(),
                        amount: 0,
                        customerName: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
                        customerCode: member.memberId || '',
                        customerPhone: member.phone || '',
                        serviceName: appointment.title || '',
                        trainerName: appointment.trainer?.name || '',
                        employeeName: payment.creator
                            ? `${payment.creator.firstName || ''} ${payment.creator.lastName || ''}`.trim()
                            : (appointment.completedByEmployee
                                ? `${appointment.completedByEmployee.firstName || ''} ${appointment.completedByEmployee.lastName || ''}`.trim()
                                : '')
                    });
                }

                const row = rowsMap.get(payment.appointmentId);
                row.amount += payment.amount || 0;
                row.methods.add(methodKey || 'UNKNOWN');
                if (payment.paidAt && payment.paidAt > row.paidAt) {
                    row.paidAt = payment.paidAt;
                }
            });

            const rows = Array.from(rowsMap.values()).map((row) => ({
                appointmentId: row.appointmentId,
                paidAt: row.paidAt,
                sessionDate: row.sessionDate,
                customerName: row.customerName,
                customerCode: row.customerCode,
                customerPhone: row.customerPhone,
                serviceName: row.serviceName,
                trainerName: row.trainerName,
                employeeName: row.employeeName,
                paymentMethod: row.methods.size === 1 ? Array.from(row.methods)[0] : 'MIXED',
                amount: row.amount || 0
            })).filter((row) => {
                if (!searchValue) return true;
                const haystack = `${row.customerName} ${row.customerCode} ${row.customerPhone}`.toLowerCase();
                return haystack.includes(searchValue);
            });

            const totalRevenue = rows.reduce((sum, row) => sum + (row.amount || 0), 0);
            const sessionsCount = rows.length;
            const averagePrice = sessionsCount ? totalRevenue / sessionsCount : 0;

            setSummary({
                totalRevenue,
                sessionsCount,
                averagePrice,
                byMethod
            });
            setRows(rows);

            if (import.meta.env.DEV) {
                console.log('[REPORTS][gym-income-sessions] response', {
                    paymentsCount: payments.length,
                    rowsCount: rows.length,
                    totalRevenue
                });
            }
        } catch (error) {
            toast.error(isRTL ? 'فشل تحميل تقرير دخل الجلسات' : 'Failed to load sessions income report');
            setSummary({ totalRevenue: 0, sessionsCount: 0, averagePrice: 0, byMethod: { CASH: 0, CARD: 0, TRANSFER: 0 } });
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [filters.from, filters.to, filters.trainerId, filters.serviceId, filters.employeeId, filters.method, filters.search]);

    const methodLabel = (value) => {
        const normalized = (value || '').toUpperCase();
        const map = {
            CASH: isRTL ? 'نقدي' : 'Cash',
            CARD: isRTL ? 'بطاقة' : 'Card',
            TRANSFER: isRTL ? 'تحويل' : 'Transfer',
            MIXED: isRTL ? 'متعدد' : 'Mixed'
        };
        return map[normalized] || normalized || '-';
    };

    const formatDate = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatTime = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const exportCsv = () => {
        if (!rows.length) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }

        const csvRows = [
            [
                'التاريخ',
                'الوقت',
                'العميل',
                'الخدمة',
                'المدرب',
                'الموظف',
                'طريقة الدفع',
                'المبلغ',
                'رقم الحجز'
            ].join(',')
        ];

        rows.forEach((row) => {
            const customerLabel = row.customerCode
                ? `${row.customerName} (${row.customerCode})`
                : row.customerName;
            const line = [
                formatDate(row.sessionDate || row.paidAt),
                formatTime(row.sessionDate || row.paidAt),
                customerLabel || '',
                row.serviceName || '',
                row.trainerName || '',
                row.employeeName || '',
                methodLabel(row.paymentMethod),
                row.amount ?? 0,
                row.appointmentId ?? ''
            ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
            csvRows.push(line);
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'gym-income-sessions.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const byMethod = useMemo(() => {
        return summary.byMethod || { CASH: 0, CARD: 0, TRANSFER: 0 };
    }, [summary.byMethod]);

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
                            onClick={exportCsv}
                            disabled={!rows.length}
                        >
                            {isRTL ? 'تصدير CSV' : 'Export CSV'}
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

            <ReportsTableContainer
                headers={[
                    isRTL ? 'التاريخ' : 'Date',
                    isRTL ? 'الوقت' : 'Time',
                    isRTL ? 'العميل' : 'Customer',
                    isRTL ? 'الخدمة' : 'Service',
                    isRTL ? 'المدرب' : 'Trainer',
                    isRTL ? 'الموظف' : 'Employee',
                    isRTL ? 'طريقة الدفع' : 'Method',
                    isRTL ? 'المبلغ' : 'Amount',
                    isRTL ? 'رقم الحجز' : 'Appointment'
                ]}
                loading={loading}
                empty={!loading && rows.length === 0}
                emptyMessage={isRTL ? 'لا توجد جلسات مدفوعة في هذه الفترة' : 'No paid sessions in this period'}
            >
                {rows.map((row) => {
                    const customerLabel = row.customerCode
                        ? `${row.customerName} (${row.customerCode})`
                        : row.customerName;
                    const sessionDate = row.sessionDate || row.paidAt;
                    return (
                        <ReportsTableContainer.Row key={`${row.appointmentId}-${row.paidAt}`}>
                            <ReportsTableContainer.Cell>{formatDate(sessionDate)}</ReportsTableContainer.Cell>
                            <ReportsTableContainer.Cell>{formatTime(sessionDate)}</ReportsTableContainer.Cell>
                            <ReportsTableContainer.Cell>{customerLabel || '-'}</ReportsTableContainer.Cell>
                            <ReportsTableContainer.Cell>{row.serviceName || '-'}</ReportsTableContainer.Cell>
                            <ReportsTableContainer.Cell>{row.trainerName || '-'}</ReportsTableContainer.Cell>
                            <ReportsTableContainer.Cell>{row.employeeName || '-'}</ReportsTableContainer.Cell>
                            <ReportsTableContainer.Cell>{methodLabel(row.paymentMethod)}</ReportsTableContainer.Cell>
                            <ReportsTableContainer.Cell>{formatMoney(row.amount || 0, language, currency)}</ReportsTableContainer.Cell>
                            <ReportsTableContainer.Cell>{row.appointmentId || '-'}</ReportsTableContainer.Cell>
                        </ReportsTableContainer.Row>
                    );
                })}
            </ReportsTableContainer>
        </ReportsPageShell>
    );
};

export default GymIncomeSessionsReportPage;

