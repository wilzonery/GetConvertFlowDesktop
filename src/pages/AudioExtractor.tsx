import { useState } from 'react';
import { Upload, Play, FolderOpen, CheckCircle2, AlertCircle, Loader2, Music, ChevronDown } from 'lucide-react';
import { electron, pickFiles } from '../lib/electron';
import { formatBytes } from '../lib/ffmpeg';

type AudioFormat = 'mp3' | 'wav' | 'flac';
type Status = 'idle' | 'extracting' | 'done' | 'error';

const BITRATES = ['320k', '256k', '192k', '128k', '96k', '64k'];
const AUDIO_CODECS: Record<AudioFormat, string> = {
  mp3: 'libmp3lame',
  wav: 'pcm_s16le',
  flac: 'flac',
};

export default function AudioExtractor() {
  const [file, setFile] = useState<{ name: string; path: string; size: number } | null>(null);
  const [format, setFormat] = useState<AudioFormat>('mp3');
  const [bitrate, setBitrate] = useState('192k');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [outputPath, setOutputPath] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const pickFile = async () => {
    const paths = await pickFiles([
      { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'] },
    ]);
    if (paths[0]) {
      const path = paths[0];
      const name = path.split(/[\\/]/).pop()!;
      const info = electron ? await electron.getFileInfo(path) : { size: 0 };
      setFile({ name, path, size: info.size });
      setStatus('idle');
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files)[0];
    if (dropped) {
      const path = electron?.getPathForFile(dropped) || dropped.name;
      const name = dropped.name;
      const info = electron ? await electron.getFileInfo(path) : { size: dropped.size };
      setFile({ name, path, size: info.size });
      setStatus('idle');
    }
  };

  const extract = async () => {
    if (!file || !electron) return;

    if (!(await electron.checkFFmpeg())) {
      setError('FFmpeg was not found. Install it or bundle ffmpeg.exe before extracting audio.');
      setStatus('error');
      return;
    }

    const settingsObj = await electron.getSettings();
    const folder = settingsObj.outputFolder;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const out = `${folder}/${baseName}_audio.${format}`;

    setStatus('extracting');
    setProgress(0);
    setError('');

    const codec = AUDIO_CODECS[format];
    const args = ['-vn', '-c:a', codec, ...(format === 'mp3' ? ['-b:a', bitrate] : [])];

    const id = `audio-${Date.now()}`;
    const unsub = electron.onProgress(id, ({ progress: p }) => setProgress(p));

    try {
      const result = await electron.convertFile({ id, inputPath: file.path, outputPath: out, args });
      setOutputPath(result.outputPath);
      setStatus('done');
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Extraction failed.');
      setStatus('error');
    } finally {
      unsub();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Music size={22} className="text-yellow-400" />
          <h1 className="text-2xl font-bold text-fg">Audio Extractor</h1>
        </div>
        <p className="text-zinc-500 mb-8">Extract audio tracks from video files. Exports as MP3, WAV, or FLAC.</p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={!file ? pickFile : undefined}
          className={`
            border-2 border-dashed rounded-2xl p-8 text-center transition-all mb-6 cursor-pointer
            ${isDragging ? 'border-yellow-500 bg-yellow-500/5' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/30'}
          `}
        >
          {file ? (
            <div className="flex items-center gap-3 justify-center">
              <Music size={18} className="text-yellow-400" />
              <div className="text-left">
                <p className="text-fg text-sm font-medium">{file.name}</p>
                <p className="text-zinc-500 text-xs">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); }}
                className="ml-4 text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <Upload size={36} className="mx-auto text-zinc-600 mb-3" />
              <p className="text-fg font-medium">Drop a video file here or click to browse</p>
              <p className="text-zinc-500 text-sm mt-1">MP4, MOV, AVI, MKV, WebM supported</p>
            </>
          )}
        </div>

        {file && (
          <>
            {/* Settings */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
              <h3 className="text-fg font-semibold mb-4">Export Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Format */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Audio Format</label>
                  <div className="flex gap-2">
                    {(['mp3', 'wav', 'flac'] as AudioFormat[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          format === f ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bitrate */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Bitrate</label>
                  <div className="relative">
                    <select
                      value={bitrate}
                      onChange={(e) => setBitrate(e.target.value)}
                      disabled={format === 'wav' || format === 'flac'}
                      className="w-full bg-zinc-800 border border-zinc-700 text-fg text-sm rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-yellow-500 disabled:opacity-50"
                    >
                      {BITRATES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  </div>
                  {(format === 'wav' || format === 'flac') && (
                    <p className="text-zinc-600 text-xs mt-1">Lossless — bitrate not applicable</p>
                  )}
                </div>
              </div>
            </div>

            {/* Progress */}
            {status === 'extracting' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="text-yellow-400 animate-spin" />
                    <span className="text-fg text-sm">Extracting audio...</span>
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
                    <p className="text-fg font-medium">Audio extracted successfully!</p>
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
                <AlertCircle size={16} className="text-red-400 mt-0.5" />
                <p className="text-zinc-400 text-sm">{error}</p>
              </div>
            )}

            {status !== 'extracting' && (
              <button
                onClick={extract}
                disabled={!electron}
                className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-2xl transition-all text-sm"
              >
                <Play size={16} /> {electron ? `Extract Audio as ${format.toUpperCase()}` : 'Run in Electron to extract audio'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
