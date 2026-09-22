// node tools/opening-summit-preview.mjs [/tmp/updraft-opening-summit]
// Default: musical-memory pad. --shaped / --moving / --drone / --fifths reproduce earlier studies.
// --question renders only the twenty-second contrapuntal opening study.
// --full renders the three-minute developments of the endorsed question at 80% tempo.
// --resolution adds the opening's held resolution before the returning motif.
// Standalone, fixed-source production/current versus alternate background audition.
// Uses local Chrome without the GPU. Does not read project env files or alter runtime code.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createServer} from 'vite';
import {audioPage, wav} from './lib/audio-render.mjs';
const composition = process.argv.includes('--resolution') ? 'tools/lib/opening-resolution-revision.mjs'
  : process.argv.includes('--harmony-revision') ? 'tools/lib/opening-harmony-revision.mjs'
  : process.argv.includes('--full') ? 'tools/lib/opening-summit-full-score.mjs'
  : process.argv.includes('--question') ? 'tools/lib/opening-question.mjs'
  : process.argv.includes('--fifths') ? 'tools/lib/opening-summit-fifths.mjs'
  : process.argv.includes('--drone') ? 'tools/lib/opening-summit-proposal.mjs'
  : process.argv.includes('--moving') ? 'tools/lib/opening-summit-moving-pad.mjs'
  : process.argv.includes('--shaped') ? 'tools/lib/opening-summit-shaped-pad.mjs' : 'tools/lib/opening-summit-memory-pad.mjs';
const {studies,dependencies=[]} = await import('../' + composition);

const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-opening-summit');
fs.mkdirSync(dir, {recursive: true});
const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'updraft-memory-source-'));
const sources = ['src/tuning.ts', ...fs.readdirSync('src/audio').filter(f => f.endsWith('.ts')).map(f => 'src/audio/' + f),
  composition,...dependencies];
const source = {};
for (const file of sources) {
  const data = fs.readFileSync(file), dest = path.join(snapshot, file);
  source[file] = crypto.createHash('sha256').update(data).digest('hex');
  fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.writeFileSync(dest, data);
}
const report = {studies, source, clips: [], checks: [],
  method: 'Isolated background music, no environmental sounds, player gestures or story cues. Current uses the production pad and chord clock at an illustrative local epoch. Alternate replaces only the background in this offline fixture. Integrated loudness matched per island; playback gain is not an in-game mix recommendation. Not gameplay recordings or perceptual sign-off.'};
function check(ok, message) {assert(ok, message); report.checks.push(message);}
// ffmpeg writes loudness to stderr, including on success.
function metrics(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  return {lufs: Number([...r.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)[1]),
    peak: Number([...r.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)[1])};
}
function mp3(file) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file + '.wav', '-c:a', 'libmp3lame', '-b:a', '192k', file + '.mp3']);
}
const server = await createServer({root: snapshot, configFile: false, envDir: false, cacheDir: path.join(snapshot, '.vite'),
  server: {host: '127.0.0.1', port: 0, hmr: false}});
let browser;
try {
  await server.listen();
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`); browser = session.browser;
  for (const [name, study] of Object.entries(studies)) {
    const renders = {};
    for (const version of ['current', 'proposal']) {
      const result = await session.page.evaluate(async ({name, version, seconds, composition, usesProductionPad}) => {
        const {studyState, scheduleStudy} = await import('/' + composition);
        const oldRandom = Math.random; let seed = 923541;
        Math.random = () => {seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296;};
        try {
          const {ctx, sound} = offlineSound(seconds + 8);
          // No chance wildlife calls or environmental layers in an isolated music comparison.
          for (const f of ['cricket', 'owl', 'skylark', 'peep', 'bugle', 'chime']) sound[f] = () => {};
          if (version === 'proposal' && !usesProductionPad) sound.padGain.disconnect();
          const composed = version === 'proposal' ? scheduleStudy(name, ctx, sound, audioModule.PianoStrings) : null;
          function update(tick) {
            sound.update(.125, studyState(name, tick / 8, baseState));
            for (const f of ['breezeGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain', 'rainGain', 'patterGain']) {
              sound[f].gain.cancelScheduledValues(ctx.currentTime); sound[f].gain.value = 0;
            }
          }
          update(0); let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
          for (let tick = 1; tick < (seconds + 8) * 8; tick++) {
            await pause; update(tick);
            if (tick + 1 < (seconds + 8) * 8) pause = ctx.suspend((tick + 1) / 8);
            await ctx.resume();
          }
          const buffer = await rendering, remaining = composed?.voices.size ?? 0;
          const schedule = composed?.schedule; composed?.dispose();
          return {...encodeAudio(buffer), remaining, schedule};
        } finally {Math.random = oldRandom;}
      }, {name, version, seconds: study.seconds, composition, usesProductionPad: study.usesProductionPad});
      check(result.clipped === 0, `${name}/${version}: no source clipping`);
      check(result.remaining === 0, `${name}/${version}: composed voices released`);
      const bytes = Buffer.from(result.pcm, 'base64').subarray(0, study.seconds * 24000 * 4);
      const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      const faded = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const t = i / 48000;
        const fade = Math.min(1, t / .04, Math.max(0, (study.seconds - t) / (study.fadeOut ?? 4)));
        faded[i] = Math.round(samples[i] * fade);
      }
      const raw = path.join(dir, `${name}-${version}-raw.wav`);
      fs.writeFileSync(raw, wav(Buffer.from(faded.buffer)));
      renders[version] = {samples: faded, ...metrics(raw), sourcePeak: result.peakDbFS, schedule: result.schedule};
      console.log(`Rendered ${name}/${version}`);
    }
    if (study.usesProductionPad && name === 'opening' && study.preserveIntro !== false) {
      let peakDelta = 0;
      for (let i = 0; i < 6 * 48000; i++) {
        peakDelta = Math.max(peakDelta, Math.abs(renders.current.samples[i] - renders.proposal.samples[i]));
      }
      check(peakDelta <= 1, 'Opening: first six seconds retain the production sound within PCM rounding');
    }
    const target = Math.min(-25, ...Object.values(renders).map(r => r.lufs + (-4 - r.peak)));
    const exports = {};
    for (const [version, render] of Object.entries(renders)) {
      const gainDb = target - render.lufs, gain = 10 ** (gainDb / 20);
      const samples = Int16Array.from(render.samples, x => {
        checkSample(x * gain); return Math.round(x * gain);
      });
      const stem = path.join(dir, `${name}-${version}`);
      const pcm = Buffer.from(samples.buffer); exports[version] = pcm;
      fs.writeFileSync(stem + '.wav', wav(pcm)); mp3(stem);
      const measured = metrics(stem + '.mp3');
      check(measured.peak < -3, `${name}/${version}: decoded MP3 headroom`);
      report.clips.push({name, version, gainDb, ...measured, schedule: render.schedule});
    }
    const clips = report.clips.filter(c => c.name === name);
    check(Math.abs(clips[0].lufs - clips[1].lufs) < .4, `${name}: loudness matched within 0.4 LU`);
    const comparison = path.join(dir, `${name}-comparison`);
    fs.writeFileSync(comparison + '.wav', wav(Buffer.concat([exports.current, Buffer.alloc(2 * 24000 * 4), exports.proposal])));
    mp3(comparison);
    if (name === 'opening') {
      // Test the invitation into the dream without needing to hear two complete phrases.
      // Retain the full-study playback gains and use a short identical ending fade.
      const excerpt = pcm => {
        const source = new Int16Array(pcm.buffer, pcm.byteOffset, 20 * 48000);
        return Buffer.from(Int16Array.from(source, (x, i) =>
          Math.round(x * Math.min(1, (source.length - i - 1) / (.6 * 48000)))).buffer);
      };
      const intro = path.join(dir, 'opening-first20-comparison');
      fs.writeFileSync(intro + '.wav', wav(Buffer.concat([excerpt(exports.current), Buffer.alloc(2 * 24000 * 4), excerpt(exports.proposal)])));
      mp3(intro);
    }
  }
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({dir, checks: report.checks, clips: report.clips.map(({schedule, ...c}) => c)}, null, 2));
} finally {
  await browser?.close(); await server.close(); fs.rmSync(snapshot, {recursive: true, force: true});
}
function checkSample(value) {assert(Math.abs(value) < 32767, 'Export must not clip');}
