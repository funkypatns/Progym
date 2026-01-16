/**
 * ============================================
 * ELECTRON MAIN PROCESS
 * ============================================
 * 
 * Entry point for the Electron desktop application.
 * Handles window management, backend server, and auto-updates.
 * 
 * Author: Omar Habib Software
 */

const electron = require('electron');
const { app, BrowserWindow, ipcMain, shell, Tray, Menu } = electron;

if (!app) {
    console.error('Error: This script must be run within Electron.');
    process.exit(1);
}

const path = require('path');
const { spawn } = require('child_process');
let autoUpdater = null;
try {
    // Only load electron-updater when running in packaged Electron app
    if (app && app.isPackaged) {
        autoUpdater = require('electron-updater').autoUpdater;
    }
} catch (e) {
    console.log('electron-updater not available in dev mode');
}

// Keep references to prevent garbage collection
let mainWindow = null;
let backendProcess = null;
let tray = null;

// Configuration
const isDev = process.env.NODE_ENV === 'development' || (app && !app.isPackaged);
const BACKEND_PORT = 3001;
const FRONTEND_DEV_URL = 'http://localhost:5173';

/**
 * Create the main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        title: 'Gym Management System',
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false, // Show when ready
        backgroundColor: '#0f172a' // Dark background
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL(FRONTEND_DEV_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // Check for updates in production
        if (!isDev && autoUpdater) {
            autoUpdater.checkForUpdatesAndNotify();
        }
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle window close
    mainWindow.on('close', (event) => {
        if (process.platform === 'win32') {
            // Minimize to tray instead of closing
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Start the backend Express server
 */
function startBackend() {
    return new Promise((resolve, reject) => {
        const backendPath = isDev
            ? path.join(__dirname, '../backend/server.js')
            : path.join(process.resourcesPath, 'backend/server.js');

        // Set environment variables
        const env = {
            ...process.env,
            PORT: BACKEND_PORT,
            NODE_ENV: isDev ? 'development' : 'production',
            USER_DATA_PATH: app.getPath('userData')
        };

        backendProcess = spawn('node', [backendPath], {
            env,
            cwd: path.dirname(backendPath)
        });

        backendProcess.stdout.on('data', (data) => {
            console.log(`[Backend] ${data}`);
            if (data.toString().includes('Server running')) {
                resolve();
            }
        });

        backendProcess.stderr.on('data', (data) => {
            console.error(`[Backend Error] ${data}`);
        });

        backendProcess.on('error', (error) => {
            console.error('Failed to start backend:', error);
            reject(error);
        });

        // Resolve after timeout if no startup message
        setTimeout(resolve, 5000);
    });
}

/**
 * Create system tray icon
 */
function createTray() {
    const iconPath = path.join(__dirname, 'assets/icon.png');
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Gym Management',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                } else {
                    createWindow();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Check for Updates',
            click: () => {
                if (autoUpdater) {
                    autoUpdater.checkForUpdatesAndNotify();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Gym Management System');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
    });
}

/**
 * Setup auto-updater events
 */
function setupAutoUpdater() {
    if (!autoUpdater) return;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        console.log('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version);
    });

    autoUpdater.on('update-not-available', () => {
        console.log('No updates available');
    });

    autoUpdater.on('download-progress', (progress) => {
        console.log(`Download progress: ${progress.percent.toFixed(1)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version);
        // Notify user and install on next restart
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded', info.version);
        }
    });

    autoUpdater.on('error', (error) => {
        console.error('Auto-updater error:', error);
    });
}

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(async () => {
    console.log('🏋️ Starting Gym Management System...');

    // Start backend server
    try {
        await startBackend();
        console.log('✅ Backend server started');
    } catch (error) {
        console.error('❌ Failed to start backend:', error);
    }

    // Create main window
    createWindow();

    // Create system tray
    createTray();

    // Setup auto-updater
    setupAutoUpdater();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Don't quit on Windows - use tray
    }
});

app.on('before-quit', () => {
    // Kill backend process
    if (backendProcess) {
        backendProcess.kill();
    }
});

// ============================================
// IPC HANDLERS
// ============================================

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-user-data-path', () => {
    return app.getPath('userData');
});

ipcMain.handle('restart-app', () => {
    if (autoUpdater) {
        autoUpdater.quitAndInstall();
    }
});
