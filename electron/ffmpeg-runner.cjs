'use strict';
// Core FFmpeg job runner. Kept free of Electron imports so it can be unit-tested with plain Node.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const OUTPUT_EXTS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'gif',
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg',
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'ico',
]);

// Options that could read/write arbitrary files or change where output goes.
const BLOCKED_ARGS = new Set([
  '-i', '-y', '-n', '-f', '-filter_script', '-filter_complex_script', '-passlogfile', '-attach',
  '-dump_attachment', '-protocol_whitelist', '-headers', '-method', '-vstats_file', '-report',
  '-progress', '-sdp_file', '-stdin', '-init_hw_device', '-hwaccel',
]);

function validateJob({ id, inputPath, outputPath, args }) {
  if (typeof id !== 'string' || !id || id.length > 200) throw new Error('Invalid job id.');
  if (typeof inputPath !== 'string' || !path.isAbsolute(inputPath)) throw new Error('The input file path is not valid.');
  if (typeof outputPath !== 'string' || !path.isAbsolute(outputPath)) throw new Error('The output file path is not valid.');
  if (!Array.isArray(args) || !args.every((a) => typeof a === 'string' && !a.includes('\0'))) {
    throw new Error('Invalid conversion options.');
  }
  const blocked = args.find((a) => BLOCKED_ARGS.has(a.toLowerCase()));
  if (blocked) throw new Error(`The option ${blocked} is not allowed.`);
  const ext = path.extname(outputPath).slice(1).toLowerCase();
  if (!OUTPUT_EXTS.has(ext)) throw new Error(`Unsupported output format: .${ext || '(none)'}`);

  let stat;
  try { stat = fs.statSync(inputPath); } catch { throw new Error('The input file could not be found. It may have been moved or deleted.'); }
  if (!stat.isFile()) throw new Error('The input path is not a file.');
}

/** Returns a path that does not exist yet, adding " (1)", " (2)"... so existing files are never overwritten. */
function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const dir = path.dirname(p);
  const ext = path.extname(p);
  const base = path.basename(p, ext);
  for (let i = 1; i < 10000; i++) {
    const candidate = path.join(dir, `${base} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not find a free output file name.');
}

function safeRemove(p) { try { fs.rmSync(p, { force: true }); } catch { /* best effort, only ever our own temp file */ } }

function parseClock(m) { return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]); }

function tailMessage(stderr) {
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.slice(-6).join('\n').slice(-800) || 'FFmpeg failed without an error message.';
}

/**
 * Runs one FFmpeg job. Output is written to a private temp file next to the destination and only
 * renamed into place after FFmpeg exits successfully with a non-empty file.
 */
function runFfmpeg({ ffmpegPath, job, hwaccel, onProgress, registry }) {
  validateJob(job);
  const { id, inputPath, outputPath, args } = job;
  if (registry.has(id)) return Promise.reject(new Error('A job with this id is already running.'));

  const outDir = path.dirname(path.resolve(outputPath));
  fs.mkdirSync(outDir, { recursive: true });
  const ext = path.extname(outputPath);
  const tempPath = path.join(outDir, `.convertflow-${crypto.randomBytes(8).toString('hex')}.partial${ext}`);

  const fullArgs = [
    '-nostdin', '-hide_banner', '-y',
    ...(hwaccel ? ['-hwaccel', 'auto'] : []),
    '-i', path.resolve(inputPath),
    ...args,
    tempPath,
  ];

  return new Promise((resolve, reject) => {
    const state = { cancelled: false, proc: null };
    let stderr = '';
    let duration = 0;
    let proc;
    try {
      proc = spawn(ffmpegPath, fullArgs, { windowsHide: true });
    } catch (err) {
      return reject(err);
    }
    state.proc = proc;
    registry.set(id, state);

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr = (stderr + text).slice(-20000);
      if (!duration) {
        const d = text.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (d) duration = parseClock(d);
      }
      const times = [...text.matchAll(/time=(\d+):(\d+):(\d+\.?\d*)/g)];
      if (times.length && duration > 0) {
        const pct = Math.min(Math.round((parseClock(times[times.length - 1]) / duration) * 100), 99);
        if (onProgress) onProgress(pct);
      }
    });

    proc.on('error', (err) => {
      registry.delete(id);
      safeRemove(tempPath);
      reject(new Error(err.code === 'ENOENT'
        ? 'FFmpeg could not be started. Install FFmpeg or bundle it with the app.'
        : `FFmpeg could not be started: ${err.message}`));
    });

    proc.on('close', (code) => {
      registry.delete(id);
      if (state.cancelled) {
        safeRemove(tempPath);
        return reject(Object.assign(new Error('Conversion cancelled.'), { cancelled: true }));
      }
      if (code !== 0) {
        safeRemove(tempPath);
        return reject(new Error(tailMessage(stderr)));
      }
      let size = 0;
      try { size = fs.statSync(tempPath).size; } catch { /* handled below */ }
      if (size === 0) {
        safeRemove(tempPath);
        return reject(new Error('FFmpeg finished but did not produce an output file.'));
      }
      try {
        const finalPath = uniquePath(path.resolve(outputPath));
        fs.renameSync(tempPath, finalPath);
        if (onProgress) onProgress(100);
        resolve({ success: true, outputPath: finalPath });
      } catch (err) {
        safeRemove(tempPath);
        reject(new Error(`Could not save the converted file: ${err.message}`));
      }
    });
  });
}

function cancelJob(registry, id) {
  const state = registry.get(id);
  if (!state) return false;
  state.cancelled = true;
  try { state.proc.kill('SIGKILL'); } catch { /* already gone */ }
  return true;
}

module.exports = { runFfmpeg, cancelJob, validateJob, uniquePath, OUTPUT_EXTS };
