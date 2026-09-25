// One reverb against two (perf-bakes L8), for listening: renders the same moments offline through the production
// soundscape twice with the same seed, once as the game is (two reverbs) and once with `reverb=one`, and writes paired
// WAVs, the offline render times and an index page. BASE=<Vite> node tools/reverb-evidence.mjs [out-dir]
// PAGE_ONLY=1 rewrites the page from the last renders; cpu.json in the out dir (from tools/audio-cost.mjs) adds the live saving.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.argv[2] ?? '/tmp/updraft-pb-x1-reverb';
const reps = Number(process.env.REPS ?? 2), rate = 48000;
fs.mkdirSync(out, { recursive: true });
if (process.env.PAGE_ONLY !== '1') await renderAll();
writePage();

async function renderAll() {
const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async ({ reps, rate }) => {
    const { ARRIVAL_MUSIC } = await productionModule('/src/audio/arrival-music.ts');
    const { HOME_ENDING } = await productionModule('/src/story/home-ending.ts');
    const smooth = (t, a, b) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
    const bump = (t, a, b, c, d) => smooth(t, a, b) * (1 - smooth(t, c, d));
    const arrival = (outgoing, target, extra = {}) => t => ({ land: 0, ...extra,
      ...(t < 28 ? outgoing : ARRIVAL_MUSIC[target]), arrivalMusic: t >= 20 && t < 28 ? target : undefined });
    const lead = 10;
    const moments = [
      { name: 'meadow', title: 'Meadow score', seconds: 80, from: 6,
        note: 'The Meadow arrangement from the walk through the flock to the pond, with its wind and a few gusts.',
        state: t => ({ music: 'meadow', meadowScore: t < 30 ? 'walk' : t < 55 ? 'flock' : 'pond', land: 1, meadow: 1, life: 1,
          gust: 14 * bump(t, 12, 12.5, 13.5, 14.5) + 18 * bump(t, 40, 40.5, 42, 43) }) },
      { name: 'arrival-lines', title: 'Arrival at the island of lines', seconds: 45, from: 8,
        note: 'Leaving the still island with its opening pad, the rest, then the Lines score. With two reverbs the old echo is cut at the rest and the new room starts from a fresh one.',
        state: arrival({ music: 'still', openingScore: 'wander', hush: 0 }, 'lines', { life: .6 }) },
      { name: 'arrival-birches', title: 'Arrival at the birches', seconds: 45, from: 8,
        note: 'The Meadow score fades on departure, rests, and the Birches score comes in.',
        state: arrival({ music: 'meadow', meadowScore: 'return' }, 'birches', { life: 1 }) },
      { name: 'finale', title: 'The ending, to the credits', seconds: lead + HOME_ENDING.creditsAt + 4, from: lead + 88,
        note: 'The Home score over the last climb, the drawing and the cut to silence before the credits. The tail after the cut is the reverb.',
        home: true,
        state: t => { t -= lead; return { music: 'home', summitScore: 'approach', homeEndingTime: t >= 0 ? t : undefined,
          night: smooth(t, 80, 92), land: 0, meadow: 0, flockChatter: false, silence: t >= HOME_ENDING.musicEndsAt, scripted: true }; } },
    ];
    const step = 1 / 60;
    async function render(moment, one) {
      let seed = 777001;
      const random = Math.random;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      try {
        const ctx = new OfflineAudioContext(2, Math.ceil(moment.seconds * rate), rate);
        const Native = window.AudioContext;
        window.AudioContext = function () { return ctx; };
        const sound = new audioModule.Soundscape();
        sound.oneReverb = one;
        try { sound.start(); } finally { window.AudioContext = Native; }
        Object.defineProperty(sound, 'running', { get: () => true });
        let placed = false;
        const update = tick => {
          sound.update(step, { ...baseState, breeze: .3, ...moment.state(Math.round(tick * step * 1e6) / 1e6) });
          // As in tools/ending-audition.mjs: the Home score has been playing for a while when the ending begins.
          if (moment.home && !placed && sound.summitScore) { sound.summitScore.epoch = ctx.currentTime - 105; placed = true; }
        };
        update(0);
        const ticks = Math.floor(moment.seconds / step);
        let pause = ctx.suspend(step);
        const started = performance.now();
        const rendering = ctx.startRendering();
        for (let tick = 1; tick < ticks; tick++) {
          await pause; update(tick);
          if (tick + 1 < ticks) pause = ctx.suspend((tick + 1) * step);
          await ctx.resume();
        }
        const buffer = await rendering, ms = performance.now() - started;
        const first = Math.floor(moment.from * rate);
        const clip = new AudioBuffer({ numberOfChannels: 2, length: buffer.length - first, sampleRate: rate });
        for (let ch = 0; ch < 2; ch++) clip.copyToChannel(buffer.getChannelData(ch).subarray(first), ch);
        return { clip, ms };
      } finally { Math.random = random; }
    }
    const clips = [];
    for (const moment of moments) {
      const times = { two: [], one: [] };
      let two, one;
      for (let r = 0; r < reps; r++) {
        const a = await render(moment, false), b = await render(moment, true);
        times.two.push(Math.round(a.ms)); times.one.push(Math.round(b.ms));
        two ??= a.clip; one ??= b.clip;
      }
      let power = 0, diff = 0;
      const apart = new AudioBuffer({ numberOfChannels: 2, length: two.length, sampleRate: rate });
      const perSecond = new Float64Array(Math.ceil(two.duration));
      for (let ch = 0; ch < 2; ch++) {
        const x = two.getChannelData(ch), y = one.getChannelData(ch), d = apart.getChannelData(ch);
        for (let i = 0; i < x.length; i++) {
          const e = x[i] - y[i];
          power += x[i] * x[i]; diff += e * e; perSecond[Math.floor(i / rate)] += e * e;
          d[i] = e * 10;
        }
      }
      const differs = [...perSecond].map((e, i) => [i, 10 * Math.log10(e / (2 * rate) + 1e-20)]).filter(([, db]) => db > -80).map(([i]) => i);
      const { state, ...meta } = moment;
      clips.push({ ...meta, renderMs: times, seconds: two.duration, differenceDb: 10 * Math.log10(diff / power),
        differs, two: encodeAudio(two), one: encodeAudio(one), apart: encodeAudio(apart) });
    }
    return clips;
  }, { reps, rate });
  const report = [];
  for (const clip of result) {
    const files = {};
    for (const variant of ['two', 'one', 'apart']) {
      const file = path.join(out, `${clip.name}-${variant}.wav`);
      fs.writeFileSync(file, wav(Buffer.from(clip[variant].pcm, 'base64'), rate));
      if (spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-b:a', '256k', file.replace(/\.wav$/, '.mp3')]).status === 0) files[variant + 'Mp3'] = path.basename(file.replace(/\.wav$/, '.mp3'));
      files[variant] = path.basename(file);
      delete clip[variant].pcm;
    }
    report.push({ ...clip, files });
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map(({ name, renderMs, differenceDb, two, one }) => ({ name, renderMs, differenceDb,
    peak: [two.peakDbFS, one.peakDbFS], rms: [two.rmsDbFS, one.rmsDbFS] }))));
} finally { await browser.close(); }
}

function writePage() {
  const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
  const cpuFile = path.join(out, 'cpu.json');
  const cpu = fs.existsSync(cpuFile) ? JSON.parse(fs.readFileSync(cpuFile, 'utf8')) : null;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const rows = report.map(clip => {
    const two = median(clip.renderMs.two), one = median(clip.renderMs.one);
    return `<section>
  <h2>${esc(clip.title)}</h2>
  <p>${esc(clip.note)}</p>
  <div class="pair" data-name="${clip.name}">
    <button class="play">Play</button>
    <button class="switch">Now playing: <b>Two reverbs</b></button>
    <audio preload="auto" src="${clip.files.two}"></audio>
    <audio preload="auto" src="${clip.files.one}" muted></audio>
  </div>
  <p>${clip.differs.length ? `They differ from ${clip.differs[0]} s to ${clip.differs.at(-1) + 1} s into the clip.` : 'They sound the same throughout.'}
  <a href="${clip.files.apart}">The difference on its own</a>, 20 dB louder than it is in the mix.</p>
  <p class="files">Files: <a href="${clip.files.two}">two reverbs (the game now)</a> · <a href="${clip.files.one}">one reverb</a>.
  ${clip.seconds.toFixed(0)} s. The two differ by ${clip.differenceDb.toFixed(0)} dB (difference against the mix).
  Offline render: ${two} ms with two, ${one} ms with one (${Math.round(100 * (1 - one / two))}% less).</p>
</section>`;
  }).join('\n');
  const live = cpu ? `<p>${esc(cpu.summary)}</p>` : '';
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html>
<meta charset="utf-8">
<title>Updraft: one reverb or two</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; color: #222; }
  section { border-top: 1px solid #ddd; padding: 1rem 0; }
  .pair { display: flex; gap: .5rem; align-items: center; }
  button { font: inherit; padding: .4rem .8rem; }
  .files { color: #555; font-size: 14px; }
</style>
<h1>One reverb or two</h1>
<p>The game has two reverbs. One is for the music. The other is shared by everything else: wind, calls, chimes, the piano and footsteps.
With <code>reverb=one</code>, the music goes through the shared reverb too, and the second reverb is never made.</p>
<p>Both reverbs are the same, so while a room is playing steadily, the mix sounds the same. It differs in three places:</p>
<ul>
  <li><b>Arrivals.</b> With two reverbs, the old room's echo is cut when the music rests, and the new room starts in a fresh reverb. With one, the old echo rings on into the rest.</li>
  <li><b>Pulled-back music.</b> When the music pulls back for a story moment, its echo is turned down with it. With one reverb, the echo that has already started keeps ringing.</li>
  <li><b>The end.</b> The fade to silence before the credits takes the music's echo with it. With one reverb, the echo rings out after the music stops.</li>
</ul>
<p>Each pair is the same moment, rendered twice from the same starting point. <b>Play</b> starts both together; <b>Switch</b> changes which one you hear without stopping.
Use headphones or good speakers: the differences are in the tails.</p>
${live}
${rows}
<script>
for (const pair of document.querySelectorAll('.pair')) {
  const [two, one] = pair.querySelectorAll('audio');
  const play = pair.querySelector('.play'), sw = pair.querySelector('.switch');
  let onOne = false;
  play.onclick = () => {
    for (const other of document.querySelectorAll('audio')) if (other !== two && other !== one) other.pause();
    if (two.paused) { one.currentTime = two.currentTime; two.play(); one.play(); play.textContent = 'Pause'; }
    else { two.pause(); one.pause(); play.textContent = 'Play'; }
  };
  sw.onclick = () => {
    onOne = !onOne; two.muted = onOne; one.muted = !onOne;
    if (!two.paused && Math.abs(one.currentTime - two.currentTime) > .05) one.currentTime = two.currentTime;
    sw.innerHTML = 'Now playing: <b>' + (onOne ? 'One reverb' : 'Two reverbs') + '</b>';
  };
  two.onended = () => { play.textContent = 'Play'; };
}
</script>
`);
  console.log('page', path.join(out, 'index.html'));
}
