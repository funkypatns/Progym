/**
 * ============================================
 * GYM MANAGEMENT SYSTEM - License Manager
 * ============================================
 * 
 * Handles all license-related operations:
 * - License validation
 * - Hardware ID generation (bound to PC)
 * - License file encryption/decryption
 * - Date tampering detection
 * - Expiry checking
 * 
 * SECURITY NOTES:
 * - License is bound to hardware ID (CPU + disk + MAC hash)
 * - License file is encrypted with AES-256-GCM
 * - System date changes are detected and blocked
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ============================================
// CONFIGURATION
// ============================================

// Encryption key (in production, use environment variable or secure storage)
// This key should be unique to your application
const ENCRYPTION_KEY = crypto.scryptSync('GymManagementSystem2024SecretKey!@#', 'salt', 32);
const ENCRYPTION_IV_LENGTH = 16;
const ENCRYPTION_AUTH_TAG_LENGTH = 16;

// License types
const LICENSE_TYPES = {
    TRIAL: 'trial',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    LIFETIME: 'lifetime'
};

class LicenseManager {
    /**
     * Initialize the License Manager
     * @param {string} userDataPath - Path to user data directory
     */
    constructor(userDataPath) {
        this.userDataPath = userDataPath;
        this.licensePath = path.join(userDataPath, 'license', 'license.dat');
        this.lastCheckPath = path.join(userDataPath, 'license', 'lastcheck.dat');
        this.hardwareId = null;
        this.licenseData = null;
    }

    // ============================================
    // HARDWARE ID GENERATION
    // ============================================

    /**
     * Generates a unique hardware ID based on system properties
     * This binds the license to a specific PC
     * @returns {string} Hardware ID hash
     */
    generateHardwareId() {
        if (this.hardwareId) {
            return this.hardwareId;
        }

        try {
            // Collect hardware identifiers
            const cpuInfo = os.cpus()[0]?.model || 'unknown';
            const hostname = os.hostname();
            const username = os.userInfo().username;

            // Get disk serial (Windows specific)
            let diskSerial = 'unknown';
            try {
                if (process.platform === 'win32') {
                    const output = execSync('wmic diskdrive get serialnumber', { encoding: 'utf8' });
                    const lines = output.split('\n').filter(l => l.trim() && !l.includes('SerialNumber'));
                    diskSerial = lines[0]?.trim() || 'unknown';
                }
            } catch (e) {
                console.warn('Could not get disk serial:', e.message);
            }

            // Get MAC address
            let macAddress = 'unknown';
            const networkInterfaces = os.networkInterfaces();
            for (const name in networkInterfaces) {
                const iface = networkInterfaces[name];
                for (const info of iface) {
                    if (!info.internal && info.mac && info.mac !== '00:00:00:00:00:00') {
                        macAddress = info.mac;
                        break;
                    }
                }
                if (macAddress !== 'unknown') break;
            }

            // Combine and hash
            const combined = `${cpuInfo}|${hostname}|${diskSerial}|${macAddress}|GymMgmt`;
            this.hardwareId = crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32);

            return this.hardwareId;

        } catch (error) {
            console.error('Error generating hardware ID:', error);
            // Fallback to a simpler method
            const fallback = `${os.hostname()}|${os.userInfo().username}|${os.type()}`;
            this.hardwareId = crypto.createHash('sha256').update(fallback).digest('hex').substring(0, 32);
            return this.hardwareId;
        }
    }

    // ============================================
    // ENCRYPTION / DECRYPTION
    // ============================================

    /**
     * Encrypts data using AES-256-GCM
     * @param {string} data - Data to encrypt
     * @returns {string} Encrypted data as hex string
     */
    encrypt(data) {
        const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Combine IV + AuthTag + Encrypted data
        return iv.toString('hex') + authTag.toString('hex') + encrypted;
    }

    /**
     * Decrypts data encrypted with AES-256-GCM
     * @param {string} encryptedData - Encrypted hex string
     * @returns {string} Decrypted data
     */
    decrypt(encryptedData) {
        const iv = Buffer.from(encryptedData.substring(0, ENCRYPTION_IV_LENGTH * 2), 'hex');
        const authTag = Buffer.from(encryptedData.substring(ENCRYPTION_IV_LENGTH * 2, (ENCRYPTION_IV_LENGTH + ENCRYPTION_AUTH_TAG_LENGTH) * 2), 'hex');
        const encrypted = encryptedData.substring((ENCRYPTION_IV_LENGTH + ENCRYPTION_AUTH_TAG_LENGTH) * 2);

        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    // ============================================
    // DATE TAMPERING DETECTION
    // ============================================

    /**
     * Saves the last known system time (encrypted)
     * Used to detect date tampering
     */
    saveLastCheckTime() {
        try {
            const data = this.encrypt(Date.now().toString());
            fs.writeFileSync(this.lastCheckPath, data);
        } catch (error) {
            console.error('Error saving last check time:', error);
        }
    }

    /**
     * Checks if the system date has been tampered with
     * @returns {boolean} True if tampering detected
     */
    detectDateTampering() {
        try {
            if (!fs.existsSync(this.lastCheckPath)) {
                this.saveLastCheckTime();
                return false;
            }

            const encryptedData = fs.readFileSync(this.lastCheckPath, 'utf8');
            const lastCheckTime = parseInt(this.decrypt(encryptedData), 10);
            const currentTime = Date.now();

            // If current time is significantly before last check time (more than 1 hour),
            // the date might have been set back
            if (currentTime < lastCheckTime - (60 * 60 * 1000)) {
                console.warn('Date tampering detected!');
                return true;
            }

            // Update last check time
            this.saveLastCheckTime();
            return false;

        } catch (error) {
            console.error('Error checking date tampering:', error);
            // On error, don't block - just update the check time
            this.saveLastCheckTime();
            return false;
        }
    }

    // ============================================
    // LICENSE OPERATIONS
    // ============================================

    /**
     * Checks the current license status
     * @returns {Promise<Object>} License status object
     */
    async checkLicense() {
        try {
            // Check for date tampering
            if (this.detectDateTampering()) {
                return {
                    valid: false,
                    error: 'DATE_TAMPERING',
                    message: 'System date tampering detected. Please restore correct date.'
                };
            }

            // Check if license file exists
            if (!fs.existsSync(this.licensePath)) {
                return {
                    valid: false,
                    error: 'NO_LICENSE',
                    message: 'No license found. Please activate your license.'
                };
            }

            // Read and decrypt license
            const encryptedLicense = fs.readFileSync(this.licensePath, 'utf8');
            const licenseJson = this.decrypt(encryptedLicense);
            this.licenseData = JSON.parse(licenseJson);

            // Verify hardware ID
            const currentHardwareId = this.generateHardwareId();
            if (this.licenseData.hardwareId !== currentHardwareId) {
                return {
                    valid: false,
                    error: 'HARDWARE_MISMATCH',
                    message: 'License is not valid for this computer.'
                };
            }

            // Check expiry
            if (this.licenseData.type !== LICENSE_TYPES.LIFETIME) {
                const expiryDate = new Date(this.licenseData.expiresAt);
                const now = new Date();

                if (now > expiryDate) {
                    return {
                        valid: false,
                        error: 'EXPIRED',
                        message: 'Your license has expired. Please renew.',
                        expiredAt: this.licenseData.expiresAt
                    };
                }

                // Calculate days remaining
                const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

                return {
                    valid: true,
                    type: this.licenseData.type,
                    expiresAt: this.licenseData.expiresAt,
                    daysRemaining,
                    customerName: this.licenseData.customerName,
                    warning: daysRemaining <= 7 ? `License expires in ${daysRemaining} days` : null
                };
            }

            // Lifetime license
            return {
                valid: true,
                type: LICENSE_TYPES.LIFETIME,
                customerName: this.licenseData.customerName
            };

        } catch (error) {
            console.error('Error checking license:', error);
            return {
                valid: false,
                error: 'INVALID_LICENSE',
                message: 'License file is corrupted or invalid.'
            };
        }
    }

    /**
     * Activates a new license
     * @param {string} licenseKey - The license key to activate
     * @returns {Promise<Object>} Activation result
     */
    async activateLicense(licenseKey) {
        try {
            // Validate license key format (example: XXXX-XXXX-XXXX-XXXX)
            const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
            if (!keyPattern.test(licenseKey)) {
                return {
                    success: false,
                    message: 'Invalid license key format.'
                };
            }

            // Decode license key to get license data
            // In production, this would validate against a license server
            const licenseInfo = this.decodeLicenseKey(licenseKey);

            if (!licenseInfo) {
                return {
                    success: false,
                    message: 'Invalid license key.'
                };
            }

            // Create license data
            const licenseData = {
                key: licenseKey,
                hardwareId: this.generateHardwareId(),
                type: licenseInfo.type,
                customerName: licenseInfo.customerName,
                activatedAt: new Date().toISOString(),
                expiresAt: licenseInfo.expiresAt
            };

            // Encrypt and save license
            const encryptedLicense = this.encrypt(JSON.stringify(licenseData));

            // Ensure license directory exists
            const licenseDir = path.dirname(this.licensePath);
            if (!fs.existsSync(licenseDir)) {
                fs.mkdirSync(licenseDir, { recursive: true });
            }

            fs.writeFileSync(this.licensePath, encryptedLicense);

            // Save check time
            this.saveLastCheckTime();

            this.licenseData = licenseData;

            return {
                success: true,
                message: 'License activated successfully!',
                license: {
                    type: licenseInfo.type,
                    expiresAt: licenseInfo.expiresAt
                }
            };

        } catch (error) {
            console.error('Error activating license:', error);
            return {
                success: false,
                message: 'Failed to activate license. Please try again.'
            };
        }
    }

    /**
     * Decodes a license key to extract license information
     * In production, this would validate against a remote server
     * @param {string} licenseKey - The license key
     * @returns {Object|null} License info or null if invalid
     */
    decodeLicenseKey(licenseKey) {
        try {
            // Simple offline validation for demo purposes
            // In production, you would:
            // 1. Send key to license server
            // 2. Server validates and returns license info
            // 3. Store response locally for offline use

            // Extract type from first character
            const typeCode = licenseKey.charAt(0);
            let type, expiresAt;

            switch (typeCode) {
                case 'T': // Trial - 14 days
                    type = LICENSE_TYPES.TRIAL;
                    expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
                    break;
                case 'M': // Monthly
                    type = LICENSE_TYPES.MONTHLY;
                    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                    break;
                case 'Y': // Yearly
                    type = LICENSE_TYPES.YEARLY;
                    expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
                    break;
                case 'L': // Lifetime
                    type = LICENSE_TYPES.LIFETIME;
                    expiresAt = null;
                    break;
                default:
                    return null;
            }

            // Validate checksum (simple validation)
            const keyWithoutDashes = licenseKey.replace(/-/g, '');
            const checksum = crypto.createHash('md5').update(keyWithoutDashes.slice(0, -2)).digest('hex').slice(0, 2).toUpperCase();

            // For demo, we'll accept any properly formatted key
            // In production, add proper checksum validation

            return {
                type,
                expiresAt,
                customerName: 'Licensed User'
            };

        } catch (error) {
            console.error('Error decoding license key:', error);
            return null;
        }
    }

    /**
     * Gets detailed license information
     * @returns {Object} License info
     */
    getLicenseInfo() {
        if (!this.licenseData) {
            return null;
        }

        return {
            type: this.licenseData.type,
            customerName: this.licenseData.customerName,
            activatedAt: this.licenseData.activatedAt,
            expiresAt: this.licenseData.expiresAt,
            hardwareId: this.licenseData.hardwareId?.substring(0, 8) + '...' // Show partial for privacy
        };
    }

    /**
     * Generates a sample license key for testing
     * @param {string} type - License type (trial, monthly, yearly, lifetime)
     * @returns {string} Generated license key
     */
    static generateSampleKey(type = 'yearly') {
        const typeCode = {
            trial: 'T',
            monthly: 'M',
            yearly: 'Y',
            lifetime: 'L'
        }[type] || 'Y';

        const randomPart = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 4; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };

        return `${typeCode}${randomPart().slice(1)}-${randomPart()}-${randomPart()}-${randomPart()}`;
    }
}

module.exports = LicenseManager;
