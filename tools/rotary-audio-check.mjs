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

    const { ctx, sound } = offlineSound(2);
    sound.master.gain.cancelScheduledValues(0); sound.master.gain.value = .9;
    const foley = new Foley(); foley.setOutput(sound.output);
    let started = 0, disconnected = 0;
    const create = ctx.createOscillator.bind(ctx);
    ctx.createOscillator = () => {
      started++;
      const node = create(), disconnect = node.disconnect.bind(node);
      node.disconnect = (...args) => { disconnected++; return disconnect(...args); };
      return node;
    };
    foley.material('rotary-creak', tuning.rotaryWashing.creakLevel, -.3);
    const made = started;
    foley.setOutput(null); foley.material('rotary-creak', 1, 0);
    if (started !== made) throw Error('Muted creaks must not queue');
    const buffer = await ctx.startRendering();
    if (made !== 1 || disconnected !== made) throw Error('The single creak must disconnect after playing');
    return { ...encodeAudio(buffer), started, disconnected };
  });
  assert.equal(report.clipped, 0);
  assert(report.peakDbFS < -33 && report.peakDbFS > -46, `Audible bearing creak: ${report.peakDbFS} dBFS`);
  fs.writeFileSync('/tmp/updraft-rotary-creak.wav', wav(Buffer.from(report.pcm, 'base64')));
  delete report.pcm;
  console.log(JSON.stringify(report));

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
