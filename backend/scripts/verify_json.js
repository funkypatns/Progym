const fs = require('fs');
const path = require('path');

const files = [
    'frontend/src/i18n/en.json',
    'frontend/src/i18n/ar.json'
];

files.forEach(file => {
    const filePath = path.resolve(__dirname, '../../', file);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
        console.log(`✅ ${file} is valid JSON`);
        
        // Check for duplicates (simple heuristic)
        // Note: JSON.parse ignores duplicates (takes last), but we want to know.
        // We can check root keys.
        const rootKeys = content.match(/"([^"]+)":/g).map(s => s.replace(/"|:/g, ''));
        // This regex is too simple, but good enough for top level if indented.
    } catch (error) {
        console.error(`❌ ${file} is INVALID JSON:`, error.message);
    }
});
