// Rotary mechanics without a renderer: idle, screen targeting, coasting, both directions and a permanent stop.
// Run: node tools/rotary-washing-check.mjs
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.location = { search: '?shot' };
globalThis.window = { innerWidth: 1600, innerHeight: 900 };
const { RotaryWashing, ROTARY_TOP } = await import('../src/world/lines-rotary.ts');
const { tuning } = await import('../src/tuning.ts');
const k = tuning.rotaryWashing;
const wind = { calm: 0, air: { x: 0, z: 0, energy: 0, lift: 0 }, splats: [],
  sample(x,z,out) { return Object.assign(out, this.air); },
  addSplat(s) { this.splats.push(s); Object.assign(this.air, { x:s.vx, z:s.vz, energy:s.energy }); } };
for (const fps of [30,60,120]) for (const direction of [-1,1]) {
  const r = new RotaryWashing();
  r.active = true;
  Object.assign(wind.air, {x:20,z:12,energy:1});
  for (let i=0;i<fps*60;i++) r.update(1/fps, wind);
  assert.equal(r.angle,0,'ambient and unrelated wind never rotate it');
  const cam = new THREE.PerspectiveCamera(38,1600/900,.1,1000);
  cam.position.copy(ROTARY_TOP).add(new THREE.Vector3(25,3,10));
  cam.lookAt(ROTARY_TOP); cam.updateMatrixWorld();
  const p=r.clothPoint(1,.5,2,new THREE.Vector3());
  const projected=p.clone().project(cam);
  const tangent = new THREE.Vector3(p.z-k.z,0,k.x-p.x).normalize();
  const end=p.clone().addScaledVector(tangent,direction*2).project(cam);
  const input={present:true,muted:true,gust:18,prevNdc:new THREE.Vector2(projected.x,projected.y),ndc:new THREE.Vector2(end.x,end.y)};
  const before=wind.splats.length;
  r.brush(cam,input,wind);
  assert.equal(wind.splats.length,before,'muted input ignored');
  input.muted=false; input.prevNdc.set(-.99,-.99); input.ndc.set(-.9,-.99);
  r.brush(cam,input,wind);
  assert.equal(wind.splats.length,before,'off-target input ignored');
  input.prevNdc.set(projected.x,projected.y); input.ndc.set(end.x,end.y);
  r.brush(cam,input,wind);
  assert(wind.splats.length>before,'visible cloth receives a splat');
  for(let i=0;i<fps*3;i++) {
    r.clothPoint(1,.5,2,r.touchedAt); r.brushAge=0;
    const tx=r.touchedAt.z-k.z,tz=k.x-r.touchedAt.x,len=Math.hypot(tx,tz);
    Object.assign(wind.air,{x:direction*tx/len*16,z:direction*tz/len*16,energy:.6});
    r.update(1/fps,wind);
  }
  assert(direction*r.angle>0.5 && !r.caught,'partial turn has not solved the puzzle');
  for(let i=0;i<fps*12;i++) r.update(1/fps,wind);
  const coast=r.angle;
  for(let i=0;i<fps*12;i++) r.update(1/fps,wind);
  assert(Math.abs(coast-r.angle)<.001,'coasting holds progress');
  for(let i=0;i<fps*20 && !r.open;i++) {
    r.clothPoint(1,.5,2,r.touchedAt); r.brushAge=0;
    const tx=r.touchedAt.z-k.z,tz=k.x-r.touchedAt.x,len=Math.hypot(tx,tz);
    Object.assign(wind.air,{x:direction*tx/len*16,z:direction*tz/len*16,energy:.6});
    r.update(1/fps,wind);
  }
  assert(r.open,`${fps} Hz direction ${direction} reaches the open stop`);
  for(let i=0;i<fps*10;i++) r.update(1/fps,wind);
  assert(Math.abs(r.angle-direction*Math.PI)<1e-8,'stop holds');
  const open=wind.splats.length;
  r.brush(cam,input,wind); assert.equal(wind.splats.length,open,'solved rotor ignores further gestures');
  r.reset(true); assert(r.open && r.angle===Math.PI,'restoration starts open');
  r.reset(); assert(!r.open && r.angle===0,'new visit starts closed');
  console.log(`PASS ${fps} Hz, direction ${direction}: idle, targeting, coasting, opening and reset`);
}
