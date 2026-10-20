"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const path = __importStar(require("path"));
electron_updater_1.autoUpdater.logger = console;
electron_updater_1.autoUpdater.autoDownload = false;
electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 840,
        minWidth: 900,
        minHeight: 600,
        title: 'LuluaX-Request API Client',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        backgroundColor: '#0c0e14',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadURL('http://127.0.0.1:3990');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function setupAutoUpdater() {
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Memeriksa pembaruan LuluaX-Request di GitHub...');
    });
    electron_updater_1.autoUpdater.on('update-available', async (info) => {
        console.log(`[AutoUpdater] Versi baru ditemukan: v${info.version}`);
        if (!mainWindow || mainWindow.isDestroyed())
            return;
        const dialogResult = await electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            buttons: ['Download Pembaruan Sekarang', 'Nanti Saja'],
            defaultId: 0,
            cancelId: 1,
            title: 'Pembaruan Tersedia',
            message: `Versi baru v${info.version} telah tersedia di GitHub!`,
            detail: `Apakah Anda ingin mengunduh pembaruan ini sekarang?`
        });
        if (dialogResult.response === 0) {
            electron_updater_1.autoUpdater.downloadUpdate().catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                console.error('[AutoUpdater] Gagal mengunduh pembaruan:', message);
            });
        }
    });
    electron_updater_1.autoUpdater.on('update-not-available', (info) => {
        console.log(`[AutoUpdater] LuluaX-Request sudah versi terbaru (v${info.version}).`);
    });
    electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
        const percent = Math.round(progressObj.percent);
        console.log(`[AutoUpdater] Mengunduh: ${percent}%`);
    });
    electron_updater_1.autoUpdater.on('update-downloaded', async (info) => {
        if (!mainWindow || mainWindow.isDestroyed())
            return;
        const releaseNotesText = typeof info.releaseNotes === 'string'
            ? info.releaseNotes
            : (Array.isArray(info.releaseNotes)
                ? info.releaseNotes.map((n) => typeof n === 'string' ? n : (n.note || '')).join('\n')
                : 'Pembaruan stabilitas dan penambahan fitur terbaru.');
        const dialogResult = await electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            buttons: ['Restart & Pasang Sekarang', 'Nanti Saja'],
            defaultId: 0,
            cancelId: 1,
            title: 'Pembaruan Siap Dipasang',
            message: `🎉 Pembaruan v${info.version} berhasil diunduh!`,
            detail: `Apa saja yang baru di versi ini:\n\n${releaseNotesText}\n\nKlik "Restart & Pasang Sekarang" untuk menyelesaikan pembaruan.`
        });
        if (dialogResult.response === 0) {
            electron_updater_1.autoUpdater.quitAndInstall(false, true);
        }
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        console.error('[AutoUpdater] Error:', err.message);
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
    if (electron_1.app.isPackaged) {
        electron_updater_1.autoUpdater.checkForUpdates().catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            console.warn('[AutoUpdater] Gagal periksa update:', message);
        });
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
