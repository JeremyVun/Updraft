// Audio invariants using production methods and Chrome's Web Audio, without the game/GPU.
// Usage: node tools/audio-check.mjs (requires the dev server; BASE overrides port 5230).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const checks = await page.evaluate(async () => {
    const passed = [];
    const check = (condition, message) => { if (!condition) throw Error(message); passed.push(message); };
    const { tuning } = await productionModule('/src/tuning.ts');
    // Keep real instance state, substituting only AudioParams and the individual sound voices.
    function fixture(overrides = {}, start = 90) {
      const sound = new audioModule.Soundscape(), calls = [];
      const parameter = () => ({ value: 0, setTargetAtTime(value) { this.value = value; }, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value; } });
      sound.ctx = { currentTime: 90 };
      Object.defineProperty(sound, 'running', { get: () => true });
      for (const name of ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain', 'musicBus', 'padGain', 'backgroundDuck']) {
        sound[name] = { gain: parameter() };
      }
      for (const name of ['gustFilter', 'whistleFilter', 'liftFilter', 'padFilter']) sound[name] = { frequency: parameter() };
      sound.gustPan = { pan: parameter() };
      if (overrides.music === 'boats') sound.boatsScore = { update() {}, handoffAt: now => now, chordAt: () => 0, stop() {} };
      for (const name of ['chime', 'cricket', 'owl', 'skylark', 'phrase', 'flare', 'peep', 'bugle']) {
        sound[name] = (...args) => calls.push({ name, args });
      }
      const state = { ...baseState, music: 'still', startingIsland: true, ...overrides };
      const update = (at = start, changes = {}) => { sound.ctx.currentTime = at; Object.assign(state, changes); sound.update(1 / 60, state); };
      update();
      return { sound, state, calls, update };
    }
    const chimes = f => f.calls.filter(c => c.name === 'chime');
    for (const music of ['still', 'lines', 'boats', 'meadow', 'birches', 'drowned', 'wood', 'sea', 'mirror', 'home']) {
      for (const input of [{ gust: tuning.pointer.minGust + 0.01 }, { charge: tuning.pointer.minLift + 0.001 }, { gliderLift: 1 }]) {
        const startingIsland = music === 'still', forestWind = music === 'wood';
        check((chimes(fixture({ music, startingIsland, forestWind, hush: 1, ...input })).length > 0) === (startingIsland || forestWind), `${music}: ${Object.keys(input)[0]} chimes only on the starting island or forest`);
        check(chimes(fixture({ music, startingIsland: false, ...input })).length === 0, `${music}: music alone cannot enable gesture chimes`);
      }
    }
    for (const input of [{ gust: 26 }, { charge: 1 }, { gliderLift: 1 }]) {
      for (const exception of [{ piano: 1 }, { pianoActive: true, piano: 0 }, { scripted: true }, { silence: true }]) {
        check(chimes(fixture({ ...input, ...exception })).length === 0, `${Object.keys(input)[0]} respects ${Object.keys(exception)[0]}`);
      }
    }
    check(chimes(fixture({ gust: 5, pianoActive: false, piano: 0.8 })).length > 0, 'piano fade cannot mute newly playable wind');
    check(chimes(fixture({ gust: tuning.pointer.minGust, charge: tuning.pointer.minLift })).length === 0, 'no chime below either wind threshold');
    check(chimes(fixture({ gust: 1 }, 0.001)).length === 1, 'first gust responds immediately after audio starts');
    check(chimes(fixture({ charge: 0.02 }, 0.001)).length === 1, 'first small updraft responds immediately after audio starts');
    const opening = fixture({ gust: 26, charge: 1 });
    const later = fixture({ startingIsland: false, gust: 26, charge: 1 });
    for (const name of ['gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
      check(Math.abs(20 * Math.log10(later.sound[name].gain.value / opening.sound[name].gain.value) + 3) < 1e-9,
        `${name}: player wind is 3 dB softer after departure`);
    }
    for (const name of ['breezeGain', 'rainGain', 'patterGain', 'seaGain']) {
      check(later.sound[name].gain.value === opening.sound[name].gain.value, `${name}: ambient level is unchanged`);
    }
    for (const gust of [0, 3]) {
      const before = fixture({ gust, winterGust: 1 });
      const after = fixture({ startingIsland: false, gust, winterGust: 1 });
      for (const name of ['gustGain', 'whistleGain', 'rustleGain']) {
        check(before.sound[name].gain.value === after.sound[name].gain.value, `${name}: winter weather floor is preserved at gust ${gust}`);
      }
    }
    for (const wind of [opening, later]) {
      for (const [name, ceiling] of [['gustFilter', 1140], ['whistleFilter', 1620], ['liftFilter', 1420]]) {
        check(wind.sound[name].frequency.value === ceiling, `${name}: cursor wind has a lower maximum frequency in both chapters`);
      }
    }
    const weather = fixture({ startingIsland: false, winterGust: 1 });
    check(weather.sound.gustFilter.frequency.value === 260 + .76 * 1100
      && weather.sound.whistleFilter.frequency.value === 900 + .76 * 900, 'weather filter response is unchanged');
    const openingChime = chimes(fixture({ gust: 26 }))[0].args;
    const forestChime = chimes(fixture({ startingIsland: false, forestWind: true, music: 'wood', gust: 26 }))[0].args;
    const rescueChime = chimes(fixture({ startingIsland: false, forestWind: true, music: 'wood', caringWind: true, gust: 26 }))[0].args;
    check(openingChime[1] === forestChime[1] && Math.abs(20 * Math.log10(tuning.audio.gestureLevel / .7) - 6) < 1e-9,
      'opening and forest chimes both gain 6 dB');
    check(rescueChime[1] < forestChime[1] / 2 && rescueChime[5], 'forest rescue keeps its softer chime');
    const habitat = overrides => fixture({ night: 1, ...overrides }).calls.filter(c => c.name === 'cricket' || c.name === 'owl');
    check(habitat({ land: 0, sea: 1 }).length === 0, 'no land wildlife on open sea');
    check(habitat({ cold: 1 }).length === 0, 'no land wildlife on frozen ground');
    check(habitat({ shower: 1 }).length === 0, 'no land wildlife through the storm');
    check(habitat({ music: 'home', land: 1, cold: 0, overLand: false }).length === 2, 'dry home night retains wildlife independently of pointer position');
    const cygnet = { active: true, pan: -0.7, distance: 42 };
    const flock = { active: true, pan: 0.6, distance: 100 };
    const f = fixture({ cues: ['calling'], cygnet, flock });
    check(f.calls.find(c => c.name === 'peep').args[2] === cygnet, 'authored cygnet call receives its real emitter');
    check(!f.calls.some(c => c.name === 'bugle'), 'incidental flock cannot start alongside an authored call');
    f.calls.length = 0; f.update(93, { cues: [] });
    check(!f.calls.some(c => c.name === 'bugle'), 'incidental flock leaves the call its breathing room');
    f.update(95);
    check(f.calls.find(c => c.name === 'bugle').args[0] === flock, 'incidental flock resumes through the same positioned voice');
    const authored = fixture({ cues: ['bugle'], flock });
    check(authored.calls.filter(c => c.name === 'bugle').length === 1, 'authored flock call does not double with its incidental scheduler');
    check(!fixture({ flock, flockChatter: false }).calls.some(c => c.name === 'bugle'), 'authored conversation preserves its intentional pauses');
    check(fixture({ flock, flockChatter: false, cues: ['bugle'] }).calls.some(c => c.name === 'bugle'), 'conversation still plays the authored adult response');

    const { HomeChapter } = await import('/src/story/home.ts');
    const { SleepingChapter } = await import('/src/story/sleeping.ts');
    const { WoodChapter } = await import('/src/story/wood.ts');
    const cues = await productionModule('/src/story/cues.ts');
    const endingSounds = tuning.audio.homeEndingSounds;
    for (const enabled of [false, true]) {
      tuning.audio.homeEndingSounds = enabled;
      for (const fps of [10, 30, 60, 120, 144]) {
        const home = { beat: 'inside', silence: false, t: 0, sky: { set() {} },
          cast: { child: { position: { x: 0, y: 0, z: 0 } }, plane: {}, drawing: {}, cottage: {} } };
        cues.takeCues();
        let count = 0;
        for (let time = 1.91; time < 2.5; time += 1 / fps) {
          home.t = time; HomeChapter.prototype.updateEnding.call(home, 1 / fps);
          count += cues.takeCues().filter(c => c === 'finale').length;
        }
        check(count === Number(enabled), `finale ${enabled ? 'schedules once' : 'stays disabled'} at ${fps} Hz`);
      }
    }
    tuning.audio.homeEndingSounds = endingSounds;
    const morning = Object.assign(Object.create(SleepingChapter.prototype), {
      music: 'wood', hush: 0.5, now: 0, laneFrom: null, laneTo: null, seat: null,
      cast: { child: { stop() {}, walkTo() {} }, cygnet: { watch() {} },
        boat: { boardingPoint() { return { x: 0, z: 0 }; } }, sleeping: { trail: {}, ribbon: {}, hearth: { extinguish() {} }, lane() {} } },
    });
    cues.takeCues(); morning.restoreCheckpoint('morning');
    check(morning.music === 'sea' && morning.hush === 0.1 && morning.cast.sleeping.dawn === 1, 'morning checkpoint restores its musical phase');
    check(cues.takeCues().length === 0, 'morning restore never replays a reward');
    const wood = Object.assign(Object.create(WoodChapter.prototype), { beat: 'lost', now: 12, hearth: {}, ahead: null });
    check(wood.caringWind, 'rescue ember enables caring wind');
    wood.cast = { embers: { takeCaught: () => [wood.hearth] } }; wood.caught();
    check(cues.takeCues().join() === 'comfort', 'rescue ember catches with the caring cue');
    wood.beat = 'walk'; wood.cast.embers.takeCaught = () => [{}]; wood.caught();
    check(!wood.caringWind && cues.takeCues().join() === 'kindled', 'ordinary wood embers retain their normal response');

    const { PianoStop } = await import('/src/story/piano.ts');
    const { piano } = await productionModule('/src/world/piano.ts');
    piano.now = 10;
    const stop = new PianoStop();
    stop.now = 10; stop.releaseHands = () => {};
    let completed = 0, woke = 0;
    stop.onComplete = () => completed++;
    stop.onWake = stage => { if (stage === 4) woke++; };
    stop.finish({ carry: { unstow() {} } }, true);
    const lastPianoNote = Math.max(...piano.queue.filter(n => n.active).map(n => n.at));
    stop.wakeIsland(10 + tuning.piano.finaleWaveAfter);
    check(woke === 1 && completed === 0, 'meadow begins waking without a competing completion phrase');
    stop.wakeIsland(lastPianoNote);
    check(completed === 0, 'completion waits for every lullaby note');
    stop.wakeIsland(stop.completeAt); stop.wakeIsland(lastPianoNote + 8);
    check(completed === 1, 'completion follows the lullaby once');
    stop.completeAt = 30; stop.restoreDone(); stop.wakeIsland(40);
    check(completed === 1, 'piano checkpoint restore cancels a pending completion');
    const phraseNotes = [];
    const phrase = { ctx: { currentTime: 10 }, nextPulse: () => 10, chime: (...args) => phraseNotes.push(args) };
    audioModule.Soundscape.prototype.phrase.call(phrase, 'feather');
    check(phraseNotes.length === 2 && phraseNotes.at(-1)[0] === 69, 'feather has a small open-ended hint');
    phraseNotes.length = 0; audioModule.Soundscape.prototype.phrase.call(phrase, 'lifted');
    check(phraseNotes.length === 9, 'brave flight keeps the complete lifted phrase');

    const { AudioEnvironment, shoreDistance } = await import('/src/audio/environment.ts');
    const island = (offset = 0) => (x, z) => 80 - Math.hypot(x - offset, z - offset);
    check(shoreDistance(0, 0, island()) === shoreDistance(5000, 5000, island(5000)), 'shore mix follows local geography after travelling between islands');
    let samples = 0;
    const env = new AudioEnvironment((x, z) => { samples++; return island()(x, z); });
    env.update(1 / 60, 0, 0, 'meadow');
    check(env.land === 1 && env.sea < 1 && env.meadow === 1, 'meadow interior has land and local shoreline weights');
    samples = 0; env.update(1 / 60, 0, 0, 'birches');
    check(samples === 1 && env.meadow === 0, 'stationary shoreline is cached and other islands are not meadow');
    env.update(1 / 60, 500, 500, 'toMirror');
    check(env.land === 0 && env.sea === 1 && env.meadow === 0, 'travel to open water refreshes habitat immediately');

    const THREE = await import('/node_modules/three/build/three.module.js');
    const { WorldFoley } = await import('/src/audio/world-foley.ts');
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.updateMatrixWorld();
    const sounds = [], world = new WorldFoley({ material: (...args) => sounds.push(args) }, camera);
    const object = {}, at = new THREE.Vector3(5, 0, -10);
    world.motion(object, 'paper', at, 0.8, 0.1, true);
    check(sounds.length === 0, 'restored partially opened paper establishes a silent baseline');
    world.update(0.3); world.motion(object, 'paper', at, 0.8, 0.1, true);
    check(sounds.length === 0, 'stationary material stays quiet');
    world.update(0.3); world.motion(object, 'paper', at, 0.9, 0.1, true);
    check(sounds.length === 1 && sounds[0][0] === 'paper' && sounds[0][2] > 0, 'paper movement produces positioned material sound');
    world.update(0.3); world.motion(object, 'paper', at, 1, 0.1, false);
    world.update(0.3); world.motion(object, 'paper', at, 0, 0.1, true);
    check(sounds.length === 1, 'mute/resume never replays material progress');
    const far = at.clone().multiplyScalar(100);
    world.update(0.3); world.motion(object, 'paper', far, 0.1, 0.1, true);
    check(sounds.length === 1, 'distant materials are inaudible');
    for (let i = 0; i < 120; i++) {
      world.update(1 / 60); world.flow(object, 'sail', at, 1, true);
    }
    check(sounds.length === 1, 'sustained sail flutter never becomes repeated flaps');
    world.update(3); world.flow(object, 'sail', at, 0, true);
    world.update(.1); world.flow(object, 'sail', at, 1, true);
    check(sounds.length === 2 && sounds.at(-1)[0] === 'sail', 'a fresh sail-tension change makes one restrained sound');
    for (const fps of [10, 30, 60, 144]) {
      const folds = [], sail = {}, settle = new WorldFoley({ material: (...args) => folds.push(args) }, camera);
      const frame = (droop, active = true, position = at) => {
        settle.update(1 / fps); settle.sailSettles(sail, position, droop, active);
      };
      frame(1);
      check(folds.length === 0, `${fps} Hz: entering with a slack sail is silent`);
      for (let i = 0; i <= fps * 2; i++) frame(i / (fps * 2));
      check(folds.length === 1 && folds[0][0] === 'sail-settle' && folds[0][2] > 0,
        `${fps} Hz: reaching full droop emits one positioned canvas fold`);
      for (let i = 0; i < fps * 5; i++) frame(i % 2 ? 1 : 0.99);
      check(folds.length === 1, `${fps} Hz: hanging and threshold jitter cannot repeat the fold`);
      frame(0); frame(1);
      check(folds.length === 2, `${fps} Hz: a refill allows another full-droop sound`);
      frame(0); frame(1);
      for (let i = 0; i < fps * 3; i++) frame(1);
      check(folds.length === 2, `${fps} Hz: cooldown arrivals expire instead of playing later`);
      frame(0); frame(1, false); frame(1);
      check(folds.length === 2, `${fps} Hz: a muted droop cannot replay on resume`);
      frame(0); frame(1, true, far);
      for (let i = 0; i < fps * 3; i++) frame(1);
      check(folds.length === 2, `${fps} Hz: an inaudible droop cannot replay on approach`);
    }
    const before = sounds.length;
    world.splash(at, 1); world.splash(at, 1); world.splash(far, 1);
    check(sounds.length === before + 1, 'dolphin splashes are distance gated and rate limited');
    sounds.length = 0;
    const sheets = Array.from({ length: 12 }, (_, i) => new THREE.Vector3(i, 0, -10));
    const wind = { calm: 1, sample: (_x, _z, out) => Object.assign(out, { x: 0, z: 0, energy: 0, lift: 0 }) };
    for (let i = 0; i < 60; i++) { world.update(1 / 60); world.cloth(sheets, wind, 1 / 60, true); }
    check(sounds.length === 0, 'still laundry is quiet');
    wind.sample = (_x, _z, out) => Object.assign(out, { x: 20, z: 0, energy: 1, lift: 0 });
    for (let i = 0; i < 120; i++) { world.update(1 / 60); world.cloth(sheets, wind, 1 / 60, true); }
    check(sounds.length > 0 && sounds.length <= 30, 'gusts move the laundry sound, limited to three nearby sources');
    return passed;
  });
  const render = await page.evaluate(async () => {
    const { Foley } = await import('/src/audio/foley.ts');
    const results = [];
    for (const name of ['normal', 'care', 'materials', 'busy', 'gesture']) {
      // Compare the two chime envelopes through the same noise and reverb realization.
      let seed = 926417;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      const { ctx, sound } = offlineSound(8);
      sound.master.gain.cancelScheduledValues(0); sound.master.gain.value = 0.9;
      const foley = new Foley(); foley.setOutput(sound.output);
      if (name === 'normal' || name === 'care' || name === 'gesture') {
        const { tuning } = await productionModule('/src/tuning.ts');
        sound.chime(74, name === 'care' ? tuning.audio.careChimeLevel : 1, -0.75, 0.1, 2.2, name === 'care', name === 'gesture');
      } else {
        for (const kind of ['cloth', 'wool', 'sail', 'sail-settle', 'water', 'paper', 'door', 'splash']) foley.material(kind, 1, 0.5);
        if (name === 'busy') {
          sound.update(1 / 60, { ...baseState, gust: 26, charge: 1, gliderLift: 1, shower: 1, cues: ['finale', 'distress'], cygnet: { active: true, pan: -0.8, distance: 10 } });
          sound.thunder(1, 0.5, true);
        }
      }
      const buffer = await ctx.startRendering();
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let lp = 0, rp = 0;
      for (let i = 0; i < 24000; i++) { lp += left[i] ** 2; rp += right[i] ** 2; }
      results.push({ name, leftPower: lp, rightPower: rp, ...encodeAudio(buffer) });
    }
    return results;
  });
  const tail = await page.evaluate(async () => {
    const { ctx, sound } = offlineSound(29);
    let finale = false;
    const update = () => {
      const now = ctx.currentTime;
      sound.update(0.125, { ...baseState, music: 'home', night: 1, land: 0, scripted: true,
        silence: now >= 23.5, cues: now >= 2 && !finale ? ['finale'] : [] });
      if (now >= 2) finale = true;
      // Isolate music at the production cut and credit times, retaining its actual reverb path.
      for (const key of ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
        sound[key].gain.cancelScheduledValues(now); sound[key].gain.value = 0;
      }
    };
    update();
    let pause = ctx.suspend(0.125);
    const rendering = ctx.startRendering();
    for (let at = 0.125; at < 29; at += 0.125) {
      await pause; update();
      if (at + 0.125 < 29) pause = ctx.suspend(at + 0.125);
      await ctx.resume();
    }
    const buffer = await rendering;
    const windows = [22, 24, 26, 27, 28].map(start => {
      let energy = 0;
      for (let ch = 0; ch < 2; ch++) for (let i = start * 24000; i < (start + 1) * 24000; i++) energy += buffer.getChannelData(ch)[i] ** 2;
      return { start, rmsDbFS: 10 * Math.log10(energy / 48000) };
    });
    return { name: 'finale-cut', windows, ...encodeAudio(buffer) };
  });
  render.push(tail);
  for (const clip of render) {
    assert.equal(clip.clipped, 0, `${clip.name}: no digital clipping`);
    assert(clip.peakDbFS > -60, `${clip.name}: output is audible`);
  }
  assert(render[1].rmsDbFS < render[0].rmsDbFS - 8,
    `caring chime remains meaningfully quieter in rendered audio: normal ${render[0].rmsDbFS.toFixed(2)} dBFS, care ${render[1].rmsDbFS.toFixed(2)} dBFS`);
  assert(render[0].leftPower > render[0].rightPower * 2, 'source panning survives the output graph');
  const dir = '/tmp/updraft-audio-check'; fs.mkdirSync(dir, { recursive: true });
  const metrics = render.map(({ pcm, ...clip }) => {
    fs.writeFileSync(`${dir}/${clip.name}.wav`, wav(Buffer.from(pcm, 'base64')));
    return clip;
  });
  fs.writeFileSync(`${dir}/checks.json`, JSON.stringify({ checks, metrics }, null, 2));
  console.log(`${checks.length} scheduling, story, habitat and material checks passed; ${render.length} audio renders passed. Evidence: ${dir}/checks.json`);
  console.log(JSON.stringify(tail.windows));
} finally { await browser.close(); }
