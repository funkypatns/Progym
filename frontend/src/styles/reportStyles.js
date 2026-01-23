// Common styling patterns for report pages
// Use this as a reference when updating report components

export const reportStyles = {
    // Container spacing
    container: 'space-y-4',

    // Summary card
    summaryCard: 'bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 p-5 flex items-center justify-between',

    // Card content
    cardLabel: 'text-xs font-medium text-gray-400 uppercase tracking-wide mb-1',
    cardValue: 'text-2xl font-bold text-white',

    // Icon badge
    iconBadge: 'p-3 rounded-xl shadow-lg',

    // Toolbar container
    toolbar: 'bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 p-4',

    // Input fields
    input: 'w-full h-11 px-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm text-white',

    // Label
    label: 'text-xs font-semibold text-gray-400',

    // Buttons
    primaryButton: 'h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white',
    secondaryButton: 'h-11 px-4 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600',

    // Table container
    table: 'bg-slate-800/40 dark:bg-slate-800/40 rounded-xl border border-slate-700/50 dark:border-slate-700/50 overflow-hidden',

    // Table header
    tableHeader: 'bg-slate-900/50 border-b border-slate-700/50',
    tableHeaderCell: 'px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider',

    // Table body
    tableBody: 'divide-y divide-slate-700/50',
    tableRow: 'hover:bg-slate-700/30 transition-colors',
    tableCell: 'px-4 py-3 text-white',

    // Status badges
    statusBadge: 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',

    // Empty state
    emptyState: 'py-16 flex flex-col items-center justify-center',
    emptyIcon: 'w-12 h-12 text-gray-600 mb-3',
    emptyText: 'text-sm text-gray-400 font-medium',
};

// Color variants for icon badges
export const iconBadgeColors = {
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
};

// Color variants for status badges
export const statusBadgeColors = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    red: 'bg-red-500/20 text-red-400',
    orange: 'bg-orange-500/20 text-orange-400',
    blue: 'bg-blue-500/20 text-blue-400',
    amber: 'bg-amber-500/20 text-amber-400',
    gray: 'bg-gray-500/20 text-gray-400',
};
