import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Users, RefreshCw, Filter, Search } from 'lucide-react';
import SubscriptionsList from '../components/SubscriptionsList';
import AssignPlanModal from '../components/AssignPlanModal';

const Subscriptions = () => {
    const { t } = useTranslation();
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [stats, setStats] = useState({ active: 0, expiring: 0 });
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/subscriptions');
            if (res.data.success) {
                const subs = Array.isArray(res.data.data.subscriptions) ? res.data.data.subscriptions : (res.data.data.docs || []);
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
            await apiClient.patch(`/subscriptions/${id}/cancel`);
            toast.success("Subscription Cancelled");
            fetchData();
        } catch (e) {
            toast.error("Failed to cancel");
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t('subscriptions.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage member plans, renewals, and expirations.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                        <Search size={20} className="text-gray-500" />
                    </button>
                    <button className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                        <Filter size={20} className="text-gray-500" />
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={20} /> Assign Plan
                    </button>
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
                    subscriptions={subscriptions}
                    onCancel={handleCancel}
                    onRenew={() => setShowModal(true)}
                />
            </div>

            <AssignPlanModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchData}
            />
        </div>
    );
};
export default Subscriptions;
