/**
 * ============================================
 * FEATURE GATE COMPONENT
 * ============================================
 * 
 * Conditionally renders children based on feature flag.
 * Shows upgrade prompt for disabled features.
 */

import React from 'react';
import { useFeatureFlagsStore } from '../store';
import { Lock, Sparkles } from 'lucide-react';

/**
 * FeatureGate - Wraps content that requires a specific feature
 * 
 * @param {string} feature - Feature ID to check
 * @param {React.ReactNode} children - Content to show if enabled
 * @param {boolean} showUpgrade - Whether to show upgrade prompt when disabled
 * @param {React.ReactNode} fallback - Custom fallback content
 */
export const FeatureGate = ({
    feature,
    children,
    showUpgrade = false,
    fallback = null
}) => {
    const { isEnabled, currentPackage, initialized } = useFeatureFlagsStore();

    // Wait for initialization
    if (!initialized) {
        return null;
    }

    // Check if feature is enabled
    if (isEnabled(feature)) {
        return <>{children}</>;
    }

    // Show fallback if provided
    if (fallback) {
        return <>{fallback}</>;
    }

    // Show upgrade prompt if requested
    if (showUpgrade) {
        return (
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                    Feature Not Available
                </h3>
                <p className="text-dark-400 mb-4">
                    This feature is not included in your current package ({currentPackage?.name || 'Basic'}).
                </p>
                <button className="btn-primary bg-gradient-to-r from-purple-500 to-pink-500 border-0">
                    <Sparkles className="w-4 h-4" />
                    Upgrade Package
                </button>
            </div>
        );
    }

    // Hide content completely
    return null;
};

/**
 * useFeature - Hook to check if feature is enabled
 */
export const useFeature = (featureId) => {
    const { isEnabled, currentPackage, initialized } = useFeatureFlagsStore();

    return {
        isEnabled: initialized ? isEnabled(featureId) : false,
        currentPackage,
        isLoading: !initialized
    };
};

/**
 * Feature IDs constant for easy import
 */
export const FEATURES = {
    // Core Features (all packages)
    MEMBER_MANAGEMENT: 'member_management',
    SUBSCRIPTION_MANAGEMENT: 'subscription_management',
    CHECK_IN: 'check_in',
    PAYMENTS: 'payments',
    BASIC_REPORTS: 'basic_reports',

    // Gold Features
    MULTI_LANGUAGE: 'multi_language',
    MULTI_CURRENCY: 'multi_currency',
    ADVANCED_REPORTS: 'advanced_reports',
    DATA_EXPORT: 'data_export',
    BRANDING: 'branding',

    // Premium Features
    AI_INSIGHTS: 'ai_insights',
    CLOUD_BACKUP: 'cloud_backup',
    WHATSAPP_NOTIFICATIONS: 'whatsapp_notifications',
    AUTO_UPDATES: 'auto_updates',
    MULTI_BRANCH: 'multi_branch',
    API_ACCESS: 'api_access'
};

export default FeatureGate;
