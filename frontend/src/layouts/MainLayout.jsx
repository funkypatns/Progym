/**
 * ============================================
 * MAIN LAYOUT - GLASS ENTERPRISE EDITION
 * ============================================
 */

import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Users, CreditCard, CalendarCheck, Receipt,
    BarChart3, Settings, LogOut, Sun, Moon, Globe, Dumbbell,
    ChevronLeft, ClipboardList, Package, ShieldCheck, Shield,
    Bell, ArrowUpCircle, ShoppingCart, Menu, Search, Calendar, Briefcase, LifeBuoy
} from 'lucide-react';
import { useAuthStore, useThemeStore, useSidebarStore, usePosStore, useSettingsStore } from '../store';
import PosShiftModal from '../components/PosShiftModal';
import NotificationBell from '../components/NotificationBell';
import { usePermissions } from '../hooks/usePermissions';
import { useSubscriptionAlerts } from '../hooks/useSubscriptionAlerts';
import { useVoiceAlerts } from '../hooks/useVoiceAlerts';
import PermissionDebug from '../components/PermissionDebug';

const MainLayout = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, isAuthenticated } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const { isCollapsed, toggle } = useSidebarStore();
    const isDark = theme === 'dark';
    const { getSetting } = useSettingsStore();
    const gymName = getSetting('gym_name', 'GYMPRO') || 'GYMPRO';

    // Voice & Alerts
    useVoiceAlerts(true);
    const { unreadCount } = useSubscriptionAlerts();

    // POS State
    const { initialize: initPos, currentShift, machine } = usePosStore();
    const [isShiftModalOpen, setIsShiftModalOpen] = React.useState(false);

    React.useEffect(() => {
        if (isAuthenticated) {
            initPos();
        }
    }, [isAuthenticated, initPos]);

    React.useEffect(() => {
        const handleForbidden = async () => useAuthStore.getState().refreshSession();
        const handleOpenShift = () => setIsShiftModalOpen(true);
        window.addEventListener('auth:forbidden', handleForbidden);
        window.addEventListener('shift:open', handleOpenShift);
        return () => {
            window.removeEventListener('auth:forbidden', handleForbidden);
            window.removeEventListener('shift:open', handleOpenShift);
        };
    }, []);

    // Sync Global Direction & Language
    React.useEffect(() => {
        document.documentElement.dir = i18n.dir();
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    const handleLogout = async () => {
        if (currentShift) {
            setIsShiftModalOpen(true);
            return;
        }
        await logout();
        navigate('/login');
    };

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'ar' : 'en';
        i18n.changeLanguage(newLang);
    };

    const { can, isAdmin, PERMISSIONS } = usePermissions();
    const isRTL = i18n.dir() === 'rtl';

    // Safe Label Helper with Fallbacks
    const safeT = (key, fallback) => {
        const val = t(key, { defaultValue: fallback });
        const normalized = typeof val === 'string' ? val : String(val || '');
        if (!normalized || normalized === key) return fallback;
        return normalized;
    };

    // Navigation Items
    const navItems = [
        { path: '/', icon: LayoutDashboard, label: safeT('nav.dashboard', isRTL ? 'لوحة التحكم' : 'Dashboard'), permission: PERMISSIONS.DASHBOARD_VIEW_BASIC },
        { path: '/members', icon: Users, label: safeT('nav.members', isRTL ? 'الأعضاء' : 'Members'), permission: PERMISSIONS.MEMBERS_VIEW },
        { path: '/subscriptions', icon: CreditCard, label: safeT('nav.subscriptions', isRTL ? 'الاشتراكات' : 'Subscriptions'), permission: PERMISSIONS.SUBSCRIPTIONS_VIEW },
        { path: '/session-packs', icon: CalendarCheck, label: safeT('nav.sessionPacks', isRTL ? 'باقات الجلسات' : 'Session Packs'), permission: PERMISSIONS.SUBSCRIPTIONS_VIEW },
        { path: '/plans', icon: ClipboardList, label: safeT('nav.plans', isRTL ? 'الخطط' : 'Plans'), permission: PERMISSIONS.PLANS_VIEW },
        { path: '/checkin', icon: CalendarCheck, label: safeT('nav.checkin', isRTL ? 'تسجيل الحضور' : 'Check-in'), permission: PERMISSIONS.CHECKINS_VIEW },
        { path: '/appointments', icon: Calendar, label: safeT('nav.appointments', isRTL ? 'المواعيد' : 'Appointments'), permission: PERMISSIONS.APPOINTMENTS_VIEW },
        { path: '/coaches', icon: Briefcase, label: safeT('nav.coaches', isRTL ? 'المدربين' : 'Coaches'), permission: PERMISSIONS.COACHES_VIEW },
        { path: '/payments', icon: Receipt, label: safeT('nav.payments', isRTL ? 'المدفوعات' : 'Payments'), permission: PERMISSIONS.PAYMENTS_VIEW },
        { path: '/sales', icon: ShoppingCart, label: safeT('nav.pos', isRTL ? 'نقاط البيع' : 'POS'), permission: PERMISSIONS.PAYMENTS_VIEW },
        { path: '/products', icon: Package, label: safeT('nav.products', isRTL ? 'المنتجات' : 'Products'), permission: PERMISSIONS.PLANS_VIEW },
        { path: '/reports', icon: BarChart3, label: safeT('nav.reports', isRTL ? 'التقارير' : 'Reports'), permission: PERMISSIONS.REPORTS_VIEW },
        { path: '/payment-alerts', icon: Bell, label: safeT('nav.paymentAlerts', isRTL ? 'تنبيهات الدفع' : 'Payment Alerts'), permission: PERMISSIONS.REPORTS_VIEW },
        { path: '/subscription-alerts', icon: Bell, label: safeT('nav.subscriptionAlerts', isRTL ? 'تنبيهات الاشتراكات' : 'Subscription Alerts'), permission: PERMISSIONS.SUBSCRIPTIONS_VIEW },
        { path: '/pay-in-out', icon: ArrowUpCircle, label: safeT('nav.payInOut', isRTL ? 'صادر / وارد' : 'Pay In/Out'), permission: PERMISSIONS.PAYMENTS_VIEW },
        { path: '/support', icon: LifeBuoy, label: safeT('nav.support', isRTL ? 'الدعم / تواصل معنا' : 'Support / Contact Us') },
        { path: '/settings', icon: Settings, label: safeT('nav.settings', isRTL ? 'الإعدادات' : 'Settings'), permission: PERMISSIONS.SETTINGS_VIEW },
    ];

    if (isAdmin()) {
        navItems.push(
            { path: '/employees', icon: ShieldCheck, label: safeT('nav.employees', isRTL ? 'الموظفين' : 'Employees'), permission: PERMISSIONS.EMPLOYEES_VIEW },
            { path: '/staff-trainers', icon: ShieldCheck, label: safeT('nav.staffTrainers', isRTL ? 'المدربين' : 'Trainers'), permission: PERMISSIONS.COACHES_VIEW },
            { path: '/permissions', icon: Shield, label: safeT('nav.permissions', isRTL ? 'الصلاحيات' : 'Permissions'), permission: PERMISSIONS.EMPLOYEES_PERMISSIONS }
        );
    }

    const visibleNavItems = navItems.filter(item => !item.permission || can(item.permission));

    // Locked Screen (No Shift)
    const allowSupportWithoutShift = location.pathname === '/support';
    if (!currentShift && !allowSupportWithoutShift) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-black z-0 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 blur-[120px] rounded-full" />

                <div className="relative z-10 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl p-10 max-w-md w-full text-center">
                    <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-glow">
                        <Receipt className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Shift Locked</h1>
                    <p className="text-gray-400 mb-10 leading-relaxed text-lg">
                        System access is restricted. Please start a secure shift session to proceed.
                    </p>
                    <div className="space-y-4">
                        <button onClick={() => setIsShiftModalOpen(true)}
                            className="w-full py-4 bg-white text-black hover:bg-gray-100 rounded-xl font-bold shadow-lg transition-all active:scale-95 text-lg">
                            Start Session
                        </button>
                        <button onClick={handleLogout} className="w-full py-4 text-gray-500 hover:text-white transition-colors font-medium">
                            Logout
                        </button>
                    </div>
                </div>
                <PosShiftModal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} onSuccess={initPos} />
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex overflow-hidden font-sans ${isRTL ? 'rtl' : 'ltr'}`}
            style={{
                background: isDark
                    ? 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #020617 100%)'
                    : 'radial-gradient(circle at 50% 0%, #f1f5f9 0%, #e2e8f0 100%)'
            }}>

            {/* GLASS SIDEBAR */}
            <motion.aside
                initial={false}
                animate={{ width: isCollapsed ? 88 : 280 }}
                className={`fixed top-4 bottom-4 z-40 rounded-2xl border flex flex-col transition-all duration-300 shadow-2xl backdrop-blur-xl
                    ${isDark
                        ? 'bg-slate-900/60 border-white/10'
                        : 'bg-white/70 border-white/40 shadow-blue-500/5'}
                    ${isRTL ? 'right-4 left-auto' : 'left-4 right-auto'}
                `}
            >
                {/* Brand */}
                <div className="h-24 flex items-center justify-center border-b border-white/5 relative">
                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Dumbbell className="text-white w-6 h-6" />
                        </div>
                        <span
                            title={gymName}
                            className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 truncate max-w-[180px]"
                        >
                            {gymName}
                        </span>
                    </div>
                    {isCollapsed && (
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30 absolute">
                            <Dumbbell className="text-white w-6 h-6" />
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 no-scrollbar">
                    {visibleNavItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group overflow-hidden
                                ${isActive
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-white/10 hover:text-indigo-400 dark:hover:text-white'}
                            `}
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon className="w-5 h-5 flex-shrink-0 z-10 relative" />
                                    {!isCollapsed && (
                                        <span className="font-medium tracking-wide z-10 relative text-sm">{item.label}</span>
                                    )}
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 z-0" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>

                {/* Footer User Info */}
                <div className="p-4 bg-black/20 backdrop-blur-md rounded-b-2xl border-t border-white/5">
                    <div className={`flex items-center gap-3 p-2 rounded-xl border border-white/5 bg-white/5 ${isCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                            {user?.firstName?.[0]}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{user?.firstName}</p>
                                <p className="text-xs text-indigo-300 uppercase tracking-wider">{user?.role}</p>
                            </div>
                        )}
                        <button onClick={handleLogout}>
                            <LogOut size={18} className="text-gray-400 hover:text-red-400 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Toggles (Absolute positioned outside) */}
                <button onClick={toggle} className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg border-4 border-slate-900 transition-all hover:scale-110 z-50 ${isRTL ? '-left-4' : '-right-4'}`}>
                    <ChevronLeft size={14} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
                </button>

            </motion.aside>

            {/* MAIN CONTENT WRAPPER */}
            <main className={`flex-1 transition-all duration-300 flex flex-col relative h-screen
                ${isCollapsed ? (isRTL ? 'mr-[120px]' : 'ml-[120px]') : (isRTL ? 'mr-[320px]' : 'ml-[320px]')}
            `}>

                {/* GLASS HEADER */}
                <header className="h-20 shrink-0 px-8 flex items-center justify-between z-30 sticky top-0">

                    {/* Page Title */}
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 uppercase tracking-tight">
                            {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wider">
                            {new Date().toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    {/* Right Tools */}
                    <div className="flex items-center gap-4 bg-white/5 p-1.5 pr-2 pl-4 rounded-full border border-white/10 backdrop-blur-md shadow-lg">
                        <div className="flex items-center gap-2">
                            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-white/10 text-gray-500 dark:text-gray-300 transition-colors">
                                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                            <button onClick={toggleLanguage} className="p-2 rounded-full hover:bg-white/10 text-gray-500 dark:text-gray-300 font-bold text-xs transition-colors">
                                {isRTL ? 'EN' : 'AR'}
                            </button>
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        <NotificationBell />
                        <button onClick={() => setIsShiftModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-full font-bold text-sm hover:shadow-glow transition-all">
                            <Receipt size={14} />
                            <span>{currentShift?.opener?.firstName || 'Shift'}</span>
                        </button>
                    </div>
                </header>

                {/* SCROLLABLE VIEWPORT */}
                <div className="flex-1 overflow-y-auto min-h-0 w-full p-4 lg:p-8 overflow-x-hidden scroll-smooth">
                    <Outlet />
                </div>

            </main>

            <PosShiftModal
                isOpen={isShiftModalOpen}
                onClose={() => setIsShiftModalOpen(false)}
                onSuccess={(type) => type === 'close' && handleLogout()}
                onLogoutOnly={async () => { await logout(); navigate('/login'); }}
            />
            {/* Debug Tools */}
            <PermissionDebug />
        </div>
    );
};

export default MainLayout;
