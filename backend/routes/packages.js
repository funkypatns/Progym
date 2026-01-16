/**
 * ============================================
 * PACKAGES & FEATURES API ROUTES
 * ============================================
 * 
 * Manages product packages and feature flags.
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { featureFlags, FEATURES, PACKAGES } = require('../services/featureFlags');

router.use(authenticate);

/**
 * GET /api/packages
 * Get all available packages
 */
router.get('/', (req, res) => {
    try {
        const packages = Object.values(PACKAGES).map(pkg => ({
            ...pkg,
            isCurrent: pkg.id === featureFlags.currentPackage
        }));

        res.json({
            success: true,
            data: packages
        });
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch packages'
        });
    }
});

/**
 * GET /api/packages/current
 * Get current package details
 */
router.get('/current', (req, res) => {
    try {
        const pkg = featureFlags.getPackage();
        const enabledFeatures = featureFlags.getEnabledFeatures();

        res.json({
            success: true,
            data: {
                ...pkg,
                enabledFeatures,
                maxMembers: featureFlags.getMaxMembers()
            }
        });
    } catch (error) {
        console.error('Get current package error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch current package'
        });
    }
});

/**
 * GET /api/packages/features
 * Get all features with enabled status
 */
router.get('/features', (req, res) => {
    try {
        const features = featureFlags.getAllFeatures();

        res.json({
            success: true,
            data: features
        });
    } catch (error) {
        console.error('Get features error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch features'
        });
    }
});

/**
 * GET /api/packages/check/:featureId
 * Check if a specific feature is enabled
 */
router.get('/check/:featureId', (req, res) => {
    try {
        const { featureId } = req.params;
        const isEnabled = featureFlags.isEnabled(featureId);

        res.json({
            success: true,
            data: {
                feature: featureId,
                enabled: isEnabled,
                package: featureFlags.getPackage().name
            }
        });
    } catch (error) {
        console.error('Check feature error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check feature'
        });
    }
});

/**
 * PUT /api/packages/current
 * Set current package (Admin only - for testing/demo)
 */
router.put('/current', authorize('admin'), (req, res) => {
    try {
        const { packageId } = req.body;

        if (!PACKAGES[packageId]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid package ID'
            });
        }

        featureFlags.setPackage(packageId);

        res.json({
            success: true,
            message: `Package changed to ${PACKAGES[packageId].name}`,
            data: featureFlags.getPackage()
        });
    } catch (error) {
        console.error('Set package error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set package'
        });
    }
});

module.exports = router;
