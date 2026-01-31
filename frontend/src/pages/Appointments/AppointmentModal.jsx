import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, User, Calendar, Clock, DollarSign, Activity, Eye, CheckCircle } from 'lucide-react';
import apiClient, { getStaffTrainers } from '../../utils/api';
import toast from 'react-hot-toast';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, addMinutes, isBefore, isAfter } from 'date-fns';
import { formatTime } from '../../utils/dateFormatter';
import CoachScheduleModal from './CoachScheduleModal';
import CompletionPreviewModal from './CompletionPreviewModal';
import ReceiptModal from '../../components/payments/ReceiptModal';

const AppointmentModal = ({ open, onClose, onSuccess, appointment, initialDate, autoCompleteTriggerId, onAutoCompleteTriggered }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';

    // Form State
    const [memberSearch, setMemberSearch] = useState('');
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [coaches, setCoaches] = useState([]);
    const [selectedCoachId, setSelectedCoachId] = useState('');
    const [trainers, setTrainers] = useState([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState('');
    const [trainerLoading, setTrainerLoading] = useState(false);

    const [services, setServices] = useState([]);

    // Split Date/Time State
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedTime, setSelectedTime] = useState('09:00');
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
            fetchCoaches();
            fetchTrainerOptions();
            fetchServices();
            if (appointment) {
                // Edit Mode
                setSelectedMember(appointment.member);
            setSelectedCoachId(appointment.coachId?.toString());
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
            setSelectedCoachId('');
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
        const match = value.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
        if (!match) return null;
        const hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        if (minute < 0 || minute > 59) return null;
        if (hour < 0 || hour > 12) return null;
        return { hour, minute };
    };

    const normalizeTimeString = ({ hour, minute }) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

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

    const isPastSelection = useMemo(() => currentStart ? currentStart < new Date() : false, [currentStart]);

    const durationValid = durationNumber !== null && durationNumber >= 1 && durationNumber <= 600;
    const isArabic = (i18n.language || '').startsWith('ar');

    const timeError = useMemo(() => {
        if (!selectedTime) return isArabic ? 'الوقت مطلوب.' : 'Time is required.';
        if (!startTimeParsed) return isArabic ? 'وقت غير صالح.' : 'Invalid time format.';
        if (startTimeParsed.hour === 12 && startTimeParsed.minute > 0) {
            return isArabic ? 'الوقت يجب أن يكون بين 00:00 و 12:00.' : 'Time must be between 00:00 and 12:00.';
        }
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


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!selectedMember) {
                toast.error('Please select a member');
                return;
            }
            if (!selectedCoachId) {
                toast.error('Please select a coach');
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
        if (!appointment) return;
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

    const isSubmitDisabled = loading || isOverlapping || isPastSelection || validationError;

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
                                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">

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

                                {/* 2. Coach Select + Show Schedule Button */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.coach')}</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <User className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                            <select
                                                required
                                                value={selectedCoachId}
                                                onChange={e => setSelectedCoachId(e.target.value)}
                                                className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none ${isRtl ? 'pr-11' : 'pl-11'}`}
                                            >
                                                <option value="">{t('appointments.selectCoach')}</option>
                                                {coaches.map(c => (
                                                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                                                ))}
                                            </select>
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
                                                ? `${isArabic ? 'تم الحجز بواسطة:' : 'Booked by:'} ${appointment.createdByEmployee.firstName} ${appointment.createdByEmployee.lastName}`
                                                : `${isArabic ? 'تم الحجز بواسطة:' : 'Booked by:'} -`}
                                        </div>
                                        {appointment?.completedByEmployee && (
                                            <div className="text-xs text-slate-400">
                                                {`${isArabic ? 'تم الإكمال بواسطة:' : 'Completed by:'} ${appointment.completedByEmployee.firstName} ${appointment.completedByEmployee.lastName}`}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 4. Start Time & 5. Duration */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">{t('appointments.startTime')}</label>
                                        <div className="relative">
                                            <Clock className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                            <input
                                                type="text"
                                                placeholder={isRtl ? 'اكتب الوقت (مثال 10:15)' : 'Enter time (e.g., 10:15)'}
                                                value={selectedTime}
                                                onChange={e => setSelectedTime(e.target.value)}
                                                onBlur={() => {
                                                    const parsed = parseTimeInput(selectedTime);
                                                    if (parsed) {
                                                        setSelectedTime(normalizeTimeString(parsed));
                                                    }
                                                }}
                                                className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 ${isRtl ? 'pr-11' : 'pl-11'}`}
                                            />
                                        </div>
                                        {(() => {
                                            if (!selectedTime) {
                                                return <div className="text-xs text-rose-400">{i18n.language === 'ar' ? 'الوقت مطلوب.' : 'Time is required.'}</div>;
                                            }
                                            if (!startTimeParsed) {
                                                return <div className="text-xs text-rose-400">{i18n.language === 'ar' ? 'وقت غير صالح.' : 'Invalid time format.'}</div>;
                                            }
                                            if (startTimeParsed.hour === 12 && startTimeParsed.minute > 0) {
                                                return <div className="text-xs text-rose-400">{i18n.language === 'ar' ? 'الوقت يجب أن يكون بين 00:00 و 12:00.' : 'Time must be between 00:00 and 12:00.'}</div>;
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
                                                {i18n.language === 'ar' ? 'المدة يجب أن تكون بين 1 و 600 دقيقة.' : 'Duration must be between 1 and 600 minutes.'}
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
                                        {i18n.language === 'ar' ? 'لا يمكن إضافة حجز في تاريخ سابق.' : 'You can’t create a booking in a past date.'}
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
                                    <label className="text-xs font-bold text-slate-500 uppercase">{i18n.language === 'ar' ? 'المدرب' : 'Trainer'}</label>
                                    <div className="relative">
                                        <User className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                                        <select
                                            value={selectedTrainerId}
                                            onChange={e => setSelectedTrainerId(e.target.value)}
                                            className={`w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 ${isRtl ? 'pr-11' : 'pl-11'}`}
                                        >
                                            <option value="">{i18n.language === 'ar' ? 'اختر المدرب' : 'Select trainer'}</option>
                                        {trainers.map(trainer => (
                                                <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
                                            ))}
                                        </select>
                                        {trainerLoading && <div className="absolute right-3 top-3 text-white/50 animate-spin">âŒ›</div>}
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

                                {/* 9. Confirm Booking Button */}
                                <div className="flex items-center gap-3 pt-4">
                                    {appointment && (
                                        <>
                                            {/* Show for any status NOT completed/cancelled */}
                                            {!['completed', 'auto_completed', 'cancelled', 'no_show'].includes((appointment.status || '').toLowerCase()) && (
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
                                            <button
                                                type="button"
                                                onClick={handleCancel}
                                                className="px-6 py-3 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-xl font-bold transition flex-1 whitespace-nowrap"
                                            >
                                                {t('appointments.cancelAppointment')}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={isSubmitDisabled}
                                        className={`px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex-[2] flex items-center justify-center gap-2 ${isSubmitDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {loading ? t('appointments.saving') : (appointment ? t('appointments.update') : t('appointments.confirmBooking'))}
                                    </button>
                                </div>
                            </form>
                        </Dialog.Panel>
                    </div>
                </div>

                {/* Sub Modal: Schedule */}
                <CoachScheduleModal
                    open={showSchedule}
                    onClose={() => setShowSchedule(false)}
                    coachId={selectedCoachId}
                    coachName={coaches.find(c => c.id == selectedCoachId)?.firstName || 'Coach'}
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
