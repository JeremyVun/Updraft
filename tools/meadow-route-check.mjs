// Actual meadow destinations, throws and walking transitions, without a renderer.
// node tools/meadow-route-check.mjs
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
const {Traveller}=await import('../src/traveller/traveller.ts');
const {Cygnet}=await import('../src/creatures/cygnet.ts');
const {Carry}=await import('../src/companion/carry.ts');
const {SwanFlock}=await import('../src/creatures/flock.ts');
const {Glider}=await import('../src/glider/glider.ts');
const {Boat}=await import('../src/traveller/boat.ts');
const {MeadowChapter,ROUTE,FAR_SHORE}=await import('../src/story/meadow.ts');
const {piano}=await import('../src/world/piano.ts');
const {POND,POND_LEVEL,pondOut}=await import('../src/world/heightfield.ts');
const {heightAt}=await import('../src/world/island.ts');
const {tuning}=await import('../src/tuning.ts');
const {mulberry32}=await import('../src/world/noise.ts');
Math.random=mulberry32(42);

function fixture() {
  const air={x:0,z:-2,energy:0,lift:0};
  const wind={breeze:new THREE.Vector2(0,-2),sample(_x,_z,out){return Object.assign(out,air);},addSplat(){}};
  const child=new Traveller(wind),cygnet=new Cygnet(),flock=new SwanFlock(),boat=new Boat(wind),plane=new Glider(wind,[]);
  cygnet.mount=child;cygnet.visible=true;cygnet.wing.restore('wrapped');
  const carry=new Carry(child,cygnet);
  const cast={child,cygnet,flock,boat,plane,carry,wind,nearby:()=>false,
    life:{regions:{island:new THREE.Vector4(),wave:new THREE.Vector4(),waiting:new THREE.Vector4()}}};
  const chapter=new MeadowChapter(cast);
  child.stop();child.place(ROUTE[0].x,ROUTE[0].y+10,Math.PI);
  cygnet.rideIn('satchel');plane.hold(child);chapter.beat='walk';chapter.play='hold';
  let time=0;
  return {cast,chapter,step(dt=1/60){
    time+=dt;chapter.update(dt,time);child.update(dt);carry.update(dt);
    flock.update(dt,time);cygnet.update(dt,time,child.position,air);carry.after();
    plane.update(dt,time);cygnet.heard.length=0;
  }};
}
function direction(from,to) {return new THREE.Vector2(to.x-from.x,to.z-from.z).normalize();}
const shore=FAR_SHORE;
// Exercise all route cursors: required stops must win even after a sideways detour past a waypoint.
for(const stop of ['piano','pond','shore']) for(const leg of [0,1,2,3,4,5,6]) {
  const {cast:{child,plane,boat},chapter}=fixture();
  chapter.leg=leg;chapter.crestDone=stop==='shore';
  if(stop!=='piano')chapter.piano.restoreDone();
  // Freeze walking only; update still executes the real destination selection and boat relocation.
  chapter.beat='toBoat';chapter.update(1/60,0);
  const expected=stop==='piano'?piano.stand:
    stop==='pond'&&leg>=3?POND:
    leg===6?shore:{x:ROUTE[leg].x,z:ROUTE[leg].y};
  const wanted=direction(child.position,expected);
  assert(direction(child.position,plane.home).dot(wanted)>0.999999,`${stop}, leg ${leg}: homing points at the wrong place`);
  assert(Math.hypot(plane.home.x-child.position.x,plane.home.z-child.position.z)<=tuning.meadowPlane.lead+1e-6);
  if(leg>=3)assert(Math.hypot(boat.position.x-shore.x,boat.position.z-shore.z)<1e-6,'boat did not move to the actual far shore');
  const original=child.throwToward;
  let aim;
  child.throwToward=(x,z)=>{aim={x,z};};
  chapter.throwAhead();child.throwToward=original;
  // Throws retain their authored +/- 0.25-radian variation about the same destination.
  assert(direction(child.position,aim).dot(wanted)>=Math.cos(0.250001),`${stop}, leg ${leg}: throw and homing disagree`);
}
console.log('PASS: every route cursor points and throws toward the pending piano, pond or actual departure shore.');

// Follow the real paper from the brow, resume after the duet, complete swimming/carry, reach the boat.
for(const fps of [30,60,120]) {
  const f=fixture(),{chapter,cast:{child,plane}}=f;
  const seen=new Set();let pianoReached=false,pondFinished=false;
  for(let i=0;i<fps*600;i++) {
    f.step(1/fps);seen.add(chapter.beat);
    if(!pianoReached&&chapter.piano.at==='looking') {
      assert(Math.hypot(child.position.x-piano.stand.x,child.position.z-piano.stand.z)<1,'walk missed the piano stand');
      // The four piano gestures have their own suite; resume from their completed stop here.
      chapter.piano.restoreDone();child.stowPlane(false);child.stop();pianoReached=true;
    }
    if(seen.has('pond')&&chapter.beat==='walk') {
      pondFinished=true;
      assert(plane.group.visible,'paper did not return after swimming');
      assert(pondOut(child.position.x,child.position.z)>=1.15 || heightAt(child.position.x,child.position.z)>=POND_LEVEL+0.19,
        'post-pond pursuit walked into the water');
    }
    if(chapter.beat==='toBoat')break;
  }
  assert(pianoReached,`${fps}fps: plane never delivered the child to the piano`);
  assert(pondFinished&&seen.has('gather'),`${fps}fps: pond did not finish and resume the walk`);
  assert.equal(chapter.beat,'toBoat',`${fps}fps: plane never delivered the child to the boat: ${JSON.stringify({leg:chapter.leg,play:chapter.play,child:child.position.toArray(),paper:plane.position.toArray(),home:plane.home.toArray(),landed:plane.landed,held:plane.held,busy:child.busy,goal:child.goal})}`);
  assert(Math.hypot(child.position.x-shore.x,child.position.z-shore.z)<45,'boarding used the timeout instead of reaching the shore');
  console.log(`PASS ${fps}fps: piano approach → crest → swimming → gather → resumed walk → departure boat.`);
}

// A restored walk can start on either bank, with the paper already across the pond.
for(const side of [-1,1]) {
  const f=fixture(),{chapter,cast:{child,plane}}=f;
  chapter.restoreCheckpoint('pond',[5,0,0,0,0]);
  child.place(POND.x+side*20,POND.z+10,Math.PI);
  plane.launch(new THREE.Vector3(POND.x-side*20,POND_LEVEL+3,POND.z-10),new THREE.Vector3(0,0,-2));
  chapter.play='watch';
  for(let i=0;i<60*220&&chapter.beat!=='toBoat';i++) {
    f.step();
    assert(pondOut(child.position.x,child.position.z)>=1.15 || heightAt(child.position.x,child.position.z)>=POND_LEVEL+0.19,
      `${side}: restored pursuit walked into the pond`);
  }
  assert.equal(chapter.beat,'toBoat',`${side}: restored bank walk stalled`);
  assert(Math.hypot(child.position.x-shore.x,child.position.z-shore.z)<45,'restored walk did not reach the departure shore');
}
console.log('PASS: restored walks on both banks recover paper across the pond and reach the boat.');
