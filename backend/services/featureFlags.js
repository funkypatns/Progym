/**
 * ============================================
 * FEATURE FLAGS ENGINE
 * ============================================
 * 
 * Controls which features are enabled based on
 * the current product package (Basic, Gold, Premium).
 * 
 * Author: Omar Habib Software
 */

// ============================================
// PACKAGES MODE CONFIGURATION
// ============================================
// Set to 'hidden' to hide packages from UI and enable ALL features
// Set to 'visible' to show packages and enforce feature limits
// Can be overridden by environment variable: PACKAGES_MODE
const PACKAGES_MODE = process.env.PACKAGES_MODE || 'hidden';

/**
 * Check if packages UI should be visible
 */
function isPackagesVisible() {
    return PACKAGES_MODE === 'visible';
}

/**
 * Get all feature IDs for full access mode
 */
function getAllFeatureIds() {
    return Object.values(FEATURES);
}

// ============================================
// FEATURE DEFINITIONS
// ============================================

const FEATURES = {
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

// ============================================
// PACKAGE DEFINITIONS
// ============================================

const PACKAGES = {
    basic: {
        id: 'basic',
        name: 'Basic',
        nameAr: 'أساسي',
        description: 'Essential features for small gyms',
        color: '#6B7280', // Gray
        maxMembers: 100,
        features: [
            FEATURES.MEMBER_MANAGEMENT,
            FEATURES.SUBSCRIPTION_MANAGEMENT,
            FEATURES.CHECK_IN,
            FEATURES.PAYMENTS,
            FEATURES.BASIC_REPORTS
        ]
    },
    gold: {
        id: 'gold',
        name: 'Gold',
        nameAr: 'ذهبي',
        description: 'Advanced features for growing gyms',
        color: '#F59E0B', // Amber
        maxMembers: 500,
        features: [
            // All Basic features
            FEATURES.MEMBER_MANAGEMENT,
            FEATURES.SUBSCRIPTION_MANAGEMENT,
            FEATURES.CHECK_IN,
            FEATURES.PAYMENTS,
            FEATURES.BASIC_REPORTS,
            // Gold features
            FEATURES.MULTI_LANGUAGE,
            FEATURES.MULTI_CURRENCY,
            FEATURES.ADVANCED_REPORTS,
            FEATURES.DATA_EXPORT,
            FEATURES.BRANDING
        ]
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        nameAr: 'مميز',
        description: 'Full suite for professional gyms',
        color: '#8B5CF6', // Purple
        maxMembers: 9999,
        features: [
            // All Basic features
            FEATURES.MEMBER_MANAGEMENT,
            FEATURES.SUBSCRIPTION_MANAGEMENT,
            FEATURES.CHECK_IN,
            FEATURES.PAYMENTS,
            FEATURES.BASIC_REPORTS,
            // Gold features
            FEATURES.MULTI_LANGUAGE,
            FEATURES.MULTI_CURRENCY,
            FEATURES.ADVANCED_REPORTS,
            FEATURES.DATA_EXPORT,
            FEATURES.BRANDING,
            // Premium features
            FEATURES.AI_INSIGHTS,
            FEATURES.CLOUD_BACKUP,
            FEATURES.WHATSAPP_NOTIFICATIONS,
            FEATURES.AUTO_UPDATES,
            FEATURES.MULTI_BRANCH,
            FEATURES.API_ACCESS
        ]
    }
};

// ============================================
// FEATURE FLAGS SERVICE
// ============================================

class FeatureFlagsService {
    constructor() {
        this.currentPackage = 'basic';
        this.customFeatures = []; // Additional features enabled by license
        this.disabledFeatures = []; // Features explicitly disabled
    }

    /**
     * Initialize from license data
     */
    initFromLicense(license) {
        if (license?.packageType) {
            this.currentPackage = license.packageType;
        }
        if (license?.enabledFeatures) {
            this.customFeatures = license.enabledFeatures;
        }
        if (license?.disabledFeatures) {
            this.disabledFeatures = license.disabledFeatures;
        }
    }

    /**
     * Set current package
     */
    setPackage(packageId) {
        if (PACKAGES[packageId]) {
            this.currentPackage = packageId;
        }
    }

    /**
     * Get current package info
     */
    getPackage() {
        return PACKAGES[this.currentPackage] || PACKAGES.basic;
    }

    /**
     * Get all packages
     */
    getAllPackages() {
        return Object.values(PACKAGES);
    }

    /**
     * Check if a feature is enabled
     */
    isEnabled(featureId) {
        // When packages are hidden, ALL features are enabled
        if (!isPackagesVisible()) {
            return true;
        }

        // Explicitly disabled takes priority
        if (this.disabledFeatures.includes(featureId)) {
            return false;
        }

        // Custom features (from license)
        if (this.customFeatures.includes(featureId)) {
            return true;
        }

        // Package features
        const pkg = this.getPackage();
        return pkg.features.includes(featureId);
    }

    /**
     * Get all enabled features
     */
    getEnabledFeatures() {
        // When packages are hidden, return ALL features
        if (!isPackagesVisible()) {
            return Object.values(FEATURES);
        }

        const pkg = this.getPackage();
        const allFeatures = [...pkg.features, ...this.customFeatures];
        return allFeatures.filter(f => !this.disabledFeatures.includes(f));
    }

    /**
     * Get all feature definitions
     */
    getAllFeatures() {
        return Object.entries(FEATURES).map(([key, value]) => ({
            id: value,
            key,
            name: key.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '),
            enabled: this.isEnabled(value)
        }));
    }

    /**
     * Get max members for current package
     */
    getMaxMembers() {
        return this.getPackage().maxMembers;
    }

    /**
     * Check if member limit is reached
     */
    isMemberLimitReached(currentCount) {
        return currentCount >= this.getMaxMembers();
    }
}

// Singleton instance
const featureFlags = new FeatureFlagsService();

module.exports = {
    FEATURES,
    PACKAGES,
    featureFlags,
    FeatureFlagsService,
    isPackagesVisible,
    PACKAGES_MODE
};
