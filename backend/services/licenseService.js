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
const INTEGRITY_PUBLIC_KEY_PATH = process.env.INTEGRITY_PUBLIC_KEY_PATH || path.join(__dirname, '..', 'security', 'integrity-public.pem');
const INTEGRITY_UI_MESSAGE = 'Integrity mismatch. Please reinstall or update to the latest build.';
const INTEGRITY_SIGNATURE_UI_MESSAGE = 'Integrity signature invalid. Please reinstall or update to the latest build.';

const DEFAULT_VALIDATE_INTERVAL_HOURS = Number.parseInt(process.env.LICENSE_VALIDATE_INTERVAL_HOURS || '24', 10);
const DEFAULT_OFFLINE_GRACE_HOURS = Number.parseInt(process.env.LICENSE_OFFLINE_GRACE_HOURS || '72', 10);

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

function safeReadText(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return '';
        }
        return fs.readFileSync(filePath, 'utf8');
    } catch (_) {
        return '';
    }
}

function normalizePem(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }
    return value.replace(/\\n/g, '\n').trim();
}

function getIntegrityPublicKey() {
    const fromEnv = normalizePem(process.env.INTEGRITY_PUBLIC_KEY || '');
    if (fromEnv) {
        return fromEnv;
    }
    return normalizePem(safeReadText(INTEGRITY_PUBLIC_KEY_PATH));
}

function isIntegrityStrictMode() {
    const override = String(process.env.LICENSE_ENFORCE_INTEGRITY || '').toLowerCase();
    if (override === 'true') return true;
    if (override === 'false') return false;
    return process.env.NODE_ENV === 'production';
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

function getBuildId() {
    const envBuildId = process.env.BUILD_ID || process.env.APP_BUILD_ID;
    if (envBuildId && envBuildId.trim()) {
        return envBuildId.trim();
    }

    const rootPackage = safeReadJson(path.join(APP_ROOT_PATH, 'package.json'));
    if (rootPackage?.buildId) {
        return String(rootPackage.buildId);
    }

    return '';
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

function sha256File(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
}

function normalizeRelativePath(input) {
    return String(input || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .trim();
}

function isUnsafeRelativePath(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) {
        return true;
    }
    return normalized.split('/').some((part) => !part || part === '.' || part === '..');
}

function isPathInside(basePath, targetPath) {
    const relative = path.relative(basePath, targetPath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function verifyManifestSignature(manifestPayload, signatureBase64, options = {}) {
    const strict = options.strict ?? isIntegrityStrictMode();
    const integrityPublicKey = getIntegrityPublicKey();

    if (!integrityPublicKey) {
        if (strict) {
            return {
                valid: false,
                code: 'INTEGRITY_PUBLIC_KEY_MISSING',
                message: INTEGRITY_SIGNATURE_UI_MESSAGE
            };
        }
        console.warn('[INTEGRITY] Public key not configured. Skipping strict signature validation in non-production mode.');
        return { valid: true, mode: 'dev_warning', code: 'INTEGRITY_PUBLIC_KEY_MISSING_WARN' };
    }

    if (!manifestPayload || !signatureBase64) {
        if (strict) {
            return {
                valid: false,
                code: 'INTEGRITY_SIGNATURE_MISSING',
                message: INTEGRITY_SIGNATURE_UI_MESSAGE
            };
        }
        return { valid: true, mode: 'dev_warning', code: 'INTEGRITY_SIGNATURE_MISSING_WARN' };
    }

    try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(String(manifestPayload));
        verifier.end();

        const valid = verifier.verify(integrityPublicKey, String(signatureBase64).trim(), 'base64');
        if (!valid) {
            return {
                valid: false,
                code: 'INTEGRITY_SIGNATURE_INVALID',
                message: INTEGRITY_SIGNATURE_UI_MESSAGE
            };
        }

        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            code: 'INTEGRITY_SIGNATURE_ERROR',
            message: INTEGRITY_SIGNATURE_UI_MESSAGE,
            detail: error.message
        };
    }
}

function normalizeManifest(manifest) {
    if (!manifest || !Array.isArray(manifest.artifacts)) {
        return null;
    }

    const normalizedArtifacts = manifest.artifacts
        .filter((artifact) => artifact && artifact.basePath && Array.isArray(artifact.files))
        .map((artifact) => ({
            basePath: normalizeRelativePath(artifact.basePath),
            files: artifact.files
                .filter((entry) => entry && entry.path && entry.sha256)
                .map((entry) => ({
                    path: normalizeRelativePath(entry.path),
                    sha256: String(entry.sha256).toLowerCase()
                }))
                .filter((entry) => entry.path && !isUnsafeRelativePath(entry.path))
        }))
        .filter((artifact) => artifact.basePath && !isUnsafeRelativePath(artifact.basePath) && artifact.files.length > 0);

    if (normalizedArtifacts.length === 0) {
        return null;
    }

    return {
        appVersion: manifest.appVersion,
        buildId: manifest.buildId,
        generatedAt: manifest.generatedAt,
        hashAlgorithm: String(manifest.hashAlgorithm || '').toUpperCase(),
        artifacts: normalizedArtifacts
    };
}

function runIntegrityVerification(manifest, options = {}) {
    const strict = options.strict ?? isIntegrityStrictMode();
    const normalized = normalizeManifest(manifest);
    if (!normalized) {
        if (strict) {
            return { valid: false, code: 'MANIFEST_INVALID', message: INTEGRITY_UI_MESSAGE };
        }
        return { valid: true, code: 'MANIFEST_INVALID_WARN', mode: 'dev_warning' };
    }

    if (normalized.hashAlgorithm && normalized.hashAlgorithm !== 'SHA-256') {
        if (strict) {
            return { valid: false, code: 'UNSUPPORTED_HASH_ALGORITHM', message: INTEGRITY_UI_MESSAGE };
        }
        return { valid: true, code: 'UNSUPPORTED_HASH_ALGORITHM_WARN', mode: 'dev_warning' };
    }

    for (const artifact of normalized.artifacts) {
        const artifactAbsoluteBase = path.resolve(APP_ROOT_PATH, artifact.basePath);
        if (!isPathInside(APP_ROOT_PATH, artifactAbsoluteBase)) {
            console.error('[INTEGRITY] Rejected manifest artifact outside app root:', artifact.basePath);
            if (strict) {
                return {
                    valid: false,
                    code: 'INTEGRITY_INVALID_PATH',
                    message: INTEGRITY_UI_MESSAGE
                };
            }
            return { valid: true, code: 'INTEGRITY_INVALID_PATH_WARN', mode: 'dev_warning' };
        }

        for (const fileEntry of artifact.files) {
            const absolute = path.resolve(artifactAbsoluteBase, fileEntry.path);
            const relativeManifestPath = `${artifact.basePath}/${fileEntry.path}`.replace(/\/+/g, '/');

            if (!isPathInside(artifactAbsoluteBase, absolute)) {
                console.error('[INTEGRITY] Rejected manifest file path traversal:', relativeManifestPath);
                if (strict) {
                    return {
                        valid: false,
                        code: 'INTEGRITY_INVALID_PATH',
                        message: INTEGRITY_UI_MESSAGE
                    };
                }
                return { valid: true, code: 'INTEGRITY_INVALID_PATH_WARN', mode: 'dev_warning' };
            }

            if (!fs.existsSync(absolute)) {
                console.error(`[INTEGRITY] File missing: ${relativeManifestPath}`);
                if (strict) {
                    return {
                        valid: false,
                        code: 'INTEGRITY_FILE_MISSING',
                        message: INTEGRITY_UI_MESSAGE
                    };
                }
                return { valid: true, code: 'INTEGRITY_FILE_MISSING_WARN', mode: 'dev_warning' };
            }

            const actualHash = sha256File(absolute).toLowerCase();
            if (actualHash !== fileEntry.sha256) {
                console.error(
                    `[INTEGRITY] Hash mismatch in ${relativeManifestPath}. expected=${fileEntry.sha256}, got=${actualHash}`
                );
                if (strict) {
                    return {
                        valid: false,
                        code: 'INTEGRITY_MISMATCH',
                        message: INTEGRITY_UI_MESSAGE
                    };
                }
                return { valid: true, code: 'INTEGRITY_MISMATCH_WARN', mode: 'dev_warning' };
            }
        }
    }

    return { valid: true, code: 'INTEGRITY_OK' };
}

function parseManifestPayload(manifestPayload) {
    try {
        return JSON.parse(String(manifestPayload || ''));
    } catch (_) {
        return null;
    }
}

async function fetchAndVerifyManifest({ appVersion, buildId, timeout = 8000 }) {
    const response = await axios.get(`${LICENSE_SERVER_URL}/api/integrity/manifest`, {
        timeout,
        params: {
            version: appVersion,
            ...(buildId ? { buildId } : {})
        }
    });

    if (!response?.data?.success || !response?.data?.signature || (!response?.data?.manifest && !response?.data?.manifestPayload)) {
        throw new Error('Manifest endpoint returned invalid response');
    }

    const manifestPayload = typeof response.data.manifestPayload === 'string'
        ? response.data.manifestPayload
        : stableStringify(response.data.manifest || {});

    const signatureVerification = verifyManifestSignature(manifestPayload, response.data.signature);
    if (!signatureVerification.valid) {
        return signatureVerification;
    }

    const manifest = response.data.manifest || parseManifestPayload(manifestPayload);
    if (!manifest) {
        return {
            valid: false,
            code: 'MANIFEST_PARSE_FAILED',
            message: INTEGRITY_UI_MESSAGE
        };
    }

    const integrity = runIntegrityVerification(manifest);
    return {
        ...integrity,
        manifest,
        signature: String(response.data.signature).trim(),
        buildId: response.data.buildId || manifest.buildId || null
    };
}

async function evaluateIntegrity({
    appVersion,
    buildId,
    cached
}) {
    const strict = isIntegrityStrictMode();
    const cachedManifest = cached?.integrity?.manifest;
    const cachedSignature = cached?.integrity?.signature;
    const cachedPayload = cachedManifest ? stableStringify(cachedManifest) : '';

    if (cachedManifest && cachedSignature) {
        const cachedSignatureVerification = verifyManifestSignature(cachedPayload, cachedSignature, { strict });
        if (!cachedSignatureVerification.valid) {
            return cachedSignatureVerification;
        }

        const cachedIntegrity = runIntegrityVerification(cachedManifest, { strict });
        if (!cachedIntegrity.valid) {
            return cachedIntegrity;
        }
    }

    try {
        const fresh = await fetchAndVerifyManifest({
            appVersion,
            buildId
        });

        if (!fresh.valid) {
            return fresh;
        }

        return {
            valid: true,
            manifest: fresh.manifest,
            signature: fresh.signature,
            buildId: fresh.buildId || buildId || null,
            manifestCheckedAt: new Date().toISOString()
        };
    } catch (error) {
        if (cachedManifest && cachedSignature) {
            const fallbackSignatureVerification = verifyManifestSignature(cachedPayload, cachedSignature, { strict });
            if (fallbackSignatureVerification.valid) {
                const fallbackIntegrity = runIntegrityVerification(cachedManifest, { strict });
                if (fallbackIntegrity.valid) {
                    return {
                        valid: true,
                        manifest: cachedManifest,
                        signature: cachedSignature,
                        buildId: cached?.integrity?.buildId || null,
                        manifestCheckedAt: new Date().toISOString(),
                        mode: 'cached'
                    };
                }
                return fallbackIntegrity;
            }
        }

        if (strict) {
            return {
                valid: false,
                code: 'INTEGRITY_MANIFEST_UNAVAILABLE',
                message: INTEGRITY_UI_MESSAGE
            };
        }

        console.warn('[INTEGRITY] Manifest unavailable in non-production mode:', error.message);
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

async function enforceTokenAndIntegrity({ cached, licenseKey, fingerprint, appVersion, buildId, requireIntegrity = true }) {
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
        appVersion,
        buildId,
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
        const buildId = getBuildId();

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
                buildId: buildId || null,
                license: payload.license,
                activationToken: payload.activationToken,
                publicKey: publicKeyBundle,
                lastValidated: new Date().toISOString(),
                validateIntervalHours: Number.parseInt(String(payload.validateIntervalHours || DEFAULT_VALIDATE_INTERVAL_HOURS), 10),
                offlineGraceHours: Number.parseInt(String(payload.offlineGraceHours || DEFAULT_OFFLINE_GRACE_HOURS), 10)
            });

            const integrity = await evaluateIntegrity({
                appVersion,
                buildId,
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
                    manifest: integrity.manifest || nextCache?.integrity?.manifest || null,
                    signature: integrity.signature || nextCache?.integrity?.signature || null,
                    buildId: integrity.buildId || buildId || nextCache?.integrity?.buildId || null,
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
            const buildId = cached?.integrity?.buildId || cached?.buildId || getBuildId();

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
                buildId,
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
                    buildId: buildId || online.buildId || null,
                    license: online.license,
                    activationToken: online.activationToken,
                    publicKey: localEnforcement.publicKeyBundle,
                    lastValidated: new Date().toISOString(),
                    validateIntervalHours: Number.parseInt(String(online.validateIntervalHours || validateIntervalHours), 10),
                    offlineGraceHours: Number.parseInt(String(online.offlineGraceHours || offlineGraceHours), 10)
                });

                const integrity = await evaluateIntegrity({
                    appVersion,
                    buildId,
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
                        manifest: integrity.manifest || nextCache?.integrity?.manifest || null,
                        signature: integrity.signature || nextCache?.integrity?.signature || null,
                        buildId: integrity.buildId || buildId || nextCache?.integrity?.buildId || null,
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
    verifyManifestSignature,
    runIntegrityVerification,
    stableStringify,
    getAppVersion
};

module.exports = licenseService;
