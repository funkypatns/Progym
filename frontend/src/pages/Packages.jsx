/**
 * ============================================
 * PACKAGES MANAGEMENT PAGE
 * ============================================
 * 
 * Admin page to view and manage product packages.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Package,
    Check,
    X,
    Crown,
    Sparkles,
    Loader2,
    RefreshCw,
    Shield,
    Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFeatureFlagsStore } from '../store';

const Packages = () => {
    const { t, i18n } = useTranslation();
    const {
        currentPackage,
        allPackages,
        initialize,
        setPackage,
        isLoading,
        enabledFeatures
    } = useFeatureFlagsStore();

    const [changingPackage, setChangingPackage] = useState(null);

    useEffect(() => {
        initialize();
    }, []);

    const handleSetPackage = async (packageId) => {
        setChangingPackage(packageId);
        const result = await setPackage(packageId);
        setChangingPackage(null);

        if (result.success) {
            toast.success(`Package changed to ${packageId}`);
        } else {
            toast.error(result.message);
        }
    };

    const getPackageIcon = (pkgId) => {
        switch (pkgId) {
            case 'premium': return <Crown className="w-8 h-8" />;
            case 'gold': return <Sparkles className="w-8 h-8" />;
            default: return <Package className="w-8 h-8" />;
        }
    };

    const getPackageGradient = (pkgId) => {
        switch (pkgId) {
            case 'premium': return 'from-purple-600 to-pink-600';
            case 'gold': return 'from-amber-500 to-orange-500';
            default: return 'from-slate-500 to-slate-600';
        }
    };

    // All available features for display
    const allFeatures = [
        { id: 'member_management', name: 'Member Management', nameAr: 'إدارة الأعضاء', tier: 'basic' },
        { id: 'subscription_management', name: 'Subscription Management', nameAr: 'إدارة الاشتراكات', tier: 'basic' },
        { id: 'check_in', name: 'Check-In System', nameAr: 'نظام تسجيل الحضور', tier: 'basic' },
        { id: 'payments', name: 'Payment Tracking', nameAr: 'تتبع المدفوعات', tier: 'basic' },
        { id: 'basic_reports', name: 'Basic Reports', nameAr: 'التقارير الأساسية', tier: 'basic' },
        { id: 'multi_language', name: 'Multi-Language', nameAr: 'تعدد اللغات', tier: 'gold' },
        { id: 'multi_currency', name: 'Multi-Currency', nameAr: 'تعدد العملات', tier: 'gold' },
        { id: 'advanced_reports', name: 'Advanced Reports', nameAr: 'التقارير المتقدمة', tier: 'gold' },
        { id: 'data_export', name: 'Data Export', nameAr: 'تصدير البيانات', tier: 'gold' },
        { id: 'branding', name: 'Custom Branding', nameAr: 'العلامة التجارية', tier: 'gold' },
        { id: 'ai_insights', name: 'AI Insights', nameAr: 'رؤى الذكاء الاصطناعي', tier: 'premium' },
        { id: 'cloud_backup', name: 'Cloud Backup', nameAr: 'النسخ الاحتياطي السحابي', tier: 'premium' },
        { id: 'whatsapp_notifications', name: 'WhatsApp Notifications', nameAr: 'إشعارات واتساب', tier: 'premium' },
        { id: 'auto_updates', name: 'Auto Updates', nameAr: 'التحديثات التلقائية', tier: 'premium' },
        { id: 'multi_branch', name: 'Multi-Branch Support', nameAr: 'دعم الفروع المتعددة', tier: 'premium' },
        { id: 'api_access', name: 'API Access', nameAr: 'الوصول للـ API', tier: 'premium' },
    ];

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-dark-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        Product Packages / باقات المنتج
                    </h1>
                    <p className="text-dark-400 mt-1">
                        Manage feature packages and access levels
                    </p>
                </div>

                <button onClick={initialize} className="btn-secondary">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Current Package Banner */}
            {currentPackage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-gradient-to-r ${getPackageGradient(currentPackage.id)} p-6 rounded-2xl text-white`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                            {getPackageIcon(currentPackage.id)}
                        </div>
                        <div>
                            <p className="text-sm opacity-80">Current Package</p>
                            <h2 className="text-2xl font-bold">
                                {currentPackage.name} / {currentPackage.nameAr}
                            </h2>
                            <p className="text-sm opacity-80 mt-1">
                                {enabledFeatures.length} features enabled • Up to {currentPackage.maxMembers} members
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Packages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {allPackages.map((pkg) => (
                    <motion.div
                        key={pkg.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`card relative overflow-hidden ${pkg.isCurrent
                                ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-900'
                                : ''
                            }`}
                    >
                        {pkg.isCurrent && (
                            <div className="absolute top-3 right-3 bg-primary-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Active
                            </div>
                        )}

                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPackageGradient(pkg.id)} flex items-center justify-center text-white mb-4`}>
                            {getPackageIcon(pkg.id)}
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1">
                            {pkg.name}
                        </h3>
                        <p className="text-dark-400 text-sm mb-4">
                            {pkg.description}
                        </p>

                        <div className="text-sm text-dark-300 mb-4">
                            <span className="font-semibold text-white">{pkg.maxMembers}</span> max members
                        </div>

                        <div className="space-y-2 mb-6">
                            {pkg.features.slice(0, 5).map(feature => (
                                <div key={feature} className="flex items-center gap-2 text-sm text-dark-300">
                                    <Check className="w-4 h-4 text-emerald-400" />
                                    {allFeatures.find(f => f.id === feature)?.name || feature}
                                </div>
                            ))}
                            {pkg.features.length > 5 && (
                                <div className="text-sm text-dark-400">
                                    +{pkg.features.length - 5} more features
                                </div>
                            )}
                        </div>

                        {!pkg.isCurrent ? (
                            <button
                                onClick={() => handleSetPackage(pkg.id)}
                                disabled={changingPackage === pkg.id}
                                className={`w-full btn ${pkg.id === 'premium'
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0'
                                        : 'btn-primary'
                                    }`}
                            >
                                {changingPackage === pkg.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4" />
                                        Switch to {pkg.name}
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="w-full py-2 text-center text-dark-400 text-sm">
                                Currently Active
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Features Comparison Table */}
            <div className="card overflow-hidden">
                <h3 className="text-lg font-bold text-white mb-4">
                    Features Comparison / مقارنة المميزات
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-dark-700">
                                <th className="text-left py-3 px-4 text-dark-300 font-medium">Feature</th>
                                <th className="text-center py-3 px-4 text-slate-400">Basic</th>
                                <th className="text-center py-3 px-4 text-amber-400">Gold</th>
                                <th className="text-center py-3 px-4 text-purple-400">Premium</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allFeatures.map((feature) => (
                                <tr key={feature.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                                    <td className="py-3 px-4">
                                        <div className="text-white text-sm">{feature.name}</div>
                                        <div className="text-dark-500 text-xs">{feature.nameAr}</div>
                                    </td>
                                    <td className="text-center py-3 px-4">
                                        {feature.tier === 'basic' ? (
                                            <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                                        ) : (
                                            <X className="w-5 h-5 text-dark-600 mx-auto" />
                                        )}
                                    </td>
                                    <td className="text-center py-3 px-4">
                                        {['basic', 'gold'].includes(feature.tier) ? (
                                            <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                                        ) : (
                                            <X className="w-5 h-5 text-dark-600 mx-auto" />
                                        )}
                                    </td>
                                    <td className="text-center py-3 px-4">
                                        <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Packages;
