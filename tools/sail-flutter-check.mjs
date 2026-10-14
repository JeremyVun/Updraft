// Exercise the real sail shader's ripple phase under changing gusts, including late in a journey.
// No browser needed: inspect the shader expression and uniforms produced by the real Boat.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { Boat } = await import('../src/traveller/boat.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
const report = [];
for (const elapsed of [0, 600, 3600]) for (const fps of [20, 30, 60, 120]) {
  let gust = 0;
  const wind = { breeze: new THREE.Vector2(), calm: 0,
    sample(_x, _z, out) { return Object.assign(out, { x: gust, z: -gust, energy: Math.abs(gust) / 40, lift: 0 }); } };
  const boat = new Boat(wind);
  boat.beach(-600, -1500, 0);
  boat.time = elapsed;
  const material = boat.sailMat;
  // Evaluate the phase actually used by the vertex shader, so reverting its integration fails this check.
  const expression = material.vertexShader.match(/float ripple = sin\((.*?) - s \*/)?.[1];
  assert(expression, 'must find the sail ripple phase');
  const phase = new Function('uTime', 'uFlutter', 'uRipplePhase', `return ${expression};`);
  const read = () => phase(atmo.uniforms.uTime.value, material.uniforms.uFlutter.value, material.uniforms.uRipplePhase?.value);
  atmo.uniforms.uTime.value = elapsed;
  let previous = read(), worstRate = 0;
  for (let frame = 0; frame < fps * 16; frame++) {
    const dt = 1 / fps;
    // Fast cursor reversals, a held gust, then release back to dead calm.
    gust = frame < fps * 3 ? (Math.floor(frame / (fps * 0.15)) % 2 ? -40 : 25) : frame < fps * 4 ? 40 : 0;
    atmo.uniforms.uTime.value = elapsed + (frame + 1) * dt;
    boat.update(dt, atmo.uniforms.uTime.value);
    const current = read();
    const advance = Math.atan2(Math.sin(current - previous), Math.cos(current - previous));
    const rate = advance / dt;
    worstRate = Math.max(worstRate, Math.abs(rate));
    assert(rate >= 4.5 - 1e-6 && rate <= 10 + 1e-6,
      `ripple skipped/reversed at ${elapsed}s, ${fps}fps, frame ${frame}: ${rate.toFixed(3)} rad/s`);
    previous = current;
  }
  assert(boat.sailDroop > 0.99, 'sail must relax after the cursor stops');
  report.push({ elapsed, fps, worstRate: +worstRate.toFixed(3) });
}
console.log(JSON.stringify(report));
console.log('Sail ripple stays continuous through gusts, reversals, release and long sessions.');
