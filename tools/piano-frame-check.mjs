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
const {windBough}=await import('../src/world/wind-bough.ts');
const {CameraRig,FROM}=await import('../src/camera.ts');
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
// Every frame the story puts the walk's own view of her into the shot before the piano frames it.
const desk=new THREE.Vector3();piano.planeRest(desk,new THREE.Euler());
const walkView=shot=>{
 const c=piano.seat,{cameraLead,cameraBack}=tuning.meadowPlane,pw=Math.min(.25,cameraLead/Math.max(Math.hypot(desk.x-c.x,desk.z-c.z),1));
 shot.target.set(c.x+(desk.x-c.x)*pw,Math.max(c.y,0)+3,c.z+(desk.z-c.z)*pw-3);
 shot.from=undefined;shot.distance=cameraBack;shot.height=13;shot.fitWidth=false;
 return shot;
};
const child=piano.seat.clone().add(new THREE.Vector3(0,1.2,0));
const t=tuning.piano;
for(const [w,h] of [[1600,900],[2048,1023],[390,844]]){
 Object.assign(globalThis.window,{innerWidth:w,innerHeight:h});
 const stop=new PianoStop(),rig=new CameraRig();rig.resize(w,h);stop.beat='seated';
 const shot={target:new THREE.Vector3(),distance:19,height:4};
 stop.now=0;stop.frame(walkView(shot));rig.cut(shot);
 // A prompt player: each answer traced as soon as it is asked for, the finale on its cue.
 const answers=[3,15,27,39],greening=39+9.8,end=greening+t.finaleEase+3;
 let worst=0,previous=null,inward=0,lower=0,ceiling=0,atAnswer=null;
 for(let f=0;f<=end*60;f++){
  stop.now=f/60;
  const due=answers.filter(a=>a<=stop.now).length;
  if(due>stop.heardTo){
   if(due===4)atAnswer=(stop.frame(walkView(shot)),{distance:shot.distance,height:shot.height,target:shot.target.clone()});
   stop.heardTo=due;stop.responseAt=stop.now;
   if(due===4){
    stop.frame(walkView(shot));
    assert(Math.abs(shot.distance-atAnswer.distance)<1e-6&&Math.abs(shot.height-atAnswer.height)<1e-6&&shot.target.distanceTo(atAnswer.target)<1e-6,
     'The last answer moves nothing at once');
   }
  }
  if(stop.roseFrom===0&&stop.now>=greening){
   const before=(stop.frame(walkView(shot)),{distance:shot.distance,height:shot.height,target:shot.target.clone()});
   stop.roseFrom=stop.now;stop.answered=true;stop.frame(walkView(shot));
   assert(Math.abs(shot.distance-before.distance)<1e-6&&Math.abs(shot.height-before.height)<1e-6&&shot.target.distanceTo(before.target)<1e-6,
    'The finale carries on from where the last step had got to');
  }
  const pace=stop.frame(walkView(shot));rig.update(1/60,stop.now,shot,pace);
  const eye=rig.camera.position,gap=eye.distanceTo(child);
  previous={gap:Math.max(previous?.gap??0,gap),y:Math.max(previous?.y??-Infinity,eye.y)};
  inward=Math.max(inward,previous.gap-gap);lower=Math.max(lower,previous.y-eye.y);
  ceiling=Math.max(ceiling,eye.y-Math.max(heightAt(eye.x,eye.z),0));
  for(const at of [child,piano.keys,windBough.crown]){
   const p=at.clone().project(rig.camera);worst=Math.max(worst,Math.abs(p.x),Math.abs(p.y));
   assert(p.z<1&&Math.abs(p.x)<.94&&Math.abs(p.y)<.94,`subjects clipped at ${stop.now.toFixed(2)} s in ${w}x${h}`);
  }
 }
 // The lens breathes a little about where it is put; more than that would be a step back in or down.
 assert(inward<.4,`the duet camera comes ${inward.toFixed(2)} m back in toward her`);
 assert(lower<.4,`the duet camera comes ${lower.toFixed(2)} m down`);
 assert(ceiling<32,`the duet camera climbs to ${ceiling.toFixed(1)} m over the ground`);
 const walk=walkView({target:new THREE.Vector3(),distance:0,height:0});
 stop.frame(walkView(shot));
 assert(shot.target.distanceTo(walk.target)<1e-6&&Math.abs(shot.distance-walk.distance)<1e-6&&Math.abs(shot.height-walk.height)<1e-6
  &&Math.abs(Math.atan2(shot.from.x,shot.from.z)-Math.atan2(FROM.x,FROM.z))<1e-6,'the finale ends on the walk view, with nothing left to come down');
 console.log({viewport:[w,h],worst:+worst.toFixed(3),ceiling:+ceiling.toFixed(1),inward:+inward.toFixed(2),lower:+lower.toFixed(2)});
}
console.log('The duet widens with each answer and the finale to the walk view, never back in or down, under 32 m, in landscape and portrait.');
