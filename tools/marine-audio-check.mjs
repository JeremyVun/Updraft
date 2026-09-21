// Actual surfacing events and production foley, without a GPU. Requires the Vite dev server.
// Usage: node tools/marine-audio-check.mjs; evidence and an isolated audition go to /tmp.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const report = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { SeaLife } = await import('/src/fx/sealife.ts');
    const { WorldFoley } = await import('/src/audio/world-foley.ts');
    const { Foley } = await import('/src/audio/foley.ts');
    let seed = 147;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const checks = [], whales = [], dolphins = [];
    const check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000);
    camera.position.set(0, 8, 12); camera.lookAt(0, 0, -60); camera.updateMatrixWorld();
    const wind = { breeze: new THREE.Vector2(2, -0.8), sample(_x, _z, out) {
      return Object.assign(out, { x: 2, z: -0.8, energy: 0, lift: 0 });
    } };
    const sequence = ['whale-surface', 'whale-blow', 'whale-blow', 'whale-drain', 'whale-dive'];
    for (const fps of [10, 30, 60, 144]) {
      const life = new SeaLife(wind, camera), events = [];
      life.onWhaleSound = (kind, x, y, z) => events.push({ kind, at: life.body.time, x, y, z });
      life.update(1 / fps, 0);
      check(!events.length, `${fps} Hz: inactive whale stays silent`);
      for (let pass = 0; pass < 2; pass++) {
        events.length = 0;
        life.surfaceWhale(new THREE.Vector3(12, 0, -60), Math.PI);
        for (let i = 0; i < fps * 32; i++) life.update(1 / fps, pass * 40 + i / fps);
        check(events.map(e => e.kind).join() === sequence.join(), `${fps} Hz pass ${pass}: one surface, two breaths, tail drain and dive`);
        check(events.every(e => [e.x, e.y, e.z].every(Number.isFinite)), `${fps} Hz pass ${pass}: finite body positions`);
        check(events.filter(e => e.kind === 'whale-blow').every(e => e.y > 0.05), `${fps} Hz pass ${pass}: breath follows visible blowhole`);
      }
      whales.push({ fps, events: [...events] });

      let rises = 0, falls = 0;
      const boat = new THREE.Vector3();
      life.onDolphinSurface = (x, y, z, strength) => {
        const d = life.pod.pod.find(d => d.x === x && d.z === z);
        if (!d || d.wasUp || d.surface !== y || strength <= 0) throw Error('Dolphin surface differs from its spray event');
        rises++;
      };
      life.onDolphinSplash = (x, y, z, strength) => {
        const d = life.pod.pod.find(d => d.x === x && d.z === z);
        if (!d || d.wasIn || d.vy >= -1.4 || d.surface !== y || strength <= 0) throw Error('Dolphin splash differs from its water entry');
        falls++;
      };
      for (let i = 0; i < fps * 45; i++) {
        boat.z = -i / fps * 3;
        life.dolphinsWith(boat, Math.PI);
        life.update(1 / fps, 100 + i / fps);
      }
      check(rises > 5 && falls > 0, `${fps} Hz: swimming pod emits both emergence (${rises}) and re-entry (${falls})`);
      dolphins.push({ fps, rises, falls });
    }

    const calls = [], world = new WorldFoley({ material: (...args) => calls.push(args) }, camera);
    const near = new THREE.Vector3(8, 0, -20), far = new THREE.Vector3(0, 0, -1000);
    world.splash(near, 1, true); world.splash(near, 1, true); world.splash(near, 1);
    check(calls.length === 2, 'Pod emergence is bounded without suppressing its landing');
    world.update(0.2); world.splash(near, 1, true); world.splash(near, 1);
    check(calls.length === 2, 'Closely spaced pod arcs cannot stack splash attacks');
    world.update(0.41); world.splash(near, 1, true);
    check(calls.length === 3, 'Dolphin emergence re-arms after its brief spacing');
    world.splash(far, 1, true); world.whale('whale-blow', far);
    check(calls.length === 3, 'Distant marine events stay inaudible');
    world.whale('whale-blow', near);
    const close = calls.at(-1);
    world.whale('whale-blow', new THREE.Vector3(8, 0, -110));
    check(calls.at(-1)[1] > 0 && calls.at(-1)[1] < close[1], 'Whale breath attenuates across the water');
    check(close[2] > 0, 'Whale pans toward its visible source');

    const renders = [];
    for (const kind of ['dolphin-surface', 'splash', ...new Set(sequence)]) {
      const { ctx, sound } = offlineSound(4);
      sound.master.gain.cancelScheduledValues(0); sound.master.gain.value = 0.9;
      const foley = new Foley(); foley.setOutput(sound.output);
      // No environment/score update: only this one production foley voice is scheduled.
      let created = 0, disconnected = 0;
      const make = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = () => {
        created++;
        const node = make(), disconnect = node.disconnect.bind(node);
        node.disconnect = (...args) => { disconnected++; return disconnect(...args); };
        return node;
      };
      foley.material(kind, 1, 0.65);
      const count = created;
      foley.setOutput(null); foley.material(kind, 1, 0);
      check(created === count, `${kind}: no output means no queued voice`);
      const buffer = await ctx.startRendering();
      check(created > 0 && disconnected === created, `${kind}: every finished noise source disconnects`);
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let l = 0, r = 0;
      for (let i = 0; i < 24000; i++) { l += left[i] ** 2; r += right[i] ** 2; }
      check(r > l * 1.5, `${kind}: stereo output follows the emitter`);
      const { pcm: _pcm, ...metrics } = encodeAudio(buffer);
      renders.push({ kind, ...metrics });
    }

    // Preschedule the real whale timing, then two dolphin arcs. No normalization: game foley gain.
    const { ctx, sound } = offlineSound(36);
    const foley = new Foley(); foley.setOutput(sound.output);
    const audition = whales.find(w => w.fps === 60).events.map(e => ({ at: e.at, kind: e.kind }));
    audition.push({ at: 30, kind: 'dolphin-surface' }, { at: 30.7, kind: 'splash' },
      { at: 32.7, kind: 'dolphin-surface' }, { at: 33.5, kind: 'splash' });
    for (const event of audition) {
      Object.defineProperty(ctx, 'currentTime', { configurable: true, value: event.at });
      foley.material(event.kind, 1, event.at < 29 ? -0.25 : 0.3);
    }
    delete ctx.currentTime;
    return { checks, whales, dolphins, renders, audition: encodeAudio(await ctx.startRendering()) };
  });
  for (const clip of [...report.renders, report.audition]) {
    assert.equal(clip.clipped, 0, 'No digital clipping');
    assert(Number.isFinite(clip.peakDbFS) && clip.peakDbFS > -60, 'Finite audible output');
    assert(clip.peakDbFS < -18, 'Restrained foley cannot contain a full-level onset spike');
  }
  fs.writeFileSync('/tmp/updraft-marine-audio.wav', wav(Buffer.from(report.audition.pcm, 'base64')));
  delete report.audition.pcm;
  fs.writeFileSync('/tmp/updraft-marine-audio.json', JSON.stringify(report, null, 2));
  console.log(`${report.checks.length} marine checks and 7 offline renders passed. /tmp/updraft-marine-audio.json`);
  console.log(JSON.stringify(report.renders));
} finally { await browser.close(); }
