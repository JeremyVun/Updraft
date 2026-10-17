// Real return flight, posed child surface, mitten contact and onward handoff.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { transformSync } from 'rolldown/utils';
if (process.env.NEGATIVE) registerHooks({
  load(url, context, next) {
    if (!url.endsWith('/src/story/plane-arrival.ts')) return next(url, context);
    const source = execFileSync('git', ['show', 'db31c945e2bca3dac5c54440de27448721e458aa:src/story/plane-arrival.ts'], { encoding: 'utf8' });
    return { format: 'module', shortCircuit: true, source: transformSync('plane-arrival.ts', source).code };
  },
});
globalThis.location = { search: '?shot' };
globalThis.window = { innerWidth: 1600, innerHeight: 900, matchMedia: () => ({ matches: false }) };
globalThis.document = { createElement: () => ({ getContext: () => ({ beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {} }) }) };
const { Traveller } = await import('../src/traveller/traveller.ts');
const { Glider, PAPER_GRIP } = await import('../src/glider/glider.ts');
const { PlaneArrival } = await import('../src/story/plane-arrival.ts');
const { BONE } = await import('../src/traveller/body.ts');
const { heightAt } = await import('../src/world/island.ts');
const wind = { breeze: new THREE.Vector2(), calm: 0, addSplat() {},
  sample(x, z, out) { return Object.assign(out, { x: 24, z: -20, energy: 1, lift: 1 }); } };
const v = new THREE.Vector3(), w = new THREE.Vector3(), hand = new THREE.Vector3();
const ray = new THREE.Raycaster();
let cases = 0, maxStep = 0, maxGripGap = 0, bodyHits = 0;
for (const fps of process.env.QUICK ? [60] : [30, 60, 120]) for (const height of process.env.QUICK ? [6] : [2, 6, 18]) for (let bearing = 0; bearing < (process.env.QUICK ? 1 : 8); bearing++) {
  const child = new Traveller(wind), plane = new Glider(wind, []);
  child.standUp(); child.place(14, -597.36, 0);
  for (let i = 0; i < fps; i++) child.update(1 / fps);
  const angle = bearing * Math.PI / 4;
  plane.launch(child.position.clone().add(new THREE.Vector3(Math.sin(angle) * 12, height, Math.cos(angle) * 12)),
    new THREE.Vector3(-Math.sin(angle) * 10, -2, -Math.cos(angle) * 10));
  plane.position.y = Math.max(plane.position.y, heightAt(plane.position.x, plane.position.z) + 1.8);
  const arrival = new PlaneArrival(), cast = { child, plane, carry: { busy: false } };
  let done = 0, attached = false, catchJump = 0;
  const mesh = child.rig.mesh, paper = plane.group.children[0], positions = paper.geometry.attributes.position;
  const before = plane.position.clone();
  const surface = new THREE.Mesh(mesh.geometry.clone(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const hold = plane.hold.bind(plane);
  plane.hold = c => { const at = plane.position.clone(); hold(c); catchJump = Math.max(catchJump, at.distanceTo(plane.position)); };
  for (let frame = 0; frame < fps * 20; frame++) {
    arrival.update(cast, true, () => done++);
    child.update(1 / fps); plane.update(1 / fps, frame / fps);
    maxStep = Math.max(maxStep, before.distanceTo(plane.position)); before.copy(plane.position);
    if (plane.held) {
      attached = true;
      maxGripGap = Math.max(maxGripGap, paper.localToWorld(v.copy(PAPER_GRIP)).distanceTo(child.handPosition(hand)));
    }
    if (fps === 60 && height === 6 && frame % 12 === 0 && plane.position.distanceTo(child.position) < 4) {
      child.rig.root.updateMatrixWorld(true); mesh.skeleton.update();
      const posed = surface.geometry.attributes.position;
      for (let j = 0; j < posed.count; j++) {
        mesh.getVertexPosition(j, v).applyMatrix4(mesh.matrixWorld);
        posed.setXYZ(j, v.x, v.y, v.z);
      }
      surface.geometry.computeBoundingSphere();
      for (let i = 0; i < positions.count; i++) {
        paper.localToWorld(v.fromBufferAttribute(positions, i));
        paper.localToWorld(w.fromBufferAttribute(positions, Math.floor(i / 3) * 3 + (i + 1) % 3));
        ray.set(v, w.sub(v).normalize());
        paper.localToWorld(w.fromBufferAttribute(positions, Math.floor(i / 3) * 3 + (i + 1) % 3));
        ray.far = v.distanceTo(w);
        for (const hit of ray.intersectObject(surface, false)) {
          const bones = [hit.face.a, hit.face.b, hit.face.c].map(index => mesh.geometry.attributes.skinIndex.getX(index));
          if (bones.every(b => b === BONE.handL)) continue;
          // The existing resting carry can touch the cuff; the return must also clear the sleeve.
          if (!plane.returning && bones.every(b => b === BONE.foreL)) continue;
          bodyHits++;
          assert.fail(`paper intersects child ${fps}Hz, height ${height}, bearing ${bearing}, frame ${frame}, bones ${bones}`);
        }
      }
    }
    if (done && frame > fps * 5) break;
  }
  assert.equal(done, 1, 'return completes exactly once');
  assert(attached && plane.held && !plane.returning, 'catch finishes before the next story beat');
  assert(catchJump < 1e-6, `attachment jumps ${catchJump}`);
  assert(child.reached(0) < 0.1, 'catch releases the arm for boarding');
  plane.launch(plane.position, new THREE.Vector3(0, 5, 8));
  plane.depart(new THREE.Vector3(0, 0, 1));
  assert(!plane.returning && !plane.held, 'a subsequent launch is free of return ownership');
  surface.geometry.dispose(); surface.material.dispose();
  cases++;
}
assert(maxGripGap < 1e-6, `paper grip separates from mitten by ${maxGripGap}`);
assert(maxStep < 0.6, `return has a discontinuity of ${maxStep}`);
console.log(`PASS: ${cases} catches${process.env.QUICK ? ' (focused case)' : ' at 30/60/120 Hz, eight bearings, three heights'}, sustained gusts; sampled posed surfaces clear, exact mitten attachment.`, { maxStep, maxGripGap, bodyHits });
