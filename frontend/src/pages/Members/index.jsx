import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/api';
import { useTranslation } from 'react-i18next';
import { Plus, Search, User, Phone, Mail, Users, UserCheck, Activity, FileSpreadsheet, Eye, Filter, LogOut, Edit } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import MemberLedgerModal from '../../components/MemberLedgerModal';
import { motion, AnimatePresence } from 'framer-motion';
import { WhatsAppButtonWithTemplates } from '../../components/WhatsAppButton';
import toast from 'react-hot-toast';

// Member Code Chip Component
const MemberCodeChip = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const { t } = useTranslation();

    const handleCopy = (e) => {
        e.stopPropagation();
        if (!code) return;
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!code) return null;

    return (
        <button
            onClick={handleCopy}
            className="group relative flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border border-gray-200 dark:border-white/10 hover:border-indigo-200 dark:hover:border-indigo-500/30 rounded-md transition-all cursor-pointer w-fit"
            title={t('common.copy', 'Copy Code')}
        >
            <span className="text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {code}
            </span>
            {copied ? (
                <UserCheck size={10} className="text-emerald-500 animate-in zoom-in spin-in-90 duration-300" />
            ) : (
                <FileSpreadsheet size={10} className="text-gray-400 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100" />
            )}

            {/* Tooltip */}
            {copied && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap z-10 pointer-events-none">
                    Copied!
                </span>
            )}
        </button>
    );
};

const Members = () => {
    const { t, i18n } = useTranslation();
    const safeT = (key, fallback = 'Unknown') => {
        const v = t(key);
        if (!v || v === key || (v.includes('.') && v.includes(key.split('.').pop()))) {
            return i18n.language === 'ar' ? (fallback === 'Unknown' ? 'غير معروف' : fallback) : fallback;
        }
        return v;
    };
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [stats, setStats] = useState({ total: 0, active: 0, new: 0 });
    const [ledgerMember, setLedgerMember] = useState(null);
    const [checkoutLoadingId, setCheckoutLoadingId] = useState(null);

    const location = useLocation(); // Hook to detect navigation changes

    useEffect(() => {
        fetchMembers();
    }, [location.key]); // Refetch when location key changes (e.g. returning from add member)

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/members');
            if (res.data.success) {
                // Handle different response structures: Array, Mongoose {docs: []}, or custom {members: []}
                const responseData = res.data.data;
                const data = Array.isArray(responseData)
                    ? responseData
                    : (responseData?.members || responseData?.docs || []);

                setMembers(data);
                setStats({
                    total: data.length,
                    active: data.filter(m => m.status === 'active').length,
                    new: data.filter(m => new Date(m.createdAt) > new Date(Date.now() - 7 * 86400000)).length
                });
            }
        } catch (error) {
            console.error("Failed to fetch members", error);
            // toast.error(t('common.error')); 
            setMembers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleMemberCheckout = async (member) => {
        if (!member?.id || checkoutLoadingId === member.id) return;
        setCheckoutLoadingId(member.id);
        try {
            const res = await apiClient.post('/checkin/checkout', { memberId: member.id });
            if (res.data.success) {
                toast.success(safeT('checkin.checkoutSuccess', 'Checked out successfully'));
                fetchMembers();
            }
        } catch (error) {
            console.error("Checkout failed", error);
            toast.error(error.response?.data?.message || safeT('common.error', 'Checkout failed'));
        } finally {
            setCheckoutLoadingId(null);
        }
    };

    const filtered = members.filter(m => {
        const fullName = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
        const phone = m.phone || '';
        const s = search.toLowerCase();
        return fullName.includes(s) || phone.includes(s);
    });

    return (
        <div className="max-w-[1920px] mx-auto space-y-6 p-4 lg:p-6">
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row items-center justify-between gap-6 backdrop-blur-xl bg-glass-100 rounded-3xl p-6 border border-glass-border">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">
                        {safeT('nav.members', 'Members')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Manage, search, and view all registered members.</p>
                </div>

                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder={safeT('members.searchPlaceholder', 'Search members...')}
                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <button className="p-3.5 bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-white/10 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm">
                        <Filter size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>

                    <Link
                        to="/members/new"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={20} className="text-white" />
                        <span className="hidden sm:inline">{safeT('members.addMember', 'Add Member')}</span>
                    </Link>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: safeT('dashboard.totalMembers', 'Total Members'), value: stats.total, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: safeT('dashboard.activeMembers', 'Active Members'), value: stats.active, icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: safeT('dashboard.recentMembers', 'New Members'), value: stats.new, icon: Activity, color: 'text-violet-500', bg: 'bg-violet-500/10' }
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/20 shadow-sm flex items-center gap-5 hover:border-indigo-500/30 transition-colors group">
                        <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                            <stat.icon size={32} />
                        </div>
                        <div>
                            <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</div>
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Members List (Grid Layout) - 5 Columns: Members | Info | Status | Checkout | Actions */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-xl overflow-hidden flex flex-col w-full">
                {/* Header Row */}
                <div className="grid grid-cols-[28%_24%_16%_10%_22%] gap-0 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 items-center w-full">
                    <div className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center whitespace-nowrap border-e border-gray-100 dark:border-white/5">{safeT('nav.members', 'Members')}</div>
                    <div className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center whitespace-nowrap border-e border-gray-100 dark:border-white/5">{safeT('common.info', 'Info')}</div>
                    <div className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center whitespace-nowrap border-e border-gray-100 dark:border-white/5">{safeT('common.status', 'Status')}</div>
                    <div className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center whitespace-nowrap border-e border-gray-100 dark:border-white/5">{safeT('checkin.checkout', 'تسجيل خروج')}</div>
                    <div className="px-4 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center whitespace-nowrap">{safeT('common.actions', 'Actions')}</div>
                </div>

                {/* Data Rows */}
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {filtered.length > 0 ? filtered.map((member) => (
                        <div key={member.id} className="grid grid-cols-[28%_24%_16%_10%_22%] gap-0 items-center hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors group w-full">
                            {/* Column 1: Member Identity & Code */}
                            <div className="px-6 py-4 flex items-center justify-center gap-4 overflow-hidden border-e border-gray-100/50 dark:border-white/5 h-full">
                                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold text-lg shadow-inner ring-1 ring-black/5 dark:ring-white/10 group-hover:scale-110 transition-transform">
                                    {member.firstName?.[0]}
                                </div>
                                <div className="min-w-0 flex flex-col items-center gap-1">
                                    <div className="font-bold text-gray-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate text-center">
                                        {member.firstName} {member.lastName}
                                    </div>
                                    <MemberCodeChip code={member.memberId || `GYM-${member.id}`} />
                                </div>
                            </div>

                            {/* Column 2: Info */}
                            <div className="px-4 py-3 space-y-1 overflow-hidden flex flex-col items-center justify-center text-center border-e border-gray-100/50 dark:border-white/5 h-full">
                                <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 truncate w-full">
                                    <Phone size={13} className="text-gray-400 flex-shrink-0" />
                                    <span dir="ltr" className="tracking-wide truncate">{member.phone}</span>
                                </div>
                                {member.email && (
                                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500 truncate w-full">
                                        <Mail size={12} className="text-gray-400 flex-shrink-0" /> <span className="truncate">{member.email}</span>
                                    </div>
                                )}
                            </div>

                            {/* Column 3: Status */}
                            <div className="px-4 py-3 flex justify-center items-center border-e border-gray-100/50 dark:border-white/5 h-full">
                                {(() => {
                                    // Map backend status to frontend display
                                    const rawStatus = member.subscriptionStatus || 'none';
                                    const statusMap = {
                                        'active': { color: 'emerald', key: 'members.active', label: 'Active' },
                                        'expiring': { color: 'amber', key: 'subscriptions.expiring', label: 'Expiring' },
                                        'expired': { color: 'rose', key: 'subscriptions.expired', label: 'Expired' },
                                        'none': { color: 'gray', key: 'members.inactive', label: 'Inactive' }
                                    };

                                    const statusConfig = statusMap[rawStatus] || statusMap['none'];
                                    const colorClass = {
                                        emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                                        amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                                        rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                                        gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
                                    }[statusConfig.color];

                                    const dotClass = {
                                        emerald: 'bg-emerald-500 animate-pulse',
                                        amber: 'bg-amber-500',
                                        rose: 'bg-rose-500',
                                        gray: 'bg-gray-400'
                                    }[statusConfig.color];

                                    return (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md ${colorClass}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                                            {safeT(statusConfig.key, statusConfig.label)}
                                        </span>
                                    );
                                })()}
                            </div>

                            {/* Column 4: Checkout (Dedicated Column) */}
                            <div className="px-4 py-3 flex items-center justify-center border-e border-gray-100/50 dark:border-white/5 h-full">
                                {(() => {
                                    const lastCheckIn = member.checkIns?.[0];
                                    const isCheckedIn = lastCheckIn &&
                                        !lastCheckIn.checkOutTime &&
                                        new Date(lastCheckIn.checkInTime).toDateString() === new Date().toDateString();

                                    const isLoading = checkoutLoadingId === member.id;

                                    return (
                                        <button
                                            onClick={isCheckedIn ? () => handleMemberCheckout(member) : undefined}
                                            disabled={!isCheckedIn || isLoading}
                                            className={`p-2.5 w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${isLoading
                                                    ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-500/20 cursor-wait'
                                                    : isCheckedIn
                                                        ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 border-rose-500/20 hover:scale-110 cursor-pointer shadow-sm'
                                                        : 'text-gray-300 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 cursor-not-allowed opacity-40'
                                                }`}
                                            title={isLoading ? safeT('common.processing', 'Processing...') : isCheckedIn ? safeT('checkin.checkout', 'Check Out') : safeT('checkin.notCheckedIn', 'Not Checked In')}
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <LogOut size={18} />
                                            )}
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* Column 5: Actions */}
                            <div className="px-4 py-3 flex items-center justify-center gap-2 transition-all h-full">
                                {/* WHATSAPP ACTION */}
                                <WhatsAppButtonWithTemplates
                                    phone={member.phone}
                                    memberName={`${member.firstName} ${member.lastName}`}
                                    className="p-2 w-9 h-9 flex items-center justify-center text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 rounded-xl shadow-sm border border-emerald-500/20 transition-all hover:scale-110"
                                    title={safeT('common.whatsapp', 'Send WhatsApp Message')}
                                />

                                <Link
                                    to={`/members/${member.id}`}
                                    className="p-2 w-9 h-9 flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 rounded-xl transition-all shadow-sm border border-indigo-500/20 hover:scale-110"
                                    title={safeT('common.view', 'View Member Details')}
                                >
                                    <Eye size={16} />
                                </Link>

                                <Link
                                    to={`/members/${member.id}/edit`}
                                    className="p-2 w-9 h-9 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm border border-blue-500/20 hover:scale-110"
                                    title={safeT('common.edit', 'Edit Member')}
                                >
                                    <Edit size={16} />
                                </Link>

                                <button
                                    onClick={() => setLedgerMember(member)}
                                    className="p-2 w-9 h-9 flex items-center justify-center text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 rounded-xl transition-all shadow-sm border border-amber-500/20 hover:scale-110"
                                    title={safeT('reports.financials', 'Member Financials')}
                                >
                                    <FileSpreadsheet size={16} />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="py-32 text-center">
                            <div className="flex flex-col items-center justify-center">
                                <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 ring-4 ring-gray-50 dark:ring-white/5">
                                    <Search className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{safeT('common.noData', 'No members found')}</h3>
                                <p className="text-gray-500 mt-2 max-w-sm mx-auto">
                                    {safeT('members.emptySearch', 'Try adjusting your search terms or add a new member.')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <MemberLedgerModal
                isOpen={!!ledgerMember}
                onClose={() => setLedgerMember(null)}
                memberId={ledgerMember?.id}
                memberName={`${ledgerMember?.firstName} ${ledgerMember?.lastName}`}
            />
        </div>
    );
};

export default Members;
