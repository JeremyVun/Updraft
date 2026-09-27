// Renders the stairs in the clouds through the production soundscape, offline and without the GPU: the puzzle with
// flights knocking home, the climb through the white, the calm on top with the skein, the sail over the cloud, the
// fog and the drowned village's music taking over. A synthetic `StairsAir` timeline stands in for the chapter.
// Usage: BASE=<vite> node tools/stairs-audio-proposal.mjs [outDir]   (ffmpeg for the mp3 and loudness)
// Writes stairs-arc.{wav,mp3} (the whole mix), stairs-music.{wav,mp3} (the music alone, with its reverb) and report.json.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { audioPage, wav } from './lib/audio-render.mjs';

const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-stairs-audio-proposal');
fs.mkdirSync(dir, { recursive: true });
const RATE = 48000;

/** Story times in seconds. The bird goes first at `hesitate`; the chapter should call that `cloud` (see cues.md). */
const T = {
  strokes: [[5, .6], [7.2, .8], [8.3, .7], [16, .7], [18.5, .8], [20.5, .9], [22.4, .6], [29, .8], [31.5, .7], [34.5, .8],
    [70, .6], [84, .7], [139, .8], [141, .9], [143.5, .8], [151, .7], [160, .8], [168, .9], [178, .7], [188, .8], [196, .7]],
  knocks: [9, 24], third: 36.5, hesitate: 43, follow: 56, emerge: 100, skein: [106, 121], board: 137,
  fog: 202, fogPeak: [207, 210], down: 217, end: 240,
};

const SEGMENTS = [
  ['Under the cloud: the puzzle, birches phrase, flights knocking home', 0, T.hesitate],
  ['At the edge: the child stops, the bird goes up first; the phrase drains', T.hesitate, T.follow],
  ['In the white, lower half', T.follow, (T.follow + T.emerge) / 2],
  ['In the white, upper half', (T.follow + T.emerge) / 2, T.emerge],
  ['Out on top: the wind gone, the calm before the bloom', T.emerge, T.emerge + 4],
  ['Above: the bloom, the skein, gathering the bird', T.emerge + 4, T.board],
  ['The sail over the cloud', T.board, T.fog],
  ['The fog: the sail fades, rest in the white, the village music in', T.fog, T.down],
  ['Down on the village water: the drowned score', T.down, T.end],
];

async function render(page, musicOnly) {
  return page.evaluate(async ({ T, RATE, musicOnly }) => {
    let seed = 20260927;
    const originalRandom = Math.random;
    Math.random = () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    try {
      const ctx = new OfflineAudioContext(2, Math.ceil(T.end * RATE), RATE);
      const Native = window.AudioContext;
      window.AudioContext = function () { return ctx; };
      const sound = new audioModule.Soundscape();
      try { sound.start(); } finally { window.AudioContext = Native; }
      Object.defineProperty(sound, 'running', { get: () => true });
      // The background alone, through a reverb of its own with the shared impulse, so its level compares with the mix.
      let verb = null;
      if (musicOnly) {
        const out = ctx.createGain();
        out.gain.value = .9;
        out.connect(ctx.destination);
        sound.master.disconnect();
        sound.backgroundDuck.connect(out);
        sound.wetDuck.disconnect();
        verb = ctx.createConvolver();
        sound.wetDuck.connect(verb).connect(out);
      }
      const S = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
      const step = 1 / 30;
      const cygnet = { pan: 0, distance: 6, active: true }, flock = { pan: 0, distance: 190, active: false };
      const air = { phase: 'under', cloud: 0, climb: 0, open: 0, fog: 0, speed: 0 };
      const stages = [], cues = [];
      let lastStage = 'none';
      const stroke = t => {
        for (const [at, strength] of T.strokes) {
          const x = t - at;
          if (x >= 0 && x < .6) return { gust: 26 * strength * (x < .12 ? x / .12 : 1 - (x - .12) / .48), pan: ((at * 7.3) % 1.6) - .8, rise: at % 2 < 1 ? 1 : -1 };
        }
        return { gust: 0, pan: 0, rise: 1 };
      };
      const update = tick => {
        const t = tick * step, list = [];
        for (const at of T.knocks) if (Math.abs(t - at) < step / 2) list.push('flightHome', 'star');
        if (Math.abs(t - T.third) < step / 2) list.push('flightHome', 'restored');
        const onFoot = t < T.board, afloat = t >= T.board && t < T.down;
        air.phase = t < T.hesitate ? 'under' : t < T.emerge ? 'cloud' : t < T.board ? 'above' : t < T.fog ? 'sail' : 'fog';
        air.fog = air.phase === 'fog' ? S(T.fog, T.fog + 5, t) * (1 - S(T.fogPeak[1], T.down, t)) : 0;
        air.climb = onFoot ? Math.max(0, Math.min(1, (t - T.follow - 2) / (T.emerge - T.follow - 3))) : t < T.fogPeak[0] ? 1 : 1 - S(T.fogPeak[0], T.fogPeak[1], t);
        air.cloud = onFoot ? S(T.follow, T.follow + 5, t) * (1 - S(T.emerge - 4, T.emerge + 1.5, t)) : air.fog;
        const out = t >= T.emerge - .5;
        air.open += ((out ? 1 - air.fog : 0) - air.open) * (1 - Math.exp(-step * .8));
        const gusts = T.strokes.filter(([at]) => at > T.board && at < t).length;
        air.speed = !afloat ? 0 : air.phase === 'sail'
          ? 4.3 * S(T.board + 2, T.board + 16, t) + .35 * Math.sin(t * .21) + .25 * Math.sin(gusts * 1.7)
          : 4.3 + (2.2 - 4.3) * S(T.fog, T.down, t);
        const down = t >= T.down;
        flock.active = t >= T.skein[0] && t < T.skein[1];
        flock.pan = -.55 + 1 * S(T.skein[0], T.skein[1], t);
        const wind = stroke(t);
        if (verb && !verb.buffer && sound.reverbConvolver.buffer) verb.buffer = sound.reverbConvolver.buffer;
        sound.update(step, { ...baseState, ...wind, charge: 0, overLand: onFoot && t < T.follow, breeze: .35,
          life: 1, night: 0, sea: 1, meadow: 0, land: onFoot ? 1 : 0, cold: 0, shower: 0,
          music: down ? 'drowned' : 'birches', birchesScore: down ? undefined : 'return',
          drownedScore: down ? 'rooftops' : undefined, hush: down ? .3 : .35,
          arrivalMusic: air.phase === 'fog' || down ? 'drowned' : undefined,
          stairsAir: down ? undefined : { ...air },
          cygnet, flock, scripted: t >= T.hesitate && t < T.follow || t >= T.emerge && t < T.board,
          silence: false, cues: list });
        if (list.length) cues.push({ t, list });
        const stage = sound.arrivalTransition.stage;
        if (stage !== lastStage) { stages.push({ t, stage }); lastStage = stage; }
      };
      update(0);
      const ticks = Math.floor(T.end / step);
      let pause = ctx.suspend(step);
      const rendering = ctx.startRendering();
      for (let tick = 1; tick < ticks; tick++) {
        await pause; update(tick);
        if (tick + 1 < ticks) pause = ctx.suspend((tick + 1) * step);
        await ctx.resume();
      }
      const buffer = await rendering;
      const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
      // One-second windows: peak and RMS, so silence and the shape of each phase can be read from the report.
      const windows = [];
      let clipped = 0, peak = 0, finite = true;
      for (let w = 0; w * RATE < L.length; w++) {
        let p = 0, sum = 0, n = 0;
        for (let i = w * RATE; i < Math.min(L.length, (w + 1) * RATE); i++) {
          for (const v of [L[i], R[i]]) {
            if (!Number.isFinite(v)) finite = false;
            const a = Math.abs(v); p = Math.max(p, a); sum += v * v; n++;
            if (a >= 1) clipped++;
          }
        }
        peak = Math.max(peak, p);
        windows.push({ peakDbFS: 20 * Math.log10(p || 1e-12), rmsDbFS: 10 * Math.log10(sum / n || 1e-24) });
      }
      const pcm = new Int16Array(L.length * 2);
      for (let i = 0; i < L.length; i++) {
        pcm[i * 2] = Math.round(Math.max(-1, Math.min(1, L[i])) * 32767);
        pcm[i * 2 + 1] = Math.round(Math.max(-1, Math.min(1, R[i])) * 32767);
      }
      window.__stairsPcm = new Uint8Array(pcm.buffer);
      // Twenty seconds after the room, nothing of it should still be running.
      const leftover = { stairsSound: !!sound.stairsSound, stairsScore: !!sound.stairsScore, birchesScore: !!sound.birchesScore };
      return { windows, clipped, finite, peakDbFS: 20 * Math.log10(peak), stages, cues, leftover, bytes: window.__stairsPcm.length };
    } finally { Math.random = originalRandom; }
  }, { T, RATE, musicOnly });
}

async function pcm(page, bytes) {
  const chunks = [], size = 6 << 20;
  for (let from = 0; from < bytes; from += size) {
    const b64 = await page.evaluate(({ from, size }) => {
      const part = window.__stairsPcm.subarray(from, from + size);
      let binary = '';
      for (let i = 0; i < part.length; i += 16384) binary += String.fromCharCode(...part.subarray(i, i + 16384));
      return btoa(binary);
    }, { from, size });
    chunks.push(Buffer.from(b64, 'base64'));
  }
  return Buffer.concat(chunks);
}

function loudness(file, from, to) {
  const p = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(from), '-t', String(to - from), '-i', file,
    '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const lufs = Number([...p.stderr.matchAll(/I:\s+(-?[\d.]+|-inf) LUFS/g)].at(-1)?.[1] ?? NaN);
  const peak = Number([...p.stderr.matchAll(/Peak:\s+(-?[\d.]+|-inf) dBFS/g)].at(-1)?.[1] ?? NaN);
  const shortTerm = [...p.stderr.matchAll(/S:\s*(-?[\d.]+)/g)].map(m => Number(m[1])).filter(Number.isFinite);
  return { lufs, truePeakDbFS: peak, shortTermMaxLufs: shortTerm.length ? Math.max(...shortTerm) : null };
}

const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function cueSheet(report) {
  const { arc, music } = report.renders;
  const stage = name => music.stages.find(s => s.stage === name)?.t;
  const rows = [
    [0, 'Under the cloud. The birches\' closing phrase (approved) carries on; the player pushes the loose flights (gusts).'],
    ...T.knocks.map((t, i) => [t, `Flight ${i + 1} knocks home: a soft wooden tok, a smaller tk as it settles, a puff of cloud.`]),
    [T.third, 'Flight 3 knocks home, with the shared completion phrase (`restored`, unchanged).'],
    [T.hesitate, 'The child stops at the edge of the white; the bird goes up first. The phrase drains away (about 4 dB a second); the wind in the cloud is heard faintly from above.'],
    [T.follow, 'The child follows into the white. No music: a close, muffled wind that buffets, and a moan that rises with the climb.'],
    [(T.follow + T.emerge) / 2, 'Halfway up: the buffets come quicker and harder, the moan climbs, the sea has gone.'],
    [T.emerge, 'Out on top. The last of the wind sweeps past and away, then almost nothing: a thin high air.'],
    [T.emerge + 3, 'The bloom (proposal): D opening out, wide and high, from nothing.'],
    [T.emerge + 6.5, 'The piano\'s question comes back high and slow, D–E–F♯, and opens one step further than it ever has, to C♯ (G with a sharpened fourth under it).'],
    [T.skein[0], 'The skein crosses far off: the swans\' own calls (the cygnet stays silent).'],
    [T.board, 'Boarding; the sail (proposal) takes over from the bloom: the bass walks up the scale from D to B under a plucked ripple.'],
    [T.board + 2, 'The hull begins to hiss through the cloud tops as the sail fills; the hiss follows the boat\'s speed.'],
    [T.board + 18, 'The sail\'s tune asks the whole question, D–E–F♯, and lands on a high B.'],
    [T.fog, 'The fog closes in. The village music is asked for; the sail fades over three seconds.'],
    [stage('gap'), 'Musical rest in the white (three seconds): only the soft wash of the fog.'],
    [stage('incoming'), 'The drowned village\'s own music comes in (approved, unchanged) as the fog is at its thickest and starts to thin.'],
    [T.fogPeak[0], 'The hull comes down onto the water in the whiteout; the sea comes back under it as the fog thins.'],
    [T.down, 'On the village water: the drowned chapter owns everything from here. The room\'s own sounds let go.'],
  ].filter(([t]) => t !== undefined).sort((a, b) => a[0] - b[0]);
  const table = (segments) => segments.map(s => `| ${clock(s.from)}–${clock(s.to)} | ${s.label} | ${s.lufs <= -70 ? 'silent' : s.lufs} | ${s.shortTermMaxLufs ?? '–'} | ${s.peakDbFS.toFixed(1)} |`).join('\n');
  return `# The stairs in the clouds: audio proposal

\`stairs-arc.mp3\` is the whole mix, rendered offline through the production soundscape from a synthetic
\`StairsAir\` timeline (\`tools/stairs-audio-proposal.mjs\`). \`stairs-music.mp3\` is the music alone, with its
reverb. The phase timings are targets, not measurements of the chapter; the bird going first is treated as the start
of \`cloud\` (see the report). Not a listening sign-off.

## Cues

${rows.map(([t, text]) => `- **${clock(t)}** ${text}`).join('\n')}

## Measurements

Whole mix: peak ${arc.peakDbFS.toFixed(1)} dBFS, ${arc.clipped} clipped samples.

| Time | Phase | Integrated LUFS | Short-term max LUFS | Peak dBFS |
| --- | --- | --- | --- | --- |
${table(arc.segments)}

Music alone: peak ${music.peakDbFS.toFixed(1)} dBFS.

| Time | Phase | Integrated LUFS | Short-term max LUFS | Peak dBFS |
| --- | --- | --- | --- | --- |
${table(music.segments)}

Silence of the music: below −70 dBFS in every second from ${clock(report.checks.cloudSilentFrom)} to ${clock(T.emerge)} (in the white),
and through the rest before the village (${clock(report.checks.restFrom)}–${clock(report.checks.restTo)}).
`;
}

const { browser, page } = await audioPage();
const report = { rate: RATE, timeline: T, renders: {} };
try {
  for (const [name, musicOnly] of [['arc', false], ['music', true]]) {
    const result = await render(page, musicOnly);
    const bytes = await pcm(page, result.bytes);
    const file = path.join(dir, `stairs-${name}.wav`);
    fs.writeFileSync(file, wav(bytes, RATE));
    const mp3 = file.replace(/\.wav$/, '.mp3');
    const encoded = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-c:a', 'libmp3lame', '-b:a', '224k', mp3]);
    assert.equal(encoded.status, 0, String(encoded.stderr));
    const segments = SEGMENTS.map(([label, from, to]) => {
      const w = result.windows.slice(Math.floor(from), Math.ceil(to));
      return { label, from, to, ...loudness(file, from, to),
        peakDbFS: Math.max(...w.map(x => x.peakDbFS)), quietestSecondRmsDbFS: Math.min(...w.map(x => x.rmsDbFS)),
        loudestSecondRmsDbFS: Math.max(...w.map(x => x.rmsDbFS)) };
    });
    report.renders[name] = { file: mp3, peakDbFS: result.peakDbFS, clipped: result.clipped, finite: result.finite,
      stages: result.stages, cues: result.cues, leftover: result.leftover, segments, windows: result.windows };
    console.log(`${name}: peak ${result.peakDbFS.toFixed(2)} dBFS, clipped ${result.clipped}`);
    for (const s of segments) console.log(`  ${clock(s.from)}–${clock(s.to)} ${s.lufs} LUFS, peak ${s.peakDbFS.toFixed(1)}, quietest ${s.quietestSecondRmsDbFS.toFixed(1)} dBFS  ${s.label}`);
  }
  const arc = report.renders.arc, music = report.renders.music;
  assert(arc.finite && music.finite, 'finite audio');
  assert.equal(arc.clipped, 0, 'no clipping in the mix');
  // The music is silent in the white once the birches have drained, and through the rest before the village.
  const silent = (from, to) => music.windows.slice(from, to).every(w => w.rmsDbFS < -70);
  const drained = T.hesitate + 12, climbEnd = T.emerge;
  const gap = music.stages.find(s => s.stage === 'gap'), incoming = music.stages.find(s => s.stage === 'incoming');
  report.checks = {
    cloudSilentFrom: drained, cloudSilent: silent(drained, climbEnd),
    restFrom: gap?.t, restTo: incoming?.t,
    restSilent: gap && incoming ? silent(Math.ceil(gap.t + 1), Math.floor(incoming.t)) : false,
  };
  assert(report.checks.cloudSilent, 'the music is silent in the white');
  assert(report.checks.restSilent, 'the music rests before the village');
  assert(!Object.values(arc.leftover).some(Boolean), `room released: ${JSON.stringify(arc.leftover)}`);
  delete arc.windows; delete music.windows;
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(dir, 'cues.md'), cueSheet(report));
  console.log(JSON.stringify(report.checks));
} finally { await browser.close(); }
