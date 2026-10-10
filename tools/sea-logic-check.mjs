// Run the real sea chapter, boat, child, cygnet, pod and whale without a renderer.
// Usage: SEA_SEED=<n> node tools/sea-logic-check.mjs (default 147). Covers strong wind, 30/60fps, portrait, the whale
// in the net's five steps (idle to each valve's dolphin, and a player who circles over the blowhole and strokes across
// its eye, the cork, the net on its head and the flipper as each sweep is drawn), the cygnet's second swim keeping
// clear of the flipper, passage completion, each save at the whale (at rest, after each step, after it has gone)
// resumed played or idle, and old saves.
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
const { HEAD } = await import('../src/creatures/cygnet/body.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { SeaLife } = await import('../src/fx/sealife.ts');
const { CameraRig } = await import('../src/camera.ts');
const { CrossingChapter } = await import('../src/story/crossing.ts');
const { ROUTES, Journey } = await import('../src/story/journey.ts');
const { HOME_MOORING } = await import('../src/story/home.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { tuning } = await import('../src/tuning.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
const { swellUniforms, swellLift } = await import('../src/world/water/swell.ts');
const { takeCues } = await import('../src/story/cues.ts');
const { FLUKES, FLUKE_HALF_SPAN, FLUKE_HINGE } = await import('../src/fx/sealife/anatomy.ts');
swellUniforms.uSwell.value = 0.25;

/**
 * A player who plays each step from the moment its gesture is drawn: circles over the blowhole (full charge there),
 * then strokes the way each drawn sweep goes, across its eye, the cork, the net on its head and the flipper, a stroke
 * of 0.3 s with the pointer off the screen for 0.6 s between, until the step is done. Without `circling`, nobody plays.
 */
function player(chapter,input,rig,sealife,circling){
  const begun=new Set(),strokes={},target=new THREE.Vector3(),at=new THREE.Vector2();
  let stroke=null,off=0;
  const wants=(w)=>({breath:w.progress<1,eye:w.foldT<0,line:w.haul==='out',
    heave:w.heaves+w.owed+(w.haul==='heaving'?1:0)<tuning.netWhale.heaves,flipper:w.bird==='holding'&&w.slipT<0})[w.step]??false;
  const over=(w)=>{const s=w.whale;
    if(w.step==='eye')return target.copy(s.eye);
    if(w.step==='line')return target.copy(sealife.net.float.position);
    if(w.step==='heave')return target.copy(s.eye).lerp(s.blowhole,0.45);
    return target.copy(s.finRoot).lerp(s.finTip,0.75);};
  const along=(f)=>{const w=chapter.whale,k=rig.camera.aspect,p=over(w).project(rig.camera),L=0.5*(f-0.5);
    return at.set(p.x+Math.cos(stroke.heading)*L/k,p.y+Math.sin(stroke.heading)*L);};
  const play=(dt)=>{
    const w=chapter.whale;
    input.present=false;input.charge=0;
    if(!circling||!w||!wants(w)){stroke=null;return;}
    if(w.offered||(w.step==='breath'&&chapter.coax))begun.add(w.step);
    if(!begun.has(w.step))return;
    if(w.step==='breath'){input.present=true;input.charge=1;input.updraftAt.copy(w.whale.blowhole);strokes.breath=1;return;}
    if(!stroke){
      if((off-=dt)>0)return;
      stroke={t:0,heading:w.inviteHeading};strokes[w.step]=(strokes[w.step]??0)+1;
      input.prevNdc.copy(along(0));
    }else input.prevNdc.copy(input.ndc);
    stroke.t+=dt;
    input.present=true;input.ndc.copy(along(Math.min(1,stroke.t/0.3)));
    if(stroke.t>=0.3){stroke=null;off=0.6;}
  };
  play.strokes=strokes;
  return play;
}
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
  const play=player(chapter,input,rig,sealife,circling);
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
  play(dt);c.update(dt,time);b.update(dt,time);child.update(dt);carry.update(dt);
  k.update(dt,time,child.position,wind.sample(0,0,{x:0,z:0,energy:0,lift:0}));carry.after();
  rig.update(dt,time,c.shot,c.pace);c.afterCamera(rig.camera);rig.camera.updateMatrixWorld();sealife.update(dt,time);
}
const WHALE_STEPS=['approach','breath','eye','line','heave','flipper','free','gone'];
const PLAYED=['breath','eye','line','heave','flipper'];
const WHALE_SAVES=['whale-rest','whale-breath','whale-eye','whale-line','whale-heave','whale-flipper','whale-gone'];
/** Each step's first move, and when it began to wait for one: the flipper waits from the cygnet holding the loop's end. */
const MOVED={breath:(w)=>w.progress>0,eye:(w)=>w.fold>0,line:(w)=>w.haul!=='out',heave:(w)=>w.heaves>0||w.haul==='heaving',flipper:(w)=>w.slipT>=0};
function watchSteps(w,time,asked,moved){
  const s=w.step;if(!MOVED[s])return;
  if(asked[s]===undefined&&(s!=='flipper'||w.bird==='holding'))asked[s]=time;
  if(asked[s]!==undefined&&moved[s]===undefined&&MOVED[s](w))moved[s]=time;
}
function assertPlayedBy(w,played,from=0){
  const by=[w.liftedBy,w.foldedBy,w.broughtBy,w.heavedBy,w.finnedBy].slice(from);
  assert.deepEqual(by,['circles','sweeps','sweeps','sweeps','sweeps'].slice(from).map((p)=>played?p:'dolphin'),
    `each step done by ${played?'the player':'its valve\'s dolphin'}: ${by}`);
}
const results=[];
function coveredBlowhole(net, blowhole) {
  const ray = new THREE.Ray(blowhole.clone().add(new THREE.Vector3(0, 30, 0)), new THREE.Vector3(0, -1, 0));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
  for (const mesh of [net.sheet, net.breathFlap]) {
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
      if (ray.intersectTriangle(a, b, c, false, hit) && hit.y >= blowhole.y - 0.25) return true;
    }
  }
  return false;
}
{
  const f=fixture(0,false), {chapter:c,boat:b,cygnet:k,sealife}=f, w=c.whale;
  b.beach(w.rest.x-Math.sin(w.yaw)*1.5,w.rest.z-Math.cos(w.yaw)*1.5,w.yaw);b.afloat=true;b.grounded=false;
  c.restoreCheckpoint('whale-heave',[3,95]);
  let time=95;
  const forward=new THREE.Vector3(),toward=new THREE.Vector3(),bill=new THREE.Vector3();
  let neckSamples=0,neckError=0,neckWorst,dozed=false;
  const advance=()=>{
    frame(f,1/60,time+=1/60);
    if(!dozed&&k.state==='swimming'){k.doze=1;dozed=true;}
    if(w.bird==='out'&&w.birdT>.4) {
      assert(Math.abs(k.drives.gaze.yaw)<.65&&k.drives.gaze.pitch>-.5,'the swimmer looks along its path without craning backwards or upwards');
    }
    if((w.bird==='holding'&&w.birdT>1.5)||w.bird==='pulling') {
      forward.set(0,0,1).transformDirection(k.nodes[HEAD].matrixWorld);
      toward.subVectors(sealife.net.loopTie,k.billTip(bill)).normalize();
      const error=forward.angleTo(toward);
      if(error>neckError){neckError=error;neckWorst={time,bird:w.bird,birdT:w.birdT,gaze:{...k.drives.gaze},act:k.mind.act,forward:forward.toArray(),toward:toward.toArray(),rope:sealife.net.loopTie.toArray(),at:k.position.toArray()};}neckSamples++;
    }
  };
  while(w.bird!=='holding'&&time<125)advance();
  assert.equal(w.bird,'holding','the bird takes the rope');
  const pickup=k.position.clone();
  for(let i=0;i<180;i++)advance();
  const slack=k.position.distanceTo(pickup);
  assert(slack>0.4,'backward paddling visibly takes up slack');
  assert.equal(sealife.net.loop,0,'taking up slack cannot remove the loop before the wind lifts the fin');
  assert(sealife.net.tension>0.8,'backward paddling tightens the rope');
  k.mind.perform('preen-wing',12);
  assert(w.liftFin('sweeps'),'wind lifts the flipper');
  const held=k.position.clone(), update=k.update.bind(k);
  k.update=(...args)=>{update(...args);k.position.copy(held);};
  for(let i=0;i<360;i++)advance();
  assert.equal(sealife.net.loop,0,'a raised fin and elapsed time cannot free the loop without the bird pulling');
  k.update=update;
  let backward=0, previous=k.position.clone();
  while(w.bird!=='letting'&&time<155){
    advance();
    const dx=k.position.x-previous.x,dz=k.position.z-previous.z;
    backward-=dx*Math.sin(k.yaw)+dz*Math.cos(k.yaw);previous.copy(k.position);
  }
  assert.equal(w.bird,'letting','the bird tows the freed loop clear before letting go');
  assert.equal(sealife.net.loop,1,'the backward pull removes the loop');
  assert(backward>1.8,'it pulls while facing the rope, rather than turning and swimming forwards');
  assert(neckSamples>120&&neckError<.55,`the bill follows the rope without twisting the neck: ${neckError} radians ${JSON.stringify(neckWorst)}`);
  takeCues();
  console.log(JSON.stringify({cygnetPull:{slack,backward,heldLoop:0,neckSamples,neckError}}));
}
for(const [fps,gust,portrait,circling] of [[60,0,false,false],[30,20,false,true],[60,20,true,true]]) {
  const f=fixture(gust,portrait,false,circling);
  const {chapter:c,boat:b,cygnet:k,rig,sealife}=f;
  let swimEdge=0,swimWorst=null;let heroEdge=0,worstGap=0,clipped=0,swimFrames=0,swimStart=0,leapAt=0,completed=false,lastProgress=0;
  const transitions=[],steps=[],saves=[];
  let last='',step='',rewards=0,blowholeEdge=0,eyeOpen=0,finClear=Infinity;
  const asked={},moved={};
  const actionable={}, invitations={};
  let openSamples=0, blockedSamples=0, loopClear=Infinity, tailBend=0, flukeEdge=0, railSamples=0;
  const foot=new THREE.Vector3(), rail=new THREE.Vector3();
  const flukeVertices=[];
  const geometry=sealife.sleeper.mesh.geometry, positions=geometry.attributes.position, rigs=geometry.attributes.aRig;
  for(let i=0;i<positions.count;i++)if(rigs.getY(i)===FLUKES)flukeVertices.push(i);
  const ndc=new THREE.Vector3();
  for(let i=0;i<fps*900;i++) {
    const dt=1/fps,time=i*dt;
    frame(f,dt,time);
    if(k.state==='perched'&&k.perchSupport===b.group&&!k.seating.move){
      b.group.worldToLocal(b.rail(k.perchLocal.x>0?1:-1,rail));
      for(const side of [0,1]){
        k.footAt(side,foot);b.group.worldToLocal(foot);
        assert(Math.abs(foot.y-0.014*1.42-rail.y)<0.045,`foot stays on the moving rail: ${foot.y-rail.y}`);
        assert(Math.abs(foot.x-rail.x)<0.12,`foot stays over the rail: ${foot.x-rail.x}`);
      }
      railSamples++;
    }
    if(c.swim!==last){transitions.push([c.swim,+time.toFixed(2)]);last=c.swim;}
    const w=c.whale;
    if(w.asks && actionable[w.step]===undefined)actionable[w.step]=time;
    if((w.offered||w.coax)&&invitations[w.step]===undefined)invitations[w.step]=time-actionable[w.step];
    if(!blockedSamples&&w.step==='breath'&&w.progress===0){
      assert(coveredBlowhole(sealife.net,w.whale.blowhole),'the flap covers the blowhole before the updraft');
      blockedSamples++;
    }
    if(w.step==='eye'&&sealife.net.slump>0.999&&i%Math.ceil(fps/10)===0){
      assert(!coveredBlowhole(sealife.net,w.whale.blowhole),'the folded flap leaves a real opening above the blowhole');
      openSamples++;
    }
    if(w.step==='flipper'&&w.bird==='holding'&&w.slipT<0){
      const net=sealife.net,p=net.line.pos;
      for(let m=0;m<=40;m++){
        const k=(net.loopLine.start+5+m)*2;
        loopClear=Math.min(loopClear,p.getY(k)-swellLift(p.getX(k),p.getZ(k),time));
      }
    }
    if(w.step==='free'&&w.whale.diving>=0){
      const p=w.whale.pitch;
      for(let j=Math.floor(p.length*.65);j<p.length-1;j++)tailBend=Math.max(tailBend,Math.abs(p[j+1]-p[j]));
      if(w.whale.time>=26.8&&w.whale.time<=28.8&&i%6===0){
        const whale=w.whale,shape=whale.uniforms.uShape.value.z;
        for(const j of flukeVertices){
          const x=positions.getX(j),y=positions.getY(j),s=rigs.getX(j);
          whale.point(x*shape,(y+whale.uniforms.uCurl.value*(x/FLUKE_HALF_SPAN)**2)*shape,
            FLUKE_HINGE+(s-FLUKE_HINGE)*shape,ndc);
          if(ndc.y<0)continue;
          ndc.project(rig.camera);flukeEdge=Math.max(flukeEdge,Math.abs(ndc.x),Math.abs(ndc.y));
        }
      }
    }
    if(w.step!==step){steps.push([w.step,+time.toFixed(1)]);step=w.step;}
    const point=c.checkpoint;if(point&&point!==saves[saves.length-1])saves.push(point);
    rewards+=takeCues().filter(q=>q==='restored').length;
    // While the breath is asked, the blowhole is held well inside the frame, with room round it to circle.
    if(w.step==='breath'&&w.progress<1&&(c.coax||w.progress>0))blowholeEdge=Math.max(blowholeEdge,...ndc.copy(w.whale.blowhole).project(rig.camera).toArray().slice(0,2).map(Math.abs));
    if(w.step==='breath'||w.step==='eye')eyeOpen=Math.max(eyeOpen,w.eyeT>0?1:0);
    if(PLAYED.includes(w.step)&&w.stepTime>1)assert(b.speed<0.2,`the boat stays at rest beside it: ${w.step} ${b.speed}`);
    if(w.step==='flipper'&&k.state==='swimming'){
      finClear=Math.min(finClear,clearOfFin(w.whale,k.position));
      if(['holding','pulling','clearing','letting'].includes(w.bird)){
        ndc.copy(k.position).setY(k.position.y+0.3).project(rig.camera);
        assert(Math.abs(ndc.x)<0.9&&Math.abs(ndc.y)<0.9&&ndc.z<1,`the pulling cygnet stays fully in frame (${portrait?'portrait':'landscape'}, ${w.bird}): ${ndc.toArray()}`);
      }
    }
    watchSteps(w,time,asked,moved);
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
  assert(completed,`passage reaches home: ${JSON.stringify({fps,gust,portrait,steps,swim:c.swim,haul:c.whale.haul,strokes:f.play.strokes})}`);assert.equal(c.swim,'done');
  assert(swimFrames>=fps*(tuning.seaPassage.swimFor-3)-1,'keeps the authored swim after its entry');assert(worstGap<3.5,`bird fell behind ${worstGap}`);
  assert(heroEdge>0 && heroEdge<0.95,`featured leap must play and stay in frame: ${heroEdge}`);
  assert.equal(clipped,0,`swimmer stays inside the safe frame: ${JSON.stringify({fps,gust,portrait,swimWorst,transitions})}`);
  assert(leapAt>0&&swimStart>leapAt&&swimStart>tuning.seaPassage.swimNotBefore,'the pod arrives and plays its leap before the swim');
  assert.deepEqual(steps.map(([s])=>s),WHALE_STEPS,'the whale\'s steps go in order');
  assert.deepEqual(saves,['swim',...WHALE_SAVES],'a save after the swim, at rest beside it and after each step, and after it has gone, never back');
  assertPlayedBy(c.whale,circling);
  const waited=Object.fromEntries(PLAYED.map((s)=>[s,+(moved[s]-asked[s]).toFixed(1)]));
  if(!circling)for(const s of PLAYED)assert(waited[s]>=tuning.netWhale.valveAfter,`nothing does the ${s} before its valve: ${waited[s]} s`);
  if(circling){
    const strokes=f.play.strokes;
    for(const s of PLAYED)assert(waited[s]<(s==='heave'?20:10),`a prompt player does the ${s} in moments: ${waited[s]} s`);
    assert(strokes.eye<=2&&strokes.line<=3&&strokes.flipper<=3&&strokes.heave<=6,`a stroke or two a step, about four for the heave: ${JSON.stringify(strokes)}`);
  }
  assert(finClear>=1,`the cygnet keeps a metre of clear water from the flipper: ${finClear.toFixed(2)} m`);
  assert(eyeOpen,'its first full breath opens its eye before it is free');
  assert.equal(rewards,1,'freeing it is rewarded once');
  assert(blowholeEdge>0&&blowholeEdge<0.75,`the blowhole is an easy target at rest: ${blowholeEdge.toFixed(2)}`);
  assert(c.podLeftAt!==null&&c.podLeftAt>=steps.find(([s])=>s==='free')[1],'the pod goes with the whale');
  for(const s of PLAYED)assert(invitations[s]<=0.7,`${s} invitation follows its actionable target promptly: ${invitations[s]} s`);
  assert(blockedSamples>0&&openSamples>0,`observed the blowhole covered, then cleared: ${JSON.stringify({fps,gust,portrait,steps})}`);
  assert(loopClear>0.25,`the entire caught loop stays above the swell: ${loopClear.toFixed(2)} m`);
  assert(tailBend<0.5,`the tail spreads its bend over the stock: ${tailBend.toFixed(3)} radians between spine joints`);
  assert(flukeEdge>0&&flukeEdge<0.99,`the raised flukes fit the farewell frame: ${flukeEdge.toFixed(3)}`);
  assert(railSamples>fps,'observed rail contact through both swims');
  results[results.length-1].clarity={invitations,blockedSamples,openSamples,loopClear,tailBend,flukeEdge,railSamples};
  results[results.length-1].steps=steps;results[results.length-1].blowholeEdge=+blowholeEdge.toFixed(2);
  results[results.length-1].finClear=+finClear.toFixed(2);
  results[results.length-1].waited=waited;if(circling)results[results.length-1].strokes=f.play.strokes;
}
// Each save beside the whale resumes as it was, with the boat held beside it; played or left to its valves from
// there, it is freed and the boat moors at the mirror, rewarded once.
for(const [point,played,state] of [
  ['whale-rest',true,(w,net)=>w.step==='breath'&&w.whale.phase==='resting'],
  ['whale-breath',false,(w,net)=>w.step==='eye'&&w.whale.phase==='woken'&&net.lift===1&&w.fold===0&&w.foldT<0&&w.eyeT<0],
  ['whale-eye',true,(w,net)=>w.step==='line'&&w.fold===1&&w.eyeT>0&&net.flap===1&&w.haul==='out'],
  ['whale-line',false,(w,net)=>w.step==='heave'&&w.haul==='bracing'&&net.grip!==null&&net.peel===0],
  ['whale-heave',true,(w,net)=>w.step==='flipper'&&w.heaves===tuning.netWhale.heaves&&net.grip===null&&net.peel===1],
  ['whale-flipper',false,(w,net)=>w.step==='free'&&w.whale.phase==='free'&&net.peel===1&&net.loop===1],
]){
  const f=fixture(0,false,false,played);
  const {chapter:c,boat:b,cygnet:k,sealife}=f;
  const w=c.whale,rest=w.rest,t0=95;
  b.beach(rest.x-Math.sin(w.yaw)*1.5,rest.z-Math.cos(w.yaw)*1.5,w.yaw);b.afloat=true;b.grounded=false;
  c.restoreCheckpoint(point,[3,t0]);
  frame(f,1/60,t0);
  const resumed={step:w.step,phase:w.whale.phase,fold:w.fold,eyeT:w.eyeT,haul:w.haul,lift:sealife.net.lift,peel:sealife.net.peel,loop:sealife.net.loop,gripped:sealife.net.grip!==null};
  assert(state(w,sealife.net),`${point} resumes as it was saved: ${JSON.stringify(resumed)}`);
  assert(sealife.net.shown,`${point}: the net is there from the first frame`);assert.equal(c.checkpoint,point);
  let gone=0,inSatchel=0;
  for(let i=1;i<60*800&&!c.done;i++){frame(f,1/60,t0+i/60);
    if((PLAYED.includes(w.step)&&w.stepTime>1)||(w.step==='free'&&!w.passed))assert(b.speed<0.2,`${point}: the boat held beside it in ${w.step}: ${b.speed}`);
    if(w.step==='free'&&!w.passed&&k.seat==='satchel')inSatchel++;
    if(w.step==='gone'&&!gone)gone=c.time;}
  assert(gone>0&&c.done,`from ${point} it is freed and the boat moors at the mirror`);
  assertPlayedBy(w,played,WHALE_SAVES.indexOf(point));
  assert(inSatchel>0,`${point}: the cygnet rides in the satchel as it goes`);
  assert.equal(takeCues().filter(q=>q==='restored').length,1,`${point}: rewarded once`);
}
// Resumed after it has gone, there is no whale and the boat sails on to the mirror.
{
  const f=fixture(0,false);
  const {chapter:c,boat:b,sealife}=f;
  const rest=c.whale.rest;
  b.beach(rest.x,rest.z,c.whale.yaw);b.afloat=true;b.grounded=false;
  c.restoreCheckpoint('whale-gone',[3,130]);
  assert.equal(c.whale.step,'gone');assert.equal(sealife.sleeper.mesh.visible,false);
  for(let i=0;i<60*120&&!c.done;i++){
    frame(f,1/60,130+i/60);assert(!sealife.sleeper.mesh.visible,'no whale after it has gone');
    assert(b.speedLimit>=tuning.seaPassage.speed-0.001,'the onward sail uses the normal boat speed limit');
  }
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
