'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runFfmpeg, cancelJob, validateJob, uniquePath } = require('./ffmpeg-runner.cjs');

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-test-'));
const run = (job, extra = {}) => runFfmpeg({ ffmpegPath: 'ffmpeg', job, hwaccel: false, registry: new Map(), ...extra });

function makeTone() {
  const p = path.join(tmp, 'tone.wav');
  const r = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', p]);
  assert.strictEqual(r.status, 0);
  return p;
}

test('validateJob rejects bad input', () => {
  const ok = { id: 'a', inputPath: __filename, outputPath: path.join(tmp, 'x.mp3'), args: [] };
  assert.doesNotThrow(() => validateJob(ok));
  assert.throws(() => validateJob({ ...ok, inputPath: 'relative.wav' }), /input file path/);
  assert.throws(() => validateJob({ ...ok, outputPath: path.join(tmp, 'x.exe') }), /Unsupported output/);
  assert.throws(() => validateJob({ ...ok, args: ['-f', 'tee'] }), /not allowed/);
  assert.throws(() => validateJob({ ...ok, args: [42] }), /Invalid conversion options/);
  assert.throws(() => validateJob({ ...ok, inputPath: path.join(tmp, 'missing.wav') }), /could not be found/);
});

test('uniquePath never returns an existing file', () => {
  const f = path.join(tmp, 'exists.txt');
  fs.writeFileSync(f, 'x');
  assert.strictEqual(uniquePath(f), path.join(tmp, 'exists (1).txt'));
});

test('converts real audio and never overwrites an existing output', { skip: !hasFfmpeg }, async () => {
  const input = makeTone();
  const out = path.join(tmp, 'out.mp3');
  fs.writeFileSync(out, 'precious');
  const progress = [];
  const res = await run({ id: 'j1', inputPath: input, outputPath: out, args: ['-vn', '-c:a', 'libmp3lame'] }, { onProgress: (p) => progress.push(p) });
  assert.strictEqual(fs.readFileSync(out, 'utf8'), 'precious');
  assert.strictEqual(res.outputPath, path.join(tmp, 'out (1).mp3'));
  assert.ok(fs.statSync(res.outputPath).size > 1000);
  assert.strictEqual(progress[progress.length - 1], 100);
  assert.deepStrictEqual(fs.readdirSync(tmp).filter((n) => n.includes('.partial')), []);
});

test('a failing conversion rejects and leaves no partial file', { skip: !hasFfmpeg }, async () => {
  const bad = path.join(tmp, 'garbage.mp4');
  fs.writeFileSync(bad, 'this is not a video');
  await assert.rejects(run({ id: 'j2', inputPath: bad, outputPath: path.join(tmp, 'g.mkv'), args: ['-c:v', 'libx264'] }));
  assert.ok(!fs.existsSync(path.join(tmp, 'g.mkv')));
  assert.deepStrictEqual(fs.readdirSync(tmp).filter((n) => n.includes('.partial')), []);
});

test('cancelling a job removes partial output', { skip: !hasFfmpeg }, async () => {
  const registry = new Map();
  const long = path.join(tmp, 'long.wav');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=600', long]);
  const p = run({ id: 'j3', inputPath: long, outputPath: path.join(tmp, 'long.flac'), args: ['-c:a', 'flac', '-compression_level', '12'] }, { registry });
  setTimeout(() => cancelJob(registry, 'j3'), 150);
  await assert.rejects(p, (e) => e.cancelled === true);
  assert.ok(!fs.existsSync(path.join(tmp, 'long.flac')));
  assert.deepStrictEqual(fs.readdirSync(tmp).filter((n) => n.includes('.partial')), []);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
