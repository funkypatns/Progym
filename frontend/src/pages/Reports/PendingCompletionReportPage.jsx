import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ClipboardList, Download, Filter, Users } from 'lucide-react';
import apiClient, { getStaffTrainers } from '../../utils/api';
import ReportsPageShell from '../../components/Reports/ReportsPageShell';
import ReportsToolbar from '../../components/Reports/ReportsToolbar';
import ReportsTableContainer from '../../components/Reports/ReportsTableContainer';
import AppointmentModal from '../Appointments/AppointmentModal';
import toast from 'react-hot-toast';

const PendingCompletionReportPage = () => {
    const { i18n } = useTranslation();
    const isRTL = i18n.dir() === 'rtl';
    const language = i18n.language || 'en';

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [trainers, setTrainers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [services, setServices] = useState([]);
    const [filters, setFilters] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        trainerId: '',
        employeeId: '',
        serviceId: '',
        search: ''
    });

    const [showModal, setShowModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [autoCompleteTriggerId, setAutoCompleteTriggerId] = useState(null);

    const toStartOfDay = (value) => (value ? `${value}T00:00:00` : '');
    const toEndOfDay = (value) => (value ? `${value}T23:59:59.999` : '');

    useEffect(() => {
        const loadFilters = async () => {
            try {
                const [trainerRes, employeesRes, servicesRes] = await Promise.all([
                    getStaffTrainers(),
                    apiClient.get('/users/list'),
                    apiClient.get('/services?type=SESSION&active=true')
                ]);
                if (trainerRes.data?.success) {
                    setTrainers(trainerRes.data.data || []);
                }
                if (employeesRes.data?.data) {
                    setEmployees(employeesRes.data.data || []);
                }
                if (servicesRes.data?.success) {
                    setServices(servicesRes.data.data || []);
                }
            } catch (error) {
                console.warn('Failed to load pending completion filters', error);
            }
        };
        loadFilters();
    }, []);

    const fetchPendingCompletion = async () => {
        setLoading(true);
        try {
            const startDate = toStartOfDay(filters.from);
            const endDate = toEndOfDay(filters.to);
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const response = await apiClient.get(`/appointments/pending-completion?${params.toString()}`);
            const items = Array.isArray(response.data?.data) ? response.data.data : [];

            const serviceName = filters.serviceId
                ? (services.find((service) => String(service.id) === String(filters.serviceId))?.name || '').toLowerCase()
                : '';
            const trainerId = filters.trainerId ? String(filters.trainerId) : '';
            const employeeId = filters.employeeId ? String(filters.employeeId) : '';
            const searchValue = filters.search.trim().toLowerCase();

            const normalized = items.map((appointment) => {
                const member = appointment.member || {};
                const customerName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
                const trainerName = appointment.trainer?.name
                    || `${appointment.coach?.firstName || ''} ${appointment.coach?.lastName || ''}`.trim();
                const employeeName = appointment.createdByEmployee
                    ? `${appointment.createdByEmployee.firstName || ''} ${appointment.createdByEmployee.lastName || ''}`.trim()
                    : '';
                return {
                    ...appointment,
                    customerName,
                    customerCode: member.memberId || '',
                    customerPhone: member.phone || '',
                    trainerName,
                    employeeName
                };
            }).filter((appointment) => {
                if (trainerId && String(appointment.trainer?.id || '') !== trainerId) return false;
                if (employeeId && String(appointment.createdByEmployee?.id || '') !== employeeId) return false;
                if (serviceName && !String(appointment.title || '').toLowerCase().includes(serviceName)) return false;
                if (searchValue) {
                    const haystack = `${appointment.customerName} ${appointment.customerCode} ${appointment.customerPhone}`.toLowerCase();
                    if (!haystack.includes(searchValue)) return false;
                }
                return true;
            });

            setRows(normalized);
        } catch (error) {
            toast.error(isRTL ? 'فشل تحميل الجلسات المتأخرة' : 'Failed to load pending completion');
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingCompletion();
    }, [filters.from, filters.to, filters.trainerId, filters.employeeId, filters.serviceId, filters.search]);

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

    const handleCompleteNow = (appointment) => {
        setSelectedAppointment(appointment);
        setShowModal(true);
        setAutoCompleteTriggerId(appointment.id);
    };

    const exportCsv = () => {
        if (!rows.length) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }

        const header = [
            isRTL ? 'العميل' : 'Customer',
            isRTL ? 'التاريخ' : 'Date',
            isRTL ? 'البداية' : 'Start',
            isRTL ? 'النهاية' : 'End',
            isRTL ? 'المدرب' : 'Trainer',
            isRTL ? 'الموظف' : 'Employee',
            isRTL ? 'السعر' : 'Price',
            isRTL ? 'الحالة' : 'Status'
        ];

        const csvRows = [header.join(',')];
        rows.forEach((row) => {
            const customerLabel = row.customerCode ? `${row.customerName} (${row.customerCode})` : row.customerName;
            const line = [
                customerLabel || '',
                formatDate(row.start),
                formatTime(row.start),
                formatTime(row.end),
                row.trainerName || '',
                row.employeeName || '',
                row.price ?? 0,
                row.status || ''
            ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
            csvRows.push(line);
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'pending-completion-report.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <ReportsPageShell
            title={isRTL ? 'جلسات تحتاج إكمال' : 'Pending Completion'}
            subtitle={isRTL ? 'جلسات انتهت ولم يتم إكمالها بعد' : 'Sessions ended but not completed'}
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

                    <ReportsToolbar.Select
                        label={isRTL ? 'الموظف' : 'Employee'}
                        value={filters.employeeId}
                        onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                        options={employees.map((employee) => ({
                            value: employee.id,
                            label: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.username || employee.email
                        }))}
                        icon={Users}
                        placeholder={isRTL ? 'الكل' : 'All'}
                    />

                    {services.length > 0 && (
                        <ReportsToolbar.Select
                            label={isRTL ? 'الخدمة' : 'Service'}
                            value={filters.serviceId}
                            onChange={(e) => setFilters(prev => ({ ...prev, serviceId: e.target.value }))}
                            options={services.map((service) => ({ value: service.id, label: service.name }))}
                            icon={ClipboardList}
                            placeholder={isRTL ? 'الكل' : 'All'}
                        />
                    )}

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

            <ReportsTableContainer
                headers={[
                    isRTL ? 'العميل' : 'Customer',
                    isRTL ? 'التاريخ' : 'Date',
                    isRTL ? 'البداية' : 'Start',
                    isRTL ? 'النهاية' : 'End',
                    isRTL ? 'المدرب' : 'Trainer',
                    isRTL ? 'الموظف' : 'Employee',
                    isRTL ? 'السعر' : 'Price',
                    isRTL ? 'الحالة' : 'Status',
                    ''
                ]}
                loading={loading}
                empty={!loading && rows.length === 0}
                emptyMessage={isRTL ? 'لا توجد جلسات تحتاج إكمال' : 'No pending completion sessions'}
            >
                {rows.map((row) => (
                    <ReportsTableContainer.Row key={row.id}>
                        <ReportsTableContainer.Cell>
                            {row.customerCode ? `${row.customerName} (${row.customerCode})` : row.customerName || '-'}
                        </ReportsTableContainer.Cell>
                        <ReportsTableContainer.Cell>{formatDate(row.start)}</ReportsTableContainer.Cell>
                        <ReportsTableContainer.Cell>{formatTime(row.start)}</ReportsTableContainer.Cell>
                        <ReportsTableContainer.Cell>{formatTime(row.end)}</ReportsTableContainer.Cell>
                        <ReportsTableContainer.Cell>{row.trainerName || '-'}</ReportsTableContainer.Cell>
                        <ReportsTableContainer.Cell>{row.employeeName || '-'}</ReportsTableContainer.Cell>
                        <ReportsTableContainer.Cell>{row.price ?? 0}</ReportsTableContainer.Cell>
                        <ReportsTableContainer.Cell>{row.status || '-'}</ReportsTableContainer.Cell>
                        <ReportsTableContainer.Cell>
                            <button
                                onClick={() => handleCompleteNow(row)}
                                className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
                            >
                                {isRTL ? 'إكمال الآن' : 'Complete Now'}
                            </button>
                        </ReportsTableContainer.Cell>
                    </ReportsTableContainer.Row>
                ))}
            </ReportsTableContainer>

            {showModal && (
                <AppointmentModal
                    open={showModal}
                    onClose={() => {
                        setShowModal(false);
                        setSelectedAppointment(null);
                        setAutoCompleteTriggerId(null);
                    }}
                    onSuccess={() => {
                        fetchPendingCompletion();
                    }}
                    appointment={selectedAppointment}
                    autoCompleteTriggerId={autoCompleteTriggerId}
                    onAutoCompleteTriggered={() => setAutoCompleteTriggerId(null)}
                />
            )}
        </ReportsPageShell>
    );
};

export default PendingCompletionReportPage;
