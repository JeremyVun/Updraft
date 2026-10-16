// In the real game (GPU, shared lock), with no input: `drowned` (`?chapter=drowned`, about 1.5 minutes) and `cloud`
// (`?chapter=cloud`, the real handoff from the top of the cloud, about 6 minutes) report when `village_approach.ogg`
// starts and ends against the first challenge (the tub becoming the player's to push, then its drawn invitation), and
// check that it starts once from its top, ends at its seam, and that no music follows it.
// Times are on the game clock (`shot` steps it 1/60 s a frame); the audio clock runs in real time, so the report also
// gives the audio clock's lead, which should stay near zero at 60 fps. In `cloud` the handoff is also derived from the
// game clock (`clouds.ogg` from `clear`, its 208.3 s, the rest), which is what an ordinary player at any frame rate hears.
// `belfry` (`?chapter=belfry`, about 2 minutes) rings the bell four times with strokes, then leaves the game alone, and
// reports the fourth ring, when `belfry.ogg` starts and reaches full level, boarding, the storm, the handover to
// `belfry_ending.ogg` (checked on the audio clock), its ritardando and fade, and the piece's end; `storm`
// (`?chapter=storm`, about a minute) checks a storm save starts it on load.
// `sail` (`?chapter=birches`, about 2 minutes) jumps to the last stretch of the birches with every tangle done, then
// leaves the game alone through the push-off, the crossing and the stairs landing, skips the stairs' puzzle and climbs
// into the white; it reports, from the push-off, when the birches recording fades and ends, the quiet, the stairs song's
// start against the landing, and its fade in the white.
// Usage: node tools/village-music-browser-check.mjs [drowned cloud belfry storm sail]. Vite on 5230, or BASE.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['drowned', 'cloud', 'belfry', 'storm', 'sail'];
const width = 1280, height = 800;

const { browser, close } = await openBrowser({ allowAutoplay: false });
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const logged = [];
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) logged.push(message.text()); });
  const watch = () => page.evaluate(() => {
    const sound = __game.sound;
    window.villageWatch = { clock: 0, sources: [], events: [], padMax: 0, steps: [] };
    const w = villageWatch, at = () => ({ clock: +w.clock.toFixed(2), ctx: +sound.ctx.currentTime.toFixed(2) });
    const mark = (name, extra = {}) => { if (!w.events.some(e => e.name === name)) w.events.push({ name, ...at(), ...extra }); };
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      const length = this.buffer?.duration ?? 0;
      const ending = Math.abs(length - 9.03) < .05;
      if (length > 30 || ending) {
        const track = ending ? 'belfryEnding' : Math.abs(length - 192.87) < .05 ? 'villageApproach' : Math.abs(length - 143.92) < .05 ? 'belfry'
          : Math.abs(length - 238.89) < .05 ? 'birches' : Math.abs(length - 224.08) < .05 ? 'stairs'
          : length > 240 ? 'clouds' : `music ${length.toFixed(1)} s`;
        const entry = { track, offset: +offset.toFixed(3), when: +when.toFixed(2), exact: { when, offset }, ...at() };
        w.sources.push(entry);
        this.addEventListener('ended', () => { entry.ended = at(); });
      }
      return native.call(this, when, offset, duration);
    };
    const update = sound.update.bind(sound);
    sound.update = (dt, s) => {
      w.clock += dt;
      update(dt, s);
      const story = __game.story.current, name = __game.story.name;
      if (name === 'birches' && story.beat === 'push') mark('push');
      if (name === 'toStairs') mark('aboard');
      if (sound.birchesScore?.finishing) mark('birchesFade');
      if (name === 'toStairs' && s.arrivalMusic === 'stairs') mark('request');
      if (name === 'toStairs' && sound.arrivalTransition.stage === 'incoming') mark('entrance');
      if (name === 'stairs') mark('stairs');
      if (s.stairsAir && s.stairsAir.phase !== 'under') mark('white');
      if (s.stairsAir?.clear) mark('clear');
      if (s.stairsAir?.phase === 'fog') mark('fog');
      if (name === 'drowned') {
        mark('village');
        const cat = story.cat;
        if (w.steps.at(-1)?.step !== cat.step) w.steps.push({ step: cat.step, ...at() });
        if (cat.step === 'waiting') mark('tub');
        if (cat.invitation) mark('invitation');
        if (story.beat === 'still') mark('becalmed');
        const church = story.church;
        if (church?.rings) mark(`ring${church.rings}`);
        for (const step of ['down', 'board', 'aboard']) if (church?.step === step) mark(step);
        if (story.beat === 'gather') mark('storm');
        w.padMax = Math.max(w.padMax, sound.padGain.gain.value);
      }
    };
  });
  const begin = async query => {
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&start=1&progress=0&${query}&ratio=1&msaa=2`);
    await page.waitForSelector('#veil.ready', { timeout: 60000 });
    await watch();
    await page.locator('#sound').evaluate(button => button.click());
    await page.locator('#begin').click();
  };
  const settle = async () => {
    await page.waitForFunction(() => {
      const w = villageWatch, v = w.sources.find(s => s.track === 'villageApproach');
      return v?.ended && w.events.some(e => e.name === 'invitation') && __game.sound.ctx.currentTime > v.ended.ctx + 4;
    }, null, { timeout: 480000, polling: 500 });
    return page.evaluate(() => {
      const w = villageWatch, event = name => w.events.find(e => e.name === name);
      return { sources: w.sources, events: w.events, steps: w.steps, padMax: w.padMax,
        playing: !!__game.sound.villageScore, once: __game.tuning.audio.recordedMusicOnce.villageApproach,
        cloudsDelay: __game.tuning.audio.cloudsMusicDelay, rest: __game.tuning.audio.arrivalQuiet,
        clouds: __game.tuning.audio.recordedMusicOnce.clouds, village: event('village') };
    });
  };
  const timeline = (r, origin) => {
    const v = r.sources.find(s => s.track === 'villageApproach'), event = name => r.events.find(e => e.name === name);
    const from = origin ?? v.clock, tub = event('tub'), invitation = event('invitation');
    const end = v.clock + r.once.end;
    return {
      villageStarts: +(v.clock - from).toFixed(1), villageEnds: +(end - from).toFixed(1), seam: r.once.end,
      tubPushable: +(tub.clock - from).toFixed(1), firstInvitation: +(invitation.clock - from).toFixed(1),
      endsBeforeTub: end <= tub.clock, overrunAtTub: +(end - tub.clock).toFixed(1),
      audioClockLead: +((v.ended.ctx - v.ctx) - (v.ended.clock - v.clock)).toFixed(2),
      catSteps: r.steps.map(s => `${s.step}@${(s.clock - from).toFixed(1)}`),
    };
  };
  const common = (r, name) => {
    const village = r.sources.filter(s => s.track === 'villageApproach');
    assert.equal(village.length, 1, `${name}: village_approach starts once`);
    assert.equal(village[0].offset, 0, `${name}: from its top`);
    const played = village[0].ended.ctx - village[0].ctx;
    assert(Math.abs(played - r.once.end) < .1, `${name}: it plays to its seam (${played.toFixed(2)} s)`);
    assert(r.sources.every(s => s.clock <= village[0].clock || s.track === 'villageApproach') && !r.playing,
      `${name}: no music follows it: ${JSON.stringify(r.sources)}`);
    assert(r.padMax < 1e-6, `${name}: the shared pad stays silent in the village (${r.padMax})`);
  };
  const drowned = async () => {
    await begin('chapter=drowned');
    const r = await settle();
    common(r, 'drowned');
    const t = timeline(r, r.village.clock);
    console.log(JSON.stringify({ drowned: t }, null, 2));
    assert(t.villageStarts < .2, 'a drowned start begins the recording with the chapter');
  };
  const cloud = async () => {
    await begin('chapter=cloud');
    const r = await settle();
    common(r, 'cloud');
    const clouds = r.sources.find(s => s.track === 'clouds'), clear = r.events.find(e => e.name === 'clear');
    const fog = r.events.find(e => e.name === 'fog');
    const cloudsEnd = clear.clock + r.cloudsDelay + r.clouds.end;
    const handoff = (cloudsEnd > fog.clock ? cloudsEnd : fog.clock + 3) + r.rest;
    const t = timeline(r, r.village.clock);
    console.log(JSON.stringify({ cloud: { ...t,
      gameClock: { clear: +clear.clock.toFixed(1), cloudsStarts: +clouds.clock.toFixed(1), fog: +fog.clock.toFixed(1),
        cloudsEnds: +cloudsEnd.toFixed(1), villageChapter: +r.village.clock.toFixed(1), villageStartsAtGamePace: +handoff.toFixed(1),
        villageStartsMeasured: +r.sources.find(s => s.track === 'villageApproach').clock.toFixed(1) },
      atGamePace: { villageStarts: +(handoff - r.village.clock).toFixed(1), villageEnds: +(handoff + r.once.end - r.village.clock).toFixed(1) },
    } }, null, 2));
    assert(clouds && clouds.offset < .1, `clouds.ogg plays from its top on top of the cloud (${clouds?.offset} s in)`);
  };
  const frame = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => done())));
  const bell = () => page.evaluate(() => { const ch = __game.story.current.church; return { step: ch.step, rings: ch.rings, angle: ch.bell.angle }; });
  const goodbye = async (name, ready) => {
    await page.waitForFunction(() => {
      const e = villageWatch.sources.find(s => s.track === 'belfryEnding');
      return e?.ended && villageWatch.events.some(x => x.name === 'storm') && __game.sound.ctx.currentTime > e.ended.ctx + 2;
    }, null, { timeout: 300000, polling: 500 });
    const r = await page.evaluate(() => ({ sources: villageWatch.sources, events: villageWatch.events,
      once: __game.tuning.audio.recordedMusicOnce.belfry, playing: !!__game.sound.belfryScore }));
    const b = r.sources.filter(s => s.track === 'belfry'), e = r.sources.filter(s => s.track === 'belfryEnding');
    const event = name => r.events.find(x => x.name === name)?.clock;
    assert.equal(b.length, 1, `${name}: belfry.ogg starts once`);
    assert(Math.abs(b[0].offset - r.once.from) < .1, `${name}: from ${r.once.from} s (${b[0].offset})`);
    assert.equal(e.length, 1, `${name}: belfry_ending.ogg is scheduled once`);
    const { at: handover, from: endingFrom, crossfade } = r.once.ending, lead = handover - b[0].exact.offset;
    const due = b[0].exact.when + lead, late = e[0].exact.when - due;
    assert(Math.abs(late) < 1e-6 && Math.abs(e[0].exact.offset - (handover - endingFrom)) < 1e-6,
      `${name}: the ending starts on the audio clock ${lead.toFixed(4)} s after belfry.ogg, from ${handover - endingFrom} s in (${late} s off)`);
    const handedOver = b[0].ended.ctx - b[0].ctx, played = e[0].ended.ctx - b[0].ctx;
    assert(Math.abs(handedOver - lead - crossfade) < .05, `${name}: belfry.ogg stops once the crossfade is done (${handedOver.toFixed(2)} s)`);
    assert(Math.abs(played - (r.once.end - b[0].offset)) < .1, `${name}: the ending plays to its end (${played.toFixed(2)} s)`);
    assert(!r.sources.some(s => s.track === 'villageApproach') && !r.playing, `${name}: nothing else plays: ${JSON.stringify(r.sources)}`);
    const from = ready(event);
    const at = x => x === undefined ? null : +(x - from).toFixed(1);
    // belfry_ending.ogg slows from 51.05 s on the recording's time line and fades over its last 2.5 s.
    const slowsFrom = 51.05, fade = 2.5;
    const report = { origin: name === 'belfry' ? 'the fourth ring' : 'load', fourthRing: at(event('ring4')), starts: at(b[0].clock),
      fullLevel: at(b[0].clock + r.once.enterOver), herDown: at(event('down')), boarding: at(event('board')), aboard: at(event('aboard')),
      storm: at(event('storm')), handover: at(b[0].clock + lead), slowsFrom: at(b[0].clock + slowsFrom - b[0].exact.offset),
      fadeFrom: at(e[0].ended.clock - fade), ends: at(e[0].ended.clock), endingScheduledOff: late,
      audioClockLead: +((e[0].ended.ctx - b[0].ctx) - (e[0].ended.clock - b[0].clock)).toFixed(2) };
    console.log(JSON.stringify({ [name]: report }, null, 2));
    return report;
  };
  const belfry = async () => {
    await begin('chapter=belfry');
    await page.waitForFunction(() => __game.story.current.church?.step === 'ring', null, { timeout: 60000 });
    let pointer = [.5, .99];
    /** Strokes across the bell, each once it has come back near rest, until it has rung four times. */
    for (let strokes = 0; strokes < 40 && (await bell()).rings < 4; strokes++) {
      for (let i = 0; i < 40 && Math.abs((await bell()).angle) > .08; i++) await page.waitForTimeout(100);
      const aim = await page.evaluate(() => {
        const b = __game.story.current.church.bell, cam = __game.rig.camera, a = b.middle(cam.position.clone()).project(cam);
        return { at: [(a.x + 1) / 2, (1 - a.y) / 2], heading: b.screenHeading(cam) };
      });
      const dx = Math.cos(aim.heading) * .42 / (width / height), dy = -Math.sin(aim.heading) * .42;
      const start = [aim.at[0] - dx / 2, aim.at[1] - dy / 2];
      for (const [x, y] of [[pointer[0], .99], [start[0], .99], start]) { await page.mouse.move(x * width, y * height); await frame(); }
      for (let i = 1; i <= 9; i++) {
        pointer = [start[0] + dx * i / 9, start[1] + dy * i / 9];
        await page.mouse.move(pointer[0] * width, pointer[1] * height); await frame();
      }
      await page.waitForTimeout(600);
    }
    assert.equal((await bell()).rings, 4, 'strokes ring the bell four times');
    const t = await goodbye('belfry', event => event('ring4'));
    assert(t.starts >= 0 && t.starts < .1, 'it starts on the fourth ring');
  };
  const storm = async () => {
    await begin('chapter=storm');
    const t = await goodbye('storm', () => 0);
    assert(t.starts < .2, 'a storm save starts it on load');
  };
  const sail = async () => {
    await begin('chapter=birches');
    await page.waitForFunction(() => __game.sound.birchesScore?.source, null, { timeout: 60000 });
    // On the last stretch of the walk with every tangle done: she gathers the bird, boards and pushes off.
    await page.evaluate(async () => {
      const g = __game, ch = g.story.current, { BIRCHES_WALK } = await import('/src/world/birches.ts');
      const last = BIRCHES_WALK.length - 1, p = BIRCHES_WALK[last - 1];
      ch.restoreCheckpoint('scarf4-4', [last, 1, ch.dusk, 4]);
      g.child.place(p.x, p.y, Math.PI);
    });
    const after = (name, seconds) => page.waitForFunction(({ name, seconds }) => {
      const e = villageWatch.events.find(x => x.name === name);
      return e && villageWatch.clock - e.clock > seconds;
    }, { name, seconds }, { timeout: 300000, polling: 250 });
    // Under the cloud with every flight home, so she climbs on into the white without the puzzle.
    await after('stairs', 8);
    await page.evaluate(() => __game.story.current.restoreCheckpoint('flight-3', [3]));
    await after('white', 6);
    const r = await page.evaluate(() => ({ sources: villageWatch.sources, events: villageWatch.events,
      rest: __game.tuning.audio.stairsSongRest, fade: __game.tuning.audio.birchesSailFade, cloudFade: __game.tuning.audio.stairsSongCloudFade }));
    const event = name => r.events.find(e => e.name === name), push = event('push');
    const birches = r.sources.filter(s => s.track === 'birches'), song = r.sources.filter(s => s.track === 'stairs');
    assert.equal(birches.length, 1, 'sail: the birches recording plays one pass, never begun again');
    assert.equal(song.length, 1, 'sail: the stairs song starts once');
    const [b, t] = [birches[0], song[0]], white = event('white');
    const at = x => +(x - push.clock).toFixed(1);
    const report = { origin: 'push-off, game clock (s)', aboard: at(event('aboard').clock),
      birchesFadeFrom: event('birchesFade') ? at(Math.max(event('birchesFade').clock, b.ended.clock - r.fade)) : null, birchesEnds: at(b.ended.clock),
      request: at(event('request').clock), stairsSongStarts: at(t.clock), landing: at(event('stairs').clock),
      quietGap: +(t.clock - b.ended.clock).toFixed(1), quietGapAudioClock: +(t.ctx - b.ended.ctx).toFixed(2),
      songBeforeLanding: +(event('stairs').clock - t.clock).toFixed(1), white: at(white.clock),
      songEnds: at(t.ended.clock), songFadeAudioClock: +(t.ended.ctx - white.ctx).toFixed(2), songOffset: t.offset };
    console.log(JSON.stringify({ sail: report }, null, 2));
    assert(t.offset < .01 && t.clock < event('stairs').clock, 'sail: the stairs song begins from its top on the crossing\'s handoff');
    assert(t.ctx - b.ended.ctx >= r.rest - .1, `sail: the birches end at least ${r.rest} s before the stairs song`);
    assert(t.ended.ctx - white.ctx <= r.cloudFade + .1 && t.ended.ctx > white.ctx, `sail: up in the white the song fades over ${r.cloudFade} s`);
    assert(r.sources.every(s => s === b || s === t), `sail: no other music: ${JSON.stringify(r.sources)}`);
  };
  const run = { drowned, cloud, belfry, storm, sail };
  for (const name of cases) await run[name]();
  if (logged.length) console.log(JSON.stringify({ logged }, null, 2));
  assert.deepEqual(errors, []);
} finally { await close(); }
