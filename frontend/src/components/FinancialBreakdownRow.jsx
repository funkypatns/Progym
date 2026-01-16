/**
 * ============================================
 * FINANCIAL BREAKDOWN BAR
 * ============================================
 * 
 * A collapsible, theme-consistent summary bar showing
 * financial breakdown by payment method.
 * 
 * Uses same backend source as Reports (/payments/summary/breakdown)
 * 
 * Features:
 * - Default collapsed (shows Total only)
 * - Expandable to show Cash/Card/Transfer breakdown
 * - RTL and i18n support
 * - Safe handling of missing data
 * - Reference-only display (does not modify data)
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Info, Banknote, CreditCard, Building, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';

const FinancialBreakdownBar = ({ stats, defaultCollapsed = true }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    // Safe accessor with default
    const safeVal = (obj, key) => {
        if (!obj || typeof obj[key] !== 'number') return 0;
        return obj[key];
    };

    // Format value safely
    const fmt = (val) => {
        if (val === null || val === undefined || isNaN(val)) return '—';
        return formatCurrency(val, i18n.language, currencyConf);
    };

    // Extract data safely
    const cash = stats?.cash || { paid: 0, refunded: 0, net: 0 };
    const card = stats?.card || { paid: 0, refunded: 0, net: 0 };
    const transfer = stats?.transfer || { paid: 0, refunded: 0, net: 0 };
    const total = stats?.total || { paid: 0, refunded: 0, net: 0 };

    // Method card component
    const MethodCard = ({ icon: Icon, label, data, color }) => (
        <div className={`flex-1 min-w-[140px] p-3 rounded-lg bg-dark-900/50 border border-dark-700/50`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded ${color}`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
            </div>
            <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">{t('financials.in', 'IN')}</span>
                    <span className="text-emerald-400 font-mono tabular-nums">{fmt(safeVal(data, 'paid'))}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">{t('financials.out', 'OUT')}</span>
                    <span className="text-red-400 font-mono tabular-nums">{fmt(safeVal(data, 'refunded'))}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-dark-700/50">
                    <span className="text-gray-400 font-medium">{t('financials.net', 'NET')}</span>
                    <span className={`font-bold font-mono tabular-nums ${safeVal(data, 'net') < 0 ? 'text-red-500' : 'text-blue-400'}`}>
                        {fmt(safeVal(data, 'net'))}
                    </span>
                </div>
            </div>
        </div>
    );

    // Collapsed summary row
    const CollapsedView = () => (
        <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">{t('financials.totalNet', 'Total Net')}</span>
                    <span className={`text-lg font-bold font-mono tabular-nums ${safeVal(total, 'net') < 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                        {fmt(safeVal(total, 'net'))}
                    </span>
                </div>
                <div className="h-4 w-px bg-dark-700" />
                <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-500">
                        <span className="text-emerald-400 font-mono">{fmt(safeVal(total, 'paid'))}</span>
                        <span className="mx-1 text-gray-600">{t('financials.in', 'IN')}</span>
                    </span>
                    <span className="text-gray-500">
                        <span className="text-red-400 font-mono">{fmt(safeVal(total, 'refunded'))}</span>
                        <span className="mx-1 text-gray-600">{t('financials.out', 'OUT')}</span>
                    </span>
                </div>
            </div>
            <button
                onClick={() => setIsCollapsed(false)}
                className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
                {t('financials.showDetails', 'Show Details')}
                <ChevronDown className="w-4 h-4" />
            </button>
        </div>
    );

    // Expanded view with all method cards
    const ExpandedView = () => (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                        {t('financials.breakdown', 'Payment Breakdown')}
                    </span>
                    <div className="group relative">
                        <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-900 border border-dark-700 rounded text-xs text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {t('financials.referenceOnly', 'Reference only — does not affect reports')}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setIsCollapsed(true)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                    {t('financials.hideDetails', 'Hide Details')}
                    <ChevronUp className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MethodCard icon={Banknote} label={t('financials.cash', 'Cash')} data={cash} color="bg-emerald-500/20" />
                <MethodCard icon={CreditCard} label={t('financials.card', 'Card')} data={card} color="bg-blue-500/20" />
                <MethodCard icon={Building} label={t('financials.transfer', 'Transfer')} data={transfer} color="bg-purple-500/20" />
                <MethodCard icon={DollarSign} label={t('financials.total', 'Total')} data={total} color="bg-primary-500/20" />
            </div>
        </div>
    );

    // Don't render if no stats at all
    if (!stats) {
        return (
            <div className="w-full bg-dark-800/50 border border-dark-700/50 rounded-xl p-3 my-4">
                <div className="flex items-center justify-center text-gray-500 text-sm">
                    <span>{t('financials.noData', 'No financial data available')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-dark-800/50 border border-dark-700/50 rounded-xl p-4 my-4 transition-all">
            {isCollapsed ? <CollapsedView /> : <ExpandedView />}
        </div>
    );
};

export default FinancialBreakdownBar;
