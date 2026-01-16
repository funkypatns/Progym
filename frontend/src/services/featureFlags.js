/**
 * ============================================
 * FEATURE FLAGS SERVICE (Frontend)
 * ============================================
 * 
 * Manages feature visibility based on package.
 */

import api from '../utils/api';

// Feature constants (must match backend)
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

class FeatureFlagsClient {
    constructor() {
        this.currentPackage = null;
        this.enabledFeatures = [];
        this.initialized = false;
    }

    /**
     * Initialize from API
     */
    async initialize() {
        try {
            const response = await api.get('/packages/current');
            if (response.data.success) {
                this.currentPackage = response.data.data;
                this.enabledFeatures = response.data.data.enabledFeatures || [];
                this.initialized = true;
            }
            return this.currentPackage;
        } catch (error) {
            console.error('Failed to initialize feature flags:', error);
            // Default to basic package features
            this.enabledFeatures = [
                FEATURES.MEMBER_MANAGEMENT,
                FEATURES.SUBSCRIPTION_MANAGEMENT,
                FEATURES.CHECK_IN,
                FEATURES.PAYMENTS,
                FEATURES.BASIC_REPORTS
            ];
            return null;
        }
    }

    /**
     * Check if feature is enabled
     */
    isEnabled(featureId) {
        return this.enabledFeatures.includes(featureId);
    }

    /**
     * Get current package
     */
    getPackage() {
        return this.currentPackage;
    }

    /**
     * Get all enabled features
     */
    getEnabledFeatures() {
        return this.enabledFeatures;
    }

    /**
     * Refresh from server
     */
    async refresh() {
        return this.initialize();
    }
}

// Singleton
export const featureFlagsClient = new FeatureFlagsClient();

export default featureFlagsClient;
