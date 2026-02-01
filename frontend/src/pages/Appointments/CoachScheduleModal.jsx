import React, { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Calendar, Clock } from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, isSameDay, parseISO } from 'date-fns';
import apiClient from '../../utils/api';

const CoachScheduleModal = ({ open, onClose, coachId, coachName }) => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);

    // Range: Today to +7 days
    const startDate = new Date();
    const endDate = addDays(startDate, 7);
    const dayList = [];
    for (let i = 0; i <= 7; i++) {
        dayList.push(addDays(startDate, i));
    }

    useEffect(() => {
        if (open && coachId) {
            fetchSchedule();
        }
    }, [open, coachId]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const from = startOfDay(startDate).toISOString();
            const to = endOfDay(endDate).toISOString();
            const res = await apiClient.get(`/appointments/availability?coachId=${coachId}&from=${from}&to=${to}`);
            if (res.data.success) {
                setBookings(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch schedule');
        } finally {
            setLoading(false);
        }
    };

    const getBookingsForDay = (date) => {
        return bookings.filter(b => isSameDay(parseISO(b.start), date));
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-xl transition-all">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <Dialog.Title as="h3" className="text-lg font-black text-white uppercase tracking-tight">
                                        Coach Schedule
                                    </Dialog.Title>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                        {coachName} (Next 7 Days)
                                    </p>
                                </div>
                                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                {loading ? (
                                    <div className="text-center py-8 text-slate-500">Loading schedule...</div>
                                ) : (
                                    dayList.map((day) => {
                                        const dayBookings = getBookingsForDay(day);
                                        const isToday = isSameDay(day, new Date());

                                        return (
                                            <div key={day.toISOString()} className={`p-4 rounded-xl border ${isToday ? 'bg-blue-900/10 border-blue-500/30' : 'bg-slate-800/50 border-white/5'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={14} className={isToday ? 'text-blue-400' : 'text-slate-500'} />
                                                        <span className={`text-sm font-bold ${isToday ? 'text-blue-200' : 'text-slate-300'}`}>
                                                            {format(day, 'EEEE, MMM d')}
                                                        </span>
                                                    </div>
                                                    {isToday && <span className="text-[10px] font-black uppercase bg-blue-500 text-white px-2 py-0.5 rounded-full">Today</span>}
                                                </div>

                                                {dayBookings.length === 0 ? (
                                                    <div className="text-xs text-slate-600 italic pl-6">No bookings</div>
                                                ) : (
                                                    <div className="space-y-2 pl-6 border-l border-white/5 ml-1.5">
                                                        {dayBookings.map((b, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                                                                <Clock size={12} />
                                                                <span className="font-mono text-slate-300">
                                                                    {format(parseISO(b.start), 'HH:mm')} - {format(parseISO(b.end), 'HH:mm')}
                                                                </span>
                                                                <span className="text-slate-500">(Booked)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-slate-500">
                                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                                <span>Grey times are already booked</span>
                            </div>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default CoachScheduleModal;
