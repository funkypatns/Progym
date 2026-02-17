const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const OUTPUT_ROOT = path.join(ROOT, 'license-server', 'data', 'integrity-manifests');

const DEFAULT_ARTIFACT_BASE_PATH = 'frontend/dist';
const EXCLUDED_DIR_PARTS = new Set([
    'node_modules',
    'uploads',
    'cache',
    'temp',
    'tmp',
    'logs'
]);
const EXCLUDED_EXTENSIONS = new Set(['.db', '.enc', '.log', '.tmp']);
const EXCLUDED_FILENAMES = new Set(['thumbs.db']);

function normalizePath(input) {
    return String(input || '').replace(/\\/g, '/');
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

function computeSha256(filePath) {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
}

function shouldExclude(relativePosixPath) {
    const lower = relativePosixPath.toLowerCase();
    const parts = lower.split('/');

    if (parts.some((part) => EXCLUDED_DIR_PARTS.has(part))) {
        return true;
    }

    const fileName = parts[parts.length - 1];
    if (EXCLUDED_FILENAMES.has(fileName)) {
        return true;
    }

    const ext = path.extname(fileName);
    if (EXCLUDED_EXTENSIONS.has(ext)) {
        return true;
    }

    return false;
}

function collectFilesRecursive(absoluteRoot, relativePath = '') {
    const currentAbsolute = path.join(absoluteRoot, relativePath);
    const items = fs.readdirSync(currentAbsolute, { withFileTypes: true });

    const files = [];
    for (const item of items) {
        const itemRelative = relativePath ? path.join(relativePath, item.name) : item.name;
        const itemPosix = normalizePath(itemRelative);

        if (shouldExclude(itemPosix)) {
            continue;
        }

        if (item.isDirectory()) {
            files.push(...collectFilesRecursive(absoluteRoot, itemRelative));
            continue;
        }

        if (!item.isFile()) {
            continue;
        }

        const absolutePath = path.join(absoluteRoot, itemRelative);
        const stats = fs.statSync(absolutePath);
        files.push({
            path: itemPosix,
            size: stats.size,
            sha256: computeSha256(absolutePath)
        });
    }

    return files;
}

function getGitShortHash() {
    try {
        return execSync('git rev-parse --short HEAD', {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (_) {
        return '';
    }
}

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function main() {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

    const appVersion = process.env.APP_VERSION || process.argv[2] || packageJson.version || '0.0.0';
    const buildId = process.env.BUILD_ID || process.argv[3] || `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${getGitShortHash() || 'local'}`;

    const artifactBasePath = normalizePath(process.env.INTEGRITY_ARTIFACT_BASE_PATH || DEFAULT_ARTIFACT_BASE_PATH);
    const artifactAbsolutePath = path.join(ROOT, artifactBasePath);

    if (!fs.existsSync(artifactAbsolutePath)) {
        throw new Error(`Artifact directory not found: ${artifactAbsolutePath}. Run frontend build first.`);
    }

    const files = collectFilesRecursive(artifactAbsolutePath).sort((a, b) => a.path.localeCompare(b.path));

    if (files.length === 0) {
        throw new Error(`No files discovered under artifact directory: ${artifactAbsolutePath}`);
    }

    const manifest = {
        schemaVersion: 1,
        appVersion,
        buildId,
        generatedAt: new Date().toISOString(),
        hashAlgorithm: 'SHA-256',
        artifacts: [
            {
                basePath: artifactBasePath,
                files
            }
        ]
    };

    const manifestDirectory = path.join(OUTPUT_ROOT, appVersion);
    ensureDirectory(manifestDirectory);

    const manifestPath = path.join(manifestDirectory, 'integrity-manifest.json');
    fs.writeFileSync(manifestPath, `${stableStringify(manifest)}\n`, 'utf8');

    console.log(`Integrity manifest generated:`);
    console.log(`- Version: ${appVersion}`);
    console.log(`- Build ID: ${buildId}`);
    console.log(`- Artifact: ${artifactBasePath}`);
    console.log(`- Files: ${files.length}`);
    console.log(`- Output: ${manifestPath}`);
}

main();