import { useState, useCallback, useEffect } from 'react';
import { Upload, X, Play, FolderOpen, FileVideo, FileAudio, FileImage, Layers, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { electron, pickFiles } from '../lib/electron';
import {
  buildFFmpegArgs, detectCategory, compatibleFormats, ALL_INPUT_EXTS,
  VIDEO_OUTPUTS, AUDIO_OUTPUTS, IMAGE_OUTPUTS, type OutputFormat,
} from '../lib/ffmpeg';

type JobStatus = 'waiting' | 'converting' | 'done' | 'failed';

interface BatchFile {
  id: string;
  name: string;
  path: string;
  type: string;
  status: JobStatus;
  progress: number;
  error?: string;
  outputPath?: string;
}

const statusConfig: Record<JobStatus, { label: string; color: string; icon: React.ReactNode }> = {
  waiting: { label: 'Waiting', color: 'text-zinc-400', icon: <Clock size={14} /> },
  converting: { label: 'Converting', color: 'text-yellow-400', icon: <Loader2 size={14} className="animate-spin" /> },
  done: { label: 'Done', color: 'text-emerald-400', icon: <CheckCircle2 size={14} /> },
  failed: { label: 'Failed', color: 'text-red-400', icon: <AlertCircle size={14} /> },
};

export default function BatchConverter() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [format, setFormat] = useState<OutputFormat>('mp4');
  const [isRunning, setIsRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [outFolder, setOutFolder] = useState('');
  const [error, setError] = useState('');

  const addFiles = useCallback((paths: string[]) => {
    const newItems: BatchFile[] = paths.map((p) => ({
      id: crypto.randomUUID(),
      name: p.split(/[\\/]/).pop() ?? p,
      path: p,
      type: p.split('.').pop()?.toLowerCase() ?? '',
      status: 'waiting',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newItems]);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const paths = Array.from(e.dataTransfer.files).map((f) => electron?.getPathForFile(f) || f.name);
    if (paths.length) addFiles(paths);
  };

  const onBrowse = async () => {
    const paths = await pickFiles([
      { name: 'Media Files', extensions: ALL_INPUT_EXTS },
    ]);
    if (paths.length) addFiles(paths);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => setFiles([]);

  const updateFile = (id: string, update: Partial<BatchFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...update } : f)));
  };

  const startBatch = async () => {
    if (!files.length) return;
    if (!electron) {
      setError('Batch conversion requires the Electron desktop app. Start it with npm run dev:electron.');
      return;
    }
    if (!(await electron.checkFFmpeg())) {
      setError('FFmpeg was not found. Install it or bundle ffmpeg.exe before converting files.');
      return;
    }
    setError('');
    setIsRunning(true);

    const settingsObj = await electron.getSettings();
    const folder = outFolder || settingsObj.outputFolder;

    for (const file of files) {
      if (file.status === 'done') continue;

      updateFile(file.id, { status: 'converting', progress: 0, error: undefined });

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const out = `${folder}/${baseName}_converted.${format}`;

      const args = buildFFmpegArgs({ format, qualityPreset: 'medium', compressionLevel: '23' });

      const id = `batch-${file.id}`;
      const unsub = electron.onProgress(id, ({ progress }) => {
        updateFile(file.id, { progress });
      });

      try {
        const result = await electron.convertFile({ id, inputPath: file.path, outputPath: out, args: [...args] });
        updateFile(file.id, { status: 'done', progress: 100, outputPath: result.outputPath });
      } catch (err: unknown) {
        updateFile(file.id, { status: 'failed', error: (err as Error).message ?? 'Unknown error' });
      } finally {
        unsub();
      }
    }

    setIsRunning(false);
  };

  const category = files.length > 0 ? detectCategory(files[0].type) : 'unknown';
  const compatible = compatibleFormats(category, files[0]?.type ?? '');
  const videoChoices = compatible.formats.filter((f) => VIDEO_OUTPUTS.includes(f));
  const audioChoices = compatible.formats.filter((f) => AUDIO_OUTPUTS.includes(f));
  const imageChoices = compatible.formats.filter((f) => IMAGE_OUTPUTS.includes(f));

  useEffect(() => {
    if (files.length === 0) return;
    if (!compatible.formats.includes(format)) {
      setFormat(compatible.defaultFormat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const doneCount = files.filter((f) => f.status === 'done').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const totalCount = files.length;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-fg mb-1">Batch Converter</h1>
        <p className="text-zinc-500 mb-8">Convert multiple files to one format at once.</p>
        {error && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"><AlertCircle size={16} />{error}</div>}

        {/* Format + Output */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Output Format</label>
              <div className="space-y-2">
                {videoChoices.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {videoChoices.map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          format === f ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
                {imageChoices.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {imageChoices.map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          format === f ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
                {audioChoices.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {audioChoices.map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          format === f ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-fg'
                        }`
                        }
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-zinc-400 mb-2">Output Folder</label>
              <div className="flex gap-2">
                <input
                  value={outFolder}
                  readOnly
                  placeholder="Using default from Settings..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none cursor-default"
                />
                <button
                  onClick={async () => {
                    if (electron) {
                      const folder = await electron.openFolderDialog();
                      if (folder) setOutFolder(folder);
                    }
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <FolderOpen size={13} /> Browse
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={files.length === 0 ? onBrowse : undefined}
          className={`
            border-2 border-dashed rounded-2xl p-6 text-center transition-all mb-4 cursor-pointer
            ${isDragging ? 'border-yellow-500 bg-yellow-500/5' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/30'}
          `}
        >
          <Upload size={28} className="mx-auto text-zinc-600 mb-2" />
          <p className="text-zinc-400 text-sm">Drop files here or <span className="text-yellow-400">click to browse</span></p>
        </div>

        {/* Stats bar */}
        {totalCount > 0 && (
          <div className="flex items-center gap-4 text-sm text-zinc-500 mb-4">
            <span>{totalCount} file{totalCount !== 1 ? 's' : ''}</span>
            {doneCount > 0 && <span className="text-emerald-400">{doneCount} done</span>}
            {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
            <button onClick={clearAll} disabled={isRunning} className="ml-auto text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
              Clear all
            </button>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2 mb-6">
            {files.map((f) => {
              const cfg = statusConfig[f.status];
              return (
                <div key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    {detectCategory(f.type) === 'audio' ? (
                      <FileAudio size={16} className="text-yellow-400 shrink-0" />
                    ) : detectCategory(f.type) === 'image' ? (
                      <FileImage size={16} className="text-yellow-400 shrink-0" />
                    ) : (
                      <FileVideo size={16} className="text-yellow-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-fg text-sm truncate">{f.name}</p>
                      {f.error && <p className="text-red-400 text-xs mt-0.5 truncate">{f.error}</p>}
                      {f.outputPath && f.status === 'done' && (
                        <button
                          onClick={() => electron?.openFolder(f.outputPath!.replace(/[/\\][^/\\]+$/, ''))}
                          className="text-xs text-yellow-400 hover:text-yellow-300 mt-0.5 transition-colors"
                        >
                          Open folder
                        </button>
                      )}
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
                      {cfg.icon}
                      {cfg.label}
                    </div>
                    {f.status !== 'converting' && !isRunning && (
                      <button onClick={() => removeFile(f.id)} className="text-zinc-600 hover:text-red-400 ml-2 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {f.status === 'converting' && (
                    <div className="mt-2 w-full bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="bg-yellow-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {files.length > 0 && !isRunning && (
          <div className="flex gap-3">
            <button
              onClick={startBatch}
              className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3.5 rounded-2xl transition-all text-sm"
            >
              <Play size={16} />
              Convert All to {format.toUpperCase()}
            </button>
            <button
              onClick={onBrowse}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-fg px-5 py-3.5 rounded-2xl transition-all text-sm font-medium"
            >
              <Upload size={16} /> Add More
            </button>
          </div>
        )}

        {isRunning && (
          <div className="flex items-center justify-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl py-4">
            <Loader2 size={18} className="text-yellow-400 animate-spin" />
            <span className="text-fg text-sm font-medium">Batch converting... {doneCount}/{totalCount}</span>
          </div>
        )}

        {files.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <Layers size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No files added yet. Drop files above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

