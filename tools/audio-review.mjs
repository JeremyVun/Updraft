// Audio review evidence, without starting the game or using the GPU.
// Usage: node tools/audio-review.mjs [/tmp/updraft-audio-review]
// Requires the dev server (BASE defaults to http://127.0.0.1:5230/).
// Probes production scheduling; renders Web Audio fixtures, not recorded playthroughs.
// PROBES_ONLY=1 refreshes probes; source hashes for existing clips remain unchanged.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-audio-review');
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
});
const reportPath = path.join(dir, 'review.json');
const report = process.env.PROBES_ONLY && fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : { source: {}, probes: {}, clips: [] };
report.probeSource = Object.fromEntries(['src/audio/audio.ts', 'src/audio/foley.ts', 'src/story/home.ts', 'src/story/sleeping.ts', 'src/tuning.ts']
  .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
if (!process.env.PROBES_ONLY) report.source = report.probeSource;

function wav(samples, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + samples.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}

try {
  const page = await browser.newPage();
  await page.route('**/__audio_review', r => r.fulfill({ contentType: 'text/html', body: '<title>Audio review</title>' }));
  await page.goto(new URL('__audio_review', base).href);
  await page.evaluate(async () => {
    window.audioModule = await import('/src/audio/audio.ts');
    window.homeModule = await import('/src/story/home.ts');
    window.sleepingModule = await import('/src/story/sleeping.ts');
    window.cuesModule = await import(performance.getEntriesByType('resource')
      .findLast(r => new URL(r.name).pathname === '/src/story/cues.ts')?.name ?? '/src/story/cues.ts');
    window.baseState = { gust: 0, pan: 0, rise: 1, charge: 0, overLand: true,
      breeze: 0.3, gliderLift: 0, life: 1, night: 0, sea: 0.6, meadow: 0, land: 1, cold: 0,
      shower: 0, hush: 0, piano: 0, music: 'meadow', scripted: false, silence: false, cues: [] };
    window.offlineSound = (seconds) => {
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 24000), 24000);
      const Native = window.AudioContext;
      window.AudioContext = function () { return ctx; };
      const sound = new audioModule.Soundscape();
      try { sound.start(); } finally { window.AudioContext = Native; }
      Object.defineProperty(sound, 'running', { get: () => true });
      return { ctx, sound };
    };
  });
  report.probes = await page.evaluate(() => {
    function probe(overrides) {
      const { sound } = offlineSound(1);
      sound.ctx = { currentTime: 90 };
      const calls = [];
      for (const name of ['chime', 'cricket', 'owl', 'skylark', 'phrase', 'flare', 'peep', 'bugle']) {
        sound[name] = (...args) => calls.push({ name, args });
      }
      sound.update(1 / 60, { ...baseState, ...overrides });
      return calls;
    }
    const finale = [];
    const fake = { beat: 'inside', silence: false, t: 0, sky: { set() {} },
      cast: { child: { position: { x: 0, y: 0, z: 0 } }, plane: {}, drawing: {}, cottage: {} } };
    cuesModule.takeCues();
    for (let frame = 118; frame <= 124; frame++) {
      fake.t = frame / 60;
      homeModule.HomeChapter.prototype.updateEnding.call(fake, 1 / 60);
      for (const cue of cuesModule.takeCues()) finale.push({ time: fake.t, cue });
    }
    const morning = Object.assign(Object.create(sleepingModule.SleepingChapter.prototype), {
      music: 'wood', hush: 0.5, now: 0, laneFrom: null, laneTo: null, seat: null,
      cast: { child: { stop() {}, walkTo() {} }, cygnet: { watch() {} },
        boat: { boardingPoint() { return { x: 0, z: 0 }; } },
        sleeping: { trail: {}, ribbon: {}, lane() {} } },
    });
    morning.restoreCheckpoint('morning');
    return {
      unhushedGesture: probe({ gust: 26, hush: 0 }),
      hushedGesture: probe({ gust: 26, hush: 1 }),
      pianoUpdraft: probe({ piano: 1, charge: 1 }),
      pianoGliderLift: probe({ piano: 1, gliderLift: 1 }),
      openSeaAtNight: probe({ music: 'sea', sea: 1, land: 0, meadow: 0, overLand: false, night: 1 }),
      finale,
      morningRestore: { music: morning.music, dawn: morning.cast.sleeping.dawn, beat: morning.beat },
    };
  });
  console.log(JSON.stringify(report.probes, null, 2));

  const reel = [];
  const moods = process.env.PROBES_ONLY ? [] : ['still', 'lines', 'meadow', 'birches', 'drowned', 'wood', 'sea', 'mirror', 'home'];
  if (moods.length) report.clips = [];
  for (const music of moods) {
    const data = await page.evaluate(async (music) => {
      const seconds = 48;
      const { ctx, sound } = offlineSound(seconds);
      const state = { ...baseState, music };
      function update() {
        const now = ctx.currentTime;
        const playing = now >= 18 && now < 24 || now >= 30 && now < 34;
        state.gust = playing ? 20 : 0;
        state.rise = now < 22 || now >= 30 ? 1 : -1;
        sound.update(0.125, state);
        if (now > seconds - 0.6) sound.master.gain.setTargetAtTime(0, now, 0.09);
      }
      update();
      const first = ctx.suspend(0.125);
      const rendering = ctx.startRendering();
      await first;
      for (let next = 0.25; next < seconds; next += 0.125) {
        update();
        const paused = ctx.suspend(next);
        await ctx.resume(); await paused;
      }
      update(); await ctx.resume();
      const buffer = await rendering;
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      const pcm = new Int16Array(left.length * 2);
      let peak = 0, power = 0, clipped = 0;
      for (let i = 0; i < left.length; i++) for (let ch = 0; ch < 2; ch++) {
        const v = ch ? right[i] : left[i];
        peak = Math.max(peak, Math.abs(v)); power += v * v;
        if (Math.abs(v) >= 1) clipped++;
        pcm[i * 2 + ch] = Math.round(Math.max(-1, Math.min(1, v)) * 32767);
      }
      const bytes = new Uint8Array(pcm.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      return { pcm: btoa(binary), peakDbFS: 20 * Math.log10(peak),
        rmsDbFS: 10 * Math.log10(power / pcm.length), clipped };
    }, music);
    const samples = Buffer.from(data.pcm, 'base64');
    fs.writeFileSync(path.join(dir, `${music}.wav`), wav(samples));
    // Eight seconds per mood, including the start of the same gesture pattern; one-second gaps.
    reel.push(samples.subarray(14 * 24000 * 4, 22 * 24000 * 4), Buffer.alloc(24000 * 4));
    const { pcm, ...metrics } = data;
    report.clips.push({ music, seconds: 48, ...metrics });
    console.log(`Rendered ${music}`);
  }
  if (moods.length) fs.writeFileSync(path.join(dir, 'comparison.wav'), wav(Buffer.concat(reel)));
  report.fixture = '48-second synthesized fixtures from the production Soundscape. Identical fully-alive daylight state, low breeze, no spatial creature/object audio. Strong gestures at 18–24 and 30–34 seconds. These are not gameplay recordings or listening sign-off.';
  report.reel = 'Eight seconds per mood, with one-second gaps: still, lines, meadow, birches, drowned, wood, sea, mirror, home. No level normalization.';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
