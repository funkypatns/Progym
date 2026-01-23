import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar, User, CreditCard, Clock, RotateCw, RefreshCw,
    Search, UserCircle, XCircle, PauseCircle, PlayCircle, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import apiClient from '../utils/api';
import toast from 'react-hot-toast';
import MemberDetailsModal from './MemberDetailsModal';

const SubscriptionsList = ({ subscriptions, onRenew, onRefresh }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [freezeLoading, setFreezeLoading] = useState(null);
    const [detailMemberId, setDetailMemberId] = useState(null);

    const handleFreezeToggle = async (sub) => {
        setFreezeLoading(sub.id);
        try {
            await apiClient.put(`/subscriptions/${sub.id}/toggle-pause`);
            toast.success(sub.isPaused ? "Subscription Resumed" : "Subscription Frozen");
            if (onRefresh) onRefresh();
        } catch (error) {
            toast.error("Failed to update status");
        } finally {
            setFreezeLoading(null);
        }
    };

    const filtered = subscriptions.filter(s =>
        (s.member?.firstName + ' ' + s.member?.lastName).toLowerCase().includes(search.toLowerCase()) ||
        (s.member?.memberId || '').toLowerCase().includes(search.toLowerCase())
    );

    const getStatusConfig = (sub) => {
        if (sub.isPaused) return { label: 'Paused', color: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400' };
        if (sub.status === 'active') return { label: 'Active', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' };
        if (sub.status === 'expired') return { label: 'Expired', color: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400' };
        if (sub.status === 'cancelled') return { label: 'Cancelled', color: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400' };
        return { label: sub.status, color: 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800' };
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden" dir="rtl">
            {/* Toolbar */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <div className="relative w-full max-w-md">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        className="w-full pr-11 pl-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                        placeholder={t('common.search') + " (Name / ID)..."}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Structured Table UI */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[25%]">{t('nav.members')}</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[20%]">Plan & Billing</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[18%]">Subscription Dates</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[17%]">Time Remaining</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[20%]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filtered.map(sub => {
                            const status = getStatusConfig(sub);
                            const price = sub.price || sub.plan?.price || 0;
                            const paid = sub.paidAmount || 0;

                            // Payment Status Label
                            let payStatus = "Unpaid";
                            if (paid >= price) payStatus = "Paid";
                            else if (paid > 0) payStatus = "Partial";

                            // Determine if Renew is active
                            const canRenew = sub.status === 'expired' || sub.status === 'cancelled' || sub.daysRemaining < 30;

                            return (
                                <motion.tr
                                    key={sub.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-all border-b border-slate-100 dark:border-slate-800"
                                >
                                    {/* 1. Member Section (Primary Anchor) */}
                                    <td className="px-6 py-8">
                                        <div className="flex items-center gap-4">
                                            <div className="relative shrink-0">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                                                    <UserCircle size={28} strokeWidth={1.5} />
                                                </div>
                                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${sub.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'} shadow-sm`} />
                                            </div>
                                            <div className="flex flex-col gap-1.5 min-w-0 text-right">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate max-w-[200px]">
                                                        {sub.member?.firstName} {sub.member?.lastName}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase rounded-md border border-indigo-100/50 tracking-widest">
                                                            {sub.plan?.name}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm ${status.color}`}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(sub.member?.memberId);
                                                        toast.success('Member ID copied');
                                                    }}
                                                    className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter bg-slate-100/50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md border border-slate-200/50 w-fit hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                                    title="Click to copy ID"
                                                >
                                                    #{sub.member?.memberId}
                                                </button>
                                            </div>
                                        </div>
                                    </td>

                                    {/* 2. Subscription Info (Plan & Billing) */}
                                    <td className="px-6 py-8">
                                        <div className="flex flex-col gap-2 text-center items-center">
                                            <div className="flex items-baseline gap-1.5 justify-center">
                                                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                                                    {price.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">EGP</span>
                                            </div>
                                            <div className="flex items-center gap-2 justify-center">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${payStatus === 'Paid' ? 'text-emerald-600' : payStatus === 'Partial' ? 'text-blue-500' : 'text-rose-500'}`}>
                                                    {payStatus}
                                                </span>
                                                <div className={`w-1.5 h-1.5 rounded-full ${payStatus === 'Paid' ? 'bg-emerald-500' : payStatus === 'Partial' ? 'bg-blue-500' : 'bg-rose-500'} shadow-sm`} />
                                            </div>
                                        </div>
                                    </td>

                                    {/* 3. Dates Section (Stacked) */}
                                    <td className="px-6 py-8">
                                        <div className="flex flex-col gap-2.5 text-center items-center">
                                            <div className="flex items-center gap-3 justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                <div className="flex flex-col leading-none">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">Start</span>
                                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                        {new Date(sub.startDate).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400/50 shadow-sm" />
                                                <div className="flex flex-col leading-none">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">End</span>
                                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 underline decoration-rose-500/20 underline-offset-4">
                                                        {new Date(sub.endDate).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* 4. Time Remaining (Compact Pill) */}
                                    <td className="px-6 py-8">
                                        <div className="flex justify-center">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100/50 shadow-sm transition-all group-hover:bg-emerald-100/50 dark:group-hover:bg-emerald-900/20">
                                                <Clock size={14} className="text-emerald-500/70" />
                                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                    {sub.daysRemaining}
                                                </span>
                                                <span className="text-[9px] font-black text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-tighter">days left</span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* 5. Actions Section */}
                                    <td className="px-6 py-8">
                                        <div className="flex items-center justify-center gap-2">
                                            {/* Freeze Toggle */}
                                            {sub.status !== 'cancelled' && sub.status !== 'expired' && (
                                                <button
                                                    onClick={() => handleFreezeToggle(sub)}
                                                    disabled={freezeLoading === sub.id}
                                                    className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 dark:hover:border-indigo-900 shadow-sm transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                                                    title={sub.isPaused ? t('subscriptions.resume') : t('subscriptions.freeze')}
                                                >
                                                    {freezeLoading === sub.id ? (
                                                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                    ) : sub.isPaused ? (
                                                        <PlayCircle size={20} strokeWidth={2} />
                                                    ) : (
                                                        <PauseCircle size={20} strokeWidth={2} />
                                                    )}
                                                </button>
                                            )}

                                            {/* Renew */}
                                            <button
                                                onClick={() => onRenew(sub)}
                                                disabled={!canRenew && sub.status !== 'cancelled'}
                                                className={`p-3 border rounded-2xl shadow-sm transition-all hover:scale-110 active:scale-95 ${canRenew || sub.status === 'cancelled'
                                                    ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-200'
                                                    : 'bg-slate-50 dark:bg-slate-900/50 border-transparent text-slate-300 cursor-not-allowed'
                                                    }`}
                                                title={t('subscriptions.renew')}
                                            >
                                                <RefreshCw size={20} strokeWidth={2} className={canRenew ? 'animate-in spin-in-12 duration-700' : ''} />
                                            </button>

                                            {/* Details */}
                                            <button
                                                onClick={() => setDetailMemberId(sub.memberId)}
                                                className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all hover:scale-110 active:scale-95"
                                                title={t('common.details')}
                                            >
                                                <Eye size={20} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            );
                        })}

                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3 opacity-20 text-right">
                                        <XCircle size={64} className="text-slate-400" />
                                        <p className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">No Subscriptions Found</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <MemberDetailsModal
                isOpen={!!detailMemberId}
                onClose={() => setDetailMemberId(null)}
                memberId={detailMemberId}
            />
        </div>
    );
};

export default SubscriptionsList;
