// Keep the child and instrument visible through every expanding piano response.
// node tools/piano-frame-check.mjs
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location={search:'?shot'};
globalThis.window={innerWidth:1600,innerHeight:900,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {PianoStop}=await import('../src/story/piano.ts');
const {piano}=await import('../src/world/piano.ts');
const {CameraRig}=await import('../src/camera.ts');
const {heightAt}=await import('../src/world/island.ts');
const {tuning}=await import('../src/tuning.ts');
// The actual approach hands camera ownership to the piano while the child is still on its slope.
// Keep both in frame through that handoff, including a player approaching from either side.
for(const [w,h] of [[1280,800],[390,844]])for(const bearing of [-1.1,0,1.1]){
 const stop=new PianoStop(),rig=new CameraRig();rig.resize(w,h);stop.beat='walking';
 const child=stop.approachChild;
 const shot={target:new THREE.Vector3(),distance:36,height:13};
 for(let f=0;f<=600;f++){
  const gap=26*(1-f/600);
  child.set(piano.stand.x+Math.sin(bearing)*gap,0,piano.stand.z+Math.cos(bearing)*gap);
  child.y=Math.max(0,heightAt(child.x,child.z))+1.2;
  if(f===0){shot.target.copy(child);rig.cut(shot);}
  stop.now=f/60;const pace=stop.frame(shot);rig.update(1/60,stop.now,shot,pace,true);
  const p=child.clone().project(rig.camera);
  assert(p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.95,`approaching child clipped at ${w}x${h}, ${bearing}, ${gap}`);
 }
}
console.log('Piano approach keeps the walking child visible from three directions in landscape and portrait.');
for(const [w,h] of [[1600,900],[2048,1023],[390,844]])for(let stage=1;stage<=4;stage++){
 const stop=new PianoStop(),rig=new CameraRig();rig.resize(w,h);stop.beat='seated';
 const shot={target:new THREE.Vector3(),distance:19,height:4};stop.frame(shot);rig.cut(shot);
 stop.responseAt=1;stop.heardTo=stage;if(stage===4){stop.roseFrom=1;stop.answered=true;}
 let worst=0;
 for(let f=0;f<600;f++){
  stop.now=f/60;const pace=stop.frame(shot);rig.update(1/60,stop.now,shot,pace);
  for(const at of [piano.seat.clone().add(new THREE.Vector3(0,1.2,0)),piano.keys]){
   const p=at.clone().project(rig.camera);worst=Math.max(worst,Math.abs(p.x),Math.abs(p.y));
   assert(Math.abs(p.x)<.94&&Math.abs(p.y)<.94,'subjects clipped during reward');
  }
 }
 console.log({viewport:[w,h],stage,worst});
}
for(const [w,h] of [[1280,800],[390,844]]){
 const stop=new PianoStop(),rig=new CameraRig();rig.resize(w,h);stop.beat='seated';
 const shot={target:new THREE.Vector3(),distance:19,height:4};
 stop.heardTo=3;stop.responseAt=1;stop.now=10;stop.frame(shot);rig.cut(shot);
 const before={distance:shot.distance,height:shot.height,target:shot.target.clone()};
 stop.heardTo=4;stop.responseAt=stop.now;stop.answered=true;stop.frame(shot);
 assert.equal(shot.distance,before.distance,'Final answer pulls the camera inward');
 assert.equal(shot.height,before.height,'Final answer lowers the camera');
 assert(shot.target.distanceTo(before.target)<1e-6,'Final answer resets the gaze');
 stop.now+=tuning.piano.finaleWaveAfter;stop.roseFrom=stop.now;stop.frame(shot);
 assert.equal(shot.distance,before.distance,'Final reveal restarts from the close playing view');
 assert.equal(shot.height,before.height,'Final reveal resets camera height');
 assert(shot.target.distanceTo(before.target)<1e-6,'Final reveal resets the gaze');
 const child=piano.seat.clone().add(new THREE.Vector3(0,1.2,0));
 const initialGap=rig.camera.position.distanceTo(child);
 let previous=shot.distance;
 for(let f=1;f<=tuning.piano.riseFor*60;f++){
  stop.now=stop.roseFrom+f/60;
  const pace=stop.frame(shot);rig.update(1/60,stop.now,shot,pace);
  assert(shot.distance>=previous,'Final reveal reverses its widening');previous=shot.distance;
  assert(rig.camera.position.distanceTo(child)>=initialGap-.2,'Final reveal visibly pulls toward the child');
 }
}
console.log('The final piano response continues outward from the settled third response in landscape and portrait.');
