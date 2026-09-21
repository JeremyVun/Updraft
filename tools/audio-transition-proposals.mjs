// Preview only: current pitch slides versus held chords with fades and a chapter-local phrase clock.
// node tools/audio-transition-proposals.mjs [/tmp/updraft-transition-proposals]
// Each 48 s pair: current at 0:00 (change 0:08), proposal at 0:25 (change 0:33).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-transition-proposals');
fs.mkdirSync(dir, { recursive: true });
const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'updraft-transition-source-'));
const sources = ['src/audio/audio.ts', 'src/audio/arrival-music.ts', 'src/audio/gesture-harmony.ts', 'src/audio/little-boats-score.ts', 'src/audio/sea-score.ts',
  'src/audio/sleeping-score.ts', 'src/audio/meadow-score.ts', 'src/audio/birches-score.ts', 'src/audio/lines-score.ts', 'src/audio/dream-score.ts', 'src/audio/dream-score-data.ts', 'src/audio/foghorn.ts', 'src/tuning.ts'];
const hashes = {};
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8'), target = path.join(snapshot, file);
  hashes[file] = crypto.createHash('sha256').update(text).digest('hex');
  if (file === 'src/audio/audio.ts') assert(text.includes('Math.floor(now / mood.seconds)'), 'Current pad clock changed: review the comparison baseline');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // Inspect the real mood definitions without adding a runtime export or changing their values.
  fs.writeFileSync(target, file === 'src/audio/audio.ts'
    ? text.replace('Math.floor(now / mood.seconds)', 'Math.floor((now + 62) / mood.seconds)') + '\nexport { MOODS };\n'
    : text);
}
const server = await createServer({ root: snapshot, configFile: false, envDir: false,
  cacheDir: path.join(snapshot, '.vite'), server: { host: '127.0.0.1', port: 0, hmr: false } });
await server.listen();
const { browser, page } = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
const report = { source: hashes, method: 'Rendered transition studies, not gameplay recordings. Same production instruments, ambience, level settings and initial eight seconds. Current uses the existing global chord clock and pitch slides; proposed holds outgoing pitches, fades between chords and starts the incoming sequence at its first chord. One common playback gain per pair. No game transition changes.', clips: [] };
const rate = 24000, seconds = 23;
function measure(file) {
  const p = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  return { lufs: Number([...p.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)[1]),
    truePeakDbFS: Number([...p.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)[1]) };
}
function pcm(samples, gain = 1) {
  const data = new Int16Array(samples.length);
  for (let i = 0; i < data.length; i++) {
    const time = Math.floor(i / 2) / rate;
    const fade = Math.max(0, Math.min(1, time / .03, (seconds - time) / 1.2));
    const value = samples[i] * gain * fade;
    assert(Number.isFinite(value) && Math.abs(value) < 1, 'Finite audio with headroom');
    data[i] = Math.round(value * 32767);
  }
  return Buffer.from(data.buffer);
}
try {
  for (const [from, to, label] of [['meadow', 'birches', 'Leaving Meadow for Birches'],
    ['drowned', 'wood', 'Drowned Village into the Wood']]) {
    const variants = {}, metrics = {}, trace = {};
    for (const proposed of [false, true]) {
      const key = proposed ? 'proposal' : 'current';
      const result = await page.evaluate(async ({ from, to, proposed, seconds }) => {
        let seed = 926417;
        const originalRandom = Math.random;
        Math.random = () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
        try {
          // The old soundtrack's phase really depends on elapsed audio time. Use a stated example clock.
          // The snapshot offsets only the old chord clock by 62 s: excerpt begins at elapsed time 80 s.
          const lead = 18, changeAt = lead + 8, duration = lead + seconds;
          const { ctx, sound } = offlineSound(duration), { MOODS } = audioModule;
          for (const method of ['skylark', 'cricket', 'owl', 'peep', 'bugle']) sound[method] = () => {};
          const state = { ...baseState, life: .6, night: .4, hush: .25, breeze: .25, sea: .45, meadow: 0 };
          const trace = [], banks = [];
          let replaced = false, current = null, chord = -1;
          const fadeOut = (bank, now, duration) => {
            bank.gain.gain.cancelAndHoldAtTime(now);
            bank.gain.gain.linearRampToValueAtTime(0, now + duration);
            for (const osc of bank.osc) osc.stop(now + duration + .01);
          };
          const startChord = (index, now, fade) => {
            if (current) fadeOut(current, now, fade);
            const mood = MOODS[to], gain = ctx.createGain(), filter = ctx.createBiquadFilter();
            filter.type = 'lowpass'; filter.Q.value = .3;
            filter.frequency.value = mood.cutoff + 260 * state.life - 200 * state.night;
            gain.gain.value = 0;
            const level = (.012 + .045 * state.life) * (1 - .35 * state.night) * (1 - .92 * state.hush) * mood.level;
            gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + fade);
            gain.connect(filter).connect(sound.musicBus);
            const bank = { gain, osc: [] }; banks.push(bank);
            for (const midi of mood.chords[index]) {
              const voice = ctx.createGain(); voice.gain.value = .25; voice.connect(gain);
              for (let k = 0; k < 2; k++) {
                const osc = ctx.createOscillator(); osc.type = k === 0 ? 'triangle' : 'sine';
                osc.detune.value = k === 0 ? -6 : 7;
                osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
                osc.connect(voice); osc.start(now); bank.osc.push(osc);
              }
            }
            current = bank; chord = index;
            trace.push({ time: now - lead, chord: mood.chords[index], fade });
          };
          const update = tick => {
            const now = tick / 8;
            if (proposed && now >= changeAt && !replaced) {
              // The outgoing chord may finish its existing internal movement, but receives no new pitches.
              const gain = ctx.createGain(); gain.gain.value = 1;
              sound.padGain.gain.cancelAndHoldAtTime(now);
              sound.padFilter.frequency.cancelAndHoldAtTime(now);
              sound.padGain.disconnect(); sound.padGain.connect(gain).connect(sound.padFilter);
              const old = { gain, osc: sound.padVoices.flatMap(v => v.osc) };
              for (const voice of sound.padVoices) {
                voice.gain.gain.cancelAndHoldAtTime(now);
              }
              fadeOut(old, now, 3.5);
              sound.padVoices = []; sound.padGain = ctx.createGain(); sound.padFilter = ctx.createBiquadFilter();
              replaced = true;
              startChord(0, now, 3.5);
            }
            sound.update(.125, { ...state, music: now < changeAt ? from : to });
            if (replaced) {
              const index = Math.floor((now - changeAt) / MOODS[to].seconds) % MOODS[to].chords.length;
              if (index !== chord) startChord(index, now, 1.8);
            }
            if (!proposed && now >= changeAt && (tick === changeAt * 8 || trace.at(-1)?.index !== sound.chord))
              trace.push({ time: now - lead, index: sound.chord, chord: MOODS[to].chords[sound.chord] });
          };
          update(0); let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
          for (let tick = 1; tick < duration * 8; tick++) {
            await pause; update(tick);
            if (tick + 1 < duration * 8) pause = ctx.suspend((tick + 1) / 8);
            await ctx.resume();
          }
          const buffer = await rendering, data = new Float32Array(seconds * 24000 * 2);
          for (let ch = 0; ch < 2; ch++) {
            const input = buffer.getChannelData(ch);
            for (let i = 0; i < data.length / 2; i++) data[i * 2 + ch] = input[lead * 24000 + i];
          }
          const bytes = new Uint8Array(data.buffer); let binary = '';
          for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
          return { float: btoa(binary), trace };
        } finally { Math.random = originalRandom; }
      }, { from, to, proposed, seconds });
      const bytes = Buffer.from(result.float, 'base64');
      variants[key] = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      trace[key] = result.trace;
      const file = path.join(dir, `${from}-${to}-${key}.wav`);
      fs.writeFileSync(file, wav(pcm(variants[key]))); metrics[key] = measure(file);
      console.log(`Rendered ${from} → ${to}: ${key}`);
    }
    let leadError = 0;
    for (let i = 0; i < 8 * rate * 2; i++) leadError = Math.max(leadError, Math.abs(variants.current[i] - variants.proposal[i]));
    assert(leadError < .00001, `Lead-in waveform difference ${leadError}`);
    let highest = 0;
    for (const data of Object.values(variants)) for (const sample of data) highest = Math.max(highest, Math.abs(sample));
    const gain = Math.min(10 ** ((-23 - Math.max(metrics.current.lufs, metrics.proposal.lufs)) / 20), 10 ** (-3 / 20) / highest);
    const clips = [];
    for (const key of ['current', 'proposal']) {
      const bytes = pcm(variants[key], gain), file = path.join(dir, `${from}-${to}-${key}.wav`);
      fs.writeFileSync(file, wav(bytes)); metrics[key] = measure(file); clips.push(bytes);
    }
    const stem = path.join(dir, `${from}-${to}-comparison`);
    fs.writeFileSync(`${stem}.wav`, wav(Buffer.concat([clips[0], Buffer.alloc(rate * 4 * 2), clips[1]])));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', `${stem}.wav`, '-c:a', 'libmp3lame', '-b:a', '192k', `${stem}.mp3`]);
    report.clips.push({ from, to, label, seconds: 48, currentStarts: 0, currentTransition: 8,
      proposalStarts: 25, proposalTransition: 33, leadError, commonGainDb: 20 * Math.log10(gain), metrics, trace });
  }
  fs.writeFileSync(path.join(dir, 'comparison.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.clips, null, 2));
} finally {
  await browser.close(); await server.close(); fs.rmSync(snapshot, { recursive: true, force: true });
}
