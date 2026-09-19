// Real pointer interpretation and scarf targeting at 30/60/120 Hz, with a fixed camera and no renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(s,c,n){return n(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);},
  load(u,c,n){return u.endsWith('.ts')?{format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:n(u,c);},
});
globalThis.location = { search: '?shot' };
globalThis.window = { innerHeight: 900, matchMedia: () => ({ matches: false }) };
const { BirchScarf } = await import('../src/world/birch-scarf.ts');
const { PointerInput } = await import('../src/input/pointer.ts');
const { EmberInvitation } = await import('../src/fx/ember-invitation.ts');
const { Swirl } = await import('../src/fx/swirl.ts');
const scarf = new BirchScarf(); scarf.active = 1;
const center = scarf.snags[1].center;
const camera = new THREE.PerspectiveCamera(50, 16/9, .1, 1000);
camera.position.copy(center).add(new THREE.Vector3(0, 3.8, 17)); camera.lookAt(center); camera.updateMatrixWorld();
const el = { addEventListener() {} };
const wind = { addSplat() {} };
for (const fps of [30,60,120]) for (const clockwise of [false,true]) {
  const input = new PointerInput(el); input.present = true; input.anchor = center;
  scarf.snags[1].target = 0;
  let elapsed = 0;
  for (let frame = 0; frame < fps * 12 && scarf.snags[1].target < 1; frame++) {
    elapsed = frame/fps; const a = elapsed*Math.PI*2*(clockwise?-1:1);
    input.eventNdc.set(Math.cos(a)*.15/camera.aspect, Math.sin(a)*.15);
    input.update(1/fps, camera, wind);
    scarf.brush(camera, input, wind, 1/fps);
  }
  console.log(JSON.stringify({fps,clockwise,seconds:elapsed,progress:scarf.snags[1].target,charge:input.charge}));
  assert.equal(scarf.snags[1].target,1,'Circling must release the wrap');
  assert(elapsed>1,'The wrap must require sustained circling');
  scarf.snags[1].target = 0;
  const straight = new PointerInput(el); straight.present = true; straight.anchor = center;
  for (let frame = 0; frame < fps*8; frame++) {
    straight.eventNdc.set(Math.sin(frame/fps*Math.PI*2)*.18/camera.aspect,0);
    straight.update(1/fps,camera,wind); scarf.brush(camera,straight,wind,1/fps);
  }
  assert.equal(scarf.snags[1].target,0,'Straight sweeps across the centre must never unwrap it');
}
const hint = new EmberInvitation();
const input = {present:false,muted:false,ndc:new THREE.Vector2(),prevNdc:new THREE.Vector2()};
for(let i=0;i<360;i++)hint.update(1/60,camera,center,input);
assert(hint.alpha>.6);
input.present=true;
for(let i=0;i<30;i++){
  input.prevNdc.copy(input.ndc);input.ndc.x=(i%2?1:-1)*.01;
  hint.update(1/60,camera,center,input);
}
assert(hint.alpha<.01,'The demonstration must give way to local input');
input.prevNdc.copy(input.ndc);
for(let i=0;i<180;i++)hint.update(1/60,camera,center,input);
assert(hint.alpha>.6,'An idle pointer must let the invitation return');
console.log('Both circling directions, straight-stroke rejection and invitation handover passed.');
const coils = [30,60,120].map(fps => {
  const swirl = new Swirl();
  const idle = { present:false, muted:false, charge:0, updraftAt:center.clone() };
  for(let i=0;i<fps*2;i++)swirl.update(1/fps,camera,idle,{at:center,urgency:1});
  return swirl.ghost.strands[0].points.map(p=>p.clone());
});
for(const points of coils.slice(1)) {
  assert.equal(points.length,coils[0].length,'Frame rate must not change the leading arc length');
  assert(Math.max(...points.map((p,i)=>p.distanceTo(coils[0][i])))<.1,'The same updraft must keep its shape at 30/60/120 Hz');
}
console.log('Updraft shape remains consistent at 30/60/120 Hz.');
