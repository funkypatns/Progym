import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/numberFormatter';
import { formatDateTime as formatDateFn } from '../utils/dateFormatter';
import { ChevronDown, ChevronUp, CheckCircle, TrendingDown, TrendingUp, DollarSign, BarChart3, AlertCircle, Calendar } from 'lucide-react';
import { useSettingsStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import StatCard from '../components/StatCard';
import ReportLayout from './Reports/ReportLayout';

const CashClosingReport = ({ data, onRefresh }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const isRTL = i18n.language === 'ar';

    const [expandedClosingId, setExpandedClosingId] = useState(null);

    const currencyConf = {
        code: getSetting('currency_code', 'EGP'),
        symbol: getSetting('currency_symbol', 'EGP')
    };

    const toggleExpand = (id) => {
        setExpandedClosingId(expandedClosingId === id ? null : id);
    };

    const closings = data?.closings || data?.rows || [];

    const summary = useMemo(() => {
        return closings.reduce((acc, closing) => {
            const expected = closing.expectedCashAmount || 0;
            const declared = closing.declaredCashAmount || 0;
            const diff = typeof closing.differenceCash === 'number'
                ? closing.differenceCash
                : (declared - expected);

            acc.count += 1;
            acc.expected += expected;
            acc.declared += declared;
            acc.diff += diff;
            if (diff < 0) acc.shortage += Math.abs(diff); // Shortage is negative diff
            if (diff > 0) acc.overage += diff;
            return acc;
        }, {
            count: 0,
            expected: 0,
            declared: 0,
            diff: 0,
            shortage: 0,
            overage: 0
        });
    }, [closings]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                    title={t('cashClosing.totalClosings', 'Total Closings')}
                    value={summary.count}
                    icon={BarChart3}
                    color="blue"
                />
                <StatCard
                    title={t('cashClosing.expectedCash', 'Expected Cash')}
                    value={formatCurrency(summary.expected, i18n.language, currencyConf)}
                    icon={DollarSign}
                    color="indigo"
                />
                <StatCard
                    title={t('cashClosing.declaredCash', 'Declared Cash')}
                    value={formatCurrency(summary.declared, i18n.language, currencyConf)}
                    icon={CheckCircle}
                    color="emerald"
                />
                <StatCard
                    title={t('cashClosing.status.shortage', 'Shortage')}
                    value={summary.shortage > 0
                        ? `-${formatCurrency(summary.shortage, i18n.language, currencyConf)}`
                        : formatCurrency(0, i18n.language, currencyConf)}
                    icon={TrendingDown}
                    color="red"
                />
                <StatCard
                    title={t('cashClosing.status.overage', 'Overage')}
                    value={summary.overage > 0
                        ? `+${formatCurrency(summary.overage, i18n.language, currencyConf)}`
                        : formatCurrency(0, i18n.language, currencyConf)}
                    icon={TrendingUp}
                    color="amber"
                />
            </div>

            {/* Closings List */}
            {(!closings || closings.length === 0) ? (
                <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <div className="bg-slate-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <DollarSign className="w-10 h-10 text-slate-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{t('cashClosing.noClosings', 'No closings found')}</h3>
                    <p className="text-slate-400">{t('cashClosing.createClosing', 'Create a closing to see data here')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {closings.map(closing => {
                        const diff = closing.differenceTotal;
                        const statusColor = diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-amber-400' : 'text-red-400';
                        const isExpanded = expandedClosingId === closing.id;

                        return (
                            <motion.div
                                key={closing.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`
                                    relative overflow-hidden rounded-2xl transition-all duration-300 border
                                    ${isExpanded
                                        ? 'bg-slate-800/80 border-blue-500/30 ring-1 ring-blue-500/20'
                                        : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-800/60'}
                                    backdrop-blur-md
                                `}
                            >
                                {/* Summary Header */}
                                <div
                                    className="p-6 flex items-center justify-between cursor-pointer"
                                    onClick={() => toggleExpand(closing.id)}
                                >
                                    <div className={`flex items-center gap-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <div className={`
                                            w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg
                                            ${diff === 0 ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-400' :
                                                diff > 0 ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400' :
                                                    'bg-gradient-to-br from-red-500/20 to-red-600/10 text-red-400'
                                            }
                                        `}>
                                            {diff === 0 ? <CheckCircle className="w-7 h-7" /> :
                                                diff > 0 ? <TrendingUp className="w-7 h-7" /> :
                                                    <TrendingDown className="w-7 h-7" />}
                                        </div>
                                        <div className={isRTL ? 'text-right' : 'text-left'}>
                                            <h4 className="font-bold text-white text-lg flex items-center gap-2">
                                                {formatDateFn(closing.endAt, i18n.language)}
                                                {isExpanded && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Active</span>}
                                            </h4>
                                            <div className="flex items-center gap-2 text-sm text-slate-400 font-medium mt-1">
                                                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-xs uppercase tracking-wider">
                                                    {t(`cashClosing.periodType.${closing.periodType}`, closing.periodType)}
                                                </span>
                                                <span>•</span>
                                                <span className="text-slate-300">{closing.employeeName || t('cashClosing.allEmployees', 'System')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`flex items-center gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <div className={`hidden sm:block ${isRTL ? 'text-left' : 'text-right'}`}>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('cashClosing.declaredCash', 'Declared')}</p>
                                            <p className="font-bold text-white text-lg tracking-tight">
                                                {formatCurrency(closing.declaredCashAmount, i18n.language, currencyConf)}
                                            </p>
                                        </div>
                                        <div className={`hidden sm:block ${isRTL ? 'text-left' : 'text-right'}`}>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('cashClosing.differenceCash', 'Diff')}</p>
                                            <p className={`font-black text-xl tracking-tight ${statusColor}`}>
                                                {diff > 0 ? '+' : ''}{formatCurrency(diff, i18n.language, currencyConf)}
                                            </p>
                                        </div>
                                        <div className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}>
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden bg-slate-900/50 border-t border-white/5"
                                        >
                                            <div className="p-6">
                                                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                                                    <div className="bg-slate-900 rounded-xl p-5 border border-white/5 relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                                            <DollarSign className="w-16 h-16 transform translate-x-4 -translate-y-4" />
                                                        </div>
                                                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                                                            {t('cashClosing.expectedCash', 'Expected Cash')}
                                                        </p>
                                                        <p className="text-2xl font-black text-white">
                                                            {formatCurrency(closing.expectedCashAmount, i18n.language, currencyConf)}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-900 rounded-xl p-5 border border-white/5 relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                                            <Calendar className="w-16 h-16 transform translate-x-4 -translate-y-4" />
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                            {t('cashClosing.expectedNonCash', 'Expected Non-Cash')}
                                                        </p>
                                                        <p className="text-2xl font-black text-white">
                                                            {formatCurrency(closing.expectedNonCashAmount, i18n.language, currencyConf)}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-900 rounded-xl p-5 border border-white/5 relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                                            <CheckCircle className="w-16 h-16 transform translate-x-4 -translate-y-4" />
                                                        </div>
                                                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                                                            {t('cashClosing.totalExpected', 'Total Expected')}
                                                        </p>
                                                        <p className="text-2xl font-black text-white">
                                                            {formatCurrency(closing.expectedTotalAmount, i18n.language, currencyConf)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {closing.notes && (
                                                    <div className={`mt-4 bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3 items-start ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                                        <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                                                                {t('common.notes', 'Notes')}
                                                            </p>
                                                            <p className="text-sm text-slate-300 leading-relaxed">
                                                                {closing.notes}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CashClosingReport;
