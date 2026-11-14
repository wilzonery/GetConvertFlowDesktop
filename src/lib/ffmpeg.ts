import { electron } from './electron';

export type VideoFormat = 'mp4' | 'mov' | 'avi' | 'mkv' | 'webm' | 'gif';
export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'aac' | 'm4a' | 'ogg';
export type ImageFormat = 'png' | 'jpg' | 'webp' | 'bmp' | 'tiff' | 'ico';
export type OutputFormat = VideoFormat | AudioFormat | ImageFormat;

export const VIDEO_OUTPUTS: OutputFormat[] = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'gif'];
export const AUDIO_OUTPUTS: OutputFormat[] = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'];
export const IMAGE_OUTPUTS: OutputFormat[] = ['png', 'jpg', 'webp', 'bmp', 'tiff', 'ico'];

export const VIDEO_INPUT_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv', 'wmv', 'gif'];
export const AUDIO_INPUT_EXTS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma'];
export const IMAGE_INPUT_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'ico'];
export const ALL_INPUT_EXTS = [...VIDEO_INPUT_EXTS, ...AUDIO_INPUT_EXTS, ...IMAGE_INPUT_EXTS];

export type FileCategory = 'video' | 'audio' | 'image' | 'unknown';

export function detectCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  // A GIF is handled as an image unless the user wants video output (see compatibleFormats).
  if (VIDEO_INPUT_EXTS.includes(e)) return 'video';
  if (AUDIO_INPUT_EXTS.includes(e)) return 'audio';
  if (IMAGE_INPUT_EXTS.includes(e)) return 'image';
  return 'unknown';
}

export function compatibleFormats(category: FileCategory, ext = ''): { formats: OutputFormat[]; defaultFormat: OutputFormat } {
  switch (category) {
    case 'audio': return { formats: AUDIO_OUTPUTS, defaultFormat: 'mp3' };
    case 'image': return { formats: [...IMAGE_OUTPUTS, 'gif'], defaultFormat: ext === 'png' ? 'jpg' : 'png' };
    case 'video': return { formats: [...VIDEO_OUTPUTS, ...AUDIO_OUTPUTS, ...(ext === 'gif' ? IMAGE_OUTPUTS : [])], defaultFormat: 'mp4' };
    default: return { formats: [...VIDEO_OUTPUTS, ...AUDIO_OUTPUTS, ...IMAGE_OUTPUTS], defaultFormat: 'mp4' };
  }
}

export interface ConversionSettings {
  format: OutputFormat;
  resolution?: string;
  fps?: string;
  videoBitrate?: string;
  codec?: string;
  audioBitrate?: string;
  audioSampleRate?: string;
  qualityPreset?: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  compressionLevel?: string;
  hardwareAcceleration?: boolean;
}

export interface EnhancementSettings {
  noiseReduction?: boolean;
  sharpen?: boolean;
  colorImprove?: boolean;
  upscale?: boolean;
  audioCleanup?: boolean;
}

let jobCounter = 0;
function newJobId() {
  return `job-${++jobCounter}-${Date.now()}`;
}

export function buildFFmpegArgs(settings: ConversionSettings): string[] {
  const args: string[] = [];
  const { format, resolution, fps, videoBitrate, codec, audioBitrate, audioSampleRate, qualityPreset, compressionLevel } = settings;

  // ── Still images: first frame only ──
  if (IMAGE_OUTPUTS.includes(format)) {
    args.push('-an', '-frames:v', '1');
    if (format === 'ico') args.push('-vf', 'scale=w=256:h=256:force_original_aspect_ratio=decrease');
    if (format === 'jpg') args.push('-q:v', '2');
    if (format === 'webp') args.push('-c:v', 'libwebp', '-q:v', '90');
    return args;
  }

  const isAudioOnly = AUDIO_OUTPUTS.includes(format);

  if (!isAudioOnly) {
    const defaultCodec: Partial<Record<OutputFormat, string>> = {
      mp4: 'libx264',
      mov: 'libx264',
      avi: 'mpeg4',
      mkv: 'libx264',
      webm: 'libvpx-vp9',
      gif: 'gif',
    };
    const videoCodec = codec || defaultCodec[format];
    if (videoCodec) args.push('-c:v', videoCodec);

    const isX26x = videoCodec === 'libx264' || videoCodec === 'libx265';
    const isVpx = videoCodec === 'libvpx-vp9' || videoCodec === 'libvpx';

    if (format === 'gif') {
      const width = resolution && resolution !== 'original' ? resolution.split('x')[0] : '480';
      const gifFps = fps && fps !== 'original' ? fps : '15';
      args.push('-vf', `fps=${gifFps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`);
      args.push('-an');
      return args;
    }

    if (resolution && resolution !== 'original') {
      args.push('-vf', `scale=${resolution.split('x')[0]}:-2`);
    }
    if (fps && fps !== 'original') args.push('-r', fps);

    const hasBitrate = Boolean(videoBitrate && videoBitrate !== 'auto');
    if (hasBitrate) args.push('-b:v', videoBitrate!);

    if (isX26x && qualityPreset) args.push('-preset', qualityPreset);

    // CRF only applies to x264/x265/VP8/VP9; an explicit bitrate takes precedence over it.
    if (compressionLevel && !hasBitrate && (isX26x || isVpx)) {
      args.push('-crf', compressionLevel);
      if (isVpx) args.push('-b:v', '0'); // required, otherwise VP8/VP9 cap the bitrate and ignore CRF
    }

    if (isX26x) args.push('-pix_fmt', 'yuv420p'); // widest player compatibility
    if (videoCodec === 'libx265' && (format === 'mp4' || format === 'mov')) args.push('-tag:v', 'hvc1');
    if (format === 'mp4' || format === 'mov') args.push('-movflags', '+faststart');
  } else {
    args.push('-vn'); // no video for audio-only
  }

  // Audio codec
  const audioCodecs: Partial<Record<OutputFormat, string>> = {
    mp3: 'libmp3lame',
    wav: 'pcm_s16le',
    flac: 'flac',
    aac: 'aac',
    m4a: 'aac',
    ogg: 'libvorbis',
    webm: 'libopus',
    avi: 'libmp3lame',
  };
  args.push('-c:a', audioCodecs[format] ?? 'aac');

  const losslessAudio = format === 'wav' || format === 'flac';
  if (!losslessAudio && audioBitrate && audioBitrate !== 'auto') args.push('-b:a', audioBitrate);
  if (audioSampleRate && audioSampleRate !== 'original') args.push('-ar', audioSampleRate);

  return args;
}

export function buildEnhancementArgs(settings: EnhancementSettings, mode: 'video' | 'audio' | 'image'): string[] {
  const args: string[] = [];

  if (mode === 'audio') {
    if (settings.audioCleanup) {
      args.push('-af', 'anlmdn=s=7:p=0.002:r=0.002,highpass=f=80,lowpass=f=8000');
    }
    return args;
  }

  const vfFilters: string[] = [];
  if (settings.noiseReduction) vfFilters.push('hqdn3d=4:3:6:4.5');
  if (settings.sharpen) vfFilters.push('unsharp=5:5:1.0:5:5:0.0');
  if (settings.colorImprove) vfFilters.push('eq=saturation=1.2:contrast=1.05:brightness=0.02');
  if (settings.upscale) vfFilters.push('scale=iw*2:ih*2:flags=lanczos');

  if (vfFilters.length > 0) {
    args.push('-vf', vfFilters.join(','));
  }

  if (mode === 'image') {
    args.push('-frames:v', '1');
    return args;
  }

  if (settings.audioCleanup) {
    args.push('-af', 'anlmdn=s=7:p=0.002:r=0.002,highpass=f=80');
  }

  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k');
  return args;
}

export async function convertFile(
  inputPath: string,
  outputPath: string,
  settings: ConversionSettings,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!electron) throw new Error('FFmpeg conversion requires the desktop app.');

  const id = newJobId();
  const args = buildFFmpegArgs(settings);
  const unsub = electron!.onProgress(id, ({ progress }) => onProgress(progress));

  if (signal) {
    if (signal.aborted) throw new Error('Conversion cancelled.');
    signal.addEventListener('abort', () => electron!.cancelConversion(id), { once: true });
  }

  try {
    // The desktop process never overwrites existing files, so the saved path can differ from outputPath.
    const result = await electron!.convertFile({ id, inputPath, outputPath, args });
    return result.outputPath;
  } finally {
    unsub();
  }
}

export function getOutputExtension(format: OutputFormat): string {
  return format; // format strings match extensions
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
