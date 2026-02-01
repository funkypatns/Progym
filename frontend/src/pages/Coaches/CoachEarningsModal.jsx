import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Calendar, DollarSign, Download, CheckCircle, AlertCircle } from 'lucide-react';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

const CoachEarningsModal = ({ open, onClose, coach, onRequestPayout }) => {
    const [loading, setLoading] = useState(false);
    const [earningsData, setEarningsData] = useState(null);
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    // Settlement State
    const [settling, setSettling] = useState(false);

    useEffect(() => {
        if (open && coach) {
            fetchEarnings();
        }
    }, [open, coach, startDate, endDate]);

    const fetchEarnings = async () => {
        if (!coach?.id) {
            setEarningsData({
                summary: { sessionsCount: 0, totalEarnings: 0, pendingEarnings: 0, paidEarnings: 0 },
                rows: []
            });
            return;
        }
        setLoading(true);
        try {
            const res = await apiClient.get(`/staff-trainers/${coach.id}/earnings`, {
                params: { startDate, endDate }
            });
            if (res.data.success) {
                setEarningsData(res.data.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch earnings');
        } finally {
            setLoading(false);
        }
    };

    const handleSettle = async () => {
        const pendingAmount = earningsData?.summary?.pendingEarnings || 0;

        if (pendingAmount <= 0) {
            toast.error('No pending earnings to settle');
            return;
        }

        if (typeof onRequestPayout !== 'function') {
            toast.error('Payout modal is not available');
            return;
        }

        setSettling(true);
        try {
            onRequestPayout(coach);
        } finally {
            setSettling(false);
        }
    };

    const summary = earningsData?.summary || {
        sessionsCount: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        paidEarnings: 0
    };
    const earnings = earningsData?.earnings || earningsData?.rows || [];

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl transition-all flex flex-col max-h-[90vh]">

                            {/* Header */}
                            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900">
                                <div>
                                    <Dialog.Title as="h3" className="text-xl font-black text-white uppercase tracking-tight">
                                        Earnings Report
                                    </Dialog.Title>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                        {coach?.name || `${coach?.firstName || ''} ${coach?.lastName || ''}`.trim()}
                                    </p>
                                </div>
                                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Filters & Stats */}
                            <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 bg-slate-900/50">
                                {/* Date Range */}
                                <div className="lg:col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Period</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-white text-sm w-full"
                                        />
                                        <span className="text-slate-500">-</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            className="bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-white text-sm w-full"
                                        />
                                    </div>
                                </div>

                                {/* Stats Cards */}
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-center">
                                    <span className="text-xs font-bold text-emerald-400 uppercase">Total Commission</span>
                                    <span className="text-2xl font-black text-white">{summary.totalEarnings?.toLocaleString() || 0}</span>
                                    <span className="text-[10px] text-slate-500 mt-1">{summary.sessionsCount} sessions</span>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-center relative overflow-hidden">
                                    <span className="text-xs font-bold text-amber-400 uppercase">Pending Payout</span>
                                    <span className="text-2xl font-black text-white">{summary.pendingEarnings?.toLocaleString() || 0}</span>
                                    {summary.pendingEarnings > 0 && (
                                        <button
                                            onClick={handleSettle}
                                            disabled={settling}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-amber-500 text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg hover:bg-amber-400 transition"
                                        >
                                            {settling ? '...' : 'Settle'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-auto p-0">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-800 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-white/5">Date</th>
                                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-white/5">Customer</th>
                                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-white/5">Session</th>
                                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-white/5 text-right">Base Amount</th>
                                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-white/5 text-right">Rule</th>
                                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-white/5 text-right">Commission</th>
                                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-white/5 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {loading ? (
                                            <tr><td colSpan="7" className="p-8 text-center text-slate-500">Loading...</td></tr>
                                        ) : earnings.map(item => (
                                            <tr key={item.id} className="hover:bg-white/5 transition group">
                                                <td className="p-4 text-sm text-slate-300">
                                                    {format(parseISO(item.date), 'yyyy-MM-dd')}
                                                </td>
                                                <td className="p-4 text-sm text-white">
                                                    {item.customerName}
                                                </td>
                                                <td className="p-4 text-sm font-bold text-white">
                                                    <div className="text-blue-400">{item.sourceRef}</div>
                                                    {item.appointmentId && <div className="text-xs text-slate-500">#{item.appointmentId}</div>}
                                                </td>
                                                <td className="p-4 text-sm text-slate-300 text-right font-mono">
                                                    {item.basisAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-4 text-sm text-right">
                                                    <div className="font-bold text-slate-300">{item.ruleText}</div>
                                                </td>
                                                <td className="p-4 text-sm font-bold text-emerald-400 text-right">
                                                    +{item.earningAmount?.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${item.status === 'paid'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-amber-500/10 text-amber-400'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {earnings.length === 0 && !loading && (
                                            <tr><td colSpan="7" className="p-8 text-center text-slate-500">No earnings found in this period.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default CoachEarningsModal;
