import React from 'react';
import { Search, Calendar, Users, Filter } from 'lucide-react';

/**
 * ReportsToolbar - Clean filter and action bar
 * Desktop: Single row, Mobile: Responsive grid
 */
const ReportsToolbar = ({ children, className = '' }) => {
    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 ${className}`}>
            <div className="flex flex-wrap items-end gap-3">
                {children}
            </div>
        </div>
    );
};

/**
 * DateRange - Date input component
 */
ReportsToolbar.DateRange = ({ label, value, onChange, icon: Icon = Calendar, ...props }) => {
    return (
        <div className="flex-1 min-w-[160px] space-y-1.5">
            {label && (
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Icon size={14} />
                    {label}
                </label>
            )}
            <input
                type="date"
                value={value}
                onChange={onChange}
                className="w-full h-11 px-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-gray-900 dark:text-white"
                {...props}
            />
        </div>
    );
};

/**
 * Select - Dropdown component
 */
ReportsToolbar.Select = ({ label, value, onChange, options = [], icon: Icon, placeholder = 'Select...', ...props }) => {
    return (
        <div className="flex-1 min-w-[160px] space-y-1.5">
            {label && (
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    {Icon && <Icon size={14} />}
                    {label}
                </label>
            )}
            <select
                value={value}
                onChange={onChange}
                className="w-full h-11 px-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-gray-900 dark:text-white"
                {...props}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

/**
 * SearchInput - Search input component
 */
ReportsToolbar.SearchInput = ({ label, value, onChange, placeholder = 'Search...', ...props }) => {
    return (
        <div className="flex-1 min-w-[200px] space-y-1.5">
            {label && (
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Search size={14} />
                    {label}
                </label>
            )}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="w-full h-11 pl-10 pr-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                    {...props}
                />
            </div>
        </div>
    );
};

/**
 * Actions - Container for action buttons
 */
ReportsToolbar.Actions = ({ children, className = '' }) => {
    return (
        <div className={`flex items-center gap-2 ml-auto ${className}`}>
            {children}
        </div>
    );
};

/**
 * Button - Action button component
 */
ReportsToolbar.Button = ({
    children,
    variant = 'primary',
    icon: Icon,
    disabled = false,
    onClick,
    className = '',
    ...props
}) => {
    const baseClasses = 'h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
        secondary: 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
        ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variants[variant]} ${className}`}
            {...props}
        >
            {Icon && <Icon size={18} />}
            {children}
        </button>
    );
};

export default ReportsToolbar;
