/**
 * ============================================
 * GYM MANAGEMENT SYSTEM - Update Manager
 * ============================================
 * 
 * Handles auto-update functionality:
 * - Checking for updates
 * - Downloading updates
 * - Installing updates
 * - Version verification
 */

const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');
const log = require('electron-log');

// Configure logging for auto-updater
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

class UpdateManager {
    /**
     * Initialize the Update Manager
     * @param {BrowserWindow} mainWindow - Reference to main window for sending events
     */
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.updateInfo = null;
        this.isDownloading = false;

        // Configure auto-updater
        this.configureAutoUpdater();

        // Set up event handlers
        this.setupEventHandlers();
    }

    /**
     * Configure auto-updater settings
     */
    configureAutoUpdater() {
        // Don't auto-download - let user choose
        autoUpdater.autoDownload = false;

        // Don't auto-install on quit - ask user first
        autoUpdater.autoInstallOnAppQuit = false;

        // Allow pre-release updates (optional)
        autoUpdater.allowPrerelease = false;

        // Allow downgrade (not recommended for production)
        autoUpdater.allowDowngrade = false;
    }

    /**
     * Set up event handlers for auto-updater
     */
    setupEventHandlers() {
        // Checking for update
        autoUpdater.on('checking-for-update', () => {
            log.info('Checking for updates...');
            this.sendToRenderer('update:checking');
        });

        // Update available
        autoUpdater.on('update-available', (info) => {
            log.info('Update available:', info.version);
            this.updateInfo = info;
            this.sendToRenderer('update:available', {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseNotes: info.releaseNotes
            });
        });

        // No update available
        autoUpdater.on('update-not-available', (info) => {
            log.info('No update available. Current version:', app.getVersion());
            this.sendToRenderer('update:not-available', {
                currentVersion: app.getVersion()
            });
        });

        // Download progress
        autoUpdater.on('download-progress', (progressObj) => {
            const progress = {
                percent: Math.round(progressObj.percent),
                bytesPerSecond: progressObj.bytesPerSecond,
                transferred: progressObj.transferred,
                total: progressObj.total
            };

            log.info(`Download progress: ${progress.percent}%`);
            this.sendToRenderer('update:progress', progress);
        });

        // Update downloaded
        autoUpdater.on('update-downloaded', (info) => {
            log.info('Update downloaded:', info.version);
            this.isDownloading = false;
            this.sendToRenderer('update:downloaded', {
                version: info.version
            });

            // Show dialog to restart
            this.showRestartDialog(info.version);
        });

        // Error
        autoUpdater.on('error', (error) => {
            log.error('Update error:', error);
            this.isDownloading = false;
            this.sendToRenderer('update:error', {
                message: error.message || 'Unknown error occurred'
            });
        });
    }

    /**
     * Send event to renderer process
     * @param {string} channel - Event channel name
     * @param {Object} data - Event data
     */
    sendToRenderer(channel, data = {}) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    /**
     * Check for available updates
     * @returns {Promise<Object>} Update check result
     */
    async checkForUpdates() {
        try {
            log.info('Manually checking for updates...');
            const result = await autoUpdater.checkForUpdates();
            return {
                success: true,
                updateAvailable: result?.updateInfo?.version !== app.getVersion(),
                currentVersion: app.getVersion(),
                latestVersion: result?.updateInfo?.version
            };
        } catch (error) {
            log.error('Check for updates failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Start downloading the update
     * @returns {Promise<Object>} Download result
     */
    async downloadUpdate() {
        if (this.isDownloading) {
            return {
                success: false,
                message: 'Download already in progress'
            };
        }

        try {
            this.isDownloading = true;
            log.info('Starting update download...');
            await autoUpdater.downloadUpdate();
            return {
                success: true,
                message: 'Download started'
            };
        } catch (error) {
            this.isDownloading = false;
            log.error('Download failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Install the downloaded update and restart
     */
    installUpdate() {
        log.info('Installing update and restarting...');
        autoUpdater.quitAndInstall(false, true);
    }

    /**
     * Show dialog asking user to restart for update
     * @param {string} version - New version number
     */
    async showRestartDialog(version) {
        const result = await dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: `Version ${version} has been downloaded`,
            detail: 'Restart the application to apply the update.',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
            cancelId: 1
        });

        if (result.response === 0) {
            this.installUpdate();
        }
    }

    /**
     * Set the update feed URL (for private servers)
     * @param {string} url - Update server URL
     */
    setFeedURL(url) {
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: url
        });
    }

    /**
     * Get current update status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            currentVersion: app.getVersion(),
            updateAvailable: this.updateInfo !== null,
            updateInfo: this.updateInfo,
            isDownloading: this.isDownloading
        };
    }
}

module.exports = UpdateManager;
