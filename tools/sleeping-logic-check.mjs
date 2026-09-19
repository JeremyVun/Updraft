// Sleeping island: real actors and feather, idle gates, gentle input, dawn and boarding.
// Usage: node tools/sleeping-logic-check.mjs. CPU checks complement sleeping-check.mjs GPU playthroughs.
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
const {SleepingChapter}=await import('../src/story/sleeping.ts');
const {BED}=await import('../src/world/sleeping.ts');
const {Feather}=await import('../src/fx/feather.ts');
const {restoreWingCare}=await import('../src/story/wing-care.ts');

function fixture(fps=60) {
  const air={x:0,z:0,energy:0,lift:0};
  const wind={breeze:new THREE.Vector2(),sample(_x,_z,out){return Object.assign(out,air);},addSplat(){}};
  const child=new Traveller(wind),cygnet=new Cygnet(),flock=new SwanFlock(),boat=new Boat(wind),plane=new Glider(wind,[]);
  cygnet.mount=child;cygnet.visible=true;
  const carry=new Carry(child,cygnet);
  const cast={child,cygnet,flock,boat,plane,carry,wind,nearby:()=>false,
    life:{regions:{island:new THREE.Vector4(),wave:new THREE.Vector4(),waiting:new THREE.Vector4()}},
    sleeping:{feather:new Feather(wind),bedside:BED.clone().add(new THREE.Vector3(2.25,0,-0.84)),pillowPuff(){},lane(){},laneOpen:0,fog:1,frost:0.3,dawn:0,curtains:0},
  };
  let time=0;
  return {cast,air,get time(){return time;},step(chapter) {
    const dt=1/fps;time+=dt;
    chapter?.update(dt,time);child.update(dt);carry.update(dt);flock.update(dt,time);
    cygnet.update(dt,time,child.position,air);carry.after();
    cygnet.heard.length=0;
  }};
}


for (const fps of [30,60]) {
  const f=fixture(fps),{child,cygnet:k,plane,boat,sleeping}=f.cast;
  child.place(-139,-1916,Math.PI); k.bond=0.5; k.rideIn('cradle'); restoreWingCare(k,'sleeping');
  boat.beach(-134,-1916,Math.PI);boat.grounded=true;
  const c=new SleepingChapter(f.cast);
  const step=()=>{f.step(c);plane.update(1/fps,f.time);boat.update(1/fps,f.time);sleeping.feather.update(1/fps,f.time);};
  for(let i=0;i<fps*80;i++)step();
  assert.equal(c.beat,'asleep','waiting cannot release the feather');
  assert(!sleeping.feather.flying);assert(c.dusk>1.8);
  for(let i=0;i<fps;i++){c.brushDry(0.25);step();}
  assert.equal(c.beat,'feather','a modest screen stroke must release the feather');
  const beats=[];
  for(let i=0;i<fps*100&&c.beat!=='hilltop';i++){
    if(beats.at(-1)!==c.beat)beats.push(c.beat);step();
    assert(c.dusk>1.65,'morning arrived before the first flight');
  }
  assert.equal(c.beat,'hilltop');assert.equal(k.wing.state,'free');assert.equal(sleeping.curtains,0);
  for(let i=0;i<fps*80;i++)step();
  assert.equal(c.beat,'hilltop','waiting cannot complete the rescue');assert(!k.flying);
  Object.assign(f.air,{lift:1.1,energy:0.5});
  for(let i=0;i<fps*3&&c.beat!=='glide';i++)step();
  assert.equal(c.beat,'glide','gentle lift should start the glide');
  Object.assign(f.air,{lift:0,energy:0});
  for(let i=0;i<fps*2.5;i++)step();
  assert(sleeping.curtains===1 && sleeping.laneOpen<0.4,'the summit window opens before light reaches the bed');
  for(let i=0;i<fps*75&&!c.done;i++)step();
  assert(c.done,'both travellers must reach the boat');
  assert.equal(k.wing.state,'free');assert.equal(k.flights,1);
  assert(child.rig.coat.scale.distanceTo(new THREE.Vector3(1,1,1))<1e-5,'sleeping pose leaked into walking');
  assert(sleeping.dawn===1&&sleeping.curtains===1&&sleeping.fog===0);
  console.log(`${fps}fps: idle gates, modest pillow stroke, cold ascent, healed wing, gentle lift, dawn and boarding pass.`);
}
