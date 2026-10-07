// Run the real sea chapter, boat, child, cygnet, pod and whale without a renderer.
// Usage: node tools/sea-logic-check.mjs. Covers strong wind, 30/60fps, portrait, the whale in the net's sequence
// (idle to each valve's dolphin, and a player who circles over the blowhole, sweeps the cork in and sweeps along the
// flipper), the cygnet's second swim keeping clear of the flipper, passage completion, saves at the whale, after its
// breath, after the line, after the flipper and after it has gone, and old saves.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
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
const { SeaLife } = await import('../src/fx/sealife.ts');
const { CameraRig } = await import('../src/camera.ts');
const { CrossingChapter } = await import('../src/story/crossing.ts');
const { ROUTES, Journey } = await import('../src/story/journey.ts');
const { HOME_MOORING } = await import('../src/story/home.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { tuning } = await import('../src/tuning.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
const { swellUniforms } = await import('../src/world/water/swell.ts');
const { takeCues } = await import('../src/story/cues.ts');
swellUniforms.uSwell.value = 0.25;

function fixture(gust, portrait, legacy = false, circling = false) {
  let chapter;
  const wind = { breeze: new THREE.Vector2(2.47,-0.8), calm: 3, addSplat() {},
    sample(_x,_z,out) { return Object.assign(out,{x:2.47*(chapter?.breeze ?? 1)+gust,z:-0.8*(chapter?.breeze ?? 1)-gust,energy:gust?0.8:0,lift:0}); } };
  const boat = new Boat(wind), child = new Traveller(wind), cygnet = new Cygnet();
  const carry = new Carry(child, cygnet), rig = new CameraRig();
  rig.resize(portrait ? 390 : 1600, portrait ? 844 : 900);
  cygnet.mount = child;
  const sealife = new SeaLife(wind,rig.camera);
  const plane = { hold() {child.carryingPlane=true;}, homeRadius:0 };
  boat.beach(SLEEP_BERTH.x-5,SLEEP_BERTH.z-2,-1.76);boat.launch();
  child.ride(boat.seat(new THREE.Vector3()),boat.yaw);cygnet.rideIn('cradle');
  const input={present:false,muted:false,gust:0,charge:0,updraftAt:new THREE.Vector3(),prevNdc:new THREE.Vector2(),ndc:new THREE.Vector2()};
  const cast={boat,child,cygnet,carry,sealife,plane,input};
  chapter = legacy ? new CrossingChapter(cast,{route:ROUTES.toHome,dolphins:true,
    swimAt:tuning.seaPassage.swimAt,moor:HOME_MOORING,haze:tuning.seaPassage.haze}) : Journey.prototype.make.call({cast},'toMirror');
  chapter.update(0,0);rig.cut(chapter.shot);
  // A player who circles over the blowhole once the boat is at rest beside the whale, then sweeps across the cork
  // toward the boat, then along the flipper once the cygnet holds the loop's end; otherwise nobody plays.
  const play=()=>{const w=chapter.whale;
    const breath=circling&&w?.step==='breath'&&w.progress<1, sweep=circling&&w?.step==='line'&&w.haul==='out'&&w.stepTime>4;
    const fin=circling&&w?.step==='flipper'&&w.bird==='holding'&&w.slipT<0&&w.birdT>3;
    input.present=breath||sweep||fin;input.charge=breath?1:0;input.gust=fin?10:0;
    if(breath)input.updraftAt.copy(w.whale.blowhole);
    if(fin){const s=w.whale,a=s.finRoot.clone().lerp(s.finTip,0.55).project(rig.camera),b=s.finRoot.clone().lerp(s.finTip,0.95).project(rig.camera);
      input.prevNdc.set(a.x+(b.x-a.x)*0.45,a.y+(b.y-a.y)*0.45);input.ndc.set(a.x+(b.x-a.x)*0.55,a.y+(b.y-a.y)*0.55);}
    if(sweep){const a=sealife.net.float.position.clone().project(rig.camera),b=boat.position.clone().project(rig.camera),k=rig.camera.aspect;
      const d=new THREE.Vector2((b.x-a.x)*k,b.y-a.y).normalize();
      input.prevNdc.set(a.x-d.x*0.05/k,a.y-d.y*0.05);input.ndc.set(a.x+d.x*0.05/k,a.y+d.y*0.05);}};
  return {chapter,wind,boat,child,cygnet,carry,rig,sealife,play};
}
/** How much clear water there is between the cygnet's body and the near flipper, posed this frame (m). */
/** How far the flipper reaches from its line (m) at sixteenths from root to tip, as `net-whale-check.mjs` has it. */
const FIN_HALF=[0.56,0.72,0.9,1.19,1.32,1.37,1.37,1.34,1.28,1.21,1.13,1.03,0.92,0.8,0.67,0.32,0.06];
function clearOfFin(whale,at){
  let clear=Infinity;const p=new THREE.Vector3();
  for(let i=0;i<=24;i++){const t=i/24,f=t*16,j=Math.min(15,Math.floor(f));p.copy(whale.finRoot).lerp(whale.finTip,t);
    clear=Math.min(clear,p.distanceTo(at)-(FIN_HALF[j]+(FIN_HALF[j+1]-FIN_HALF[j])*(f-j)+0.05)-0.3);}
  return clear;
}
/** One frame of the sea passage, as main.ts runs it. */
function frame(f,dt,time){
  const {chapter:c,wind,boat:b,child,cygnet:k,carry,rig,sealife,play}=f;
  atmo.uniforms.uTime.value=time;
  wind.breeze.set(2.47*c.breeze,-.8*c.breeze);wind.calm=wind.breeze.length()*tuning.wind.calm;
  play();c.update(dt,time);b.update(dt,time);child.update(dt);carry.update(dt);
  k.update(dt,time,child.position,wind.sample(0,0,{x:0,z:0,energy:0,lift:0}));carry.after();
  rig.update(dt,time,c.shot,c.pace);c.afterCamera(rig.camera);rig.camera.updateMatrixWorld();sealife.update(dt,time);
}
const results=[];
for(const [fps,gust,portrait,circling] of [[60,0,false,false],[30,20,false,true],[60,20,true,true]]) {
  const f=fixture(gust,portrait,false,circling);
  const {chapter:c,boat:b,cygnet:k,rig,sealife}=f;
  let swimEdge=0,swimWorst=null;let heroEdge=0,worstGap=0,clipped=0,swimFrames=0,swimStart=0,leapAt=0,completed=false,lastProgress=0;
  const transitions=[],steps=[],saves=[];
  let last='',step='',rewards=0,blowholeEdge=0,eyeOpen=0,lastSeen=0,valveAt=null,finClear=Infinity,heldFrom=null,slipAt=null;
  const ndc=new THREE.Vector3();
  for(let i=0;i<fps*720;i++) {
    const dt=1/fps,time=i*dt;
    frame(f,dt,time);
    if(c.swim!==last){transitions.push([c.swim,+time.toFixed(2)]);last=c.swim;}
    const w=c.whale;
    if(w.step!==step){steps.push([w.step,+time.toFixed(1)]);step=w.step;}
    const point=c.checkpoint;if(point&&point!==saves[saves.length-1])saves.push(point);
    rewards+=takeCues().filter(q=>q==='restored').length;
    // At rest the blowhole is held well inside the frame, with room round it to circle.
    if(w.step==='breath'&&w.stepTime>3)blowholeEdge=Math.max(blowholeEdge,...ndc.copy(w.whale.blowhole).project(rig.camera).toArray().slice(0,2).map(Math.abs));
    if(w.step==='breath')eyeOpen=Math.max(eyeOpen,w.whale.awake?1:0);
    if(w.step==='breath'&&w.progress>0&&valveAt===null)valveAt=w.stepTime;
    if(w.step==='breath'&&w.stepTime>1)assert(b.speed<0.2,`the boat stays at rest beside it: ${b.speed}`);
    if(w.step==='flipper'&&k.state==='swimming')finClear=Math.min(finClear,clearOfFin(w.whale,k.position));
    if(w.step==='flipper'&&w.bird==='holding'&&heldFrom===null)heldFrom=time;
    if(w.step==='flipper'&&w.slipT>=0&&slipAt===null)slipAt=time;
    // seaScore now turns 'arrival' once the dolphin pod has actually left (podLeftAt), not at a route fraction (ac4de1c).
    const scorePhase = !['before','done'].includes(c.swim) ? 'swim'
      : c.podLeftAt !== null ? 'arrival' : c.swim === 'done' ? 'return' : 'open';
    assert.equal(c.seaScore, scorePhase, 'Music follows the actual swim and pod departure at every sailing speed');
    assert(Number.isFinite(k.position.y)&&Number.isFinite(b.position.y),'finite swimming and sailing');
    // Turning a corner can briefly move away from the waypoint; progress must never leap by a whole leg.
    const progress=c.progress();assert(Math.abs(progress-lastProgress)<0.05,'distance progress jumped');lastProgress=progress;
    const act=sealife.pod.stunt;
    if(act?.kind==='leap'&&act.phase==='act'&&!leapAt)leapAt=time;
    if(act?.kind==='leap'&&act.phase==='act'&&act.d.y>0&&!w.led) {
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
      if(Math.max(Math.abs(p.x),Math.abs(p.y))>swimEdge){swimEdge=Math.max(Math.abs(p.x),Math.abs(p.y));swimWorst={p:p.toArray(),time,boat:b.position.toArray(),bird:k.position.toArray(),camera:rig.camera.position.toArray()};}
      if(Math.abs(p.x)>0.82||Math.abs(p.y)>0.82||p.z>1)clipped++;
    }
    if(c.done){completed=true;results.push({fps,gust,portrait,seconds:+time.toFixed(1),heroEdge,worstGap,clipped,transitions});break;}
  }
  assert(completed,'passage reaches home');assert.equal(c.swim,'done');
  assert(swimFrames>=fps*(tuning.seaPassage.swimFor-3)-1,'keeps the authored swim after its entry');assert(worstGap<3.5,`bird fell behind ${worstGap}`);
  assert(heroEdge>0 && heroEdge<0.95,`featured leap must play and stay in frame: ${heroEdge}`);
  assert.equal(clipped,0,`swimmer stays inside the safe frame: ${JSON.stringify({fps,gust,portrait,swimWorst,transitions})}`);
  assert(leapAt>0&&swimStart>leapAt&&swimStart>tuning.seaPassage.swimNotBefore,'the pod arrives and plays its leap before the swim');
  assert.deepEqual(steps.map(([s])=>s),['approach','breath','line','flipper','free','gone'],'the whale\'s steps go in order');
  assert.deepEqual(saves,['swim','whale-rest','whale-breath','whale-line','whale-flipper','whale-gone'],'saves after the swim, at rest beside it, after its breath, after the line, after the flipper, and after it has gone, never back');
  assert.equal(c.whale.liftedBy,circling?'circles':'dolphin',`the net is lifted by ${circling?'the circles':'the valve\'s dolphin'}`);
  assert.equal(c.whale.broughtBy,circling?'sweeps':'dolphin',`the cork is brought in by ${circling?'the sweeps':'the valve\'s dolphin'}`);
  if(!circling)assert(valveAt>=tuning.netWhale.valveAfter,`nothing lifts the net before the valve: ${valveAt}`);
  assert.equal(c.whale.finnedBy,circling?'sweeps':'dolphin',`the flipper is lifted by ${circling?'the sweeps':'the valve\'s dolphin'}`);
  if(!circling)assert(slipAt-heldFrom>=tuning.netWhale.valveAfter,`nothing lifts the loop off before the valve: ${(slipAt-heldFrom).toFixed(1)} s`);
  assert(finClear>=1,`the cygnet keeps a metre of clear water from the flipper: ${finClear.toFixed(2)} m`);
  assert(eyeOpen,'its first full breath opens its eye before it is free');
  assert.equal(rewards,1,'freeing it is rewarded once');
  assert(blowholeEdge>0&&blowholeEdge<0.75,`the blowhole is an easy target at rest: ${blowholeEdge.toFixed(2)}`);
  assert(c.podLeftAt!==null&&c.podLeftAt>=steps.find(([s])=>s==='free')[1],'the pod goes with the whale');
  results[results.length-1].steps=steps;results[results.length-1].blowholeEdge=+blowholeEdge.toFixed(2);
  results[results.length-1].finClear=+finClear.toFixed(2);
}
// Resumed beside the whale, it is lying there still and the boat waits; circled, it goes and the boat sails on.
{
  const f=fixture(0,false,false,true);
  const {chapter:c,boat:b}=f;
  const rest=c.whale.rest;
  b.beach(rest.x-Math.sin(c.whale.yaw)*1.5,rest.z-Math.cos(c.whale.yaw)*1.5,c.whale.yaw);b.afloat=true;b.grounded=false;
  c.restoreCheckpoint('whale-rest',[3,95]);
  assert.equal(c.whale.step,'breath');assert.equal(c.whale.whale.phase,'resting');assert.equal(c.swim,'done');
  let gone=0;
  for(let i=0;i<60*240&&!c.done;i++){frame(f,1/60,95+i/60);if(c.whale.step==='breath'&&c.whale.stepTime>1)assert(b.speed<0.2,'a save at rest resumes at rest');
    if(c.whale.step==='gone'&&!gone)gone=c.time;}
  assert(gone>0&&c.done,'from the save at rest it is freed and the boat moors at the mirror');
  assert.equal(takeCues().filter(q=>q==='restored').length,1,'and is rewarded once');
}
// Resumed after its first breath, the patch is up and its eye open on her from the first frame; it goes on without
// another breath, and the boat sails on.
{
  const f=fixture(0,false,false,false);
  const {chapter:c,boat:b,sealife}=f;
  const rest=c.whale.rest;
  b.beach(rest.x-Math.sin(c.whale.yaw)*1.5,rest.z-Math.cos(c.whale.yaw)*1.5,c.whale.yaw);b.afloat=true;b.grounded=false;
  c.restoreCheckpoint('whale-breath',[3,110]);
  assert.equal(c.whale.step,'line');assert.equal(c.whale.whale.phase,'woken');assert.equal(sealife.net.lift,1);
  frame(f,1/60,110);
  assert(sealife.net.shown,'the net is on it from the first frame');assert.equal(c.checkpoint,'whale-breath');
  let gone=0;
  for(let i=0;i<60*320&&!c.done;i++){frame(f,1/60,110+i/60);if(c.whale.step==='line'&&c.whale.stepTime>1)assert(b.speed<0.2,'a save after the breath resumes at rest');
    if(c.whale.step==='gone'&&!gone)gone=c.time;}
  assert(gone>0&&c.done,'from the save after its breath it is freed and the boat moors at the mirror');
  assert.equal(c.whale.broughtBy,'dolphin','with nobody playing, the line comes in by its valve');
  assert.equal(takeCues().filter(q=>q==='restored').length,1,'and is rewarded once');
}
// Resumed after the line, the net is off its head in the water and the line let go; it goes on to the flipper.
{
  const f=fixture(0,false,false,false);
  const {chapter:c,boat:b,sealife}=f;
  const rest=c.whale.rest;
  b.beach(rest.x-Math.sin(c.whale.yaw)*1.5,rest.z-Math.cos(c.whale.yaw)*1.5,c.whale.yaw);b.afloat=true;b.grounded=false;
  c.restoreCheckpoint('whale-line',[3,120]);
  assert.equal(c.whale.step,'flipper');assert.equal(c.whale.whale.phase,'woken');assert.equal(sealife.net.peel,1);assert.equal(sealife.net.grip,null);
  frame(f,1/60,120);
  assert(sealife.net.shown,'the net is in the water from the first frame');assert.equal(c.checkpoint,'whale-line');
  let gone=0;
  for(let i=0;i<60*400&&!c.done;i++){frame(f,1/60,120+i/60);if(c.whale.step==='flipper')assert(b.speed<0.2,'a save after the line resumes at rest');
    if(c.whale.step==='gone'&&!gone)gone=c.time;}
  assert(gone>0&&c.done,'from the save after the line it is freed and the boat moors at the mirror');
  assert.equal(c.whale.finnedBy,'dolphin','with nobody playing, the flipper lifts by its valve');
  assert.equal(takeCues().filter(q=>q==='restored').length,1,'and is rewarded once');
}
// Resumed after the flipper, the net is loose on the water, the cygnet in the satchel and the whale free.
{
  const f=fixture(0,false,false,false);
  const {chapter:c,boat:b,cygnet:k,sealife}=f;
  const rest=c.whale.rest;
  b.beach(rest.x-Math.sin(c.whale.yaw)*1.5,rest.z-Math.cos(c.whale.yaw)*1.5,c.whale.yaw);b.afloat=true;b.grounded=false;
  c.restoreCheckpoint('whale-flipper',[3,140]);
  assert.equal(c.whale.step,'free');assert.equal(c.whale.whale.phase,'free');assert.equal(sealife.net.peel,1);assert.equal(sealife.net.loop,1);
  frame(f,1/60,140);
  assert.equal(c.checkpoint,'whale-flipper');
  let gone=0,inSatchel=0;
  for(let i=0;i<60*240&&!c.done;i++){frame(f,1/60,140+i/60);if(c.whale.step==='free'&&!c.whale.passed){assert(b.speed<0.2,'a save after the flipper resumes at rest');if(k.seat==='satchel')inSatchel++;}
    if(c.whale.step==='gone'&&!gone)gone=c.time;}
  assert(inSatchel>0,'the cygnet rides in the satchel as it goes');
  assert(gone>0&&c.done,'from the save after the flipper it goes and the boat moors at the mirror');
  assert.equal(takeCues().filter(q=>q==='restored').length,1,'and is rewarded once');
}
// Resumed after it has gone, there is no whale and the boat sails on to the mirror.
{
  const f=fixture(0,false);
  const {chapter:c,boat:b,sealife}=f;
  const rest=c.whale.rest;
  b.beach(rest.x,rest.z,c.whale.yaw);b.afloat=true;b.grounded=false;
  c.restoreCheckpoint('whale-gone',[3,130]);
  assert.equal(c.whale.step,'gone');assert.equal(sealife.sleeper.mesh.visible,false);
  for(let i=0;i<60*120&&!c.done;i++){frame(f,1/60,130+i/60);assert(!sealife.sleeper.mesh.visible,'no whale after it has gone');}
  assert(c.done,'from the save after the whale the boat moors at the mirror');
  assert.equal(takeCues().filter(q=>q==='restored').length,0,'a restored save is never rewarded again');
}
// An old swim checkpoint in the coastal channel should continue to the jetty, never return offshore.
{
  const {chapter:c,boat:b}=fixture(0,false,true);
  b.beach(-140,-1966,Math.PI/4);b.afloat=true;
  c.restoreCheckpoint('swim',[8,130]);
  assert.equal(c.swim,'done');assert(c.leg>=7);assert.equal(b.speedLimit,tuning.seaPassage.speed);
  assert(['return','arrival'].includes(c.seaScore), 'Old swim checkpoints do not replay the opening music');
}
console.log(JSON.stringify(results,null,2));
console.log('Sea passage, swim safety and checkpoint checks passed.');
