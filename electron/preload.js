/**
 * ============================================
 * ELECTRON PRELOAD SCRIPT
 * ============================================
 * 
 * Secure bridge between renderer and main process.
 * Exposes safe APIs to the frontend.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

    // Updates
    restartApp: () => ipcRenderer.invoke('restart-app'),
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update-downloaded', (event, version) => callback(version));
    },

    // Platform detection
    platform: process.platform,
    isElectron: true
});
