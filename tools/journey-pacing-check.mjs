// Measure current passages with real boat/chapter code: ordinary breeze, sustained gusts, direction and frame rate.
// Usage: node tools/journey-pacing-check.mjs; durations in /tmp/updraft-journey-pacing.json. CROSSING=<name> runs one
// passage, SEA_SEED=<n> seeds the pod's chances (147 by default), SOFT=1 lists every open-sea failure of a run.
// APPROACH_ONLY=1 ends at the first whale puzzle; PORTRAIT=1 checks phone framing. MUTATE=sideways|sidecam proves guards.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';

import * as THREE from 'three';
if(process.env.MUTATE==='sidecam')registerHooks({load(url,context,next){
  const result=next(url,context);
  if(url.endsWith('/src/story/crossing.ts')) {
    const source=String(result.source), line='bearing += Math.atan2(Math.sin(toward - bearing), Math.cos(toward - bearing)) * share;';
    assert(source.includes(line));return {...result,source:source.replace(line,'bearing += 0;')};
  }
  return result;
}});

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
const { Journey, ROUTES } = await import('../src/story/journey.ts');
if(process.env.MUTATE==='sideways') {
  ROUTES.toMirror[0].set(-300,-1950);ROUTES.toMirror[1].set(-340,-1948);
}
const { CameraRig } = await import('../src/camera.ts');
const { SeaLife } = await import('../src/fx/sealife.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { WOOD_BERTH } = await import('../src/world/wood.ts');
const { BIRCHES_BERTH } = await import('../src/world/birches.ts');
const { BOAT_BERTH } = await import('../src/story/island.ts');
const { LINES_BERTH } = await import('../src/world/lines-passage.ts');
const { FAR_SHORE } = await import('../src/story/meadow.ts');
const { BOATS_BERTH } = await import('../src/world/little-boats-layout.ts');
const { MIRROR_BERTH, MIRROR_ENTRY_DECK, MIRROR_DECK, MIRROR_STARS, SKY_MIRROR } = await import('../src/world/sky-mirror-layout.ts');
const { applyPalette } = await import('../src/world/palette.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
const { tuning } = await import('../src/tuning.ts');
const { callLength } = await import('../src/audio/whale-voice.ts');
const { swellUniforms } = await import('../src/world/water/swell.ts');
const { heightAt } = await import('../src/world/island.ts');
swellUniforms.uSwell.value = 0.25;
// SOFT=1 reports the open sea's failures after each run rather than stopping at the first.
const failures=[];
const check=(ok,message)=>{if(ok)return;if(process.env.SOFT)failures.push(message);else assert.fail(message);};
// What of the sky mirror could be made out: its jetties' ends and its fallen lights, lifted to where they show.
const MIRROR_MARKS=[[MIRROR_ENTRY_DECK.x0,MIRROR_ENTRY_DECK.z0],[MIRROR_ENTRY_DECK.x1,MIRROR_ENTRY_DECK.z1],
  [MIRROR_DECK.x0,MIRROR_DECK.z0],[MIRROR_DECK.x1,MIRROR_DECK.z1],...MIRROR_STARS.map(s=>[s.x,s.z])].map(([x,z])=>new THREE.Vector3(x,0.6,z));
/** The mirror's own mist on the open sea, as main.ts lays it (`ISLE_MISTS.mirror`). */
const MIRROR_MIST={x:SKY_MIRROR.x,z:SKY_MIRROR.z,rx:SKY_MIRROR.rx*tuning.world.mirrorMist.core,rz:SKY_MIRROR.rz*tuning.world.mirrorMist.core,...tuning.world.mirrorMist};
/** How much of a sightline to p passes over a coast, as `coastCover` works it out. */
function coastCover(c,p,camera,inner,outer){
  const ox=(camera.position.x-c.x)/c.rx,oz=(camera.position.z-c.z)/c.rz,rx=(p.x-camera.position.x)/c.rx,rz=(p.z-camera.position.z)/c.rz;
  const along=THREE.MathUtils.clamp(-(ox*rx+oz*rz)/Math.max(rx*rx+rz*rz,1e-6),0,1);
  return 1-THREE.MathUtils.smoothstep(Math.hypot(ox+rx*along,oz+rz*along),inner,outer);
}
/**
 * The share of a point the haze covers, as `fogOf` works it out on the GPU (no home or cloud-deck veils at sea): the
 * haze's veil `falloff` times as deep and thinning by `lift` above the low sea mist, and the mirror's own mist over it
 * while `misted`.
 */
function hazeOver(p,camera,haze,openSea,falloff=1,misted=0,lift=0){
  const u=atmo.uniforms,dist=p.distanceTo(camera.position),seen=haze,m=tuning.seaPassage.mist;
  const above=1-Math.exp(-Math.max(p.y-m.liftFrom,0)/m.liftScale),near=1-THREE.MathUtils.smoothstep(dist,m.liftNear,m.liftFar);
  const veil=Math.max(0,dist-(900-780*seen))*(0.002+0.03*seen)*falloff*(1-lift*above*near);
  const mist=u.uMist.value*Math.exp(-Math.max(Math.min(p.y,camera.position.y),0)*0.22);
  const amt=1-Math.exp(-dist*(u.uFogDensity.value*(0.55+0.65*Math.exp(-Math.max(p.y,0)*0.06))+mist*0.0075)-veil);
  const isle=misted*coastCover(MIRROR_MIST,p,camera,tuning.world.arrivalFogInner,MIRROR_MIST.edge)*THREE.MathUtils.smoothstep(dist,MIRROR_MIST.clear,MIRROR_MIST.hidden);
  return 1-(1-Math.max(amt,openSea*THREE.MathUtils.smoothstep(veil,1,4)))*(1-isle);
}
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
// On the open sea the boat waits beside the whale until it is free: `circling` winds an updraft over its blowhole
// once the boat is at rest and then sweeps the cork in to her; otherwise nobody plays and each step comes by itself
// after its safety valve.
function run(name, fps, gust, veer=0, waitInVillage=false, arrivalGust=false, circling=false) {
  let push=gust;
  const baseWind=new THREE.Vector2(Math.cos(-Math.PI/10+veer),Math.sin(-Math.PI/10+veer)).multiplyScalar(tuning.wind.breeze);
  const wind={breeze:baseWind.clone(),calm:3,addSplat(){},sample(x,z,out){return Object.assign(out,{x:this.breeze.x+push,z:this.breeze.y-push,energy:push?.8:0,lift:0});}};
  const boat=new Boat(wind), child=new Traveller(wind), cygnet=new Cygnet(),carry=new Carry(child,cygnet);
  cygnet.mount=child;cygnet.visible=true;cygnet.rideIn('cradle');
  boat.beach(...starts[name]);boat.launch();child.ride(boat.seat(new THREE.Vector3()),boat.yaw);
  const plane={held:true,position:new THREE.Vector3(),hold(){},homeRadius:0,launch(p){this.position.copy(p);this.held=false;},depart(){}};
  const rig=name==='toMirror'?new CameraRig():null;
  rig?.resize(process.env.PORTRAIT?430:1600,process.env.PORTRAIT?932:900);
  const sealife=rig?new SeaLife(wind,rig.camera):{dolphinsWith(){},fishNear(){},swimmerNear(){},surfaceWhale(){},whale:null,dolphinShow:null};
  const input={present:false,muted:false,gust:0,charge:0,updraftAt:new THREE.Vector3(),prevNdc:new THREE.Vector2(),ndc:new THREE.Vector2()};
  const cast={boat,child,cygnet,carry,wind,plane,input,lines:{gust(){}},skyMirror:{progress:3,stars:[0,1,2]},sealife};
  const chapter=Journey.prototype.make.call({cast},name);
  let shallowAt=[];const air={};let swimFrames=0,shallow=-Infinity,turn=0,yaw=boat.yaw,lastLeg=0,worstTurn=0,peak=0,sailed=0;
  const prev=boat.position.clone(),beats=[],dolphinActs=[],events={};let lastBeat='',stillFor=0,lastAct='';
  if(rig){chapter.update(0,0);rig.cut(chapter.shot);}
  let hazeShown=NaN,openShown=NaN,lastStep='',restGap=Infinity,restSpeed=Infinity,shownDuringWhale=0,worstBrake=0,lastSpeed=boat.speed;const ndc=new THREE.Vector3();
  // The open sea as the whale is found: the boat's pace, what of the whale and the mirror shows and when, and the way on.
  let leastHidden=1,nudgeOut=null,falloffShown=NaN,mistShown=0,liftShown=0,underWay=false,slowest=Infinity,slowestAt=null,whaleShownAt=null,mirrorShownBeforeDive=0,heading=0,mostStarboard=0,portTurn=0,lastYaw=null;
  const sea={sighs:[],covers:[],seen:null,calls:[],silhouette:null,detail:null,foreground:Infinity,podFrames:0,podAngle:0,podWorst:null,
    framing:{frames:0,head:0,swimmer:0,roll:0}};
  let onwardLimit=Infinity,onwardPeak=0;
  if(rig)sealife.onWhaleSound=(kind)=>{
    if(chapter.whale?.step!=='approach')return;
    if(kind==='whale-sigh')sea.sighs.push(+time.toFixed(1));
    if(kind==='whale-moan')sea.calls.push(+time.toFixed(1));
  };
  let time=0;
  const whaleMarks=()=>{const w=sealife.sleeper,m=[w.jaw,w.eye,w.blowhole,w.finTip,w.back,w.flukes];
    for(let i=1;i<6;i++)m.push(w.blowhole.clone().lerp(w.back,i/6),w.back.clone().lerp(w.flukes,i/6));return m;};
  const covered=(points)=>Math.min(...points.map(p=>hazeOver(p,rig.camera,hazeShown,openShown,falloffShown,mistShown,liftShown)));
  const onScreen=(points)=>points.filter(p=>{ndc.copy(p).project(rig.camera);return Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1&&ndc.z<1;});
  for(let i=0;i<fps*900;i++) {
    const dt=1/fps;time=i*dt;wind.breeze.copy(baseWind).multiplyScalar(chapter.breeze);wind.calm=wind.breeze.length()*tuning.wind.calm;
    // A repeatable attentive player supplies wind only during the village's interaction.
    const approaching=events[`music-${name==='drowned'?'wood':chapter.destinationMusic}`]!==undefined;
    push=gust || (arrivalGust&&approaching?8:0) || (name==='drowned' && chapter.beat==='still' && !waitInVillage?8:0);
    const whale=chapter.whale;
    const breath=circling&&whale?.step==='breath'&&whale.progress<1, sweep=circling&&whale?.step==='line'&&whale.haul==='out'&&whale.stepTime>4;
    input.present=breath||sweep;input.charge=breath?1:0;
    if(breath)input.updraftAt.copy(whale.whale.blowhole);
    if(sweep){const a=sealife.net.float.position.clone().project(rig.camera),b=boat.position.clone().project(rig.camera),k=rig.camera.aspect;
      const d=new THREE.Vector2((b.x-a.x)*k,b.y-a.y).normalize();
      input.prevNdc.set(a.x-d.x*0.05/k,a.y-d.y*0.05);input.ndc.set(a.x+d.x*0.05/k,a.y+d.y*0.05);}
    chapter.update(dt,time);boat.swell=chapter.storm ?? 0;boat.update(dt,time);
    if(chapter.arrivalMusic && events[`music-${chapter.arrivalMusic}`]===undefined) events[`music-${chapter.arrivalMusic}`]=+time.toFixed(2);
    if(chapter.arrivalHeard && chapter.arrivalReady && events.arrivalReady===undefined)events.arrivalReady=+time.toFixed(2);
    if(name==='toMirror'){child.update(dt);carry.update(dt);cygnet.update(dt,time,child.position,wind.sample(0,0,air));carry.after();rig.update(dt,time,chapter.shot,chapter.pace);rig.camera.updateMatrixWorld();chapter.afterCamera(rig.camera);sealife.update(dt,time);
      const stunt=sealife.pod.stunt,act=stunt?`${stunt.kind}:${stunt.phase}${stunt.hit?':contact':''}`:'none';
      if(act!==lastAct){dolphinActs.push([act,+time.toFixed(1)]);lastAct=act;}
      if(chapter.mirrorArrival>0)assert(!sealife.pod.mesh.visible,'dolphins finish diving before the mirror appears');
      if(!sealife.pod.wanted && chapter.swim==='done' && events.podFarewell===undefined)events.podFarewell=+time.toFixed(1);
      // The mirror shows once any of it is in frame through less than nine tenths haze, as main.ts eases the haze.
      hazeShown=Number.isNaN(hazeShown)?chapter.haze:hazeShown+(chapter.haze-hazeShown)*(1-Math.exp(-dt*0.6));
      openShown=Number.isNaN(openShown)?chapter.openSea:openShown+(chapter.openSea-openShown)*(1-Math.exp(-dt*0.7));
      falloffShown=Number.isNaN(falloffShown)?chapter.hazeFalloff:falloffShown+(chapter.hazeFalloff-falloffShown)*(1-Math.exp(-dt*0.6));
      mistShown=chapter.mirrorArrival===0?1:mistShown*Math.exp(-dt*tuning.world.isleMistLift);
      liftShown+=((chapter.veilLift??0)-liftShown)*(1-Math.exp(-dt*tuning.seaPassage.mist.liftEase));
      applyPalette(1,chapter.dusk);rig.camera.updateMatrixWorld();
      const shown=MIRROR_MARKS.some(p=>{ndc.copy(p).project(rig.camera);
        return Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1&&ndc.z<1&&hazeOver(p,rig.camera,hazeShown,openShown,falloffShown,mistShown,liftShown)<0.9;});
      if(shown&&events.mirrorSeen===undefined)events.mirrorSeen=+time.toFixed(1);
      if(shown&&whale&&events.whaleLed!==undefined&&whale.step!=='gone')shownDuringWhale+=dt;
      if(shown&&whale?.step==='gone'&&events.mirrorAfterWhale===undefined)events.mirrorAfterWhale=+time.toFixed(1);
      if(whale){
        if(whale.step==='gone'){onwardLimit=Math.min(onwardLimit,boat.speedLimit);onwardPeak=Math.max(onwardPeak,boat.speed);}
        if(whale.led&&events.whaleLed===undefined)events.whaleLed=+time.toFixed(1);
        if(whale.step!==lastStep){events[`whale-${whale.step}`]=+time.toFixed(1);lastStep=whale.step;
          if(whale.step==='breath'){
            restGap=Math.hypot(boat.position.x-whale.rest.x,boat.position.z-whale.rest.z);restSpeed=boat.speed;
            check(sea.podFrames>120&&sea.podAngle<.6,
              `the pod swims toward the visible whale: ${JSON.stringify({frames:sea.podFrames,angle:sea.podAngle,worst:sea.podWorst})}`);
            check(sea.framing.frames>120&&sea.framing.head<.9&&sea.framing.swimmer<.85&&sea.framing.roll<1e-6,
              `the returning cygnet and whale stay in a level frame: ${JSON.stringify(sea.framing)}`);
          }}
        // Eased to rest, never braked: the hull never loses way faster than it would by its own carry.
        if(whale.step==='approach')worstBrake=Math.max(worstBrake,(lastSpeed-boat.speed)/dt);
        const swimming=['restless','side','in','drying'].includes(chapter.swim);
        if(boat.speed>=4.45)underWay=true;
        if(underWay&&whale.step==='approach'&&whale.remaining()>20&&!swimming&&boat.speed<slowest){slowest=boat.speed;slowestAt=+time.toFixed(1);}
        if(whale.step==='approach'&&whale.remaining()<=20&&events.last20===undefined)events.last20=+time.toFixed(1);
        if(events.last20!==undefined&&events.stopped===undefined&&boat.speed<0.3)events.stopped=+time.toFixed(1);
        const marks=whaleMarks();
        if(whale.step==='approach') {
          sea.foreground=Math.min(sea.foreground,900-780*hazeShown);
          const visible=onScreen([sealife.sleeper.eye,sealife.sleeper.back]);
          const body=visible.length?covered(visible):1;
          if(!sea.silhouette&&body<.94)sea.silhouette={at:time,left:whale.remaining(),body};
          if(!sea.detail&&body<.5)sea.detail={at:time,left:whale.remaining(),body};
          if(chapter.swim==='in') {
            ndc.copy(cygnet.position);ndc.y+=.4;ndc.project(rig.camera);
            sea.framing.swimmer=Math.max(sea.framing.swimmer,Math.abs(ndc.x),Math.abs(ndc.y));
          }
          if((chapter.swim==='drying'||chapter.swim==='done')&&whale.remaining()>35) {
            ndc.copy(sealife.sleeper.blowhole).project(rig.camera);
            sea.framing.frames++;sea.framing.head=Math.max(sea.framing.head,Math.abs(ndc.x),Math.abs(ndc.y));
            sea.framing.roll=Math.max(sea.framing.roll,Math.abs(rig.camera.matrixWorld.elements[1]));
          }
          if(sea.silhouette&&whale.remaining()>35) {
            const pod=sealife.pod.pod.filter(d=>d.placed&&d!==stunt?.d);
            const mean=pod.reduce((s,d)=>({x:s.x+d.x,z:s.z+d.z,vx:s.vx+Math.sin(d.yaw)*d.pace,vz:s.vz+Math.cos(d.yaw)*d.pace}),{x:0,z:0,vx:0,vz:0});
            const target=Math.atan2(sealife.sleeper.blowhole.x-mean.x/pod.length,sealife.sleeper.blowhole.z-mean.z/pod.length);
            const err=target-Math.atan2(mean.vx,mean.vz), angle=Math.abs(Math.atan2(Math.sin(err),Math.cos(err)));
            sea.podFrames++;
            if(angle>sea.podAngle){sea.podAngle=angle;sea.podWorst={time,left:whale.remaining()};}
          }
        }
        if(!whale.led){const seen=onScreen(marks).map(p=>hazeOver(p,rig.camera,hazeShown,openShown,falloffShown,mistShown,liftShown));
          if(seen.length)leastHidden=Math.min(leastHidden,...seen);
          if(whaleShownAt===null&&seen.some(c=>c<0.97))whaleShownAt=+time.toFixed(1);}
        else if(nudgeOut===null)nudgeOut=+whale.remaining().toFixed(1);
        if(whale.step==='approach'&&events.shape===undefined&&sea.detail)events.shape=+time.toFixed(1);
        if(sea.sighs.length>sea.covers.length){const plume=sealife.sleeper.blowhole.clone();plume.y+=8;
          sea.covers.push({at:sea.sighs.at(-1),body:+covered(marks).toFixed(3),blow:+covered([plume]).toFixed(3)});}
        // Its blow seen from far off, once it stands at its height: its upper half over the mist, its body under it.
        if(!sea.seen&&sealife.sleeper.sighting>=1){const top=sealife.sleeper.blowhole.clone();top.y+=tuning.netWhale.sightedHeight*0.5;
          sea.seen={at:+time.toFixed(1),body:+covered(marks).toFixed(3),blow:+covered([top]).toFixed(3)};}
        if(whale.whale.diving>=0&&events.dive===undefined)events.dive=+time.toFixed(1);
        if(shown&&events.dive===undefined)mirrorShownBeforeDive+=dt;
        if(whale.passed&&events.letGo===undefined)events.letGo=+time.toFixed(1);
        // Turning to port is turning away from the jetty: only a few degrees back, crabbing against the wind, from the furthest
        // round it has come.
        if(events.letGo!==undefined&&lastYaw!==null){heading+=Math.atan2(Math.sin(boat.yaw-lastYaw),Math.cos(boat.yaw-lastYaw));
          mostStarboard=Math.min(mostStarboard,heading);portTurn=Math.max(portTurn,heading-mostStarboard);}
        lastYaw=boat.yaw;
      }
      lastSpeed=boat.speed;
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
    if(process.env.APPROACH_ONLY&&chapter.whale?.step==='breath') {
      return {seconds:+time.toFixed(1),swimSeconds:+(swimFrames/fps).toFixed(1),podFrames:sea.podFrames,
        podAngle:sea.podAngle,podWorst:sea.podWorst,framing:sea.framing,events,dolphinActs};
    }
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
      if(name==='toMirror'){check(chapter.swim==='done','the swim is done');check(swimFrames/fps>=tuning.seaPassage.swimFor,'keeps the authored open-water swim');
        check(dolphinActs.some(([act])=>act==='push:act:contact'),'the nudge makes physical contact');
        check(events.whaleLed>events['music-sea']&&events['whale-breath']>events.whaleLed,'the nudge leads the boat to rest beside the whale');
        check(events['whale-free']>events['whale-breath']&&events['whale-gone']>events['whale-free'],'the whale is freed and goes');
        check(restGap<3&&restSpeed<0.2,`the boat rests beside its head (${restGap.toFixed(2)} m off the rest, ${restSpeed.toFixed(2)} m/s)`);
        check(worstBrake<1,`the boat is eased to rest, never braked (${worstBrake.toFixed(2)} m/s²)`);
        check(shownDuringWhale===0,'nothing of the mirror shows from the lead until the whale has gone');
        check(events['music-mirror']>=events['whale-gone']-0.05,`the mirror's arrival music waits for the whale: ${JSON.stringify(events)}`);
        check(chapter.mirrorArrival > .99,'mirror transition finishes before mooring');
        check(sea.foreground>=70,`the concealing mist stays well ahead of the boat: ${sea.foreground.toFixed(1)} m from camera`);
        check(sea.silhouette?.left>80,`the whale first forms a distant silhouette: ${JSON.stringify(sea.silhouette)}`);
        check(sea.detail&&sea.detail.at-sea.silhouette.at>5&&events['whale-breath']-sea.detail.at>12,
          `silhouette, gradual detail, then approach: ${JSON.stringify({silhouette:sea.silhouette,detail:sea.detail})}`);
        check(mirrorShownBeforeDive===0,`nothing of the mirror shows before the whale dives: ${mirrorShownBeforeDive.toFixed(1)} s`);
        check(underWay&&slowest>=4.45,`the boat sails at its ordinary pace but for the swim: ${slowest.toFixed(2)} m/s at ${slowestAt} s`);
        const lead=events['whale-breath']-events.whaleLed;
        check(lead>=10&&lead<=20,`the shorter passage keeps a continuous reveal and gentle stop: ${lead.toFixed(1)} s`);
        check(events['whale-breath']>=57&&events['whale-breath']<=63,`first whale puzzle at about 60 s: ${events['whale-breath']} s`);
        check(events.stopped-events.last20<=9,`the last 20 m take about 8 s: ${(events.stopped-events.last20).toFixed(1)} s`);
        const [heard]=sea.covers,seen=sea.seen;
        check(heard&&heard.body>=0.93,`its low call begins while the body is still lost in haze: ${JSON.stringify(sea.covers)}`);
        check(seen&&seen.blow<=0.45&&seen.body>=0.85,`its blow stands above the mist before the body gains definition: ${JSON.stringify(seen)}`);
        check(seen&&seen.at>heard.at&&events.shape>seen.at,`its blow is seen before its shape forms: ${JSON.stringify({heard,seen,shape:events.shape})}`);
        check(sea.calls.length===1&&sea.calls[0]<seen?.at&&sea.calls[0]+callLength('whale-moan')>=sea.silhouette.at+2,
          `one low call carries from the mist through the first silhouette: ${JSON.stringify({calls:sea.calls,blow:seen?.at,silhouette:sea.silhouette,length:callLength('whale-moan')})}`);
        check(events.mirrorSeen>events.dive,`the mirror comes out of its mist only once the whale has dived: ${JSON.stringify(events)}`);
        const onward=time-events['whale-gone'];
        check(onwardLimit>=tuning.seaPassage.speed-0.001,`normal boat speed throughout the onward sail: cap ${onwardLimit}`);
        check(onward>=(gust?18:arrivalGust?28:37)&&onward<=(gust?32:43),
          `about 40 s at ordinary wind, with gusts naturally faster: ${onward.toFixed(1)} s`);
        check(portTurn<0.15&&-mostStarboard<1.9,`sails straight on and curves in to the jetty, never coming about: ${JSON.stringify({portTurn,starboard:-mostStarboard})}`);}
      return {seconds:+time.toFixed(1),musicLead:+musicLead.toFixed(2),sailed:+sailed.toFixed(1),peak:+peak.toFixed(2),swimSeconds:+(swimFrames/fps).toFixed(1),stillSeconds:+stillFor.toFixed(1),whaleCalled:chapter.whaleCalled,
        ...(chapter.whale?{hiddenBeforeNudge:+leastHidden.toFixed(4),nudgeOut,whaleBrake:+worstBrake.toFixed(2),restGap:+restGap.toFixed(2),slowest:+slowest.toFixed(2),slowestAt,lead:+(events['whale-breath']-events.whaleLed).toFixed(1),
          last20:+(events.stopped-events.last20).toFixed(1),diveToMooring:+(time-events.dive).toFixed(1),letGoToMooring:+(time-events.letGo).toFixed(1),
          onwardLimit,onwardPeak:+onwardPeak.toFixed(2),portTurn:+portTurn.toFixed(3),starboardTurn:+(-mostStarboard).toFixed(2),sighs:sea.covers,blow:sea.seen,calls:sea.calls,reveal:{silhouette:sea.silhouette,detail:sea.detail,foreground:sea.foreground,podFrames:sea.podFrames,podAngle:sea.podAngle,podWorst:sea.podWorst,framing:sea.framing}}:{}),beats,events,dolphinActs};
    }
  }
  const w=chapter.whale;
  throw Error(`${name}: failed to finish at ${boat.position.toArray()}, leg ${chapter.leg}${w?`, whale ${w.step} ${w.stepTime.toFixed(1)} s, haul ${w.haul}, bird ${w.bird}, ${JSON.stringify(events)}`:''}`);
}
const results=[];
for(const name of (process.env.CROSSING ? [process.env.CROSSING] : Object.keys(starts))) {
  const calm=run(name,60,0),gust=run(name,60,8),lowFps=run(name,30,0);
  const windLeft=run(name,30,0,-.35),windRight=run(name,30,0,.35);
  const lateGust=run(name,60,0,0,false,true);
  const entry={name,calm,gust,lowFps,windLeft,windRight,lateGust};
  if(name==='toMirror')entry.circling=run(name,60,0,0,false,false,true);
  if(name==='toBoats'||name==='toMeadow') {
    const target=name==='toBoats'?30:40;
    for(const result of [calm,lowFps,windLeft,windRight])
      assert(Math.abs(result.seconds-target)<5,`${name}: ordinary passage exceeds its ${target}s pacing target (${result.seconds}s)`);
  }
  if(name==='drowned')entry.noResponse=run(name,30,0,0,true);
  results.push(entry);console.log(JSON.stringify(entry));
  if(failures.length)throw Error(`${name}:\n${failures.join('\n')}`);
}
fs.writeFileSync('/tmp/updraft-journey-pacing.json',JSON.stringify(results,null,2));
console.log('Passage completion, navigation, shore clearance, speed cap and authored swim passed.');
