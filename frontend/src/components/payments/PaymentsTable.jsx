import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Trash2, ChevronLeft, ChevronRight, Download, XCircle, Banknote, RotateCcw, PauseCircle, Clock, ChevronDown, ChevronUp, History, User } from 'lucide-react';
import api from '../../utils/api';
import { formatDate, formatTime } from '../../utils/dateFormatter';
import AddPaymentDialog from './AddPaymentDialog';
import RefundSummaryModal from '../RefundSummaryModal';

const PaymentsTable = ({ payments, loading, onViewReceipt, onDelete, onRefresh }) => {
    const { t, i18n } = useTranslation();
    const [currentPage, setCurrentPage] = useState(1);
    const [filter, setFilter] = useState('');
    const [expandedGroups, setExpandedGroups] = useState({});
    const itemsPerPage = 8;
    // Modal & Action States
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    // --- Data Grouping Logic ---
    const groupedData = useMemo(() => {
        if (!Array.isArray(payments)) return [];

        const groups = {};

        payments.forEach(payment => {
            const subId = payment.subscription?.id;
            const aptId = payment.appointment?.id;

            const groupId = subId
                ? `sub-${subId}`
                : `pay-${payment.id}`;

            if (!groups[groupId]) {
                if (subId) {
                    const sub = payment.subscription;
                    const total = sub.price ?? sub.plan?.price ?? 0;
                    const paid = sub.paidAmount || 0;
                    const remaining = Math.max(0, total - paid);

                    let status = 'DUE';
                    if (paid >= total && remaining === 0) status = 'PAID';
                    else if (paid > 0 && remaining > 0) status = 'PARTIAL';
                    if (sub.paymentStatus === 'refunded') status = 'REFUNDED';

                    let daysRemaining = 0;
                    if (sub.endDate) {
                        const end = new Date(sub.endDate);
                        const now = new Date();
                        daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
                    }

                    groups[groupId] = {
                        type: 'subscription',
                        uniqueId: groupId,
                        subscription: sub,
                        member: payment.member,
                        payments: [],
                        total,
                        paid,
                        remaining,
                        status,
                        daysRemaining,
                        isPaused: sub.isPaused,
                        lastPaymentDate: payment.createdAt || payment.date,
                        canPay: true,
                        canRefund: true
                    };
                } else if (aptId) {
                    // Appointment Logic
                    const apt = payment.appointment;
                    const total = apt.price || 0;
                    const paid = apt.paidAmount || 0;
                    const remaining = Math.max(0, total - paid);

                    let status = 'DUE';
                    if (paid >= total - 0.01) status = 'PAID';
                    else if (paid > 0) status = 'PARTIAL';

                    // Allow Manual Override status if present? No, calculate it.

                    groups[groupId] = {
                        type: 'appointment',
                        uniqueId: groupId,
                        subscription: { // Mock for UI compatibility
                            id: aptId,
                            plan: { name: apt.title || 'Service Session' },
                            status: apt.paymentStatus,
                            canceledAt: null,
                            refundedAmount: 0
                        },
                        member: payment.member,
                        payments: [],
                        total,
                        paid,
                        remaining,
                        status: status,
                        daysRemaining: 0,
                        isPaused: false,
                        lastPaymentDate: payment.createdAt || payment.date,
                        canPay: false, // Disable Pay from here for now
                        canRefund: false // Disable Refund from here for now
                    };
                } else {
                    // General / Misc Payment Logic (Orphan)
                    groups[groupId] = {
                        type: 'general',
                        uniqueId: groupId,
                        subscription: { // Mock
                            id: 0,
                            plan: { name: 'General Payment' },
                            status: 'completed',
                            canceledAt: null,
                            refundedAmount: 0
                        },
                        member: payment.member,
                        payments: [],
                        total: 0, // Will sum up from payments
                        paid: 0,
                        remaining: 0,
                        status: 'PAID',
                        daysRemaining: 0,
                        isPaused: false,
                        lastPaymentDate: payment.createdAt || payment.date,
                        canPay: false,
                        canRefund: false
                    };
                }
            }

            groups[groupId].payments.push(payment);
            if (new Date(payment.createdAt) > new Date(groups[groupId].lastPaymentDate)) {
                groups[groupId].lastPaymentDate = payment.createdAt;
            }

            // Accumulate totals for general group
            if (!subId && !aptId) {
                groups[groupId].total += (parseFloat(payment.amount) || 0);
                groups[groupId].paid += (parseFloat(payment.amount) || 0);
            }
        });

        return Object.values(groups).sort((a, b) => new Date(b.lastPaymentDate) - new Date(a.lastPaymentDate));
    }, [payments]);

    const filteredGroups = groupedData.filter(g =>
        (g.member?.firstName || '').toLowerCase().includes(filter.toLowerCase()) ||
        (g.member?.lastName || '').toLowerCase().includes(filter.toLowerCase()) ||
        (g.subscription?.id || '').toString().includes(filter)
    );

    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
    const paginatedGroups = filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const toggleExpand = (id) => {
        setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const normalizeMethod = (method) => {
        if (!method) return 'cash';
        const m = method.toString().toLowerCase();
        if (m.includes('card') || m.includes('visa')) return 'card';
        if (m.includes('transfer') || m.includes('bank')) return 'transfer';
        return 'cash';
    };

    const handlePayClick = (group) => {
        setSelectedItem({ id: group.subscription.id, member: group.member });
        setPayModalOpen(true);
    };

    const handleRefundClick = (group) => {
        setSelectedItem({ id: group.subscription.id, member: group.member, isRefund: true });
        setRefundModalOpen(true);
    };

    const handleSuccess = () => {
        if (onRefresh) onRefresh();
    };

    if (loading) return (
        <div className="p-8 text-center text-slate-500">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="font-medium">{t('common.loading')}</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
            {/* Toolbar */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="relative w-full max-w-sm">
                    <input
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                        placeholder={t('common.search') + "..."}
                        value={filter}
                        onChange={e => { setFilter(e.target.value); setCurrentPage(1); }}
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Eye size={18} />
                    </div>
                </div>
                <button className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600 shadow-sm transition-all active:scale-95">
                    <Download size={18} /> {t('common.export')}
                </button>
            </div>

            {/* Structured Table UI */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                            <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest w-[25%]">{t('nav.members')}</th>
                            <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest w-[40%]">Accounting Summary</th>
                            <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest w-[15%]">Timing</th>
                            <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest w-[20%]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {paginatedGroups.map(group => {
                            const isExpanded = expandedGroups[group.uniqueId];
                            const hasHistory = group.payments && group.payments.length > 0;
                            const subscriptionStatus = String(group.subscription?.status || '').toLowerCase();
                            const isCancelled = ['cancelled', 'canceled', 'terminated'].includes(subscriptionStatus);
                            const cancelledAt = group.subscription?.canceledAt ? new Date(group.subscription.canceledAt) : null;
                            const showBalanceFields = group.type === 'subscription';
                            const trainerPayment = group.payments?.find(p => p.appointment?.trainer)
                                || group.payments?.find(p => p.appointment?.coach)
                                || null;
                            const trainerName = trainerPayment?.appointment?.trainer?.name
                                || (trainerPayment?.appointment?.coach
                                    ? `${trainerPayment.appointment.coach.firstName} ${trainerPayment.appointment.coach.lastName}`.trim()
                                    : null);
                            const summaryItems = showBalanceFields
                                ? [
                                    { label: 'Total', val: group.total, color: 'text-slate-600 dark:text-slate-400' },
                                    { label: 'Paid', val: group.paid, color: 'text-emerald-600' },
                                    { label: 'Refunded', val: group.subscription.refundedAmount || 0, color: 'text-rose-500' },
                                    { label: 'Due', val: group.remaining, color: group.remaining > 0 ? 'text-rose-600' : 'text-slate-400', bold: true, highlight: group.remaining > 0 }
                                ]
                                : [
                                    { label: 'Total', val: group.total, color: 'text-slate-600 dark:text-slate-400' },
                                    { label: 'Paid', val: group.paid, color: 'text-emerald-600' }
                                ];

                            return (
                                <React.Fragment key={group.uniqueId}>
                                    <tr className={`group transition-all hover:bg-blue-50/30 dark:hover:bg-blue-900/10 ${isExpanded ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''}`}>

                                        {/* 1. Member Column */}
                                        <td className="px-6 py-5">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                                                    <User size={20} />
                                                </div>
                                                <div className="flex flex-col gap-1 overflow-hidden">
                                                    <span className="font-bold text-slate-900 dark:text-white truncate text-base leading-tight">
                                                        {group.member?.firstName} {group.member?.lastName}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-mono">#{group.member?.memberId}</span>
                                                    {trainerName && (
                                                        <span className="text-[10px] text-slate-400">
                                                            {t('payments.sessionCoach', 'Trainer')}: {trainerName}
                                                        </span>
                                                    )}
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase rounded-md border border-indigo-100/50">
                                                            {group.subscription.plan?.name}
                                                        </span>
                                                        {isCancelled && (
                                                            <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase rounded-md border border-rose-100/50">
                                                                {t('common.cancelled', 'CANCELLED')}
                                                            </span>
                                                        )}
                                                        {group.isPaused && (
                                                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase rounded-md border border-amber-100/50 flex items-center gap-1">
                                                                <PauseCircle size={10} /> Frozen
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isCancelled && cancelledAt && (
                                                        <span className="text-[10px] font-bold text-rose-500">
                                                            {t('common.cancelled', 'Cancelled')}: {formatDate(cancelledAt, i18n.language)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* 2. Accounting Summary Column */}
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-3 max-w-sm">
                                                {/* Status Badge */}
                                                <div className="flex justify-end">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border-2 shadow-sm
                                                        ${group.status === 'REFUNDED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                            group.status === 'DUE' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                group.status === 'PARTIAL' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                                                                    'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                        {group.status === 'PAID' ? t('common.paid', 'PAID') :
                                                            group.status === 'PARTIAL' ? t('common.partial', 'PARTIAL') :
                                                                group.status === 'DUE' ? t('common.unpaid', 'DUE') :
                                                                    group.status === 'REFUNDED' ? t('common.refunded', 'REFUNDED') : group.status}
                                                    </span>
                                                </div>

                                                {/* Financial Grid */}
                                                <div className={`grid ${summaryItems.length === 4 ? 'grid-cols-4' : 'grid-cols-2'} gap-1 p-1 bg-slate-100/50 dark:bg-slate-900/30 rounded-xl border border-slate-200/50 dark:border-slate-700/50`}>
                                                    {summaryItems.map((item, i) => (
                                                        <div key={i} className={`flex flex-col items-center py-2 px-1 rounded-lg ${item.highlight ? 'bg-white dark:bg-slate-800 shadow-sm' : ''}`}>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                                                            <span className={`text-sm font-bold ${item.color} ${item.bold ? 'text-base' : ''}`}>
                                                                {item.val.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>

                                        {/* 3. Timing Column */}
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Activity</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                        {formatDate(group.lastPaymentDate, i18n.language)}
                                                    </span>
                                                </div>
                                                {group.daysRemaining > 0 && group.status !== 'REFUNDED' && (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md self-start border border-emerald-100/50">
                                                        <Clock size={12} /> {group.daysRemaining} Days
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 4. Actions Column */}
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {/* History Toggle */}
                                                <button
                                                    onClick={() => toggleExpand(group.uniqueId)}
                                                    className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                                                    title="Transaction History"
                                                >
                                                    <History size={20} />
                                                </button>

                                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                                                {/* Pay Action */}
                                                {group.canPay && group.remaining > 0 && group.status !== 'REFUNDED' && (
                                                    <button
                                                        onClick={() => handlePayClick(group)}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all active:scale-95"
                                                        title="Pay Remaining"
                                                    >
                                                        <Banknote size={22} />
                                                    </button>
                                                )}

                                                {/* Refund Action */}
                                                {group.canRefund && group.paid > 0 && group.status !== 'REFUNDED' && (
                                                    <button
                                                        onClick={() => handleRefundClick(group)}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-95"
                                                        title="Process Refund"
                                                    >
                                                        <RotateCcw size={22} />
                                                    </button>
                                                )}

                                                {/* Delete Action */}
                                                <button
                                                    onClick={() => onDelete && onDelete(group.payments[0]?.id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-95"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expandable History Row */}
                                    {isExpanded && (
                                        <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b dark:border-slate-700">
                                            <td colSpan="4" className="px-8 py-6">
                                                <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                            <History size={14} /> Transaction History
                                                        </h4>
                                                        <span className="text-[10px] font-bold text-slate-400">{group.payments.length} Transactions Found</span>
                                                    </div>

                                                    <div className="grid gap-3">
                                                        {group.payments.map((p, idx) => (
                                                            <div key={p.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-[10px] font-black text-slate-300 w-6">#{idx + 1}</div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                            {formatDate(p.createdAt || p.date, i18n.language)}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-slate-400">
                                                                            {formatTime(p.createdAt || p.date, i18n.language)}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-4">
                                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight
                                                                        ${normalizeMethod(p.method) === 'cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                                                                        {t(`payments.${normalizeMethod(p.method)}`)}
                                                                    </span>
                                                                    <div className={`text-sm font-black w-24 text-left ${parseFloat(p.amount) < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                                        {parseFloat(p.amount) < 0 ? '' : '+'}{parseFloat(p.amount).toLocaleString()} EGP
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <button onClick={() => onViewReceipt(p)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="View Receipt">
                                                                            <Eye size={18} />
                                                                        </button>
                                                                        <button onClick={() => onDelete(p.id)} className="p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all" title="Delete">
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {paginatedGroups.length === 0 && (
                            <tr>
                                <td colSpan="4" className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3 opacity-20">
                                        <XCircle size={64} className="text-slate-400" />
                                        <p className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">No Records Found</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination UI */}
            {totalPages > 1 && (
                <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50" dir="rtl">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                        {t('common.page')} {currentPage} {t('common.of')} {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-30 shadow-sm transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-30 shadow-sm transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Action Modals */}
            {selectedItem && (
                <>
                    <AddPaymentDialog
                        open={payModalOpen}
                        onClose={() => { setPayModalOpen(false); setSelectedItem(null); }}
                        initialMember={selectedItem.member}
                        initialSubscriptionId={selectedItem.id}
                        onSuccess={handleSuccess}
                    />
                    <RefundSummaryModal
                        isOpen={refundModalOpen}
                        onClose={() => { setRefundModalOpen(false); setSelectedItem(null); }}
                        subscriptionId={selectedItem.id}
                        onSuccess={handleSuccess}
                    />
                </>
            )}
        </div>
    );
};

export default PaymentsTable;
