const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ISSUER = 'gym-license-server';
const AUDIENCE = 'gym-management-client';

let cachedKeys = null;

function normalizePem(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }
    return value.replace(/\\n/g, '\n').trim();
}

function loadKeys() {
    if (cachedKeys) {
        return cachedKeys;
    }

    const envPrivate = normalizePem(process.env.LICENSE_PRIVATE_KEY || process.env.JWT_PRIVATE_KEY);
    const envPublic = normalizePem(process.env.LICENSE_PUBLIC_KEY || process.env.JWT_PUBLIC_KEY);

    if (envPrivate && envPublic) {
        cachedKeys = {
            privateKey: envPrivate,
            publicKey: envPublic
        };
        return cachedKeys;
    }

    const pair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    console.warn('[LICENSE SERVER] RSA keys were not set in environment. Generated ephemeral in-memory keys.');
    cachedKeys = pair;
    return cachedKeys;
}

function getKeyId(publicKey) {
    return crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
}

function getPublicKeyBundle() {
    const { publicKey } = loadKeys();
    return {
        algorithm: 'RS256',
        issuer: ISSUER,
        audience: AUDIENCE,
        keyId: getKeyId(publicKey),
        publicKey
    };
}

function signToken(payload, options = {}) {
    const { privateKey, publicKey } = loadKeys();
    return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        keyid: getKeyId(publicKey),
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresIn: options.expiresIn || '30d'
    });
}

function verifyToken(token) {
    const { publicKey } = loadKeys();
    return jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: ISSUER,
        audience: AUDIENCE
    });
}

module.exports = {
    ISSUER,
    AUDIENCE,
    getPublicKeyBundle,
    signToken,
    verifyToken
};