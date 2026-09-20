import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location={search:'?shot'};
const {frameTiming}=await import('../src/gl/frame-time.ts');
const {PointerInput}=await import('../src/input/pointer.ts');
for(const fps of [10,12,15,20,30,59,60,90,120,144,240]) {
 let advanced=0;
 for(let i=0;i<fps;i++){
  const plan=frameTiming(1/fps);assert(plan.steps<=3);assert(plan.stepDt<=1/30+1e-10);
  advanced+=plan.steps*plan.stepDt;
 }
 assert(Math.abs(advanced-1)<1e-10,`${fps} fps must advance one second`);
}
assert.deepEqual(frameTiming(2),{dt:.1,steps:3,stepDt:1/30});
assert.deepEqual(frameTiming(1/60),{dt:1/60,steps:1,stepDt:1/60},'no backlog after a stall');
for(const dt of [0,-1,NaN,Infinity])assert.equal(frameTiming(dt).steps,0);

// A 100 ms screen stroke must equal six 60 Hz samples, including direct screen-space brushing.
const camera=new THREE.PerspectiveCamera(50,1,.1,1000);camera.position.set(0,12,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const make=()=>{const input=new PointerInput({addEventListener(){}});input.pick=(_c,ndc,out)=>out.set(ndc.x*10,0,ndc.y*10);input.present=true;input.update(1/60,camera,{addSplat(){}});return input};
function stroke(catchUp){
 const input=make(),splats=[],segments=[];
 const wind={addSplat:s=>{const {source,...v}=s;splats.push(v)}};
 if(catchUp){input.eventNdc.set(.6,.3);input.beginFrame()}
 for(let i=1;i<=6;i++){
  if(!catchUp)input.eventNdc.set(.6*i/6,.3*i/6);
  input.update(1/60,camera,wind,catchUp?i/6:undefined);
  segments.push([input.prevNdc.x,input.ndc.x]);
 }
 return {input,splats,segments};
}
const slow=stroke(true),fast=stroke(false);
assert(Math.abs(slow.input.gust-fast.input.gust)<1e-9);
for(let i=0;i<slow.splats.length;i++)for(const key of ['ax','az','bx','bz','vx','vz','energy'])assert(Math.abs(slow.splats[i][key]-fast.splats[i][key])<1e-9,key);
for(const [a,b] of slow.segments)assert(Math.abs(b-a-.1)<1e-9,'each substep brushes only its own segment');
const fresh=make();fresh.hasPrev=false;fresh.eventNdc.set(-.8,.7);fresh.beginFrame();let emitted=0;
for(let i=1;i<=6;i++)fresh.update(1/60,camera,{addSplat(){emitted++}},i/6);
assert.equal(emitted,0,'new contact cannot bridge to the previous one during catch-up');
console.log('Frame timing: 10–240 fps, three world/six wind step cap, no backlog, safe dt, resampled gestures and fresh contacts passed.');

assert.equal(frameTiming(1/59).steps,1,'normal frame jitter must not double CPU simulation work');
