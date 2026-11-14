import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, X, Play, FolderOpen, AlertCircle, CheckCircle2, FileVideo, FileAudio, FileImage,
  ChevronDown, Loader2, XCircle
} from 'lucide-react';
import { electron, pickFiles } from '../lib/electron';
import {
  convertFile, detectCategory, compatibleFormats, ALL_INPUT_EXTS,
  VIDEO_OUTPUTS, AUDIO_OUTPUTS, IMAGE_OUTPUTS, type OutputFormat, type ConversionSettings,
} from '../lib/ffmpeg';

interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
}

type Status = 'idle' | 'converting' | 'done' | 'error';

const RESOLUTIONS = ['original', '3840x2160', '1920x1080', '1280x720', '854x480', '640x360'];
const FPS_OPTIONS = ['original', '60', '30', '25', '24', '15'];
const VIDEO_BITRATES = ['auto', '8000k', '5000k', '3000k', '2000k', '1000k', '500k'];
const AUDIO_BITRATES = ['auto', '320k', '256k', '192k', '128k', '96k', '64k'];
const SAMPLE_RATES = ['original', '48000', '44100', '22050'];
const PRESETS = ['ultrafast', 'fast', 'medium', 'slow', 'veryslow'] as const;
const CRF_VALUES = ['18', '20', '23', '26', '28', '32'];
const VIDEO_CODECS: Record<string, string[]> = {
  mp4: ['libx264', 'libx265', 'mpeg4'],
  mov: ['libx264', 'libx265', 'prores'],
  avi: ['mpeg4', 'libx264', 'libxvid'],
  mkv: ['libx264', 'libx265', 'libvpx-vp9'],
  webm: ['libvpx-vp9', 'libvpx'],
  gif: ['gif'],
};

export default function Converter() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [format, setFormat] = useState<OutputFormat>('mp4');
  const [settings, setSettings] = useState<Partial<ConversionSettings>>({
    resolution: 'original',
    fps: 'original',
    videoBitrate: 'auto',
    codec: '',
    audioBitrate: 'auto',
    audioSampleRate: 'original',
    qualityPreset: 'medium',
    compressionLevel: '23',
  });
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const addFiles = useCallback((paths: string[]) => {
    const newItems: FileItem[] = paths.slice(0, 1).map((p) => ({
      id: crypto.randomUUID(),
      name: p.split(/[\\/]/).pop() ?? p,
      path: p,
      size: 0,
      type: p.split('.').pop()?.toLowerCase() ?? '',
    }));
    setFiles(newItems);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
      const paths = Array.from(e.dataTransfer.files).map((f) => electron?.getPathForFile(f) || f.name);
    if (paths.length) addFiles(paths);
  }, [addFiles]);

  const onBrowse = async () => {
    const paths = await pickFiles([
      { name: 'Media Files', extensions: ALL_INPUT_EXTS },
    ]);
    if (paths.length) addFiles(paths);
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const startConvert = async () => {
    if (!files.length) return;
    if (!electron) {
      setError('FFmpeg conversion requires the Electron desktop app.');
      setStatus('error');
      return;
    }
    if (!(await electron.checkFFmpeg())) {
      setError('FFmpeg was not found. Install it or bundle ffmpeg.exe before converting files.');
      setStatus('error');
      return;
    }

    const file = files[0];
    const settingsObj = await electron.getSettings();
    const outFolder = settingsObj.outputFolder;
    const ext = format;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const out = `${outFolder}/${baseName}_converted.${ext}`;

    setStatus('converting');
    setProgress(0);
    setError('');
    setOutputPath('');

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const savedPath = await convertFile(
        file.path,
        out,
        { format, hardwareAcceleration: settingsObj.hardwareAcceleration, ...settings } as ConversionSettings,
        setProgress,
        abort.signal
      );
      setOutputPath(savedPath);
      setStatus('done');
    } catch (err: unknown) {
      if (abort.signal.aborted) {
        setStatus('idle');
      } else {
        setError((err as Error).message ?? 'Conversion failed.');
        setStatus('error');
      }
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setStatus('idle');
    setProgress(0);
  };

  const isAudioFormat = AUDIO_OUTPUTS.includes(format);
  const isImageFormat = IMAGE_OUTPUTS.includes(format);
  const codecOptions = VIDEO_CODECS[format] ?? [];

  const category = files.length > 0 ? detectCategory(files[0].type) : 'unknown';
  const compatible = compatibleFormats(category, files[0]?.type ?? '');
  const videoChoices = compatible.formats.filter((f) => VIDEO_OUTPUTS.includes(f));
  const audioChoices = compatible.formats.filter((f) => AUDIO_OUTPUTS.includes(f));
  const imageChoices = compatible.formats.filter((f) => IMAGE_OUTPUTS.includes(f));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (key: keyof ConversionSettings, val: any) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (files.length === 0) return;
    if (!compatible.formats.includes(format)) {
      setFormat(compatible.defaultFormat);
      setSettings((prev) => ({ ...prev, codec: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-fg mb-1">Advanced Converter</h1>
        <p className="text-zinc-500 mb-8">Full control over format, codec, resolution, bitrate and more.</p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={files.length === 0 ? onBrowse : undefined}
          className={`
            relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer
            ${isDragging ? 'border-yellow-500 bg-yellow-500/5' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'}
            ${files.length > 0 ? 'cursor-default' : ''}
          `}
        >
          {files.length === 0 ? (
            <>
              <Upload size={36} className="mx-auto text-zinc-600 mb-3" />
              <p className="text-fg font-medium">Drop files here or click to browse</p>
              <p className="text-zinc-500 text-sm mt-1">Supports video, audio, and image files (PNG, JPG, WEBP, BMP, TIFF, ICO, GIF and more)</p>
              
            </>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 bg-zinc-800 rounded-xl px-4 py-3 text-left">
                  {detectCategory(f.type) === 'audio' ? (
                    <FileAudio size={18} className="text-yellow-400 shrink-0" />
                  ) : detectCategory(f.type) === 'image' ? (
                    <FileImage size={18} className="text-yellow-400 shrink-0" />
                  ) : (
                    <FileVideo size={18} className="text-yellow-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm font-medium truncate">{f.name}</p>
                    <p className="text-zinc-500 text-xs">{f.type.toUpperCase()}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); onBrowse(); }}
                className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors mt-1"
              >
                Replace file
              </button>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-6">
            {/* Format selector */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">Output Format</label>
              <div className="space-y-3">
                {videoChoices.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Video</p>
                    <div className="flex flex-wrap gap-2">
                      {videoChoices.map((f) => (
                        <button
                          key={f}
                          onClick={() => { setFormat(f); set('codec', ''); }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            format === f
                              ? 'bg-yellow-500 text-black'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                          }`
                          }
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {imageChoices.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Image</p>
                    <div className="flex flex-wrap gap-2">
                      {imageChoices.map((f) => (
                        <button
                          key={f}
                          onClick={() => { setFormat(f); set('codec', ''); }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            format === f
                              ? 'bg-yellow-500 text-black'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                          }`}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {audioChoices.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Audio</p>
                    <div className="flex flex-wrap gap-2">
                      {audioChoices.map((f) => (
                        <button
                          key={f}
                          onClick={() => { setFormat(f); set('codec', ''); }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            format === f
                              ? 'bg-yellow-500 text-black'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                          }`
                          }
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Advanced settings */}
            <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
              <h3 className="text-fg font-semibold mb-4">Advanced Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                {!isAudioFormat && !isImageFormat && (
                  <>
                    <SelectField label="Resolution" value={settings.resolution ?? 'original'} options={RESOLUTIONS} onChange={(v) => set('resolution', v)} />
                    <SelectField label="Frame Rate (FPS)" value={settings.fps ?? 'original'} options={FPS_OPTIONS} onChange={(v) => set('fps', v)} />
                    <SelectField label="Video Bitrate" value={settings.videoBitrate ?? 'auto'} options={VIDEO_BITRATES} onChange={(v) => set('videoBitrate', v)} />
                    {codecOptions.length > 0 && (
                      <SelectField label="Video Codec" value={settings.codec || codecOptions[0] || ''} options={codecOptions} onChange={(v) => set('codec', v)} />
                    )}
                    <SelectField label="Quality Preset" value={settings.qualityPreset ?? 'medium'} options={[...PRESETS]} onChange={(v) => set('qualityPreset', v)} />
                    {format !== 'gif' && (
                      <SelectField label="CRF (Quality)" value={settings.compressionLevel ?? '23'} options={CRF_VALUES} onChange={(v) => set('compressionLevel', v)} />
                    )}
                  </>
                )}
                {!isImageFormat && format !== 'gif' && (
                  <>
                    <SelectField label="Audio Bitrate" value={settings.audioBitrate ?? 'auto'} options={AUDIO_BITRATES} onChange={(v) => set('audioBitrate', v)} />
                    <SelectField label="Audio Sample Rate" value={settings.audioSampleRate ?? 'original'} options={SAMPLE_RATES} onChange={(v) => set('audioSampleRate', v)} />
                  </>
                )}
                {isImageFormat && (
                  <p className="col-span-2 text-sm text-zinc-500">Image conversion uses the first frame of the file. No extra settings are needed.</p>
                )}
              </div>
            </div>

            {/* Progress */}
            {status === 'converting' && (
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="text-yellow-400 animate-spin" />
                    <span className="text-fg text-sm font-medium">Converting...</span>
                  </div>
                  <span className="text-yellow-400 font-bold">{progress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <button onClick={cancel} className="mt-3 flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
                  <XCircle size={14} /> Cancel Conversion
                </button>
              </div>
            )}

            {status === 'done' && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                  <div>
                    <p className="text-fg font-medium">Conversion complete!</p>
                    <p className="text-zinc-400 text-sm truncate max-w-xs">{outputPath}</p>
                  </div>
                </div>
                {electron != null && (
                  <button
                    onClick={() => electron!.openFolder(outputPath.replace(/[/\\][^/\\]+$/, ''))}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-fg px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    <FolderOpen size={14} /> Open Folder
                  </button>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-fg font-medium">Conversion failed</p>
                  <p className="text-zinc-400 text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Action button */}
            {status !== 'converting' && (
              <button
                onClick={startConvert}
                className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-bold py-3.5 rounded-2xl transition-all duration-200 text-sm"
              >
                <Play size={16} />
                Convert {files.length > 1 ? `${files.length} Files` : 'File'} to {format.toUpperCase()}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-fg text-sm rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-yellow-500 transition-colors"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  );
}

export { SelectField };
