const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings-get'),
  saveSettings: (data) => ipcRenderer.invoke('settings-save', data),

  // Dialogs / shell
  openFolderDialog: () => ipcRenderer.invoke('dialog-open-folder'),
  openFilesDialog: (filters) => ipcRenderer.invoke('dialog-open-files', filters),
  openFolder: (path) => ipcRenderer.invoke('shell-open-folder', path),
  openExternal: (url) => ipcRenderer.invoke('shell-open-external', url),

  // File info
  getFileInfo: (path) => ipcRenderer.invoke('file-info', path),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // FFmpeg
  checkFFmpeg: () => ipcRenderer.invoke('ffmpeg-check'),
  convertFile: (opts) => ipcRenderer.invoke('ffmpeg-convert', opts),
  cancelConversion: (id) => ipcRenderer.invoke('ffmpeg-cancel', id),
  onProgress: (id, cb) => {
    const channel = `ffmpeg-progress-${id}`;
    const listener = (_e, data) => cb(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // App
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  clearCache: () => ipcRenderer.invoke('app-cache-clear'),

  isElectron: true,
});
