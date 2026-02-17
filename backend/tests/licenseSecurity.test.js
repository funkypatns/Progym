const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const licenseService = require('../services/licenseService');

const {
    generateDeviceFingerprint,
    verifyActivationToken,
    verifyManifestSignature,
    runIntegrityVerification
} = licenseService.__private;

function buildReleaseManifestForFile(relativeFilePath, sha256) {
    return {
        appVersion: 'test',
        buildId: 'test-build',
        hashAlgorithm: 'SHA-256',
        artifacts: [
            {
                basePath: 'frontend/dist',
                files: [
                    {
                        path: relativeFilePath,
                        sha256
                    }
                ]
            }
        ]
    };
}

test('device fingerprint generation is stable in-process', () => {
    const first = generateDeviceFingerprint();
    const second = generateDeviceFingerprint();

    assert.equal(typeof first, 'string');
    assert.equal(first.length, 64);
    assert.equal(first, second);
});

test('activation token verification rejects fingerprint mismatch', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const token = jwt.sign(
        {
            typ: 'activation',
            licenseKey: 'GYM-TEST-1111',
            fingerprint: 'fingerprint-one',
            deviceStatus: 'approved'
        },
        privateKey,
        {
            algorithm: 'RS256',
            issuer: 'gym-license-server',
            audience: 'gym-management-client',
            expiresIn: '1h'
        }
    );

    const result = verifyActivationToken(
        token,
        {
            publicKey,
            algorithm: 'RS256',
            issuer: 'gym-license-server',
            audience: 'gym-management-client'
        },
        'fingerprint-two',
        'GYM-TEST-1111'
    );

    assert.equal(result.valid, false);
    assert.equal(result.code, 'DEVICE_FINGERPRINT_MISMATCH');
});

test('manifest signature verification blocks invalid signature in strict mode', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const manifestPayload = '{"appVersion":"test","artifacts":[{"basePath":"frontend/dist","files":[]}]}';
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(manifestPayload);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');

    const previousKey = process.env.INTEGRITY_PUBLIC_KEY;
    process.env.INTEGRITY_PUBLIC_KEY = publicKey;

    try {
        const validSignatureResult = verifyManifestSignature(manifestPayload, signature, { strict: true });
        assert.equal(validSignatureResult.valid, true);

        const invalidSignatureResult = verifyManifestSignature(manifestPayload, `${signature.slice(0, -2)}aa`, { strict: true });
        assert.equal(invalidSignatureResult.valid, false);
        assert.equal(invalidSignatureResult.code, 'INTEGRITY_SIGNATURE_INVALID');
    } finally {
        if (typeof previousKey === 'string') {
            process.env.INTEGRITY_PUBLIC_KEY = previousKey;
        } else {
            delete process.env.INTEGRITY_PUBLIC_KEY;
        }
    }
});

test('integrity verification blocks when a release artifact is tampered (strict mode)', () => {
    const distDir = path.join(process.cwd(), 'frontend', 'dist');
    const fileName = '__tmp_integrity_probe.txt';
    const relPath = `frontend/dist/${fileName}`;
    const absPath = path.join(distDir, fileName);

    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(absPath, 'original-content', 'utf8');

    const expectedHash = crypto.createHash('sha256').update('original-content').digest('hex');
    const manifest = buildReleaseManifestForFile(fileName, expectedHash);

    fs.writeFileSync(absPath, 'tampered-content', 'utf8');
    try {
        const result = runIntegrityVerification(manifest, { strict: true });

        assert.equal(result.valid, false);
        assert.equal(result.code, 'INTEGRITY_MISMATCH');
        assert.equal(result.message, 'Integrity mismatch. Please reinstall or update to the latest build.');
    } finally {
        if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
        }
    }
});

test('integrity verification passes for untampered release artifact (strict mode)', () => {
    const distDir = path.join(process.cwd(), 'frontend', 'dist');
    const fileName = '__tmp_integrity_probe_ok.txt';
    const absPath = path.join(distDir, fileName);

    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(absPath, 'expected-content', 'utf8');

    try {
        const expectedHash = crypto.createHash('sha256').update('expected-content').digest('hex');
        const manifest = buildReleaseManifestForFile(fileName, expectedHash);
        const result = runIntegrityVerification(manifest, { strict: true });

        assert.equal(result.valid, true);
        assert.equal(result.code, 'INTEGRITY_OK');
    } finally {
        if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
        }
    }
});

test('integrity mismatch does not block in dev mode', () => {
    const distDir = path.join(process.cwd(), 'frontend', 'dist');
    const fileName = '__tmp_integrity_probe_dev.txt';
    const absPath = path.join(distDir, fileName);

    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(absPath, 'expected-content', 'utf8');

    const wrongHash = crypto.createHash('sha256').update('different-content').digest('hex');
    const manifest = buildReleaseManifestForFile(fileName, wrongHash);

    try {
        const result = runIntegrityVerification(manifest, { strict: false });
        assert.equal(result.valid, true);
        assert.equal(result.code, 'INTEGRITY_MISMATCH_WARN');
    } finally {
        if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
        }
    }
});
