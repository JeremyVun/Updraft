// Exercise the real GPU shaders: reversal continuity, decay, window shifts and litter conservation.
// Requires the dev server; uses the same Chrome lock and GPU setup as play.mjs.
import { spawnSync } from 'node:child_process';

async function checkMomentum() {
  const source = await (await fetch('/src/world/atmosphere.ts')).text();
  const threeUrl = source.match(/from ["']([^"']*three[^"']*)["']/)[1];
  const THREE = await import(threeUrl);
  // Vite adds HMR timestamps to imports; share the simulation's exact atmosphere instance.
  const waveSource = await (await fetch('/src/world/water/wind-waves.ts')).text();
  const atmoUrl = waveSource.match(/from ["']([^"']*\/atmosphere\.ts[^"']*)["']/)[1];
  const { atmo } = await import(atmoUrl);
  const { WindWaves } = await import('/src/world/water/wind-waves.ts');
  const { BirchCanopyMotion } = await import('/src/fx/birch-canopy.ts');
  const { LitterField, LITTER_SIDE, LITTER_BOX } = await import('/src/fx/leaves.ts');
  const { WINDOW, followWindow, windowCentre } = await import('/src/world/window.ts');
  const renderer = window.__game.renderer;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const close = (actual, expected, tolerance, message) => assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual}, expected ${expected}`);
  const texture = (values, side = 1) => {
    const t = new THREE.DataTexture(new Float32Array(values), side, side, THREE.RGBAFormat, THREE.FloatType);
    t.needsUpdate = true;
    return t;
  };
  const read = (target) => {
    const half = target.texture.type === THREE.HalfFloatType;
    const data = half ? new Uint16Array(target.width * target.height * 4) : new Float32Array(target.width * target.height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, data);
    const decoded = half ? Float32Array.from(data, THREE.DataUtils.fromHalfFloat) : data;
    assert(decoded.every(Number.isFinite), 'Simulation produced non-finite state');
    return decoded;
  };
  const totals = (data) => {
    const sums = [0, 0, 0, 0];
    for (let i = 0; i < data.length; i++) sums[i % 4] += data[i];
    return sums;
  };
  const dt = 1 / 60;
  const wind = texture([12 * 0.94, 12 * 0.341174, 1, 0]);
  atmo.uniforms.uWindTex.value = wind;
  atmo.uniforms.uHeightTex.value = texture([-12, 0, 1, 0]);
  const waves = new WindWaves(renderer);
  const stepWaves = (n) => { for (let i = 0; i < n; i++) waves.update(dt); };
  stepWaves(1);
  let data = read(waves.state.read);
  const middle = (64 * 128 + 64) * 4;
  assert(data[middle] > 0 && data[middle] < 0.03, `Water must build gradually (got ${data[middle]}, max ${Math.max(...data.filter((_, i) => i % 4 === 0))})`);
  stepWaves(59);
  const built = read(waves.state.read)[middle];
  assert(built > 0.5, 'A sustained gust must visibly build waves');
  wind.image.data.set([-12 * 0.94, -12 * 0.341174, 1, 0]);
  wind.needsUpdate = true;
  stepWaves(1);
  data = read(waves.state.read);
  assert(data[middle] > built * 0.97 && data[middle + 2] < 0.03, 'Reversal must retain old waves while new ones build');
  wind.image.data.fill(0);
  wind.needsUpdate = true;
  stepWaves(60);
  const afterOneSecond = read(waves.state.read)[middle];
  assert(afterOneSecond > built * 0.55 && afterOneSecond < built * 0.85, 'Water must coast after release');
  stepWaves(480);
  assert(read(waves.state.read)[middle] < built * 0.08, 'Waves must eventually settle');

  // Ordinary pointer strokes measure about 2 units/s after pressure projection, not 12.
  // They need a readable response too, even when they pass a patch in half a second.
  wind.image.data.set([2.2 * 0.94, 2.2 * 0.341174, 0.65, 0]);
  wind.needsUpdate = true;
  const ordinary = new WindWaves(renderer);
  for (let i = 0; i < 30; i++) ordinary.update(dt);
  const ordinaryResponse = read(ordinary.state.read)[middle];
  assert(ordinaryResponse > 0.4, `Normal mouse sweep barely affects water: ${ordinaryResponse}`);

  // A local packet stays attached to world coordinates when the simulation window moves.
  const localWind = new Float32Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4;
    localWind[i] = 12;
    localWind[i + 2] = Math.exp(-((x - 64) ** 2 + (y - 64) ** 2) / 80);
  }
  atmo.uniforms.uWindTex.value = texture(localWind, 128);
  const packet = new WindWaves(renderer);
  for (let i = 0; i < 40; i++) packet.update(dt);
  const beforeMove = read(packet.state.read);
  const centre = windowCentre();
  const oldX = WINDOW.minX;
  followWindow(centre[0] + 10, centre[1], true);
  const afterMove = read(packet.state.read);
  const shiftPixels = Math.round((WINDOW.minX - oldX) / WINDOW.size * 128);
  close(afterMove[middle], beforeMove[middle + shiftPixels * 4], 0.002, 'Water packet jumped with the window');

  atmo.uniforms.uDomain.value.set(-160, -160, 1 / 320, 1 / 320);
  atmo.uniforms.uWindTex.value = wind;
  atmo.uniforms.uHeightTex.value = texture([0, 0, 1, 0]);
  wind.image.data.set([10, 0, 0.7, 0]);
  wind.needsUpdate = true;
  const strip = { value: 0 };
  const canopy = new BirchCanopyMotion(renderer, 1, 1, new Float32Array([0, 8, 0, 0.3]), `
    uniform float uStrip;
    vec4 birchS;
    void rootBirch(int i) { birchS = vec4(0.0, 0.0, uStrip, 0.0); }
    vec3 birchPlace(vec3 p) { return p; }
  `, { ...atmo.uniforms, uStrip: strip });
  canopy.update(dt);
  close(read(canopy.pos.read)[0], 0, 0.0001, 'Attached leaf moved');
  strip.value = 1;
  for (let i = 0; i < 35; i++) canopy.update(dt);
  const leafBefore = read(canopy.pos.read);
  const velocityBefore = read(canopy.vel.read)[0];
  wind.image.data[0] = -10;
  wind.needsUpdate = true;
  canopy.update(dt);
  const leafAfter = read(canopy.pos.read);
  assert(velocityBefore > 0 && read(canopy.vel.read)[0] > 0, 'Shed leaf reversed instantly');
  assert(leafAfter[0] > leafBefore[0], 'Shed leaf lost forward momentum on reversal');
  assert(leafAfter[0] - leafBefore[0] < 0.12, 'Shed leaf teleported');
  for (let i = 0; i < 90; i++) canopy.update(dt);
  assert(read(canopy.vel.read)[0] < 0, 'Shed leaf never responds to the new wind');

  atmo.uniforms.uDomain.value.set(LITTER_BOX.x, LITTER_BOX.z, 1 / LITTER_BOX.sx, 1 / LITTER_BOX.sz);
  const seed = new Float32Array(LITTER_SIDE * LITTER_SIDE * 4);
  for (let y = 0; y < LITTER_SIDE; y++) for (let x = 0; x < LITTER_SIDE; x++) {
    seed[(y * LITTER_SIDE + x) * 4] = Math.exp(-((x - 128) ** 2 + (y - 128) ** 2) / 500);
  }
  const litter = new LitterField(renderer, seed, new THREE.Vector4(1e6, 1e6, 0, 0));
  const mass = totals(read(litter.field.read))[0];
  wind.image.data.set([12, 0, 1, 0]);
  wind.needsUpdate = true;
  for (let i = 0; i < 60; i++) litter.update(dt);
  const beforeLitter = read(litter.field.read);
  wind.image.data[0] = -12;
  wind.needsUpdate = true;
  litter.update(dt);
  const afterLitter = read(litter.field.read);
  const ci = (128 * LITTER_SIDE + 128) * 4;
  assert(beforeLitter[ci + 1] > 0 && afterLitter[ci + 1] > 0, 'Litter transport reversed instantly');
  for (let i = 0; i < 59; i++) litter.update(dt);
  const settledLitter = read(litter.field.read);
  assert(settledLitter[ci + 1] < 0, 'Litter transport never changes direction');
  const massAfter = totals(settledLitter)[0];
  close(massAfter / mass, 1, 0.005, 'Litter transport created or destroyed excessive coverage');
  return { passed: true, waterBuilt: built, ordinaryResponse, waterAfterOneSecond: afterOneSecond, canopyReversalStep: leafAfter[0] - leafBefore[0], litterMassRatio: massAfter / mass };
}

const result = spawnSync(process.execPath, ['tools/play.mjs', '/tmp/updraft-wind-momentum-check', JSON.stringify([
  { wait: 1000 }, { eval: `(${checkMomentum.toString()})()` },
])], { stdio: 'inherit', env: { ...process.env, QUERY: 'hold=60&ratio=1&msaa=0', VIDEO: '' } });
process.exit(result.status ?? 1);
