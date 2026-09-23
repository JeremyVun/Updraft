// The drowned village rests while the boat is far off and catches up as it comes near. Compare its state on
// arrival with a village updated every step of the journey, the way it was before the gating.
// Usage: node tools/drowned-gating-check.mjs
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '' };
const { DrownedVillage } = await import('../src/world/drowned.ts');

let now = 0;
const wind = {
  breeze: new THREE.Vector2(1.6, -0.8),
  sample(x, z, out) {
    const a = 0.9 + 0.35 * Math.sin(now * 0.05) + 0.002 * x;
    const speed = 3 + Math.sin(now * 0.11 + z * 0.01);
    out.x = Math.cos(a) * speed; out.z = Math.sin(a) * speed; out.energy = 0.1; out.lift = 0;
    return out;
  },
};
const gated = new DrownedVillage(wind);
const every = new DrownedVillage(wind);
/** The update as it was: every part advanced every world step, the leaves within 320 m. */
function updateEvery(v, dt, time, boat, storm) {
  v.storm.value = storm;
  v.lighthouse.update(dt, storm);
  v.turnVane(dt, storm);
  v.flyHerons(dt, time, boat, storm);
  if (Math.abs(boat.z + 1440) <= 320) v.driftLeaves(dt, time, boat, storm);
}

let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const boat = new THREE.Vector3();
/** From the first island, ashore at the birches, then through the village and out into the storm. */
const route = [[0, 0], [240, -1100], [420, -1150], [480, -1440], [560, -1600]];
const zAt = t => {
  for (let i = 1; i < route.length; i++) if (t <= route[i][0]) {
    const [t0, z0] = route[i - 1], [t1, z1] = route[i];
    return z0 + (z1 - z0) * (t - t0) / (t1 - t0);
  }
  return route.at(-1)[1];
};
const stormAt = t => THREE.MathUtils.smoothstep(t, 500, 530);
let steps = 0, restingSteps = 0, arrived = null, entered = null;
const snapshot = v => ({
  lighthouse: [v.lighthouse.elapsed, v.lighthouse.strength.value],
  vane: v.vaneAngle.value, spin: v.vaneSpin,
  herons: v.birds.map(h => ({ mode: h.mode, roost: h.roost, x: h.x, y: h.y, z: h.z, open: h.open, legs: h.legs, amp: h.amp, neck: h.neck })),
  leaves: v.drift.map(l => [l.x, l.z, l.yaw]),
  instances: Array.from(v.herons.geometry.attributes.iPos.array),
});
while (now < 560) {
  const dt = [1 / 30, 1 / 60, 1 / 45, 1 / 120][Math.floor(rand() * 4)];
  now += dt;
  boat.set(0, 0, zAt(now));
  const storm = stormAt(now);
  const far = Math.abs(boat.z + 1440) > 320;
  if (far) restingSteps++;
  gated.update(dt, now, boat, storm);
  updateEvery(every, dt, now, boat, storm);
  steps++;
  if (!far && !entered) entered = { at: now, gated: snapshot(gated), every: snapshot(every) };
  if (boat.z <= -1300 && !arrived) arrived = { at: now, gated: snapshot(gated), every: snapshot(every) };
}
const final = { gated: snapshot(gated), every: snapshot(every) };

for (const [label, state] of [['coming near', entered], ['in the village', arrived], ['after the storm', final]]) {
  const { gated: g, every: e } = state;
  assert.deepEqual(g.lighthouse, e.lighthouse, `${label}: the lighthouse keeps time exactly`);
  assert.deepEqual(g.leaves, e.leaves, `${label}: the drifting leaves are unchanged`);
  const vaneGap = Math.abs(Math.atan2(Math.sin(g.vane - e.vane), Math.cos(g.vane - e.vane)));
  assert(vaneGap < 0.05 && Math.abs(g.spin - e.spin) < 0.05, `${label}: vane ${g.vane} vs ${e.vane}`);
  g.herons.forEach((h, i) => {
    const o = e.herons[i];
    assert.equal(h.mode, o.mode, `${label}: heron ${i} mode`);
    assert.equal(h.roost, o.roost, `${label}: heron ${i} roost`);
    if (h.mode === 'perched') {
      assert.deepEqual([h.x, h.y, h.z], [o.x, o.y, o.z], `${label}: heron ${i} stands on its roost`);
      for (const key of ['open', 'legs', 'amp']) assert(h[key] < 0.02 && o[key] < 0.02, `${label}: heron ${i} ${key} folded`);
      assert(h.neck >= 0 && h.neck <= 1);
    }
  });
  console.log(`${label} (t=${state.at?.toFixed(1) ?? 'end'}): vane differs by ${vaneGap.toFixed(4)} rad; herons ${g.herons.map(h => h.mode).join(',')}`);
}
assert(final.gated.herons.every(h => h.mode !== 'perched'), 'the storm still sends the herons off');
console.log(`Vane and herons rested for ${restingSteps} of ${steps} world steps (${(100 * restingSteps / steps).toFixed(0)}%); lighthouse and leaves identical, arrival state equivalent.`);
