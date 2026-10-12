import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const report = await page.evaluate(async () => {
    const { Foley } = await import('/src/audio/foley.ts');
    const { WorldFoley } = await import('/src/audio/world-foley.ts');
    const { tuning } = await import('/src/tuning.ts');
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
  assert(report.peakDbFS < -53 && report.peakDbFS > -66, `Quiet bearing creak: ${report.peakDbFS} dBFS`);
  fs.writeFileSync('/tmp/updraft-rotary-creak.wav', wav(Buffer.from(report.pcm, 'base64')));
  delete report.pcm;
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
