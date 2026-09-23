// Ground picking: the open-water and ceiling shortcuts must return exactly what the plain 2 m march returns.
// Usage: node tools/pointer-pick-check.mjs
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '' };
const { PointerInput, LAND_REACH, LAND_ROOMS, TERRAIN_CEILING } = await import('../src/input/pointer.ts');
const { heightAt, setHeightGrid } = await import('../src/world/island.ts');
const { worldHeight } = await import('../src/world/heightfield.ts');
const { ROOMS } = await import('../src/world/journey-rooms.ts');

// The shortcuts rest on two measured bounds; re-measure them on a 3 m lattice over the whole world.
let reach = 0, highest = -Infinity;
for (let x = -700; x <= 700; x += 3) for (let z = -2800; z <= 400; z += 3) {
  const h = worldHeight(x, z);
  if (h <= 0) continue;
  highest = Math.max(highest, h);
  reach = Math.max(reach, Math.min(...LAND_ROOMS.map(c => Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz))));
}
assert(reach < LAND_REACH - 0.1, `land reaches ${reach.toFixed(3)} of a room's ellipse; LAND_REACH ${LAND_REACH} needs a margin`);
assert(highest < TERRAIN_CEILING - 10, `ground reaches ${highest.toFixed(1)}; TERRAIN_CEILING ${TERRAIN_CEILING} needs a margin`);

/** The march as it was before the shortcuts, verbatim. */
const ray = new THREE.Raycaster();
function plainPick(camera, ndc, out) {
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  const ground = t => o.y + d.y * t - Math.max(heightAt(o.x + d.x * t, o.z + d.z * t), 0);
  let prevT = 0;
  for (let t = 2; t < 700; t += 2) {
    if (ground(t) <= 0) {
      let lo = prevT, hi = t;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (ground(mid) > 0) lo = mid; else hi = mid;
      }
      out.copy(d).multiplyScalar(hi).add(o);
      return true;
    }
    prevT = t;
  }
  out.copy(d).multiplyScalar(700).add(o);
  out.y = 0;
  return false;
}

const element = Object.assign(new EventTarget(), { ownerDocument: null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }), setPointerCapture() {} });
const input = new PointerInput(element);
const views = {
  'sea between islands, low': [[20, 4, -520], [30, 2, -700]],
  'sea horizon at night': [[-60, 6, -1990], [-200, 8, -2200]],
  'meadow crest toward far hills': [[10, heightAt(10, -880) + 3, -880], [40, 20, -1150]],
  'meadow cliffs, steep and grazing': [[-120, 6, -760], [-60, 10, -800]],
  'wood slope close up': [[-30, heightAt(-30, -1760) + 2, -1760], [-30, 18, -1810]],
  'birches notch': [[-150, 12, -1910], [-165, 5, -1926]],
  'home last hill': [[-60, 40, -2280], [-80, 60, -2322]],
  'high and looking down': [[0, 140, -300], [20, 0, -420]],
  'sky mirror sandflat': [[ROOMS.mirror.x, 5, ROOMS.mirror.z + 60], [ROOMS.mirror.x, 0, ROOMS.mirror.z]],
  'looking up into the sky': [[0, 10, -40], [0, 60, -120]],
};
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 5000);
const ndc = new THREE.Vector2(), a = new THREE.Vector3(), b = new THREE.Vector3();
function compare(label) {
  let worst = 0, rays = 0, plainMs = 0, fastMs = 0, misses = 0;
  const rows = [];
  for (const [name, [eye, look]] of Object.entries(views)) {
    camera.position.set(...eye); camera.lookAt(...look); camera.updateMatrixWorld();
    let viewPlain = 0, viewFast = 0, viewRays = 0;
    for (let y = -1; y <= 1.0001; y += 0.08) for (let x = -1; x <= 1.0001; x += 0.08) {
      ndc.set(x, y);
      let t = performance.now(); if (!plainPick(camera, ndc, a)) misses++; viewPlain += performance.now() - t;
      t = performance.now(); input.pick(camera, ndc, b); viewFast += performance.now() - t;
      const gap = a.distanceTo(b);
      assert(gap < 1e-6, `${label}, ${name}: pick at (${x.toFixed(2)}, ${y.toFixed(2)}) differs by ${gap}`);
      worst = Math.max(worst, gap); rays++; viewRays++;
    }
    plainMs += viewPlain; fastMs += viewFast;
    rows.push(`${name} ${(viewPlain / viewRays * 1000).toFixed(0)}→${(viewFast / viewRays * 1000).toFixed(0)}`);
  }
  console.log(`${label}: ${rays} rays (${misses} miss the ground), worst difference ${worst}, plain ${(plainMs / rays * 1000).toFixed(0)} µs/pick, now ${(fastMs / rays * 1000).toFixed(0)} µs/pick`);
  console.log(`  µs/pick by view: ${rows.join('; ')}`);
}
compare('procedural terrain');
// The same comparison through a CPU height grid, as the game has once the GPU height bake has been read back.
const res = 128, size = 480, minX = -250, minZ = -1000, data = new Float32Array(res * res * 4);
for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) data[(j * res + i) * 4] = worldHeight(minX + (i + 0.5) * size / res, minZ + (j + 0.5) * size / res);
setHeightGrid({ data, minX, minZ, size, res, stride: 4 });
compare('with a height grid');
console.log(`Bounds: land within ${reach.toFixed(3)} of a room ellipse (reach ${LAND_REACH}), highest ground ${highest.toFixed(1)} (ceiling ${TERRAIN_CEILING}).`);
