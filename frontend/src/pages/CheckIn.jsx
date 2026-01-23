import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../utils/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, ScanFace, Search, Activity, Users, Clock, ShieldCheck, Zap, LogOut } from 'lucide-react';

const CheckIn = () => {
    const { t } = useTranslation();

    // --- Translation Helper ---
    const tr = (key, fallback) => {
        const result = t(key);
        return (!result || result === key) ? fallback : result;
    };

    // --- State ---
    const [mode, setMode] = useState('manual'); // manual, scan
    const [memberId, setMemberId] = useState('');
    const [checkIns, setCheckIns] = useState([]);
    const [stats, setStats] = useState({ active: 0, today: 0 });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [checkOutId, setCheckOutId] = useState(null);
    const inputRef = useRef(null);

    // --- Effects ---
    useEffect(() => {
        fetchActivity();
        const interval = setInterval(fetchActivity, 30000);
        if (inputRef.current) inputRef.current.focus();
        return () => clearInterval(interval);
    }, []);

    const fetchActivity = async () => {
        try {
            const [todayRes, activeRes] = await Promise.all([
                apiClient.get('/checkin/today'),
                apiClient.get('/checkin/active')
            ]);
            if (todayRes.data.success) {
                setCheckIns(todayRes.data.data.checkIns);
                setStats(s => ({ ...s, today: todayRes.data.data.checkIns.length }));
            }
            if (activeRes.data.success) {
                setStats(s => ({ ...s, active: activeRes.data.data.count }));
            }
        } catch (e) {
            console.error("Sync activity failed", e);
        }
    };

    // --- Handlers ---
    const handleCheckIn = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!memberId) return;

        setLoading(true);
        setErrorMessage('');
        setCheckOutId(null);
        try {
            await apiClient.post('/checkin', { memberId, method: mode });
            toast.success(tr('checkin.success', 'SUCCESS: Access Granted'));
            setMemberId('');
            fetchActivity();
            if (inputRef.current) inputRef.current.focus();
        } catch (error) {
            const msg = error.response?.data?.message || 'Check-in Failed';
            const code = error.response?.data?.code;

            setErrorMessage(msg);
            if (code === 'ALREADY_CHECKED_IN') {
                setCheckOutId(memberId);
            }
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        if (!checkOutId) return;
        setLoading(true);
        try {
            await apiClient.post('/checkin/checkout', { memberId: checkOutId });
            toast.success(tr('checkin.checkoutSuccess', 'SUCCESS: Checked Out'));
            setCheckOutId(null);
            setErrorMessage('');
            setMemberId('');
            fetchActivity();
            if (inputRef.current) inputRef.current.focus();
        } catch (error) {
            const msg = error.response?.data?.message || 'Check-out Failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleModeChange = (newMode) => {
        setMode(newMode);
        setErrorMessage('');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleBiometric = async () => {
        if (!window.PublicKeyCredential) {
            toast.error(tr('checkin.biometricError', 'Device does not support Face ID'));
            return;
        }
        setLoading(true);
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            await navigator.credentials.get({
                publicKey: {
                    challenge,
                    timeout: 60000,
                    userVerification: 'preferred',
                }
            });
            toast.success(tr('checkin.biometricScan', 'Face ID Verified'));
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                toast.error(tr('checkin.biometricFailed', 'Authentication Failed'));
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Sub-Components ---
    const KPICard = ({ title, value, icon: Icon, color, subtext }) => (
        <div className="relative group overflow-hidden bg-glass-100 dark:bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl transition-all hover:bg-glass-200">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
                <Icon size={120} className={color} />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 ${color}`}>
                        <Icon size={24} />
                    </div>
                    <span className="font-bold tracking-wider text-gray-500 dark:text-gray-400 text-sm uppercase">{title}</span>
                </div>
                <div>
                    <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-2">{value}</h3>
                    <p className="text-xs font-medium text-gray-500/80 dark:text-gray-400/80">{subtext}</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full w-full flex flex-col lg:flex-row gap-6 p-2 overflow-hidden">

            {/* LEFT: ACTIVITY FEED (3 Columns) */}
            <div className="w-full lg:w-3/12 flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between px-2 mb-2">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                        <Activity className="text-blue-500" />
                        {tr('checkin.feed', 'Live Feed')}
                    </h2>
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    <AnimatePresence>
                        {checkIns.map((log, index) => (
                            <motion.div
                                key={log.id || index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/50 backdrop-blur-md border border-gray-100 dark:border-white/5 shadow-sm hover:border-blue-500/30 transition-colors flex items-center gap-4"
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10">
                                        {log.member?.photoUrl ? (
                                            <img src={log.member.photoUrl} alt="User" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                                {log.member?.firstName?.[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white ${log.checkOutTime ? 'bg-gray-500' : 'bg-green-500'}`}>
                                        {log.checkOutTime ? 'OUT' : 'IN'}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-900 dark:text-white truncate">
                                        {log.member?.firstName} {log.member?.lastName}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        <Clock size={12} />
                                        {new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                {/* Checkout button - only show if member is currently checked in */}
                                {!log.checkOutTime && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                await apiClient.post('/checkin/checkout', { memberId: log.member?.memberId || log.member?.id });
                                                toast.success(tr('checkin.checkoutSuccess', 'SUCCESS: Checked Out'));
                                                fetchActivity();
                                            } catch (error) {
                                                toast.error(error.response?.data?.message || 'Check-out Failed');
                                            }
                                        }}
                                        className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 transition-all hover:scale-110 border border-rose-500/20"
                                        title={tr('checkin.checkout', 'Check Out')}
                                    >
                                        <LogOut size={16} />
                                    </button>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {checkIns.length === 0 && (
                        <div className="h-40 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
                            <Activity size={48} className="mb-4 opacity-50" />
                            <p>No activity recorded yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* CENTER: CHECK-IN KIOSK (6 Columns) */}
            <div className="w-full lg:w-6/12 flex flex-col gap-6">
                {/* Main Kiosk Card */}
                <div className="flex-1 relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col items-center justify-center p-8 lg:p-12 text-center group">

                    {/* Background Glows */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] group-hover:bg-indigo-500/30 transition-colors duration-1000" />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] group-hover:bg-pink-500/30 transition-colors duration-1000" />

                    {/* Header */}
                    <div className="relative z-10 mb-8 lg:mb-12">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700/50 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-widest uppercase mb-6">
                            <ShieldCheck size={14} /> Smart Access Control
                        </div>
                        <h1 className="text-4xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tight mb-4">
                            {tr('checkin.welcome', 'Welcome Back')}
                        </h1>
                        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                            {mode === 'manual'
                                ? tr('checkin.instructionManual', 'Enter your Member ID below to check-in')
                                : tr('checkin.instructionScan', 'Present your QR code to the scanner')}
                        </p>
                    </div>

                    {/* Interactive Area */}
                    <div className="relative z-10 w-full max-w-md mx-auto">

                        {/* Toggle Tabs */}
                        <div className="flex p-1.5 bg-gray-100 dark:bg-slate-950/50 rounded-2xl border border-gray-200 dark:border-white/5 mb-8 w-fit mx-auto backdrop-blur-sm">
                            <button
                                onClick={() => handleModeChange('manual')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${mode === 'manual' ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <Search size={18} />
                                {tr('checkin.manual', 'Member ID')}
                            </button>
                            <button
                                onClick={() => handleModeChange('scan')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${mode === 'scan' ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <QrCode size={18} />
                                {tr('checkin.scanner', 'Scan QR')}
                            </button>
                        </div>

                        {/* Input / Scanner */}
                        <div className="min-h-[200px] flex flex-col justify-end">
                            <AnimatePresence mode="wait">
                                {mode === 'manual' ? (
                                    <motion.div
                                        key="manual"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="space-y-4"
                                    >
                                        <div className="relative group">
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={memberId}
                                                onChange={(e) => setMemberId(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleCheckIn(e)}
                                                className="w-full text-center text-3xl font-bold py-6 px-6 bg-transparent border-b-2 border-gray-200 dark:border-white/20 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700 text-gray-900 dark:text-white tracking-widest"
                                                placeholder="•••• ••••"
                                                dir="ltr"
                                            />
                                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 group-focus-within:text-blue-500 transition-colors" size={24} />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={handleCheckIn}
                                                disabled={loading || !memberId}
                                                className="col-span-2 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loading ? <span className="animate-pulse">Processing...</span> : tr('checkin.action', 'Check In Now')}
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="scan"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="relative aspect-square w-64 mx-auto bg-black rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl"
                                    >
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <QrCode size={80} className="text-white/20" />
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent animate-scan" style={{ animation: 'scan 2s linear infinite' }} />
                                        <style>{`@keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }`}</style>
                                        <input
                                            autoFocus
                                            value={memberId}
                                            onChange={(e) => setMemberId(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCheckIn(e)}
                                            className="opacity-0 absolute inset-0 cursor-pointer"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {errorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute -bottom-24 left-0 right-0 flex flex-col gap-3 items-center"
                                >
                                    <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-bold text-center">
                                        {errorMessage}
                                    </div>

                                    {checkOutId && (
                                        <button
                                            onClick={handleCheckOut}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 transition-all active:scale-95 whitespace-nowrap"
                                        >
                                            <LogOut size={18} />
                                            {tr('checkin.checkoutAction', 'Check Out Member Now')}
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </div>
                </div>
            </div>

            {/* RIGHT: STATS BUTTONS (3 Columns) */}
            <div className="w-full lg:w-3/12 flex flex-col gap-4">
                <KPICard
                    title={tr('checkin.activeNow', 'Active Now')}
                    value={stats.active}
                    icon={Users}
                    color="text-green-500"
                    subtext="Members currently in facility"
                />
                <KPICard
                    title={tr('checkin.todayVisits', 'Today Visits')}
                    value={stats.today}
                    icon={Zap}
                    color="text-yellow-500"
                    subtext="Total check-ins since opening"
                />

                <div className="mt-auto p-6 rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-30 group-hover:scale-110 transition-transform duration-500">
                        <ShieldCheck size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="inline-flex p-2 bg-white/20 rounded-lg mb-4 backdrop-blur-sm">
                            <ShieldCheck size={20} />
                        </div>
                        <h4 className="font-bold text-lg mb-1">{tr('checkin.statusOK', 'System Secure')}</h4>
                        <p className="text-white/70 text-sm">Syncing in real-time. All access points operational.</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default CheckIn;
