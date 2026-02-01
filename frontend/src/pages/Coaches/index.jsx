import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Settings, DollarSign, ChevronRight, TrendingUp } from 'lucide-react';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';
import CommissionSettingsModal from './CommissionSettingsModal';
import CoachEarningsModal from './CoachEarningsModal';

const Coaches = () => {
    const { t } = useTranslation();
    const [coaches, setCoaches] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modals
    const [selectedCoach, setSelectedCoach] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showEarnings, setShowEarnings] = useState(false);

    const fetchCoaches = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/staff-trainers');
            if (res.data.success) {
                const items = Array.isArray(res.data.data) ? res.data.data : [];
                const unique = new Map(items.map(item => [item.id, { ...item, allowSettlement: false }]));
                setCoaches(Array.from(unique.values()));
            }
        } catch (error) {
            toast.error('Failed to fetch trainers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCoaches();
    }, []);

    const handleSettings = (coach) => {
        if (!coach?.id) {
            toast.error('Trainer not available');
            return;
        }
        setSelectedCoach(coach);
        setShowSettings(true);
    };

    const handleEarnings = (coach) => {
        if (!coach?.id) {
            toast.error('Trainer not available');
            return;
        }
        setSelectedCoach(coach);
        setShowEarnings(true);
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                        {t('coaches.managementTitle', 'Coach Management')}
                    </h1>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                        {t('coaches.managementSubtitle', 'Commissions & Payouts')}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coaches.map(coach => (
                    <div key={coach.id} className="bg-slate-900 border border-white/5 rounded-3xl p-6 hover:bg-slate-800 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center text-slate-400">
                                <User size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{coach.name || 'Trainer'}</h3>
                                <div className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wider">
                                    Trainer
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleSettings(coach)}
                                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700 border border-white/5 hover:border-white/10 transition-all group/btn"
                            >
                                <Settings size={24} className="mb-2 text-slate-400 group-hover/btn:text-white transition-colors" />
                                <span className="text-xs font-bold text-slate-500 uppercase">Settings</span>
                            </button>
                            <button
                                onClick={() => handleEarnings(coach)}
                                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/10 hover:border-emerald-500/20 transition-all group/btn"
                            >
                                <TrendingUp size={24} className="mb-2 text-emerald-500 transition-colors" />
                                <span className="text-xs font-bold text-emerald-400 uppercase">Earnings</span>
                            </button>
                        </div>
                    </div>
                ))}

                {coaches.length === 0 && !loading && (
                    <div className="col-span-full py-20 text-center text-slate-500">
                        No trainers found. Add trainers in Trainers List.
                    </div>
                )}
            </div>

            {/* Modals */}
            {showSettings && selectedCoach && (
                <CommissionSettingsModal
                    open={showSettings}
                    onClose={() => setShowSettings(false)}
                    coach={selectedCoach}
                />
            )}

            {showEarnings && selectedCoach && (
                <CoachEarningsModal
                    open={showEarnings}
                    onClose={() => setShowEarnings(false)}
                    coach={selectedCoach}
                />
            )}
        </div>
    );
};

export default Coaches;
