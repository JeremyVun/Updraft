import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const report = await page.evaluate(async () => {
    const { Foley } = await productionModule('/src/audio/foley.ts');
    const { WorldFoley } = await productionModule('/src/audio/world-foley.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const THREE = await import('/node_modules/three/build/three.module.js');
    const camera = new THREE.PerspectiveCamera(40, 1.6, .1, 1000);
    camera.position.set(0, 2, 10); camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
    const calls = [], spatial = new WorldFoley({ material: (...args) => calls.push(args) }, camera);
    spatial.knock('rotary-creak', new THREE.Vector3(3, 2, 0), tuning.rotaryWashing.creakLevel);
    spatial.knock('rotary-creak', new THREE.Vector3(0, 2, -200), tuning.rotaryWashing.creakLevel);
    if (calls.length !== 1 || calls[0][2] <= 0) throw Error('The creak must follow its bearing and attenuate with distance');

    const { ctx, sound } = offlineSound(2.5);
    sound.master.gain.cancelScheduledValues(0); sound.master.gain.value = .9;
    const foley = new Foley(); foley.setOutput(sound.output);
    const nodes = [], sources = [];
    for (const factory of ['createOscillator', 'createBufferSource', 'createGain', 'createBiquadFilter', 'createStereoPanner']) {
      const create = ctx[factory].bind(ctx);
      ctx[factory] = () => {
        const node = create(), disconnect = node.disconnect.bind(node);
        const state = { disconnected: false }; nodes.push(state);
        node.disconnect = (...args) => { state.disconnected = true; return disconnect(...args); };
        if (node.start) sources.push(node);
        return node;
      };
    }
    foley.material('rotary-creak', tuning.rotaryWashing.creakLevel, -.3);
    const made = nodes.length;
    foley.setOutput(null); foley.material('rotary-creak', 1, 0);
    if (nodes.length !== made) throw Error('Muted creaks must not queue');
    const second = ctx.suspend(1.2).then(async () => {
      foley.setOutput(sound.output);
      foley.material('rotary-creak', tuning.rotaryWashing.creakLevel, .3);
      await ctx.resume();
    });
    const buffer = await ctx.startRendering();
    await second;
    if (sources.length !== 2 || nodes.some(n => !n.disconnected)) throw Error('Both generated creaks must disconnect after playing');
    if (sources[0].buffer === sources[1].buffer) throw Error('The two bearings use different generated variations');
    return { ...encodeAudio(buffer), sources: sources.length, nodes: nodes.length, disconnected: nodes.filter(n => n.disconnected).length };
  });
  assert.equal(report.clipped, 0);
  assert(report.peakDbFS < -19 && report.peakDbFS > -32, `Bearing creak headroom and level: ${report.peakDbFS} dBFS`);
  fs.writeFileSync('/tmp/updraft-rotary-procedural-creaks.wav', wav(Buffer.from(report.pcm, 'base64')));
  delete report.pcm;
  console.log(JSON.stringify(report));

  const cache = await page.evaluate(async mutateCache => {
    const { RotaryCreak } = await productionModule('/src/audio/rotary-creak.ts');
    const voice = new RotaryCreak();
    if (mutateCache) voice.buffers.get = () => undefined;
    const buffers = [];
    for (const rate of [24000, 48000]) {
      const ctx = new OfflineAudioContext(2, rate, rate);
      const out = { ctx, bus: ctx.destination, reverb: ctx.createGain() };
      const used = [], make = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = () => { const source = make(); used.push(source); return source; };
      const prepared = voice.prepare(ctx);
      if (used.length) throw Error('Preparing generated buffers must stay silent');
      voice.play(out, .01, .1, 0); voice.play(out, .02, .1, 0); voice.play(out, .03, .1, 0);
      if (used.length !== 3 || !prepared.includes(used[0].buffer) || used[0].buffer === used[1].buffer || used[0].buffer !== used[2].buffer) {
        throw Error('First playback is immediate and generated variations reuse their prepared buffers');
      }
      if (buffers.some(buffer => used.some(source => source.buffer === buffer))) throw Error('Replacement context needs its own buffers');
      for (const source of used) {
        const data = source.buffer.getChannelData(0);
        if (data[0] !== 0 || data.at(-1) !== 0 || source.buffer.duration !== .62 || data.some(x => !Number.isFinite(x))) throw Error('Generated buffers must be finite with faded edges and the intended duration');
        if (source.playbackRate.value !== 1) throw Error('Modelled pitch must be preserved');
      }
      buffers.push(used[0].buffer, used[1].buffer);
      await ctx.startRendering();
    }
    return { preparedSilently: true, immediate: true, alternateVariations: true, reused: true, freshContext: true, rates: [24000, 48000] };
  }, process.env.MUTATE === 'cache');
  console.log(JSON.stringify({ cache }));

  const pinwheels = await page.evaluate(async () => {
    const { Pinwheels } = await productionModule('/src/world/pinwheels.ts');
    const { LINES_WALK } = await productionModule('/src/world/lines-passage.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const random = Math.random, level = tuning.linesToys.pinwheelFlutterLevel;
    async function render(gain) {
      let seed = 712;
      Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
      tuning.linesToys.pinwheelFlutterLevel = gain;
      const { ctx, sound } = offlineSound(2);
      sound.master.gain.cancelScheduledValues(0); sound.master.gain.value = .9;
      const wind = { calm: 0, sample(x, z, out) { return Object.assign(out, { x: 12, z: 0, energy: 1, lift: 0 }); } };
      const wheels = new Pinwheels(wind, LINES_WALK);
      const camera = { position: { x: wheels.centre.x, z: wheels.centre.z + 20 } };
      for (let i = 0; i < 360; i++) wheels.update(1 / 60, camera, null);
      wheels.update(1 / 60, camera, sound.output);
      return encodeAudio(await ctx.startRendering());
    }
    try {
      const before = await render(.05), after = await render(level);
      return { before, after, reductionDb: after.rmsDbFS - before.rmsDbFS };
    } finally { Math.random = random; tuning.linesToys.pinwheelFlutterLevel = level; }
  });
  assert.equal(pinwheels.after.clipped, 0);
  assert(pinwheels.reductionDb < -8 && pinwheels.reductionDb > -10, `Little pinwheel reduction: ${pinwheels.reductionDb} dB`);
  fs.writeFileSync('/tmp/updraft-pinwheel-flutter.wav', wav(Buffer.from(pinwheels.after.pcm, 'base64')));
  delete pinwheels.before.pcm; delete pinwheels.after.pcm;
  console.log(JSON.stringify({ pinwheels }));
} finally { await browser.close(); }
