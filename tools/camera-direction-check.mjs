// Camera behavior under changed routes, frame rates, viewport shapes and competing framing constraints.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(s,c,next) { return next(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c); },
  load(u,c,next) { return u.endsWith('.ts')?{format:'module',shortCircuit:true,
    source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:next(u,c); },
});
globalThis.location={search:'?shot'};
const {CameraRig}=await import('../src/camera.ts');
const {CameraDirection}=await import('../src/camera-direction.ts');
const {tuning}=await import('../src/tuning.ts');
const origin=new THREE.Vector3(-3000,2,-3000);
const shot=()=>({target:origin.clone(),distance:20,height:5,from:new THREE.Vector3(0,0,1)});
const samples=[];
// A reverse angle travels around the subject, without a close pass through it or an abrupt angular start.
for(const fps of [10,30,60,120]) {
  const s=shot(),r=new CameraRig();r.resize(1600,900);r.cut(s);s.from.set(0,0,-1);
  let minRadius=Infinity,maxSpeed=0,previous=0,firstSpeed=0;
  for(let i=1;i<=fps*16;i++) {
    r.update(1/fps,i/fps,s,.65);
    const angle=Math.atan2(r.eye.x-r.look.x,r.eye.z-r.look.z);
    const speed=Math.abs(Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous)))*fps;
    if(i===1)firstSpeed=speed;
    maxSpeed=Math.max(maxSpeed,speed);previous=angle;
    minRadius=Math.min(minRadius,Math.hypot(r.eye.x-r.look.x,r.eye.z-r.look.z));
  }
  assert(minRadius>19.99,'turn must not shorten the subject distance');
  assert(maxSpeed<=tuning.cinematography.maxTurnSpeed+1e-8,'bounded turn rate');
  assert(firstSpeed<maxSpeed*.96,'turn eases in');
  assert(Math.abs(Math.abs(previous)-Math.PI)<.005,'reverse angle completes');
  samples.push({fps,minRadius,maxSpeed,final:previous});
}
// Near-antipodal route noise cannot reverse a turn that has already begun.
{
  const r=new CameraRig(),s=shot();r.cut(s);let sign=0;
  for(let i=0;i<180;i++){
    const bearing=Math.PI+Math.sin(i*1.3)*.015;s.from.set(Math.sin(bearing),0,Math.cos(bearing));
    r.update(1/60,i/60,s,.6);
    if(i===1)sign=Math.sign(r.turnSpeed);
    if(i>1)assert(Math.sign(r.turnSpeed)===sign,'route noise reversed the orbit');
  }
}
// Fast legitimate travel is carried even at 10 Hz. A new chapter's differently offset anchor is not a teleport.
for(const fps of [10,30,60,120]) {
  const s=shot(),r=new CameraRig(),anchor=origin.clone();s.carry=true;s.carryAnchor=anchor;r.cut(s);
  const before=r.eye.clone().sub(anchor);
  for(let i=1;i<=fps*2;i++){anchor.x+=12/fps;s.target.x+=12/fps;r.update(1/fps,i/fps,s,.6);}
  assert(r.eye.clone().sub(anchor).distanceTo(before)<1e-7,`carry at ${fps} Hz`);
  const eye=r.eye.clone();s.carryAnchor=anchor.clone().add(new THREE.Vector3(.8,0,0));
  r.update(1/fps,2,s,.6);assert(r.eye.distanceTo(eye)<1e-7,'anchor identity change does not carry an offset');
  const frozen=r.camera.position.clone();r.update(0,100,s,.6);assert(r.camera.position.equals(frozen),'zero-time updates do not move');
}
// Attention moves the lens independently of physical travel, without mutating the chapter's preferred shot.
{
  const d=new CameraDirection(),s=shot(),eye=origin.clone().add(new THREE.Vector3(0,5,20)),look=new THREE.Vector3();
  s.attention={point:origin.clone().add(new THREE.Vector3(30,0,-20)),strength:1,weight:.35};
  const originalEye=eye.clone(),originalTarget=s.target.clone();d.compose(s,eye,look);
  assert(eye.equals(originalEye));assert(look.distanceTo(originalTarget)>10);assert(s.target.equals(originalTarget));
  s.attention.strength=0;d.compose(s,eye,look);assert(look.equals(s.target));
}
// Composition decisions persist; small noise cannot cause alternating camera sides.
{
  const d=new CameraDirection(),s=shot(),camera=new THREE.PerspectiveCamera(62,390/844,.5,7000);
  s.subjects={primary:origin.clone(),secondary:origin.clone().add(new THREE.Vector3(35,0,-8)),margin:.8,extra:40};
  const base=origin.clone().add(new THREE.Vector3(0,5,20)),eye=new THREE.Vector3();
  let switches=0,last=0,lastSwitch=-100;
  for(let i=0;i<60*18;i++) {
    s.subjects.secondary.z=origin.z-8+Math.sin(i*1.7)*.04;
    eye.copy(base);d.adapt(1/60,s,eye,s.target,camera,false);
    if(d.wanted!==last){assert(i/60-lastSwitch>=tuning.cinematography.holdFor-.02);lastSwitch=i/60;switches++;last=d.wanted;}
    assert(Math.abs(d.offset)<=tuning.cinematography.freedom+1e-9);
  }
  assert(switches>0&&switches<4,'recompose usefully without restless switching');
  assert(d.score(d.wanted,s,base,s.target,camera)<d.score(0,s,base,s.target,camera),'new view needs less retreat');
  for(let i=0;i<60*12;i++){eye.copy(base);d.adapt(1/60,s,eye,s.target,camera,true);}
  assert(Math.abs(d.offset)<.001,'interaction returns gently to its authored composition');
}
// An exact threshold move clears old motion/fitting state and stays exact even below the terrain clearance.
{
  const r=new CameraRig(),s=shot();r.cut(s);s.from.set(1,0,0);r.update(.1,1,s,1);
  const exact={target:origin.clone(),eye:origin.clone().add(new THREE.Vector3(2,-1,4)),distance:4,height:0,exact:true,fitWidth:true};
  r.cut(exact);assert(r.camera.position.equals(exact.eye));
  r.update(.1,2,exact);assert(r.camera.position.equals(exact.eye));assert.equal(r.turnSpeed,0);
  const before=r.camera.position.clone();exact.exact=false;exact.composition='hold';
  exact.eye.y+=4;r.update(1/60,2.02,exact);assert(r.eye.distanceTo(before)<.1,'exit resumes from the exact position');
}
// Portrait resize keeps the primary readable; ordinary aspect changes do not reset the shot's direction.
{
  const r=new CameraRig(),s=shot();s.subjects={primary:origin.clone(),secondary:origin.clone().add(new THREE.Vector3(15,0,0)),margin:.8,extra:30};
  r.resize(1600,900);r.cut(s);r.resize(320,900);
  for(let i=0;i<120;i++){r.update(1/60,i/60,s,.6);const p=s.subjects.primary.clone().project(r.camera);
    assert(Math.abs(p.x)<.95&&Math.abs(p.y)<.95&&p.z<1);}
}
// A scene can name several bounds without shrinking the travellers to accommodate an unbounded target.
{
  const r=new CameraRig(),s=shot();r.resize(390,844);
  s.subjects={primary:origin.clone(),secondary:origin.clone().add(new THREE.Vector3(5,0,0)),
    points:[origin.clone().add(new THREE.Vector3(-12,8,-8)),origin.clone().add(new THREE.Vector3(16,14,-6)),
      origin.clone().add(new THREE.Vector3(3,21,-10))],margin:.8,extra:60};
  r.cut(s);
  for(const point of [s.subjects.primary,s.subjects.secondary,...s.subjects.points]){
    const p=point.clone().project(r.camera);assert(Math.abs(p.x)<=.801&&Math.abs(p.y)<=.801&&p.z<1,'whole scene fits');
  }
  s.subjects.points[0].x+=2000;s.subjects.extra=5;r.cut(s);
  const primary=s.subjects.primary.clone().project(r.camera);
  assert(Math.abs(primary.x)<=.801&&Math.abs(primary.y)<=.801,'primary wins when the group cannot fit');
}
// Amortized CPU cost of attention and candidate evaluation, including the twice-a-second terrain samples.
const costs=[];
for(const [name,at] of [['sea',[-3000,2,-3000]],['meadow',[5,20,-780]],['birches',[-15,8,-1090]],['wood',[-20,4,-1750]]]) {
  const timings=[],reviewCosts=[],anchor=new THREE.Vector3(...at);
  for(let run=0;run<5;run++) {
    const d=new CameraDirection(),s=shot(),eye=new THREE.Vector3(),look=new THREE.Vector3(),camera=new THREE.PerspectiveCamera(62,.46,.5,7000);
    s.target.copy(anchor);
    s.subjects={primary:anchor.clone(),secondary:anchor.clone().add(new THREE.Vector3(25,0,-8)),margin:.8,extra:40};
    s.attention={point:s.subjects.secondary,strength:.7,weight:.3};
    let start=performance.now();
    for(let i=0;i<12000;i++) {eye.copy(anchor).addScalar(12);d.compose(s,eye,look);d.adapt(1/60,s,eye,look,camera,false);}
    timings.push((performance.now()-start)/12000);
    start=performance.now();
    for(let i=0;i<600;i++) {eye.copy(anchor).addScalar(12);d.compose(s,eye,look);d.adapt(.5,s,eye,look,camera,false);}
    reviewCosts.push((performance.now()-start)/600);
  }
  timings.sort((a,b)=>a-b);reviewCosts.sort((a,b)=>a-b);
  costs.push({name,millisecondsPerUpdate:timings[2],millisecondsPerReview:reviewCosts[2]});
}
const report={turns:samples,costs};
fs.writeFileSync('/tmp/updraft-camera-direction.json',JSON.stringify(report,null,2));
console.log('Camera direction: orbital clearance, eased/rate-limited turns, 10–120 Hz carry, attention, decision persistence, interaction hold, exact paths and portrait resizing passed.');
console.log(JSON.stringify(report));
