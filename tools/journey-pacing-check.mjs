// Measure current passages with real boat/chapter code: ordinary breeze, sustained gusts, direction and frame rate.
// Usage: node tools/journey-pacing-check.mjs; durations in /tmp/updraft-journey-pacing.json.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import * as THREE from 'three';

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
const { Journey } = await import('../src/story/journey.ts');
const { CameraRig } = await import('../src/camera.ts');
const { SeaLife } = await import('../src/fx/sealife.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { WOOD_BERTH } = await import('../src/world/wood.ts');
const { BIRCHES_BERTH } = await import('../src/world/birches.ts');
const { BOAT_BERTH } = await import('../src/story/island.ts');
const { LINES_BERTH } = await import('../src/world/lines-passage.ts');
const { FAR_SHORE } = await import('../src/story/meadow.ts');
const { BOATS_BERTH } = await import('../src/world/little-boats-layout.ts');
const { MIRROR_BERTH } = await import('../src/world/sky-mirror-layout.ts');
const { tuning } = await import('../src/tuning.ts');
const { swellUniforms } = await import('../src/world/water/swell.ts');
const { heightAt } = await import('../src/world/island.ts');
swellUniforms.uSwell.value = 0.25;
const starts = {
  toLines:[BOAT_BERTH.x,BOAT_BERTH.z,.95],
  toBoats:[LINES_BERTH.x,LINES_BERTH.z,.1],
  toMeadow:[BOATS_BERTH.x,BOATS_BERTH.z,Math.PI],
  toBirches:[FAR_SHORE.x,FAR_SHORE.z,.2],
  drowned:[BIRCHES_BERTH.x,BIRCHES_BERTH.z,Math.PI],
  toSleeping:[WOOD_BERTH.x,WOOD_BERTH.z,.2],
  toMirror:[SLEEP_BERTH.x,SLEEP_BERTH.z,-1.76],
  toHarbour:[MIRROR_BERTH.x,MIRROR_BERTH.z,MIRROR_BERTH.yaw],
};
function run(name, fps, gust, veer=0, waitInVillage=false, arrivalGust=false) {
  let push=gust;
  const baseWind=new THREE.Vector2(Math.cos(-Math.PI/10+veer),Math.sin(-Math.PI/10+veer)).multiplyScalar(tuning.wind.breeze);
  const wind={breeze:baseWind.clone(),calm:3,addSplat(){},sample(x,z,out){return Object.assign(out,{x:this.breeze.x+push,z:this.breeze.y-push,energy:push?.8:0,lift:0});}};
  const boat=new Boat(wind), child=new Traveller(wind), cygnet=new Cygnet(),carry=new Carry(child,cygnet);
  cygnet.mount=child;cygnet.visible=true;cygnet.rideIn('cradle');
  boat.beach(...starts[name]);boat.launch();child.ride(boat.seat(new THREE.Vector3()),boat.yaw);
  const plane={held:true,position:new THREE.Vector3(),hold(){},homeRadius:0,launch(p){this.position.copy(p);this.held=false;},depart(){}};
  const rig=name==='toMirror'?new CameraRig():null;
  rig?.resize(1600,900);
  const sealife=rig?new SeaLife(wind,rig.camera):{dolphinsWith(){},fishNear(){},swimmerNear(){},surfaceWhale(){},whale:null,dolphinShow:null};
  const cast={boat,child,cygnet,carry,wind,plane,skyMirror:{progress:3,stars:[0,1,2]},sealife};
  const chapter=Journey.prototype.make.call({cast},name);
  let shallowAt=[];const air={};let swimFrames=0,shallow=-Infinity,turn=0,yaw=boat.yaw,lastLeg=0,worstTurn=0,peak=0,sailed=0;
  const prev=boat.position.clone(),beats=[],dolphinActs=[],events={};let lastBeat='',stillFor=0,lastAct='';
  if(rig){chapter.update(0,0);rig.cut(chapter.shot);}
  for(let i=0;i<fps*500;i++) {
    const dt=1/fps,time=i*dt;wind.breeze.copy(baseWind).multiplyScalar(chapter.breeze);wind.calm=wind.breeze.length()*tuning.wind.calm;
    // A repeatable attentive player supplies wind only during the village's interaction.
    const approaching=events[`music-${name==='drowned'?'wood':chapter.destinationMusic}`]!==undefined;
    push=gust || (arrivalGust&&approaching?8:0) || (name==='drowned' && chapter.beat==='still' && !waitInVillage?8:0);
    chapter.update(dt,time);boat.swell=chapter.storm ?? 0;boat.update(dt,time);
    if(chapter.arrivalMusic && events[`music-${chapter.arrivalMusic}`]===undefined) events[`music-${chapter.arrivalMusic}`]=+time.toFixed(2);
    if(chapter.arrivalHeard && chapter.arrivalReady && events.arrivalReady===undefined)events.arrivalReady=+time.toFixed(2);
    if(name==='toMirror'){child.update(dt);carry.update(dt);cygnet.update(dt,time,child.position,wind.sample(0,0,air));carry.after();rig.update(dt,time,chapter.shot,chapter.pace);sealife.update(dt,time);
      const stunt=sealife.pod.stunt,act=stunt?`${stunt.kind}:${stunt.phase}${stunt.hit?':contact':''}`:'none';
      if(act!==lastAct){dolphinActs.push([act,+time.toFixed(1)]);lastAct=act;}
      if(chapter.mirrorArrival>0)assert(!sealife.pod.mesh.visible,'dolphins finish diving before the mirror appears');
      if(!sealife.pod.wanted && chapter.swim==='done' && events.podFarewell===undefined)events.podFarewell=+time.toFixed(1);
    }
    if(name==='drowned'&&chapter.leg>0&&events.channelEntry===undefined)events.channelEntry=+time.toFixed(1);
    sailed+=Math.hypot(boat.position.x-prev.x,boat.position.z-prev.z);prev.copy(boat.position);peak=Math.max(peak,boat.speed);
    const beat=chapter.beat ?? chapter.swim;
    if(beat!==lastBeat){beats.push([beat,+time.toFixed(1)]);lastBeat=beat;}
    if(chapter.beat==='still')stillFor+=dt;
    if(chapter.swim==='in')swimFrames++;
    const route=chapter.route;
    if(i%5===0 && route && chapter.leg<route.length-1 && Math.hypot(boat.position.x-starts[name][0],boat.position.z-starts[name][1])>35){const h=heightAt(boat.position.x,boat.position.z);if(h>shallow){shallow=h;shallowAt=boat.position.toArray();}}
    turn+=Math.abs(Math.atan2(Math.sin(boat.yaw-yaw),Math.cos(boat.yaw-yaw)));yaw=boat.yaw;
    if(lastLeg!==chapter.leg){worstTurn=Math.max(turn,worstTurn);turn=0;lastLeg=chapter.leg;}
    if(chapter.done){
      const target=name==='drowned'?'wood':chapter.destinationMusic;
      const requestAt=events[`music-${target}`];
      assert(Number.isFinite(requestAt),`${name}: destination music was never requested`);
      const musicLead=time-requestAt-tuning.audio.arrivalFadeOut-tuning.audio.arrivalQuiet;
      // A sudden gust may land during the musical rest; preserve the rest rather than truncate it.
      assert(musicLead>-tuning.audio.arrivalPhraseWait,`${name}: handoff requested too late (${musicLead.toFixed(2)}s before landing, before phrase wait)`);
      if(!['drowned','toHarbour'].includes(name))assert(Number.isFinite(events.arrivalReady),`${name}: final-approach music gate never opens`);
      if(route)assert(shallow<-.3,`${name}: hull crossed land (${shallow}) at ${shallowAt}, time ${time}`);
      assert(Math.max(turn,worstTurn)<Math.PI*2,`${name}: circled a waypoint`);
      assert(peak<=10.000001,`${name}: exceeds approved forward speed cap`);
      if(name==='toMirror'){assert(time<=100,`sea exceeds 100 seconds: ${time.toFixed(2)}`);assert.equal(chapter.swim,'done');assert(swimFrames/fps>=tuning.seaPassage.swimFor,'keeps the authored open-water swim');
        assert(sealife.pod.farewellReady,'keeps the completed dolphin nudge');
        assert(dolphinActs.some(([act])=>act==='push:act:contact'),'the nudge makes physical contact');
        assert(chapter.mirrorArrival > .99,'mirror transition finishes before mooring');}
      return {seconds:+time.toFixed(1),musicLead:+musicLead.toFixed(2),sailed:+sailed.toFixed(1),peak:+peak.toFixed(2),swimSeconds:+(swimFrames/fps).toFixed(1),stillSeconds:+stillFor.toFixed(1),whaleCalled:chapter.whaleCalled,beats,events,dolphinActs};
    }
  }
  throw Error(`${name}: failed to finish at ${boat.position.toArray()}, leg ${chapter.leg}`);
}
const results=[];
for(const name of (process.env.CROSSING ? [process.env.CROSSING] : Object.keys(starts))) {
  const calm=run(name,60,0),gust=run(name,60,8),lowFps=run(name,30,0);
  const windLeft=run(name,30,0,-.35),windRight=run(name,30,0,.35);
  const lateGust=run(name,60,0,0,false,true);
  const entry={name,calm,gust,lowFps,windLeft,windRight,lateGust};
  if(name==='toBoats'||name==='toMeadow') {
    const target=name==='toBoats'?30:40;
    for(const result of [calm,lowFps,windLeft,windRight])
      assert(Math.abs(result.seconds-target)<5,`${name}: ordinary passage exceeds its ${target}s pacing target (${result.seconds}s)`);
  }
  if(name==='drowned')entry.noResponse=run(name,30,0,0,true);
  results.push(entry);console.log(JSON.stringify(entry));
}
fs.writeFileSync('/tmp/updraft-journey-pacing.json',JSON.stringify(results,null,2));
console.log('Passage completion, navigation, shore clearance, speed cap and authored swim passed.');
