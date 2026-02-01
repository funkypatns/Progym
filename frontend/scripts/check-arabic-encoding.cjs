const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'i18n', 'ar.json');
const raw = fs.readFileSync(filePath, 'utf8');

const hasArabic = /[\u0600-\u06FF]/.test(raw);
const hasMojibake = /[ÃÂØÙ]/.test(raw);

let parsed = null;
try {
    parsed = JSON.parse(raw);
} catch (err) {
    console.error('[i18n-check] Failed to parse ar.json:', err.message);
    process.exit(1);
}

if (!hasArabic) {
    console.error('[i18n-check] ar.json does not contain Arabic Unicode characters.');
    process.exit(1);
}

if (hasMojibake) {
    console.error('[i18n-check] ar.json contains mojibake characters (Ã/Â/Ø/Ù).');
    process.exit(1);
}

if (!parsed || typeof parsed !== 'object') {
    console.error('[i18n-check] ar.json parsed output is invalid.');
    process.exit(1);
}

console.log('[i18n-check] Arabic translations look valid.');
