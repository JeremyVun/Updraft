// Proves the choice of the grass program without discards (perf-bakes E5). The blade shader discards within 48 m of
// the door shore, outside uRoom's circle when uRoom.z > 0, and wherever journeyHides hides a room. Grass.tilesUnclipped
// picks the program that cannot discard only when every submitted tile passes tileUnclipped. No renderer.
// 1. Source: the clipped blade shader's two discards are the ones modelled here, and the unclipped one has none.
// 2. Bound: each room's journeyHides measure changes by at most a metre per metre (sampled), so roomMargin by two.
// 3. Sweep: for every journey-room pair and single, every 8 m tile over the journey whose centre passes is checked
//    point by point (a JS port of journeyHides in float32, the door shore, the doorway circles) over the disc its
//    blade fragments can reach. Tiles near the threshold are checked densely, the rest on a coarser grid.
// Usage: node tools/grass-unclipped-check.mjs   STEP=0.5
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
const THREE = await import('three');
const { roomMargin, tileUnclipped } = await import('../src/world/grass.ts');
const { ROOMS, JOURNEY_ROOMS_GLSL, visibleRooms } = await import('../src/world/journey-rooms.ts');
const { DOOR_SHORE, GRASS_LINE } = await import('../src/world/heightfield.ts');
const { heightAt } = await import('../src/world/island.ts');

// 1. Source.
const source = fs.readFileSync(new URL('../src/world/grass.ts', import.meta.url), 'utf8');
const TILE = Number(source.match(/^const TILE = (\d+);/m)[1]);
const MAX_BLADE = Number(source.match(/^const MAX_BLADE = (\d+);/m)[1]);
const CUT = Number(source.match(/^const DOOR_SHORE_CUT = (\d+);/m)[1]);
assert.match(source, /^const TILE_SPREAD = TILE \* Math\.SQRT1_2 \+ MAX_BLADE \+ 8;$/m, 'TILE_SPREAD changed; update this check');
const SPREAD = TILE * Math.SQRT1_2 + MAX_BLADE + 8;
const clip = source.match(/void main\(\) \{\$\{clip \? `\n(.*)\n(.*)` : ''\}/);
assert(clip, 'the blade shader\'s discards are no longer the clip block');
assert.equal(clip[1].trim(), 'if (distance(vWorld.xz, vec2(${glsl(DOOR_SHORE.x)}, ${glsl(DOOR_SHORE.z)})) < ${glsl(DOOR_SHORE_CUT)}) discard;');
assert.equal(clip[2].trim(), 'if (uRoom.z > 0.0 ? distance(vWorld.xz, uRoom.xy) > uRoom.z : journeyHides(vWorld.xz)) discard;');
const fragment = source.slice(source.indexOf('const bladeFragment'), source.indexOf('const FRAG = bladeFragment(true);'));
assert.equal(fragment.split('discard').length, 3, 'a discard outside the clip block');
const rooms = Object.values(ROOMS);
assert.equal(JOURNEY_ROOMS_GLSL.split('float d = (length(').length - 1, rooms.length);

// The threshold tileUnclipped applies is the one this check assumes.
const far = { x: -3000, z: -3000 };
const pair = new THREE.Vector2(0, 1), open = new THREE.Vector3(0, 0, 0);
assert(!tileUnclipped(far.x, far.z, 2 * SPREAD + 1, pair, open) && tileUnclipped(far.x, far.z, 2 * SPREAD + 1.001, pair, open));

// A float32 port of journeyHides, in the shader's order: the first room at the least measure wins.
const f = Math.fround;
function hides(px, pz, a, b) {
  if (a === -1) return false;
  let nearest = f(1e20), room = -1;
  rooms.forEach((c, i) => {
    const qx = f(f(px - c.x) / c.rx), qz = f(f(pz - c.z) / c.rz);
    const d = f(f(f(Math.sqrt(f(f(qx * qx) + f(qz * qz)))) - 1) * Math.min(c.rx, c.rz));
    if (d < nearest) { nearest = d; room = i; }
  });
  return room !== a && room !== b;
}

// 2. Each room's measure is 1-Lipschitz (analytic: |∇|q|| <= 1/min(rx, rz)); sampled here as a guard.
const measure = (c, x, z) => (Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz) - 1) * Math.min(c.rx, c.rz);
let rand = 1;
const random = () => ((rand = (rand * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = 0; i < 200000; i++) {
  const c = rooms[i % rooms.length], x = c.x + (random() - 0.5) * 1200, z = c.z + (random() - 0.5) * 1200;
  const dx = (random() - 0.5) * 4, dz = (random() - 0.5) * 4;
  assert(Math.abs(measure(c, x + dx, z + dz) - measure(c, x, z)) <= Math.hypot(dx, dz) * (1 + 1e-9), 'room measure not 1-Lipschitz');
}

// 3. Sweep.
const STEP = Number(process.env.STEP ?? 0.5);
const minX = Math.min(...rooms.map(c => c.x - c.rx)) - 300, maxX = Math.max(...rooms.map(c => c.x + c.rx)) + 300;
const minZ = Math.min(...rooms.map(c => c.z - c.rz)) - 300, maxZ = Math.max(...rooms.map(c => c.z + c.rz)) + 300;
const land = new Set();
for (let tz = Math.floor(minZ / TILE); tz <= Math.ceil(maxZ / TILE); tz++) {
  for (let tx = Math.floor(minX / TILE); tx <= Math.ceil(maxX / TILE); tx++) {
    const x = tx * TILE, z = tz * TILE;
    if ([[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]].some(([ox, oz]) => heightAt(x + ox * TILE, z + oz * TILE) > GRASS_LINE - 0.8)) land.add(tx + ',' + tz);
  }
}
const disc = step => { const out = []; for (let j = -SPREAD; j <= SPREAD; j += step) for (let i = -SPREAD; i <= SPREAD; i += step) if (Math.hypot(i, j) <= SPREAD) out.push([i, j]); return out; };
const fine = disc(STEP), coarse = disc(4);
const configs = [[-1, -1], [-2, -2]];
for (let a = 0; a < rooms.length; a++) { configs.push([a, -2]); for (let b = a + 1; b < rooms.length; b++) configs.push([a, b]); }
const doorways = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(DOOR_SHORE.x, DOOR_SHORE.z, -CUT), new THREE.Vector3(14, -368.4, 96), new THREE.Vector3(DOOR_SHORE.x, DOOR_SHORE.z, 48)];
let checked = 0, points = 0;
const failures = [];
for (const [a, b] of configs) {
  const jr = new THREE.Vector2(a, b);
  for (const room of doorways) {
    for (let tz = Math.floor(minZ / TILE); tz <= Math.ceil(maxZ / TILE); tz++) {
      for (let tx = Math.floor(minX / TILE); tx <= Math.ceil(maxX / TILE); tx++) {
        const x = tx * TILE + TILE / 2, z = tz * TILE + TILE / 2;
        const margin = room.z <= 0 && a !== -1 ? roomMargin(x, z, a, b) : 0;
        if (!tileUnclipped(x, z, margin, jr, room)) continue;
        checked++;
        const near = room.z > 0 || margin < 2 * SPREAD + 40 || Math.hypot(x - DOOR_SHORE.x, z - DOOR_SHORE.z) < CUT + SPREAD + 40;
        for (const [i, j] of near ? fine : coarse) {
          const px = x + i, pz = z + j;
          points++;
          const discarded = Math.hypot(px - DOOR_SHORE.x, pz - DOOR_SHORE.z) < CUT || (room.z > 0 ? Math.hypot(px - room.x, pz - room.y) > room.z : hides(px, pz, a, b));
          if (discarded) { failures.push({ a, b, room: room.toArray(), x, z, px, pz }); break; }
        }
      }
    }
  }
}
assert.deepEqual(failures.slice(0, 5), [], 'an unclipped tile would draw a discarded blade fragment');

// Where the program applies: land tiles passing in each chapter's rooms (without the doorway circles).
const chapters = ['island', 'toLines', 'lines', 'toBoats', 'boats', 'toMeadow', 'meadow', 'toBirches', 'birches', 'drowned', 'toWood', 'wood', 'toSleeping', 'sleeping', 'toMirror', 'mirror', 'toHarbour', 'toHome', 'home'];
const coverage = {};
for (const chapter of chapters) {
  const shown = visibleRooms(chapter, chapter === 'drowned' ? ROOMS.drowned.z - 1 : 0).map(r => Object.keys(ROOMS).indexOf(r));
  const jr = new THREE.Vector2(shown[0] ?? -2, shown[1] ?? -2);
  let pass = 0, total = 0;
  for (const key of land) {
    const [tx, tz] = key.split(',').map(Number), x = tx * TILE + TILE / 2, z = tz * TILE + TILE / 2;
    if (hides(x, z, jr.x, jr.y)) continue;
    total++;
    if (tileUnclipped(x, z, roomMargin(x, z, jr.x, jr.y), jr, new THREE.Vector3(DOOR_SHORE.x, DOOR_SHORE.z, -CUT))) pass++;
  }
  coverage[chapter] = `${pass}/${total}`;
}
console.log(JSON.stringify({ spread: +SPREAD.toFixed(2), configs: configs.length * doorways.length, tilesPassing: checked, pointsChecked: points, landTilesUnclippedByChapter: coverage }));
