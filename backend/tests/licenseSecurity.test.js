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
    runIntegrityVerification
} = licenseService.__private;

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

test('integrity verification detects hash mismatch', () => {
    const relPath = 'backend/tests/__tmp_integrity_probe.txt';
    const absPath = path.join(process.cwd(), relPath);

    fs.writeFileSync(absPath, 'expected-content', 'utf8');

    try {
        const wrongHash = crypto.createHash('sha256').update('different-content').digest('hex');
        const result = runIntegrityVerification({
            appVersion: 'test',
            required: true,
            files: [
                {
                    path: relPath,
                    sha256: wrongHash
                }
            ]
        });

        assert.equal(result.valid, false);
        assert.equal(result.code, 'INTEGRITY_MISMATCH');
    } finally {
        if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
        }
    }
});