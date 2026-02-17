import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, User, Clock, CheckCircle, XCircle, AlertCircle, PlayCircle, Bell, Lock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, startOfDay, isBefore } from 'date-fns';
import { formatDateTime, formatDate, formatTime } from '../../utils/dateFormatter';
import { arEG, enUS } from 'date-fns/locale';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';
import AppointmentModal from './AppointmentModal';
import DayDetailsModal from './DayDetailsModal';
import AddPaymentDialog from '../../components/payments/AddPaymentDialog'; // Reusing payment dialog
import { useAuthStore, useSettingsStore } from '../../store';

const PENDING_COMPLETION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC8KEIQ+WFBQZG54d2uDkIpxTDIvKjo8Oz5BWF9pcXx+d2ttaVtIRxEULztBOzQzMj9KVFhdV09FREJBQkBCQ0ZJTVFVWFlaWldWVFJQT05NTk5PUVNVVldYWFlZWllYV1ZVVFRUVFRVVlZXWFhZWVhaWVlZWFhXV1ZWVVVVVVVVVVZWVldXWFhYWFhYWFhXV1dXVldXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXVw==';
const PENDING_ALERT_STORAGE_KEY = 'gym:pendingCompletionAlertState';

const Appointments = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';
    const { user } = useAuthStore();
    const { settings, getSetting, fetchSettings } = useSettingsStore();

    const [view, setView] = useState('calendar'); // calendar | list | notifications
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [preSelectedDate, setPreSelectedDate] = useState(null);
    const [appointmentReadOnly, setAppointmentReadOnly] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAppointment, setPaymentAppointment] = useState(null);

    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedDayDate, setSelectedDayDate] = useState(null);
    const [pendingCompletion, setPendingCompletion] = useState([]);
    const [pendingCompletionLoading, setPendingCompletionLoading] = useState(false);
    const PREVIEW_LIMIT = 3;
    const todayStart = startOfDay(new Date());
    const isPastDate = (dateValue) => startOfDay(new Date(dateValue)) < todayStart;
    const pendingAudioRef = useRef(null);
    const pendingAlertStateRef = useRef(new Map());
    const audioErrorNotifiedRef = useRef(false);

    const parseBoolean = (value, fallback = true) => {
        if (value === undefined || value === null) return fallback;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return fallback;
    };

    const isAppointmentCompleted = (apt) => Boolean(
        apt && (apt.isCompleted || apt.status === 'completed' || apt.status === 'auto_completed' || apt.completedAt)
    );

    const parseNumber = (value, fallback) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const getAppointmentPerson = (apt) => {
        if (!apt) return { name: '', phone: '', memberCode: '', isLead: false };
        if (apt.member) {
            const name = `${apt.member.firstName || ''} ${apt.member.lastName || ''}`.trim();
            return {
                name,
                phone: apt.member.phone || '',
                memberCode: apt.member.memberId || '',
                isLead: false
            };
        }
        if (apt.lead) {
            return {
                name: apt.lead.fullName || '',
                phone: apt.lead.phone || '',
                memberCode: '',
                isLead: true
            };
        }
        return { name: '', phone: '', memberCode: '', isLead: false };
    };

    const appointmentAlertsEnabled = parseBoolean(getSetting('appointment_alerts_enabled', true), true);
    const appointmentAlertIntervalMinutes = parseNumber(getSetting('appointment_alert_interval_minutes', 0), 0);
    const appointmentAlertRepeatIntervalMs = Math.max(0, appointmentAlertIntervalMinutes * 60 * 1000);
    const maxRepeatsRaw = parseInt(getSetting('appointment_alert_max_repeats', 1), 10);
    const appointmentAlertMaxRepeats = Number.isFinite(maxRepeatsRaw) ? Math.max(0, maxRepeatsRaw) : 1;
    const appointmentAlertVolumeRaw = parseNumber(getSetting('appointment_alert_volume', 100), 100);
    const appointmentAlertVolume = Math.min(Math.max(appointmentAlertVolumeRaw, 0), 100);
    const appointmentAlertVolumeNormalized = appointmentAlertVolume / 100;
    const pendingPollIntervalMs = 30000;
    const appointmentAlertSoundEnabled = parseBoolean(getSetting('appointment_alert_sound_enabled', true), true);
    const appointmentAlertUiEnabled = parseBoolean(getSetting('appointment_alert_ui_enabled', true), true);

    const appointmentsByDate = useMemo(() => {
        const map = {};
        appointments.forEach(apt => {
            if (!apt?.start) return;
            const key = format(parseISO(apt.start), 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(apt);
        });
        return map;
    }, [appointments]);

    // Fetch data
    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();

            // Adjust fetch range for calendar view to include full weeks
            const calendarStart = startOfWeek(startOfMonth(currentDate)).toISOString();
            const calendarEnd = endOfWeek(endOfMonth(currentDate)).toISOString();

            const params = {
                startDate: view === 'calendar' ? calendarStart : start,
                endDate: view === 'calendar' ? calendarEnd : end
            };

            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }

            const query = new URLSearchParams(params);

            const res = await apiClient.get(`/appointments?${query.toString()}`);
            if (res.data.success) {
                setAppointments(res.data.data);
            }
        } catch (error) {
            console.error(error);
            toast.error(t('errors.fetchAppointments', 'Failed to fetch appointments'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'notifications') {
            fetchNotifications();
        } else {
            fetchAppointments();
        }
    }, [currentDate, view, statusFilter]);

    useEffect(() => {
        fetchSettings().catch(() => {});
    }, [fetchSettings]);

    useEffect(() => {
        try {
            if (!pendingAudioRef.current) {
                pendingAudioRef.current = new Audio(PENDING_COMPLETION_SOUND_URL);
            }
            pendingAudioRef.current.volume = appointmentAlertVolumeNormalized;
        } catch (error) {
            console.error('[APPOINTMENTS] Failed to init pending completion sound:', error);
        }
    }, [appointmentAlertVolumeNormalized]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(PENDING_ALERT_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const nextMap = new Map();
            Object.entries(parsed || {}).forEach(([id, value]) => {
                if (!value || typeof value !== 'object') return;
                const count = Number.isFinite(Number(value.count)) ? Number(value.count) : 0;
                const lastAlertAt = Number.isFinite(Number(value.lastAlertAt)) ? Number(value.lastAlertAt) : 0;
                nextMap.set(id, { count, lastAlertAt });
            });
            pendingAlertStateRef.current = nextMap;
        } catch (error) {
            pendingAlertStateRef.current = new Map();
        }
    }, []);

    const persistPendingAlertState = () => {
        try {
            const payload = {};
            pendingAlertStateRef.current.forEach((value, key) => {
                payload[key] = value;
            });
            localStorage.setItem(PENDING_ALERT_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            // noop
        }
    };

    const playPendingCompletionSound = () => {
        if (!pendingAudioRef.current) return;
        pendingAudioRef.current.currentTime = 0;
        const playPromise = pendingAudioRef.current.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                if (audioErrorNotifiedRef.current) return;
                audioErrorNotifiedRef.current = true;
                toast.error('تعذّر تشغيل الصوت  فعّل الصوت من المتصفح');
            });
        }
    };

    const fetchPendingCompletion = async ({ allowAlerts = true } = {}) => {
        setPendingCompletionLoading(true);
        try {
            const res = await apiClient.get('/appointments/pending-completion');
            if (res.data.success) {
                const items = Array.isArray(res.data.data) ? res.data.data : [];
                const currentIds = new Set(items.map(item => String(item?.id || '')).filter(Boolean));
                for (const trackedId of pendingAlertStateRef.current.keys()) {
                    if (!currentIds.has(trackedId)) {
                        pendingAlertStateRef.current.delete(trackedId);
                    }
                }

                const totalAllowed = appointmentAlertMaxRepeats <= 0 ? 1 : appointmentAlertMaxRepeats;
                const shouldAlert = allowAlerts && appointmentAlertsEnabled && (appointmentAlertSoundEnabled || appointmentAlertUiEnabled);
                const nowMs = Date.now();

                if (shouldAlert) {
                    items.forEach((item) => {
                        if (!item?.id) return;
                        const id = String(item.id);
                        const state = pendingAlertStateRef.current.get(id) || { count: 0, lastAlertAt: 0 };
                        const isFirstAlert = state.count === 0;
                        const canRepeat = appointmentAlertRepeatIntervalMs > 0
                            && state.count < totalAllowed
                            && (nowMs - state.lastAlertAt) >= appointmentAlertRepeatIntervalMs;
                        if (!isFirstAlert && !canRepeat) return;

                        if (appointmentAlertSoundEnabled) {
                            playPendingCompletionSound();
                        }
                        if (appointmentAlertUiEnabled) {
                            const person = getAppointmentPerson(item);
                            const name = person.name;
                            const timeLabel = item.end ? `${formatDate(item.end, i18n.language)} ${formatTime(item.end, i18n.language)}` : '';
                            const needsLabel = i18n.language === 'ar' ? 'جلسة انتهت وتحتاج إكمال' : 'Needs completion';
                            toast.success([name, timeLabel, needsLabel].filter(Boolean).join(' • '));
                        }

                        const nextCount = Math.min(state.count + 1, totalAllowed);
                        pendingAlertStateRef.current.set(id, { count: nextCount, lastAlertAt: nowMs });
                    });
                }

                persistPendingAlertState();
                setPendingCompletion(items);
            }
        } catch (error) {
            console.error('[APPOINTMENTS] Failed to fetch pending completion:', error);
        } finally {
            setPendingCompletionLoading(false);
        }
    };

    useEffect(() => {
        const allowAlerts = appointmentAlertsEnabled;
        fetchPendingCompletion({ allowAlerts });
        const interval = setInterval(() => fetchPendingCompletion({ allowAlerts }), pendingPollIntervalMs);
        return () => clearInterval(interval);
    }, [view, appointmentAlertsEnabled, appointmentAlertRepeatIntervalMs, appointmentAlertMaxRepeats, appointmentAlertSoundEnabled, appointmentAlertUiEnabled, pendingPollIntervalMs, settings]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/appointments/notifications?limit=50');
            if (res.data.success) {
                setNotifications(res.data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Handlers
    // Handlers
    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const handleEdit = (apt) => {
        const isPast = apt?.start ? isPastDate(parseISO(apt.start)) : false;
        setAppointmentReadOnly(isPast);
        setSelectedAppointment(apt);
        setShowModal(true);
        setPendingCompletionId(null);
    };

    const [pendingCompletionId, setPendingCompletionId] = useState(null);

    const handleCreate = () => {
        setAppointmentReadOnly(false);
        setSelectedAppointment(null);
        setPreSelectedDate(null);
        setShowModal(true);
        setPendingCompletionId(null);
    };

    const handleCreateWithDate = (date) => {
        if (isPastDate(date)) {
            return;
        }
        setAppointmentReadOnly(false);
        setSelectedAppointment(null);
        setPreSelectedDate(date);
        setShowModal(true);
        setPendingCompletionId(null);
    };

    const handleQuickStatus = async (e, apt, status) => {
        e.stopPropagation();
        if (status === 'completed') {
            if (isAppointmentCompleted(apt)) {
                return;
            }
            const isPast = apt?.start ? isPastDate(parseISO(apt.start)) : false;
            setAppointmentReadOnly(isPast);
            setSelectedAppointment(apt);
            setPendingCompletionId(apt.id);
            setShowModal(true);
            return;
        }
        if (apt?.start && isPastDate(parseISO(apt.start))) {
            return;
        }

        if (status === 'settle') {
            if (!confirm('Settle payout for this session? This will create an expense and mark commission as PAID.')) return;
            try {
                await apiClient.post(`/appointments/${apt.id}/settle`);
                toast.success('Payout settled successfully');
                fetchAppointments();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to settle');
            }
            return;
        }

        if (!confirm(`Mark session as ${status.replace('_', ' ')}?`)) return;

        const normalizedStatus = status === 'scheduled' ? 'booked' : status;
        try {
            await apiClient.patch(`/appointments/${apt.id}/status`, { status: normalizedStatus });
            if (status === 'completed') {
                toast.success('Session completed');
            } else {
                toast.success(`Session marked as ${status.replace('_', ' ')}`);
            }
            fetchAppointments();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleCompletePending = async (apt) => {
        const appointmentId = apt?.id;
        if (!appointmentId) return;
        if (isAppointmentCompleted(apt)) {
            return;
        }
        const isPast = apt?.start ? isPastDate(parseISO(apt.start)) : false;
        setAppointmentReadOnly(isPast);
        setSelectedAppointment(apt);
        setPendingCompletionId(appointmentId);
        setShowModal(true);
    };

    const renderPendingCompletion = () => (
        <div className="space-y-3">
            {pendingCompletionLoading && (
                <div className="text-xs text-slate-400">{t('common.loading', 'Loading...')}</div>
            )}
            {pendingCompletion.length === 0 && (
                <div className="text-center py-20 text-slate-500">
                    {t('appointments.noAppointments')}
                </div>
            )}
            {pendingCompletion.map((apt) => {
                const person = getAppointmentPerson(apt);
                const memberName = person.name;
                const trainerName = apt.trainer?.name || '';
                const serviceName = apt.sessionName || apt.title || '';
                const startLabel = apt.start ? `${formatDate(apt.start, i18n.language)} ${formatTime(apt.start, i18n.language)}` : '';
                const endLabel = apt.end ? `${formatDate(apt.end, i18n.language)} ${formatTime(apt.end, i18n.language)}` : '';
                const rangeLabel = startLabel && endLabel
                    ? `${startLabel} - ${formatTime(apt.end, i18n.language)}`
                    : (endLabel || startLabel);
                const priceValue = Number.isFinite(apt.sessionPrice) ? apt.sessionPrice : (Number.isFinite(apt.price) ? apt.price : null);
                const paymentStatus = apt.paymentStatus ? String(apt.paymentStatus).toUpperCase() : '';
                return (
                    <div key={apt.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-800/50 border border-white/5 rounded-2xl">
                        <div>
                            <div className="text-sm font-bold text-white">
                                {memberName || t('appointments.member', 'Member')}
                                {person.isLead ? (
                                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 uppercase tracking-widest">
                                        {isRtl ? 'زائر' : 'Lead'}
                                    </span>
                                ) : null}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                {rangeLabel}
                                {trainerName ? ` • ${isRtl ? 'المدرب:' : 'Trainer:'} ${trainerName}` : ''}
                                {serviceName ? ` • ${serviceName}` : ''}
                                {priceValue !== null ? ` • ${isRtl ? 'السعر:' : 'Price:'} ${priceValue}` : ''}
                                {paymentStatus ? ` • ${isRtl ? 'الحالة:' : 'Status:'} ${paymentStatus}` : ''}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleEdit(apt)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                            >
                                {t('common.view', 'View')}
                            </button>
                            <button
                                onClick={() => handleCompletePending(apt)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                            >
                                {t('appointments.complete', 'Complete')}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    // Calendar Generation
    const renderCalendar = () => {
        // ... (calendar generation logic same, just using 'appointments' state which is now filtered)
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        return (
            <div className="bg-slate-900/40 rounded-2xl border-2 border-white/10 overflow-hidden shadow-2xl">
                {/* Week Day Headers */}
                <div className="grid grid-cols-7 border-b-2 border-white/10 bg-slate-900/70">
                    {weekDays.map(d => (
                        <div key={d} className="py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 auto-rows-fr bg-slate-800/20">
                      {allDays.map((dayItem) => {
                          const isCurrentMonth = isSameMonth(dayItem, monthStart);
                          const dayKey = format(dayItem, 'yyyy-MM-dd');
                          const dayApts = appointmentsByDate[dayKey] || [];
                        const isTodayDate = isToday(dayItem);
                        const isPastDay = isPastDate(dayItem);

                        const hasCompleted = dayApts.some(a => a.status === 'completed' || a.status === 'auto_completed');
                        const hasScheduled = dayApts.some(a => ['scheduled', 'booked', 'arrived'].includes(a.status));
                        const hasCancelled = dayApts.some(a => a.status === 'cancelled');
                        const hasNoShow = dayApts.some(a => a.status === 'no_show');

                        let dayBgColor = '';
                        let dayBorderColor = 'border-white/5';

                        if (hasCompleted) {
                            dayBgColor = 'bg-teal-500/5 hover:bg-teal-500/10';
                            dayBorderColor = 'border-teal-500/20';
                        } else if (hasScheduled) {
                            dayBgColor = 'bg-emerald-500/5 hover:bg-emerald-500/10';
                            dayBorderColor = 'border-emerald-500/20';
                        } else if (hasCancelled || hasNoShow) {
                            dayBgColor = 'bg-rose-500/5 hover:bg-rose-500/10';
                            dayBorderColor = 'border-rose-500/20';
                        } else {
                            dayBgColor = 'hover:bg-white/5';
                        }

                        return (
                            <div
                                key={dayItem.toString()}
                                onClick={() => {
                                    if (dayApts.length > 0) {
                                        setSelectedDayDate(dayItem);
                                        return;
                                    }
                                    if (dayApts.length === 0 && isCurrentMonth && !isPastDay) {
                                        handleCreateWithDate(dayItem);
                                    }
                                }}
                                className={`min-h-[140px] p-3 border-r-2 border-b-2 ${dayBorderColor} transition-all duration-200 relative group
                                    ${dayApts.length === 0 && isCurrentMonth && !isPastDay ? 'cursor-pointer hover:ring-2 hover:ring-blue-500/30' : ''}
                                    ${!isCurrentMonth ? 'bg-slate-900/60 opacity-40' : dayBgColor}
                                `}
                            >
                                {/* Day Number */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (dayApts.length > 0) {
                                            setSelectedDayDate(dayItem);
                                        } else if (!isPastDay) {
                                            handleCreateWithDate(dayItem);
                                        }
                                    }}
                                    className={`text-sm font-black mb-2 transition-all cursor-pointer hover:scale-110 active:scale-95
                                    ${isTodayDate
                                            ? 'bg-blue-600 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 ring-2 ring-blue-400/50'
                                            : (hasScheduled || hasCompleted)
                                                ? 'text-emerald-400'
                                                : 'text-slate-500 group-hover:text-slate-300'
                                        }
                                `}>
                                    {format(dayItem, 'd')}
                                </div>
                                {isPastDay && (
                                    <div className="absolute top-2 right-2 text-slate-500" title={t('appointments.readOnly', 'Read only')}>
                                        <Lock size={14} />
                                    </div>
                                )}

                                {/* Appointment Cards */}
                                <div className="space-y-1.5">
                                    {dayApts.slice(0, PREVIEW_LIMIT).map(apt => {
                                        const hasEnded = apt?.end ? isBefore(parseISO(apt.end), new Date()) : false;
                                        const isOverdue = hasEnded && !isAppointmentCompleted(apt) && !['cancelled', 'no_show'].includes(apt.status);
                                        return (
                                        <div
                                            key={apt.id}
                                            onClick={(e) => { e.stopPropagation(); handleEdit(apt); }}
                                            className={`
                                                text-xs px-2.5 py-2 rounded-lg border-2 cursor-pointer transition-all duration-200
                                                hover:scale-105 hover:shadow-lg active:scale-95
                                                ${apt.status === 'completed' || apt.status === 'auto_completed'
                                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 shadow-emerald-900/20'
                                                    : apt.status === 'cancelled'
                                                        ? 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700 line-through'
                                                        : apt.status === 'no_show'
                                                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30 shadow-rose-900/20'
                                                            : 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30 shadow-blue-900/20'
                                                }
                                                ${isOverdue ? 'ring-1 ring-amber-400/40' : ''}
                                            `}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={12} className="flex-shrink-0" />
                                                <span className="font-bold">{formatTime(apt.start, i18n.language)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <User size={12} className="flex-shrink-0" />
                                                <span className="truncate font-medium">{getAppointmentPerson(apt).name || '-'}</span>
                                            </div>
                                            {apt.trainer?.name && (
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    {isRtl ? 'المدرب:' : 'Trainer:'} {apt.trainer.name}
                                                </div>
                                            )}
                                            {apt.status === 'no_show' && (
                                                <div className="text-[10px] uppercase font-black tracking-widest mt-1 opacity-70">No Show</div>
                                            )}
                                        </div>
                                    )})}
                                    {dayApts.length > PREVIEW_LIMIT && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedDayDate(dayItem); }}
                                            className="w-full text-[10px] font-bold text-center py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition"
                                        >
                                            +{dayApts.length - PREVIEW_LIMIT} {t('common.more', 'more')}
                                        </button>
                                    )}
                                </div>

                                {/* Click hint for empty days */}
                                {dayApts.length === 0 && isCurrentMonth && !isPastDay && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
                                        <div className="bg-blue-600/90 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg border border-blue-400/50 backdrop-blur-sm">
                                            {t('appointments.bookAppointment')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderNotifications = () => (
        // ... (reuse existing logic)
        <div className="space-y-4">
            {/* ... keeping existing notifications render logic ... */}
            {/* Note: In a real refactor I'd keep the internal logic unless I need to change it. 
                 Since I'm replacing a large block, I'll essentially paste the existing notifications logic 
                 but ensuring it uses the filtered 'notifications' state which is independent.
             */}
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest px-1">{t('appointments.recentAutoActions')}</h3>
            {notifications.length === 0 && (
                <div className="text-center py-20 text-slate-500 bg-slate-900/50 rounded-2xl border border-white/5">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <div>{t('appointments.noNotifications')}</div>
                </div>
            )}
            {notifications.map(apt => (
                <div key={apt.id} className="flex items-center gap-4 p-4 bg-slate-900/50 border border-white/5 rounded-2xl hover:bg-slate-800 transition-all">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold
                         ${apt.status === 'auto_completed' ? 'bg-teal-500/20 text-teal-500' : 'bg-rose-500/20 text-rose-500'}
                     `}>
                        {apt.status === 'auto_completed' ? <CheckCircle size={24} /> : <XCircle size={24} />}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-white">
                                {apt.status === 'auto_completed' ? t('appointments.autoCompleted') : t('appointments.cancelledNoShow')}
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                                {formatDateTime(apt.updatedAt, i18n.language)}
                            </div>
                        </div>
                        <div className="text-sm text-slate-400 mt-1">
                            {getAppointmentPerson(apt).name || t('appointments.member', 'Member')} {t('appointments.with')} {apt.coach?.firstName}
                        </div>
                        <div className="text-xs text-slate-600 font-bold uppercase tracking-wider mt-1">
                            {t('appointments.scheduledAt')}: {formatDateTime(apt.start, i18n.language)}
                        </div>
                    </div>
                    <button
                        onClick={() => handleEdit(apt)}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition"
                    >
                        {t('appointments.review')}
                    </button>
                </div>
            ))}
        </div>
    );

    const renderList = () => (
        <div className="space-y-2">
            {appointments.map(apt => {
                const person = getAppointmentPerson(apt);
                const hasEnded = apt?.end ? isBefore(parseISO(apt.end), new Date()) : false;
                const isOverdue = hasEnded && !isAppointmentCompleted(apt) && !['cancelled', 'no_show'].includes(apt.status);
                return (
                <div key={apt.id} className={`flex items-center justify-between p-4 bg-slate-800/50 border rounded-2xl hover:bg-slate-800 transition-all group ${isOverdue ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/5'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold 
                            ${apt.status === 'completed' || apt.status === 'auto_completed' ? 'bg-teal-500/20 text-teal-500' :
                                apt.status === 'cancelled' ? 'bg-slate-700/50 text-slate-500 line-through' :
                                    apt.status === 'no_show' ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}
                        `}>
                            {format(parseISO(apt.start), 'd')}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="font-bold text-white">{formatDate(apt.start, i18n.language)}</div>
                                {/* Status Chip */}
                                <div className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full
                                     ${apt.status === 'completed' || apt.status === 'auto_completed' ? 'bg-teal-500/10 text-teal-500' :
                                        apt.status === 'cancelled' ? 'bg-slate-700 text-slate-400' :
                                            apt.status === 'no_show' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}
                                `}>
                                    {apt.status === 'auto_completed' ? 'COMPLETED (AUTO)' : apt.status.replace('_', ' ').toUpperCase()}
                                </div>
                            </div>
                            <div className="text-sm text-slate-400 mt-0.5">
                                {formatTime(apt.start, i18n.language)} - {formatTime(apt.end, i18n.language)} • {person.name || t('appointments.member', 'Member')}
                                {person.phone ? ` • ${person.phone}` : ''}
                                {person.isLead ? ` • ${isRtl ? 'زائر' : 'Lead'}` : ''}
                            </div>
                            {apt.trainer?.name && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    {isRtl ? 'المدرب:' : 'Trainer:'} {apt.trainer.name}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Quick Actions for Scheduled Items */}
                        {!isAppointmentCompleted(apt) && !['cancelled', 'no_show'].includes(apt.status) && (
                            <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleQuickStatus(e, apt, 'completed')}
                                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-500 rounded-lg transition"
                                    title="Mark Completed"
                                >
                                    <CheckCircle size={16} />
                                </button>
                                <button
                                    onClick={(e) => handleQuickStatus(e, apt, 'no_show')}
                                    className="p-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg transition"
                                    title="Mark No Show"
                                >
                                    <AlertCircle size={16} />
                                </button>
                                <button
                                    onClick={(e) => handleQuickStatus(e, apt, 'cancelled')}
                                    className="p-2 bg-slate-700/50 hover:bg-slate-700 hover:text-white text-slate-400 rounded-lg transition"
                                    title="Cancel"
                                >
                                    <XCircle size={16} />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => handleEdit(apt)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition"
                        >
                            {t('common.edit')}
                        </button>
                    </div>
                </div>
            )})}
            {appointments.length === 0 && (
                <div className="text-center py-20 text-slate-500">
                    {t('appointments.noAppointments')}
                </div>
            )}
        </div>
    );

    const filters = [
        { id: 'all', label: t('common.all') },
        { id: 'booked', label: t('appointments.booked', 'Booked') },
        { id: 'arrived', label: t('appointments.arrived', 'Arrived') },
        { id: 'completed', label: t('appointments.completed') },
        { id: 'no_show', label: t('appointments.noShow') },
        { id: 'cancelled', label: t('appointments.cancelled') },
    ];

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">{t('appointments.title')}</h1>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{t('appointments.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-slate-900/50 p-1 rounded-xl flex border-2 border-white/10 shadow-lg">
                        <button onClick={() => setView('calendar')} className={`p-2.5 rounded-lg transition-all ${view === 'calendar' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                            <CalendarIcon size={20} />
                        </button>
                        <button onClick={() => setView('list')} className={`p-2.5 rounded-lg transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                            <List size={20} />
                        </button>
                        <button onClick={() => setView('notifications')} className={`p-2.5 rounded-lg transition-all ${view === 'notifications' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                            <Bell size={20} />
                        </button>
                        <button onClick={() => setView('pending')} className={`p-2.5 rounded-lg transition-all flex items-center gap-2 ${view === 'pending' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                            <AlertCircle size={20} />
                            <span className="text-[10px] font-black uppercase tracking-wider">
                                {isRtl ? 'جلسات تحتاج إكمال' : 'Pending Completion'}
                            </span>
                            {pendingCompletion.length > 0 && (
                                <span className="text-[10px] font-black bg-white/10 px-1.5 py-0.5 rounded-full">
                                    {pendingCompletion.length}
                                </span>
                            )}
                        </button>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/30 transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus size={20} />
                        <span>{t('appointments.bookAppointment')}</span>
                    </button>
                </div>
            </div>

            {pendingCompletion.length > 0 && (
                <div className="text-xs font-bold text-amber-300">
                    فيه جلسات محتاجة إكمال   هتلاقيها في تبويب (Pending Completion).
                </div>
            )}

            {/* Controls & Legend Row */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-4 overflow-x-auto pb-2 xl:pb-0">
                    {/* Month Navigation */}
                    <div className="flex items-center gap-3 py-3 px-6 bg-slate-900/50 rounded-xl border-2 border-white/10 shadow-lg whitespace-nowrap">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="text-lg font-black text-white uppercase tracking-wider w-40 text-center cursor-pointer hover:text-blue-400 transition" onClick={handleToday}>
                            {format(currentDate, 'MMMM yyyy', { locale: isRtl ? arEG : enUS })}
                        </div>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex bg-slate-900/50 p-1.5 rounded-xl border-2 border-white/10 shadow-lg">
                        {filters.map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => setStatusFilter(filter.id)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                                    ${statusFilter === filter.id
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-500 hover:text-white hover:bg-white/5'}
                                `}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color Legend */}
                <div className="flex items-center gap-4 py-3 px-6 bg-slate-900/50 rounded-xl border-2 border-white/10 shadow-lg whitespace-nowrap overflow-x-auto">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('appointments.legend')}:</div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-emerald-500/30 border-2 border-emerald-500/50"></div>
                        <span className="text-xs font-medium text-slate-400">{t('appointments.scheduled')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-teal-500/30 border-2 border-teal-500/50"></div>
                        <span className="text-xs font-medium text-slate-400">{t('appointments.completed')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-rose-500/30 border-2 border-rose-500/50"></div>
                        <span className="text-xs font-medium text-slate-400">{t('appointments.noShow')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-slate-500/30 border-2 border-slate-500/50"></div>
                        <span className="text-xs font-medium text-slate-400">{t('appointments.cancelled')}</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            {view === 'calendar' ? renderCalendar() : view === 'list' ? renderList() : view === 'pending' ? renderPendingCompletion() : renderNotifications()}

            {/* Create/Edit Modal */}
            {showModal && (
                <AppointmentModal
                    open={showModal}
                    onClose={() => {
                        setShowModal(false);
                        setPreSelectedDate(null);
                        setPendingCompletionId(null);
                        setAppointmentReadOnly(false);
                    }}
                    onSuccess={() => {
                        fetchAppointments();
                        fetchPendingCompletion({ allowAlerts: false });
                    }}
                    appointment={selectedAppointment}
                    initialDate={preSelectedDate}
                    readOnly={appointmentReadOnly}
                    autoCompleteTriggerId={pendingCompletionId}
                    onAutoCompleteTriggered={() => setPendingCompletionId(null)}
                />
            )}

              {/* Day Details Modal */}
              <DayDetailsModal
                  isOpen={!!selectedDayDate}
                  onClose={() => setSelectedDayDate(null)}
                  date={selectedDayDate || new Date()}
                  appointments={selectedDayDate ? (appointmentsByDate[format(selectedDayDate, 'yyyy-MM-dd')] || []) : []}
                  readOnly={selectedDayDate ? isPastDate(selectedDayDate) : false}
                  onStatusUpdate={handleQuickStatus}
                  onEdit={(apt) => {
                      setSelectedDayDate(null);
                      handleEdit(apt);
                  }}
              />
        </div>
    );
};

export default Appointments;
