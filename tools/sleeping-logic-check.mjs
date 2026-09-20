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
const {CurtainRibbon}=await import('../src/world/sleeping-ribbon.ts');
const {CURTAIN_KNOT,CURTAIN_END}=await import('../src/world/sleeping.ts');
const {SleepingIsland}=await import('../src/world/sleeping.ts');
const {tuning}=await import('../src/tuning.ts');
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
    sleeping:{ribbon:new CurtainRibbon(CURTAIN_KNOT,CURTAIN_END),blanketEdge:SleepingIsland.prototype.blanketEdge,fold:new THREE.Vector3(),under:new THREE.Vector3(0,1.15,0),pull:{value:0},shown:{blanket:0},feather:new Feather(wind),bedside:BED.clone().add(new THREE.Vector3(2.25,0,-0.84)),pillowPuff(){},lane(){},laneOpen:0,fog:1,frost:0.3,dawn:0,curtains:0},
  };
  let time=0;
  return {cast,air,get time(){return time;},step(chapter) {
    const dt=1/fps;time+=dt;
    chapter?.update(dt,time);child.update(dt);carry.update(dt);flock.update(dt,time);
    cygnet.update(dt,time,child.position,air);carry.after();
    const s=cast.sleeping,t=tuning.sleeping;
    s.shown.blanket+=(s.blanket-s.shown.blanket)*(1-Math.exp(-dt/t.ease));
    s.fold.x=s.shown.blanket*t.blanketLift;
    s.under.set((s.sleeper||0)*t.sleeperHigh,1.15,Math.sin(time*.75)*.06*(s.sleeper||0));
    s.pull.value+=((s.blanketPull||0)-s.pull.value)*(1-Math.exp(-dt*8));
    cygnet.heard.length=0;
  }};
}


for (const fps of [30,60]) {
  const f=fixture(fps),{child,cygnet:k,plane,boat,sleeping}=f.cast;
  child.place(-139,-1916,Math.PI); k.bond=0.5; k.rideIn('cradle'); restoreWingCare(k,'sleeping');
  boat.beach(-134,-1916,Math.PI);boat.grounded=true;
  const c=new SleepingChapter(f.cast);
  const step=()=>{f.step(c);plane.update(1/fps,f.time);boat.update(1/fps,f.time);sleeping.feather.update(1/fps,f.time);};
  let handGap=0;
  for(let i=0;i<fps*120;i++){
    step();
    if(c.beat==='tuckIn'&&c.t>19&&c.t<21)for(const hand of [0,1])
      handGap=Math.max(handGap,child.mitten(hand,new THREE.Vector3()).distanceTo(c.blanketHand[hand]));
  }
  console.log(`Bedtime mitten gap at ${fps}fps: ${handGap.toFixed(3)}m`);
  assert(handGap<0.12,"the quilt must remain within the tucking hands reach");
  assert.equal(c.beat,'asleep','waiting cannot release the feather');
  assert(!sleeping.feather.flying);assert(c.dusk>1.8);
  for(let i=0;i<fps;i++){c.brushDry(0.25);step();}
  assert.equal(c.beat,'feather','a modest screen stroke must release the feather');
  const beats=[];
  for(let i=0;i<fps*180&&c.beat!=='hilltop';i++){
    if(beats.at(-1)!==c.beat)beats.push(c.beat);step();
    assert(c.dusk>1.65,'morning arrived before the first flight');
  }
  assert.equal(c.beat,'hilltop');assert.equal(k.wing.state,'free');assert.equal(sleeping.curtains,0);
  for(let i=0;i<fps*80;i++)step();
  assert.equal(c.beat,'hilltop','waiting cannot complete the rescue');assert(!k.flying);
  Object.assign(f.air,{lift:1.1,energy:0.5});
  for(let i=0;i<fps*3&&c.beat!=='reachRibbon';i++)step();
  assert.equal(c.beat,'reachRibbon');
  assert.equal(sleeping.curtains,0);
  for(let i=0;i<fps*7&&c.beat!=='glide';i++){step();if(c.beat==='pullRibbon'){assert(k.billTip(new THREE.Vector3()).distanceTo(k.billGrip)<0.01);assert.equal(sleeping.curtains,0);}}
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

// The ribbon really hangs above the exposed slope, and the bed is on a terrace rather than in a pit.
const {heightAt}=await import('../src/world/island.ts');
assert(CURTAIN_END.y-heightAt(CURTAIN_END.x,CURTAIN_END.z)>4,'the ribbon needs visible empty air beneath it');
for(const [x,z] of [[4,0],[-4,0],[0,4],[0,-4]])
  assert(Math.abs(heightAt(BED.x+x,BED.z+z)-BED.y)<0.3,'the bedside terrace must stay open and gently sloped');

function featherWalk(stroking) {
  const f=fixture(60),feather=f.cast.sleeping.feather,bird=new THREE.Vector3(BED.x,BED.y,BED.z);
  const end=bird.clone().add(new THREE.Vector3(0,0,-12));end.y=heightAt(end.x,end.z)+1.4;
  feather.release(bird.clone().add(new THREE.Vector3(0,1.4,-1)),new THREE.Vector3());
  feather.goal.copy(end);feather.routeStart=bird.clone();feather.follow=bird;
  const camera=new THREE.PerspectiveCamera(50,1600/900,.1,200),a=new THREE.Vector2(),b=new THREE.Vector2();
  const projected=new THREE.Vector3(),wrong=new THREE.Vector2(0,1),delta=new THREE.Vector3();
  let t=0;
  for(;t<90;t+=1/60){
    camera.position.copy(bird).add(new THREE.Vector3(4,4,8));camera.lookAt(feather.position);camera.updateMatrixWorld(true);
    if(stroking){projected.copy(feather.position).project(camera);a.set(projected.x-.09,projected.y+.04);b.set(projected.x+.09,projected.y-.04);feather.brush(camera,a,b,10,wrong,0,1/60);}
    feather.update(1/60,t);
    delta.subVectors(feather.position,bird);delta.y=0;
    if(delta.length()>0.7)bird.addScaledVector(delta.normalize(),Math.min(1.6,(stroking?1.6:1))*1/60);
    bird.y=heightAt(bird.x,bird.z);
    assert(bird.distanceTo(feather.position)<5,'the guide escaped the bird');
    if(Math.hypot(bird.x-end.x,bird.z-end.z)<1)break;
  }
  return t;
}
const idleWalk=featherWalk(false),activeWalk=featherWalk(true);
assert(activeWalk<idleWalk*.8,`broad imperfect strokes must help: active ${activeWalk}, idle ${idleWalk}`);
console.log(`Terrain and feather guidance pass; assisted ${activeWalk.toFixed(1)}s versus idle ${idleWalk.toFixed(1)}s.`);
