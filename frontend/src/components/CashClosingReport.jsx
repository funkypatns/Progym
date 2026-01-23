import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/numberFormatter';
import { formatDateTime as formatDateFn } from '../utils/dateFormatter';
import { ChevronDown, ChevronUp, CheckCircle, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { useSettingsStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';

const CashClosingReport = ({ data, onRefresh }) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();

    const [expandedClosingId, setExpandedClosingId] = useState(null);

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    const toggleExpand = (id) => {
        setExpandedClosingId(expandedClosingId === id ? null : id);
    };

    const closings = data?.closings || data?.rows || [];

    if (!closings || closings.length === 0) {
        return (
            <div className="text-center py-16 bg-slate-800/40 rounded-xl border border-slate-700/50">
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 font-semibold text-lg">No cash closings found for this period.</p>
                <p className="text-gray-500 text-sm mt-2">Create a new cash closing to begin.</p>
            </div>
        );
    }

    return (
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
                        className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden"
                    >
                        {/* Summary Header */}
                        <div
                            className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
                            onClick={() => toggleExpand(closing.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${diff === 0 ? 'bg-emerald-500' :
                                    diff > 0 ? 'bg-amber-500' :
                                        'bg-red-500'
                                    }`}>
                                    {diff === 0 ? <CheckCircle className="w-6 h-6 text-white" /> :
                                        diff > 0 ? <TrendingUp className="w-6 h-6 text-white" /> :
                                            <TrendingDown className="w-6 h-6 text-white" />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-lg">
                                        {formatDateFn(closing.endAt, i18n.language)}
                                    </h4>
                                    <p className="text-sm text-gray-400 font-medium">
                                        {closing.employeeName || 'System'} • {closing.periodType}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Declared Cash</p>
                                    <p className="font-bold text-white text-lg">
                                        {formatCurrency(closing.declaredCashAmount, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Difference</p>
                                    <p className={`font-bold text-lg ${statusColor}`}>
                                        {diff > 0 ? '+' : ''}{formatCurrency(diff, i18n.language, currencyConf)}
                                    </p>
                                </div>
                                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
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
                                    className="overflow-hidden bg-slate-900/30 border-t border-slate-700/50"
                                >
                                    <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Stats Column */}
                                        <div className="space-y-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Snapshots</h5>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400 font-medium">Expected Cash (Net):</span>
                                                <span className="font-bold text-white">{formatCurrency(closing.expectedCashAmount, i18n.language, currencyConf)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400 font-medium">Declared Cash:</span>
                                                <span className="font-bold text-white">{formatCurrency(closing.declaredCashAmount, i18n.language, currencyConf)}</span>
                                            </div>
                                            <div className="border-t border-slate-600 my-2"></div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-300 font-bold">Difference:</span>
                                                <span className={`font-bold ${statusColor}`}>{formatCurrency(closing.differenceCash, i18n.language, currencyConf)}</span>
                                            </div>
                                        </div>

                                        {/* Notes Column */}
                                        <div className="space-y-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Notes</h5>
                                            <div className="text-sm text-gray-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800 min-h-[80px] italic">
                                                {closing.notes || 'No notes provided.'}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
};

export default CashClosingReport;
