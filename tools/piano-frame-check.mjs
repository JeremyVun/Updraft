// Keep the child and instrument visible through every expanding piano response.
// node tools/piano-frame-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(s,c,n) { return n(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s+'.ts' : s,c); },
  load(u,c,n) { return u.endsWith('.ts') ? {format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code} : n(u,c); },
});
globalThis.location={search:'?shot'};
globalThis.window={innerWidth:1600,innerHeight:900,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {PianoStop}=await import('../src/story/piano.ts');
const {piano}=await import('../src/world/piano.ts');
const {CameraRig}=await import('../src/camera.ts');
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
