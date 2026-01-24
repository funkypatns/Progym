import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import apiClient from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Users, RefreshCw, Filter, Search } from 'lucide-react';
import SubscriptionsList from '../components/SubscriptionsList';
import AssignPlanModal from '../components/AssignPlanModal';

const Subscriptions = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMember, setModalMember] = useState(null);
    const [isRenewMode, setIsRenewMode] = useState(false);
    const [preselectedPlanId, setPreselectedPlanId] = useState(null);
    const [stats, setStats] = useState({ active: 0, expiring: 0 });
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const state = location.state;
        const planId = state?.planId;
        const memberId = state?.memberId;
        if (planId) {
            setPreselectedPlanId(planId);
        }
        if (memberId) {
            const fetchMember = async () => {
                try {
                    const res = await apiClient.get(`/members/${memberId}`);
                    if (res.data.success) {
                        setModalMember(res.data.data);
                        setIsRenewMode(false);
                        setShowModal(true);
                    }
                } catch (error) {
                    toast.error("Failed to load member");
                }
            };
            fetchMember();
        }
    }, [location.state]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Request distinct members to prevent duplicates
            const res = await apiClient.get('/subscriptions', { params: { distinctMembers: true } });
            if (res.data.success) {
                const rawSubs = Array.isArray(res.data.data.subscriptions) ? res.data.data.subscriptions : (res.data.data.docs || []);

                // Frontend Safety Layer: Deduplicate by memberId just in case
                const uniqueMap = new Map();
                rawSubs.forEach(sub => {
                    if (!uniqueMap.has(sub.memberId)) {
                        uniqueMap.set(sub.memberId, sub);
                    }
                });
                const subs = Array.from(uniqueMap.values());

                setSubscriptions(subs);
                setStats({
                    active: subs.filter(s => s.status === 'active').length,
                    expiring: subs.filter(s => s.status === 'active' && s.daysRemaining < 7).length
                });
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load data");
            setSubscriptions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm("Are you sure you want to cancel this subscription?")) return;
        try {
            await apiClient.put(`/subscriptions/${id}/cancel`);
            toast.success("Subscription Cancelled");
            fetchData();
        } catch (e) {
            toast.error("Failed to cancel");
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t('subscriptions.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage member plans, renewals, and expirations.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                    {/* Filter Chips */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl overflow-x-auto self-start sm:self-auto">
                        {['all', 'active', 'expired', 'paused'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all whitespace-nowrap ${filter === f
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setModalMember(null);
                                setIsRenewMode(false);
                                setPreselectedPlanId(null);
                                setShowModal(true);
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                        >
                            <Plus size={20} /> Assign Plan
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stats.active}</div>
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Members</div>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Users size={24} />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stats.expiring}</div>
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Expiring Soon</div>
                    </div>
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                        <RefreshCw size={24} />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden">
                <SubscriptionsList
                    subscriptions={subscriptions.filter(s => {
                        if (filter === 'all') return true;
                        if (filter === 'paused') return s.isPaused;
                        if (filter === 'active') return s.status === 'active' && !s.isPaused;
                        if (filter === 'expired') return s.status === 'expired';
                        return true;
                    })}
                    onCancel={handleCancel}
                    onRenew={(sub) => {
                        setModalMember(sub.member);
                        setIsRenewMode(true);
                        setPreselectedPlanId(null);
                        setShowModal(true);
                    }}
                    onRefresh={fetchData}
                />
            </div>

            <AssignPlanModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setModalMember(null);
                    setIsRenewMode(false);
                    setPreselectedPlanId(null);
                }}
                onSuccess={fetchData}
                initialMember={modalMember}
                isRenewMode={isRenewMode}
                initialPlanId={preselectedPlanId}
            />
        </div>
    );
};
export default Subscriptions;
