import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, User, Calendar, Clock, DollarSign, Activity, Eye, CheckCircle, Lock } from 'lucide-react';
import apiClient, { getStaffTrainers } from '../../utils/api';
import { useAuthStore } from '../../store';
import toast from 'react-hot-toast';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, addMinutes, isBefore, isAfter, startOfDay } from 'date-fns';
import { formatTime } from '../../utils/dateFormatter';
import CoachScheduleModal from './CoachScheduleModal';
import CompletionPreviewModal from './CompletionPreviewModal';
import ReceiptModal from '../../components/payments/ReceiptModal';

const AppointmentModal = ({ open, onClose, onSuccess, appointment, initialDate, autoCompleteTriggerId, onAutoCompleteTriggered, readOnly }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';
    const isReadOnly = Boolean(readOnly);

    // Form State
    const [memberSearch, setMemberSearch] = useState('');
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [selectedCoachId, setSelectedCoachId] = useState('');
    const [trainers, setTrainers] = useState([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState('');
    const [trainerLoading, setTrainerLoading] = useState(false);

    const [services, setServices] = useState([]);
    const { user } = useAuthStore();

    // Split Date/Time State
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedTime, setSelectedTime] = useState('09:00');
    const [selectedHour, setSelectedHour] = useState('9');
    const [selectedMinute, setSelectedMinute] = useState('00');
    const [selectedPeriod, setSelectedPeriod] = useState('AM');
    const [durationInput, setDurationInput] = useState('60'); // string minutes

    // Availability State
    const [bookedRanges, setBookedRanges] = useState([]);
    const [showSchedule, setShowSchedule] = useState(false);

    // Completion Flow State
    const [showCompletionPreview, setShowCompletionPreview] = useState(false);
    const [completionData, setCompletionData] = useState(null);
    const [completionLoading, setCompletionLoading] = useState(false);

    const [form, setForm] = useState({
        title: 'PT Session',
        price: '0',
        notes: '',
        status: 'scheduled'
    });

    const [loading, setLoading] = useState(false);
    const [memberLoading, setMemberLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchTrainerOptions();
            fetchServices();
            if (appointment) {
                // Edit Mode
                setSelectedMember(appointment.member);
                setSelectedCoachId((user?.id ? user.id.toString() : appointment.coachId?.toString()) || '');
                setSelectedTrainerId(appointment.trainerId?.toString() || '');

                const start = parseISO(appointment.start);
                const end = parseISO(appointment.end);

                setSelectedDate(format(start, 'yyyy-MM-dd'));
                setSelectedTime(format(start, 'HH:mm'));

                const diffMins = Math.max(0, (end - start) / 60000);
                setDurationInput((diffMins > 0 ? diffMins : 60).toString());

                setForm({
                    title: appointment.title || 'PT Session',
                    price: appointment.price?.toString() || '0',
                    notes: appointment.notes || '',
                    status: appointment.status
                });
            } else {
                // Reset for create mode
                setMemberSearch('');
                setSelectedMember(null);
                setSelectedCoachId(user?.id ? user.id.toString() : '');
                setSelectedTrainerId('');

                if (initialDate) {
                    setSelectedDate(format(initialDate, 'yyyy-MM-dd'));
                } else {
                    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                }

                // Next hour
                const next = new Date();
                next.setHours(next.getHours() + 1, 0, 0, 0);
                setSelectedTime(format(next, 'HH:mm'));
                setDurationInput('60');

                setForm({
                    title: 'PT Session',
                    price: '0',
                    notes: '',
                    status: 'scheduled'
                });
                setBookedRanges([]);

                // Clear completion state
                setShowCompletionPreview(false);
                setCompletionData(null);
            }
        }
    }, [open, appointment]);

    // Fetch availability when coach or month changes
    useEffect(() => {
        if (selectedCoachId && selectedDate) {
            fetchAvailability();
        }
    }, [selectedCoachId, selectedDate]);

    const fetchAvailability = async () => {
        try {
            const dateObj = new Date(selectedDate);
            const from = startOfMonth(dateObj).toISOString();
            const to = endOfMonth(addMonths(dateObj, 1)).toISOString();

            const res = await apiClient.get(`/appointments/availability?coachId=${selectedCoachId}&from=${from}&to=${to}`);
            if (res.data.success) {
                setBookedRanges(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch availability');
        }
    };

    const fetchTrainerOptions = async () => {
        setTrainerLoading(true);
        try {
            const res = await getStaffTrainers();
            if (res.data.success) {
                const unique = new Map();
                res.data.data.forEach(t => {
                    if (!unique.has(t.id)) {
                        unique.set(t.id, t);
                    }
                });
                setTrainers(Array.from(unique.values()));
            }
        } catch (error) {
            console.error('Failed to fetch trainers');
        } finally {
            setTrainerLoading(false);
        }
    };

    const fetchServices = async () => {
        try {
            const res = await apiClient.get('/services?type=SESSION&active=true');
            if (res.data.success) {
                setServices(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch services');
        }
    };

    const searchMembers = async (q) => {
        setMemberSearch(q);
        if (q.length < 2) {
            if (q.length === 0) setMembers([]);
            return;
        }
        setMemberLoading(true);
        try {
            const res = await apiClient.get(`/members/search/${encodeURIComponent(q)}`);
            if (res.data.success) {
                setMembers(res.data.data.slice(0, 5));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setMemberLoading(false);
        }
    };

    // Calculate Start/End Date objects
    const parseTimeInput = (value) => {
        if (!value) return null;
        const match = value.match(/^\s*([01]\d|2[0-3]):([0-5]\d)\s*$/);
        if (!match) return null;
        return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
    };

    const buildTimeFromParts = (hourValue, minuteValue, periodValue) => {
        const hourNumber = parseInt(hourValue, 10);
        const minuteNumber = parseInt(minuteValue, 10);
        if (Number.isNaN(hourNumber) || Number.isNaN(minuteNumber)) return '';
        if (hourNumber < 1 || hourNumber > 12) return '';
        if (minuteNumber < 0 || minuteNumber > 59) return '';
        const hour24 = (hourNumber % 12) + (periodValue === 'PM' ? 12 : 0);
        return `${String(hour24).padStart(2, '0')}:${String(minuteNumber).padStart(2, '0')}`;
    };

    const startTimeParsed = useMemo(() => parseTimeInput(selectedTime), [selectedTime]);
    const staffName = useMemo(() => {
        const first = user?.firstName || '';
        const last = user?.lastName || '';
        const full = `${first} ${last}`.trim();
        return full || user?.username || user?.email || '';
    }, [user]);
    const durationNumber = useMemo(() => {
        const value = parseInt(durationInput, 10);
        return Number.isNaN(value) ? null : value;
    }, [durationInput]);

    const currentStart = useMemo(() => {
        if (!startTimeParsed) return null;
        const date = new Date(selectedDate);
        date.setHours(startTimeParsed.hour, startTimeParsed.minute, 0, 0);
        return date;
    }, [selectedDate, startTimeParsed]);

    const selectedDay = useMemo(() => (selectedDate ? parseISO(selectedDate) : null), [selectedDate]);
    const isPastSelection = useMemo(() => {
        if (!selectedDay) return false;
        return isBefore(selectedDay, startOfDay(new Date()));
    }, [selectedDay]);

    const durationValid = durationNumber !== null && durationNumber >= 1 && durationNumber <= 600;
    const isArabic = (i18n.language || '').startsWith('ar');
    const hourOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => String(index + 1)), []);
    const minuteOptions = useMemo(() => [0, 5, 10, 15, 20, 30, 45, 55], []);
    const selectedTrainer = useMemo(() => trainers.find(trainer => String(trainer.id) === String(selectedTrainerId)), [trainers, selectedTrainerId]);
    const commissionPercentValue = selectedTrainer
        ? (selectedTrainer.commissionPercent ?? selectedTrainer.commissionValue ?? 0)
        : null;
    const commissionAmountValue = selectedTrainer
        ? ((parseFloat(form.price || 0) * (commissionPercentValue || 0)) / 100)
        : null;

    const timeError = useMemo(() => {
        if (!selectedTime) return isArabic ? 'الوقت مطلوب.' : 'Time is required.';
        if (!startTimeParsed) return isArabic ? 'وقت غير صالح.' : 'Invalid time format.';
        return '';
    }, [selectedTime, startTimeParsed, isArabic]);

    const durationError = useMemo(() => {
        if (!durationInput) return isArabic ? 'المدة مطلوبة.' : 'Duration is required.';
        if (!durationValid) return isArabic ? 'المدة يجب أن تكون بين 1 و 600 دقيقة.' : 'Duration must be between 1 and 600 minutes.';
        return '';
    }, [durationInput, durationValid, isArabic]);

    const currentEnd = useMemo(() => {
        if (!currentStart || !durationValid) return null;
        return addMinutes(currentStart, durationNumber);
    }, [currentStart, durationNumber, durationValid]);
    const endTimeLabel = currentEnd ? formatTime(currentEnd, i18n.language) : '--:--';
    const validationError = Boolean(timeError || durationError || !currentStart || !currentEnd);

    // Check overlap for current selection
    const isOverlapping = useMemo(() => {
        if (!currentStart || !currentEnd) return false;
        if (bookedRanges.length === 0) return false;

        return bookedRanges.some(range => {
            const rangeStart = parseISO(range.start);
            const rangeEnd = parseISO(range.end);

            // Check EXACT match to avoid self-warning if times didn't change
            if (appointment && rangeStart.getTime() === parseISO(appointment.start).getTime()) return false;

            return isBefore(currentStart, rangeEnd) && isAfter(currentEnd, rangeStart);
        });
    }, [currentStart, currentEnd, bookedRanges, appointment]);

    useEffect(() => {
        const parsed = parseTimeInput(selectedTime);
        if (!parsed) return;
        const period = parsed.hour >= 12 ? 'PM' : 'AM';
        const hour12 = parsed.hour % 12 === 0 ? 12 : parsed.hour % 12;
        const minute = String(parsed.minute).padStart(2, '0');
        if (selectedHour !== String(hour12)) setSelectedHour(String(hour12));
        if (selectedMinute !== minute) setSelectedMinute(minute);
        if (selectedPeriod !== period) setSelectedPeriod(period);
    }, [selectedTime]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isReadOnly) {
            return;
        }
        setLoading(true);

        try {
            if (!selectedMember) {
                toast.error('Please select a member');
                return;
            }
            if (!user?.id) {
                toast.error('Please select a staff');
                return;
            }
            if (validationError) {
                return;
            }

            const payload = {
                ...form,
                start: format(currentStart, "yyyy-MM-dd'T'HH:mm"),
                end: format(currentEnd, "yyyy-MM-dd'T'HH:mm"),
                memberId: selectedMember.id,
                coachId: parseInt(user.id),
                price: parseFloat(form.price)
            };
            payload.durationMinutes = durationNumber;
            payload.startTime = selectedTime;
            payload.trainerId = selectedTrainerId ? parseInt(selectedTrainerId) : null;

            let res;
            if (appointment) {
                res = await apiClient.put(`/appointments/${appointment.id}`, payload);
            } else {
                res = await apiClient.post('/appointments', payload);
            }

            if (res.data.success) {
                toast.success(appointment ? 'Appointment Updated' : 'Appointment Created');
                onSuccess();
                onClose();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save appointment');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (isReadOnly) {
            return;
        }
        if (!confirm('Are you sure you want to cancel this appointment? This will mark it as Cancelled.')) return;
        setLoading(true);
        try {
            await apiClient.put(`/appointments/${appointment.id}`, { status: 'cancelled' });
            toast.success('Appointment cancelled');
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Failed to cancel');
        } finally {
            setLoading(false);
        }
    };

    const handleCompletionClick = async () => {
        if (!appointment || isAlreadyCompleted) return;
        const ended = appointment?.end ? isBefore(parseISO(appointment.end), new Date()) : false;
        if (!ended) {
            const confirmMessage = isRtl
                ? 'الجلسة لم تنتهِ بعد، هل أنت متأكد من الإكمال؟'
                : 'Session has not ended yet. Are you sure you want to complete it?';
            if (!window.confirm(confirmMessage)) return;
        }
        setCompletionLoading(true);
        try {
            // First, get preview
            const rawSessionPrice = Number(form.price || appointment?.price || 0);
            const params = Number.isFinite(rawSessionPrice) && rawSessionPrice > 0
                ? { sessionPrice: rawSessionPrice }
                : {};
            const trainerIdValue = selectedTrainerId ? Number(selectedTrainerId) : undefined;
            if (Number.isFinite(trainerIdValue) && trainerIdValue > 0) {
                params.trainerId = trainerIdValue;
            }
            const res = await apiClient.get(`/appointments/${appointment.id}/preview-completion`, { params });
            if (res.data.success) {
                setCompletionData(res.data.data);
                setShowCompletionPreview(true);
            }
        } catch (error) {
            toast.error('Failed to prepare completion');
        } finally {
            setCompletionLoading(false);
        }
    };

    useEffect(() => {
        if (autoCompleteTriggerId && appointment && appointment.id === autoCompleteTriggerId) {
            handleCompletionClick();
            onAutoCompleteTriggered?.();
        }
    }, [autoCompleteTriggerId, appointment]);

    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState(null);

    const confirmCompletion = async (payload) => {
        if (!appointment || isAlreadyCompleted) {
            return;
        }
        setCompletionLoading(true);
        try {
            const isSessionCompletion = completionData?.isSession ?? !appointment?.subscriptionId;
            const sessionPriceValue = Number(payload?.sessionPrice);
            if (isSessionCompletion && (!Number.isFinite(sessionPriceValue) || sessionPriceValue <= 0)) {
                toast.error(isRtl ? 'سعر الجلسة يجب أن يكون أكبر من صفر' : 'Session price must be greater than 0');
                return;
            }
            const normalizedPayload = {
                ...payload,
                sessionPrice: isSessionCompletion ? sessionPriceValue : undefined,
                payment: payload?.payment ? {
                    ...payload.payment,
                    amount: Number(payload.payment.amount)
                } : null
            };
            const res = await apiClient.post(`/appointments/${appointment.id}/complete`, normalizedPayload);
            const responseData = res.data?.data || res.data;

            if (responseData?.alreadyCompleted) {
                toast.success(t('appointments.completed'));
                onSuccess();
                onClose();
                return;
            }

            // Check for payment receipt
            if (responseData?.receipt) {
                setReceiptData({
                    ...responseData.receipt,
                    // Ensure member/user objects are populated if needed by ReceiptModal
                    member: appointment.member,
                    amount: payload.payment ? payload.payment.amount : 0, // Fallback
                    method: payload.payment ? payload.payment.method : 'cash',
                    paidAt: new Date(),
                    subscription: null
                });
                // If the backend returns the full payment object structure, even better.
                // But typically it returns the Payment Record + Receipt.
                // Let's assume response includes 'payment' object with receipt.
                if (responseData.payment) {
                    setReceiptData({
                        ...responseData.payment,
                        member: appointment.member,
                    });
                }

                setShowCompletionPreview(false);
                setShowReceipt(true); // Open receipt modal
                toast.success(isRtl ? 'تم إكمال الجلسة وتسجيل الدفعة' : 'Session completed & Payment recorded');
                if (isSessionCompletion && appointment?.trainerId && Number.isFinite(payload?.commissionPercent)) {
                    toast.success(t('appointments.trainerCommissionSaved', isRtl ? 'تم حفظ نسبة العمولة الافتراضية للمدرب' : 'Trainer default commission saved'));
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new Event('trainers:updated'));
                    }
                }
                onSuccess();
                // Do NOT Close AppointmentModal yet, let user close Receipt then Appointment
            } else {
                toast.success(isRtl ? 'تم إكمال الجلسة بنجاح' : 'Session completed.');
                if (isSessionCompletion && appointment?.trainerId && Number.isFinite(payload?.commissionPercent)) {
                    toast.success(t('appointments.trainerCommissionSaved', isRtl ? 'تم حفظ نسبة العمولة الافتراضية للمدرب' : 'Trainer default commission saved'));
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new Event('trainers:updated'));
                    }
                }
                onSuccess();
                onClose();
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('payments:updated'));
            }
        } catch (e) {
            console.error(e);
            const fallback = isRtl ? 'فشل تحديث الجلسة' : 'Failed to update';
            toast.error(e.response?.data?.message_ar || e.response?.data?.message_en || fallback);
        } finally {
            setCompletionLoading(false);
            if (!showReceipt) setShowCompletionPreview(false);
        }
    };

    const hasEnded = appointment?.end ? isBefore(parseISO(appointment.end), new Date()) : false;
    const isCompletableStatus = appointment && !['cancelled', 'no_show', 'completed', 'auto_completed'].includes(appointment.status);
    const isAlreadyCompleted = Boolean(appointment && (appointment.isCompleted || appointment.status === 'completed' || appointment.status === 'auto_completed' || appointment.completedAt));
    const canComplete = appointment && !isAlreadyCompleted && isCompletableStatus;
    const isSubmitDisabled = isReadOnly || loading || isOverlapping || isPastSelection || validationError;

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className={`w-full max-w-lg transform overflow-hidden rounded-2xl bg-slate-900 border border-white/10 p-6 text-left align-middle shadow-xl transition-all ${isRtl ? 'text-right' : ''}`}>
                            <div className="flex items-center justify-between mb-6">
                                <Dialog.Title as="h3" className="text-xl font-black text-white uppercase tracking-tight">
                                    {appointment ? t('appointments.editAppointment') : t('appointments.newAppointment')}
                                </Dialog.Title>
                                {isReadOnly && (
                                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold uppercase tracking-widest">
                                        <Lock size={14} />
                                        {t('appointments.readOnly', 'Read only')}
                                    </div>
                                )}
                                {appointment && isAlreadyCompleted && (
                                    <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                                        {appointment.status === 'auto_completed' ? t('appointments.autoCompleted') : t('appointments.completed')}
                                    </div>
                                )}
                                {appointment && !isAlreadyCompleted && hasEnded && (
                                    <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                                        {t('appointments.pendingCompletion', 'Pending Completion')}
                                    </div>
                                )}
                                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <fieldset disabled={isReadOnly} className={isReadOnly ? 'opacity-80' : ''}>

                                    {/* 1. Member Search */}
                                    {!appointment && (
                                        <div className="space-y-2 relative">
                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.member')}</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : memberSearch}
                                                    onChange={(e) => {
                                                        setSelectedMember(null);
                                                        searchMembers(e.target.value);
                                                    }}
                                                    placeholder={t('appointments.searchMemberPlaceholder')}
                                                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                                                />
                                                {memberLoading && <div className="absolute right-3 top-3 text-white/50 animate-spin">⌛</div>}
                                            </div>
                                            {/* Results Dropdown */}
                                            {members.length > 0 && !selectedMember && (
                                                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                                    {members.map(m => (
                                                        <div key={m.id}
                                                            className="p-3 hover:bg-white/5 cursor-pointer flex justify-between items-center"
                                                            onClick={() => { setSelectedMember(m); setMembers([]); }}>
                                                            <span className="text-white font-bold">{m.firstName} {m.lastName}</span>
                                                            <span className="text-xs text-slate-500">{m.memberId}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {selectedMember && (
                                        <div className="text-xs text-slate-400">
                                            {`${selectedMember.firstName || ''} ${selectedMember.lastName || ''}`.trim()} • {selectedMember.memberId || '-'} • {selectedMember.phone || '-'}
                                        </div>
                                    )}

                                    {/* 2. Staff (Read-only) + Show Schedule Button */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">{t('payInOut.employee')}</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <User className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                                <div className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white ${isRtl ? 'pr-11' : 'pl-11'}`}>
                                                    {staffName || t('common.notAvailable', 'Not available')}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowSchedule(true)}
                                                disabled={!selectedCoachId}
                                                className="px-4 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-xl text-slate-300 disabled:opacity-50 transition text-xs font-bold whitespace-nowrap"
                                            >
                                                {t('appointments.showSchedule')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* 3. Date & Status */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.date')}</label>
                                            <div className="relative">
                                                <Calendar className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                                <input
                                                    type="date"
                                                    required
                                                    min={format(new Date(), 'yyyy-MM-dd')}
                                                    disabled={isReadOnly || (appointment && format(parseISO(appointment.start), 'yyyy-MM-dd') <= format(new Date(), 'yyyy-MM-dd'))}
                                                    value={selectedDate}
                                                    onChange={e => setSelectedDate(e.target.value)}
                                                    className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 ${isRtl ? 'pr-11' : 'pl-11'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.status')}</label>
                                            <select
                                                value={form.status}
                                                onChange={e => setForm({ ...form, status: e.target.value })}
                                                className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none"
                                            >
                                                <option value="scheduled">{t('appointments.scheduled')}</option>
                                                <option value="completed">{t('appointments.completed')}</option>
                                                <option value="no_show">{t('appointments.noShow')}</option>
                                                <option value="cancelled">{t('appointments.cancelled')}</option>
                                            </select>
                                        </div>
                                    </div>



                                    {/* 4. Start Time & 5. Duration */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.startTime')}</label>

                                            {/* Unified Time Input Control */}
                                            <div className="flex items-center bg-slate-800 border border-white/5 rounded-xl px-2 py-1 focus-within:border-blue-500 transition relative">
                                                <Clock className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500 opacity-0`} size={18} />

                                                {/* Hour */}
                                                <select
                                                    value={selectedHour}
                                                    onChange={(e) => {
                                                        const nextHour = e.target.value;
                                                        setSelectedHour(nextHour);
                                                        setSelectedTime(buildTimeFromParts(nextHour, selectedMinute, selectedPeriod));
                                                    }}
                                                    className="bg-transparent text-white text-lg font-bold p-2 outline-none cursor-pointer appearance-none text-center w-16 hover:bg-white/5 rounded"
                                                >
                                                    {hourOptions.map(hour => (
                                                        <option key={hour} value={hour} className="bg-slate-800">{hour}</option>
                                                    ))}
                                                </select>

                                                <span className="text-slate-500 font-bold px-1">:</span>

                                                {/* Minute */}
                                                <div className="relative w-16">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={selectedMinute}
                                                        onChange={(e) => {
                                                            const next = e.target.value.replace(/\D/g, '').slice(0, 2);
                                                            setSelectedMinute(next);
                                                            setSelectedTime(buildTimeFromParts(selectedHour, next, selectedPeriod));
                                                        }}
                                                        onBlur={() => {
                                                            let val = parseInt(selectedMinute, 10);
                                                            if (Number.isNaN(val)) val = 0;
                                                            const clamped = Math.min(59, Math.max(0, val));
                                                            const normalized = String(clamped).padStart(2, '0');
                                                            setSelectedMinute(normalized);
                                                            setSelectedTime(buildTimeFromParts(selectedHour, normalized, selectedPeriod));
                                                        }}
                                                        className="w-full bg-transparent text-white text-lg font-bold p-2 text-center outline-none hover:bg-white/5 rounded"
                                                    />
                                                </div>

                                                {/* AM/PM */}
                                                <div className="flex bg-slate-900 rounded-lg p-1 ml-auto gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPeriod('AM');
                                                            setSelectedTime(buildTimeFromParts(selectedHour, selectedMinute, 'AM'));
                                                        }}
                                                        className={`px-3 py-1 text-xs font-bold rounded-md transition ${selectedPeriod === 'AM' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        {t('appointments.am', 'AM')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPeriod('PM');
                                                            setSelectedTime(buildTimeFromParts(selectedHour, selectedMinute, 'PM'));
                                                        }}
                                                        className={`px-3 py-1 text-xs font-bold rounded-md transition ${selectedPeriod === 'PM' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        {t('appointments.pm', 'PM')}
                                                    </button>
                                                </div>
                                            </div>

                                            {(() => {
                                                if (!selectedTime) {
                                                    return <div className="text-xs text-rose-400">{t('appointments.timeRequired', 'Time is required')}</div>;
                                                }
                                                if (!startTimeParsed) {
                                                    return <div className="text-xs text-rose-400">{t('appointments.invalidTime', 'Invalid time format')}</div>;
                                                }
                                                return null;
                                            })()}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.duration')}</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="600"
                                                inputMode="numeric"
                                                placeholder="15"
                                                value={durationInput}
                                                onChange={e => setDurationInput(e.target.value.replace(/\D/g, ''))}
                                                onBlur={() => {
                                                    const parsed = parseInt(durationInput, 10);
                                                    if (!Number.isNaN(parsed)) {
                                                        setDurationInput(parsed.toString());
                                                    }
                                                }}
                                                className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                            />
                                            {(durationInput && !durationValid) && (
                                                <div className="text-xs text-rose-400">
                                                    {t('appointments.durationRange', 'Duration must be between 1 and 600 minutes')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 6. Ends At (Auto-Calculated Read-only) */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.endsAt')}</label>
                                        <div className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed">
                                            {endTimeLabel}
                                        </div>
                                    </div>

                                    {isPastSelection && (
                                        <div className="text-xs text-rose-400">
                                            {t('appointments.pastDateError', 'You cannot create a booking in a past date')}
                                        </div>
                                    )}

                                    {isOverlapping && (
                                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-sm font-bold animate-pulse">
                                            <Activity size={16} />
                                            {t('appointments.overlap')}
                                        </div>
                                    )}

                                    {/* 7. Service Dropdown & Price */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.service')}</label>
                                            <div className="relative">
                                                <Activity className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                                <select
                                                    required
                                                    value={form.title}
                                                    onChange={(e) => {
                                                        const selectedName = e.target.value;
                                                        const service = services.find(s => s.name === selectedName);
                                                        setForm(prev => ({
                                                            ...prev,
                                                            title: selectedName,
                                                            price: service ? service.defaultPrice.toString() : prev.price
                                                        }));
                                                    }}
                                                    className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none ${isRtl ? 'pr-11' : 'pl-11'}`}
                                                >
                                                    <option value="">{t('appointments.selectService', 'Select Service')}</option>
                                                    {services.length > 0 ? (
                                                        services.map(service => (
                                                            <option key={service.id} value={service.name}>
                                                                {service.name}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <option value="PT Session">{t('appointments.ptSession')}</option>
                                                            <option value="Consultation">{t('appointments.consultation')}</option>
                                                            <option value="Assessment">{t('appointments.assessment')}</option>
                                                            <option value="Class">{t('appointments.class')}</option>
                                                            <option value="Other">{t('appointments.other')}</option>
                                                        </>
                                                    )}
                                                    {services.length > 0 && <option value="Other">{t('appointments.other')}</option>}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.sessionPrice')}</label>
                                            <div className="relative">
                                                <DollarSign className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    required
                                                    value={form.price}
                                                    onChange={e => setForm({ ...form, price: e.target.value })}
                                                    className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 ${isRtl ? 'pr-11' : 'pl-11'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.trainer')}</label>
                                        <div className="relative">
                                            <User className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                            <select
                                                value={selectedTrainerId}
                                                onChange={e => setSelectedTrainerId(e.target.value)}
                                                className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 ${isRtl ? 'pr-11' : 'pl-11'}`}
                                            >
                                                <option value="">{t('appointments.selectTrainer')}</option>
                                                {trainers.map(trainer => (
                                                    <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
                                                ))}
                                            </select>
                                            {trainerLoading && <div className="absolute right-3 top-3 text-white/50 animate-spin">âŒ›</div>}
                                        </div>
                                    </div>

                                    {selectedTrainer && (
                                        <div className="p-3 bg-slate-800/60 border border-white/5 rounded-xl text-xs text-slate-300">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400">{t('appointments.commissionPreview')}</span>
                                                <span className="font-bold">
                                                    {t('appointments.commissionPercent')}: {commissionPercentValue ?? 0}%
                                                </span>
                                            </div>
                                            <div className="mt-1 text-slate-200 font-bold">
                                                {t('appointments.commissionAmount')}: {Number(commissionAmountValue || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    )}

                                    {/* 8. Notes */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.notes')}</label>
                                        <textarea
                                            value={form.notes}
                                            onChange={e => setForm({ ...form, notes: e.target.value })}
                                            className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 h-24 resize-none"
                                            placeholder="Add notes..."
                                        />
                                    </div>

                                </fieldset>

                                {/* 9. Confirm Booking Button */}
                                {(canComplete || !isReadOnly) && (
                                    <div className="flex items-center gap-3 pt-4">
                                        {appointment && (
                                            <>
                                                {/* Show for any status NOT completed/cancelled */}
                                                {canComplete && (
                                                    <button
                                                        type="button"
                                                        onClick={handleCompletionClick}
                                                        disabled={completionLoading}
                                                        className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex-1 flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-900/20"
                                                    >
                                                        {completionLoading ? (
                                                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                                        ) : (
                                                            <CheckCircle size={18} />
                                                        )}
                                                        {t('appointments.complete')}
                                                    </button>
                                                )}
                                                {!isReadOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={handleCancel}
                                                        className="px-6 py-3 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-xl font-bold transition flex-1 whitespace-nowrap"
                                                    >
                                                        {t('appointments.cancelAppointment')}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {!isReadOnly && (
                                            <button
                                                type="submit"
                                                disabled={isSubmitDisabled}
                                                className={`px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex-[2] flex items-center justify-center gap-2 ${isSubmitDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {loading ? t('appointments.saving') : (appointment ? t('appointments.update') : t('appointments.confirmBooking'))}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </form>
                        </Dialog.Panel>
                    </div>
                </div>

                {/* Sub Modal: Schedule */}
                <CoachScheduleModal
                    open={showSchedule}
                    onClose={() => setShowSchedule(false)}
                    coachId={selectedCoachId}
                    coachName={staffName || 'Coach'}
                />

                {/* Sub Modal: Completion Preview */}
                <CompletionPreviewModal
                    open={showCompletionPreview}
                    onClose={() => setShowCompletionPreview(false)}
                    onConfirm={confirmCompletion}
                    data={completionData}
                    loading={completionLoading}
                />

                {/* Receipt Modal */}
                <ReceiptModal
                    payment={receiptData}
                    onClose={() => {
                        setShowReceipt(false);
                        onClose(); // Close parent modal too when receipt is closed
                    }}
                    onDownload={(id) => console.log('Download', id)}
                />
            </Dialog>
        </Transition>
    );
};

export default AppointmentModal;
