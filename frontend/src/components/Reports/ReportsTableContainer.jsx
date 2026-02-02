import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ReportsTableContainer - Simple, clean table wrapper
 * No heavy borders, just subtle separation
 */
const ReportsTableContainer = ({
    headers = [],
    data, // Optional: Pass data directly for safer rendering
    renderRow, // Optional: Render function for data
    children,
    loading = false,
    empty = false,
    emptyMessage = 'No data available',
    emptyIcon: EmptyIcon = AlertCircle,
    className = ''
}) => {
    // 2) Implement a permanent fix: Normalize input data
    const safeRows = Array.isArray(data)
        ? data
        : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.items) ? data.items : []));

    // Ensure headers is always an array
    const safeHeaders = Array.isArray(headers) ? headers : [];

    // Safe-guard icons in case imports are issues
    const Spinner = Loader2 || (() => <div className="text-indigo-600">...</div>);
    const Alert = EmptyIcon || AlertCircle || (() => <div className="text-gray-300">!</div>);

    // Determine effective empty state
    // If children provided, trust 'empty' prop. If data provided, check safeRows length.
    const isReallyEmpty = children ? empty : (safeRows.length === 0);

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}>
            {/* Loading State */}
            {loading && (
                <div className="py-16 flex flex-col items-center justify-center">
                    <Spinner className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && isReallyEmpty && (
                <div className="py-16 flex flex-col items-center justify-center">
                    <Alert className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{emptyMessage}</p>
                </div>
            )}

            {/* Table Content */}
            {!loading && !isReallyEmpty && (
                <div className="overflow-x-auto">
                    {children ? (
                        children
                    ) : (
                        <table className="w-full text-sm">
                            {safeHeaders.length > 0 && (
                                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        {safeHeaders.map((header, idx) => (
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
                                {safeRows.map((row, idx) => renderRow ? renderRow(row, idx) : null)}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * TableRow - Individual table row component with hover effect
 */
export const ReportsTableRow = ({
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

export const ReportsTableCell = ({
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

export const ReportsTableHeader = ({ children, className = '' }) => (
    <th className={`px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ${className}`}>
        {children}
    </th>
);

// Lightweight wrappers kept for backward compatibility with legacy report pages
export const ReportsTable = ({ children, className = '' }) => (
    <div className={`overflow-x-auto ${className}`}>
        <table className="w-full text-sm">
            {children}
        </table>
    </div>
);

export const ReportsTableHead = ({ children, className = '' }) => (
    <thead className={`bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 ${className}`}>
        {children}
    </thead>
);

export const ReportsTableBody = ({ children, className = '' }) => (
    <tbody className={`divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
        {children}
    </tbody>
);

// Backward compatibility (attach to default)
ReportsTableContainer.Row = ReportsTableRow;
ReportsTableContainer.Cell = ReportsTableCell;
ReportsTableContainer.Header = ReportsTableHeader;
ReportsTableContainer.Table = ReportsTable;
ReportsTableContainer.Head = ReportsTableHead;
ReportsTableContainer.Body = ReportsTableBody;

export default ReportsTableContainer;
