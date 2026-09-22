// Real crossing director and camera rig over controlled open-water tracks; no GPU required.
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
const { CrossingChapter, FIRST_ISLAND }=await import('../src/story/crossing.ts');
const { CameraRig }=await import('../src/camera.ts');
function fixture(farewell=false) {
  const boat={position:new THREE.Vector3(-2000,0,-2000),yaw:Math.PI,sailSide:-1,speed:5,
    seat(out){return out.copy(this.position).add(new THREE.Vector3(0,.5,1));},
    sailPoint(out){return out.copy(this.position).add(new THREE.Vector3(0,3,0));}};
  const child={position:new THREE.Vector3(),ride(p){this.position.copy(p);},wave(){}};
  const cast={boat,child,skyMirror:{progress:3},plane:{hold(){}},cygnet:{carried:false,wing:{restore(){}}},sealife:{whale:null,
    fishNear(){},dolphinsWith(){}}};
  const chapter=new CrossingChapter(cast,{route:[new THREE.Vector2(-2000,-2500)],
    ...(farewell?{lookBack:new THREE.Vector3(-2000,8,-1980),farewell:30}:{})});
  const rig=new CameraRig();return {boat,cast,chapter,rig};
}
const report=[];
for(const fps of [10,30,60,120]) for(const [w,h] of [[1600,900],[390,844]]) {
  const {boat,chapter,rig}=fixture();rig.resize(w,h);chapter.update(0);rig.cut(chapter.shot);
  let minDistance=Infinity,maxDistance=0,minAngle=Infinity,maxAngle=-Infinity,worstEdge=0;
  for(let i=1;i<=fps*99;i++) {
    boat.position.z=-2000-i/fps*5;chapter.update(1/fps);rig.update(1/fps,i/fps,chapter.shot,chapter.pace);
    minDistance=Math.min(minDistance,chapter.shot.distance);maxDistance=Math.max(maxDistance,chapter.shot.distance);
    const angle=Math.atan2(chapter.shot.from.x,chapter.shot.from.z);
    minAngle=Math.min(minAngle,angle);maxAngle=Math.max(maxAngle,angle);
    const p=chapter.shot.subjects.primary.clone().project(rig.camera);
    worstEdge=Math.max(worstEdge,Math.abs(p.x),Math.abs(p.y));
    assert(p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.95,`traveller lost at ${fps}Hz ${w}x${h}`);
  }
  assert(maxDistance-minDistance>7,'crossing must open again for arrival');
  assert(Math.max(Math.abs(minAngle),Math.abs(maxAngle))<.2,'ordinary sailing stays behind the boat');
  report.push({fps,w,h,dolly:maxDistance-minDistance,arcDegrees:(maxAngle-minAngle)*180/Math.PI,worstEdge});
}
// Farewell ends at the sailing shot, rather than asking the rig to hide a sudden second swing.
for(const portrait of [false,true]) {
  const {boat,chapter,rig}=fixture(true);rig.resize(portrait?390:1600,portrait?844:900);chapter.update(0);
  // The island hands over its boarding view; adding a distant subject must not force a framing jump.
  rig.cut({target:boat.position.clone().add(new THREE.Vector3(0,2.2,-2)),distance:26,height:6.5});
  const before=rig.camera.position.clone();chapter.update(1/60);rig.update(1/60,1/60,chapter.shot,chapter.pace);
  assert(rig.camera.position.distanceTo(before)<.1,'departure establishes its island framing without a jump');
}
{
  const {chapter}=fixture(true);chapter.time=44-1e-5;chapter.update(0);
  const from=chapter.shot.from.clone(),target=chapter.shot.target.clone(),distance=chapter.shot.distance;
  chapter.time=44;chapter.update(0);
  assert(from.distanceTo(chapter.shot.from)<1e-5&&target.distanceTo(chapter.shot.target)<1e-5);
  assert(Math.abs(distance-chapter.shot.distance)<1e-5);
}
// The whale must rotate the lens, not carry its movement into the eye and cancel the pan.
for(const [width,height] of [[1600,900],[390,844]]) {
  const {boat,cast,chapter,rig}=fixture();rig.resize(width,height);chapter.update(0);rig.cut(chapter.shot);
  const before=rig.camera.getWorldDirection(new THREE.Vector3());
  cast.sealife.whale=boat.position.clone().add(new THREE.Vector3(17,1,-58));
  for(let i=0;i<600;i++){
    chapter.update(1/60);rig.update(1/60,i/60,chapter.shot,chapter.pace);
    const p=chapter.sailingSubjects.primary.clone().project(rig.camera);
    assert(Math.abs(p.x)<1&&Math.abs(p.y)<1,'traveller retained throughout the whale pan');
  }
  const pan=before.angleTo(rig.camera.getWorldDirection(new THREE.Vector3()));
  assert(pan>.12,`whale pan too small: ${pan}`);
  for(const point of Object.values(chapter.whaleSubjects).filter(p=>p?.isVector3)) {
    const p=point.clone().project(rig.camera);
    assert(Math.abs(p.x)<.95&&Math.abs(p.y)<.95&&p.z<1,'boat and full whale share the encounter frame');
  }
  cast.sealife.whale=null;chapter.update(1/60);
  assert(chapter.shot.attention,'diving whale retains its focus while easing out');
  for(let i=0;i<180;i++)chapter.update(1/60);
  assert.equal(chapter.shot.attention,undefined,'whale focus releases');
}
// Side response is elapsed-time based; preparing a zero-time view must not advance it.
const quarters=[];
for(const fps of [10,30,60,120]) {
  const {boat,chapter}=fixture();boat.sailSide=1;
  for(let i=0;i<fps;i++)chapter.update(1/fps);
  quarters.push(chapter.quarter);const q=chapter.quarter;chapter.update(0);assert.equal(chapter.quarter,q);
}
assert(Math.max(...quarters)-Math.min(...quarters)<1e-10);
fs.writeFileSync('/tmp/updraft-crossing-camera.json',JSON.stringify(report,null,2));
console.log('Crossing camera: departure/companions/arrival, traveller coverage at 10–120 Hz and both aspects, farewell continuity, whale pan/release, and time-based side response passed.');

// Real boats on every ordinary route exercise turns, coastal terrain correction and the mooring.
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
globalThis.window={matchMedia:()=>({matches:false})};
const {Boat}=await import('../src/traveller/boat.ts');
const {Journey}=await import('../src/story/journey.ts');
const {BOAT_BERTH}=await import('../src/story/island.ts');
const {LINES_BERTH}=await import('../src/world/lines-passage.ts');
const {BOATS_BERTH}=await import('../src/world/little-boats-layout.ts');
const {FAR_SHORE}=await import('../src/story/meadow.ts');
const {WOOD_BERTH}=await import('../src/world/wood.ts');
const {MIRROR_BERTH}=await import('../src/world/sky-mirror-layout.ts');
const {tuning}=await import('../src/tuning.ts');
const starts={toLines:[BOAT_BERTH.x,BOAT_BERTH.z,.95],toBoats:[LINES_BERTH.x,LINES_BERTH.z,.1],
  toMeadow:[BOATS_BERTH.x,BOATS_BERTH.z,Math.PI],toBirches:[FAR_SHORE.x,FAR_SHORE.z,.2],
  toSleeping:[WOOD_BERTH.x,WOOD_BERTH.z,.2],toHarbour:[MIRROR_BERTH.x,MIRROR_BERTH.z,MIRROR_BERTH.yaw]};
const routes=[];
for(const [name,start] of Object.entries(starts))for(const portrait of [false,true])for(const gust of [0,8]) {
  const wind={breeze:new THREE.Vector2(Math.cos(-Math.PI/10),Math.sin(-Math.PI/10)).multiplyScalar(tuning.wind.breeze),
    calm:3,addSplat(){},sample(x,z,out){return Object.assign(out,{x:this.breeze.x+gust,z:this.breeze.y-gust,energy:gust?.8:0,lift:0});}};
  const boat=new Boat(wind);boat.beach(...start);boat.launch();
  const child={position:new THREE.Vector3(),ride(p){this.position.copy(p);},wave(){}};
  const cast={boat,child,skyMirror:{progress:3,stars:[{},{},{}]},plane:{hold(){}},cygnet:{carried:false,wing:{restore(){}}},sealife:{whale:null,fishNear(){},dolphinsWith(){},surfaceWhale(){}}};
  const chapter=Journey.prototype.make.call({cast},name),rig=new CameraRig();
  rig.resize(portrait?390:1600,portrait?844:900);chapter.update(0);rig.cut(chapter.shot);
  let worst=0,maxStep=0,seconds=0;const last=rig.camera.getWorldDirection(new THREE.Vector3()),direction=last.clone();
  for(let i=1;i<30*200;i++) {
    const dt=1/30;seconds=i*dt;chapter.update(dt,seconds);boat.update(dt,seconds);rig.update(dt,seconds,chapter.shot,chapter.pace);
    const p=child.position.clone();p.y+=1.2;p.project(rig.camera);
    if(name==='toLines'&&seconds>3&&seconds<30) {
      const island=FIRST_ISLAND.clone().project(rig.camera);
      assert(island.z<1&&Math.abs(island.x)<1&&Math.abs(island.y)<1,
        `still island lost around departure corner at ${seconds}, portrait=${portrait}: ${island.toArray()}`);
      for(const point of chapter.farewellBounds) {
        const screen=point.clone().project(rig.camera);
        assert(screen.z<1&&Math.abs(screen.x)<.95&&Math.abs(screen.y)<.95,'farewell must retain the whole boat and sail');
      }
    }
    worst=Math.max(worst,Math.abs(p.x),Math.abs(p.y));
    rig.camera.getWorldDirection(direction);maxStep=Math.max(maxStep,direction.angleTo(last));last.copy(direction);
    assert(p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1,`${name} portrait=${portrait} gust=${gust} child lost at ${seconds}: ${p.toArray()}`);
    if(chapter.done)break;
  }
  assert(chapter.done,`${name} completes`);
  assert(maxStep<.1,`${name} camera cut: ${maxStep}`);
  routes.push({name,portrait,gust,seconds,worst,maxStep});
}
fs.writeFileSync('/tmp/updraft-crossing-camera-routes.json',JSON.stringify(routes,null,2));
console.log('All six ordinary routes: real boat, calm/gust, landscape/portrait framing and continuous turns passed (24 passages).');
