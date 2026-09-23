// Production departure/arrival routing, sail transients, loop seams and mix headroom; no game/GPU.
// node tools/audio-continuity-check.mjs (Vite on 5230).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';
const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { Journey } = await import('/src/story/journey.ts');
    const { LinesChapter } = await import('/src/story/lines.ts');
    const { MeadowChapter } = await import('/src/story/meadow.ts');
    const { BirchesChapter } = await import('/src/story/birches.ts');
    const { WorldFoley } = await import('/src/audio/world-foley.ts');
    const { ARRIVAL_MUSIC } = await import('/src/audio/arrival-music.ts');
    const checks = [], renders = [];
    const check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const phase = (C, key, state) => Object.getOwnPropertyDescriptor(C.prototype, key).get.call(state);
    const cases = [
      ['toLines', { music: 'still', hush: 0 }],
      ['toBoats', { music: 'lines', linesScore: phase(LinesChapter, 'linesScore', { beat: 'aboard' }), hush: 0 }],
      ['toMeadow', { music: 'boats', hush: .28 }],
      ['toBirches', { music: 'meadow', meadowScore: phase(MeadowChapter, 'meadowScore', { beat: 'aboard', piano: { at: 'done' } }), hush: 0 }],
      ['drowned', { music: 'birches', birchesScore: phase(BirchesChapter, 'birchesScore', { beat: 'aboard' }), hush: 0 }],
      ['toSleeping', { music: 'wood', hush: .55 }],
      ['toHarbour', { music: 'mirror', hush: .5 }],
    ];
    const cast = { boat: { position: new THREE.Vector3(), sailSide: 1 }, plane: {},
      cygnet: { wing: { restore() {} } },
      // Journey.make('toHarbour') restores any unfound stars before departure; four stars, all found here.
      skyMirror: { progress: 3, stars: [{}, {}, {}, {}], restore() {} } };
    const currentScore = sound => sound.linesScore ?? sound.boatsScore ?? sound.meadowScore ?? sound.birchesScore ?? sound.sleepingScore;
    for (const [name, outgoing] of cases) {
      let seed = 98765;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      const chapter = Journey.prototype.make.call({ cast }, name);
      const sailing = { music: chapter.music, hush: chapter.hush ?? 0, linesScore: chapter.linesScore, meadowScore: chapter.meadowScore };
      const target = name === 'drowned' ? chapter.arrivalMusic : chapter.destinationMusic;
      const { ctx, sound } = offlineSound(36);
      const gateTrace = [];
      let carried, epoch;
      const update = tick => {
        const now = tick / 8;
        // Depart at 10; request the next island at 20 (Drowned requests on departure).
        const handoff = name === 'drowned' ? 10 : 20;
        const state = now < 10 ? outgoing : now < 28 ? sailing : ARRIVAL_MUSIC[target];
        sound.update(.125, { ...baseState, land: 0, ...state,
          arrivalMusic: now >= handoff && now < 28 ? target : undefined });
        if (now === 9) { carried = currentScore(sound); epoch = carried?.current?.epoch ?? carried?.epoch; }
        if (now === 12 && name !== 'drowned') {
          check(currentScore(sound) === carried, `${name}: departure retains the same score instance`);
          check((carried?.current?.epoch ?? carried?.epoch) === epoch, `${name}: departure keeps the phrase clock`);
          check(sound.mood === outgoing.music, `${name}: no unrelated sailing music`);
          check(sound.arrivalTransition.last.hush === outgoing.hush, `${name}: departure keeps its music level`);
        }
        if (now === 10 && name === 'drowned') check(currentScore(sound) === carried, 'Birches survives into Drowned’s outgoing fade');
        gateTrace.push({ time: now, gain: sound.backgroundGate.gain.value });
      };
      update(0); let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
      for (let tick = 1; tick < 36 * 8; tick++) {
        await pause; update(tick);
        if (tick + 1 < 36 * 8) pause = ctx.suspend((tick + 1) / 8);
        await ctx.resume();
      }
      const buffer = await rendering, encoded = encodeAudio(buffer);
      check(encoded.clipped === 0 && encoded.peakDbFS < -3, `${name}: rendered mix has at least 3 dB headroom`);
      check(gateTrace.every((p, i) => !i || Math.abs(p.gain - gateTrace[i - 1].gain) < .09), `${name}: the arrival gate ramps without steps`);
      renders.push({ name, peakDbFS: encoded.peakDbFS, rmsDbFS: encoded.rmsDbFS, clipped: encoded.clipped,
        ...(name === 'toBirches' ? { pcm: encoded.pcm } : {}) });
    }
    // A held gain needs an explicit release anchor too: Sleeping formerly lost 83% at once.
    for (const [music, key, first, next] of [
      ['wood','sleepingScore','shelter','climb'], ['lines','linesScore','first','second'],
      ['meadow','meadowScore','walk','flock'], ['birches','birchesScore','walk','scarf'],
      ['sea','seaScore','open','swim'], ['boats','boatsScore',null,null],
    ]) {
      const { ctx, sound } = offlineSound(11);
      let oldGain, retired, before, during, ended;
      const update = tick => {
        const t = tick / 8;
        if (t === 8) {
          const score = sound[key];
          retired = key === 'boatsScore' ? score : score.current;
          oldGain = key === 'boatsScore' ? score.bus.gain
            : (score.current.bus ?? score.current.out.bus).gain;
          before = oldGain.value;
        }
        sound.update(.125, { ...baseState, music: key === 'boatsScore' && t >= 8 ? 'still' : music,
          ...(first ? { [key]: t < 8 ? first : next } : {}) });
        if (t === 8.125) during = oldGain.value;
        if (t === 10) ended = oldGain.value;
      };
      update(0); let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
      for (let tick = 1; tick < 11 * 8; tick++) {
        await pause; update(tick);
        if (tick + 1 < 11 * 8) pause = ctx.suspend((tick + 1) / 8);
        await ctx.resume();
      }
      await rendering;
      check(during / before > (key === 'boatsScore' ? .88 : .92), `${key}: retirement starts from the current level without a volume drop`);
      check(ended === 0 || retired.voices.size === 0, `${key}: retirement reaches silence or disconnects all voices on time`);
    }
    // Stationary/sustained flutter, real gusts, cooldown, distance and mute/resume at varied frame rates.
    for (const fps of [10, 30, 60, 144]) {
      const sounds = [], camera = new THREE.PerspectiveCamera(); camera.updateMatrixWorld();
      const world = new WorldFoley({ material: (...args) => sounds.push({ at: world.time, args }) }, camera);
      const source = {}, at = new THREE.Vector3(0, 0, -10);
      for (let tick = 0; tick < fps * 20; tick++) {
        const t = tick / fps;
        world.update(1 / fps);
        const strength = t < 5 ? .65 : t < 6 ? 0 : t < 12 ? .65 : t < 13 ? 0 : .65;
        world.flow(source, 'sail', at, strength, !(t >= 12 && t < 14));
      }
      check(sounds.length === 1 && sounds[0].at >= 6 && sounds[0].at < 6.2, `${fps} Hz: one fresh gust, no sustained or resumed flapping`);
      world.update(3); world.flow(source, 'sail', at, 0, true);
      world.update(.1); world.flow(source, 'sail', at.clone().multiplyScalar(100), .65, true);
      world.update(3); world.flow(source, 'sail', at, .65, true);
      check(sounds.length === 1, `${fps} Hz: distant gusts expire instead of replaying nearby`);
    }
    const { ctx, sound } = offlineSound(5);
    const buffer = sound.noise, overlap = Math.floor(buffer.sampleRate * .04);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      check(data.at(-1) === data[overlap - 1], `Noise channel ${ch}: loop seam continues an adjacent sample`);
    }
    // Inspect the actual target, independent of the foreground chimes' extra loudness.
    const targets = [], gain = sound.padGain.gain;
    const setTarget = gain.setTargetAtTime.bind(gain);
    gain.setTargetAtTime = (value, ...args) => { targets.push(value); return setTarget(value, ...args); };
    sound.activity = 0; sound.update(0, { ...baseState, music: 'still' });
    sound.activity = 1; sound.update(0, { ...baseState, music: 'still', gust: 26 });
    const swellDb = 20 * Math.log10(targets[1] / targets[0]);
    check(swellDb > 0 && swellDb < 2.1, 'Full wind warms the daylight pad by at most 2.1 dB');
    // Check that short voices disconnect their entire graph once finished.
    const live = new Set();
    for (const method of ['createGain', 'createOscillator', 'createStereoPanner', 'createBiquadFilter', 'createBufferSource']) {
      const create = ctx[method].bind(ctx);
      ctx[method] = (...args) => {
        const node = create(...args), connect = node.connect.bind(node), disconnect = node.disconnect.bind(node);
        node.connect = (...a) => { live.add(node); return connect(...a); };
        node.disconnect = (...a) => { live.delete(node); return disconnect(...a); };
        return node;
      };
    }
    sound.chime(74, .6, 0, .1); sound.tone(400, 380, .1, .2, .02, 0, .2);
    sound.flare(); sound.peep(.5, true); sound.bugle({ active: true, distance: 30, pan: 0 });
    await ctx.startRendering();
    check(live.size === 0, 'Chimes, wildlife, calls and ember sounds disconnect all finished nodes');
    return { checks, swellDb, renders };
  });
  assert(result.checks.length > 40);
  for (const render of result.renders) if (render.pcm) {
    fs.writeFileSync('/tmp/updraft-meadow-birches-continuity.wav', wav(Buffer.from(render.pcm, 'base64')));
    delete render.pcm;
  }
  fs.writeFileSync('/tmp/updraft-audio-continuity.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ checks: result.checks.length, swellDb: result.swellDb, renders: result.renders }));
} finally { await browser.close(); }
