// Renders the drowned village's music through the game's own sound (the score, its crossings and levels, the becalmed
// phrase, the bell through its foley, the foghorn and the wood's drone taking over; no wind or sea) for listening: each
// piece on its own, held long enough to hear it come round, and one sweep of the room from the drift's start into the
// wood at a player's pace, with a spectrogram. Every file shares one playback gain, so the levels between them are the
// game's. Writes m4a files and a report of each section's loudness (`KEEP_WAV=1` keeps the wavs; `ONLY=a,b` renders some).
// Usage: node tools/drowned-music-study.mjs [outDir]   (default /tmp/updraft-drowned-music; serves the worktree itself)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-drowned-music');
fs.mkdirSync(dir, { recursive: true });
const GAIN_DB = Number(process.env.GAIN_DB ?? 4);
const only = process.env.ONLY?.split(',');

/** The sweep at a player's pace: when each piece is asked for, the bell's rings and the wood's arrival. */
const RINGS = [318, 323, 327.5, 332];
const studies = {
  '1-drift': { seconds: 140, phases: [[0, 'drift']] },
  '2-fog': { seconds: 200, phases: [[0, 'fog']], cues: [[0.5, 'becalmed']] },
  '3-refuge': { seconds: 72, phases: [[0, 'refuge']] },
  '4-home': { seconds: 136, phases: [[0, 'home']] },
  '5-farewell': { seconds: 112, phases: [[0, 'farewell'], [10.6, 'storm']], cues: [[19.6, 'foghorn']] },
  '6-bell': { seconds: 96, phases: [[0, 'refuge'], [24.7, 'home']], rings: [24, 28.5, 33, 37.5] },
  sweep: {
    seconds: 500,
    phases: [[0, 'drift'], [110, 'fog'], [282, 'refuge'], [RINGS[0] + 0.7, 'home'], [384, 'farewell'], [394.6, 'storm']],
    quiet: [80, 110],
    cues: [[82, 'becalmed'], [398, 'foghorn']], rings: RINGS, wood: { from: 462, landed: 472 },
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
    if (only && !only.includes(name)) continue;
    const result = await session.page.evaluate(async (study) => {
      const { Foley } = await import('/src/audio/foley.ts');
      const { ARRIVAL_MUSIC } = await import('/src/audio/arrival-music.ts');
      let seed = 9091;
      Math.random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
      const tick = 1 / 8, ticks = Math.round(study.seconds / tick);
      const { ctx, sound } = offlineSound(study.seconds);
      for (const fn of ['cricket', 'owl', 'skylark', 'peep', 'bugle']) sound[fn] = () => {};
      const foley = new Foley();
      foley.setOutput(sound.output);
      const rings = [...(study.rings ?? [])], cues = [...(study.cues ?? [])], heard = [];
      const update = (i) => {
        const t = i * tick, wood = study.wood && t >= study.wood.from;
        const phase = study.phases.findLast(([at]) => at <= t)[1];
        while (rings.length && rings[0] < t + tick) {
          const at = rings.shift();
          Object.defineProperty(ctx, 'currentTime', { configurable: true, value: Math.max(t, at) });
          try { foley.material('bell', 0.85, 0.15); } finally { delete ctx.currentTime; }
        }
        const now = [];
        while (cues.length && cues[0][0] <= t) now.push(cues.shift()[1]);
        const landed = wood && t >= study.wood.landed;
        sound.update(tick, { ...baseState, music: 'drowned', drownedScore: phase,
          drownedQuiet: !!study.quiet && t >= study.quiet[0] && t < study.quiet[1], hush: 0.3,
          ...(landed ? ARRIVAL_MUSIC.wood : {}), arrivalMusic: wood && !landed ? 'wood' : undefined,
          sea: 1, land: 0, overLand: false, breeze: 0, night: 0.3, flockChatter: false, scripted: true, cues: now });
        for (const field of ['breezeGain', 'seaGain', 'rainGain', 'patterGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
          sound[field].gain.cancelScheduledValues(ctx.currentTime);
          sound[field].gain.value = 0;
        }
        const playing = sound.drownedScore?.current?.phase ?? (sound.mood === 'wood' ? 'wood' : null);
        if (heard.at(-1)?.[1] !== playing) heard.push([+t.toFixed(2), playing]);
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
      return { ...encodeAudio(await rendering), heard };
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
    const sections = result.heard.map(([from, phase], i) => {
      const to = result.heard[i + 1]?.[0] ?? study.seconds;
      return { phase, from, to, lufs: to - from >= 6 ? loudness(file, from + 2, to) : null };
    });
    report.files[name] = { seconds: study.seconds, rawPeakDbFS: +result.peakDbFS.toFixed(1), peakDbFS: +(20 * Math.log10(peak / 32767)).toFixed(1),
      clipped: peak >= 32767, lufs: loudness(file, 0, study.seconds), sections };
    if (name === 'sweep') {
      const width = 2400, marks = sections.map(({ from }) => `drawbox=x=${Math.round(134 + from / study.seconds * width)}:y=40:w=2:h=520:color=white@0.55:t=fill`).join(',');
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-lavfi',
        `showspectrumpic=s=${width}x520:legend=1:scale=log:fscale=log:stop=3000:color=intensity:gain=2,${marks}`, path.join(dir, 'sweep-spectrogram.png')]);
    }
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-c:a', 'aac', '-b:a', '192k', path.join(dir, `${name}.m4a`)]);
    if (!process.env.KEEP_WAV) fs.rmSync(file);
    console.log(JSON.stringify({ name, ...report.files[name], sections: sections.map((s) => `${s.phase}@${s.from}: ${s.lufs}`) }));
  }
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
