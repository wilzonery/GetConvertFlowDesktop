import { useState } from 'react';
import { Upload, Play, FolderOpen, CheckCircle2, AlertCircle, Loader2, Gauge } from 'lucide-react';
import { electron, pickFiles } from '../lib/electron';
import { formatBytes } from '../lib/ffmpeg';

type CompressionMode = 'smallest' | 'balanced' | 'quality' | 'custom';
type FileType = 'video' | 'audio' | 'image' | 'unknown';
type Status = 'idle' | 'compressing' | 'done' | 'error';

interface FileInfo {
  name: string;
  path: string;
  size: number;
  fileType: FileType;
  ext: string;
}

const presetConfig: Record<CompressionMode, { label: string; desc: string; crfVideo: string; crfAudio: string; bitrateMultiplier: number }> = {
  smallest: { label: 'Smallest File', desc: 'Max compression, some quality loss', crfVideo: '32', crfAudio: '64k', bitrateMultiplier: 0.3 },
  balanced: { label: 'Balanced', desc: 'Good compression, minimal quality loss', crfVideo: '26', crfAudio: '128k', bitrateMultiplier: 0.6 },
  quality: { label: 'Best Quality', desc: 'Light compression, near-original quality', crfVideo: '20', crfAudio: '192k', bitrateMultiplier: 0.85 },
  custom: { label: 'Custom', desc: 'Set your own CRF and bitrate', crfVideo: '23', crfAudio: '128k', bitrateMultiplier: 0.7 },
};

const IMAGE_JPEG_QUALITY: Record<CompressionMode, string> = {
  smallest: '20',
  balanced: '8',
  quality: '3',
  custom: '8',
};

const AUDIO_CODECS_BY_EXT: Record<string, string> = {
  mp3: 'libmp3lame',
  wav: 'pcm_s16le',
  flac: 'flac',
  aac: 'aac',
  m4a: 'aac',
};

function detectFileType(ext: string): FileType {
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) return 'image';
  return 'unknown';
}

export default function CompressionTool() {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [mode, setMode] = useState<CompressionMode>('balanced');
  const [customCrf, setCustomCrf] = useState('23');
  const [customBitrate, setCustomBitrate] = useState('128k');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [outputPath, setOutputPath] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const pickFile = async () => {
    const paths = await pickFiles([
      { name: 'Media Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'flac', 'png', 'jpg', 'jpeg'] },
    ]);
    if (paths[0]) {
      const path = paths[0];
      const name = path.split(/[\\/]/).pop()!;
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      const info = electron ? await electron.getFileInfo(path) : { size: 0 };
      setFile({ name, path, size: info.size, fileType: detectFileType(ext), ext });
      setStatus('idle');
      setOutputSize(null);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files)[0];
    if (dropped) {
      const path = electron?.getPathForFile(dropped) || dropped.name;
      const name = dropped.name;
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      const info = electron ? await electron.getFileInfo(path) : { size: dropped.size };
      setFile({ name, path, size: info.size, fileType: detectFileType(ext), ext });
      setStatus('idle');
      setOutputSize(null);
    }
  };

  const compress = async () => {
    if (!file || !electron) return;

    if (!(await electron.checkFFmpeg())) {
      setError('FFmpeg was not found. Install it or bundle ffmpeg.exe before compressing files.');
      setStatus('error');
      return;
    }

    const cfg = presetConfig[mode];
    const settingsObj = await electron.getSettings();
    const outFolder = settingsObj.outputFolder;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const out = `${outFolder}/${baseName}_compressed.${file.ext}`;

    setStatus('compressing');
    setProgress(0);
    setError('');
    setOutputPath('');

    let args: string[] = [];
    const crf = mode === 'custom' ? customCrf : cfg.crfVideo;
    const abr = mode === 'custom' ? customBitrate : cfg.crfAudio;
    const imageQuality = IMAGE_JPEG_QUALITY[mode];

    if (file.fileType === 'video' && file.ext === 'webm') {
      args = ['-c:v', 'libvpx-vp9', '-crf', crf, '-b:v', '0', '-c:a', 'libopus', '-b:a', abr];
    } else if (file.fileType === 'video') {
      args = ['-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-c:a', 'aac', '-b:a', abr];
    } else if (file.fileType === 'audio') {
      const lossy = ['mp3', 'aac', 'm4a'].includes(file.ext);
      args = ['-vn', '-c:a', AUDIO_CODECS_BY_EXT[file.ext] ?? 'libmp3lame', ...(lossy ? ['-b:a', abr] : [])];
    } else if (file.fileType === 'image') {
      args = ['-vframes', '1', ...(['jpg', 'jpeg'].includes(file.ext) ? ['-q:v', imageQuality] : [])];
    }

    const id = `compress-${Date.now()}`;
    const unsub = electron.onProgress(id, ({ progress: p }) => setProgress(p));

    try {
      const result = await electron.convertFile({ id, inputPath: file.path, outputPath: out, args });
      setOutputPath(result.outputPath);
      setStatus('done');

      const info = await electron.getFileInfo(result.outputPath);
      setOutputSize(info.size);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Compression failed.');
      setStatus('error');
    } finally {
      unsub();
    }
  };

  const estimatedSize = file
    ? Math.round(file.size * presetConfig[mode].bitrateMultiplier)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Gauge size={22} className="text-yellow-400" />
          <h1 className="text-2xl font-bold text-fg">Compression Tool</h1>
        </div>
        <p className="text-zinc-500 mb-8">Reduce file size while preserving quality.</p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={!file ? pickFile : undefined}
          className={`
            border-2 border-dashed rounded-2xl p-6 text-center transition-all mb-6 cursor-pointer
            ${isDragging ? 'border-yellow-500 bg-yellow-500/5' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/30'}
          `}
        >
          {file ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gauge size={18} className="text-yellow-400" />
                <div className="text-left">
                  <p className="text-fg text-sm font-medium">{file.name}</p>
                  <p className="text-zinc-500 text-xs">{formatBytes(file.size)} — {file.ext.toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); }}
                className="text-zinc-600 hover:text-red-400 text-xs transition-colors px-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <Upload size={28} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-zinc-400 text-sm">Drop a video, audio, or image file or <span className="text-yellow-400">click to browse</span></p>
            </>
          )}
        </div>

        {file && (
          <>
            {/* Size preview */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <p className="text-zinc-500 text-xs mb-1">Original Size</p>
                  <p className="text-fg text-xl font-bold">{formatBytes(file.size)}</p>
                </div>
                <div className="flex-1 mx-6">
                  <div className="h-px bg-zinc-800 relative">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 bg-yellow-500 h-1 rounded-full transition-all duration-500"
                      style={{ width: `${100 - presetConfig[mode].bitrateMultiplier * 100}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-yellow-400 mt-2">
                    ~{Math.round((1 - presetConfig[mode].bitrateMultiplier) * 100)}% smaller
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-zinc-500 text-xs mb-1">{outputSize ? 'Final Size' : 'Est. Output Size'}</p>
                  <p className="text-yellow-400 text-xl font-bold">
                    {outputSize ? formatBytes(outputSize) : formatBytes(estimatedSize)}
                  </p>
                </div>
              </div>
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {(Object.entries(presetConfig) as [CompressionMode, typeof presetConfig[CompressionMode]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    mode === key ? 'border-yellow-500 bg-yellow-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <p className={`text-sm font-semibold ${mode === key ? 'text-fg' : 'text-zinc-400'}`}>{cfg.label}</p>
                  <p className="text-zinc-600 text-xs mt-0.5">{cfg.desc}</p>
                </button>
              ))}
            </div>

            {mode === 'custom' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">CRF Value (lower = better)</label>
                  <input
                    type="number"
                    min="0" max="51"
                    value={customCrf}
                    onChange={(e) => setCustomCrf(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-fg text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Audio Bitrate</label>
                  <input
                    type="text"
                    value={customBitrate}
                    onChange={(e) => setCustomBitrate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-fg text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-500"
                  />
                </div>
              </div>
            )}

            {/* Progress */}
            {status === 'compressing' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="text-yellow-400 animate-spin" />
                    <span className="text-fg text-sm">Compressing...</span>
                  </div>
                  <span className="text-yellow-400 font-bold">{progress}%</span>
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
                    <p className="text-fg font-medium">Compression complete!</p>
                    <p className="text-zinc-500 text-xs">{outputSize && `Saved ${formatBytes(file.size - outputSize)} (${Math.round((1 - outputSize / file.size) * 100)}% smaller)`}</p>
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
                <p className="text-zinc-400 text-sm">{error}</p>
              </div>
            )}

            {status !== 'compressing' && (
              <button
                onClick={compress}
                disabled={!electron}
                className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-2xl transition-all text-sm"
              >
                <Play size={16} /> {electron ? 'Compress File' : 'Run in Electron to compress'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
