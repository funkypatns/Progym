import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Modern Report Layout Component
 * Implements the unified design pattern for all report pages
 * Features: RTL support, metric cards, filter bar, empty states
 */

const ReportLayout = ({ children }) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    return (
        <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
            {children}
        </div>
    );
};

/**
 * Report Header Component
 * Icon + Title + Subtitle in a styled container
 */
ReportLayout.Header = ({ icon: Icon, title, subtitle, className = '' }) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    return (
        <div className={`flex items-center gap-4 mb-6 ${isRTL ? 'flex-row-reverse' : 'flex-row'} ${className}`}>
            {Icon && (
                <div className="flex-shrink-0 w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
                    <Icon size={28} strokeWidth={2.5} />
                </div>
            )}
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                <h1 className="text-2xl font-black text-white tracking-tight">
                    {title}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                    {subtitle}
                </p>
            </div>
        </div>
    );
};

/**
 * Filter Bar Component
 * Horizontal filters container with responsive grid
 */
ReportLayout.FilterBar = ({ children, className = '' }) => {
    return (
        <div className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5 mb-6 ${className}`}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
                {children}
            </div>
        </div>
    );
};

/**
 * Date Range Input
 */
ReportLayout.DateInput = ({ label, value, onChange, icon: Icon, ...props }) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    return (
        <div className="space-y-2">
            {label && (
                <label className={`text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
                    {Icon && <Icon size={14} />}
                    {label}
                </label>
            )}
            <input
                type="date"
                value={value}
                onChange={onChange}
                className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                {...props}
            />
        </div>
    );
};

/**
 * Search Input
 */
ReportLayout.SearchInput = ({ label, value, onChange, placeholder, icon: Icon, ...props }) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    return (
        <div className="space-y-2">
            {label && (
                <label className={`text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
                    {Icon && <Icon size={14} />}
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <Icon className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-slate-500`} size={16} />
                )}
                <input
                    type="text"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`w-full bg-slate-900/70 border border-slate-700 rounded-xl ${Icon ? (isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4') : 'px-4'} py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition`}
                    {...props}
                />
            </div>
        </div>
    );
};

/**
 * Refresh Button
 */
ReportLayout.RefreshButton = ({ onClick, loading, children, icon: Icon, ...props }) => {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
            {...props}
        >
            {Icon && <Icon size={18} className={loading ? 'animate-spin' : ''} />}
            {children}
        </button>
    );
};

/**
 * Metric Cards Grid
 */
ReportLayout.MetricsGrid = ({ children, className = '' }) => {
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 ${className}`}>
            {children}
        </div>
    );
};

/**
 * Individual Metric Card
 */
ReportLayout.MetricCard = ({
    icon: Icon,
    label,
    value,
    color = 'blue',
    trend,
    loading = false,
    className = '',
    center = false,
    subtitle = null
}) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    const colorClasses = {
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        teal: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        red: 'bg-red-500/10 border-red-500/20 text-red-400',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        slate: 'bg-slate-700/30 border-slate-600/20 text-slate-400'
    };

    const iconColorClasses = {
        blue: 'text-blue-400',
        teal: 'text-teal-400',
        amber: 'text-amber-400',
        red: 'text-red-400',
        emerald: 'text-emerald-400',
        slate: 'text-slate-400'
    };

    return (
        <div className={`${colorClasses[color]} border rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm transition-all hover:scale-[1.02] ${className}`}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''} ${center ? 'justify-center text-center flex-col' : ''}`}>
                {/* Icon Logic: If centered, show above or hide? User says "Centre the net header". Usually Icon is on side. Let's keep icon on side unless centered? 
                    If centered, maybe icon is top? 
                    Let's follow standard card logic but align text center.
                 */}
                {Icon && (
                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center ${iconColorClasses[color]} ${center ? 'mb-2' : ''}`}>
                        <Icon size={20} strokeWidth={2} />
                    </div>
                )}

                <div className={`flex-1 ${center ? 'text-center' : (isRTL ? 'text-right' : 'text-left')}`}>
                    <div className={`text-xs font-bold uppercase tracking-wider opacity-80 mb-2 ${center ? 'flex justify-center' : ''}`}>
                        {label}
                    </div>
                    {loading ? (
                        <div className={`h-9 w-24 bg-white/10 rounded animate-pulse ${center ? 'mx-auto' : ''}`}></div>
                    ) : (
                        <div className="text-3xl font-black text-white leading-none">
                            {value}
                        </div>
                    )}
                    {(trend || subtitle) && (
                        <div className="text-xs mt-2 opacity-70 font-medium">
                            {trend || subtitle}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Content Container
 */
ReportLayout.Content = ({ children, className = '' }) => {
    return (
        <div className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden ${className}`}>
            {children}
        </div>
    );
};

/**
 * Empty State Component
 */
ReportLayout.EmptyState = ({ icon: Icon, title, subtitle, action, className = '' }) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    return (
        <div className={`flex flex-col items-center justify-center py-20 px-6 ${className}`}>
            {Icon && (
                <div className="w-20 h-20 rounded-full bg-slate-700/30 flex items-center justify-center mb-6">
                    <Icon size={40} className="text-slate-500" strokeWidth={1.5} />
                </div>
            )}
            {title && (
                <h3 className="text-lg font-bold text-slate-300 mb-2 text-center">
                    {title}
                </h3>
            )}
            {subtitle && (
                <p className="text-sm text-slate-500 text-center max-w-md mb-6">
                    {subtitle}
                </p>
            )}
            {action}
        </div>
    );
};

export default ReportLayout;
