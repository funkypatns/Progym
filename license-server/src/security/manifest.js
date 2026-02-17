const fs = require('fs');
const path = require('path');
const { signToken } = require('./jwt');

const MANIFESTS_PATH = path.join(__dirname, '../../data/integrity-manifests.json');

function loadManifestIndex() {
    if (!fs.existsSync(MANIFESTS_PATH)) {
        return { versions: {} };
    }

    try {
        const raw = fs.readFileSync(MANIFESTS_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return { versions: {} };
        }
        return parsed;
    } catch (error) {
        console.error('[MANIFEST] Failed to parse integrity manifest file:', error.message);
        return { versions: {} };
    }
}

function getManifestForVersion(appVersion) {
    const index = loadManifestIndex();
    const versions = index.versions || {};
    const manifest = versions[appVersion] || versions['*'] || null;

    if (!manifest) {
        return null;
    }

    return {
        appVersion,
        generatedAt: manifest.generatedAt || new Date().toISOString(),
        files: Array.isArray(manifest.files) ? manifest.files : [],
        required: manifest.required !== false
    };
}

function signManifestPayload(manifest) {
    const manifestToken = signToken(
        {
            typ: 'integrity_manifest',
            manifest
        },
        { expiresIn: '7d' }
    );

    return {
        manifest,
        manifestToken
    };
}

module.exports = {
    MANIFESTS_PATH,
    getManifestForVersion,
    signManifestPayload
};