import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, UserPlus, TrendingUp, AlertTriangle } from 'lucide-react';
import { analyticsService } from '../services/analyticsService';

const SmartInsights = ({ stats, delay = 0 }) => {
    const { t, i18n } = useTranslation();
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const fetchInsights = async () => {
            setLoading(true);
            try {
                const data = await analyticsService.generateInsights(stats, i18n.language);
                setInsights(data);
            } catch (error) {
                console.error('Failed to generate insights', error);
            } finally {
                setLoading(false);
            }
        };

        if (stats) {
            fetchInsights();
        }
    }, [stats, i18n.language]);

    // Auto-rotate insights every 8 seconds
    useEffect(() => {
        if (insights.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % insights.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [insights]);

    if (loading || insights.length === 0) return null;

    const currentInsight = insights[currentIndex];

    // Icon mapping
    const getIcon = (type) => {
        switch (type) {
            case 'positive': return <TrendingUp className="w-5 h-5 text-emerald-400" />;
            case 'negative': return <AlertTriangle className="w-5 h-5 text-red-400" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
            default: return <Sparkles className="w-5 h-5 text-primary-400" />;
        }
    };

    const getGradient = (type) => {
        switch (type) {
            case 'positive': return 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20';
            case 'negative': return 'from-red-500/10 to-red-500/5 border-red-500/20';
            case 'warning': return 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20';
            default: return 'from-primary-500/10 to-primary-500/5 border-primary-500/20';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`relative overflow-hidden rounded-xl border p-4 bg-gradient-to-br ${getGradient(currentInsight.type)}`}
        >
            <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-dark-800/50 backdrop-blur-sm">
                    {getIcon(currentInsight.type)}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            {t('dashboard.aiInsights')}
                            {insights.length > 1 && (
                                <span className="text-xs font-normal text-slate-500 dark:text-dark-400 bg-white/50 dark:bg-dark-800/50 px-2 py-0.5 rounded-full">
                                    {currentIndex + 1}/{insights.length}
                                </span>
                            )}
                        </h3>
                    </div>

                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{currentInsight.title}</p>
                            <p className="text-xs text-slate-500 dark:text-dark-400 leading-relaxed">
                                {currentInsight.message}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Progress Bar for Auto-Rotation */}
            {insights.length > 1 && (
                <div className="absolute bottom-0 left-0 h-1 bg-primary-500/20 w-full">
                    <motion.div
                        key={currentIndex}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 8, ease: "linear" }}
                        className="h-full bg-primary-500/50"
                    />
                </div>
            )}
        </motion.div>
    );
};

export default SmartInsights;
