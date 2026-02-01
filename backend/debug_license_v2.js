try {
    const licenseService = require('./services/licenseService');
    console.log('✅ licenseService loaded successfully');

    console.log('Testing getHardwareId()...');
    const hwId = licenseService.getHardwareId();
    console.log('✅ Hardware ID:', hwId);

    console.log('Testing generateToken (auth middleware check)...');
    try {
        const auth = require('./middleware/auth');
        console.log('✅ Auth middleware loaded');
    } catch (e) {
        console.error('❌ Auth middleware failed to load:', e);
    }

} catch (error) {
    console.error('❌ CRASH loading licenseService:', error);
}
