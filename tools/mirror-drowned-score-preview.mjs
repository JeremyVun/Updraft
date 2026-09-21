// node tools/mirror-drowned-score-preview.mjs [/tmp/updraft-mirror-drowned-scores]
// Preview-only compositions. No game changes. Chrome OfflineAudioContext + production audio routing.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';
import { studies, composition, palette } from './lib/mirror-drowned-score-proposals.mjs';

const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-mirror-drowned-scores');
fs.mkdirSync(dir, { recursive: true });
const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'updraft-mirror-drowned-'));
const files = ['src/tuning.ts', ...fs.readdirSync('src/audio').filter(f => f.endsWith('.ts')).map(f => `src/audio/${f}`),
  'tools/lib/mirror-drowned-score-proposals.mjs'];
const hashes = {};
for (const file of files) {
  const bytes = fs.readFileSync(file), dest = path.join(snapshot, file);
  hashes[file] = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes);
}
const report = { method: 'Condensed listening studies, not gameplay recordings. Music-only and illustrative scene mixes use production reverb, compressor, gesture/cue and physical-sound instruments. Each export has a single fixed playback gain toward -23 LUFS so the two compositions can be auditioned at comparable loudness; no dynamic normalization. Raw renders retain the intended scene balance. Runtime untouched. Numerical checks do not establish emotional fit.',
  sampleRate: 24000, source: hashes, checks: [], clips: [] };
const check = (condition, message) => { assert(condition, message); report.checks.push(message); };
for (const [name, scene] of Object.entries(studies)) {
  const notes = composition(name);
  check(notes.every(n => Object.values(n).every(v => typeof v !== 'number' || Number.isFinite(v))), `${name}: finite score`);
  check(notes.every(n => n.at >= 0 && n.at + n.duration < scene.seconds), `${name}: notes leave room for the final tail`);
  check(notes.every(n => n.duration > palette[n.voice].attack + palette[n.voice].release), `${name}: valid attack/decay/release order`);
  check(notes.every(n => n.midi >= 38 && n.midi <= (name === 'mirror' ? 83 : 76)), `${name}: bounded chapter register`);
  check(notes.filter(n => n.midi > 76).every(n => n.level <= .012 && palette[n.voice].attack >= .7),
    `${name}: high notes remain quiet with slow attacks`);
  check(notes.every(n => n.level > 0 && n.level <= .02), `${name}: bounded per-note level`);
  check(Object.values(palette).every(p => p.attack >= .04 && p.partials.every(([ratio]) => Number.isInteger(ratio))),
    `${name}: softened attacks and harmonic partials`);
  for (const [from, to] of scene.melodyRests) check(!notes.some(n => n.role === 'melody' && n.at >= from && n.at < to),
    `${name}: no lead attacks during ${from}–${to}s story space`);
  fs.writeFileSync(path.join(dir, `${name}-score.json`), JSON.stringify({ ...scene, notes }, null, 2));
}

function measure(file) {
  const p = spawnSync('ffmpeg', ['-hide_banner','-nostats','-i',file,'-af','ebur128=peak=true','-f','null','-'], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  return { lufs: Number([...p.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)[1]),
    truePeakDbFS: Number([...p.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)[1]) };
}
function exportAudio(name, kind, pcm, gain) {
  const source = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2), out = new Int16Array(source.length);
  let peak = 0;
  for (let i = 0; i < source.length; i++) {
    const fade = Math.min(1, i / (24000 * 2 * .06), (source.length - i - 1) / (24000 * 2 * 1.2));
    const value = source[i] * gain * Math.max(0, fade); peak = Math.max(peak, Math.abs(value));
    assert(Math.abs(value) < 32767, 'Export must retain headroom'); out[i] = Math.round(value);
  }
  const file = path.join(dir, `${name}-${kind}`);
  fs.writeFileSync(`${file}.wav`, wav(Buffer.from(out.buffer)));
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-i',`${file}.wav`,'-c:a','libmp3lame','-b:a','192k',`${file}.mp3`]);
  const decoded = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','stream=channels,sample_rate:format=duration','-of','json',`${file}.mp3`], { encoding: 'utf8' }));
  check(decoded.streams[0].channels === 2 && Math.abs(Number(decoded.format.duration) - studies[name].seconds) < .2,
    `${name}/${kind}: valid stereo MP3 and duration`);
  const metrics = measure(`${file}.mp3`);
  check(metrics.truePeakDbFS <= -2, `${name}/${kind}: decoded MP3 has at least 2 dB headroom`);
  return { ...metrics, pcmPeakDbFS: 20 * Math.log10(peak / 32767), file: `${file}.mp3` };
}

const server = await createServer({ root: snapshot, configFile: false, envDir: false,
  cacheDir: path.join(snapshot, '.vite'), server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser;
try {
  await server.listen();
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  for (const [name, scene] of Object.entries(studies)) {
    const renders = {};
    for (const kind of ['music', 'scene']) {
      const result = await session.page.evaluate(async ({ name, seconds, kind }) => {
        const { scheduleStudy, sceneState, contextSchedule, harmonyAt } = await import('/tools/lib/mirror-drowned-score-proposals.mjs');
        const { chordNote } = await import('/src/audio/gesture-harmony.ts');
        const { Foley } = await import('/src/audio/foley.ts');
        const random = Math.random; let seed = 76345;
        Math.random = () => { seed = Math.imul(seed,1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
        try {
          const lead = 8, { ctx, sound } = offlineSound(seconds + lead);
          sound.padGain.disconnect();
          for (const fn of ['cricket','owl','skylark','peep','bugle']) sound[fn] = () => {};
          const studyBus = ctx.createGain(); studyBus.connect(sound.backgroundBus);
          if (name === 'drowned') {
            // Wind is stronger here than on the mirror; keep the melody present before the storm.
            studyBus.gain.setValueAtTime(1.8, 0);
            studyBus.gain.setValueAtTime(1.8, lead + 31.5);
            studyBus.gain.linearRampToValueAtTime(1.8*.32, lead + 32);
            studyBus.gain.setValueAtTime(1.8*.32, lead + 43);
            studyBus.gain.linearRampToValueAtTime(1.8, lead + 45);
          }
          const scheduled = scheduleStudy(name, ctx, studyBus, lead);
          const foley = new Foley(); foley.setOutput(sound.output);
          const atTime = (at, fn) => {
            Object.defineProperty(ctx, 'currentTime', { configurable: true, value: lead + at });
            try { fn(); } finally { delete ctx.currentTime; }
          };
          if (kind === 'scene') for (const e of contextSchedule(name)) atTime(e.at, () => {
            if (e.type === 'gesture') sound.chime(chordNote(e.midi,harmonyAt(name,e.at),62,81),e.velocity,.12,lead+e.at,1.8,false,true);
            else if (e.type === 'cue') sound.phrase(e.cue, at => harmonyAt(name,at-lead));
            else if (e.type === 'material') foley.material(e.material,e.level,-.12);
            else if (e.type === 'thunder') sound.thunder(e.level,.35);
          });
          sound.cueSpaceUntil = 0;
          const update = tick => {
            sound.update(.125, sceneState(name, Math.max(0,tick/8-lead), baseState));
            if (kind === 'music') for (const field of ['breezeGain','seaGain','rainGain','patterGain','gustGain','whistleGain','rustleGain','liftGain']) {
              sound[field].gain.cancelScheduledValues(ctx.currentTime); sound[field].gain.value = 0;
            }
          };
          update(0);
          let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
          for (let tick = 1; tick < (seconds + lead)*8; tick++) {
            await pause; update(tick);
            if (tick + 1 < (seconds+lead)*8) pause = ctx.suspend((tick+1)/8);
            await ctx.resume();
          }
          const buffer = await rendering;
          const cropped = new AudioBuffer({ length: seconds*ctx.sampleRate, sampleRate:ctx.sampleRate, numberOfChannels:2 });
          for (let ch=0;ch<2;ch++) cropped.copyToChannel(buffer.getChannelData(ch).subarray(lead*ctx.sampleRate),ch);
          const windows = [];
          for (let second=0;second<seconds;second++) {
            let power=0,peak=0;
            for (let ch=0;ch<2;ch++) for (const value of cropped.getChannelData(ch).subarray(second*ctx.sampleRate,(second+1)*ctx.sampleRate)) {
              power+=value*value; peak=Math.max(peak,Math.abs(value));
            }
            windows.push({ second,rmsDbFS:10*Math.log10(Math.max(1e-20,power/(2*ctx.sampleRate))),peakDbFS:20*Math.log10(Math.max(1e-10,peak)) });
          }
          scheduled.dispose();
          return { ...encodeAudio(cropped), windows, remainingSources:scheduled.sources.size };
        } finally { Math.random=random; }
      }, { name, kind, seconds: scene.seconds });
      check(result.clipped === 0, `${name}/${kind}: no clipped samples`);
      check(result.remainingSources === 0, `${name}/${kind}: every score source released`);
      if (name === 'mirror' && kind === 'music') check(result.windows.slice(4,99).every(w => w.rmsDbFS > -65),
        'mirror: continuous musical floor through every section handoff');
      if (name === 'drowned' && kind === 'music') {
        const mean = (a,b) => result.windows.slice(a,b).reduce((sum,w) => sum+w.rmsDbFS,0)/(b-a);
        check(mean(37,43) < mean(18,24)-12, 'drowned: becalming withdraws by at least 12 dB');
        check(result.windows.slice(84,106).every(w => w.rmsDbFS > -75),
          'drowned: continuous low accompaniment from plane loss into the wood');
        check(mean(92,98) < mean(65,78)-3, 'drowned: accompaniment recedes beneath the loss without disappearing');
      }
      const pcm=Buffer.from(result.pcm,'base64');
      const raw=path.join(dir,`${name}-${kind}-raw.wav`); fs.writeFileSync(raw,wav(pcm));
      const {pcm: _, ...metrics}=result;
      renders[kind]={pcm,metrics:{...metrics,...measure(raw)}};
      console.log(`Rendered ${name}/${kind}`);
    }
    // A fixed gain preserves every intentional drop and rest. Music-only files are loudness-matched
    // for audition; the scene's music/ambience balance remains exactly as rendered.
    const exports={};
    for(const [kind,r] of Object.entries(renders)) {
      const gainDb=Math.min(-23-r.metrics.lufs,-3-r.metrics.peakDbFS);
      exports[kind]={...exportAudio(name,kind,r.pcm,10**(gainDb/20)),playbackGainDb:gainDb};
    }
    report.clips.push({name,...scene,raw:Object.fromEntries(Object.entries(renders).map(([k,v])=>[k,v.metrics])),exports});
  }
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks.length,clips:report.clips.map(c=>({name:c.name,exports:c.exports}))},null,2));
} finally {
  await browser?.close(); await server.close(); fs.rmSync(snapshot,{recursive:true,force:true});
}
