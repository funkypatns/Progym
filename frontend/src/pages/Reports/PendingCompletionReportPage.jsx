import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ClipboardList, Download, Filter, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient, { getStaffTrainers } from '../../utils/api';
import ReportsPageShell from '../../components/Reports/ReportsPageShell';
import ReportsToolbar from '../../components/Reports/ReportsToolbar';
import ReportsTableContainer, { ReportsTableRow, ReportsTableCell } from '../../components/Reports/ReportsTableContainer';
import AppointmentModal from '../Appointments/AppointmentModal';

const parseContentDispositionFilename = (headerValue, fallbackName) => {
    if (!headerValue || typeof headerValue !== 'string') return fallbackName;
    const match = headerValue.match(/filename="(.+?)"/i);
    return match?.[1] || fallbackName;
};

const PendingCompletionReportPage = () => {
    const { i18n, t } = useTranslation();
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
    const errorToastShownRef = useRef(false);
    const requestIdRef = useRef(0);

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
        const normalizedRange = normalizeRange(filters.from, filters.to);
        if (normalizedRange.swapped) {
            setFilters((prev) => ({ ...prev, from: normalizedRange.from, to: normalizedRange.to }));
        }

        const requestId = Date.now();
        requestIdRef.current = requestId;
        setLoading(true);

        try {
            const startDate = toStartOfDay(normalizedRange.from);
            const endDate = toEndOfDay(normalizedRange.to);

            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (filters.trainerId && filters.trainerId !== 'all') params.append('trainerId', filters.trainerId);
            if (filters.employeeId && filters.employeeId !== 'all') params.append('employeeId', filters.employeeId);
            if (filters.search.trim()) params.append('search', filters.search.trim());
            params.append('_t', requestId);

            const response = await apiClient.get(`/appointments/pending-completion?${params.toString()}`);

            const payload = response?.data;
            const items = Array.isArray(payload?.data) ? payload.data
                : Array.isArray(payload?.items) ? payload.items
                    : Array.isArray(payload?.rows) ? payload.rows
                        : Array.isArray(payload?.appointments) ? payload.appointments
                            : (Array.isArray(payload) ? payload : []);

            // Filter out any that might be returned as completed (safety net)
            const activeItems = items.filter((i) => !i.isCompleted);

            const serviceName = filters.serviceId
                ? (services.find((service) => String(service.id) === String(filters.serviceId))?.name || '').toLowerCase()
                : '';
            const trainerId = filters.trainerId ? String(filters.trainerId) : '';
            const employeeId = filters.employeeId ? String(filters.employeeId) : '';
            const searchValue = filters.search.trim().toLowerCase();

            const normalizedRows = activeItems.map((appointment) => {
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

            if (requestIdRef.current !== requestId) return;
            setRows(normalizedRows);
            errorToastShownRef.current = false;
        } catch (error) {
            if (requestIdRef.current !== requestId) return;
            if (!errorToastShownRef.current) {
                toast.error(isRTL ? 'فشل تحميل الجلسات المتأخرة' : 'Failed to load pending completion', { id: 'pending-completion-error' });
                errorToastShownRef.current = true;
            }
            setRows([]);
        } finally {
            if (requestIdRef.current === requestId) {
                setLoading(false);
            }
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

    const exportExcel = async () => {
        if (!rows.length) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }
        try {
            const normalizedRange = normalizeRange(filters.from, filters.to);
            if (normalizedRange.swapped) {
                setFilters((prev) => ({ ...prev, from: normalizedRange.from, to: normalizedRange.to }));
                return;
            }

            const params = new URLSearchParams();
            params.append('startDate', toStartOfDay(normalizedRange.from));
            params.append('endDate', toEndOfDay(normalizedRange.to));
            params.append('format', 'excel');
            if (filters.trainerId && filters.trainerId !== 'all') params.append('trainerId', filters.trainerId);
            if (filters.employeeId && filters.employeeId !== 'all') params.append('employeeId', filters.employeeId);
            if (filters.serviceId && filters.serviceId !== 'all') params.append('serviceId', filters.serviceId);
            if (filters.search.trim()) params.append('search', filters.search.trim());

            const response = await apiClient.get(`/appointments/pending-completion?${params.toString()}`, {
                responseType: 'blob'
            });

            const fallbackName = `pending-completion-${normalizedRange.from || 'report'}.xlsx`;
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

    return (
        <ReportsPageShell
            title={t('reports.pendingCompletion')}
            subtitle={t('reports.pendingCompletionSubtitle')}
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
                            onClick={exportExcel}
                            disabled={!rows.length}
                        >
                            {isRTL ? 'تصدير Excel' : 'Export Excel'}
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
                data={rows}
                renderRow={(row) => (
                    <ReportsTableRow key={row.id}>
                        <ReportsTableCell>
                            {row.customerCode ? `${row.customerName} (${row.customerCode})` : row.customerName || '-'}
                        </ReportsTableCell>
                        <ReportsTableCell>{formatDate(row.start)}</ReportsTableCell>
                        <ReportsTableCell>{formatTime(row.start)}</ReportsTableCell>
                        <ReportsTableCell>{formatTime(row.end)}</ReportsTableCell>
                        <ReportsTableCell>{row.trainerName || '-'}</ReportsTableCell>
                        <ReportsTableCell>{row.employeeName || '-'}</ReportsTableCell>
                        <ReportsTableCell>{row.price ?? 0}</ReportsTableCell>
                        <ReportsTableCell>{row.status || '-'}</ReportsTableCell>
                        <ReportsTableCell>
                            <button
                                onClick={() => handleCompleteNow(row)}
                                className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
                            >
                                {isRTL ? 'إكمال الآن' : 'Complete Now'}
                            </button>
                        </ReportsTableCell>
                    </ReportsTableRow>
                )}
            />

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
