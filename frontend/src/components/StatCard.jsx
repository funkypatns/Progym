import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { formatNumber } from '../utils/numberFormatter';

// Animated counter component
const AnimatedCounter = ({ value, duration = 1000, locale = 'en' }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        // Handle non-numeric values gracefully
        if (typeof value === 'string') {
            // Try to parse if it's a number string, otherwise return as is for non-numeric display
            const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ""));
            if (isNaN(parsed)) {
                setCount(value);
                return;
            }
        }

        const end = parseInt(value);
        if (isNaN(end)) {
            setCount(0);
            return;
        }

        if (start === end) return;

        const timer = setInterval(() => {
            start += Math.ceil(end / (duration / 50));
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(start);
            }
        }, 50);

        return () => clearInterval(timer);
    }, [value, duration]);

    // If result is not a number (e.g. was a string currency), just show it
    if (typeof count !== 'number') return <span>{value}</span>;

    return <span>{formatNumber(count, locale)}</span>;
};

const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    color = 'blue',
    delay = 0,
    locale = 'en',
    link,
    subtitle,
    onClick
}) => {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-emerald-500 to-emerald-600',
        purple: 'from-purple-500 to-purple-600',
        orange: 'from-orange-500 to-orange-600',
        red: 'from-red-500 to-red-600',
    };

    const CardContent = () => (
        <div className="flex items-start justify-between h-full relative">
            <div className="flex flex-col justify-between h-full z-10">
                <div>
                    <p className="text-dark-400 text-sm mb-1 line-clamp-1" title={title}>{title}</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {/* Check if value is a string (currency) or number */}
                        {typeof value === 'string' && value.includes('$') ? (
                            value
                        ) : (
                            <AnimatedCounter value={value} locale={locale} />
                        )}
                    </h3>
                </div>

                <div className="mt-auto">
                    {subtitle && (
                        <p className="text-xs text-dark-500">{subtitle}</p>
                    )}
                    {trend && (
                        <div className="flex items-center gap-1 text-sm">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">{trend}%</span>
                            <span className="text-dark-500 text-xs">vs last month</span>
                        </div>
                    )}
                </div>
            </div>

            <div className={`
                p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} 
                opacity-80 group-hover:opacity-100 transition-all duration-300
                shadow-lg shadow-${color}-500/20 group-hover:scale-105
            `}>
                {Icon && <Icon className="w-6 h-6 text-white" />}
            </div>
        </div>
    );

    const containerClasses = "card-hover group h-[140px] w-full bg-white dark:bg-dark-800 rounded-2xl border border-slate-200 dark:border-dark-700 shadow-sm relative overflow-hidden cursor-pointer flex flex-col justify-between p-5";

    const contentProps = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay, duration: 0.4 },
        className: "w-full" // Ensure grid item takes full width
    };

    if (link) {
        return (
            <motion.div {...contentProps}>
                <Link to={link} className={containerClasses} onClick={onClick}>
                    <CardContent />
                </Link>
            </motion.div>
        );
    }

    return (
        <motion.div {...contentProps} onClick={onClick}>
            <div className={containerClasses}>
                <CardContent />
            </div>
        </motion.div>
    );
};

export default StatCard;
