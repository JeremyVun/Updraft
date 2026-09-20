// Preview new island arrangements without changing the game.
// Usage: node tools/audio-island-proposals.mjs [/tmp/updraft-island-proposals]
// Add --sea-refinement to compare the first sea proposal with the quieter revised background.
// Add --sleeping-refinement for the current winter chapter, including deliberate music-free passages.
// Add --meadow for the proposed background after the piano, through the swans and the walk onward.
// Add --birches for autumn play, the optional swing and space around the scarf puzzles.
// Add --birches-refinement to compare the first Birches proposal with its revised melody/harmony.
// Add --lines for tentative curiosity beneath the washing, then the warmer family clothes.
// Requires Chrome and ffmpeg. Uses an isolated temporary Vite snapshot; runtime files are read-only.
// Renders current score, proposal and a shared ambience/gesture stem; loudness-matches the music only.
// Outputs separate WAV/MP3s and a current → 2 s gap → proposal comparison for each scene.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';
import { proposalScenes } from './lib/island-score-proposals.mjs';
import { sleepingStudy } from './lib/sleeping-score-proposal.mjs';
import { meadowStudy } from './lib/meadow-score-proposal.mjs';
import { birchesStudy } from './lib/birches-score-proposal.mjs';
import { linesStudy } from './lib/lines-score-proposal.mjs';

const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-island-proposals');
const stems = path.join(dir, 'stems');
fs.mkdirSync(stems, { recursive: true });
const rate = 24000;
const refineSea = process.argv.includes('--sea-refinement');
const refineSleeping = process.argv.includes('--sleeping-refinement');
const meadowOnly = process.argv.includes('--meadow');
const birchesOnly = process.argv.includes('--birches');
const refineBirches = process.argv.includes('--birches-refinement');
const linesOnly = process.argv.includes('--lines');
assert([refineSea, refineSleeping, meadowOnly, birchesOnly, refineBirches, linesOnly].filter(Boolean).length <= 1, 'Choose one study per run');
const runtime = ['src/audio/audio.ts', 'src/audio/little-boats-score.ts', 'src/audio/sea-score.ts', 'src/audio/sleeping-score.ts', 'src/audio/meadow-score.ts', 'src/audio/birches-score.ts', 'src/audio/lines-score.ts', 'src/audio/foley.ts', 'src/story/home.ts', 'src/story/sleeping.ts',
  'src/story/little-boats.ts', 'src/story/crossing.ts', 'src/story/meadow.ts', 'src/story/piano.ts',
  'src/story/birches.ts', 'src/story/birches-play.ts', 'src/tuning.ts'];
const hashes = files => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'updraft-score-source-'));
const previewFiles = ['tools/audio-island-proposals.mjs', 'tools/lib/island-score-proposals.mjs',
  'tools/lib/sleeping-score-proposal.mjs', 'tools/lib/meadow-score-proposal.mjs', 'tools/lib/birches-score-proposal.mjs', 'tools/lib/lines-score-proposal.mjs'];
const snapshotFiles = [...runtime, ...previewFiles];
for (const file of snapshotFiles) {
  const target = path.join(snapshot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(file, target);
}
const before = Object.fromEntries(runtime.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(snapshot, file))).digest('hex')]));
const report = { source: before, previewSource: hashes(previewFiles),
  comparison: linesOnly ? 'current Lines background, then a tentative reed melody and warmer family phrase' : refineBirches ? 'first Birches proposal, then revised melody and supporting harmony' : birchesOnly ? 'current Birches background, then proposed autumn arrangement' : meadowOnly ? 'previous Meadow background, then approved post-piano arrangement' : refineSea ? 'first sea proposal, then revised background' : refineSleeping
    ? 'current winter chapter music, then revised Sleeping proposal' : 'current game music, then original proposal',
  method: 'Condensed listening scenes, not gameplay recordings. Current production score (or the first proposal when refining) versus preview-only arrangements. Identical ambience, physical sounds, calls, cues and player gestures in each pair. Music stems matched by integrated LUFS; one common playback gain and end fade per pair. No home-melody changes. Numerical verification only; awaiting Jeremy’s listening judgement.', clips: [] };

function floatWav(samples) {
  const h = Buffer.alloc(44), b = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  h.write('RIFF'); h.writeUInt32LE(36 + b.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34);
  h.write('data', 36); h.writeUInt32LE(b.length, 40);
  return Buffer.concat([h, b]);
}
function measure(file) {
  const proc = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  if (proc.status !== 0) throw Error(proc.stderr);
  const lufs = [...proc.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
  const peak = [...proc.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1);
  assert(lufs && peak, `Missing loudness metrics: ${file}`);
  return { lufs: Number(lufs[1]), truePeakDbFS: Number(peak[1]) };
}
function peak(samples) { let p = 0; for (const value of samples) { assert(Number.isFinite(value)); p = Math.max(p, Math.abs(value)); } return p; }
function mix(context, music, gain) {
  assert.equal(context.length, music.length);
  const out = new Float32Array(context.length);
  for (let i = 0; i < out.length; i++) out[i] = context[i] + music[i] * gain;
  return out;
}
function exportClip(file, samples, gain) {
  const pcm = new Int16Array(samples.length), frames = samples.length / 2;
  let clipped = 0;
  for (let i = 0; i < samples.length; i++) {
    const frame = Math.floor(i / 2);
    const fade = Math.min(1, frame / (rate * 0.03), (frames - frame - 1) / (rate * 1.2));
    const value = samples[i] * gain * Math.max(0, fade);
    if (Math.abs(value) >= 1) clipped++;
    pcm[i] = Math.round(Math.max(-1, Math.min(1, value)) * 32767);
  }
  assert.equal(clipped, 0, file);
  const bytes = Buffer.from(pcm.buffer);
  fs.writeFileSync(`${file}.wav`, wav(bytes));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', `${file}.wav`, '-c:a', 'libmp3lame', '-b:a', '192k', `${file}.mp3`]);
  return { pcm: bytes, ...measure(`${file}.wav`) };
}

const server = await createServer({ root: snapshot, configFile: false, envDir: false,
  cacheDir: path.join(snapshot, '.vite'), server: { host: '127.0.0.1', port: 0, hmr: false } });
await server.listen();
const { browser, page } = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
try {
  for (const [name, scene] of Object.entries(linesOnly ? { lines: linesStudy } : birchesOnly || refineBirches ? { birches: birchesStudy } : meadowOnly ? { meadow: meadowStudy } : refineSleeping ? { sleeping: sleepingStudy } : proposalScenes)) {
    if (refineSea && name !== 'sea') continue;
    const audio = {}, metrics = {};
    for (const stem of ['current', 'proposal', 'context']) {
      const result = await page.evaluate(async ({ name, stem, seconds, refineSea, refineSleeping, refineBirches }) => {
        const { scheduleProposal, sceneState, contextEvents } = await import('/tools/lib/island-score-proposals.mjs');
        const { Foley } = await import('/src/audio/foley.ts');
        const originalRandom = Math.random;
        let seed = 926417;
        Math.random = () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
        try {
          // Let the existing pad and environment settle before the listening window.
          const lead = 18, duration = seconds + lead;
          const { ctx, sound } = offlineSound(duration);
          const foley = new Foley(); foley.setOutput(sound.output);
          const piano = new audioModule.PianoStrings(); piano.setOutput(sound.output);
          const arrangement = stem === 'proposal' || (refineSea || refineBirches) && stem === 'current';
          const proposal = arrangement ? scheduleProposal(name, ctx, sound.musicBus, lead,
            (refineSea || refineSleeping || refineBirches) && stem === 'proposal' ? 'refined' : 'original') : { piano: [], notes: [] };
          if (stem === 'context') sound.padGain.disconnect();
          // Current and proposal music are separate from the shared calls and gesture notes.
          if (stem === 'current') sound.chime = () => {};
          // Schedule one-shots before rendering. Creating their graphs between repeated
          // OfflineAudioContext suspends produced spurious first-block peaks in Chrome.
          // Override only the JS clock read used by these production scheduling methods;
          // the audio clock and each node's scheduled start remain untouched.
          const atTime = (at, fn) => {
            Object.defineProperty(ctx, 'currentTime', { configurable: true, value: at });
            try { fn(); } finally { delete ctx.currentTime; }
          };
          for (const note of proposal.piano) atTime(note.at, () =>
            piano.note(note.midi, note.velocity, 0, name === 'sleeping' ? 0.32 : 0.7));
          if (stem === 'context') for (let tick = 0; tick < seconds * 8; tick++) {
            atTime(lead + tick / 8, () => contextEvents(name, tick, sound, foley, { cues: [] }, refineSleeping ? 'refined' : 'original'));
          }
          const update = tick => {
            const time = tick / 8 - lead;
            if (!arrangement) {
              const state = sceneState(name, Math.max(0, time), baseState, refineSleeping ? 'refined' : 'original');
              if (stem === 'context' && time >= 0) contextEvents(name, tick - lead * 8, sound, null, state, refineSleeping ? 'refined' : 'original');
              sound.update(0.125, state);
              if (stem === 'current') for (const name of ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
                sound[name].gain.cancelScheduledValues(ctx.currentTime); sound[name].gain.value = 0;
              }
            }
          };
          // Music-only current stems must not contain ambient animal voices.
          if (stem === 'current') for (const fn of ['cricket', 'owl', 'skylark', 'peep', 'bugle']) sound[fn] = () => {};
          update(0);
          let pause = ctx.suspend(0.125);
          const rendering = ctx.startRendering();
          for (let tick = 1; tick < duration * 8; tick++) {
            await pause; update(tick);
            if (tick + 1 < duration * 8) pause = ctx.suspend((tick + 1) / 8);
            await ctx.resume();
          }
          const buffer = await rendering, count = seconds * ctx.sampleRate;
          const data = new Float32Array(count * 2), offset = lead * ctx.sampleRate;
          for (let ch = 0; ch < 2; ch++) {
            const channel = buffer.getChannelData(ch);
            for (let i = 0; i < count; i++) data[i * 2 + ch] = channel[i + offset];
          }
          const bytes = new Uint8Array(data.buffer); let binary = '';
          for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
          return { float: btoa(binary), notes: proposal.notes.map(n => ({ ...n, at: n.at - lead })) };
        } finally { Math.random = originalRandom; }
      }, { name, stem, seconds: scene.seconds, refineSea, refineSleeping, refineBirches });
      const bytes = Buffer.from(result.float, 'base64');
      audio[stem] = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      // Preserve the first sea audition's score-to-environment balance, before comparing the revision.
      if (refineSea && stem !== 'context') for (let i = 0; i < audio[stem].length; i++) audio[stem][i] *= 10 ** (9.7 / 20);
      // Retain the first Birches audition's balance against the same environmental stem.
      if (refineBirches && stem !== 'context') for (let i = 0; i < audio[stem].length; i++) audio[stem][i] *= 10 ** (20.4 / 20);
      assert.equal(audio[stem].length, scene.seconds * rate * 2);
      assert(peak(audio[stem]) > 0.0001, `${name}/${stem} is silent`);
      const file = path.join(stems, `${name}-${stem}.wav`);
      fs.writeFileSync(file, floatWav(audio[stem])); metrics[stem] = measure(file);
      if (refineSleeping && stem === 'proposal') for (const [from, to] of scene.musicRests) {
        let power = 0, highest = 0, count = 0;
        for (let i = from * rate * 2; i < to * rate * 2; i++) {
          power += audio[stem][i] ** 2; highest = Math.max(highest, Math.abs(audio[stem][i])); count++;
        }
        const rmsDbFS = 10 * Math.log10(Math.max(1e-20, power / count));
        assert(rmsDbFS < -90 && highest < 0.0001, `Music tail spills into the ${from}–${to}s rest`);
        (report.musicRests ??= []).push({ from, to, rmsDbFS });
      }
      if (stem === 'proposal') fs.writeFileSync(path.join(stems, `${name}-notes.json`), JSON.stringify(result.notes, null, 2));
      console.log(`Rendered ${name}/${stem}`);
    }
    const musicGainDb = metrics.current.lufs - metrics.proposal.lufs;
    const current = mix(audio.context, audio.current, 1);
    const proposed = mix(audio.context, audio.proposal, 10 ** (musicGainDb / 20));
    const tempCurrent = path.join(stems, `${name}-current-mix.wav`), tempProposed = path.join(stems, `${name}-proposed-mix.wav`);
    fs.writeFileSync(tempCurrent, floatWav(current)); fs.writeFileSync(tempProposed, floatWav(proposed));
    const rawCurrent = measure(tempCurrent), rawProposed = measure(tempProposed);
    // One common playback adjustment; the ambience remains bit-identical between alternatives.
    const playbackGain = Math.min(10 ** ((-23 - Math.max(rawCurrent.lufs, rawProposed.lufs)) / 20),
      10 ** (-2 / 20) / Math.max(peak(current), peak(proposed)));
    const a = exportClip(path.join(dir, `${name}-current`), current, playbackGain);
    const b = exportClip(path.join(dir, `${name}-proposal`), proposed, playbackGain);
    if (linesOnly) {
      // Exactly the same proposed music and gain as the contextual player, without chimes or foley.
      const { pcm: _music, ...musicMetrics } = exportClip(path.join(dir, `${name}-music-only`),
        audio.proposal, playbackGain * 10 ** (musicGainDb / 20));
      report.musicOnly = { seconds: scene.seconds, sameGainAsContext: true, ...musicMetrics };
    }
    const reel = Buffer.concat([a.pcm, Buffer.alloc(rate * 4 * 2), b.pcm]);
    const file = path.join(dir, `${name}-comparison`);
    fs.writeFileSync(`${file}.wav`, wav(reel));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', `${file}.wav`, '-c:a', 'libmp3lame', '-b:a', '192k', `${file}.mp3`]);
    if (refineBirches) {
      // Compare just the opening and swing; retain the full-study gain and common end fade.
      const count = 36 * rate * 2;
      const earlier = exportClip(path.join(stems, 'birches-first-melody'), current.slice(0, count), playbackGain);
      const revised = exportClip(path.join(stems, 'birches-revised-melody'), proposed.slice(0, count), playbackGain);
      const excerpt = path.join(dir, 'birches-melody-comparison');
      fs.writeFileSync(`${excerpt}.wav`, wav(Buffer.concat([earlier.pcm, Buffer.alloc(rate * 4 * 2), revised.pcm])));
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', `${excerpt}.wav`, '-c:a', 'libmp3lame', '-b:a', '192k', `${excerpt}.mp3`]);
      report.melodyComparison = { seconds: 74, revisionStarts: 38, sourceInterval: [0, 36], commonPlaybackGain: true };
    }
    const { pcm: _a, ...currentMetrics } = a, { pcm: _b, ...proposalMetrics } = b;
    report.clips.push({ name, ...scene,
      ...(refineSea ? { intent: 'Quieter melodic fragments, continuous close harmony, no high-register swell or melody during the swim.' } : {}),
      ...(refineBirches ? { intent: 'Clearer chord-tone melody over D / C / G-over-B / A-minor, retaining the falling bass, swing contour and scarf breathing room.',
        baselineProposalMusicGainDb: 20.4 } : {}),
      proposalStarts: scene.seconds + 2, stemMetrics: metrics,
      proposalMusicGainDb: musicGainDb, commonPlaybackGainDb: 20 * Math.log10(playbackGain), currentMetrics, proposalMetrics });
  }
  // All imports came from this fixed copy, even if other work changed the live tree meanwhile.
  assert.deepEqual(Object.fromEntries(runtime.map(file => [file,
    crypto.createHash('sha256').update(fs.readFileSync(path.join(snapshot, file))).digest('hex')])), before);
  fs.writeFileSync(path.join(dir, 'proposals.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ dir, clips: report.clips }, null, 2));
} finally {
  await browser.close(); await server.close(); fs.rmSync(snapshot, { recursive: true, force: true });
}
