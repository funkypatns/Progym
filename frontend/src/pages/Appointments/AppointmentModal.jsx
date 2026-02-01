import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, User, Calendar, Clock, DollarSign, Activity, Eye, CheckCircle, Lock } from 'lucide-react';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, addMinutes, isBefore, isAfter, startOfDay } from 'date-fns';
import { formatTime } from '../../utils/dateFormatter';
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
    const [coaches, setCoaches] = useState([]);
    const [selectedCoachId, setSelectedCoachId] = useState('');

    const [services, setServices] = useState([]);

    // Split Date/Time State
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedTime, setSelectedTime] = useState('09:00');
    const [selectedHour, setSelectedHour] = useState('9');
    const [selectedMinute, setSelectedMinute] = useState('00');
    const [selectedPeriod, setSelectedPeriod] = useState('AM');
    const [durationInput, setDurationInput] = useState('60'); // string minutes

    // Availability State
    const [bookedRanges, setBookedRanges] = useState([]);

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
            fetchCoaches();
            fetchServices();
            if (appointment) {
                // Edit Mode
                setSelectedMember(appointment.member);
            setSelectedCoachId((appointment.createdByEmployee?.id ?? appointment.coachId)?.toString());

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
            setSelectedCoachId('');

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

    const fetchCoaches = async () => {
        try {
            const res = await apiClient.get('/users?role=staff');
            if (res.data.success) {
                setCoaches(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch coaches');
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
    const minuteOptions = useMemo(() => [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], []);

    const timeError = useMemo(() => {
        if (!selectedTime) return isArabic ? 'Ø§Ù„ÙˆÙ‚Øª Ù…Ø·Ù„ÙˆØ¨.' : 'Time is required.';
        if (!startTimeParsed) return isArabic ? 'ÙˆÙ‚Øª ØºÙŠØ± ØµØ§Ù„Ø­.' : 'Invalid time format.';
        return '';
    }, [selectedTime, startTimeParsed, isArabic]);

    const durationError = useMemo(() => {
        if (!durationInput) return isArabic ? 'Ø§Ù„Ù…Ø¯Ø© Ù…Ø·Ù„ÙˆØ¨Ø©.' : 'Duration is required.';
        if (!durationValid) return isArabic ? 'Ø§Ù„Ù…Ø¯Ø© ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† Ø¨ÙŠÙ† 1 Ùˆ 600 Ø¯Ù‚ÙŠÙ‚Ø©.' : 'Duration must be between 1 and 600 minutes.';
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
            if (!selectedCoachId) {
                toast.error(isArabic ? 'يرجى اختيار موظف' : 'Please select an employee');
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
                    coachId: parseInt(selectedCoachId),
                    createdByEmployeeId: parseInt(selectedCoachId),
                    price: parseFloat(form.price)
                };
                payload.durationMinutes = durationNumber;
                payload.startTime = selectedTime;

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
        if (!appointment || appointment?.isCompleted) return;
        const ended = appointment?.end ? isBefore(parseISO(appointment.end), new Date()) : false;
        if (!ended) {
            const confirmMessage = isRtl
                ? 'Ø§Ù„Ø¬Ù„Ø³Ø© Ù„Ù… ØªÙ†ØªÙ‡Ù Ø¨Ø¹Ø¯ØŒ Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø§Ù„Ø¥ÙƒÙ…Ø§Ù„ØŸ'
                : 'Session has not ended yet. Are you sure you want to complete it?';
            if (!window.confirm(confirmMessage)) return;
        }
        setCompletionLoading(true);
        try {
            // First, get preview
            const res = await apiClient.get(`/appointments/${appointment.id}/preview-completion`);
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
        if (!appointment || appointment?.isCompleted) {
            return;
        }
        setCompletionLoading(true);
        try {
            const res = await apiClient.post(`/appointments/${appointment.id}/complete`, payload);

            // Check for payment receipt
            if (res.data.data?.receipt) {
                setReceiptData({
                    ...res.data.data.receipt,
                    // Ensure member/user objects are populated if needed by ReceiptModal
                    member: appointment.member,
                    amount: payload.payment ? payload.payment.amount : 0, // Fallback
                    method: payload.payment ? payload.payment.method : 'cash',
                    paidAt: new Date(),
                    subscription: null
                });
                // If the backend returns the full payment object structure, even better.
                // But typically it returns the Payment Record + Receipt.
                // Let's assume res.data.data includes 'payment' object with receipt.
                if (res.data.data.payment) {
                    setReceiptData({
                        ...res.data.data.payment,
                        member: appointment.member,
                    });
                }

                setShowCompletionPreview(false);
                setShowReceipt(true); // Open receipt modal
                toast.success('Session completed & Payment recorded');
                onSuccess();
                // Do NOT Close AppointmentModal yet, let user close Receipt then Appointment
            } else {
                toast.success('Session completed. Coach earning recorded as PENDING.');
                onSuccess();
                onClose();
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to update');
        } finally {
            setCompletionLoading(false);
            if (!showReceipt) setShowCompletionPreview(false);
        }
    };

    const hasEnded = appointment?.end ? isBefore(parseISO(appointment.end), new Date()) : false;
    const isCompletableStatus = appointment && !['cancelled', 'no_show'].includes(appointment.status);
    const canComplete = appointment && !appointment.isCompleted && isCompletableStatus;
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
                                {appointment && !appointment.isCompleted && hasEnded && (
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
                                            {memberLoading && <div className="absolute right-3 top-3 text-white/50 animate-spin">âŒ›</div>}
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

                                {/* 2. Booked By Employee */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.bookedByEmployee')}</label>
                                    <div className="relative">
                                        <User className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                        <select
                                            required
                                            value={selectedCoachId}
                                            onChange={e => setSelectedCoachId(e.target.value)}
                                            className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none ${isRtl ? 'pr-11' : 'pl-11'}`}
                                        >
                                            <option value="">{t('appointments.selectEmployee')}</option>
                                            {coaches.map(c => (
                                                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                                            ))}
                                        </select>
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
                                                value={selectedDate}
                                                onChange={e => setSelectedDate(e.target.value)}
                                                className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 ${isRtl ? 'pr-11' : 'pl-11'}`}
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

                                {/* Display audit info */}
                                {appointment && (
                                    <div className="space-y-1">
                                        <div className="text-xs text-slate-400">
                                            {appointment?.createdByEmployee
                                                ? `${isArabic ? 'ØªÙ… Ø§Ù„Ø­Ø¬Ø² Ø¨ÙˆØ§Ø³Ø·Ø©:' : 'Booked by:'} ${appointment.createdByEmployee.firstName} ${appointment.createdByEmployee.lastName}`
                                                : `${isArabic ? 'ØªÙ… Ø§Ù„Ø­Ø¬Ø² Ø¨ÙˆØ§Ø³Ø·Ø©:' : 'Booked by:'} -`}
                                        </div>
                                        {appointment?.completedByEmployee && (
                                            <div className="text-xs text-slate-400">
                                                {`${isArabic ? 'ØªÙ… Ø§Ù„Ø¥ÙƒÙ…Ø§Ù„ Ø¨ÙˆØ§Ø³Ø·Ø©:' : 'Completed by:'} ${appointment.completedByEmployee.firstName} ${appointment.completedByEmployee.lastName}`}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 4. Start Time & 5. Duration */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.startTime')}</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="relative">
                                                <Clock className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                                <select
                                                    value={selectedHour}
                                                    onChange={(e) => {
                                                        const nextHour = e.target.value;
                                                        setSelectedHour(nextHour);
                                                        setSelectedTime(buildTimeFromParts(nextHour, selectedMinute, selectedPeriod));
                                                    }}
                                                    className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none ${isRtl ? 'pr-11' : 'pl-11'}`}
                                                >
                                                    {hourOptions.map(hour => (
                                                        <option key={hour} value={hour}>{hour}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    list="minute-options"
                                                    placeholder="00"
                                                    value={selectedMinute}
                                                    onChange={(e) => {
                                                        const next = e.target.value.replace(/\D/g, '').slice(0, 2);
                                                        setSelectedMinute(next);
                                                        setSelectedTime(buildTimeFromParts(selectedHour, next, selectedPeriod));
                                                    }}
                                                    onBlur={() => {
                                                        const parsed = parseInt(selectedMinute, 10);
                                                        if (Number.isNaN(parsed)) {
                                                            setSelectedMinute('00');
                                                            setSelectedTime(buildTimeFromParts(selectedHour, '00', selectedPeriod));
                                                            return;
                                                        }
                                                        const clamped = Math.min(59, Math.max(0, parsed));
                                                        const normalized = String(clamped).padStart(2, '0');
                                                        setSelectedMinute(normalized);
                                                        setSelectedTime(buildTimeFromParts(selectedHour, normalized, selectedPeriod));
                                                    }}
                                                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-center"
                                                />
                                                <datalist id="minute-options">
                                                    {minuteOptions.map(minute => (
                                                        <option key={minute} value={String(minute).padStart(2, '0')} />
                                                    ))}
                                                </datalist>
                                            </div>
                                            <select
                                                value={selectedPeriod}
                                                onChange={(e) => {
                                                    const nextPeriod = e.target.value;
                                                    setSelectedPeriod(nextPeriod);
                                                    setSelectedTime(buildTimeFromParts(selectedHour, selectedMinute, nextPeriod));
                                                }}
                                                className="w-full bg-slate-800 border border-white/5 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none"
                                            >
                                                <option value="AM">AM</option>
                                                <option value="PM">PM</option>
                                            </select>
                                        </div>
                                        {(() => {
                                            if (!selectedTime) {
                                                return <div className="text-xs text-rose-400">{i18n.language === 'ar' ? 'Ø§Ù„ÙˆÙ‚Øª Ù…Ø·Ù„ÙˆØ¨.' : 'Time is required.'}</div>;
                                            }
                                            if (!startTimeParsed) {
                                                return <div className="text-xs text-rose-400">{i18n.language === 'ar' ? 'ÙˆÙ‚Øª ØºÙŠØ± ØµØ§Ù„Ø­.' : 'Invalid time format.'}</div>;
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
                                                {i18n.language === 'ar' ? 'Ø§Ù„Ù…Ø¯Ø© ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† Ø¨ÙŠÙ† 1 Ùˆ 600 Ø¯Ù‚ÙŠÙ‚Ø©.' : 'Duration must be between 1 and 600 minutes.'}
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
                                        {i18n.language === 'ar' ? 'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø¶Ø§ÙØ© Ø­Ø¬Ø² ÙÙŠ ØªØ§Ø±ÙŠØ® Ø³Ø§Ø¨Ù‚.' : 'You canâ€™t create a booking in a past date.'}
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
