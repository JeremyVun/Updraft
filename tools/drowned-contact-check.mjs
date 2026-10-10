// Physical contact uses the posed meshes, not the character roots.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drownedCast } from './lib/storm-cast.mjs';
const { Cat } = await import('../src/creatures/cat.ts');
const { Traveller } = await import('../src/traveller/traveller.ts');
const { StrandedCat } = await import('../src/story/drowned-cat.ts');
const { CAT_LANDING, CAT_EDGE, CAT_HOLD, CAT_HOLD_YAW, WAY, catRoof, GREEN_HOUSE } = await import('../src/world/drowned-way.ts');
const { FLOOR_Y, SEAT_Y, MAST_Z } = await import('../src/traveller/boat/form.ts');
const wind = { breeze: new THREE.Vector2(), calm: 0, addSplat() {}, sample(x, z, out) { return Object.assign(out, { x: 0, z: 0, lift: 0, energy: 0 }); } };
const v = new THREE.Vector3(), w = new THREE.Vector3();
function catVertices(cat, visit) {
  const { position: p, aSkin: s } = cat.mesh.geometry.attributes;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    w.copy(v).applyMatrix4(cat.rig.bones[Math.round(s.getY(i))]);
    v.applyMatrix4(cat.rig.bones[Math.round(s.getX(i))]).lerp(w, s.getZ(i));
    visit(v, s.getX(i));
  }
}
const only = process.env.ONLY;
if (!only || only === 'chimney') {
  const { buildHouse, LIME, SLATE } = await import('../src/world/drowned-houses.ts');
  const h = GREEN_HOUSE, localX = h.stacks[0] * (h.len / 2 - 0.75), localZ = h.stackAcross ?? 0;
  const frame = new THREE.Matrix4().makeRotationY(h.yaw).setPosition(h.x, -h.sink, h.z), boxes = [];
  buildHouse({ add(g, _colour, _material, m) {
    g.computeBoundingBox();
    const centre = g.boundingBox.getCenter(new THREE.Vector3());
    if (Math.abs(centre.x - localX) < 0.05 && Math.abs(centre.z - localZ) < 0.05) boxes.push(g.boundingBox.clone().applyMatrix4(m));
  } }, 'cottage', { ...h, exact: true, lime: LIME[0], roof: SLATE[0],
    stacks: [{ side: h.stacks[0], across: h.stackAcross, above: h.stack, pots: 2 }] }, () => 0.5, frame);
  assert(boxes.length >= 3, 'check the rendered chimney shaft and cap');
  const child = new Traveller(wind), d = WAY.greenRidge;
  child.decks = [d]; child.dismount(); child.sitting = false;
  child.place(d.x0, d.z0, -Math.PI / 2);
  child.walkTo(d.x1, d.z1, false, undefined, 0.1);
  let nearest = Infinity;
  for (let i = 0; i < 420; i++) {
    child.update(1 / 60);
    if (i % 6) continue;
    child.rig.root.updateMatrixWorld(true);
    const mesh = child.rig.mesh; mesh.skeleton.update();
    for (let j = 0; j < mesh.geometry.attributes.position.count; j++) {
      mesh.getVertexPosition(j, v).applyMatrix4(mesh.matrixWorld);
      for (const box of boxes) nearest = Math.min(nearest, box.distanceToPoint(v));
    }
  }
  assert(nearest > 0.15, `child intersects or brushes chimney: ${nearest} m`);
  console.log(`green cottage: posed child clears rendered chimney by ${nearest.toFixed(3)} m`);
}
for (const fps of !only || only === 'cat' ? [30, 60, 120] : []) {
  for (const pace of ['walk', 'run']) {
    const cat = new Cat(); cat.visible = true;
    cat.place(CAT_LANDING, Math.atan2(CAT_EDGE.x - CAT_LANDING.x, CAT_EDGE.z - CAT_LANDING.z), { pose: 'stand', floor: catRoof });
    cat.run([CAT_EDGE], catRoof, { pace, speed: pace === 'walk' ? 0.55 : 3.2, then: 'sit' });
    let lowest = Infinity, pitch = 0;
    for (let i = 0; i < fps * 11; i++) {
      cat.update(1 / fps);
      pitch = Math.max(pitch, Math.abs(cat.fwd.y));
      if (i % Math.round(fps / 10)) continue;
      catVertices(cat, (p, bone) => { if (bone <= 3) lowest = Math.min(lowest, p.y - catRoof(p.x, p.z)); });
    }
    assert(pitch > 0.4, `cat stayed horizontal at ${fps} fps: ${pitch}`);
    assert(lowest > -0.02, `cat body cut through its roof at ${fps} fps: ${lowest}`);
    console.log(`cat ${pace} descent ${fps} fps: body clearance ${lowest.toFixed(3)} m, pitch ${pitch.toFixed(3)}`);
  }
}
for (const name of !only || only === 'child' ? ['laneWall', 'strand', 'barnRidge', 'laneEast', 'granaryWest', 'naveRidge'] : []) {
  const child = new Traveller(wind), deck = WAY[name];
  child.decks = [deck]; child.dismount(); child.sitting = false;
  const dx = deck.x1 - deck.x0, dz = deck.z1 - deck.z0;
  child.place(deck.x0 + dx * 0.15, deck.z0 + dz * 0.15, Math.atan2(dx, dz));
  const rig = child.rig, mesh = rig.mesh, p = mesh.geometry.attributes.position;
  const soles = [];
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.015) soles.push(i);
  for (let i = 0; i < 120; i++) child.update(1 / 60);
  child.walkTo(deck.x0 + dx * 0.85, deck.z0 + dz * 0.85, false, undefined, 0.1);
  let highest = 0, lowest = 0, lowAt;
  for (let i = 0; i < 240; i++) {
    child.update(1 / 60);
    if (child.speed < 0.5) continue;
    rig.root.updateMatrixWorld(true); mesh.skeleton.update();
    let support = Infinity;
    for (const index of soles) {
      mesh.getVertexPosition(index, v).applyMatrix4(mesh.matrixWorld);
      const ground = deck.surface ? deck.surface(v.x, v.z) : deck.height;
      if (ground === null) continue;
      const gap = v.y - ground;
      support = Math.min(support, gap);
      if (gap < lowest) { lowest = gap; lowAt = { i, index, world: v.toArray(), rest: [p.getX(index), p.getY(index), p.getZ(index)], at: child.position.toArray() }; }
    }
    if (Number.isFinite(support)) highest = Math.max(highest, support);
  }
  console.log(`child ${name}: grounded boot gap ${highest.toFixed(3)} m, penetration ${lowest.toFixed(3)} m`);
  assert(highest < 0.02, `${name}: both boots above surface by ${highest}`);
  assert(lowest > -0.05, `${name}: boot intersects surface by ${lowest}: ${JSON.stringify(lowAt)}`);
}
if (!only || only === 'rescue') {
  const cast = drownedCast(wind); cast.carry = { stow() {} };
  const { boat, child, cat, village } = cast;
  boat.beach(CAT_HOLD.x, CAT_HOLD.y, CAT_HOLD_YAW); boat.launch(); boat.speed = 0;
  const s = new StrandedCat(cast, () => {});
  s.begin(); s.to('boarding');
  village.tub.place(CAT_HOLD.x + 2, CAT_HOLD.y, 0); village.tub.held = true;
  cat.place(new THREE.Vector3(0, 0.1, 0), 0, { frame: village.tub.group, pose: 'sit' });
  const landings = [];
  for (const method of ['hop', 'leap']) {
    const original = cat[method].bind(cat);
    cat[method] = (at, opts, done) => { landings.push({ method, at: at.toArray(), frame: opts.frame }); return original(at, opts, done); };
  }
  for (let i = 0; i < 1800; i++) {
    boat.update(1 / 60, i / 60); s.update(1 / 60, i / 60); child.update(1 / 60); cat.update(1 / 60);
    if (s.released) break;
  }
  assert(s.released, 'rescue must finish');
  assert.equal(landings.length, 3, 'only boarding, cuddle, and settling at the bow');
  assert.equal(landings[0].at[2], MAST_Z, 'board beside the child');
  assert(landings[0].at[1] > SEAT_Y && landings[0].at[1] > FLOOR_Y);
  assert.equal(landings[1].frame, child.socket('cradle'));
  assert.equal(landings[2].frame, boat.group);
  assert(landings[2].at[2] > MAST_Z + 1, 'settle forward once');
  console.log('rescue: thwart → cuddle → bow, complete');
}
