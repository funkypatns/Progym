import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isBefore, parseISO } from 'date-fns';
import { arEG, enUS } from 'date-fns/locale';
import { X, Search, Calendar, User, Clock, CheckCircle, AlertCircle, XCircle, Edit, DollarSign, Lock, Eye } from 'lucide-react';
import { formatTime } from '../../utils/dateFormatter';

export default function DayDetailsModal({ isOpen, onClose, date, appointments, readOnly, onStatusUpdate, onEdit }) {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    if (!isOpen) return null;

    const filtered = appointments.filter(apt => {
        const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
        const searchLower = search.toLowerCase();
        const matchesSearch = !search ||
            apt.member?.firstName?.toLowerCase().includes(searchLower) ||
            apt.member?.lastName?.toLowerCase().includes(searchLower) ||
            apt.member?.phone?.includes(searchLower) ||
            apt.member?.memberId?.toString().includes(searchLower);
        return matchesStatus && matchesSearch;
    });

    const filters = [
        { id: 'all', label: t('common.all') },
        { id: 'scheduled', label: t('appointments.scheduled') },
        { id: 'completed', label: t('appointments.completed') },
        { id: 'no_show', label: t('appointments.noShow') },
        { id: 'cancelled', label: t('appointments.cancelled') },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">
                            {format(date, 'EEEE, d MMMM', { locale: isRtl ? arEG : enUS })}
                        </h2>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{t('appointments.title')}</p>
                    </div>
                    {readOnly && (
                        <div className="flex items-center gap-1 text-amber-400 text-xs font-bold uppercase tracking-widest">
                            <Lock size={14} />
                            {t('appointments.readOnly', 'Read only')}
                        </div>
                    )}
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Controls */}
                <div className="p-4 border-b border-white/10 space-y-4 bg-slate-800/20">
                    <div className="relative">
                        <Search className={`absolute top-3 ${isRtl ? 'right-4' : 'left-4'} text-slate-500`} size={18} />
                        <input
                            type="text"
                            placeholder={t('common.search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 text-white focus:outline-none focus:border-blue-500 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {filters.map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => setStatusFilter(filter.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
                                    ${statusFilter === filter.id
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700'}
                                `}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filtered.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">
                            {t('appointments.noAppointments')}
                        </div>
                    ) : (
                        filtered.map(apt => (
                            <div key={apt.id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-white/5 rounded-xl hover:bg-slate-800 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold 
                                        ${apt.status === 'completed' || apt.status === 'auto_completed' ? 'bg-teal-500/20 text-teal-500' :
                                            apt.status === 'cancelled' ? 'bg-slate-700/50 text-slate-500 line-through' :
                                                apt.status === 'no_show' ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}
                                    `}>
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-sm">{formatTime(apt.start, i18n.language)}</span>
                                            <span className={`text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded
                                                ${apt.status === 'completed' || apt.status === 'auto_completed' ? 'bg-teal-500/10 text-teal-500' :
                                                    apt.status === 'cancelled' ? 'bg-slate-700 text-slate-400' :
                                                        apt.status === 'no_show' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}
                                            `}>
                                                {apt.status === 'auto_completed' ? 'AUTO' : apt.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                            <User size={10} />
                                            {apt.member?.firstName} {apt.member?.lastName}
                                            {apt.member?.phone && <span className="opacity-50">• {apt.member.phone}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    {(() => {
                                        const canComplete = !apt?.isCompleted && !['cancelled', 'no_show'].includes(apt.status);
                                        return canComplete ? (
                                            <>
                                                <button
                                                    onClick={(e) => onStatusUpdate(e, apt, 'completed')}
                                                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-500 rounded-lg transition"
                                                    title={t('appointments.markCompleted')}
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            </>
                                        ) : null;
                                    })()}
                                    {!readOnly && (apt.status === 'scheduled' || apt.status === 'pending') && (
                                        <>
                                            <button
                                                onClick={(e) => onStatusUpdate(e, apt, 'no_show')}
                                                className="p-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg transition"
                                                title={t('appointments.noShow')}
                                            >
                                                <AlertCircle size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => onStatusUpdate(e, apt, 'cancelled')}
                                                className="p-2 bg-slate-700/50 hover:bg-slate-700 hover:text-white text-slate-400 rounded-lg transition"
                                                title={t('appointments.cancelAppointment')}
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => onEdit(apt)}
                                        className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                                        title={readOnly ? t('common.view', 'View') : t('common.edit')}
                                    >
                                        {readOnly ? <Eye size={16} /> : <Edit size={16} />}
                                    </button>

                                    {/* Quick Settle Button */}
                                    {apt.status === 'completed' && apt.financialRecord?.status === 'PAID' && (
                                        <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-bold text-green-500 uppercase tracking-wider ml-1">
                                            SETTLED
                                        </div>
                                    )}
                                    {!readOnly && apt.status === 'completed' && apt.coachId && apt.financialRecord?.status !== 'PAID' && (
                                        <button
                                            onClick={(e) => onStatusUpdate(e, apt, 'settle')}
                                            className="p-2 bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-500 rounded-lg transition ml-1"
                                            title="Settle Coach Payout"
                                        >
                                            <DollarSign size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
