import { app, BrowserWindow, dialog, type MessageBoxReturnValue } from 'electron';
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater';
import * as path from 'path';

autoUpdater.logger = console;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
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

function setupAutoUpdater(): void {
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Memeriksa pembaruan LuluaX-Request di GitHub...');
  });

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    console.log(`[AutoUpdater] Versi baru ditemukan: v${info.version}`);

    if (!mainWindow || mainWindow.isDestroyed()) return;

    const dialogResult: MessageBoxReturnValue = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Download Pembaruan Sekarang', 'Nanti Saja'],
      defaultId: 0,
      cancelId: 1,
      title: 'Pembaruan Tersedia',
      message: `Versi baru v${info.version} telah tersedia di GitHub!`,
      detail: `Apakah Anda ingin mengunduh pembaruan ini sekarang?`
    });

    if (dialogResult.response === 0) {
      autoUpdater.downloadUpdate().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[AutoUpdater] Gagal mengunduh pembaruan:', message);
      });
    }
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log(`[AutoUpdater] LuluaX-Request sudah versi terbaru (v${info.version}).`);
  });

  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    const percent = Math.round(progressObj.percent);
    console.log(`[AutoUpdater] Mengunduh: ${percent}%`);
  });

  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const releaseNotesText = typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : (Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => typeof n === 'string' ? n : (n.note || '')).join('\n')
          : 'Pembaruan stabilitas dan penambahan fitur terbaru.');

    const dialogResult: MessageBoxReturnValue = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart & Pasang Sekarang', 'Nanti Saja'],
      defaultId: 0,
      cancelId: 1,
      title: 'Pembaruan Siap Dipasang',
      message: `🎉 Pembaruan v${info.version} berhasil diunduh!`,
      detail: `Apa saja yang baru di versi ini:\n\n${releaseNotesText}\n\nKlik "Restart & Pasang Sekarang" untuk menyelesaikan pembaruan.`
    });

    if (dialogResult.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[AutoUpdater] Error:', err.message);
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[AutoUpdater] Gagal periksa update:', message);
    });
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
