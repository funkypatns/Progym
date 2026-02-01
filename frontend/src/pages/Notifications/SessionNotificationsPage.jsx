import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, XCircle, Clock, Volume2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import apiClient from '../../utils/api';

const SessionNotificationsPage = () => {
    const [activeTab, setActiveTab] = useState('auto_completed');
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const lastIdRef = useRef(0);

    // Polling setup
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, [activeTab]);

    const playSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);

            osc.start();
            setTimeout(() => osc.stop(), 200);
        } catch (e) {
            console.error('Audio play failed', e);
        }
    };

    const fetchNotifications = async () => {
        if (loading) return; // distinct loading state for initial load vs polling?
        // simple loading check

        try {
            const res = await apiClient.get(`/appointments/notifications?type=${activeTab}&limit=50`);
            if (res.data.success) {
                const data = res.data.data;
                setNotifications(data);

                // Check for new items to play sound
                if (data.length > 0) {
                    const newestId = data[0].id; // assuming ordered by desc
                    if (newestId > lastIdRef.current && lastIdRef.current !== 0) {
                        playSound();
                    }
                    lastIdRef.current = newestId;
                }
            }
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <Bell className="text-amber-500" />
                        Session Notifications
                    </h1>
                    <p className="text-slate-400">Monitor auto-completed and cancelled sessions</p>
                </div>
                <button onClick={playSound} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition" title="Test Sound">
                    <Volume2 size={20} className="text-slate-400" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
                <button
                    onClick={() => setActiveTab('auto_completed')}
                    className={`px-6 py-3 text-sm font-bold uppercase transition border-b-2 ${activeTab === 'auto_completed'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <CheckCircle size={16} />
                        Auto Completed
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('cancelled')}
                    className={`px-6 py-3 text-sm font-bold uppercase transition border-b-2 ${activeTab === 'cancelled'
                        ? 'border-red-500 text-red-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <XCircle size={16} />
                        Cancelled
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('no_show')}
                    className={`px-6 py-3 text-sm font-bold uppercase transition border-b-2 ${activeTab === 'no_show'
                        ? 'border-amber-500 text-amber-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Clock size={16} />
                        No-show
                    </div>
                </button>
            </div>

            {/* List */}
            <div className="space-y-2">
                {notifications.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        No notifications found.
                    </div>
                ) : (
                    notifications.map(item => (
                        <div key={item.id} className="bg-slate-800 p-4 rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition group">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${item.status === 'auto_completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                    {item.status === 'auto_completed' ? <Clock size={24} /> : <XCircle size={24} />}
                                </div>
                                <div>
                                    <div className="font-bold text-white text-lg">
                                        {item.member?.firstName} {item.member?.lastName}
                                    </div>
                                    <div className="text-sm text-slate-400 flex items-center gap-2">
                                        <span>with {item.coach?.firstName} {item.coach?.lastName}</span>
                                        <span className="w-1 h-1 bg-slate-600 rounded-full" />
                                        <span>{format(parseISO(item.updatedAt), 'HH:mm')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className={`text-xs font-bold uppercase px-3 py-1 rounded-full inline-block ${item.status === 'auto_completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                    }`}>
                                    {item.status}
                                </div>
                                <div className="text-xs text-slate-500 mt-2">
                                    {format(parseISO(item.updatedAt), 'yyyy-MM-dd')}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SessionNotificationsPage;
