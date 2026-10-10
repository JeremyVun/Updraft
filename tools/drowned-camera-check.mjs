// Real village, boat, cast and camera: the entry's lens behind the boat before the rescue view takes over, and
// the storm's sailing view through to the forest beach: lighthouse framed as its light goes out, child and hull in
// frame and clear of the roofs, turns continuous, at 30/60fps, calm and gusting, both aspects.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
const { drownedCast, stormCast } = await import('./lib/storm-cast.mjs');
const { DrownedChapter } = await import('../src/story/drowned.ts');
const { CameraRig } = await import('../src/camera.ts');
const { LIGHTHOUSE } = await import('../src/world/drowned.ts');
const { LIGHTHOUSE_LANTERN_Y } = await import('../src/world/lighthouse.ts');
const { tuning } = await import('../src/tuning.ts');
const { sceneryLift } = await import('../src/camera-obstacles.ts');
const lamp = new THREE.Vector3(LIGHTHOUSE.x, LIGHTHOUSE_LANTERN_Y, LIGHTHOUSE.z);
const results = [];
for (const [fps, portrait, gust] of [[30, false, 0], [60, true, 0], [30, true, 8], [60, false, 8]]) {
  let push = gust;
  const base = new THREE.Vector2(Math.cos(-Math.PI / 10), Math.sin(-Math.PI / 10)).multiplyScalar(tuning.wind.breeze);
  const wind = { breeze: base.clone(), calm: 3, addSplat() {}, sample(x, z, out) { return Object.assign(out,
    { x: this.breeze.x + push, z: this.breeze.y - push, energy: push ? .8 : 0, lift: 0 }); } };
  let sample = { phase: 'entry', fps, portrait, gust, time: 0 };
  const edge = (camera, point) => {
    const p = point.clone().project(camera);
    assert(p.z < 1, `point behind lens: ${JSON.stringify({ ...sample, point: point.toArray(), eye: camera.position.toArray(), projected: p.toArray() })}`);
    return Math.max(Math.abs(p.x), Math.abs(p.y));
  };
  const rigFor = (chapter) => {
    const rig = new CameraRig();
    rig.resize(portrait ? 390 : 1600, portrait ? 844 : 900);
    chapter.afterCamera(rig.camera);
    chapter.update(0, 0);
    rig.cut(chapter.shot);
    return rig;
  };
  const step = (chapter, cast, rig, dt, t) => {
    wind.breeze.copy(base).multiplyScalar(chapter.breeze);
    wind.calm = wind.breeze.length() * tuning.wind.calm;
    chapter.update(dt, t); cast.boat.swell = chapter.storm; cast.boat.update(dt, t); rig.update(dt, t, chapter.shot, chapter.pace);
    chapter.afterCamera(rig.camera);
  };

  /** The first four seconds precede the cat's rescue framing. Measure the rendered lens, not a private bearing. */
  let minArc = Infinity, maxArc = -Infinity, driftChild = 0;
  {
    const cast = drownedCast(wind), chapter = new DrownedChapter(cast), rig = rigFor(chapter);
    for (let i = 1; i <= fps * 4; i++) {
      sample.time = i / fps;
      step(chapter, cast, rig, 1 / fps, i / fps);
      assert(chapter.beat === 'enter' || chapter.beat === 'drift', 'the entry is still sailing');
      const bearing = Math.atan2(rig.camera.position.x - cast.boat.position.x,
        rig.camera.position.z - cast.boat.position.z) - cast.boat.yaw - Math.PI;
      const arc = Math.atan2(Math.sin(bearing), Math.cos(bearing));
      minArc = Math.min(minArc, arc); maxArc = Math.max(maxArc, arc);
      driftChild = Math.max(driftChild, edge(rig.camera, cast.child.position.clone().add(new THREE.Vector3(0, 1.2, 0))));
    }
    assert(Number.isFinite(minArc), 'the drift never began');
    assert(Math.max(Math.abs(minArc), Math.abs(maxArc)) < Math.PI / 3, `entry camera stays on the stern quarter: ${minArc}, ${maxArc}`);
    assert(driftChild < 1, `child out of frame in the drift: ${driftChild}`);
  }

  /** The church browser check covers the close farewell; hull framing begins once its departure dolly ends. */
  const { cast, chapter } = stormCast(wind), boat = cast.boat, child = cast.child, village = cast.village;
  const rig = rigFor(chapter);
  let worstChild = 0, worstAt = null, worstHull = 0, hullAt = null, lampWorst = 0, lampAt = null, maxTurn = 0, turnAt = null, maxElevation = 0, elevationAt = null;
  let obscured = 0, streak = 0, worstStreak = 0, blockedAt = null;
  const lastView = new THREE.Vector3(), view = new THREE.Vector3();
  rig.camera.getWorldDirection(lastView);
  const ray = new THREE.Ray(), hit = new THREE.Vector3();
  const s = tuning.storm;
  for (let i = 1; i < fps * 120 && !chapter.done; i++) {
    const dt = 1 / fps, t = i * dt;
    sample = { phase: 'storm', fps, portrait, gust, time: t };
    step(chapter, cast, rig, dt, t);
    rig.camera.getWorldDirection(view);
    if (chapter.stormTime <= s.leaveFor) { lastView.copy(view); continue; }
    const turn = lastView.angleTo(view);
    if (turn > maxTurn) { maxTurn = turn; turnAt = { t, beat: chapter.beat, eye: rig.camera.position.toArray() }; }
    lastView.copy(view);
    const head = child.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    ray.origin.copy(rig.camera.position); ray.direction.subVectors(head, ray.origin);
    const reach = ray.direction.length(); ray.direction.normalize();
    const blocked = village.cameraObstacles.some((box) => ray.intersectBox(box, hit) && hit.distanceTo(ray.origin) < reach - 1);
    if (blocked) {
      obscured++; streak += dt;
      if (streak > worstStreak) { worstStreak = streak; blockedAt = { t, eye: rig.camera.position.toArray() }; }
    } else streak = 0;
    const childEdge = edge(rig.camera, head);
    if (childEdge > worstChild) { worstChild = childEdge; worstAt = { t, beat: chapter.beat, boat: boat.position.toArray(), eye: rig.camera.position.toArray() }; }
    const ends = [new THREE.Vector3(), new THREE.Vector3()];
    boat.hullEnds(ends[0], ends[1]);
    const hull = Math.max(...ends.map((p) => edge(rig.camera, p)));
    if (hull > worstHull) { worstHull = hull; hullAt = { t, beat: chapter.beat, storm: chapter.stormTime }; }
    const elevation = Math.atan2(rig.camera.position.y - head.y, Math.hypot(rig.camera.position.x - head.x, rig.camera.position.z - head.z));
    if (elevation > maxElevation) { maxElevation = elevation; elevationAt = { t, beat: chapter.beat, eye: rig.camera.position.toArray() }; }
    // From the light faltering until it has gone, the lighthouse's lamp is in the frame.
    if (chapter.stormTime > s.lighthouseOutAt - s.lighthouseFadeFor && chapter.stormTime <= s.lighthouseOutAt) {
      const e = edge(rig.camera, lamp);
      if (e > lampWorst) { lampWorst = e; lampAt = { time: chapter.stormTime, eye: rig.camera.position.toArray() }; }
    }
  }
  const tag = `${fps}Hz ${portrait ? 'upright' : 'landscape'} gust=${gust}`;
  assert(chapter.done, `storm reached the beach (${tag})`);
  assert(worstChild < 1, `child: ${worstChild}, ${JSON.stringify(worstAt)} (${tag})`);
  assert(worstHull < 1, `hull out of frame: ${worstHull}, ${JSON.stringify(hullAt)} (${tag})`);
  assert(lampWorst < 0.95, `the lighthouse's lamp out of frame as its light went out: ${lampWorst}, ${JSON.stringify(lampAt)} (${tag})`);
  assert(worstStreak < .35, `scenery hides child for ${worstStreak}s: ${JSON.stringify(blockedAt)} (${tag})`);
  assert(maxTurn < .1, `the lens turned ${maxTurn} rad in a frame: ${JSON.stringify(turnAt)} (${tag})`);
  assert(maxElevation < .4, `sailing camera looks steeply down at the child: ${maxElevation * 180 / Math.PI} degrees, ${JSON.stringify(elevationAt)} (${tag})`);
  const before = performance.now();
  for (let i = 0; i < 10000; i++) sceneryLift(rig.camera.position, child.position, village.cameraObstacles, tuning.cinematography.obstacleAhead);
  const obstacleMs = (performance.now() - before) / 10000;
  results.push({ fps, portrait, gust, arc: maxArc - minArc, driftChild, maxTurn, maxElevation, obstacles: village.cameraObstacles.length, obstacleMs,
    worstChild, worstHull, lampWorst, obscured, worstStreak });
}
fs.writeFileSync('/tmp/updraft-drowned-camera.json', JSON.stringify(results, null, 2));
console.log(results.map((r) => JSON.stringify(r)).join('\n'));
console.log('Village camera: entry on the stern quarter; after the farewell dolly, the storm to the beach with the lighthouse framed as its light goes out and child and hull in frame, at 30/60fps, calm and gust, both aspects.');
