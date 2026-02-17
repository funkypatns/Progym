/**
 * ============================================
 * BACKUP ROUTES
 * ============================================
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin'));

const isSqliteDatabase = () => (process.env.DATABASE_URL || '').trim().startsWith('file:');

const resolveDbPath = (userDataPath) => {
    const candidates = [];
    const defaultPath = path.join(userDataPath, 'data', 'gym.db');
    candidates.push(defaultPath);

    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('file:')) {
        const rawPath = dbUrl.replace('file:', '');
        if (path.isAbsolute(rawPath)) {
            candidates.push(rawPath);
        } else {
            candidates.push(path.join(__dirname, '..', 'prisma', rawPath));
            candidates.push(path.join(__dirname, '..', rawPath));
        }
    }

    candidates.push(path.join(__dirname, '..', 'prisma', 'gym.db'));

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return { missing: true, candidates };
};

/**
 * GET /api/backup/list
 * List available backups
 */
router.get('/list', async (req, res) => {
    try {
        const backupDir = path.join(req.userDataPath, 'backups');

        if (!fs.existsSync(backupDir)) {
            return res.json({
                success: true,
                data: []
            });
        }

        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.db'))
            .map(f => {
                const filePath = path.join(backupDir, f);
                const stats = fs.statSync(filePath);
                return {
                    name: f,
                    size: stats.size,
                    createdAt: stats.birthtime
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            data: files
        });

    } catch (error) {
        console.error('List backups error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list backups'
        });
    }
});

/**
 * POST /api/backup/create
 * Create a new backup
 */
router.post('/create', async (req, res) => {
    try {
        if (!isSqliteDatabase()) {
            return res.status(400).json({
                success: false,
                message: 'File backup is only supported for SQLite databases.'
            });
        }

        const backupDir = path.join(req.userDataPath, 'backups');
        const dbPathResult = resolveDbPath(req.userDataPath);

        if (dbPathResult?.missing) {
            return res.status(404).json({
                success: false,
                message: 'Database file not found',
                details: dbPathResult.candidates
            });
        }
        const dbPath = dbPathResult;

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Create backup with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `gym-backup-${timestamp}.db`;
        const backupPath = path.join(backupDir, backupName);

        fs.copyFileSync(dbPath, backupPath);

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'CREATE_BACKUP',
                details: JSON.stringify({ fileName: backupName })
            }
        });

        res.json({
            success: true,
            message: 'Backup created successfully',
            data: {
                name: backupName,
                path: backupPath
            }
        });

    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create backup'
        });
    }
});

/**
 * POST /api/backup/restore
 * Restore from a backup
 */
router.post('/restore', async (req, res) => {
    try {
        if (!isSqliteDatabase()) {
            return res.status(400).json({
                success: false,
                message: 'File restore is only supported for SQLite databases.'
            });
        }

        const { backupName } = req.body;

        if (!backupName) {
            return res.status(400).json({
                success: false,
                message: 'Backup name is required'
            });
        }

        const backupDir = path.join(req.userDataPath, 'backups');
        const dataDir = path.join(req.userDataPath, 'data');
        const backupPath = path.join(backupDir, backupName);
        const dbPath = path.join(dataDir, 'gym.db');

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                success: false,
                message: 'Backup file not found'
            });
        }

        // Create a backup of current before restore
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const preRestoreBackup = path.join(backupDir, `pre-restore-${timestamp}.db`);

        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, preRestoreBackup);
        }

        // Restore
        fs.copyFileSync(backupPath, dbPath);

        res.json({
            success: true,
            message: 'Backup restored successfully. Please restart the application.'
        });

    } catch (error) {
        console.error('Restore backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to restore backup'
        });
    }
});

/**
 * DELETE /api/backup/:name
 * Delete a backup
 */
router.delete('/:name', async (req, res) => {
    try {
        const backupDir = path.join(req.userDataPath, 'backups');
        const backupPath = path.join(backupDir, req.params.name);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                success: false,
                message: 'Backup not found'
            });
        }

        fs.unlinkSync(backupPath);

        res.json({
            success: true,
            message: 'Backup deleted'
        });

    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete backup'
        });
    }
});

/**
 * GET /api/backup/download/:name
 * Download a backup file
 */
router.get('/download/:name', async (req, res) => {
    try {
        const backupDir = path.join(req.userDataPath, 'backups');
        const backupPath = path.join(backupDir, req.params.name);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                success: false,
                message: 'Backup not found'
            });
        }

        res.download(backupPath);

    } catch (error) {
        console.error('Download backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download backup'
        });
    }
});

module.exports = router;
