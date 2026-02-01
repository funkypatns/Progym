const licenseService = require('./services/licenseService');
const fs = require('fs');
const path = require('path');

console.log('--- START DEBUG ---');
try {
    console.log('Testing getHardwareId()...');
    const hwId = licenseService.getHardwareId();
    console.log('Hardware ID:', hwId);
} catch (error) {
    console.error('CRASH in getHardwareId:', error);
}

try {
    console.log('Testing getStatus()...');
    licenseService.getStatus().then(status => {
        console.log('Status:', status);
    }).catch(err => {
        console.error('CRASH in getStatus:', err);
    });
} catch (error) {
    console.error('CRASH calling getStatus:', error);
}

const cachePath = path.join(__dirname, 'data/license_cache.enc');
console.log('Checking cache file:', cachePath);
if (fs.existsSync(cachePath)) {
    console.log('Cache file exists. Content length:', fs.readFileSync(cachePath).length);
} else {
    console.log('Cache file does not exist.');
}
console.log('--- END DEBUG ---');
