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
const CACHE_FILE = path.join(__dirname, '../data/license_cache.enc');

// Encryption key (derived from hardware ID)
let encryptionKey = null;

/**
 * Generate hardware fingerprint
 * Combines CPU, disk serial, OS info for unique ID
 */
function generateHardwareId() {
    try {
        const components = [];

        // CPU info
        const cpus = os.cpus();
        if (cpus.length > 0) {
            components.push(cpus[0].model);
        }

        // OS info
        components.push(os.platform());
        components.push(os.arch());
        components.push(os.hostname());

        // Try to get disk serial (Windows)
        if (os.platform() === 'win32') {
            try {
                const diskInfo = execSync('wmic diskdrive get serialnumber', { encoding: 'utf8' });
                const serial = diskInfo.split('\n')[1]?.trim();
                if (serial) components.push(serial);
            } catch (e) {
                // Fallback if WMIC fails
                components.push(os.totalmem().toString());
            }
        } else {
            // Linux/Mac fallback
            components.push(os.totalmem().toString());
        }

        // Create hash
        const hash = crypto.createHash('sha256')
            .update(components.join('|'))
            .digest('hex');

        return hash;

    } catch (error) {
        console.error('Hardware ID generation failed:', error);
        // Fallback to random ID (not ideal but prevents crash)
        return crypto.randomBytes(32).toString('hex');
    }
}

/**
 * Get encryption key (derived from hardware ID)
 */
function getEncryptionKey() {
    if (!encryptionKey) {
        const hwId = generateHardwareId();
        encryptionKey = crypto.createHash('sha256')
            .update(hwId + 'gym-license-salt')
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
        const hardwareId = generateHardwareId();

        // DEV MODE: Accept special dev key for testing without license server
        if (licenseKey === 'DEV-MODE-TEST-1234' || licenseKey === 'GYM-DEV-TEST-1234') {
            console.log('🔓 DEV MODE: Activating with development license');
            const devLicense = {
                type: 'premium',
                maxMembers: 9999,
                gymName: gymName || 'Development Gym',
                expiresAt: null // Never expires
            };

            saveLicenseCache({
                licenseKey,
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
                licenseKey,
                hardwareId,
                gymName
            }, { timeout: 10000 });

            if (response.data.success) {
                // Cache the license locally
                saveLicenseCache({
                    licenseKey,
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
            console.error('License activation error:', error.message);

            if (error.response) {
                console.error('[DEBUG] License Server Error Response:', JSON.stringify(error.response.data, null, 2));
                return {
                    success: false,
                    code: error.response.data.code || 'SERVER_ERROR',
                    message: error.response.data.message || 'Activation failed'
                };
            }

            // Network error - return clear message
            return {
                success: false,
                code: 'NETWORK_ERROR',
                message: 'Cannot connect to license server. Please ensure the license server is running, or use DEV-MODE-TEST-1234 for testing.'
            };
        }
    },

    /**
     * Validate license (online or cached)
     * IMPORTANT: This function NEVER throws. Always returns a structured response.
     */
    validate: async (licenseKey = null) => {
        try {
            // 🔓 DEV MODE BYPASS: Always return valid license in development
            if (process.env.NODE_ENV === 'development') {
                return {
                    valid: true,
                    license: {
                        type: 'premium',
                        maxMembers: 9999,
                        gymName: 'Dev Gym (Bypass)',
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

