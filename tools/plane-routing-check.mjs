// Real paper, child, carry and chapter logic; deterministic wind, without a renderer.
// node tools/plane-routing-check.mjs
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
const {Glider}=await import('../src/glider/glider.ts');
const {Traveller}=await import('../src/traveller/traveller.ts');
const {Cygnet}=await import('../src/creatures/cygnet.ts');
const {Carry}=await import('../src/companion/carry.ts');
const {Boat}=await import('../src/traveller/boat.ts');
const {LinesChapter,LINES_BERTH}=await import('../src/story/lines.ts');
const {DOOR_EXIT}=await import('../src/world/doorway.ts');
const {PlaneArrival}=await import('../src/story/plane-arrival.ts');
const {heightAt}=await import('../src/world/island.ts');
const {mulberry32}=await import('../src/world/noise.ts');
const {IslandChapter,BOAT_BERTH}=await import('../src/story/island.ts');
const {BirchesChapter}=await import('../src/story/birches.ts');
const {BIRCHES_BERTH,BIRCHES_WALK,Swing}=await import('../src/world/birches.ts');
const {BirchScarf,SCARF_SNAGS}=await import('../src/world/birch-scarf.ts');
Math.random=mulberry32(42);

function fixture() {
  const air={x:2.47,z:-0.8,energy:0,lift:0};
  const wind={breeze:new THREE.Vector2(air.x,air.z),calm:3,addSplat(){},sample(x,z,out){return Object.assign(out,air);}};
  const child=new Traveller(wind),plane=new Glider(wind,[]),boat=new Boat(wind),cygnet=new Cygnet();
  cygnet.mount=child;cygnet.visible=true;cygnet.wing.restore('wrapped');
  const carry=new Carry(child,cygnet);
  const cast={child,plane,boat,cygnet,carry,wind};
  let time=0;
  return {air,cast,get time(){return time;},step(chapter,dt){
    time+=dt;chapter.update(dt,time);boat.update(dt,time);child.update(dt);carry.update(dt);
    cygnet.update(dt,time,child.position,air);carry.after();plane.update(dt,time);cygnet.heard.length=0;
  }};
}

// Reproduce the reported portal departure, including the restored checkpoint and winds across the shore.
const results=[];
for(const fps of [30,60,120]) for(const bearing of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
  const f=fixture(),{cast,air}=f,{child,plane,cygnet}=cast;
  const chapter=new LinesChapter(cast);
  child.stop();child.place(DOOR_EXIT.x,DOOR_EXIT.z-4,Math.PI);
  cygnet.release(child.position.clone().add(new THREE.Vector3(1,0,-1)));cygnet.seating.snap();
  chapter.restoreCheckpoint('family',[8,1]);
  let startedArrival=-1,largestStep=0;
  for(let i=0;i<fps*100&&!chapter.done;i++) {
    // One substantial gust, then the ordinary breeze. No steering toward the boat.
    const gust=f.time>2&&f.time<5;
    Object.assign(air,{x:Math.cos(bearing)*(gust?18:2.6),z:Math.sin(bearing)*(gust?18:2.6),energy:gust?0.7:0,lift:gust?0.4:0});
    const before=plane.position.clone();f.step(chapter,1/fps);
    if(chapter.arrival.active&&startedArrival<0)startedArrival=f.time;
    if(chapter.arrival.active&&!plane.held)largestStep=Math.max(largestStep,before.distanceTo(plane.position));
  }
  assert(chapter.done,`${fps}fps ${bearing}: shore stalled ${chapter.beat}/${chapter.play} child=${child.position.toArray()} paper=${plane.position.toArray()} landed=${plane.landed}`);
  assert(plane.held,'paper must be retrieved before boarding');
  assert(startedArrival<45,`shore needed its timeout: ${startedArrival}`);
  assert(largestStep<1,'paper snapped while returning');
  results.push({fps,bearing:+bearing.toFixed(2),arrival:+startedArrival.toFixed(1),aboard:+f.time.toFixed(1)});
}
console.log('PASS: portal checkpoint to boarding, four wind bearings plus gust, 30/60/120fps.');
console.log(JSON.stringify(results));

// A restored shore must also finish when wind never settles: its fallback is independent of pickup.
{
  const f=fixture(),{cast,air}=f,{child,plane,cygnet}=cast;
  const chapter=new LinesChapter(cast);
  child.stop();child.place(DOOR_EXIT.x,DOOR_EXIT.z-4,Math.PI);
  cygnet.release(child.position.clone().add(new THREE.Vector3(1,0,-1)));cygnet.seating.snap();
  chapter.restoreCheckpoint('family',[8,1]);
  Object.assign(air,{x:26,z:0,energy:1,lift:1});
  let committed=-1,maxRange=0;
  for(let i=0;i<60*100&&!chapter.done;i++) {
    f.step(chapter,1/60);
    if(chapter.arrival.active&&committed<0)committed=f.time;
    if(!plane.held&&!chapter.arrival.active)maxRange=Math.max(maxRange,Math.hypot(plane.position.x-plane.home.x,plane.position.z-plane.home.z));
  }
  assert(chapter.done,`continuous wind stalled restored shore: ${chapter.beat}`);
  assert(committed<47,'restored fallback clock never started');
  assert(maxRange<35,`continuous wind escaped shore: ${maxRange}`);
}
console.log('PASS: restored departure and bounded flight under continuous strong wind.');

// Arrival must interrupt an active chase, survive continuous wind and collect the paper exactly once.
for(const fps of [30,60,120]) for(const offset of [new THREE.Vector3(18,18,0),new THREE.Vector3(0,4,-30)]) {
  const f=fixture(),{cast,air}=f,{child,plane}=cast;
  child.stop();child.place(LINES_BERTH.x,LINES_BERTH.z+13,Math.PI);
  plane.launch(child.position.clone().add(offset),new THREE.Vector3(12,5,-8));
  child.walkTo(child.position.x+20,child.position.z,true);
  Object.assign(air,{x:26,z:-26,energy:1,lift:1});
  const arrival=new PlaneArrival();let completed=0;
  const chapter={update(){arrival.update(cast,true,()=>completed++);}};
  for(let i=0;i<fps*25&&!completed;i++)f.step(chapter,1/fps);
  assert.equal(completed,1,`return failed ${fps}fps at ${plane.position.toArray()}`);
  assert(plane.held);assert(!child.moving);
  for(let i=0;i<fps;i++)f.step(chapter,1/fps);
  assert.equal(completed,1,'arrival callback repeated');
  plane.launch(child.position.clone().add(new THREE.Vector3(0,3,0)),new THREE.Vector3(0,5,-6));
  plane.depart(new THREE.Vector3(1,0,0));
  for(let i=0;i<fps*10;i++)plane.update(1/fps,i/fps);
  assert(plane.position.distanceTo(child.position)>50,'ending departure retained arrival constraints');
}
console.log('PASS: airborne and offshore pickup, sustained gust, moving child, single completion, free final departure.');

// Destination steering must work at low altitude against the prevailing breeze.
for(const fps of [30,60,120]) {
  const f=fixture(),{cast:{plane},air}=f;
  const goal=new THREE.Vector3(LINES_BERTH.x,0,LINES_BERTH.z+14);
  plane.home.copy(goal);plane.homeRadius=5;plane.guided=true;
  Object.assign(air,{x:2.6,z:0,energy:0,lift:0});
  plane.launch(new THREE.Vector3(goal.x,Math.max(heightAt(goal.x,goal.z+12),0)+4,goal.z+12),new THREE.Vector3(0,2,-7));
  let nearest=Infinity;
  for(let i=0;i<fps*15;i++) {
    plane.update(1/fps,i/fps);
    nearest=Math.min(nearest,Math.hypot(plane.position.x-goal.x,plane.position.z-goal.z));
  }
  assert(nearest<5,`low flight missed its destination ${fps}: ${nearest}`);
}
console.log('PASS: low-altitude destination guidance against crosswind.');

for (const room of ['island','birches']) for (const fps of [30,60,120]) {
  const f=fixture(),{cast,air}=f,{child,plane,cygnet,boat}=cast;
  let chapter,berth;
  if(room==='island') {
    Object.assign(cast,{tree:{canopy:[{centre:new THREE.Vector3(0,20,0)}]},flock:{clear(){}},
      life:{regions:{island:new THREE.Vector4()},mean:()=>1},nearby:()=>false});
    chapter=new IslandChapter(cast);chapter.restoreCheckpoint();berth=BOAT_BERTH;
  } else {
    cast.birches={scarf:new BirchScarf(),swing:new Swing(new THREE.Vector3(0,10,-1100),0,new THREE.Vector4()),shake(){},kick(){}};
    chapter=new BirchesChapter(cast);chapter.restoreCheckpoint('scarf4-4',[BIRCHES_WALK.length-1,1,0.7,4]);berth=BIRCHES_BERTH;
    boat.beach(berth.x,berth.z,0.15);
  }
  child.stop();child.standUp();child.place(berth.x,berth.z+(room==='island'?-8:12),Math.PI);
  cygnet.rideIn('satchel');
  plane.launch(child.position.clone().add(new THREE.Vector3(12,12,0)),new THREE.Vector3(8,4,0));
  chapter.play='watch';child.walkTo(child.position.x+25,child.position.z,true);
  Object.assign(air,{x:20,z:10,energy:1,lift:1});
  for(let i=0;i<fps*45&&!chapter.done;i++)f.step(chapter,1/fps);
  assert(chapter.done,`${room} ${fps}fps: failed to board ${chapter.beat}`);
  assert(plane.held,`${room}: boarded without retrieving paper`);
}
console.log('PASS: opening and birches interrupt a moving chase beside the boat under sustained wind, 30/60/120fps.');

// Every scarf stop wins over later route cursors; throws and home must agree on the same pending encounter.
for(let completed=0;completed<SCARF_SNAGS.length;completed++) for(let leg=0;leg<BIRCHES_WALK.length;leg++) {
  const f=fixture(),{cast}=f,{child,plane}=cast;
  cast.birches={scarf:new BirchScarf(),swing:new Swing(new THREE.Vector3(0,10,-1100),0,new THREE.Vector4()),shake(){},kick(){}};
  const chapter=new BirchesChapter(cast);
  chapter.restoreCheckpoint(`scarf4-${completed}`,[leg,1,0.7,completed]);
  child.stop();child.place(0,-1050,Math.PI);
  // Read destination selection without triggering a throw or encounter.
  chapter.beat='toBoat';chapter.update(1/60,0);
  const snag=SCARF_SNAGS[completed],route=BIRCHES_WALK[leg];
  const expected=route.y<snag.stopZ?new THREE.Vector2(snag.stopX,snag.stopZ):route;
  const wanted=new THREE.Vector2(expected.x-child.position.x,expected.y-child.position.z).normalize();
  const got=new THREE.Vector2(plane.home.x-child.position.x,plane.home.z-child.position.z).normalize();
  assert(got.dot(wanted)>0.999999,`scarf ${completed}, leg ${leg}: wrong homing`);
  let aim;child.throwToward=(x,z)=>{aim=new THREE.Vector2(x-child.position.x,z-child.position.z).normalize();};
  chapter.throwAhead();assert(aim.dot(wanted)>=Math.cos(0.300001),'throw and scarf destination disagree');
  chapter.beat='walk';chapter.play='watch';child.stop();child.place(BIRCHES_BERTH.x,BIRCHES_BERTH.z+10,Math.PI);
  chapter.update(1/60,1000);
  assert(!chapter.arrival.active,'incomplete scarf allowed departure');
}
console.log('PASS: all four scarf destinations across every route cursor; incomplete encounters cannot board.');
