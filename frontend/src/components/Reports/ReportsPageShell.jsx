import React from 'react';
import { motion } from 'framer-motion';

/**
 * ReportsPageShell - Main container for all report pages
 * Provides consistent spacing and layout without heavy frames
 */
const ReportsPageShell = ({
    title,
    subtitle,
    actions,
    children
}) => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="p-6 md:p-8 space-y-6">
                {/* Header Section - Optional */}
                {(title || subtitle || actions) && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            {title && (
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {title}
                                </h1>
                            )}
                            {subtitle && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        {actions && (
                            <div className="flex items-center gap-3">
                                {actions}
                            </div>
                        )}
                    </div>
                )}

                {/* Main Content - No heavy frame */}
                <div className="space-y-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default ReportsPageShell;
