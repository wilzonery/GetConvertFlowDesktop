// Bridge to Electron IPC — falls back gracefully in browser/dev without Electron

interface ElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (data: AppSettings) => Promise<boolean>;
  openFolderDialog: () => Promise<string | null>;
  openFilesDialog: (filters?: FileFilter[]) => Promise<string[]>;
  openFolder: (path: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  getFileInfo: (path: string) => Promise<{ size: number; exists: boolean }>;
  getPathForFile: (file: File) => string;
  checkFFmpeg: () => Promise<boolean>;
  convertFile: (opts: ConvertOpts) => Promise<ConvertResult>;
  cancelConversion: (id: string) => Promise<boolean>;
  onProgress: (id: string, cb: (data: ProgressData) => void) => () => void;
  getAppVersion: () => Promise<string>;
  clearCache: () => Promise<boolean>;
  isElectron: boolean;
}

export interface AppSettings {
  outputFolder: string;
  hardwareAcceleration: boolean;
  defaultQuality: string;
  theme: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ConvertOpts {
  id: string;
  inputPath: string;
  outputPath: string;
  args: string[];
}

export interface ConvertResult {
  success: boolean;
  outputPath: string;
}

export interface ProgressData {
  progress: number;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const electron = window.electronAPI ?? null;
export const isElectron = !!window.electronAPI?.isElectron;

export function getDroppedFilePath(file: File): string {
  return electron ? electron.getPathForFile(file) : file.name;
}

export async function pickFiles(filters: FileFilter[]): Promise<string[]> {
  if (electron) return electron.openFilesDialog(filters);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.addEventListener('change', () => resolve(Array.from(input.files ?? []).map((f) => f.name)));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

export async function getFileSize(path: string): Promise<number> {
  if (!electron) return 0;
  return (await electron.getFileInfo(path)).size;
}

export async function openExternal(url: string): Promise<void> {
  if (electron) {
    await electron.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
