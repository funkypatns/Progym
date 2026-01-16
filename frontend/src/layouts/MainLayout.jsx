/**
 * ============================================
 * MAIN LAYOUT WITH SIDEBAR - PREMIUM REDESIGN
 * ============================================
 */

import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    CreditCard,
    CalendarCheck,
    Receipt,
    BarChart3,
    Settings,
    LogOut,
    Sun,
    Moon,
    Globe,
    Dumbbell,
    ChevronLeft,
    ClipboardList,
    Package,
    ShieldCheck,
    Shield,
    Bell,
    ArrowUpCircle,
    ShoppingCart,
    Menu
} from 'lucide-react';
import { useAuthStore, useThemeStore, useSidebarStore, usePosStore } from '../store';
import PosShiftModal from '../components/PosShiftModal';
import NotificationBell from '../components/NotificationBell';
import { usePermissions } from '../hooks/usePermissions';
import { useSubscriptionAlerts } from '../hooks/useSubscriptionAlerts';
import { useVoiceAlerts } from '../hooks/useVoiceAlerts';

const MainLayout = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, isAuthenticated } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const { isCollapsed, toggle } = useSidebarStore();

    // Voice & Alerts
    useVoiceAlerts(true);
    const { unreadCount } = useSubscriptionAlerts();

    // POS State
    const { initialize: initPos, currentShift, machine } = usePosStore();
    const [isShiftModalOpen, setIsShiftModalOpen] = React.useState(false);

    React.useEffect(() => {
        initPos();
        const handleForbidden = async () => useAuthStore.getState().refreshSession();
        window.addEventListener('auth:forbidden', handleForbidden);

        const interval = setInterval(() => {
            if (isAuthenticated) useAuthStore.getState().refreshSession();
        }, 30000);

        return () => {
            window.removeEventListener('auth:forbidden', handleForbidden);
            clearInterval(interval);
        };
    }, [user, isAuthenticated]);

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

    // RBAC
    const { can, isAdmin, PERMISSIONS } = usePermissions();
    const isRTL = i18n.dir() === 'rtl';

    // Navigation Configuration
    const navItems = [
        { path: '/', icon: LayoutDashboard, label: t('nav.dashboard'), permission: PERMISSIONS.DASHBOARD_VIEW_BASIC },
        { path: '/members', icon: Users, label: t('nav.members'), permission: PERMISSIONS.MEMBERS_VIEW },
        { path: '/subscriptions', icon: CreditCard, label: t('nav.subscriptions'), permission: PERMISSIONS.SUBSCRIPTIONS_VIEW },
        { path: '/plans', icon: ClipboardList, label: t('nav.plans'), permission: PERMISSIONS.PLANS_VIEW },
        { path: '/checkin', icon: CalendarCheck, label: t('nav.checkin'), permission: PERMISSIONS.CHECKINS_VIEW },
        { path: '/payments', icon: Receipt, label: t('nav.payments'), permission: PERMISSIONS.PAYMENTS_VIEW },
        { path: '/sales', icon: ShoppingCart, label: t('nav.pos'), permission: PERMISSIONS.PAYMENTS_VIEW },
        { path: '/products', icon: Package, label: t('nav.products'), permission: PERMISSIONS.PLANS_VIEW },
        { path: '/reports', icon: BarChart3, label: t('nav.reports'), permission: PERMISSIONS.REPORTS_VIEW },
        { path: '/payment-alerts', icon: Bell, label: t('nav.paymentAlerts'), permission: PERMISSIONS.REPORTS_VIEW },
        { path: '/subscription-alerts', icon: Bell, label: t('nav.subscriptionAlerts'), permission: PERMISSIONS.SUBSCRIPTIONS_VIEW },
        { path: '/pay-in-out', icon: ArrowUpCircle, label: t('nav.payInOut'), permission: PERMISSIONS.PAYMENTS_VIEW },
        { path: '/settings', icon: Settings, label: t('nav.settings'), permission: PERMISSIONS.SETTINGS_VIEW },
    ];

    if (isAdmin()) {
        navItems.push(
            { path: '/employees', icon: ShieldCheck, label: t('nav.employees'), permission: PERMISSIONS.EMPLOYEES_VIEW },
            { path: '/permissions', icon: Shield, label: t('nav.permissions'), permission: PERMISSIONS.EMPLOYEES_PERMISSIONS }
        );
    }

    const visibleNavItems = navItems.filter(item => !item.permission || can(item.permission));

    // Shift Lock Screen
    if (!currentShift) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-900 dark:to-black flex flex-col items-center justify-center p-4">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border border-white/20">
                    <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-slow">
                        <Receipt className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Shift Required</h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                        Please start a new shift to access the dashboard. All transactions will be recorded under this session.
                    </p>
                    <div className="space-y-4">
                        <button onClick={() => setIsShiftModalOpen(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02]">
                            Start Critical Shift
                        </button>
                        <button onClick={handleLogout} className="w-full py-3 text-gray-500 hover:text-red-500 transition-colors font-medium">
                            Logout System
                        </button>
                    </div>
                </div>
                <PosShiftModal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} onSuccess={initPos} />
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-gray-50 dark:bg-black flex overflow-hidden font-sans ${isRTL ? 'rtl' : 'ltr'}`}>

            {/* SIDEBAR */}
            <motion.aside
                initial={false}
                animate={{ width: isCollapsed ? 80 : 280 }}
                className="fixed top-0 bottom-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-r rtl:border-l border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col transition-all duration-300 left-0 rtl:right-0 rtl:left-auto"
            >
                {/* Logo Area */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800/50">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                            <Dumbbell className="w-6 h-6 text-white" />
                        </div>
                        <AnimatePresence>
                            {!isCollapsed && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-bold text-xl tracking-tight text-gray-900 dark:text-white whitespace-nowrap">
                                    GYM<span className="text-blue-500">PRO</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <button onClick={toggle} className="p-2 -mr-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
                    {visibleNavItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group
                                ${isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-medium'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'}
                            `}
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-current'}`} />

                                    {!isCollapsed && (
                                        <span className="whitespace-nowrap flex-1">{item.label}</span>
                                    )}

                                    {/* Badge for Alerts */}
                                    {(item.path === '/subscription-alerts' && Number(unreadCount) > 0) && (
                                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                                    )}

                                    {/* Active Indicator Line for Collapsed Mode */}
                                    {isActive && isCollapsed && (
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-emerald-900/5">
                    <div className={`flex items-center gap-2 mb-4 ${isCollapsed ? 'flex-col' : 'justify-center'}`}>
                        <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 hover:scale-105 transition-transform text-gray-600 dark:text-yellow-400">
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button onClick={toggleLanguage} className="p-2.5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 hover:scale-105 transition-transform text-gray-600 dark:text-blue-400 font-bold text-xs">
                            {i18n.language === 'en' ? 'AR' : 'EN'}
                        </button>
                    </div>

                    <div className={`flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm ${isCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {user?.firstName?.[0]}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{user?.firstName}</div>
                                <div className="text-xs text-gray-500 truncate capitalize">{user?.role}</div>
                            </div>
                        )}
                        {!isCollapsed && (
                            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors">
                                <LogOut size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </motion.aside>

            {/* MAIN CONTENT AREA */}
            <main
                className={`flex-1 min-w-0 transition-all duration-300 flex flex-col ${isCollapsed ? 'ltr:ml-20 rtl:mr-20' : 'ltr:ml-[280px] rtl:mr-[280px]'}`}
            >
                {/* HEADER */}
                <header className="h-20 z-30 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8">
                    {/* Breadcrumbs / Page Title Placeholder */}
                    <div className="flex items-center gap-4">
                        <button onClick={toggle} className="md:hidden p-2 text-gray-500"><Menu /></button>
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 hidden sm:block">
                            {navItems.find(i => i.path === location.pathname)?.label || 'Gym Dashboard'}
                        </h2>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        {machine && (
                            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{machine.name}</span>
                            </div>
                        )}

                        <NotificationBell />

                        <button
                            onClick={() => setIsShiftModalOpen(true)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 ${currentShift
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                                }`}
                        >
                            <Receipt size={16} />
                            {currentShift ? <span>{currentShift.opener?.firstName}</span> : <span>Open Shift</span>}
                        </button>
                    </div>
                </header>

                {/* CONTENT */}
                <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden p-8 flex flex-col">
                    <Outlet />
                </div>
            </main>

            <PosShiftModal
                isOpen={isShiftModalOpen}
                onClose={() => setIsShiftModalOpen(false)}
                onSuccess={(type) => type === 'close' && handleLogout()}
                onLogoutOnly={async () => { await logout(); navigate('/login'); }}
            />
        </div>
    );
};

export default MainLayout;
