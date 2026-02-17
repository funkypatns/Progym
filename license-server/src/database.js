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
 * Save database to file
 */
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

function getTableColumns(tableName) {
    const rows = getAll(`PRAGMA table_info(${tableName})`);
    return new Set(rows.map((row) => row.name));
}

function run(sql, params = [], options = {}) {
    db.run(sql, params);
    const changes = db.getRowsModified();
    const lastInsertRowid = getOne('SELECT last_insert_rowid() as id')?.id;

    if (!options.skipSave) {
        saveDatabase();
    }

    return {
        changes,
        lastInsertRowid
    };
}

function runInTransaction(callback) {
    db.run('BEGIN TRANSACTION');
    try {
        const result = callback();
        db.run('COMMIT');
        saveDatabase();
        return result;
    } catch (error) {
        try {
            db.run('ROLLBACK');
        } catch (_) {
            // no-op
        }
        throw error;
    }
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

function ensureSchemaMigrations() {
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

    db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS license_devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_id INTEGER NOT NULL,
            fingerprint TEXT NOT NULL,
            device_name TEXT,
            platform TEXT,
            app_version TEXT,
            first_activated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TEXT,
            last_seen_ip TEXT,
            status TEXT DEFAULT 'approved',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(license_id, fingerprint)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS vendor_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            display_name TEXT,
            phone TEXT,
            whatsapp TEXT,
            email TEXT,
            website TEXT,
            support_hours TEXT,
            whatsapp_template TEXT,
            version INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT
        )
    `);

    const licenseColumns = getTableColumns('licenses');
    if (!licenseColumns.has('device_limit')) {
        db.run('ALTER TABLE licenses ADD COLUMN device_limit INTEGER DEFAULT 1');
    }
    if (!licenseColumns.has('last_seen_at')) {
        db.run('ALTER TABLE licenses ADD COLUMN last_seen_at TEXT');
    }
    if (!licenseColumns.has('last_seen_ip')) {
        db.run('ALTER TABLE licenses ADD COLUMN last_seen_ip TEXT');
    }
    if (!licenseColumns.has('app_version')) {
        db.run('ALTER TABLE licenses ADD COLUMN app_version TEXT');
    }
    if (!licenseColumns.has('revoked_at')) {
        db.run('ALTER TABLE licenses ADD COLUMN revoked_at TEXT');
    }
    if (!licenseColumns.has('revoked_reason')) {
        db.run('ALTER TABLE licenses ADD COLUMN revoked_reason TEXT');
    }

    const logColumns = getTableColumns('license_logs');
    if (!logColumns.has('device_id')) {
        db.run('ALTER TABLE license_logs ADD COLUMN device_id INTEGER');
    }

    const vendorProfileColumns = getTableColumns('vendor_profile');
    if (!vendorProfileColumns.has('version')) {
        db.run('ALTER TABLE vendor_profile ADD COLUMN version INTEGER DEFAULT 1');
    }
    if (!vendorProfileColumns.has('updated_at')) {
        db.run('ALTER TABLE vendor_profile ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP');
    }
    if (!vendorProfileColumns.has('updated_by')) {
        db.run('ALTER TABLE vendor_profile ADD COLUMN updated_by TEXT');
    }

    db.run(`
        INSERT OR IGNORE INTO vendor_profile (
            id,
            display_name,
            phone,
            whatsapp,
            email,
            website,
            support_hours,
            whatsapp_template,
            version,
            updated_at,
            updated_by
        ) VALUES (1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now'), 'system')
    `);
}

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

    ensureSchemaMigrations();

    // Create default admin if not exists
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminResult = db.exec(`SELECT id FROM admin_users WHERE username = '${adminUsername}'`);

    if (adminResult.length === 0 || adminResult[0].values.length === 0) {
        const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        db.run(
            'INSERT INTO admin_users (username, password, role) VALUES (?, ?, ?)',
            [adminUsername, hashedPassword, 'superadmin']
        );
        console.log('Created default admin user');
    }

    saveDatabase();

    return db;
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
        const deviceLimit = Number.isInteger(data.deviceLimit) ? data.deviceLimit : 1;
        const result = run(
            `
            INSERT INTO licenses (license_key, type, owner_name, owner_email, gym_name, max_members, expires_at, device_limit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
            [
                key,
                data.type || 'standard',
                data.ownerName || null,
                data.ownerEmail || null,
                data.gymName || null,
                data.maxMembers || 100,
                data.expiresAt || null,
                Math.max(1, deviceLimit)
            ]
        );

        return { id: result.lastInsertRowid, key };
    },

    /**
     * Find license by key
     */
    findByKey: (key) => {
        return getOne('SELECT * FROM licenses WHERE license_key = ?', [key]);
    },

    /**
     * Find device by fingerprint
     */
    findDeviceByFingerprint: (licenseId, fingerprint) => {
        return getOne(
            'SELECT * FROM license_devices WHERE license_id = ? AND fingerprint = ?',
            [licenseId, fingerprint]
        );
    },

    /**
     * Count approved devices for a license
     */
    countApprovedDevices: (licenseId) => {
        return (
            getOne(
                "SELECT COUNT(*) AS count FROM license_devices WHERE license_id = ? AND status = 'approved'",
                [licenseId]
            )?.count || 0
        );
    },

    listDevicesByKey: (licenseKey) => {
        return getAll(
            `
            SELECT d.*, l.license_key
            FROM license_devices d
            INNER JOIN licenses l ON l.id = d.license_id
            WHERE l.license_key = ?
            ORDER BY datetime(d.last_seen_at) DESC, datetime(d.first_activated_at) DESC
        `,
            [licenseKey]
        );
    },

    listAllLicensesWithCounts: () => {
        return getAll(
            `
            SELECT
                l.*,
                COALESCE(SUM(CASE WHEN d.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_devices,
                COALESCE(COUNT(d.id), 0) AS total_devices
            FROM licenses l
            LEFT JOIN license_devices d ON d.license_id = l.id
            GROUP BY l.id
            ORDER BY datetime(l.created_at) DESC
        `
        );
    },

    findAll: () => {
        return getAll('SELECT * FROM licenses ORDER BY datetime(created_at) DESC');
    },

    recordDeviceSeen: ({
        licenseId,
        fingerprint,
        deviceName,
        platform,
        appVersion,
        ipAddress,
        status
    }) => {
        return runInTransaction(() => {
            const existing = LicenseModel.findDeviceByFingerprint(licenseId, fingerprint);

            let deviceId;
            if (existing) {
                deviceId = existing.id;
                run(
                    `
                    UPDATE license_devices
                    SET
                        device_name = COALESCE(?, device_name),
                        platform = COALESCE(?, platform),
                        app_version = COALESCE(?, app_version),
                        status = COALESCE(?, status),
                        last_seen_at = datetime('now'),
                        last_seen_ip = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `,
                    [
                        deviceName || null,
                        platform || null,
                        appVersion || null,
                        status || null,
                        ipAddress || null,
                        existing.id
                    ],
                    { skipSave: true }
                );
            } else {
                const inserted = run(
                    `
                    INSERT INTO license_devices (
                        license_id,
                        fingerprint,
                        device_name,
                        platform,
                        app_version,
                        first_activated_at,
                        last_seen_at,
                        last_seen_ip,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, datetime('now'), datetime('now'))
                `,
                    [
                        licenseId,
                        fingerprint,
                        deviceName || null,
                        platform || null,
                        appVersion || null,
                        ipAddress || null,
                        status || 'approved'
                    ],
                    { skipSave: true }
                );
                deviceId = inserted.lastInsertRowid;
            }

            run(
                `
                UPDATE licenses
                SET
                    last_seen_at = datetime('now'),
                    last_seen_ip = ?,
                    app_version = COALESCE(?, app_version),
                    updated_at = datetime('now')
                WHERE id = ?
            `,
                [ipAddress || null, appVersion || null, licenseId],
                { skipSave: true }
            );

            return getOne('SELECT * FROM license_devices WHERE id = ?', [deviceId]);
        });
    },

    activateLicense: ({ licenseId, fingerprint, gymName }) => {
        return runInTransaction(() => {
            run(
                `
                UPDATE licenses
                SET
                    hardware_id = COALESCE(hardware_id, ?),
                    status = 'active',
                    activated_at = COALESCE(activated_at, datetime('now')),
                    gym_name = COALESCE(gym_name, ?),
                    updated_at = datetime('now')
                WHERE id = ?
            `,
                [fingerprint, gymName || null, licenseId],
                { skipSave: true }
            );
        });
    },

    setDeviceStatus: (deviceId, status) => {
        const result = run(
            `
            UPDATE license_devices
            SET status = ?, updated_at = datetime('now')
            WHERE id = ?
        `,
            [status, deviceId]
        );

        return result.changes > 0;
    },

    revokeOtherApprovedDevices: (licenseId, keepDeviceId) => {
        run(
            `
            UPDATE license_devices
            SET status = 'revoked', updated_at = datetime('now')
            WHERE license_id = ?
              AND status = 'approved'
              AND id <> ?
        `,
            [licenseId, keepDeviceId]
        );
    },

    resetDevicesByKey: (licenseKey) => {
        const license = LicenseModel.findByKey(licenseKey);
        if (!license) {
            return 0;
        }

        const result = run(
            `
            UPDATE license_devices
            SET status = 'revoked', updated_at = datetime('now')
            WHERE license_id = ?
        `,
            [license.id]
        );

        return result.changes;
    },

    patchLicenseByKey: (licenseKey, updates = {}) => {
        const fields = [];
        const params = [];

        if (updates.status) {
            fields.push('status = ?');
            params.push(updates.status);
        }

        if (Number.isInteger(updates.deviceLimit)) {
            fields.push('device_limit = ?');
            params.push(Math.max(1, updates.deviceLimit));
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'revokedReason')) {
            fields.push('revoked_reason = ?');
            params.push(updates.revokedReason || null);
        }

        if (updates.status === 'revoked') {
            fields.push("revoked_at = datetime('now')");
        }

        if (fields.length === 0) {
            return false;
        }

        fields.push("updated_at = datetime('now')");

        const result = run(
            `UPDATE licenses SET ${fields.join(', ')} WHERE license_key = ?`,
            [...params, licenseKey]
        );

        return result.changes > 0;
    },

    /**
     * Validate a license
     */
    validate: ({ key, fingerprint, appVersion, ipAddress, deviceName, platform }) => {
        const license = getOne('SELECT * FROM licenses WHERE license_key = ?', [key]);

        if (!license) {
            return { valid: false, code: 'NOT_FOUND', message: 'License key not found' };
        }

        if (license.status === 'suspended') {
            return { valid: false, code: 'SUSPENDED', message: 'License has been suspended' };
        }

        if (license.status === 'revoked') {
            return { valid: false, code: 'LICENSE_REVOKED', message: 'License has been revoked' };
        }

        if (license.status === 'inactive') {
            return { valid: false, code: 'NOT_ACTIVATED', message: 'License not yet activated' };
        }

        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            run('UPDATE licenses SET status = ?, updated_at = datetime("now") WHERE id = ?', ['expired', license.id]);
            return { valid: false, code: 'EXPIRED', message: 'License has expired' };
        }

        const device = LicenseModel.findDeviceByFingerprint(license.id, fingerprint);
        if (!device || device.status !== 'approved') {
            return { valid: false, code: 'DEVICE_NOT_APPROVED', message: 'Device is not approved for this license' };
        }

        LicenseModel.recordDeviceSeen({
            licenseId: license.id,
            fingerprint,
            appVersion,
            ipAddress,
            deviceName,
            platform,
            status: 'approved'
        });

        run(
            `UPDATE licenses SET last_checked = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
            [license.id]
        );

        return {
            valid: true,
            license,
            device
        };
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
    logActivity: (licenseId, action, fingerprint, ipAddress, details = {}, deviceId = null) => {
        run(
            `
            INSERT INTO license_logs (license_id, action, hardware_id, ip_address, details, device_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
            [licenseId, action, fingerprint || null, ipAddress || null, JSON.stringify(details || {}), deviceId]
        );
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

function sanitizeVendorValue(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized || null;
}

const VendorProfileModel = {
    get: () => {
        return getOne('SELECT * FROM vendor_profile WHERE id = 1');
    },

    upsert: (data = {}, updatedBy = 'system') => {
        return runInTransaction(() => {
            const payload = {
                displayName: sanitizeVendorValue(data.displayName),
                phone: sanitizeVendorValue(data.phone),
                whatsapp: sanitizeVendorValue(data.whatsapp),
                email: sanitizeVendorValue(data.email),
                website: sanitizeVendorValue(data.website),
                supportHours: sanitizeVendorValue(data.supportHours),
                whatsappTemplate: sanitizeVendorValue(data.whatsappTemplate)
            };

            const existing = VendorProfileModel.get();

            if (!existing) {
                run(
                    `
                    INSERT INTO vendor_profile (
                        id,
                        display_name,
                        phone,
                        whatsapp,
                        email,
                        website,
                        support_hours,
                        whatsapp_template,
                        version,
                        updated_at,
                        updated_by
                    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), ?)
                `,
                    [
                        payload.displayName,
                        payload.phone,
                        payload.whatsapp,
                        payload.email,
                        payload.website,
                        payload.supportHours,
                        payload.whatsappTemplate,
                        sanitizeVendorValue(updatedBy) || 'system'
                    ],
                    { skipSave: true }
                );
            } else {
                run(
                    `
                    UPDATE vendor_profile
                    SET
                        display_name = ?,
                        phone = ?,
                        whatsapp = ?,
                        email = ?,
                        website = ?,
                        support_hours = ?,
                        whatsapp_template = ?,
                        version = COALESCE(version, 1) + 1,
                        updated_at = datetime('now'),
                        updated_by = ?
                    WHERE id = 1
                `,
                    [
                        payload.displayName,
                        payload.phone,
                        payload.whatsapp,
                        payload.email,
                        payload.website,
                        payload.supportHours,
                        payload.whatsappTemplate,
                        sanitizeVendorValue(updatedBy) || 'system'
                    ],
                    { skipSave: true }
                );
            }

            return VendorProfileModel.get();
        });
    }
};

module.exports = {
    initDatabase,
    getDb,
    generateLicenseKey,
    LicenseModel,
    AdminModel,
    VendorProfileModel,
    run,
    getOne,
    getAll,
    runInTransaction
};
