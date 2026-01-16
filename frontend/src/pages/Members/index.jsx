import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/api';
import { useTranslation } from 'react-i18next';
import { Plus, Search, User, Phone, Mail, Users, UserCheck, Activity, FileSpreadsheet, Eye, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import MemberLedgerModal from '../../components/MemberLedgerModal';
import { motion, AnimatePresence } from 'framer-motion';

const Members = () => {
    const { t } = useTranslation();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [stats, setStats] = useState({ total: 0, active: 0, new: 0 });
    const [ledgerMember, setLedgerMember] = useState(null);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const res = await apiClient.get('/members');
                if (res.data.success) {
                    const data = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.docs || []);
                    setMembers(data);
                    setStats({
                        total: data.length,
                        active: data.filter(m => m.status === 'active').length,
                        new: data.filter(m => new Date(m.createdAt) > new Date(Date.now() - 7 * 86400000)).length
                    });
                }
            } catch (error) {
                console.error("Failed to fetch members", error);
                setMembers([]);
            } finally {
                setLoading(false);
            }
        };
        fetchMembers();
    }, []);

    const filtered = members.filter(m =>
        (m.firstName + ' ' + m.lastName).toLowerCase().includes(search.toLowerCase()) ||
        (m.phone && m.phone.includes(search))
    );

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
            {/* Header Section with Grid Layout */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('nav.members')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage, search, and view all registered members.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder={t('members.searchPlaceholder')}
                            className="w-full pl-4 pr-10 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <button className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                        <Filter size={20} className="text-gray-500" />
                    </button>

                    <Link
                        to="/members/new"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={20} />
                        <span className="hidden sm:inline">{t('members.addMember')}</span>
                    </Link>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: t('dashboard.totalMembers'), value: stats.total, icon: Users, color: 'blue' },
                    { label: t('dashboard.activeMembers'), value: stats.active, icon: UserCheck, color: 'green' },
                    { label: t('dashboard.recentMembers'), value: stats.new, icon: Activity, color: 'purple' }
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-5">
                        <div className={`p-4 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400`}>
                            <stat.icon size={28} />
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Members Table */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-gray-500 uppercase text-xs tracking-wider font-semibold">
                            <tr>
                                <th className="px-8 py-5 text-right">{t('nav.members')}</th>
                                <th className="px-6 py-5 text-right">{t('common.info')}</th>
                                <th className="px-6 py-5 text-right">{t('common.status')}</th>
                                <th className="px-6 py-5 text-left">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filtered.length > 0 ? filtered.map((member) => (
                                <tr key={member.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                    <td className="px-8 py-4 text-right">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center font-bold text-lg shadow-inner">
                                                {member.firstName?.[0]}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white text-base group-hover:text-blue-600 transition-colors">
                                                    {member.firstName} {member.lastName}
                                                </div>
                                                <div className="text-xs text-gray-400 font-mono mt-0.5">#{member.memberId || member.id.slice(-4)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <Phone size={14} className="text-gray-400" />
                                                <span dir="ltr">{member.phone}</span>
                                            </div>
                                            {member.email && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Mail size={14} className="text-gray-400" /> {member.email}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${member.status === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
                                                : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                            {t(`members.${member.status}`) || member.status || t('members.active')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-left">
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setLedgerMember(member)}
                                                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all"
                                                title={t('reports.financials')}
                                            >
                                                <FileSpreadsheet size={18} />
                                            </button>
                                            <Link
                                                to={`/members/${member.id}`}
                                                className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-all"
                                                title={t('common.view')}
                                            >
                                                <Eye size={18} />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                                <Search className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No members found</h3>
                                            <p className="text-gray-500 mt-1 max-w-sm mx-auto">
                                                Try adjusting your search terms or add a new member to get started.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
