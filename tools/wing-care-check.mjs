// Real chapter, actors, carry and cloth. CPU checks complement the GPU captures of these same transitions.
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
const {MeadowChapter,ROUTE}=await import('../src/story/meadow.ts');
const {SleepingChapter}=await import('../src/story/sleeping.ts');
const {BED,HILLTOP}=await import('../src/world/sleeping.ts');
const {Feather}=await import('../src/fx/feather.ts');
const {restoreWingCare}=await import('../src/story/wing-care.ts');
const {saveProgress,readProgress,placeProgress}=await import('../src/story/progress.ts');
const {heightAt}=await import('../src/world/island.ts');
const {POND_LEVEL}=await import('../src/world/heightfield.ts');

function fixture(fps=60) {
  const air={x:0,z:0,energy:0,lift:0};
  const wind={breeze:new THREE.Vector2(),sample(_x,_z,out){return Object.assign(out,air);},addSplat(){}};
  const child=new Traveller(wind),cygnet=new Cygnet(),flock=new SwanFlock(),boat=new Boat(wind),plane=new Glider(wind,[]);
  cygnet.mount=child;cygnet.visible=true;
  const carry=new Carry(child,cygnet);
  const cast={child,cygnet,flock,boat,plane,carry,wind,nearby:()=>false,
    life:{regions:{island:new THREE.Vector4(),wave:new THREE.Vector4(),waiting:new THREE.Vector4()}},
    sleeping:{feather:new Feather(wind),bedside:BED.clone(),lane(){},laneOpen:0,fog:1,frost:0.3,dawn:0,curtains:0},
  };
  let time=0;
  return {cast,air,get time(){return time;},step(chapter) {
    const dt=1/fps;time+=dt;
    chapter?.update(dt,time);child.update(dt);carry.update(dt);flock.update(dt,time);
    cygnet.update(dt,time,child.position,air);carry.after();
    cygnet.heard.length=0;
  }};
}

for (const fps of [30,60,120]) {
  // The wrap is applied by the real shared animation, and stays on through subsequent carrying and gusts.
  const f=fixture(fps),{child,cygnet:k,carry}=f.cast;
  child.place(10,-790,0);k.release(child.position.clone().add(new THREE.Vector3(0,0,1)));
  k.wing.restore('hurt');k.stay=true;
  for(let i=0;i<fps;i++)f.step();
  let done=false;carry.gatherUp(()=>done=true,true);
  const care=[];
  for(let i=0;i<fps*32&&!done;i++) {
    f.step();
    if(care.at(-1)!==carry.playing)care.push(carry.playing);
    assert(Number.isFinite(k.position.x));
  }
  assert(done,'treatment failed to finish');
  assert(care.includes('gather:bandage'),'treatment skipped wrapping');
  assert.equal(k.wing.state,'wrapped');assert.equal(k.wing.dressing,1);
  k.release(child.position.clone().add(new THREE.Vector3(0,0,1)));k.mayFly=true;
  Object.assign(f.air,{lift:3,energy:1.6});
  for(let i=0;i<fps*12;i++){k.tryToFly();f.step();assert(!k.flying,'wrapped wing took flight');}
  assert.equal(k.flights,0);

  // Real approach from the brow: flock must start before the child arrives, then paddle home and resume.
  const p=fixture(fps),c=new MeadowChapter(p.cast),b=p.cast.cygnet;
  restoreWingCare(b,'meadow');
  p.cast.child.stop();p.cast.child.place(ROUTE[3].x,ROUTE[3].y,Math.PI);
  b.rideIn('satchel');p.cast.plane.hold(p.cast.child);c.crestDone=true;c.leg=3;c.piano.restoreDone();
  for(let i=0;i<fps;i++)p.step();
  c.goDown();
  let tookOff=false,swam=false,returned=false,departMoving=false,departGap=0;
  Object.assign(p.air,{lift:3,energy:1.6});
  for(let i=0;i<fps*110;i++) {
    p.step(c);
    if(c.wentOn&&!tookOff){tookOff=true;departMoving=p.cast.child.moving;departGap=p.cast.child.position.distanceTo(c.edge);}
    if(b.state==='swimming'){swam=true;assert(Math.abs(b.position.y-POND_LEVEL)<1,'swimmer left pond surface');}
    if(c.beat==='gather')returned=true;
    assert(!b.flying,'pond allowed flight');
    if(c.beat==='walk'&&returned)break;
  }
  assert(tookOff&&departMoving&&departGap>4,'flock waited for child to stop');
  assert(swam&&returned,'pond did not complete a swim');
  assert.equal(c.beat,'walk','pond did not resume journey');
  assert.equal(b.seat,'satchel');assert.equal(b.flights,0);assert.equal(b.wing.state,'wrapped');
  console.log(`${fps}fps: wrapped, flock startled during approach, pond returned to hands and resumed.`);

  // Sleeping hilltop: strongest wind cannot skip the look back, opening or actual cloth release.
  for (const strong of [false,true]) {
    const q=fixture(fps),s=new SleepingChapter(q.cast),k=q.cast.cygnet;
    q.cast.child.stop();q.cast.child.place(BED.x,BED.z,0);
    const up=HILLTOP.clone().sub(BED).setY(0).normalize();
    const top=HILLTOP.clone().addScaledVector(up,-2.2);top.y=heightAt(top.x,top.z);
    k.release(top);k.stay=true;restoreWingCare(k,'sleeping');
    // Settle the test's initial placement before measuring the authored release, just as the real climb does.
    for(let i=0;i<fps*2;i++)q.step();
    s.sat=true;s.now=q.time;s.to('unbinding');
    if(strong)Object.assign(q.air,{lift:3,energy:1.6});
    let freeAt=-1,flightAt=-1,previousCloth=null,worstClothStep=0;
    for(let i=0;i<fps*140;i++) {
      if (!strong && i === fps*85) {
        assert.equal(s.beat, 'hilltop', 'idle must not launch the first glide');
        Object.assign(q.air,{lift:3,energy:1.6});
      }
      q.step(s);
      if(k.wing.state==='free'&&freeAt<0)freeAt=q.time;
      if(k.flying&&flightAt<0)flightAt=q.time;
      if(k.wing.mesh.visible) {
        const cloth=k.wing.mesh.geometry.attributes.position.array;
        for(let j=0;j<cloth.length;j+=3) {
          assert(Number.isFinite(cloth[j]+cloth[j+1]+cloth[j+2]),'cloth vertex became invalid');
          if(previousCloth)worstClothStep=Math.max(worstClothStep,Math.hypot(cloth[j]-previousCloth[j],cloth[j+1]-previousCloth[j+1],cloth[j+2]-previousCloth[j+2]));
        }
        previousCloth=cloth.slice();
      }
      if(k.wing.state!=='free')assert(!k.flying,'flight preceded cloth release');
      if(s.beat==='waking')break;
    }
    assert(freeAt>7,'cloth release skipped its visible sequence');
    assert(flightAt>freeAt,'flight must follow release');
    assert.equal(s.beat,'waking','sleeping glide failed to reach child');
    assert.equal(k.wing.state,'free');
    assert.equal(k.flights,1,'the updraft and its continued glide are one flight');
    assert(worstClothStep<0.25,`cloth snapped during release: ${worstClothStep}`);
    console.log(`${fps}fps ${strong?'wind':'idle then wind'}: bandage free at ${freeAt.toFixed(1)}s; glide at ${flightAt.toFixed(1)}s; child reached.`);
  }
}

const {cast:{cygnet:k}}=fixture();
for(const [chapter,point,wanted] of [['island','entry','bare'],['island','companion','wrapped'],['meadow','pond','wrapped'],['sleeping','feather','wrapped'],['sleeping','morning','free'],['toHome','swim','free'],['home','entry','free']]) {
  restoreWingCare(k,chapter,point);assert.equal(k.wing.state,wanted,`${chapter}/${point}`);
}
console.log('PASS: wing treatment, pre-sleeping flight lock, pond approach/swim/exit, idle hold and wind-assisted first glide, checkpoint history.');

const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
for(const [chapter,point,data,wanted] of [
  ['island','companion',[],'wrapped'],['meadow','pond',[4,400,18,0.3,0.3],'wrapped'],
  ['sleeping','feather',[],'wrapped'],['sleeping','morning',[],'free'],['home','reunion',[],'free'],
]) {
  const a=fixture(),b=fixture();a.cast.cygnet.rideIn('cradle');
  saveProgress(chapter,point,data,a.cast);
  const saved=readProgress();assert(saved,'existing schema must still validate');
  placeProgress(saved,b.cast);
  assert.equal(b.cast.cygnet.wing.state,wanted,`save/restore ${chapter}/${point}`);
}
console.log('PASS: real checkpoint writes, validation and restore preserve the new arc without changing old saves.');
