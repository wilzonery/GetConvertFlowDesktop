import { electron } from './electron';

export type Theme = 'light' | 'dark' | 'darker';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'darker', label: 'Extra Dark' },
];

const STORAGE_KEY = 'convertflow-theme';

export function normalizeTheme(value: unknown): Theme {
  return value === 'light' || value === 'darker' || value === 'dark' ? value : 'dark';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable */
  }
}

/** Apply the cached theme immediately (no flash), then sync with saved desktop settings. */
export function initTheme() {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  applyTheme(normalizeTheme(cached));

  if (electron) {
    electron
      .getSettings()
      .then((s) => applyTheme(normalizeTheme(s.theme)))
      .catch(() => {});
  }
}
