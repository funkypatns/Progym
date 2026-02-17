const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT, '..', 'package.json');
const MANIFESTS_ROOT = path.join(ROOT, 'data', 'integrity-manifests');

function normalizePem(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }
    return value.replace(/\\n/g, '\n').trim();
}

function resolvePrivateKeyPem() {
    return (
        normalizePem(process.env.INTEGRITY_PRIVATE_KEY) ||
        normalizePem(process.env.LICENSE_PRIVATE_KEY) ||
        normalizePem(process.env.JWT_PRIVATE_KEY)
    );
}

function resolveVersion() {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    return process.argv[2] || process.env.APP_VERSION || packageJson.version || '0.0.0';
}

function main() {
    const privateKeyPem = resolvePrivateKeyPem();
    if (!privateKeyPem) {
        throw new Error('Missing INTEGRITY_PRIVATE_KEY (or LICENSE_PRIVATE_KEY) for manifest signing.');
    }

    const version = resolveVersion();
    const manifestDir = path.join(MANIFESTS_ROOT, version);
    const manifestPath = path.join(manifestDir, 'integrity-manifest.json');
    const signaturePath = path.join(manifestDir, 'integrity-manifest.sig');

    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest not found for version ${version}: ${manifestPath}`);
    }

    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(manifestRaw);
    signer.end();

    const signatureBase64 = signer.sign(privateKeyPem, 'base64');
    fs.writeFileSync(signaturePath, `${signatureBase64}\n`, 'utf8');

    console.log(`Manifest signature generated:`);
    console.log(`- Version: ${version}`);
    console.log(`- Manifest: ${manifestPath}`);
    console.log(`- Signature: ${signaturePath}`);
}

main();