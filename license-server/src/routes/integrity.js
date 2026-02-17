const express = require('express');
const router = express.Router();
const { getSignedManifestForVersion } = require('../security/integrityManifestStore');

router.get('/manifest', (req, res) => {
    const version = req.query.version;
    const requestedBuildId = req.query.buildId;

    if (!version) {
        return res.status(400).json({
            success: false,
            code: 'MISSING_VERSION',
            message: 'version query parameter is required'
        });
    }

    const signedManifest = getSignedManifestForVersion(version);
    if (!signedManifest) {
        return res.status(404).json({
            success: false,
            code: 'MANIFEST_NOT_FOUND',
            message: `No signed manifest found for version ${version}`
        });
    }

    if (requestedBuildId && String(requestedBuildId) !== String(signedManifest.manifest.buildId || '')) {
        return res.status(404).json({
            success: false,
            code: 'MANIFEST_BUILD_NOT_FOUND',
            message: `No manifest found for version ${version} and buildId ${requestedBuildId}`
        });
    }

    return res.json({
        success: true,
        version: signedManifest.version,
        appVersion: signedManifest.manifest.appVersion,
        buildId: signedManifest.manifest.buildId,
        signatureAlgorithm: 'RSA-SHA256',
        manifestPayload: signedManifest.manifestRaw,
        manifest: signedManifest.manifest,
        signature: signedManifest.signature
    });
});

module.exports = router;
