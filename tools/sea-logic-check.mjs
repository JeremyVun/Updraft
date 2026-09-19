// Run the real sea chapter, boat, child, cygnet and pod without a renderer.
// Usage: node tools/sea-logic-check.mjs. Covers strong wind, 30/60fps, passage completion and old saves.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) specifier += '.ts';
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: transformSync(new URL(url).pathname, fs.readFileSync(new URL(url), 'utf8')).code };
  },
});
// Canvas is only used to bake the silent call sprite; no pixels are needed by this mechanics check.
globalThis.document = { createElement: () => ({getContext: () => ({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})}) };
globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
let seed = Number(process.env.SEA_SEED ?? 147);
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const { Boat } = await import('../src/traveller/boat.ts');
const { Traveller } = await import('../src/traveller/traveller.ts');
const { Cygnet } = await import('../src/creatures/cygnet.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { SeaLife } = await import('../src/fx/sealife.ts');
const { CameraRig } = await import('../src/camera.ts');
const { CrossingChapter } = await import('../src/story/crossing.ts');
const { ROUTES } = await import('../src/story/journey.ts');
const { HOME_MOORING } = await import('../src/story/home.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { tuning } = await import('../src/tuning.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
const { swellUniforms } = await import('../src/world/water/swell.ts');
swellUniforms.uSwell.value = 0.25;

function fixture(gust, portrait) {
  const wind = { breeze: new THREE.Vector2(2.47,-0.8), calm: 3, addSplat() {},
    sample(_x,_z,out) { return Object.assign(out,{x:2.47+gust,z:-0.8-gust,energy:gust?0.8:0,lift:0}); } };
  const boat = new Boat(wind), child = new Traveller(wind), cygnet = new Cygnet();
  const carry = new Carry(child, cygnet), rig = new CameraRig();
  rig.resize(portrait ? 390 : 1600, portrait ? 844 : 900);
  cygnet.mount = child;
  const sealife = new SeaLife(wind,rig.camera);
  const plane = { hold() {child.carryingPlane=true;}, homeRadius:0 };
  boat.beach(SLEEP_BERTH.x-5,SLEEP_BERTH.z-2,-1.76);boat.launch();
  child.ride(boat.seat(new THREE.Vector3()),boat.yaw);cygnet.rideIn('cradle');
  const chapter = new CrossingChapter({boat,child,cygnet,carry,sealife,plane},{route:ROUTES.toHome,dolphins:true,
    swimAt:tuning.seaPassage.swimAt,moor:HOME_MOORING,haze:tuning.seaPassage.haze});
  chapter.update(0,0);rig.cut(chapter.shot);
  return {chapter,wind,boat,child,cygnet,carry,rig,sealife};
}
const results=[];
for(const [fps,gust,portrait] of [[60,0,false],[30,20,false],[60,20,true]]) {
  const {chapter:c,wind,boat:b,child,cygnet:k,carry,rig,sealife}=fixture(gust,portrait);
  const air={x:0,z:0,energy:0,lift:0};
  let heroEdge=0,worstGap=0,clipped=0,swimFrames=0,swimStart=0,completed=false,lastProgress=0;
  const transitions=[];
  let last='';
  for(let i=0;i<fps*420;i++) {
    const dt=1/fps,time=i*dt;
    atmo.uniforms.uTime.value=time;
    c.update(dt,time);b.update(dt,time);child.update(dt);carry.update(dt);
    k.update(dt,time,child.position,wind.sample(0,0,air));
    rig.update(dt,time,c.shot,c.pace);sealife.update(dt,time);
    if(c.swim!==last){transitions.push([c.swim,+time.toFixed(2)]);last=c.swim;}
    assert(Number.isFinite(k.position.y)&&Number.isFinite(b.position.y),'finite swimming and sailing');
    // Turning a corner can briefly move away from the waypoint; progress must never leap by a whole leg.
    const progress=c.progress();assert(Math.abs(progress-lastProgress)<0.05,'distance progress jumped');lastProgress=progress;
    const act=sealife.pod.stunt;
    if(act?.kind==='leap'&&act.phase==='act'&&act.d.y>0) {
      const d=act.d;
      for(const along of [0,-tuning.dolphins.length*d.size]) {
        const p=new THREE.Vector3(d.x+Math.sin(d.yaw)*along,d.y+d.surface,d.z+Math.cos(d.yaw)*along).project(rig.camera);
        heroEdge=Math.max(heroEdge,Math.abs(p.x),Math.abs(p.y));
      }
    }
    if(c.swim==='in'&&c.swimT>3) {
      if(!swimStart)swimStart=time;
      swimFrames++;worstGap=Math.max(worstGap,k.astern);
      const p=k.position.clone().project(rig.camera);
      if(Math.abs(p.x)>0.82||Math.abs(p.y)>0.82||p.z>1)clipped++;
    }
    if(c.done){completed=true;results.push({fps,gust,portrait,seconds:+time.toFixed(1),heroEdge,worstGap,clipped,transitions});break;}
  }
  assert(completed,'passage reaches home');assert.equal(c.swim,'done');
  assert(swimFrames>fps*20,'a sustained swim');assert(worstGap<3.5,`bird fell behind ${worstGap}`);
  assert(heroEdge<0.95,`featured leap clipped ${heroEdge}`);
  assert.equal(clipped,0,'swimmer stays inside the safe frame');
  assert(swimStart>60,'the pod has time to arrive and play before the swim');
}
// An old swim checkpoint in the coastal channel should continue to the jetty, never return offshore.
{
  const {chapter:c,boat:b}=fixture(0,false);
  b.beach(-140,-1966,Math.PI/4);b.afloat=true;
  c.restoreCheckpoint('swim',[8,130]);
  assert.equal(c.swim,'done');assert(c.leg>=7);assert.equal(b.speedLimit,tuning.seaPassage.speed);
}
console.log(JSON.stringify(results,null,2));
console.log('Sea passage, swim safety and checkpoint checks passed.');
