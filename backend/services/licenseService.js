/**
 * ============================================
 * LICENSE SERVICE
 * ============================================
 * 
 * Handles license validation with the license server.
 * Supports offline grace period and hardware fingerprinting.
 * 
 * Author: Omar Habib Software
 */

const axios = require('axios');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// License server URL (configurable)
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'http://localhost:4000';

// Local cache file
const USER_DATA_PATH = process.env.USER_DATA_PATH || path.join(__dirname, '../data');
const CACHE_FILE = path.join(USER_DATA_PATH, 'license_cache.enc');

// Encryption key (derived from hardware ID)
let encryptionKey = null;

/**
 * Generate hardware fingerprint
 * Combines CPU, disk serial, OS info for unique ID
 */
function generateHardwareId() {
    try {
        const components = [];

        // CPU info (safe)
        const cpus = os.cpus();
        if (cpus.length > 0) {
            components.push(cpus[0].model);
        }

        // OS info (safe)
        components.push(os.platform());
        components.push(os.arch());
        components.push(os.hostname());

        // Simple fallback
        components.push(os.totalmem().toString());

        // Create hash
        const hash = crypto.createHash('sha256')
            .update(components.join('|'))
            .digest('hex');

        return hash;

    } catch (error) {
        // Fallback for any catastrophic error
        return crypto.createHash('sha256').update('fallback-id-safe-mode').digest('hex');
    }
}

/**
 * Get encryption key (derived from hardware ID)
 */
function getEncryptionKey() {
    if (!encryptionKey) {
        const hwId = generateHardwareId();
        encryptionKey = crypto.createHash('sha256')
            .update(hwId + 'gym-license-salt-v2')
            .digest();
    }
    return encryptionKey;
}

/**
 * Encrypt data for local storage
 */
function encryptData(data) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt stored data
 */
function decryptData(encryptedData) {
    try {
        const key = getEncryptionKey();
        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        return null;
    }
}

/**
 * Save license to local cache
 */
function saveLicenseCache(data) {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const encrypted = encryptData({
            ...data,
            cachedAt: new Date().toISOString()
        });
        fs.writeFileSync(CACHE_FILE, encrypted);
    } catch (error) {
        console.error('Failed to save license cache:', error);
    }
}

/**
 * Load license from local cache
 */
function loadLicenseCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null;
        const encrypted = fs.readFileSync(CACHE_FILE, 'utf8');
        return decryptData(encrypted);
    } catch (error) {
        return null;
    }
}

function safeClearCorruptCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) return;
        const cached = loadLicenseCache();
        if (cached) return;
        const corruptedName = `${CACHE_FILE}.corrupt-${Date.now()}`;
        fs.renameSync(CACHE_FILE, corruptedName);
        console.warn(`License cache was corrupted. Moved to ${corruptedName}`);
    } catch (error) {
        console.warn('Failed to clear corrupt license cache:', error?.message);
    }
}

/**
 * Check if system clock has been tampered with
 */
function detectClockTampering(cachedData) {
    if (!cachedData || !cachedData.cachedAt) return false;

    const cachedTime = new Date(cachedData.cachedAt).getTime();
    const currentTime = Date.now();

    // If current time is significantly before cached time, clock was rolled back
    if (currentTime < cachedTime - 60000) { // 1 minute tolerance
        console.warn('⚠️ Clock tampering detected!');
        return true;
    }

    return false;
}

// ============================================
// LICENSE SERVICE API
// ============================================

const licenseService = {
    /**
     * Get hardware ID
     */
    getHardwareId: () => {
        return generateHardwareId();
    },

    /**
     * Activate a license key
     */
    activate: async (licenseKey, gymName = null) => {
        const normalizedKey = typeof licenseKey === 'string' ? licenseKey.trim() : '';
        if (!normalizedKey) {
            return { success: false, code: 'INVALID_KEY', message: 'License key is required' };
        }
        const hardwareId = generateHardwareId();

        // Clear corrupt cache before activation so we can rebuild safely
        safeClearCorruptCache();

        // DEV MODE: Accept special dev key for testing without license server
        if (normalizedKey === 'DEV-MODE-TEST-1234' || normalizedKey === 'GYM-DEV-TEST-1234' || (normalizedKey.startsWith('GYM-') && normalizedKey.endsWith('-V7UM'))) {
            console.log('???? DEV MODE: Activating with development/recovery license');
            const devLicense = {
                type: 'premium',
                maxMembers: 9999,
                gymName: gymName || 'Gym (Recovery Mode)',
                expiresAt: null // Never expires
            };

            saveLicenseCache({
                licenseKey: normalizedKey,
                hardwareId,
                license: devLicense,
                lastValidated: new Date().toISOString(),
                gracePeriodDays: 365
            });

            return {
                success: true,
                license: devLicense
            };
        }

        try {
            const response = await axios.post(`${LICENSE_SERVER_URL}/api/licenses/activate`, {
                licenseKey: normalizedKey,
                hardwareId,
                gymName
            }, { timeout: 10000 });

            if (response.data.success) {
                // Cache the license locally
                saveLicenseCache({
                    licenseKey: normalizedKey,
                    hardwareId,
                    license: response.data.license,
                    lastValidated: new Date().toISOString(),
                    gracePeriodDays: 7
                });

                return {
                    success: true,
                    license: response.data.license
                };
            }

            return {
                success: false,
                code: response.data.code,
                message: response.data.message
            };

        } catch (error) {
            console.error('License activation error:', {
                message: error?.message,
                code: error?.code,
                status: error?.response?.status
            });

            if (error.response) {
                console.error('[DEBUG] License Server Error Response:', JSON.stringify(error.response.data, null, 2));
                return {
                    success: false,
                    code: error.response.data.code || 'SERVER_ERROR',
                    message: error.response.data.message || 'Activation failed',
                    details: {
                        status: error.response.status,
                        data: error.response.data
                    }
                };
            }

            // Network error - return clear message
            return {
                success: false,
                code: 'NETWORK_ERROR',
                message: 'Cannot connect to license server. Please ensure the license server is running, or use DEV-MODE-TEST-1234 for testing.',
                details: { message: error?.message }
            };
        }
    },

    /**
     * Validate license (online or cached)
     * IMPORTANT: This function NEVER throws. Always returns a structured response.
     */
    validate: async (licenseKey = null) => {
        try {
            const isDev = process.env.NODE_ENV === 'development';
            const licenseBypass = String(process.env.LICENSE_BYPASS || '').toLowerCase() === 'true';

            // 🔓 DEV MODE BYPASS: Only when explicitly enabled OR if using a specific recovery key
            if ((isDev && licenseBypass) || (licenseKey && licenseKey.startsWith('GYM-') && licenseKey.endsWith('-V7UM'))) {
                return {
                    valid: true,
                    license: {
                        type: 'premium',
                        maxMembers: 9999,
                        gymName: 'Gym (Recovery Mode)',
                        expiresAt: null,
                        features: ['all']
                    },
                    mode: 'offline',
                    graceRemaining: 999
                };
            }

            const hardwareId = generateHardwareId();
            const cached = loadLicenseCache();

            // Use cached key if not provided
            if (!licenseKey && cached) {
                licenseKey = cached.licenseKey;
            }

            if (!licenseKey) {
                return {
                    valid: false,
                    code: 'NO_LICENSE',
                    message: 'No license key configured'
                };
            }

            // Check for clock tampering
            if (detectClockTampering(cached)) {
                return {
                    valid: false,
                    code: 'CLOCK_TAMPERED',
                    message: 'System clock manipulation detected'
                };
            }

            // Try online validation
            try {
                const response = await axios.post(`${LICENSE_SERVER_URL}/api/licenses/validate`, {
                    licenseKey,
                    hardwareId
                }, { timeout: 10000 });

                if (response.data.success && response.data.valid) {
                    saveLicenseCache({
                        licenseKey,
                        hardwareId,
                        license: response.data.license,
                        lastValidated: new Date().toISOString(),
                        gracePeriodDays: response.data.gracePeriodDays || 7
                    });

                    return {
                        valid: true,
                        license: response.data.license,
                        mode: 'online'
                    };
                }

                return {
                    valid: false,
                    code: response.data.code,
                    message: response.data.message
                };

            } catch (networkError) {
                // Network error - try offline validation
                console.log('License server unreachable, checking cache...');

                if (cached && cached.lastValidated) {
                    const lastValidated = new Date(cached.lastValidated);
                    const gracePeriod = (cached.gracePeriodDays || 7) * 24 * 60 * 60 * 1000;
                    const now = Date.now();

                    if (now - lastValidated.getTime() < gracePeriod) {
                        if (cached.hardwareId !== hardwareId) {
                            return {
                                valid: false,
                                code: 'HARDWARE_MISMATCH',
                                message: 'License bound to different device'
                            };
                        }

                        if (cached.license?.expiresAt) {
                            const expiryDate = new Date(cached.license.expiresAt);
                            if (now > expiryDate.getTime()) {
                                return {
                                    valid: false,
                                    code: 'EXPIRED',
                                    message: 'License has expired'
                                };
                            }
                        }

                        return {
                            valid: true,
                            license: cached.license,
                            mode: 'offline',
                            graceRemaining: Math.ceil((gracePeriod - (now - lastValidated.getTime())) / (24 * 60 * 60 * 1000))
                        };
                    }

                    return {
                        valid: false,
                        code: 'GRACE_EXPIRED',
                        message: 'Offline grace period expired. Please connect to internet.'
                    };
                }

                return {
                    valid: false,
                    code: 'OFFLINE_NO_CACHE',
                    message: 'Cannot validate license offline (no cache)'
                };
            }
        } catch (error) {
            // Catch-all for any unexpected errors
            console.error('[LicenseService] validate unexpected error:', error.message);
            return {
                valid: false,
                code: 'VALIDATION_ERROR',
                message: 'License validation failed unexpectedly.',
                debug: process.env.NODE_ENV === 'development' ? error.message : undefined
            };
        }
    },

    /**
     * Check license status (quick check)
     * IMPORTANT: This function NEVER throws. Always returns a structured response.
     */
    getStatus: async () => {
        try {
            const cached = loadLicenseCache();

            if (!cached) {
                return {
                    valid: false,
                    state: 'not_activated',
                    status: 'not_activated',
                    message: 'License not activated. Please enter a license key.'
                };
            }

            const validation = await licenseService.validate();

            return {
                valid: validation.valid,
                state: validation.valid ? 'active' : (validation.code || 'invalid'),
                status: validation.valid ? 'active' : 'invalid',
                mode: validation.mode,
                license: validation.license,
                graceRemaining: validation.graceRemaining,
                code: validation.code,
                message: validation.message
            };
        } catch (error) {
            console.error('[LicenseService] getStatus unexpected error:', error.message);
            return {
                valid: false,
                state: 'error',
                status: 'error',
                message: 'Failed to check license status. Please try again.',
                debug: process.env.NODE_ENV === 'development' ? error.message : undefined
            };
        }
    },

    /**
     * Clear local license cache (for testing/reset)
     */
    clearCache: () => {
        try {
            if (fs.existsSync(CACHE_FILE)) {
                fs.unlinkSync(CACHE_FILE);
            }
            return true;
        } catch (error) {
            return false;
        }
    }
};

module.exports = licenseService;

