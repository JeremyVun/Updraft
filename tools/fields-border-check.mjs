// Proves that Meadow's field presence is zero on and beyond the field atlas border, so terrainFieldAt may return
// fieldAt's own "no fields" value there without calling it. No renderer.
// 1. Source: GLSL fieldAt returns exactly vec4(99, 0, 0, 0) whenever presence <= 0.
// 2. Bound: |gnoise| <= 2.8, so presence > 0 needs a point inside an ellipse that lies wholly within the atlas.
// 3. Sweep: TypeScript fieldAt over a band around the border (both sides of the uv 0.001/0.999 cut) finds no presence.
// Usage: node tools/fields-border-check.mjs   STEP=0.25 BAND=160
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) specifier += '.ts';
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: transformSync(new URL(url).pathname, fs.readFileSync(new URL(url), 'utf8')).code };
  },
});
globalThis.location = { search: '' };
const { fieldAt, FIELDS_GLSL } = await import('../src/world/fields.ts');
const { meadowInset, gfbm, ISLES } = await import('../src/world/heightfield.ts');
const { FIELD_ATLAS, TERRAIN_FIELDS_GLSL } = await import('../src/world/terrain-fields.ts');

// 1. The shader's early return.
const early = FIELDS_GLSL.match(/float presence = clamp\(\(inland - ([\d.]+)\) \/ 30\.0, 0\.0, 1\.0\);\s*if \(presence <= 0\.0\) return vec4\(99\.0, 0\.0, 0\.0, 0\.0\);/);
assert(early, 'GLSL fieldAt no longer returns vec4(99, 0, 0, 0) as soon as presence <= 0');
const SHORE = Number(early[1]);
const cut = TERRAIN_FIELDS_GLSL.match(/lessThan\(uv, vec2\(([\d.]+)\)\)\)\s*\|\|\s*any\(greaterThan\(uv, vec2\(([\d.]+)\)\)\)/);
assert(cut, 'terrainFieldAt border test not found');
const [LO, HI] = [Number(cut[1]), Number(cut[2])];

// The meadow's coast, restated in world units (heightfield.ts meadowInset through meadowSculpted and isleCoast).
const SCULPTED = { x: 10, z: -880, rx: 340, rz: 300 }, WOBBLE = 0.08, SEED = 11;
const SCALE = ISLES.meadow.rz / SCULPTED.rz;
const PIVOT_Z = SCULPTED.z + SCULPTED.rz;
const restated = (x, z) => {
  const sx = SCULPTED.x + (x - SCULPTED.x) / SCALE, sz = PIVOT_Z + (z - PIVOT_Z) / SCALE;
  const n = gfbm(sx / (SCULPTED.rx * 0.9), sz / (SCULPTED.rz * 0.9), 3, SEED);
  return -(Math.hypot((sx - SCULPTED.x) / SCULPTED.rx, (sz - SCULPTED.z) / SCULPTED.rz) - 1 - n * WOBBLE) * Math.min(SCULPTED.rx, SCULPTED.rz) * 0.8 * SCALE;
};
let seed = 1;
const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);
for (let i = 0; i < 20000; i++) {
  const x = ISLES.meadow.x + (random() - 0.5) * 1200, z = ISLES.meadow.z + (random() - 0.5) * 1200;
  assert(Math.abs(restated(x, z) - meadowInset(x, z)) < 1e-9, `restated coast drifted from meadowInset at ${x}, ${z}`);
}

// 2. Each gradient corner is at most |x|+|y| <= 2, the fade weights are convex, gnoise scales by 1.4, and gfbm
// is a normalised average of octaves. So presence > 0 needs hypot(e) < REACH in the sculpted ellipse.
const NOISE_MAX = 2 * 1.4;
const REACH = 1 + WOBBLE * NOISE_MAX - SHORE / (Math.min(SCULPTED.rx, SCULPTED.rz) * 0.8 * SCALE);
const reach = { x: SCULPTED.rx * SCALE * REACH, z: SCULPTED.rz * SCALE * REACH };
const inner = {
  x0: FIELD_ATLAS.minX + LO * FIELD_ATLAS.span, x1: FIELD_ATLAS.minX + HI * FIELD_ATLAS.span,
  z0: FIELD_ATLAS.minZ + LO * FIELD_ATLAS.span, z1: FIELD_ATLAS.minZ + HI * FIELD_ATLAS.span,
};
const margins = {
  west: ISLES.meadow.x - reach.x - inner.x0, east: inner.x1 - ISLES.meadow.x - reach.x,
  north: ISLES.meadow.z - reach.z - inner.z0, south: inner.z1 - ISLES.meadow.z - reach.z,
};
const boundMargin = Math.min(...Object.values(margins));

// 3. The sweep: every point of a band BAND metres wide on the outer side of the cut, plus the strip between the cut
// and the geometric border, at STEP metres.
const STEP = Number(process.env.STEP ?? 0.25), BAND = Number(process.env.BAND ?? 160);
const outside = (x, z) => {
  const u = (x - FIELD_ATLAS.minX) / FIELD_ATLAS.span, v = (z - FIELD_ATLAS.minZ) / FIELD_ATLAS.span;
  return u < LO || v < LO || u > HI || v > HI;
};
const sample = { edge: 99, kind: 0, wall: false, presence: 0 };
let points = 0, present = 0, closest = { inland: -Infinity, x: 0, z: 0 };
const x0 = FIELD_ATLAS.minX - BAND, x1 = FIELD_ATLAS.minX + FIELD_ATLAS.span + BAND;
const z0 = FIELD_ATLAS.minZ - BAND, z1 = FIELD_ATLAS.minZ + FIELD_ATLAS.span + BAND;
for (let z = z0; z <= z1; z += STEP) {
  const nearZ = z < inner.z0 + 1 || z > inner.z1 - 1;
  for (let x = x0; x <= x1; x += STEP) {
    if (!nearZ && x >= inner.x0 + 1 && x < inner.x1 - 1) { x = inner.x1 - 1 - STEP; continue; }
    if (!outside(x, z)) continue;
    points++;
    fieldAt(x, z, sample);
    if (sample.presence > 0) present++;
    const inland = meadowInset(x, z);
    if (inland > closest.inland) closest = { inland, x, z };
  }
}

const result = {
  atlas: { ...FIELD_ATLAS, cut: [LO, HI], inner },
  shore: SHORE, reach: REACH, boundMargins: margins, boundMargin,
  sweep: { step: STEP, band: BAND, points, present, closest, shoreMargin: SHORE - closest.inland },
};
console.log(JSON.stringify(result, null, 2));
assert(boundMargin > 1, `presence can reach the atlas border (margin ${boundMargin} m)`);
assert.equal(present, 0, 'presence found outside the field atlas');
assert(closest.inland < SHORE, 'the coast inset reaches the field shore outside the atlas');
console.log('ok: outside the atlas terrainFieldAt may return vec4(99, 0, 0, 0) exactly');
