/**
 * ============================================
 * LICENSE SERVICE
 * ============================================
 *
 * Handles license activation/validation with the license server.
 * Enforces device binding, signed activation tokens, offline grace,
 * and practical integrity checks.
 */

const axios = require('axios');
const crypto = require('crypto');
const os = require('os');
const jwt = require('jsonwebtoken');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'http://localhost:4000';
const USER_DATA_PATH = process.env.USER_DATA_PATH || path.join(__dirname, '../data');
const CACHE_FILE = path.join(USER_DATA_PATH, 'license_cache.enc');
const APP_ROOT_PATH = path.join(__dirname, '..', '..');

const DEFAULT_VALIDATE_INTERVAL_HOURS = Number.parseInt(process.env.LICENSE_VALIDATE_INTERVAL_HOURS || '24', 10);
const DEFAULT_OFFLINE_GRACE_HOURS = Number.parseInt(process.env.LICENSE_OFFLINE_GRACE_HOURS || '72', 10);
const INTEGRITY_ENFORCE = String(process.env.LICENSE_ENFORCE_INTEGRITY || '').toLowerCase() === 'true';

let encryptionKey = null;
let backgroundTimer = null;

function safeReadJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
        return null;
    }
}

function getAppVersion() {
    const envVersion = process.env.APP_VERSION;
    if (envVersion && envVersion.trim()) {
        return envVersion.trim();
    }

    const rootPackage = safeReadJson(path.join(APP_ROOT_PATH, 'package.json'));
    if (rootPackage?.version) {
        return String(rootPackage.version);
    }

    const backendPackage = safeReadJson(path.join(__dirname, '..', 'package.json'));
    if (backendPackage?.version) {
        return String(backendPackage.version);
    }

    return '0.0.0';
}

function runCommand(command) {
    try {
        const output = execSync(command, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 3000
        });
        return String(output || '').trim();
    } catch (_) {
        return '';
    }
}

function getRawMachineId() {
    if (process.platform === 'win32') {
        const byUuid = runCommand('wmic csproduct get UUID');
        const uuidLine = byUuid
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => line && line.toLowerCase() !== 'uuid');
        if (uuidLine && uuidLine !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') {
            return uuidLine;
        }

        const regOutput = runCommand('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
        const machineGuidLine = regOutput
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => /MachineGuid/i.test(line));
        if (machineGuidLine) {
            const parts = machineGuidLine.split(/\s+/);
            return parts[parts.length - 1] || '';
        }
        return '';
    }

    if (process.platform === 'darwin') {
        const output = runCommand('ioreg -rd1 -c IOPlatformExpertDevice');
        const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        return match ? match[1] : '';
    }

    const linuxMachineId = runCommand('cat /etc/machine-id');
    if (linuxMachineId) {
        return linuxMachineId;
    }

    return runCommand('cat /var/lib/dbus/machine-id');
}

function generateDeviceFingerprint() {
    const rawMachineId = getRawMachineId();
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const fallback = `${hostname}|${platform}|${arch}|${os.totalmem()}`;
    const base = rawMachineId || fallback;

    return crypto
        .createHash('sha256')
        .update(`machine:${base}|platform:${platform}|arch:${arch}|app:gym-management`)
        .digest('hex');
}

function getDeviceMetadata() {
    const platform = `${os.platform()} ${os.release()} (${os.arch()})`;
    return {
        deviceName: os.hostname(),
        platform
    };
}

function getEncryptionKey() {
    if (!encryptionKey) {
        const fingerprint = generateDeviceFingerprint();
        encryptionKey = crypto
            .createHash('sha256')
            .update(`${fingerprint}:gym-license-cache:v3`)
            .digest();
    }
    return encryptionKey;
}

function encryptData(data) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

function decryptData(encryptedData) {
    try {
        const key = getEncryptionKey();
        const [ivHex, encrypted] = String(encryptedData || '').split(':');
        if (!ivHex || !encrypted) {
            return null;
        }
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (_) {
        return null;
    }
}

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
        console.error('Failed to save license cache:', error.message);
    }
}

function loadLicenseCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) {
            return null;
        }
        const encrypted = fs.readFileSync(CACHE_FILE, 'utf8');
        return decryptData(encrypted);
    } catch (_) {
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
        console.warn('Failed to clear corrupt license cache:', error.message);
    }
}

function detectClockTampering(cachedData) {
    if (!cachedData || !cachedData.cachedAt) return false;

    const cachedTime = new Date(cachedData.cachedAt).getTime();
    const currentTime = Date.now();

    if (currentTime < cachedTime - 60000) {
        console.warn('Clock tampering detected');
        return true;
    }

    return false;
}

async function fetchPublicKey() {
    const response = await axios.get(`${LICENSE_SERVER_URL}/api/licenses/public-key`, { timeout: 8000 });
    if (!response?.data?.success || !response?.data?.publicKey) {
        throw new Error('Invalid public key response from license server');
    }

    return {
        publicKey: response.data.publicKey,
        algorithm: response.data.algorithm || 'RS256',
        issuer: response.data.issuer,
        audience: response.data.audience,
        keyId: response.data.keyId,
        fetchedAt: new Date().toISOString()
    };
}

function verifyActivationToken(token, publicKeyBundle, expectedFingerprint, expectedLicenseKey) {
    if (!token) {
        return { valid: false, code: 'MISSING_TOKEN', message: 'Activation token is missing' };
    }

    if (!publicKeyBundle?.publicKey) {
        return { valid: false, code: 'MISSING_PUBLIC_KEY', message: 'Public key unavailable for token verification' };
    }

    try {
        const payload = jwt.verify(token, publicKeyBundle.publicKey, {
            algorithms: [publicKeyBundle.algorithm || 'RS256'],
            issuer: publicKeyBundle.issuer,
            audience: publicKeyBundle.audience
        });

        if (payload?.typ !== 'activation') {
            return { valid: false, code: 'INVALID_TOKEN_TYPE', message: 'Invalid activation token type' };
        }

        if (payload.fingerprint !== expectedFingerprint) {
            return {
                valid: false,
                code: 'DEVICE_FINGERPRINT_MISMATCH',
                message: 'Activation token does not match this device'
            };
        }

        if (expectedLicenseKey && payload.licenseKey !== expectedLicenseKey) {
            return {
                valid: false,
                code: 'LICENSE_KEY_MISMATCH',
                message: 'Activation token does not match this license key'
            };
        }

        if (payload.deviceStatus && payload.deviceStatus !== 'approved') {
            return {
                valid: false,
                code: 'DEVICE_NOT_APPROVED',
                message: 'Device is not approved for this license'
            };
        }

        return { valid: true, payload };
    } catch (error) {
        return {
            valid: false,
            code: 'INVALID_TOKEN_SIGNATURE',
            message: error.message || 'Activation token signature verification failed'
        };
    }
}

function verifyManifestToken(manifestToken, publicKeyBundle) {
    if (!manifestToken) {
        return { valid: false, code: 'MISSING_MANIFEST_TOKEN', message: 'Manifest token missing' };
    }

    try {
        const payload = jwt.verify(manifestToken, publicKeyBundle.publicKey, {
            algorithms: [publicKeyBundle.algorithm || 'RS256'],
            issuer: publicKeyBundle.issuer,
            audience: publicKeyBundle.audience
        });

        if (payload?.typ !== 'integrity_manifest' || !payload?.manifest) {
            return { valid: false, code: 'INVALID_MANIFEST_TOKEN', message: 'Invalid manifest token payload' };
        }

        return { valid: true, manifest: payload.manifest };
    } catch (error) {
        return {
            valid: false,
            code: 'INVALID_MANIFEST_SIGNATURE',
            message: error.message || 'Manifest signature verification failed'
        };
    }
}

function sha256File(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function normalizeManifest(manifest) {
    if (!manifest || !Array.isArray(manifest.files)) {
        return null;
    }
    return {
        appVersion: manifest.appVersion,
        generatedAt: manifest.generatedAt,
        required: manifest.required !== false,
        files: manifest.files
            .filter((entry) => entry && entry.path && entry.sha256)
            .map((entry) => ({
                path: String(entry.path),
                sha256: String(entry.sha256).toLowerCase()
            }))
    };
}

function runIntegrityVerification(manifest) {
    const normalized = normalizeManifest(manifest);
    if (!normalized) {
        return { valid: !INTEGRITY_ENFORCE, code: 'MANIFEST_INVALID', message: 'Integrity manifest is invalid' };
    }

    for (const fileEntry of normalized.files) {
        const absolute = path.resolve(APP_ROOT_PATH, fileEntry.path);
        if (!fs.existsSync(absolute)) {
            if (normalized.required) {
                return {
                    valid: false,
                    code: 'INTEGRITY_FILE_MISSING',
                    message: `Integrity Check Failed: missing file ${fileEntry.path}`
                };
            }
            continue;
        }

        const actualHash = sha256File(absolute).toLowerCase();
        if (actualHash !== fileEntry.sha256) {
            return {
                valid: false,
                code: 'INTEGRITY_MISMATCH',
                message: `Integrity Check Failed: hash mismatch in ${fileEntry.path}`
            };
        }
    }

    return { valid: true, code: 'INTEGRITY_OK' };
}

async function fetchAndVerifyManifest({ licenseKey, fingerprint, appVersion, publicKeyBundle, timeout = 8000 }) {
    const response = await axios.get(`${LICENSE_SERVER_URL}/api/licenses/manifest/${encodeURIComponent(appVersion)}`, {
        timeout,
        params: {
            licenseKey,
            deviceFingerprint: fingerprint
        }
    });

    if (!response?.data?.success || !response?.data?.manifestToken) {
        throw new Error('Manifest endpoint returned invalid response');
    }

    const manifestVerification = verifyManifestToken(response.data.manifestToken, publicKeyBundle);
    if (!manifestVerification.valid) {
        return manifestVerification;
    }

    const integrity = runIntegrityVerification(manifestVerification.manifest);
    return {
        ...integrity,
        manifestToken: response.data.manifestToken,
        manifest: manifestVerification.manifest
    };
}

async function evaluateIntegrity({
    licenseKey,
    fingerprint,
    appVersion,
    publicKeyBundle,
    cached
}) {
    const cachedManifestToken = cached?.integrity?.manifestToken;
    if (cachedManifestToken) {
        const manifestVerification = verifyManifestToken(cachedManifestToken, publicKeyBundle);
        if (manifestVerification.valid) {
            const cachedIntegrity = runIntegrityVerification(manifestVerification.manifest);
            if (!cachedIntegrity.valid) {
                return cachedIntegrity;
            }
        }
    }

    try {
        const fresh = await fetchAndVerifyManifest({
            licenseKey,
            fingerprint,
            appVersion,
            publicKeyBundle
        });

        if (!fresh.valid) {
            return fresh;
        }

        return {
            valid: true,
            manifestToken: fresh.manifestToken,
            manifestCheckedAt: new Date().toISOString()
        };
    } catch (error) {
        if (cachedManifestToken) {
            const cachedManifest = verifyManifestToken(cachedManifestToken, publicKeyBundle);
            if (cachedManifest.valid) {
                const fallbackIntegrity = runIntegrityVerification(cachedManifest.manifest);
                if (fallbackIntegrity.valid) {
                    return {
                        valid: true,
                        manifestToken: cachedManifestToken,
                        manifestCheckedAt: new Date().toISOString(),
                        mode: 'cached'
                    };
                }
                return fallbackIntegrity;
            }
        }

        if (INTEGRITY_ENFORCE) {
            return {
                valid: false,
                code: 'INTEGRITY_MANIFEST_UNAVAILABLE',
                message: 'Integrity Check Failed: manifest unavailable'
            };
        }

        return {
            valid: true,
            mode: 'skipped',
            code: 'INTEGRITY_SKIPPED_MANIFEST_UNAVAILABLE'
        };
    }
}

async function resolvePublicKeyBundle(cached) {
    if (cached?.publicKey?.publicKey) {
        return cached.publicKey;
    }
    return fetchPublicKey();
}

function mergeAndPersistCache(cached, updates) {
    const merged = {
        ...(cached || {}),
        ...(updates || {})
    };
    saveLicenseCache(merged);
    return merged;
}

function getGraceRemainingHours(lastValidatedIso, graceHours) {
    if (!lastValidatedIso) return 0;
    const now = Date.now();
    const lastValidated = new Date(lastValidatedIso).getTime();
    const graceMs = graceHours * 60 * 60 * 1000;
    const remainingMs = graceMs - (now - lastValidated);
    return Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
}

async function validateOnline({ licenseKey, fingerprint, appVersion, publicKeyBundle }) {
    const deviceMeta = getDeviceMetadata();
    const response = await axios.post(
        `${LICENSE_SERVER_URL}/api/licenses/validate`,
        {
            licenseKey,
            deviceFingerprint: fingerprint,
            appVersion,
            deviceName: deviceMeta.deviceName,
            platform: deviceMeta.platform
        },
        { timeout: 10000 }
    );

    return response.data;
}

async function enforceTokenAndIntegrity({ cached, licenseKey, fingerprint, appVersion, requireIntegrity = true }) {
    const publicKeyBundle = await resolvePublicKeyBundle(cached);

    const tokenVerification = verifyActivationToken(
        cached?.activationToken,
        publicKeyBundle,
        fingerprint,
        licenseKey
    );

    if (!tokenVerification.valid) {
        return tokenVerification;
    }

    if (!requireIntegrity) {
        return {
            valid: true,
            publicKeyBundle,
            tokenPayload: tokenVerification.payload
        };
    }

    const integrity = await evaluateIntegrity({
        licenseKey,
        fingerprint,
        appVersion,
        publicKeyBundle,
        cached
    });

    if (!integrity.valid) {
        return integrity;
    }

    return {
        valid: true,
        publicKeyBundle,
        tokenPayload: tokenVerification.payload,
        integrity
    };
}

const licenseService = {
    getHardwareId: () => generateDeviceFingerprint(),

    getDeviceFingerprint: () => generateDeviceFingerprint(),

    getAppVersion: () => getAppVersion(),

    activate: async (licenseKey, gymName = null) => {
        const normalizedKey = typeof licenseKey === 'string' ? licenseKey.trim() : '';
        const normalizedGymName = typeof gymName === 'string' ? gymName.trim() : '';
        const isDev = process.env.NODE_ENV === 'development';
        const licenseBypass = String(process.env.LICENSE_BYPASS || '').toLowerCase() === 'true';

        if (!normalizedKey) {
            return { success: false, code: 'INVALID_KEY', message: 'License key is required' };
        }
        if (!normalizedGymName) {
            return { success: false, code: 'GYM_NAME_REQUIRED', message: 'gymName is required' };
        }

        const fingerprint = generateDeviceFingerprint();
        const appVersion = getAppVersion();

        safeClearCorruptCache();

        const isDevTestKey = normalizedKey === 'DEV-MODE-TEST-1234' || normalizedKey === 'GYM-DEV-TEST-1234';
        if (isDev && licenseBypass && isDevTestKey) {
            const devLicense = {
                type: 'premium',
                maxMembers: 9999,
                gymName: normalizedGymName || 'Gym (Development Mode)',
                expiresAt: null
            };

            saveLicenseCache({
                licenseKey: normalizedKey,
                deviceFingerprint: fingerprint,
                license: devLicense,
                activationToken: null,
                publicKey: null,
                lastValidated: new Date().toISOString(),
                validateIntervalHours: 24,
                offlineGraceHours: 24 * 365
            });

            return {
                success: true,
                valid: true,
                license: devLicense,
                mode: 'dev_bypass'
            };
        }

        try {
            const publicKeyBundle = await fetchPublicKey();
            const deviceMeta = getDeviceMetadata();

            const response = await axios.post(
                `${LICENSE_SERVER_URL}/api/licenses/activate`,
                {
                    licenseKey: normalizedKey,
                    deviceFingerprint: fingerprint,
                    gymName: normalizedGymName,
                    appVersion,
                    deviceName: deviceMeta.deviceName,
                    platform: deviceMeta.platform
                },
                { timeout: 10000 }
            );

            const payload = response.data || {};

            if (!payload.success) {
                return {
                    success: false,
                    code: payload.code || 'ACTIVATION_FAILED',
                    message: payload.message || 'Activation failed'
                };
            }

            const tokenVerification = verifyActivationToken(
                payload.activationToken,
                publicKeyBundle,
                fingerprint,
                normalizedKey
            );

            if (!tokenVerification.valid) {
                return {
                    success: false,
                    code: tokenVerification.code,
                    message: tokenVerification.message
                };
            }

            const nextCache = mergeAndPersistCache(loadLicenseCache(), {
                licenseKey: normalizedKey,
                deviceFingerprint: fingerprint,
                appVersion,
                license: payload.license,
                activationToken: payload.activationToken,
                publicKey: publicKeyBundle,
                lastValidated: new Date().toISOString(),
                validateIntervalHours: Number.parseInt(String(payload.validateIntervalHours || DEFAULT_VALIDATE_INTERVAL_HOURS), 10),
                offlineGraceHours: Number.parseInt(String(payload.offlineGraceHours || DEFAULT_OFFLINE_GRACE_HOURS), 10)
            });

            const integrity = await evaluateIntegrity({
                licenseKey: normalizedKey,
                fingerprint,
                appVersion,
                publicKeyBundle,
                cached: nextCache
            });

            if (!integrity.valid) {
                return {
                    success: false,
                    code: integrity.code || 'INTEGRITY_CHECK_FAILED',
                    message: integrity.message || 'Integrity Check Failed'
                };
            }

            mergeAndPersistCache(nextCache, {
                integrity: {
                    manifestToken: integrity.manifestToken || nextCache?.integrity?.manifestToken || null,
                    lastCheckedAt: new Date().toISOString()
                }
            });

            return {
                success: true,
                valid: true,
                license: payload.license,
                mode: 'online'
            };
        } catch (error) {
            if (error.response?.data) {
                const server = error.response.data;
                return {
                    success: false,
                    code: server.code || 'SERVER_ERROR',
                    message: server.message || 'Activation failed'
                };
            }

            return {
                success: false,
                code: 'NETWORK_ERROR',
                message: 'Cannot connect to license server. Please ensure the license server is running.'
            };
        }
    },

    validate: async (licenseKey = null, options = {}) => {
        try {
            const isDev = process.env.NODE_ENV === 'development';
            const licenseBypass = String(process.env.LICENSE_BYPASS || '').toLowerCase() === 'true';

            if (isDev && licenseBypass) {
                return {
                    valid: true,
                    license: {
                        type: 'premium',
                        maxMembers: 9999,
                        gymName: 'Gym (Development Mode)',
                        expiresAt: null,
                        features: ['all']
                    },
                    mode: 'offline',
                    graceRemaining: 9999
                };
            }

            const fingerprint = generateDeviceFingerprint();
            const appVersion = getAppVersion();
            const cached = loadLicenseCache();
            const resolvedKey = licenseKey || cached?.licenseKey;

            if (!resolvedKey) {
                return {
                    valid: false,
                    code: 'NO_LICENSE',
                    message: 'No license key configured'
                };
            }

            if (detectClockTampering(cached)) {
                return {
                    valid: false,
                    code: 'CLOCK_TAMPERED',
                    message: 'System clock manipulation detected'
                };
            }

            const localEnforcement = await enforceTokenAndIntegrity({
                cached,
                licenseKey: resolvedKey,
                fingerprint,
                appVersion,
                requireIntegrity: true
            });

            if (!localEnforcement.valid) {
                return {
                    valid: false,
                    code: localEnforcement.code || 'INVALID_TOKEN',
                    message: localEnforcement.message || 'License token validation failed'
                };
            }

            const validateIntervalHours = Number.parseInt(
                String(cached?.validateIntervalHours || DEFAULT_VALIDATE_INTERVAL_HOURS),
                10
            );
            const offlineGraceHours = Number.parseInt(
                String(cached?.offlineGraceHours || DEFAULT_OFFLINE_GRACE_HOURS),
                10
            );

            const now = Date.now();
            const lastValidatedAt = cached?.lastValidated ? new Date(cached.lastValidated).getTime() : 0;
            const dueForOnlineValidation = !lastValidatedAt || (now - lastValidatedAt) >= (validateIntervalHours * 60 * 60 * 1000);
            const forceOnline = Boolean(options.forceOnline);

            if (!forceOnline && !dueForOnlineValidation) {
                return {
                    valid: true,
                    license: cached?.license,
                    mode: 'cached',
                    graceRemaining: getGraceRemainingHours(cached?.lastValidated, offlineGraceHours),
                    nextValidationAt: new Date(lastValidatedAt + validateIntervalHours * 60 * 60 * 1000).toISOString()
                };
            }

            try {
                const online = await validateOnline({
                    licenseKey: resolvedKey,
                    fingerprint,
                    appVersion,
                    publicKeyBundle: localEnforcement.publicKeyBundle
                });

                if (!online?.success || !online?.valid) {
                    return {
                        valid: false,
                        code: online?.code || 'VALIDATION_FAILED',
                        message: online?.message || 'License validation failed'
                    };
                }

                const tokenVerification = verifyActivationToken(
                    online.activationToken,
                    localEnforcement.publicKeyBundle,
                    fingerprint,
                    resolvedKey
                );

                if (!tokenVerification.valid) {
                    return {
                        valid: false,
                        code: tokenVerification.code,
                        message: tokenVerification.message
                    };
                }

                const nextCache = mergeAndPersistCache(cached, {
                    licenseKey: resolvedKey,
                    deviceFingerprint: fingerprint,
                    appVersion,
                    license: online.license,
                    activationToken: online.activationToken,
                    publicKey: localEnforcement.publicKeyBundle,
                    lastValidated: new Date().toISOString(),
                    validateIntervalHours: Number.parseInt(String(online.validateIntervalHours || validateIntervalHours), 10),
                    offlineGraceHours: Number.parseInt(String(online.offlineGraceHours || offlineGraceHours), 10)
                });

                const integrity = await evaluateIntegrity({
                    licenseKey: resolvedKey,
                    fingerprint,
                    appVersion,
                    publicKeyBundle: localEnforcement.publicKeyBundle,
                    cached: nextCache
                });

                if (!integrity.valid) {
                    return {
                        valid: false,
                        code: integrity.code || 'INTEGRITY_CHECK_FAILED',
                        message: integrity.message || 'Integrity Check Failed'
                    };
                }

                mergeAndPersistCache(nextCache, {
                    integrity: {
                        manifestToken: integrity.manifestToken || nextCache?.integrity?.manifestToken || null,
                        lastCheckedAt: new Date().toISOString()
                    }
                });

                return {
                    valid: true,
                    license: online.license,
                    mode: 'online',
                    nextValidationAt: online.nextCheckRequired,
                    graceRemaining: Number.parseInt(String(online.offlineGraceHours || offlineGraceHours), 10)
                };
            } catch (networkError) {
                const graceRemaining = getGraceRemainingHours(cached?.lastValidated, offlineGraceHours);
                if (graceRemaining > 0) {
                    return {
                        valid: true,
                        license: cached?.license,
                        mode: 'offline',
                        graceRemaining,
                        message: 'License server unreachable. Running in offline grace period.'
                    };
                }

                return {
                    valid: false,
                    code: 'GRACE_EXPIRED',
                    message: 'Offline grace period expired. Please connect to internet.'
                };
            }
        } catch (error) {
            return {
                valid: false,
                code: 'VALIDATION_ERROR',
                message: error.message || 'License validation failed unexpectedly.'
            };
        }
    },

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

            const validation = await licenseService.validate(null, { forceOnline: true });
            return {
                valid: validation.valid,
                state: validation.valid ? 'active' : (validation.code || 'invalid'),
                status: validation.valid ? 'active' : 'invalid',
                mode: validation.mode,
                license: validation.license,
                graceRemaining: validation.graceRemaining,
                code: validation.code,
                message: validation.message,
                appVersion: getAppVersion(),
                deviceFingerprint: generateDeviceFingerprint()
            };
        } catch (error) {
            return {
                valid: false,
                state: 'error',
                status: 'error',
                message: 'Failed to check license status. Please try again.'
            };
        }
    },

    clearCache: () => {
        try {
            if (fs.existsSync(CACHE_FILE)) {
                fs.unlinkSync(CACHE_FILE);
            }
            return true;
        } catch (_) {
            return false;
        }
    },

    getCachedLicense: () => loadLicenseCache(),

    startBackgroundValidation: () => {
        if (backgroundTimer) {
            return;
        }

        backgroundTimer = setInterval(async () => {
            try {
                const cached = loadLicenseCache();
                if (!cached?.licenseKey) {
                    return;
                }
                await licenseService.validate(cached.licenseKey, { forceOnline: false });
            } catch (error) {
                console.error('[LICENSE] Background validation failed:', error.message);
            }
        }, 60 * 60 * 1000);

        if (typeof backgroundTimer.unref === 'function') {
            backgroundTimer.unref();
        }
    },

    stopBackgroundValidation: () => {
        if (backgroundTimer) {
            clearInterval(backgroundTimer);
            backgroundTimer = null;
        }
    }
};

licenseService.__private = {
    generateDeviceFingerprint,
    verifyActivationToken,
    verifyManifestToken,
    runIntegrityVerification,
    getAppVersion
};

module.exports = licenseService;
