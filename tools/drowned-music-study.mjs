// Renders the drowned village's music through the game's own sound (the score, its phase fades and levels, the
// becalmed phrase, the bell through its foley and the foghorn; no wind or sea) for listening: each cue on its own,
// held long enough to hear its loop, and the whole room from the rescue into the storm at measured story timing,
// with a spectrogram of the arc. Every file shares one playback gain, so the levels between them are the game's.
// Usage: node tools/drowned-music-study.mjs [outDir]   (default /tmp/updraft-music9-study; serves the worktree itself)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-music9-study');
fs.mkdirSync(dir, { recursive: true });
const GAIN_DB = Number(process.env.GAIN_DB ?? 4);

/** Her run, from up on the first roof to the tower's foot: seconds, walking or working a piece, the fog's gap (m). */
const RUN = [
  [0, 'walk', 14, 12], [6, 'walk', 12, 6], [10, 'walk', 6, 11], [18, 'piece', 11, 10], [45, 'walk', 10, 13],
  [50, 'piece', 13, 8], [68, 'walk', 8, 12], [82, 'piece', 12, 18], [112, 'walk', 18, 12], [128, 'piece', 12, 11],
  [155, 'walk', 12, 19], [160, 'walk', 19, 19],
];
const LONG_RUN = [...RUN.slice(0, -1), [160, 'walk', 19, 12], [166, 'walk', 12, 12]];
const answered = (rings) => rings.flatMap((t, i) => [[t + 0.7, ['answer1', 'answer2', 'answer3', 'home'][i]]]);
const RINGS = [258.9, 263.0, 267.1, 271.2];

const studies = {
  '1-stuck': { seconds: 64, phases: [[0, 'stuck']], cues: [[0, 'becalmed']] },
  '2-chase': { seconds: 215, phases: [[0, 'chase']], run: { from: 0, script: LONG_RUN } },
  '2b-chase-tightening': { seconds: 102, phases: [[0, 'chase']],
    tension: [[0, 0], [12.8, 0.4], [25.6, 0.7], [38.4, 0.9], [64, 0.2], [76.8, 0.5]] },
  '3-climb': { seconds: 40, phases: [[0, 'climb']] },
  '4-belfry': { seconds: 82, phases: [[0, 'belfry']] },
  '5-bell': { seconds: 72, phases: [[0, 'belfry'], ...answered([12.4, 16.5, 20.6, 24.7])], rings: [12.4, 16.5, 20.6, 24.7] },
  '5b-bell-slow': { seconds: 112, phases: [[0, 'belfry'], ...answered([10, 28, 46, 64])], rings: [10, 28, 46, 64] },
  '5c-answer-waiting': { seconds: 80, phases: [[0, 'belfry'], [6.7, 'answer1']], rings: [6] },
  '6-home': { seconds: 80, phases: [[0, 'belfry'], [3.7, 'home']], rings: [3] },
  '7-farewell': { seconds: 30, phases: [[0, 'farewell'], [5.5, 'gather']], cues: [[8.5, 'foghorn']] },
  arc: {
    seconds: 330,
    phases: [[0, 'rooftops'], [40, 'stuck'], [66, 'chase'], [226, 'climb'], [240.5, 'belfry'], ...answered(RINGS),
      [302, 'farewell'], [307.5, 'gather']],
    cues: [[40, 'becalmed'], [310.5, 'foghorn']], rings: RINGS, run: { from: 66, script: RUN },
  },
};

function loudness(file, from, to) {
  const args = ['-hide_banner', '-nostats', '-i', file, '-af', `atrim=${from}:${to},ebur128=peak=true`, '-f', 'null', '-'];
  const p = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  return Number([...p.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1]);
}

const server = await createServer({ configFile: false, envDir: false, server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' });
let browser;
const report = { gainDb: GAIN_DB, files: {} };
try {
  await server.listen();
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  for (const [name, study] of Object.entries(studies)) {
    const result = await session.page.evaluate(async (study) => {
      const { Foley } = await import('/src/audio/foley.ts');
      const { tuning } = await import('/src/tuning.ts');
      const { chaseTension } = await import('/src/audio/drowned-cues.ts');
      let seed = 9091;
      Math.random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
      const tick = 1 / 8, ticks = Math.round(study.seconds / tick);
      const { ctx, sound } = offlineSound(study.seconds);
      for (const fn of ['cricket', 'owl', 'skylark', 'peep', 'bugle']) sound[fn] = () => {};
      const foley = new Foley();
      foley.setOutput(sound.output);
      const rings = [...(study.rings ?? [])], cues = [...(study.cues ?? [])], trace = [];
      let tension = 0, across = Infinity, was = 'off';
      const pressure = (t) => {
        if (study.tension) return study.tension.findLast(([at]) => at <= t)[1];
        const run = study.run;
        if (!run || t < run.from) return 0;
        const s = run.script, at = t - run.from, i = s.findLastIndex(([from]) => from <= at), [from, stage, g0, g1] = s[i];
        const to = s[i + 1]?.[0] ?? from + 1, gap = g0 + (g1 - g0) * Math.min(1, (at - from) / (to - from));
        const working = stage === 'piece';
        across = !working && was === 'piece' ? 0 : across + tick;
        was = stage;
        return chaseTension(gap, working, across);
      };
      const update = (i) => {
        const t = i * tick;
        const phase = study.phases.findLast(([at]) => at <= t)[1];
        tension += (pressure(t) - tension) * (1 - Math.exp(-tick / tuning.audio.drownedChase.ease));
        while (rings.length && rings[0] < t + tick) {
          const at = rings.shift();
          Object.defineProperty(ctx, 'currentTime', { configurable: true, value: Math.max(t, at) });
          try { foley.material('bell', 0.85, 0.15); } finally { delete ctx.currentTime; }
        }
        const now = [];
        while (cues.length && cues[0][0] <= t) now.push(cues.shift()[1]);
        sound.update(tick, { ...baseState, music: 'drowned', drownedScore: phase, drownedTension: tension, hush: 0.92,
          sea: 1, land: 0, overLand: false, breeze: 0, night: 0.3, flockChatter: false, scripted: true, cues: now });
        for (const field of ['breezeGain', 'seaGain', 'rainGain', 'patterGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
          sound[field].gain.cancelScheduledValues(ctx.currentTime);
          sound[field].gain.value = 0;
        }
        if (i % 4 === 0) trace.push([+t.toFixed(2), phase, +tension.toFixed(3)]);
      };
      update(0);
      let pause = ctx.suspend(tick);
      const rendering = ctx.startRendering();
      for (let i = 1; i < ticks; i++) {
        await pause;
        update(i);
        if (i + 1 < ticks) pause = ctx.suspend((i + 1) * tick);
        await ctx.resume();
      }
      return { ...encodeAudio(await rendering), trace };
    }, study);
    const pcm = Buffer.from(result.pcm, 'base64');
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2);
    const gain = 10 ** (GAIN_DB / 20);
    let peak = 0;
    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const fade = Math.min(1, (samples.length - i - 1) / (24000 * 2 * 1.5));
      const v = samples[i] * gain * fade;
      peak = Math.max(peak, Math.abs(v));
      out[i] = Math.max(-32767, Math.min(32767, Math.round(v)));
    }
    const file = path.join(dir, `${name}.wav`);
    fs.writeFileSync(file, wav(Buffer.from(out.buffer)));
    const sections = [];
    for (let i = 0; i < study.phases.length; i++) {
      const [from, phase] = study.phases[i], to = study.phases[i + 1]?.[0] ?? study.seconds;
      if (to - from >= 3) sections.push({ phase, from, to, lufs: loudness(file, from + Math.min(2, (to - from) / 4), to) });
    }
    report.files[name] = { seconds: study.seconds, rawPeakDbFS: +result.peakDbFS.toFixed(1), peakDbFS: +(20 * Math.log10(peak / 32767)).toFixed(1),
      clipped: peak >= 32767, lufs: loudness(file, 0, study.seconds), sections };
    if (name === 'arc') report.trace = result.trace;
    console.log(JSON.stringify({ name, ...report.files[name], sections: sections.map((s) => `${s.phase}@${s.from}: ${s.lufs}`) }));
  }
  const arc = path.join(dir, 'arc.wav'), seconds = studies.arc.seconds, width = 2400;
  const marks = studies.arc.phases.map(([at]) => `drawbox=x=${Math.round(134 + at / seconds * width)}:y=40:w=2:h=520:color=white@0.55:t=fill`).join(',');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', arc, '-lavfi',
    `showspectrumpic=s=${width}x520:legend=1:scale=log:fscale=log:stop=3000:color=intensity:gain=2,${marks}`, path.join(dir, 'arc-spectrogram.png')]);
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
