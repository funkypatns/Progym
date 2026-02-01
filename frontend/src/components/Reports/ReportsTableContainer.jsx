import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ReportsTableContainer - Simple, clean table wrapper
 * No heavy borders, just subtle separation
 */
const ReportsTableContainer = ({
    headers = [],
    children,
    loading = false,
    empty = false,
    emptyMessage = 'No data available',
    emptyIcon: EmptyIcon = AlertCircle,
    className = ''
}) => {
    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}>
            {/* Loading State */}
            {loading && (
                <div className="py-16 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && empty && (
                <div className="py-16 flex flex-col items-center justify-center">
                    <EmptyIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{emptyMessage}</p>
                </div>
            )}

            {/* Table Content */}
            {!loading && !empty && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        {headers.length > 0 && (
                            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    {headers.map((header, idx) => (
                                        <th
                                            key={idx}
                                            className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        )}
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {children}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

/**
 * TableRow - Individual table row component with hover effect
 */
ReportsTableContainer.Row = ({
    children,
    onClick,
    className = ''
}) => {
    const baseClasses = 'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors';
    const clickableClasses = onClick ? 'cursor-pointer' : '';

    return (
        <tr
            onClick={onClick}
            className={`${baseClasses} ${clickableClasses} ${className}`}
        >
            {children}
        </tr>
    );
};

/**
 * TableCell - Individual table cell component
 */
ReportsTableContainer.Cell = ({
    children,
    className = '',
    align = 'left',
    ...props
}) => {
    const alignClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right'
    };

    return (
        <td
            className={`px-4 py-3 text-gray-900 dark:text-white ${alignClasses[align]} ${className}`}
            {...props}
        >
            {children}
        </td>
    );
};

/**
 * Table - Optional low-level table wrapper for custom headers/bodies.
 */
ReportsTableContainer.Table = ({ children, className = '' }) => {
    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="w-full text-sm">
                {children}
            </table>
        </div>
    );
};

/**
 * Head - Optional thead wrapper.
 */
ReportsTableContainer.Head = ({ children, className = '' }) => (
    <thead className={`bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 ${className}`}>
        {children}
    </thead>
);

/**
 * Body - Optional tbody wrapper.
 */
ReportsTableContainer.Body = ({ children, className = '' }) => (
    <tbody className={`divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
        {children}
    </tbody>
);

/**
 * Header - Optional th wrapper.
 */
ReportsTableContainer.Header = ({ children, className = '' }) => (
    <th className={`px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ${className}`}>
        {children}
    </th>
);

/**
 * AnimatedRow - Table row with staggered animation
 */
ReportsTableContainer.AnimatedRow = ({
    children,
    index = 0,
    onClick,
    className = ''
}) => {
    return (
        <motion.tr
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.2 }}
            onClick={onClick}
            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
        >
            {children}
        </motion.tr>
    );
};

export default ReportsTableContainer;
