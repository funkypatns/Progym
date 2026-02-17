const fs = require('fs');
const path = require('path');

const MANIFESTS_ROOT = path.join(__dirname, '../../data/integrity-manifests');

function sanitizeVersion(version) {
    const normalized = String(version || '').trim();
    if (!normalized) {
        return '';
    }

    if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
        return '';
    }

    return normalized;
}

function getManifestPaths(version) {
    const safeVersion = sanitizeVersion(version);
    if (!safeVersion) {
        return null;
    }

    const versionDir = path.join(MANIFESTS_ROOT, safeVersion);
    return {
        version: safeVersion,
        versionDir,
        manifestPath: path.join(versionDir, 'integrity-manifest.json'),
        signaturePath: path.join(versionDir, 'integrity-manifest.sig')
    };
}

function getSignedManifestForVersion(version) {
    const paths = getManifestPaths(version);
    if (!paths) {
        return null;
    }

    if (!fs.existsSync(paths.manifestPath) || !fs.existsSync(paths.signaturePath)) {
        return null;
    }

    try {
        const manifestRaw = fs.readFileSync(paths.manifestPath, 'utf8');
        const manifest = JSON.parse(manifestRaw);
        const signature = fs.readFileSync(paths.signaturePath, 'utf8').trim();

        if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.artifacts)) {
            return null;
        }

        if (!signature) {
            return null;
        }

        return {
            version: paths.version,
            manifest,
            manifestRaw,
            signature
        };
    } catch (error) {
        console.error('[INTEGRITY] Failed to load signed manifest:', error.message);
        return null;
    }
}

module.exports = {
    MANIFESTS_ROOT,
    getSignedManifestForVersion
};