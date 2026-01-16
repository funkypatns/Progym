/**
 * ============================================
 * FEATURE GATE MIDDLEWARE
 * ============================================
 * 
 * Blocks API access to features not enabled
 * for the current package/license.
 */

const { featureFlags, FEATURES } = require('../services/featureFlags');

/**
 * Factory function to create feature gate middleware
 * @param {string} featureId - The feature ID to check
 */
function requireFeature(featureId) {
    return (req, res, next) => {
        if (!featureFlags.isEnabled(featureId)) {
            return res.status(403).json({
                success: false,
                code: 'FEATURE_DISABLED',
                message: `This feature is not available in your current package. Please upgrade to access this feature.`,
                feature: featureId,
                currentPackage: featureFlags.getPackage().name
            });
        }
        next();
    };
}

/**
 * Check member limit middleware
 */
async function checkMemberLimit(req, res, next) {
    try {
        const memberCount = await req.prisma.member.count();
        const maxMembers = featureFlags.getMaxMembers();

        if (memberCount >= maxMembers) {
            return res.status(403).json({
                success: false,
                code: 'MEMBER_LIMIT_REACHED',
                message: `Maximum member limit (${maxMembers}) reached for your package. Please upgrade to add more members.`,
                currentCount: memberCount,
                maxAllowed: maxMembers,
                currentPackage: featureFlags.getPackage().name
            });
        }
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Attach feature flags info to request
 */
function attachFeatureFlags(req, res, next) {
    req.featureFlags = featureFlags;
    req.features = FEATURES;
    next();
}

module.exports = {
    requireFeature,
    checkMemberLimit,
    attachFeatureFlags,
    FEATURES
};
