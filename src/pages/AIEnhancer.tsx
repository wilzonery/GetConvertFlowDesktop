import { useState, useCallback } from 'react';
import {
  Upload, Sparkles, Play, FolderOpen, AlertCircle, CheckCircle2,
  Loader2, Wand2, Volume2, Image, Gauge, ArrowUpCircle, Wind, Zap, Palette
} from 'lucide-react';
import { electron, pickFiles } from '../lib/electron';
import { buildEnhancementArgs } from '../lib/ffmpeg';

interface EnhancerSettings {
  noiseReduction: boolean;
  sharpen: boolean;
  colorImprove: boolean;
  upscale: boolean;
  audioCleanup: boolean;
}

type Mode = 'video' | 'audio' | 'image';
type Status = 'idle' | 'processing' | 'done' | 'error';

const modeConfig = {
  video: { label: 'Video Enhancer', icon: Wand2, desc: 'Apply AI-assisted video filters locally' },
  audio: { label: 'Audio Cleanup', icon: Volume2, desc: 'Remove noise, normalize levels' },
  image: { label: 'Image Enhancer', icon: Image, desc: 'Upscale and enhance image quality' },
};

const enhancementOptions = [
  { key: 'noiseReduction' as keyof EnhancerSettings, label: 'Noise Reduction', desc: 'Remove visual grain and static', icon: Wind },
  { key: 'sharpen' as keyof EnhancerSettings, label: 'Sharpening', desc: 'Enhance edge definition', icon: Zap },
  { key: 'colorImprove' as keyof EnhancerSettings, label: 'Color Improvement', desc: 'Boost saturation and contrast', icon: Palette },
  { key: 'upscale' as keyof EnhancerSettings, label: 'Upscale 2x', desc: 'Double resolution using Lanczos', icon: ArrowUpCircle },
  { key: 'audioCleanup' as keyof EnhancerSettings, label: 'Audio Cleanup', desc: 'Reduce background noise', icon: Volume2 },
];

export default function AIEnhancer() {
  const [mode, setMode] = useState<Mode>('video');
  const [file, setFile] = useState<{ name: string; path: string } | null>(null);
  const [settings, setSettings] = useState<EnhancerSettings>({
    noiseReduction: true,
    sharpen: false,
    colorImprove: true,
    upscale: false,
    audioCleanup: false,
  });
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const pickFile = useCallback(async () => {
    const extensions = mode === 'audio'
      ? ['mp3', 'wav', 'flac', 'aac', 'm4a']
      : mode === 'image'
      ? ['png', 'jpg', 'jpeg', 'webp', 'bmp']
      : ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const paths = await pickFiles([{ name: 'Media Files', extensions }]);
    if (paths[0]) setFile({ name: paths[0].split(/[\\/]/).pop()!, path: paths[0] });
  }, [mode]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files)[0];
    if (dropped) {
      const path = electron?.getPathForFile(dropped) || dropped.name;
      setFile({ name: dropped.name, path });
    }
  };

  const toggleSetting = (key: keyof EnhancerSettings) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const startProcessing = async () => {
    if (!file || !electron) return;

    if (!(await electron.checkFFmpeg())) {
      setError('FFmpeg was not found. Install it or bundle ffmpeg.exe before enhancing files.');
      setStatus('error');
      return;
    }

    const settingsObj = await electron.getSettings();
    const folder = settingsObj.outputFolder;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const ext = mode === 'image' ? 'png' : mode === 'audio' ? 'mp3' : 'mp4';
    const out = `${folder}/${baseName}_enhanced.${ext}`;

    setStatus('processing');
    setProgress(0);
    setError('');

    const args = buildEnhancementArgs(settings, mode);

    const id = `enhance-${Date.now()}`;
    const unsub = electron.onProgress(id, ({ progress: p }) => setProgress(p));

    try {
      const result = await electron.convertFile({ id, inputPath: file.path, outputPath: out, args });
      setOutputPath(result.outputPath);
      setStatus('done');
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Enhancement failed.');
      setStatus('error');
    } finally {
      unsub();
    }
  };

  const visibleOptions = enhancementOptions.filter(({ key }) => mode === 'audio' ? key === 'audioCleanup' : key !== 'audioCleanup' || mode === 'video');
  const activeCount = visibleOptions.filter(({ key }) => settings[key]).length;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Sparkles size={22} className="text-yellow-400" />
          <h1 className="text-2xl font-bold text-fg">AI Enhancer</h1>
        </div>
        <p className="text-zinc-500 mb-2">AI-assisted local enhancement using FFmpeg filters. No cloud required.</p>
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span className="text-blue-400 text-xs">AI-assisted local processing — your files stay private</span>
        </div>

        {/* Mode selector */}
        <div className="flex gap-3 mb-6">
          {(Object.entries(modeConfig) as [Mode, typeof modeConfig[Mode]][]).map(([key, { label, icon: Icon, desc }]) => (
            <button
              key={key}
              onClick={() => { setMode(key); setFile(null); setStatus('idle'); }}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all ${
                mode === key
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
              }`}
            >
              <Icon size={18} className={mode === key ? 'text-yellow-400' : 'text-zinc-500'} />
              <p className={`text-sm font-semibold mt-2 ${mode === key ? 'text-fg' : 'text-zinc-400'}`}>{label}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{desc}</p>
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={!file ? pickFile : undefined}
          className={`
            border-2 border-dashed rounded-2xl p-6 text-center transition-all mb-6 cursor-pointer
            ${isDragging ? 'border-yellow-500 bg-yellow-500/5' : file ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/30'}
          `}
        >
          {file ? (
            <div className="flex items-center gap-3 justify-center">
              <Gauge size={18} className="text-yellow-400" />
              <span className="text-fg text-sm font-medium">{file.name}</span>
              <button onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); }} className="text-zinc-600 hover:text-red-400 transition-colors text-xs ml-2">
                Remove
              </button>
            </div>
          ) : (
            <>
              <Upload size={28} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-zinc-400 text-sm">Drop a {mode} file or <span className="text-yellow-400">click to browse</span></p>
            </>
          )}
        </div>

        {/* Enhancement options */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-fg font-semibold">Enhancement Options</h3>
            <span className="text-xs text-zinc-500">{activeCount} active</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visibleOptions
              .map(({ key, label, desc, icon: Icon }) => {
                const isOn = settings[key];
                return (
                  <button
                    key={key}
                    onClick={() => toggleSetting(key)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      isOn ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOn ? 'bg-yellow-500/20' : 'bg-zinc-800'}`}>
                      <Icon size={14} className={isOn ? 'text-yellow-400' : 'text-zinc-500'} />
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${isOn ? 'text-fg' : 'text-zinc-400'}`}>{label}</p>
                      <p className="text-zinc-600 text-xs mt-0.5">{desc}</p>
                    </div>
                    <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isOn ? 'border-yellow-500 bg-yellow-500' : 'border-zinc-700'}`}>
                      {isOn && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Status */}
        {status === 'processing' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 size={14} className="text-yellow-400 animate-spin" />
              <span className="text-fg text-sm font-medium">Processing...</span>
              <span className="ml-auto text-yellow-400 font-bold">{progress}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div className="bg-yellow-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <div>
                <p className="text-fg font-medium">Enhancement complete!</p>
                <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-xs">{outputPath}</p>
              </div>
            </div>
            {electron != null && (
              <button
                onClick={() => electron!.openFolder(outputPath.replace(/[/\\][^/\\]+$/, ''))}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-fg px-3 py-2 rounded-xl text-sm transition-colors"
              >
                <FolderOpen size={13} /> Open
              </button>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3 mb-4">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-fg font-medium">Processing failed</p>
              <p className="text-zinc-400 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {status !== 'processing' && (
          <button
            onClick={startProcessing}
            disabled={!file || activeCount === 0}
            className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-2xl transition-all text-sm"
          >
            <Play size={16} />
            {!file ? 'Select a file to enhance' : activeCount === 0 ? 'Enable at least one enhancement' : `Enhance ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
          </button>
        )}
      </div>
    </div>
  );
}
