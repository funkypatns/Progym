/**
 * ============================================
 * DATABASE MODULE (using sql.js - pure JS)
 * ============================================
 * 
 * SQLite database for license storage.
 * Uses sql.js (WebAssembly-based, no native deps)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let db = null;
const DB_PATH = path.join(__dirname, '../data/licenses.db');

/**
 * Initialize database and create tables
 */
async function initDatabase() {
    const SQL = await initSqlJs();

    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load existing database or create new
    try {
        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
        } else {
            db = new SQL.Database();
        }
    } catch (e) {
        db = new SQL.Database();
    }

    // Create licenses table
    db.run(`
        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_key TEXT UNIQUE NOT NULL,
            hardware_id TEXT,
            status TEXT DEFAULT 'inactive',
            type TEXT DEFAULT 'standard',
            owner_name TEXT,
            owner_email TEXT,
            gym_name TEXT,
            max_members INTEGER DEFAULT 100,
            expires_at TEXT,
            activated_at TEXT,
            last_checked TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create activity log table
    db.run(`
        CREATE TABLE IF NOT EXISTS license_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_id INTEGER,
            action TEXT NOT NULL,
            hardware_id TEXT,
            ip_address TEXT,
            details TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create admin users table
    db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create default admin if not exists
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminResult = db.exec(`SELECT id FROM admin_users WHERE username = '${adminUsername}'`);

    if (adminResult.length === 0 || adminResult[0].values.length === 0) {
        const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        db.run(`INSERT INTO admin_users (username, password, role) VALUES (?, ?, ?)`,
            [adminUsername, hashedPassword, 'superadmin']);
        console.log('✅ Created default admin user');
    }

    // Save database
    saveDatabase();

    return db;
}

/**
 * Save database to file
 */
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

/**
 * Get database instance
 */
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Helper to run a query and get first result
 */
function getOne(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    stmt.free();
    return null;
}

/**
 * Helper to run a query and get all results
 */
function getAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

/**
 * Helper to run an insert/update/delete
 */
function run(sql, params = []) {
    db.run(sql, params);
    const changes = db.getRowsModified();
    saveDatabase();
    return {
        changes: changes,
        lastInsertRowid: getOne('SELECT last_insert_rowid() as id')?.id
    };
}

/**
 * Generate a unique license key
 * Format: GYM-XXXX-XXXX-XXXX
 */
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    for (let i = 0; i < 3; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(segment);
    }
    return `GYM-${segments.join('-')}`;
}

// ============================================
// LICENSE OPERATIONS
// ============================================

const LicenseModel = {
    /**
     * Create a new license
     */
    create: (data) => {
        const key = data.licenseKey || generateLicenseKey();
        const result = run(`
            INSERT INTO licenses (license_key, type, owner_name, owner_email, gym_name, max_members, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            key,
            data.type || 'standard',
            data.ownerName || null,
            data.ownerEmail || null,
            data.gymName || null,
            data.maxMembers || 100,
            data.expiresAt || null
        ]);

        return { id: result.lastInsertRowid, key };
    },

    /**
     * Find license by key
     */
    findByKey: (key) => {
        return getOne('SELECT * FROM licenses WHERE license_key = ?', [key]);
    },

    /**
     * Activate a license (bind to hardware)
     */
    activate: (key, hardwareId) => {
        const result = run(`
            UPDATE licenses 
            SET hardware_id = ?, status = 'active', activated_at = datetime('now'), updated_at = datetime('now')
            WHERE license_key = ? AND (hardware_id IS NULL OR hardware_id = ?)
        `, [hardwareId, key, hardwareId]);

        return result.changes > 0;
    },

    /**
     * Validate a license
     */
    validate: (key, hardwareId) => {
        const license = getOne('SELECT * FROM licenses WHERE license_key = ?', [key]);

        if (!license) {
            return { valid: false, code: 'NOT_FOUND', message: 'License key not found' };
        }

        if (license.status === 'suspended') {
            return { valid: false, code: 'SUSPENDED', message: 'License has been suspended' };
        }

        if (license.status === 'inactive') {
            return { valid: false, code: 'NOT_ACTIVATED', message: 'License not yet activated' };
        }

        if (license.hardware_id && license.hardware_id !== hardwareId) {
            return { valid: false, code: 'HARDWARE_MISMATCH', message: 'License bound to different device' };
        }

        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            run('UPDATE licenses SET status = ? WHERE id = ?', ['expired', license.id]);
            return { valid: false, code: 'EXPIRED', message: 'License has expired' };
        }

        // Update last checked
        run('UPDATE licenses SET last_checked = datetime("now") WHERE id = ?', [license.id]);

        return {
            valid: true,
            license: {
                type: license.type,
                gymName: license.gym_name,
                maxMembers: license.max_members,
                expiresAt: license.expires_at
            }
        };
    },

    /**
     * Get all licenses (for admin)
     */
    findAll: () => {
        return getAll('SELECT * FROM licenses ORDER BY created_at DESC');
    },

    /**
     * Update license status
     */
    updateStatus: (id, status) => {
        const result = run('UPDATE licenses SET status = ?, updated_at = datetime("now") WHERE id = ?', [status, id]);
        return result.changes > 0;
    },

    /**
     * Log activity
     */
    logActivity: (licenseId, action, hardwareId, ipAddress, details) => {
        run(`
            INSERT INTO license_logs (license_id, action, hardware_id, ip_address, details)
            VALUES (?, ?, ?, ?, ?)
        `, [licenseId, action, hardwareId, ipAddress, JSON.stringify(details)]);
    }
};

// ============================================
// ADMIN USER OPERATIONS
// ============================================

const AdminModel = {
    findByUsername: (username) => {
        return getOne('SELECT * FROM admin_users WHERE username = ?', [username]);
    },

    verifyPassword: (plainPassword, hashedPassword) => {
        return bcrypt.compareSync(plainPassword, hashedPassword);
    }
};

module.exports = {
    initDatabase,
    getDb,
    generateLicenseKey,
    LicenseModel,
    AdminModel,
    run,
    getOne,
    getAll
};
