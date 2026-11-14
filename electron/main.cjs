const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { runFfmpeg, cancelJob } = require('./ffmpeg-runner.cjs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// Active ffmpeg jobs, keyed by job id, for cancellation
const activeProcesses = new Map();

// ─── Crash / error logging (local file only, nothing is sent anywhere) ───────
function logError(label, err) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const line = `[${new Date().toISOString()}] ${label}: ${err && err.stack ? err.stack : String(err)}\n`;
    fs.appendFileSync(path.join(dir, 'error.log'), line, 'utf-8');
  } catch { /* logging must never crash the app */ }
}
process.on('uncaughtException', (err) => {
  logError('uncaughtException', err);
  try { dialog.showErrorBox('ConvertFlow hit an unexpected error', `${err && err.message ? err.message : err}\n\nDetails were saved to the error log in the app data folder.`); } catch { /* ignore */ }
});
process.on('unhandledRejection', (reason) => logError('unhandledRejection', reason));

// Only one running copy of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: readSavedSettings().theme === 'light' ? '#f4f4f5' : readSavedSettings().theme === 'darker' ? '#000000' : '#09090b',
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Lock the window to the app's own content: no popups, no navigation away, no permission prompts.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(devServerUrl) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  if (isDev) {
    win.loadURL(devServerUrl);
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// ─── Auto-update (installed builds only) ─────────────────────────────────────
function setupAutoUpdate() {
  if (!app.isPackaged || process.windowsStore) return; // the Microsoft Store updates its own copy
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    logError('updater-load', err);
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // if the user picks "Later", it installs when they close the app
  autoUpdater.on('error', (err) => logError('updater', err));
  autoUpdater.on('update-downloaded', (info) => {
    const options = {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `ConvertFlow ${info.version} is ready to install`,
      detail: 'Restart to finish updating. If you choose Later, it installs the next time you close the app.',
    };
    const win = BrowserWindow.getAllWindows()[0];
    (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options))
      .then(({ response }) => { if (response === 0) autoUpdater.quitAndInstall(); })
      .catch((err) => logError('updater-dialog', err));
  });
  const check = () => autoUpdater.checkForUpdates().catch((err) => logError('updater-check', err));
  check();
  setInterval(check, 6 * 60 * 60 * 1000); // look again every 6 hours
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Window Controls ─────────────────────────────────────────────────────────
ipcMain.on('window-minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('window-maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});
ipcMain.on('window-close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

// ─── Settings Storage ─────────────────────────────────────────────────────────
const settingsFile = path.join(app.getPath('userData'), 'settings.json');

const defaultSettings = {
  outputFolder: app.getPath('downloads'),
  hardwareAcceleration: false,
  defaultQuality: 'balanced',
  theme: 'dark',
};

ipcMain.handle('settings-get', () => {
  try {
    if (fs.existsSync(settingsFile)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) };
    }
  } catch {}
  return defaultSettings;
});

ipcMain.handle('settings-save', (_e, data) => {
  const safeSettings = {
    ...defaultSettings,
    outputFolder: typeof data?.outputFolder === 'string' && path.isAbsolute(data.outputFolder) ? data.outputFolder : defaultSettings.outputFolder,
    hardwareAcceleration: Boolean(data?.hardwareAcceleration),
    defaultQuality: ['fast', 'balanced', 'quality'].includes(data?.defaultQuality) ? data.defaultQuality : defaultSettings.defaultQuality,
    theme: ['light', 'dark', 'darker'].includes(data?.theme) ? data.theme : defaultSettings.theme,
  };
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(safeSettings), 'utf-8');
  return true;
});

// ─── Folder / File Dialogs ────────────────────────────────────────────────────
ipcMain.handle('dialog-open-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.filePaths[0] || null;
});

ipcMain.handle('dialog-open-files', async (_e, filters) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  return result.filePaths;
});

ipcMain.handle('shell-open-folder', (_e, folderPath) => {
  if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) {
    throw new Error('A valid local folder path is required.');
  }
  return shell.openPath(folderPath);
});

ipcMain.handle('shell-open-external', (_e, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS links can be opened.');
    return shell.openExternal(parsed.toString());
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid external link.');
  }
});

// ─── File Info ────────────────────────────────────────────────────────────────
ipcMain.handle('file-info', (_e, filePath) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return { size: 0, exists: false };
  try {
    const stats = fs.statSync(filePath);
    return { size: stats.size, exists: true };
  } catch {
    return { size: 0, exists: false };
  }
});

// ─── FFmpeg Detection ─────────────────────────────────────────────────────────
function getFFmpegPath() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  // Packaged app: bundled in resources. Development: the project's resources/ffmpeg folder.
  const bundleDir = app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg')
    : path.join(__dirname, '..', 'resources', 'ffmpeg');
  const candidates = [path.join(bundleDir, exe), path.join(bundleDir, 'bin', exe)];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg'; // fall back to system PATH
}

ipcMain.handle('ffmpeg-check', () => {
  return new Promise((resolve) => {
    execFile(getFFmpegPath(), ['-version'], (err) => {
      resolve(!err);
    });
  });
});

// ─── FFmpeg Convert ───────────────────────────────────────────────────────────
function readSavedSettings() {
  try {
    if (fs.existsSync(settingsFile)) return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) };
  } catch { /* fall back to defaults */ }
  return defaultSettings;
}

ipcMain.handle('ffmpeg-convert', async (event, job) => {
  try {
    return await runFfmpeg({
      ffmpegPath: getFFmpegPath(),
      job,
      hwaccel: readSavedSettings().hardwareAcceleration,
      onProgress: (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send(`ffmpeg-progress-${job.id}`, { progress });
      },
      registry: activeProcesses,
    });
  } catch (err) {
    if (!(err && err.cancelled)) logError('ffmpeg-convert', err);
    throw err;
  }
});

ipcMain.handle('ffmpeg-cancel', (_e, id) => cancelJob(activeProcesses, id));

// ─── App Info ─────────────────────────────────────────────────────────────────
ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('app-cache-clear', async (e) => {
  await BrowserWindow.fromWebContents(e.sender)?.webContents.session.clearCache();
  return true;
});

app.on('before-quit', () => {
  for (const id of [...activeProcesses.keys()]) cancelJob(activeProcesses, id);
});
