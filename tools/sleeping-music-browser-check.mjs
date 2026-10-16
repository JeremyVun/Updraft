// Sleeping's recordings in the real game (GPU, shared lock, a real AudioContext), on the audio clock and the game's:
// `climb`  `?chapter=toSleeping` with no input until the feather is offered, then prompt real gestures (the pillow, the
//          climb's sweeps, the summit's circles) and on to the sea: the lullaby's start and end against the arrival,
//          bed, sleep, the frost, the tries and the call; silence from its end until the feather; each of the climb's
//          parts against the beats; the morning from the curtains, and the sea. Saves the feather and morning
//          checkpoints for the restores.
// `sleeping`  `?chapter=sleeping`: the lullaby from load and the frost's wait.
// `ribbon`  `?chapter=ribbon`, the summit's circles: the summit part a second after the top, rising in, let go as the
//          bandage comes free, silence through the turn to the ribbon, the leap and the tug, then the curtains, the morning's entry and its
//          next seams against the glide, the waking and the child sitting up, and its fade as the boat leaves for the sea.
// `feather`, `morning`  those saves continued: the climb theme from its top as the climb resumes; silence until the sea.
// Usage: node tools/sleeping-music-browser-check.mjs [climb sleeping ribbon feather morning]; `climb` before the
// restores (about 5 minutes, the rest 1–2 each). Vite on 5230, or BASE. SLOW=2.5 holds every stop that much longer.
// Offline rules and the players' tables: `sleeping-music-check.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['climb', 'sleeping', 'ribbon', 'feather', 'morning'];

const saves = '/tmp/updraft-sleeping-music-saves.json';
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const slow = Number(process.env.SLOW ?? 1);
const width = 1600, height = 900;

const { browser, close } = await openBrowser({ allowAutoplay: false });
try {
  const open = async (save = null) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    if (save) await context.addInitScript(save => localStorage.setItem('updraft.progress.v1', save), save);
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
    page.on('request', request => {
      if (request.resourceType() === 'fetch' && /\.ogg(?:\?|$)/.test(request.url())) requests.push(new URL(request.url()).pathname.replace(/^.*\//, ''));
    });
    return { context, page, errors, requests };
  };
  // Every Sleeping, sea and lullaby clip, each beat, gate and winter mark, and the background's level, on both clocks.
  const watch = page => page.evaluate(() => {
    const g = __game, sound = g.sound;
    const w = window.sleepWatch = { clips: [], events: [], marks: {}, loud: [], game: 0, started: false };
    const length = node => node.buffer?.duration ?? 0;
    const native = AudioBufferSourceNode.prototype.start, nativeStop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const d = length(this), track = Math.abs(d - 174.2) < .1 ? 'brave' : Math.abs(d - 143.6) < .1 ? 'lullaby'
        : Math.abs(d - 123.7) < .1 ? 'morning' : Math.abs(d - 236.6) < .2 ? 'sea' : null;
      if (track) {
        const [when = 0, offset = 0, duration = Infinity] = args, ctx = sound.ctx.currentTime;
        this.clip = { track, offset, when, end: when + duration, game: w.game + Math.max(0, when - ctx), beat: g.story.current.beat };
        w.clips.push(this.clip);
      }
      return native.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      if (this.clip) this.clip.end = Math.min(this.clip.end, Math.max(args[0] ?? 0, this.clip.when));
      return nativeStop.apply(this, args);
    };
    let analyser = null, samples = null;
    const update = sound.update.bind(sound), seen = {};
    sound.update = (dt, state) => {
      update(dt, state);
      if (!w.started || !sound.ctx) return;
      w.game += dt;
      const ctx = sound.ctx.currentTime, c = g.story.current, at = { ctx, game: w.game };
      if (!analyser) { analyser = sound.ctx.createAnalyser(); analyser.fftSize = 2048; samples = new Float32Array(2048); sound.backgroundDry.connect(analyser); }
      analyser.getFloatTimeDomainData(samples);
      let sum = 0; for (const s of samples) sum += s * s;
      w.loud.push([ctx, 10 * Math.log10(sum / samples.length + 1e-20)]);
      for (const [key, value] of [['chapter', g.story.name], ['arrival', state.arrivalMusic], ['beat', c.beat], ['score', c.sleepingScore], ['gate', c.sleepingMusic], ['tried', c.tried], ['called', c.called], ['offered', !!(c.beat === 'asleep' && c.windInvitation)],
        ['released', !!g.sleeping?.ribbon.released],
        // As `waking` has it: her eyes open 2.2 s in, and she sits up from 3.6 s.
        ['eyes', c.beat === 'waking' && c.t > 2.2], ['sitsUp', c.beat === 'waking' && c.t > 3.6]]) {
        if (seen[key] !== value) { seen[key] = value; w.events.push({ key, value, ...at, t: c.t }); }
      }
      if (c.beat === 'asleep') { w.marks.frostWait = c.frostWait; w.marks.lullabyLeft = c.lullaby; }
      if (w.marks.seaGate === undefined && w.clips.some(clip => clip.track === 'sea' && clip.when <= ctx)) w.marks.seaGate = sound.backgroundGate.gain.value;
    };
  });
  const begin = async (page, query) => {
    await page.goto(`${base}?shot&start=1&${query}&ratio=1&msaa=2`);
    await page.waitForSelector('#veil.ready', { timeout: 90000 });
    await watch(page);
    // Story time runs with the audio clock rather than in fixed shot steps.
    await page.evaluate(async () => { (await import('/src/params.ts')).params.shot = false; });
    await page.locator('#sound').evaluate(button => button.click());
    await page.locator('#begin').click();
    await page.waitForFunction(() => __game.sound.ctx?.state === 'running', null, { timeout: 60000 });
    await page.evaluate(() => { sleepWatch.started = true; });
  };
  const beat = (page, ...names) => page.waitForFunction(names => names.includes(__game.story.current.beat), names, { timeout: 240000 });
  const point = (page, kind) => page.evaluate(kind => {
    const g = __game, at = kind === 'bird' ? g.cygnet.position : kind === 'feather' ? g.sleeping.feather.position : g.story.current.windInvitation;
    const p = at.clone().project(g.rig.camera);
    return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
  }, kind);
  const sweep = async (page, kind) => {
    const circle = kind === 'bird', p = await point(page, kind), count = circle ? 100 : 28, rad = height * .06;
    for (let i = 0; i <= count; i++) {
      const a = i / count * Math.PI * 4;
      const x = p.x + (circle ? Math.cos(a) * rad : (i / count - .5) * Math.min(170, width * .4));
      const y = p.y + (circle ? Math.sin(a) * rad : Math.sin(i / count * Math.PI) * 8);
      await page.mouse.move(Math.max(4, Math.min(width - 4, x)), Math.max(4, Math.min(height - 4, y)));
      await page.waitForTimeout(circle ? 25 : 22);
      if (circle && i % 5 === 0 && await page.evaluate(() => !__game.story.current.invitesFlight)) break;
    }
  };
  const report = async (page, errors, requests) => {
    const w = await page.evaluate(async () => {
      const { MORNING_FROM, MORNING_SEAMS } = await import('/src/audio/sleeping-music.ts'), A = __game.tuning.audio;
      return { ...sleepWatch, loud: undefined, loudness: sleepWatch.loud, MORNING_FROM, MORNING_SEAMS,
        giveWay: Math.max(A.curtainsFade, A.mirrorSeamRelease), letGo: Math.max(A.ribbonFade, A.ribbonSeamWithin),
        summitDelay: A.summitDelay, departureFade: A.sleepingDepartureFade, seaLead: A.seaMusicLead };
    });
    const quiet = (from, to) => Math.max(-200, ...w.loudness.filter(([t]) => t >= from && t <= to).map(([, v]) => v));
    return { w, quiet, errors, requests };
  };
  const when = (w, key, value) => w.events.find(e => e.key === key && (value === undefined ? true : e.value === value));
  const row = (label, e) => e ? `${label.padEnd(26)} audio ${e.ctx.toFixed(2).padStart(7)}   game ${e.game.toFixed(2).padStart(7)}` : `${label.padEnd(26)} —`;
  const clipRows = (w, track) => w.clips.filter(c => c.track === track && c.end > c.when).map(c => `${track.padEnd(8)} recording ${c.offset.toFixed(2).padStart(6)}–${(c.offset + c.end - c.when).toFixed(2).padEnd(7)} audio ${c.when.toFixed(2).padStart(7)}–${c.end.toFixed(2).padEnd(7)} game ${c.game.toFixed(2).padStart(7)} (${c.beat})`);

  const climb = async () => {
    const { page, errors, requests } = await open();
    await begin(page, 'progress=1&chapter=toSleeping');
    const captured = {};
    const keep = async () => {
      const save = await page.evaluate(() => localStorage.getItem('updraft.progress.v1'));
      const point = save && JSON.parse(save).point;
      if ((point === 'feather' || point === 'morning') && !captured[point]) captured[point] = save;
    };
    await page.waitForFunction(() => __game.story.current.beat === 'asleep' && !!__game.story.current.windInvitation, null, { timeout: 240000 });
    await page.waitForTimeout(2000 * slow);
    for (let i = 0; i < 6 && await page.evaluate(() => __game.story.current.beat === 'asleep'); i++) await sweep(page, 'pillow');
    await beat(page, 'feather');
    await beat(page, 'climb');
    for (let j = 0; j < 400 && await page.evaluate(() => ['edge', 'climb', 'snow', 'step', 'mist', 'crest', 'catchFeather'].includes(__game.story.current.beat)); j++) {
      await keep();
      const current = await page.evaluate(() => __game.story.current.beat);
      if (current === 'catchFeather' || current === 'edge') { await page.waitForTimeout(300); continue; }
      // The step up the bank takes circles at the bird, as the summit does.
      if (current === 'step') {
        if (await page.evaluate(() => __game.story.current.invitesFlight)) await sweep(page, 'bird');
        else await page.waitForTimeout(300);
        continue;
      }
      if (current === 'snow' || current === 'mist') {
        if (!await page.evaluate(() => !!__game.story.current.windInvitation)) { await page.waitForTimeout(300); continue; }
        await page.waitForTimeout(400 + 2400 * (slow - 1));
        await sweep(page, 'encounter');
      } else {
        // As `sleeping-check`: no sweeping the feather on as the bird reaches the snow or the fog.
        if (await page.evaluate(() => [3, 7].includes(__game.story.current.routeIndex))) { await page.waitForTimeout(350); continue; }
        const p = await point(page, 'feather');
        for (let i = 0; i <= 24; i++) {
          if (i % 4 === 0 && await page.evaluate(() => __game.story.current.beat !== 'climb')) break;
          await page.mouse.move(Math.max(8, Math.min(width - 8, p.x + (i / 24 - .5) * width * .42)), Math.max(8, Math.min(height - 8, p.y + 22 - Math.sin(i / 24 * Math.PI) * 50)));
          await page.waitForTimeout(25);
        }
      }
      await page.waitForTimeout(500 * slow);
    }
    await beat(page, 'hilltop');
    await page.waitForTimeout(2000 * slow);
    for (let i = 0; i < 6 && await page.evaluate(() => __game.story.current.beat === 'hilltop'); i++) await sweep(page, 'bird');
    await beat(page, 'glide');
    for (let i = 0; i < 400 && await page.evaluate(() => __game.story.name === 'sleeping'); i++) { await keep(); await page.waitForTimeout(250); }
    await page.waitForFunction(() => sleepWatch.clips.some(c => c.track === 'sea'), null, { timeout: 60000 });
    await page.waitForTimeout(1000);
    const { w, quiet } = await report(page, errors, requests);
    fs.writeFileSync(saves, JSON.stringify(captured));
    const lullaby = w.clips.filter(c => c.track === 'lullaby'), parts = w.clips.filter(c => c.track === 'brave' && c.end > c.when);
    const feather = when(w, 'beat', 'feather'), sea = w.clips.find(c => c.track === 'sea');
    console.log('\nBedtime (from the start of the toSleeping crossing)');
    for (const [label, e] of [['arrival requested', when(w, 'arrival', 'sleeping')], ['landed (Sleeping)', when(w, 'chapter', 'sleeping')], ['toBed', when(w, 'beat', 'toBed')],
      ['tuckIn', when(w, 'beat', 'tuckIn')], ['asleep', when(w, 'beat', 'asleep')], ['frost (score cold)', when(w, 'score', 'cold')],
      ['try 1', when(w, 'tried', 1)], ['try 2', when(w, 'tried', 2)], ['try 3', when(w, 'tried', 3)], ['call', when(w, 'called', true)],
      ['feather offered', when(w, 'offered', true)], ['feather freed', feather]]) console.log('  ' + row(label, e));
    for (const line of clipRows(w, 'lullaby')) console.log('  ' + line);
    console.log(`  winter waited ${w.marks.frostWait?.toFixed(2)} s for the lullaby`);
    console.log('\nClimb');
    for (const name of ['feather', 'edge', 'climb', 'snow', 'step', 'mist', 'crest', 'catchFeather', 'unbinding', 'hilltop', 'reachRibbon', 'pullRibbon', 'glide', 'waking', 'lap', 'toBoat', 'aboard']) {
      const e = when(w, 'beat', name);
      if (e) console.log('  ' + row(name, e) + `   (+${(e.ctx - feather.ctx).toFixed(1)} s from the feather)`);
    }
    for (const gate of ['feather', 'mist', 'catch', 'summit', 'ribbon', 'glide']) { const e = when(w, 'gate', gate); if (e) console.log('  ' + row(`gate ${gate}`, e)); }
    console.log('  ' + row('ribbon released', when(w, 'released', true)));
    for (const track of ['brave', 'morning', 'sea']) for (const line of clipRows(w, track)) console.log('  ' + line);
    console.log('  ' + row('toMirror', when(w, 'chapter', 'toMirror')));
    const tuneEnd = lullaby[0].end, silent = quiet(tuneEnd + .1, feather.ctx - .1);
    console.log(`  background loudest from the lullaby's end to the feather: ${silent.toFixed(1)} dBFS; requests: ${requests.join(', ')}`);
    assert(lullaby.length === 1 && lullaby[0].offset === 0, 'the lullaby plays once from its top');
    const frost = when(w, 'score', 'cold');
    assert(frost.ctx >= tuneEnd + 1.4, 'the frost comes after the lullaby and a rest');
    assert(silent < -90, 'silence from the lullaby\'s end until the feather');
    assert(parts[0]?.offset === 0 && Math.abs(parts[0].when - feather.ctx) < .2, 'the climb theme enters with the freed feather');
    assert(parts.every((c, i) => !i || c.when >= parts[i - 1].end - 1e-3), 'parts never overlap');
    ribbonHolds(w, parts, quiet);
    curtainsHold(w, parts);
    const morning = w.clips.find(c => c.track === 'morning');
    assert(sea && morning.end <= sea.when + 1e-3, 'the sea begins after the morning');
    departureHolds(w);
    assert(captured.feather && captured.morning, 'both checkpoints were saved');
    assert.deepEqual(errors, [], 'no console errors');
  };
  // The curtains: the morning once, from its second phrase, as the ribbon is released; the climb gone within
  // `giveWay`; no coda.
  const curtainsHold = (w, parts) => {
    const released = when(w, 'released', true), morning = w.clips.filter(c => c.track === 'morning');
    assert(morning.length === 1 && Math.abs(morning[0].offset - w.MORNING_FROM) < 1e-3, 'the morning plays once, from its second phrase');
    assert(Math.abs(morning[0].when - released.ctx) < .2, `the morning enters as the curtains open (${(morning[0].when - released.ctx).toFixed(3)} s)`);
    assert(parts.every(c => c.end <= morning[0].when + w.giveWay + .05), 'the climb gives way to the morning');
    assert(!parts.some(c => c.offset > 152), 'the coda never plays');
    assert(when(w, 'gate', 'glide').ctx <= released.ctx + .05, 'the glide gate is the release');
  };
  // The bandage freed: no climb part begins from it, the one sounding is let go within `letGo`, and silence holds
  // through the turn to the ribbon, the leap and the tug until the curtains.
  const ribbonHolds = (w, parts, quiet) => {
    const turn = when(w, 'beat', 'hilltop'), released = when(w, 'released', true), gate = when(w, 'gate', 'ribbon');
    assert(gate && gate.ctx > when(w, 'beat', 'unbinding').ctx && gate.ctx < turn.ctx, 'the ribbon gate comes with the bandage, before the turn');
    assert(!parts.some(c => c.when >= gate.ctx - .05), 'no climb part begins once the bandage is freed');
    const end = Math.max(gate.ctx, ...parts.map(c => c.end));
    assert(end <= gate.ctx + w.letGo + .05, `the climb lets go within ${w.letGo} s of the bandage freed (${(end - gate.ctx).toFixed(2)} s)`);
    const loudest = quiet(end + .1, released.ctx - .1);
    assert(loudest < -90, `silence from the climb's end until the curtains (${loudest.toFixed(1)} dBFS)`);
    return end;
  };
  // Leaving for the sea: the morning fades over `sleepingDepartureFade` as the passage begins, and the sea's recording begins
  // `seaMusicLead` into the passage.
  const departureHolds = w => {
    const aboard = when(w, 'beat', 'aboard'), passage = when(w, 'chapter', 'toMirror');
    const morning = w.clips.find(c => c.track === 'morning'), sea = w.clips.find(c => c.track === 'sea');
    const heard = w.loudness.filter(([t, v]) => t >= aboard.ctx && t < sea.when && v > -90).map(([t]) => t);
    const lastHeard = Math.max(aboard.ctx, ...heard);
    console.log(`  departure: aboard audio ${aboard.ctx.toFixed(2)}, passage ${passage.ctx.toFixed(2)}, morning stops ${morning.end.toFixed(2)} (+${(morning.end - passage.ctx).toFixed(2)} s from the passage), last heard over −90 dBFS +${(lastHeard - aboard.ctx).toFixed(2)} s, sea begins ${sea.when.toFixed(2)} (+${(sea.when - passage.ctx).toFixed(2)} s into the passage on the audio clock, +${(sea.game - passage.game).toFixed(2)} s on the game's, ${(sea.when - morning.end).toFixed(2)} s after the morning), gate ${w.marks.seaGate?.toFixed(3)} as it begins`);
    assert(Math.abs(morning.end - passage.ctx - w.departureFade) < .2, `the morning fades over ${w.departureFade} s as the boat leaves`);
    assert(Math.abs(sea.game - passage.game - w.seaLead) < .2, `the sea begins ${w.seaLead} s into the passage`);
    assert(sea.when >= morning.end + .5 && w.marks.seaGate > .99, 'a rest, and the gates open, before the sea begins');
  };
  const ribbon = async () => {
    const { page, errors, requests } = await open();
    await begin(page, 'progress=0&chapter=ribbon');
    await beat(page, 'hilltop');
    await page.waitForTimeout(2000 * slow);
    for (let i = 0; i < 6 && await page.evaluate(() => __game.story.current.beat === 'hilltop'); i++) await sweep(page, 'bird');
    await beat(page, 'glide');
    await beat(page, 'lap');
    await page.waitForFunction(() => sleepWatch.clips.some(c => c.track === 'sea'), null, { timeout: 180000 });
    await page.waitForTimeout(1500);
    const { w, quiet, errors: errs } = await report(page, errors, requests);
    const parts = w.clips.filter(c => c.track === 'brave' && c.end > c.when), morning = w.clips.find(c => c.track === 'morning');
    const released = when(w, 'released', true);
    console.log('\n?chapter=ribbon (from Begin)');
    for (const [label, e] of [['gate summit', when(w, 'gate', 'summit')], ['unbinding', when(w, 'beat', 'unbinding')], ['gate ribbon (bandage nearly free)', when(w, 'gate', 'ribbon')], ['hilltop (turn)', when(w, 'beat', 'hilltop')],
      ['reachRibbon (leap)', when(w, 'beat', 'reachRibbon')], ['pullRibbon', when(w, 'beat', 'pullRibbon')], ['ribbon released', released], ['gate glide', when(w, 'gate', 'glide')],
      ['glide', when(w, 'beat', 'glide')], ['waking', when(w, 'beat', 'waking')], ['eyes open', when(w, 'eyes', true)], ['sits up', when(w, 'sitsUp', true)], ['lap', when(w, 'beat', 'lap')]]) {
      if (e) console.log('  ' + row(label, e) + `   (${(e.ctx - released.ctx >= 0 ? '+' : '')}${(e.ctx - released.ctx).toFixed(2)} s from the release)`);
    }
    for (const track of ['brave', 'morning']) for (const line of clipRows(w, track)) console.log('  ' + line);
    for (const seam of w.MORNING_SEAMS.filter(seam => seam > w.MORNING_FROM).slice(0, 3)) {
      const at = morning.when + seam - morning.offset;
      console.log(`  morning seam ${seam.toFixed(2)} s sounds at audio ${at.toFixed(2)}   (+${(at - released.ctx).toFixed(2)} s from the release)`);
    }
    const unbound = when(w, 'gate', 'ribbon'), leap = when(w, 'beat', 'reachRibbon'), summit = when(w, 'gate', 'summit');
    const end = ribbonHolds(w, parts, quiet), part = parts[0];
    const seamed = Math.abs(part.offset + part.end - part.when - 126.67) < .02;
    console.log(`  summit part begins +${(part.when - summit.ctx).toFixed(2)} s after the top, ends ${seamed ? 'at its 126.67 s seam' : 'in a fade'} +${(part.end - unbound.ctx).toFixed(2)} s after the ribbon gate (${(part.offset + part.end - part.when).toFixed(2)} s in the recording);`
      + ` silence ${(leap.ctx - end).toFixed(2)} s before the leap, ${(released.ctx - end).toFixed(2)} s before the curtains`);
    departureHolds(w);
    console.log(`  requests: ${requests.join(', ')}`);
    assert(parts.length === 1 && Math.abs(part.offset - 112.11) < 1e-3 && Math.abs(part.when - summit.ctx - w.summitDelay) < .2,
      `the summit part ${w.summitDelay} s after the bird reaches the top`);
    curtainsHold(w, parts);
    assert(requests.includes('sleeping_morning.ogg'), 'the morning is loaded');
    assert.deepEqual(errs, [], 'no console errors');
  };
  const sleeping = async () => {
    const { page, errors, requests } = await open();
    await begin(page, 'progress=0&chapter=sleeping');
    await page.waitForFunction(() => __game.story.current.sleepingScore === 'cold', null, { timeout: 180000 });
    await page.waitForTimeout(12000);
    const { w } = await report(page, errors, requests);
    console.log('\n?chapter=sleeping (from Begin)');
    for (const [label, e] of [['toBed', when(w, 'beat', 'toBed')], ['asleep', when(w, 'beat', 'asleep')], ['frost (score cold)', when(w, 'score', 'cold')],
      ['try 1', when(w, 'tried', 1)], ['call', when(w, 'called', true)]]) console.log('  ' + row(label, e));
    for (const line of clipRows(w, 'lullaby')) console.log('  ' + line);
    console.log(`  winter waited ${w.marks.frostWait?.toFixed(2)} s; requests before and during: ${requests.join(', ')}`);
    const lullaby = w.clips.filter(c => c.track === 'lullaby');
    assert(lullaby.length === 1 && lullaby[0].offset === 0 && lullaby[0].when < 1, 'the lullaby plays from load');
    assert(when(w, 'score', 'cold').ctx >= lullaby[0].end + 1.4, 'the frost waits for the lullaby and a rest');
    assert.deepEqual(errors, [], 'no console errors');
  };
  const restore = async point => {
    const save = JSON.parse(fs.readFileSync(saves, 'utf8'))[point];
    assert(save, `run \`climb\` first: no ${point} save`);
    const { page, errors, requests } = await open(save);
    await begin(page, 'progress=1');
    if (point === 'feather') {
      await page.waitForFunction(() => sleepWatch.clips.some(c => c.track === 'brave'), null, { timeout: 30000 });
      await page.waitForTimeout(3000);
    } else {
      await page.waitForFunction(() => sleepWatch.clips.some(c => c.track === 'sea'), null, { timeout: 120000 });
      await page.waitForTimeout(1000);
    }
    const { w, quiet } = await report(page, errors, requests);
    console.log(`\n${point} save, continued (from Begin)`);
    for (const e of w.events.filter(e => e.key === 'beat' || e.key === 'chapter' || e.key === 'gate').slice(0, 8)) console.log('  ' + row(`${e.key} ${e.value}`, e));
    for (const track of ['lullaby', 'brave', 'morning', 'sea']) for (const line of clipRows(w, track)) console.log('  ' + line);
    console.log(`  requests: ${requests.join(', ')}`);
    assert(!w.clips.some(c => c.track === 'lullaby'), 'no lullaby');
    if (point === 'feather') {
      const first = w.clips.find(c => c.track === 'brave'), climb = when(w, 'beat', 'climb');
      assert(first.offset === 0 && Math.abs(first.when - climb.ctx) < .5, 'the climb theme from its top as the restored climb begins');
      assert(requests.includes('cygnet_brave.ogg') && !requests.includes('sleeping.ogg'), 'only the climb\'s recording is loaded to begin');
    } else {
      const sea = w.clips.find(c => c.track === 'sea');
      assert(!w.clips.some(c => c.track === 'brave' || c.track === 'morning') && quiet(0, sea.when - .1) < -90, 'silence until the sea');
      assert(!['cygnet_brave.ogg', 'sleeping.ogg', 'sleeping_morning.ogg'].some(file => requests.includes(file)), 'no Sleeping recording is loaded');
    }
    assert.deepEqual(errors, [], 'no console errors');
  };
  for (const name of cases) {
    if (name === 'climb') await climb();
    else if (name === 'sleeping') await sleeping();
    else if (name === 'ribbon') await ribbon();
    else await restore(name);
  }
} finally { await close(); }
