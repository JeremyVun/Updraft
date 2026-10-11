import assert from 'node:assert/strict';
import './lib/typescript.mjs';
import * as THREE from 'three';
globalThis.location = { search: '' };
const { RotaryWashing, ROTARY_ROUTE } = await import('../src/world/lines-rotary.ts');
const { tuning } = await import('../src/tuning.ts');
const k = tuning.rotaryWashing;
const wind = { calm: 0, air: { x: 0, z: 0, energy: 0, lift: 0 }, splats: [],
  sample(x,z,out) { return Object.assign(out, this.air); },
  addSplat(s) { this.splats.push(s); Object.assign(this.air, { x:s.vx, z:s.vz, energy:s.energy }); } };
for (const fps of [30,60,120]) for (const direction of [-1,1]) {
  const pair = new RotaryWashing(); pair.active = true;
  const [near,far] = pair.rotors;
  const step = seconds => { for(let i=0;i<fps*seconds;i++)pair.update(1/fps,wind); };
  Object.assign(wind.air,{x:20,z:12,energy:1,lift:3}); step(30);
  assert.equal(far.unhook,0); assert.equal(near.angle,k.startAngle);
  const cam=new THREE.PerspectiveCamera(38,1600/900,.1,1000);
  cam.position.copy(near.top).add(new THREE.Vector3(0,3,25));cam.lookAt(near.top);cam.updateMatrixWorld();
  const input={present:true,muted:false,gust:14,charge:1,updraftAt:far.snagPoint.clone().add(new THREE.Vector3(20,0,0)),
    prevNdc:new THREE.Vector2(-.99,-.99),ndc:new THREE.Vector2(-.9,-.99)};
  for(let i=0;i<fps*8;i++){pair.brush(cam,input,wind);pair.update(1/fps,wind);}
  assert.equal(far.unhook,0,'distant circles cannot free the hem');
  input.updraftAt.copy(far.snagPoint);input.muted=true;
  for(let i=0;i<fps*8;i++){pair.brush(cam,input,wind);pair.update(1/fps,wind);}
  assert.equal(far.unhook,0,'muted gestures ignored');input.muted=false;
  input.charge=0;
  function stroke(r) {
    const p=r.clothPoint(1,.5,2,new THREE.Vector3()),a=p.clone().project(cam);
    const tangent=new THREE.Vector3(p.z-r.foot.z,0,r.foot.x-p.x).normalize();
    const b=p.clone().addScaledVector(tangent,direction).project(cam);
    input.prevNdc.set(a.x,a.y);input.ndc.set(b.x,b.y);r.touchedAt.copy(p);r.brush(cam,input,wind);
  }
  for(let i=0;i<fps*.6;i++){stroke(near);pair.update(1/fps,wind);}
  assert(direction*(near.angle-k.startAngle)>.1 && !near.aligned,'stroke turns promptly');step(15);
  const held=near.angle;step(15);assert(Math.abs(near.angle-held)<.001,'partial turn stays put');
  for(let i=0;i<fps*15&&!near.open;i++){stroke(near);pair.update(1/fps,wind);}
  assert(near.open && !pair.open,'one aligned rotor cannot open passage');
  for(let i=0;i<fps*8;i++){stroke(far);pair.update(1/fps,wind);}
  assert(Math.abs(far.angle-k.startAngle)<=k.snagTurn+1e-8 && !far.aligned,'tether limits both directions');
  input.charge=1;input.updraftAt.copy(far.snagPoint);Object.assign(wind.air,{lift:3});
  for(let i=0;i<fps*5;i++){pair.brush(cam,input,wind);pair.update(1/fps,wind);}
  assert.equal(far.unhook,1,'local updraft frees snag');input.charge=0;
  for(let i=0;i<fps*20&&!pair.open;i++){stroke(far);pair.update(1/fps,wind);}
  assert(pair.open,'both independently align');step(15);
  assert(Math.abs(Math.sin(near.angle))<1e-8 && Math.abs(Math.sin(far.angle))<1e-8);
  pair.reset(true);assert(pair.open,'legacy restore bypasses both');pair.reset();assert(!pair.open && near.angle===k.startAngle && far.unhook===0);
  console.log(`PASS ${fps} Hz, direction ${direction}: local lifting, responsive turns, persistent progress, tether, independent catches, restore`);
}
assert(Math.hypot(k.x-k.farX,k.z-k.farZ)>2*k.radius+2,'swept circles do not meet');
assert(ROTARY_ROUTE[0].x>k.x+2 && ROTARY_ROUTE[2].x<k.farX-2,'route follows the two bare halves');

for (const direction of [-1,1]) {
  const pair=new RotaryWashing();pair.active=true;const r=pair.rotors[0];
  const cam=new THREE.PerspectiveCamera(40,1.6,.1,1000);
  cam.position.set(7,r.top.y+3,-251);cam.lookAt(14.5,r.top.y-2.7,-282.5);cam.updateMatrixWorld();
  const p=r.clothPoint(1,.24,2.5,new THREE.Vector3());
  const tangent=new THREE.Vector3(p.z-r.foot.z,0,r.foot.x-p.x).normalize();
  const a=p.clone().addScaledVector(tangent,-2.6*direction).project(cam);
  const b=p.clone().addScaledVector(tangent,2.6*direction).project(cam);
  const input={present:true,muted:false,gust:2,charge:0,prevNdc:new THREE.Vector2(a.x,a.y),ndc:new THREE.Vector2(a.x,a.y)};
  let contacts=0,last=0;
  Object.assign(wind.air,{x:0,z:0,energy:0,lift:0});
  for(let i=1;i<=90;i++){
    input.prevNdc.copy(input.ndc);input.ndc.set(a.x+(b.x-a.x)*i/90,a.y+(b.y-a.y)*i/90);
    const continuous=r.brushAge<k.airMemory;
    pair.brush(cam,input,wind);
    if(r.brushAge===0){
      if(continuous&&last)assert.equal(r.direction,last,'moving cloth cannot reverse one continuous stroke');
      last=r.direction;contacts++;
    }
    pair.update(1/60,wind);
  }
  assert(contacts>15,'test contacts the moving visible sheets');
  assert(Math.abs(r.angle-k.startAngle)>.3,'a slow sweep visibly turns the frame');
}
console.log('PASS: real screen hit selection holds the direction of each uninterrupted sweep');
