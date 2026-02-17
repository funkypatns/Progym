const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..', '..');
const manifestPath = path.join(root, 'license-server', 'data', 'integrity-manifests.json');
const packageJsonPath = path.join(root, 'package.json');

const criticalFiles = [
    'backend/server.js',
    'backend/routes/license.js',
    'backend/services/licenseService.js',
    'frontend/src/App.jsx',
    'frontend/src/store/index.js',
    'frontend/src/services/licenseService.js'
];

function sha256(filePath) {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
}

function main() {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = process.argv[2] || pkg.version || '0.0.0';

    const files = criticalFiles
        .map((relPath) => {
            const absolute = path.join(root, relPath);
            if (!fs.existsSync(absolute)) {
                throw new Error(`Missing critical file: ${relPath}`);
            }

            return {
                path: relPath.replace(/\\/g, '/'),
                sha256: sha256(absolute)
            };
        });

    let existing = { versions: {} };
    if (fs.existsSync(manifestPath)) {
        existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (!existing || typeof existing !== 'object') {
            existing = { versions: {} };
        }
        if (!existing.versions || typeof existing.versions !== 'object') {
            existing.versions = {};
        }
    }

    existing.versions[version] = {
        generatedAt: new Date().toISOString(),
        required: true,
        files
    };

    const dir = path.dirname(manifestPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(manifestPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
    console.log(`Wrote integrity manifest for version ${version} -> ${manifestPath}`);
}

main();