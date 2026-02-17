import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, PauseCircle, PlayCircle, Plus, Search, CalendarCheck, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../utils/api';

const STATUS_OPTIONS = ['all', 'active', 'exhausted', 'paused', 'expired'];
const MEMBER_SEARCH_MIN_CHARS = 2;

const STATUS_CLASS = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    exhausted: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    paused: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
    expired: 'bg-rose-500/15 text-rose-400 border-rose-500/40'
};

const getIdempotencyKey = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const SessionPacks = () => {
    const { t, i18n } = useTranslation();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [amountTouched, setAmountTouched] = useState(false);
    const [members, setMembers] = useState([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [isSearchingMembers, setIsSearchingMembers] = useState(false);
    const [selectedMemberOption, setSelectedMemberOption] = useState(null);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [historyRows, setHistoryRows] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [form, setForm] = useState({
        memberId: '',
        packTemplateId: '',
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
        amountPaid: '',
        sessionName: '',
        sessionPrice: ''
    });

    const formatDate = (value) => {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
    };

    const statusLabel = (status) => {
        const key = `sessionPacks.status.${status}`;
        const translated = t(key);
        return translated && translated !== key ? translated : status;
    };

    const fetchRows = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/pack-assignments', {
                params: { status: statusFilter, q: search || undefined }
            });
            setRows(res.data.success && Array.isArray(res.data.data) ? res.data.data : []);
        } catch (error) {
            setRows([]);
            toast.error(error.response?.data?.message || t('sessionPacks.errors.load', 'Failed to load session packs'));
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await apiClient.get('/pack-templates');
            setTemplates(res.data.success && Array.isArray(res.data.data) ? res.data.data : []);
        } catch (error) {
            setTemplates([]);
        }
    };

    const fetchHistory = async (assignmentId) => {
        setHistoryLoading(true);
        try {
            const [detailRes, historyRes] = await Promise.all([
                apiClient.get(`/pack-assignments/${assignmentId}`),
                apiClient.get(`/pack-assignments/${assignmentId}/checkins`)
            ]);
            setSelectedAssignment(detailRes.data?.data || null);
            setHistoryRows(Array.isArray(historyRes.data?.data) ? historyRes.data.data : []);
        } catch (error) {
            toast.error(error.response?.data?.message || t('sessionPacks.errors.history', 'Failed to load history'));
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
    }, [statusFilter]);

    useEffect(() => {
        const timeout = setTimeout(fetchRows, 300);
        return () => clearTimeout(timeout);
    }, [search]);

    useEffect(() => {
        if (showAssignModal) fetchTemplates();
    }, [showAssignModal]);

    useEffect(() => {
        if (!showAssignModal) return;
        if (memberSearch.trim().length < MEMBER_SEARCH_MIN_CHARS) {
            setMembers([]);
            return;
        }
        const timeout = setTimeout(async () => {
            setIsSearchingMembers(true);
            try {
                const res = await apiClient.get('/members', { params: { search: memberSearch.trim(), limit: 10 } });
                const list = res.data?.data?.members || [];
                setMembers(res.data.success && Array.isArray(list) ? list : []);
            } catch (error) {
                setMembers([]);
            } finally {
                setIsSearchingMembers(false);
            }
        }, 250);
        return () => clearTimeout(timeout);
    }, [memberSearch, showAssignModal]);

    const selectedMember = useMemo(() => {
        if (!form.memberId) return null;
        if (selectedMemberOption && String(selectedMemberOption.id) === String(form.memberId)) {
            return selectedMemberOption;
        }
        return members.find((member) => String(member.id) === String(form.memberId)) || null;
    }, [form.memberId, members, selectedMemberOption]);

    const getMemberFullName = (member) => `${member?.firstName || ''} ${member?.lastName || ''}`.trim();

    const handleMemberSearchChange = (value) => {
        setMemberSearch(value);
        if (!selectedMember) return;
        const selectedName = getMemberFullName(selectedMember).toLowerCase();
        if (value.trim().toLowerCase() !== selectedName) {
            setSelectedMemberOption(null);
            setForm((prev) => ({ ...prev, memberId: '' }));
        }
    };

    const handleMemberSelect = (member) => {
        const fullName = getMemberFullName(member);
        setForm((prev) => ({ ...prev, memberId: String(member.id) }));
        setSelectedMemberOption(member);
        setMemberSearch(fullName);
        setMembers([]);
    };

    const getTemplatePrice = (template) => {
        if (!template) return '';
        const rawPrice = template.price_total ?? template.priceTotal ?? template.price;
        const priceNumber = Number(rawPrice);
        return Number.isFinite(priceNumber) ? String(priceNumber) : '';
    };

    const handleTemplateChange = (templateId) => {
        const template = templates.find((item) => String(item.id) === String(templateId));
        const nextPrice = getTemplatePrice(template);
        const shouldAutoFillAmount = !amountTouched || form.amountPaid === '' || form.amountPaid === null || form.amountPaid === undefined;

        setForm((prev) => ({
            ...prev,
            packTemplateId: templateId,
            amountPaid: shouldAutoFillAmount ? nextPrice : prev.amountPaid
        }));
    };

    const handleAssign = async () => {
        if (!form.memberId || !form.packTemplateId) {
            toast.error(t('sessionPacks.errors.selectMemberAndPack', 'Select member and pack template first'));
            return;
        }
        const amountPaid = form.amountPaid === '' ? 0 : Number(form.amountPaid);
        const sessionPrice = form.sessionPrice === '' ? undefined : Number(form.sessionPrice);
        if (!Number.isFinite(amountPaid) || amountPaid < 0) {
            toast.error(t('sessionPacks.errors.invalidAmount', 'Invalid amount paid'));
            return;
        }
        if (sessionPrice !== undefined && (!Number.isFinite(sessionPrice) || sessionPrice < 0)) {
            toast.error(t('sessionPacks.errors.invalidSessionPrice', 'Invalid session price'));
            return;
        }

        setAssigning(true);
        try {
            const payload = {
                memberId: Number(form.memberId),
                packTemplateId: Number(form.packTemplateId),
                paymentMethod: form.paymentMethod,
                paymentStatus: form.paymentStatus,
                amountPaid,
                sessionName: form.sessionName || undefined,
                sessionPrice
            };
            const res = await apiClient.post('/pack-assignments', payload);
            if (!res.data.success) throw new Error(res.data.message || 'Assign failed');

            toast.success(t('sessionPacks.assignedSuccess', 'Pack assigned successfully'));
            setShowAssignModal(false);
            setForm({
                memberId: '',
                packTemplateId: '',
                paymentMethod: 'cash',
                paymentStatus: 'unpaid',
                amountPaid: '',
                sessionName: '',
                sessionPrice: ''
            });
            setAmountTouched(false);
            setMemberSearch('');
            setMembers([]);
            setSelectedMemberOption(null);
            fetchRows();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || t('sessionPacks.errors.assign', 'Failed to assign pack'));
        } finally {
            setAssigning(false);
        }
    };

    const handleCheckIn = async (assignment) => {
        try {
            const res = await apiClient.post(
                `/pack-assignments/${assignment.id}/checkins`,
                {},
                { headers: { 'Idempotency-Key': getIdempotencyKey() } }
            );
            if (!res.data.success) throw new Error(res.data.message || 'Check-in failed');
            const remaining = res.data?.data?.assignment?.remainingSessions;
            toast.success(
                remaining !== undefined
                    ? t('sessionPacks.checkinSuccessWithRemaining', { count: remaining })
                    : t('sessionPacks.checkinSuccess', 'Check-in saved successfully')
            );
            fetchRows();
            if (selectedAssignment?.id === assignment.id) fetchHistory(assignment.id);
        } catch (error) {
            toast.error(error.response?.data?.message || t('sessionPacks.errors.checkin', 'Failed to check-in'));
        }
    };

    const handleTogglePause = async (assignment) => {
        const target = assignment.status === 'paused' ? 'active' : 'paused';
        try {
            const res = await apiClient.patch(`/pack-assignments/${assignment.id}/status`, { status: target });
            if (!res.data.success) throw new Error(res.data.message || 'Failed');
            toast.success(target === 'paused'
                ? t('sessionPacks.pausedSuccess', 'Pack paused')
                : t('sessionPacks.resumedSuccess', 'Pack resumed'));
            fetchRows();
            if (selectedAssignment?.id === assignment.id) fetchHistory(assignment.id);
        } catch (error) {
            toast.error(error.response?.data?.message || t('sessionPacks.errors.status', 'Failed to update status'));
        }
    };

    return (
        <div className="max-w-[1700px] mx-auto space-y-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('sessionPacks.title', 'Session Packs')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('sessionPacks.subtitle', 'Manage member session packs and attendance deduction')}</p>
                </div>
                <button
                    onClick={() => setShowAssignModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                    <Plus size={18} />
                    {t('sessionPacks.assignPack', 'Assign Pack +')}
                </button>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusFilter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                            >
                                {statusLabel(status)}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full lg:w-80">
                        <Search size={16} className="absolute top-3.5 left-3 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('sessionPacks.searchPlaceholder', 'Search by member name / member ID')}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                        <thead>
                            <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                                <th className="py-3 px-3 text-start">{t('sessionPacks.table.member', 'Member')}</th>
                                <th className="py-3 px-3 text-start">{t('sessionPacks.table.pack', 'Pack')}</th>
                                <th className="py-3 px-3 text-start">{t('sessionPacks.table.purchasedAt', 'Purchased At')}</th>
                                <th className="py-3 px-3 text-start">{t('sessionPacks.table.remaining', 'Remaining Sessions')}</th>
                                <th className="py-3 px-3 text-start">{t('sessionPacks.table.expiresAt', 'Validity / Expires')}</th>
                                <th className="py-3 px-3 text-start">{t('sessionPacks.table.paymentStatus', 'Payment Status')}</th>
                                <th className="py-3 px-3 text-start">{t('sessionPacks.table.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-gray-500">
                                        <Loader2 className="w-5 h-5 animate-spin inline-block" />
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-gray-500 dark:text-gray-400">
                                        {t('sessionPacks.empty', 'No session packs found')}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 text-sm">
                                        <td className="py-3 px-3">
                                            <div className="font-bold text-gray-900 dark:text-white">{row.member?.fullName || '-'}</div>
                                            <div className="text-xs text-gray-500">{row.member?.memberId || '-'}</div>
                                        </td>
                                        <td className="py-3 px-3">
                                            <div className="font-bold text-gray-900 dark:text-white">{row.packTemplate?.name || '-'}</div>
                                            <div className="text-xs text-gray-500">{row.totalSessions} {t('sessionPacks.sessions', 'sessions')}</div>
                                        </td>
                                        <td className="py-3 px-3">{formatDate(row.purchasedAt)}</td>
                                        <td className="py-3 px-3">
                                            <span className="font-bold text-gray-900 dark:text-white">{row.remainingSessions}</span>
                                            <span className="text-xs text-gray-500"> / {row.totalSessions}</span>
                                        </td>
                                        <td className="py-3 px-3">{formatDate(row.expiresAt)}</td>
                                        <td className="py-3 px-3">
                                            <div className="space-y-1">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_CLASS[row.status] || STATUS_CLASS.active}`}>
                                                    {statusLabel(row.status)}
                                                </span>
                                                <div className="text-xs text-gray-500">{row.paymentStatus || 'unpaid'} • {row.amountPaid ?? 0}</div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => fetchHistory(row.id)}
                                                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400"
                                                    title={t('sessionPacks.actions.view', 'View')}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleCheckIn(row)}
                                                    disabled={row.status !== 'active'}
                                                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-emerald-600 disabled:opacity-50"
                                                    title={t('sessionPacks.actions.checkin', 'Check-in')}
                                                >
                                                    <CalendarCheck size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleTogglePause(row)}
                                                    disabled={row.status === 'exhausted' || row.status === 'expired'}
                                                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-amber-600 disabled:opacity-50"
                                                    title={row.status === 'paused' ? t('sessionPacks.actions.resume', 'Resume') : t('sessionPacks.actions.pause', 'Pause')}
                                                >
                                                    {row.status === 'paused' ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedAssignment && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('sessionPacks.historyTitle', 'Assignment Details & History')}</h2>
                        <button
                            onClick={() => {
                                setSelectedAssignment(null);
                                setHistoryRows([]);
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
                            <div className="text-gray-500">{t('sessionPacks.table.member', 'Member')}</div>
                            <div className="font-bold text-gray-900 dark:text-white">{selectedAssignment.member?.fullName || '-'}</div>
                        </div>
                        <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
                            <div className="text-gray-500">{t('sessionPacks.table.pack', 'Pack')}</div>
                            <div className="font-bold text-gray-900 dark:text-white">{selectedAssignment.packTemplate?.name || '-'}</div>
                        </div>
                        <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
                            <div className="text-gray-500">{t('sessionPacks.table.remaining', 'Remaining Sessions')}</div>
                            <div className="font-bold text-gray-900 dark:text-white">{selectedAssignment.remainingSessions} / {selectedAssignment.totalSessions}</div>
                        </div>
                        <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
                            <div className="text-gray-500">{t('sessionPacks.table.expiresAt', 'Validity / Expires')}</div>
                            <div className="font-bold text-gray-900 dark:text-white">{formatDate(selectedAssignment.expiresAt)}</div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                                    <th className="py-2 px-3 text-start">{t('sessionPacks.history.sessionName', 'Session Name')}</th>
                                    <th className="py-2 px-3 text-start">{t('sessionPacks.history.sessionPrice', 'Session Price')}</th>
                                    <th className="py-2 px-3 text-start">{t('sessionPacks.history.checkedInAt', 'Checked In At')}</th>
                                    <th className="py-2 px-3 text-start">{t('sessionPacks.history.by', 'By')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyLoading ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-500">
                                            <Loader2 className="inline-block w-4 h-4 animate-spin" />
                                        </td>
                                    </tr>
                                ) : historyRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-500">{t('sessionPacks.history.empty', 'No check-in history yet')}</td>
                                    </tr>
                                ) : historyRows.map((item) => (
                                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 text-sm">
                                        <td className="py-2 px-3">{item.sessionName || '-'}</td>
                                        <td className="py-2 px-3">{item.sessionPrice ?? '-'}</td>
                                        <td className="py-2 px-3">{new Date(item.checkedInAt).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}</td>
                                        <td className="py-2 px-3">{item.createdBy?.name || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showAssignModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('sessionPacks.assignPack', 'Assign Pack +')}</h3>
                            <button onClick={() => setShowAssignModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sessionPacks.form.member', 'Member')}</label>
                            <input
                                value={memberSearch}
                                onChange={(e) => handleMemberSearchChange(e.target.value)}
                                placeholder={t('sessionPacks.form.memberSearch', 'Search member by name / ID')}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                            />
                            {isSearchingMembers && <p className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</p>}
                            {members.length > 0 && (
                                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                    {members.map((member) => (
                                        <button
                                            type="button"
                                            key={member.id}
                                            onClick={() => handleMemberSelect(member)}
                                            className={`w-full text-start px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${String(form.memberId) === String(member.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                        >
                                            <div className="font-bold text-gray-900 dark:text-white">{member.firstName} {member.lastName}</div>
                                            <div className="text-xs text-gray-500">{member.memberId || member.code || '-'}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {memberSearch.trim().length > 0 && memberSearch.trim().length < MEMBER_SEARCH_MIN_CHARS && (
                                <p className="text-xs text-gray-500">
                                    {t('sessionPacks.form.memberSearchHint', 'Type at least 2 letters to search')}
                                </p>
                            )}
                            {selectedMember && (
                                <p className="text-xs text-emerald-500">{selectedMember.firstName} {selectedMember.lastName}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sessionPacks.form.packTemplate', 'Pack Template')}</label>
                            <select
                                value={form.packTemplateId}
                                onChange={(e) => handleTemplateChange(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                            >
                                <option value="">{t('common.select', 'Select')}</option>
                                {templates.map((template) => (
                                    <option key={template.id} value={template.id}>
                                        {template.name} • {template.totalSessions} {t('sessionPacks.sessions', 'sessions')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sessionPacks.form.paymentMethod', 'Payment method')}</label>
                                <select
                                    value={form.paymentMethod}
                                    onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                                >
                                    <option value="cash">{t('payments.cash', 'Cash')}</option>
                                    <option value="card">{t('payments.card', 'Card')}</option>
                                    <option value="transfer">{t('payments.transfer', 'Transfer')}</option>
                                    <option value="wallet">{t('sessionPacks.wallet', 'Wallet')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sessionPacks.form.paymentStatus', 'Payment status')}</label>
                                <select
                                    value={form.paymentStatus}
                                    onChange={(e) => setForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                                >
                                    <option value="paid">{t('sessionPacks.paymentStatus.paid', 'Paid')}</option>
                                    <option value="partial">{t('sessionPacks.paymentStatus.partial', 'Partial')}</option>
                                    <option value="unpaid">{t('sessionPacks.paymentStatus.unpaid', 'Unpaid')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sessionPacks.form.amountPaid', 'Amount paid')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.amountPaid}
                                    onChange={(e) => {
                                        setAmountTouched(true);
                                        setForm((prev) => ({ ...prev, amountPaid: e.target.value }));
                                    }}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sessionPacks.form.sessionName', 'Session name override')}</label>
                                <input
                                    value={form.sessionName}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sessionName: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sessionPacks.form.sessionPrice', 'Session price override')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.sessionPrice}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sessionPrice: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={assigning}
                                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-70"
                            >
                                {assigning ? t('common.loading', 'Loading...') : t('sessionPacks.form.assign', 'Assign')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionPacks;
