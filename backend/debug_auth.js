try {
    console.log('--- CHECKING AUTH STACK ---');
    console.log('1. Require permissions.js');
    const permissions = require('./utils/permissions');
    console.log('✅ permissions.js loaded');

    console.log('2. Require permissionsStore.js');
    const store = require('./utils/permissionsStore');
    console.log('✅ permissionsStore.js loaded');

    console.log('3. Require auth.js (middleware)');
    const auth = require('./middleware/auth');
    console.log('✅ auth.js loaded');

    console.log('4. Testing perm normalization');
    const norm = store.normalizePermissions('foo,bar');
    console.log('✅ Permissions normalized:', norm);

} catch (error) {
    console.error('❌ CRASH in Auth Stack:', error);
}
