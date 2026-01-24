import React from 'react';

const ReportSummaryCards = ({ items = [], className = '', gridClassName = '' }) => {
    if (!items || items.length === 0) return null;

    const gridClasses = ['grid grid-cols-1 gap-4', gridClassName, className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={gridClasses}>
            {items.map((item, idx) => {
                const Icon = item.icon;
                const valueClass = item.valueClassName || 'text-2xl font-bold text-white';
                return (
                    <div
                        key={item.key || item.label || idx}
                        className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 flex items-center justify-between"
                    >
                        <div className="flex-1">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                                {item.label}
                            </p>
                            <div className={valueClass}>
                                {item.value}
                            </div>
                            {item.subValue && (
                                <div className="text-xs text-gray-400 mt-1">
                                    {item.subValue}
                                </div>
                            )}
                        </div>
                        {Icon && (
                            <div className={`p-3 rounded-xl ${item.iconClassName || 'bg-slate-700'}`}>
                                <Icon className={`w-6 h-6 ${item.iconColorClassName || 'text-white'}`} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ReportSummaryCards;
