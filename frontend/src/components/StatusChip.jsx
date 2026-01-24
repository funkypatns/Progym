import React from 'react';

const variantClasses = {
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    neutral: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
};

const StatusChip = ({ label, variant = 'neutral', className = '' }) => {
    return (
        <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${variantClasses[variant] || variantClasses.neutral} ${className}`}
        >
            {label}
        </span>
    );
};

export default StatusChip;
