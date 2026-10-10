import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.location = { search: '?shot' };
const { Bell } = await import('../src/world/crossings/bell.ts');

for (const fps of [30, 60, 120]) for (const mode of ['rapid', 'alternating', 'sway', 'single', 'weak', 'idle']) {
  const input = { present: true, muted: false, prevNdc: new THREE.Vector2(), ndc: new THREE.Vector2() };
  const bell = new Bell({ pivot: new THREE.Vector3(0, 3, 0), toward: new THREE.Vector2(1, 0), half: 2 }, { input, lines: { gust() {} } });
  const strikes = [];
  bell.onEvent = kind => { if (kind === 'ring') strikes.push(Math.sign(bell.angle)); };
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 100);
  camera.position.set(0, 2, 10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
  let max = 0;
  for (let i = 0; i < fps * 20; i++) {
    const t = i / fps, centre = bell.middle(new THREE.Vector3()).project(camera);
    const stroke = mode === 'rapid' || mode === 'alternating' ? t % .24 < .18 : t < .18 && mode !== 'idle';
    input.present = t < 12 && stroke;
    const way = mode === 'alternating' && Math.floor(t / .24) % 2 ? -1 : 1;
    const length = mode === 'weak' ? .0012 * 60 / fps : .08 * 60 / fps;
    input.prevNdc.set(centre.x - length * way, centre.y);
    input.ndc.set(centre.x + length * way, centre.y);
    if (mode === 'sway') {
      const phase = t * 2.5;
      input.present = t < 12;
      input.prevNdc.set(.045 * Math.sin(phase - 2.5 / fps), centre.y);
      input.ndc.set(.045 * Math.sin(phase), centre.y);
    }
    bell.update(1 / fps, camera);
    max = Math.max(max, Math.abs(bell.angle));
  }
  assert.equal(strikes.length, bell.rings, 'each ring emits its sound event');
  if (mode === 'rapid' || mode === 'alternating' || mode === 'sway') {
    assert(bell.rings >= 4, `${fps} ${mode}: only ${bell.rings} rings`);
    assert(strikes.every((way, i) => i === 0 || way !== strikes[i - 1]), `${mode}: rings stay on one side: ${strikes}`);
  }
  if (mode === 'single') assert(bell.rings >= 1 && bell.rings <= 2, 'one stroke rings and decays without completing the whole encounter');
  if (mode === 'weak' || mode === 'idle') assert.equal(bell.rings, 0, 'weak/absent input cannot ring');
  assert(Math.abs(bell.angle) < .08, `bell remains stuck at ${bell.angle}`);
  assert(max < .8, `bell driven too far: ${max}`);
  console.log(`${fps} Hz ${mode}: ${bell.rings} rings (${strikes.join(',')}), ${bell.touches} touches, peak ${max.toFixed(3)}, rest ${bell.angle.toFixed(3)}`);
}
