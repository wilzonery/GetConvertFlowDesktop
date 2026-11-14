import { useState, useEffect } from 'react';
import { FolderOpen, Save, Trash2, CheckCircle2, Loader2, Cpu, Monitor, Sliders } from 'lucide-react';
import { electron, isElectron, type AppSettings } from '../lib/electron';
import { THEMES, applyTheme, normalizeTheme, type Theme } from '../lib/theme';

const defaultSettings: AppSettings = {
  outputFolder: '',
  hardwareAcceleration: false,
  defaultQuality: 'balanced',
  theme: 'dark',
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [version, setVersion] = useState('1.0.0');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (electron) {
        const s = await electron.getSettings();
        setSettings({ ...s, theme: normalizeTheme(s.theme) });
        const v = await electron.getAppVersion();
        setVersion(v);
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    if (electron) {
      await electron.saveSettings(settings);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

  const chooseTheme = async (theme: Theme) => {
    applyTheme(theme);
    const next = { ...settings, theme };
    setSettings(next);
    if (electron) {
      try {
        await electron.saveSettings(next);
      } catch {
        /* the Save button will retry */
      }
    }
  };

  const clearCache = async () => {
    if (electron) {
      await electron.clearCache();
      alert('Cache cleared.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-fg mb-1">Settings</h1>
        <p className="text-zinc-500 mb-8">Configure ConvertFlow Desktop to your preferences.</p>

        <div className="space-y-4">
          {/* Output Folder */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen size={16} className="text-yellow-400" />
              <h3 className="text-fg font-semibold">Output Folder</h3>
            </div>
            <div className="flex gap-2">
              <input
                value={settings.outputFolder}
                readOnly
                className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none cursor-default"
              />
              <button
                onClick={async () => {
                  if (electron) {
                    const folder = await electron.openFolderDialog();
                    if (folder) set('outputFolder', folder);
                  }
                }}
                disabled={!isElectron}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <FolderOpen size={14} /> Browse
              </button>
            </div>
            {!isElectron && (
              <p className="text-zinc-600 text-xs mt-2">Folder selection requires the Electron desktop app.</p>
            )}
          </div>

          {/* Performance */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={16} className="text-yellow-400" />
              <h3 className="text-fg font-semibold">Performance</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-fg text-sm font-medium">Hardware Acceleration</p>
                  <p className="text-zinc-500 text-xs">Use GPU for faster encoding when available</p>
                </div>
                <div
                  onClick={() => set('hardwareAcceleration', !settings.hardwareAcceleration)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${settings.hardwareAcceleration ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.hardwareAcceleration ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
          </div>

          {/* Quality Defaults */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sliders size={16} className="text-yellow-400" />
              <h3 className="text-fg font-semibold">Default Quality</h3>
            </div>
            <div className="flex gap-2">
              {['fast', 'balanced', 'quality'].map((q) => (
                <button
                  key={q}
                  onClick={() => set('defaultQuality', q)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all capitalize ${
                    settings.defaultQuality === q ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Monitor size={16} className="text-yellow-400" />
              <h3 className="text-fg font-semibold">Appearance</h3>
            </div>
            <div className="flex gap-2">
              {THEMES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => chooseTheme(id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    settings.theme === id ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cache / App */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 size={16} className="text-yellow-400" />
              <h3 className="text-fg font-semibold">Maintenance</h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-fg text-sm font-medium">Clear App Cache</p>
                <p className="text-zinc-500 text-xs">Remove temporary files and cached data</p>
              </div>
              <button
                onClick={clearCache}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Trash2 size={13} /> Clear Cache
              </button>
            </div>
          </div>

          {/* App info */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ConvertFlow" className="w-7 h-7 rounded" />
              <span className="text-fg font-medium">ConvertFlow Desktop</span>
            </div>
            <span className="text-zinc-500">v{version}</span>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-6">
          <button
            onClick={save}
            className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3.5 rounded-2xl transition-all text-sm"
          >
            {saved ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
}
