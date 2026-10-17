// Sleeping island: real actors and feather, idle gates, gentle input, dawn and boarding.
// Usage: node tools/sleeping-logic-check.mjs. CPU checks complement sleeping-check.mjs GPU playthroughs.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';

globalThis.location={search:'?shot'};
globalThis.window={innerWidth:Number(process.env.W??1600),innerHeight:Number(process.env.H??900),matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {Traveller}=await import('../src/traveller/traveller.ts');
const {Cygnet}=await import('../src/creatures/cygnet.ts');
const {Carry}=await import('../src/companion/carry.ts');
const {SwanFlock}=await import('../src/creatures/flock.ts');
const {Glider}=await import('../src/glider/glider.ts');
const {Boat}=await import('../src/traveller/boat.ts');
const {SleepingChapter}=await import('../src/story/sleeping.ts');
const {SleepingTrail,SNOW_AT}=await import('../src/world/sleeping-trail.ts');
const {SleepingHearth}=await import('../src/world/sleeping-hearth.ts');
const {sleepPathAt,SLEEP_PATH,SLEEP_DRIFT_STOP}=await import('../src/world/sleeping-layout.ts');
const {SLEEP_STEP}=await import('../src/world/heightfield.ts');
// The frost-heaved bank is the one place the way is too steep to walk: the bird is helped up it, not walked.
const onBank=(x,z)=>Math.hypot(x-SLEEP_STEP.x,z-SLEEP_STEP.z)<1.4;
const {heightAt}=await import('../src/world/island.ts');
const {CurtainRibbon}=await import('../src/world/sleeping-ribbon.ts');
const {CURTAIN_KNOT,CURTAIN_END}=await import('../src/world/sleeping.ts');
const {SleepingIsland}=await import('../src/world/sleeping.ts');
const {tuning}=await import('../src/tuning.ts');
const {BED,WINDOW,PILLOW}=await import('../src/world/sleeping.ts');
const {Feather}=await import('../src/fx/feather.ts');
const {restoreWingCare}=await import('../src/story/wing-care.ts');
const {CameraRig}=await import('../src/camera.ts');
const {mulberry32}=await import('../src/world/noise.ts');

function fixture(fps=60) {
  Math.random=mulberry32(42);
  const air={x:0,z:0,energy:0,lift:0};
  const wind={calm:0,breeze:new THREE.Vector2(),sample(_x,_z,out){return Object.assign(out,air);},addSplat(){}};
  const child=new Traveller(wind),cygnet=new Cygnet(),flock=new SwanFlock(),boat=new Boat(wind),plane=new Glider(wind,[]);
  cygnet.mount=child;cygnet.visible=true;
  const carry=new Carry(child,cygnet);
  const cast={child,cygnet,flock,boat,plane,carry,wind,nearby:()=>false,
    life:{regions:{island:new THREE.Vector4(),wave:new THREE.Vector4(),waiting:new THREE.Vector4()}},
    sleeping:{dressing:{walker:null},hearth:new SleepingHearth(),trail:new SleepingTrail(),carve(){},ribbon:new CurtainRibbon(CURTAIN_KNOT,CURTAIN_END),blanketEdge:SleepingIsland.prototype.blanketEdge,onCovers:SleepingIsland.prototype.onCovers,fold:new THREE.Vector3(),under:new THREE.Vector3(0,1.15,0),pull:{value:0},lift:{value:0},shown:{blanket:0,curtains:0},get curtainOpening(){return this.shown.curtains;},feather:new Feather(wind),bedside:BED.clone().add(new THREE.Vector3(2.25,0,-0.84)),pillowPuff(){},lane(){},laneOpen:0,fog:1,frost:0.3,dawn:0,curtains:0},
  };
  let time=0;
  const rig=new CameraRig();rig.resize(Number(process.env.W??1600),Number(process.env.H??900));
  const camera=rig.camera,cameraMotion={};let prepared=false,previousRotation=null;
  return {cast,air,cameraMotion,get time(){return time;},step(chapter) {
    const dt=1/fps;time+=dt;
    chapter?.update(dt,time);child.update(dt);carry.update(dt);flock.update(dt,time);
    cygnet.update(dt,time,child.position,air);carry.after();
    if(chapter){
      if(!prepared){rig.cut(chapter.shot);prepared=true;}else rig.update(dt,time,chapter.shot,chapter.pace);
      for (const [name,values] of [['camera position',camera.position.toArray()],['camera rotation',camera.quaternion.toArray()],['child',child.position.toArray()],['boat',boat.position.toArray()]])
        assert(values.every(Number.isFinite), `${name} is non-finite at ${chapter.beat}, ${fps} fps, ${time}s`);
      const row=cameraMotion[chapter.beat]??={maxTurn:0,worstPrimary:0};
      if(previousRotation)row.maxTurn=Math.max(row.maxTurn,previousRotation.angleTo(camera.quaternion)/dt);
      previousRotation=camera.quaternion.clone();
      if(chapter.shot.subjects){const p=chapter.shot.subjects.primary.clone().project(camera),edge=Math.max(Math.abs(p.x),Math.abs(p.y));
        assert(Number.isFinite(edge), `primary projection is non-finite at ${chapter.beat}`);
        if(edge>row.worstPrimary){row.worstPrimary=edge;row.at=chapter.t;row.screen=p.toArray();}}
    }
    const s=cast.sleeping,t=tuning.sleeping;
    s.trail.update(dt,time,s.dawn,camera,s.cold||0);
    s.shown.curtains+=(s.curtains-s.shown.curtains)*(1-Math.exp(-dt/t.ease));
    s.ribbon.update(dt,time,s.shown.curtains);
    s.shown.blanket+=(s.blanket-s.shown.blanket)*(s.blanketHeld?1:1-Math.exp(-dt/t.ease));
    s.fold.x=s.shown.blanket*t.blanketLift;
    s.under.set((s.sleeper||0)*t.sleeperHigh,1.15,Math.sin(time*.75)*.06*(s.sleeper||0));
    s.pull.value+=((s.blanketPull||0)-s.pull.value)*(1-Math.exp(-dt*8));
    s.lift.value+=((s.blanketLift||0)-s.lift.value)*(1-Math.exp(-dt*8));
    cygnet.heard.length=0;
  }};
}

const climbs={};
for (const fps of [30,60]) {
  const f=fixture(fps),{child,cygnet:k,plane,boat,sleeping}=f.cast;
  child.place(-139,-1916,Math.PI); k.bond=0.5; k.rideIn('cradle'); restoreWingCare(k,'sleeping');
  boat.beach(-134,-1916,Math.PI);boat.grounded=true;
  const c=new SleepingChapter(f.cast);
  const step=()=>{f.step(c);plane.update(1/fps,f.time);boat.update(1/fps,f.time);sleeping.feather.update(1/fps,f.time);};
  let handGap=0, firstCold=-1;
  for(let i=0;i<fps*120;i++){
    step();
    if(c.beat==='asleep' && sleeping.cold>=.18 && firstCold<0)firstCold=c.t;
    if(c.beat==='tuckIn'||c.beat==='asleep'&&c.t<tuning.sleeping.winterBeginsAt)assert.equal(sleeping.cold,0,'cold breath must wait for visible frost onset');
    if((c.beat==='tuckIn' || (c.beat==='edge' && c.departureIndex<2)) && k.state==='following') {
      const axis=new THREE.Vector2(-.35,-.94).normalize(),side=new THREE.Vector2(-axis.y,axis.x);
      const d=new THREE.Vector2(k.position.x-BED.x,k.position.z-BED.z);
      assert(Math.abs(d.dot(side))>1.05 || Math.abs(d.dot(axis))>1.95,'bedside walk crossed the mattress');
      assert(Math.abs(k.position.y-heightAt(k.position.x,k.position.z))<.08,'bedside walk floated above the grass');
    }
    if(c.beat==='tuckIn'&&c.t>19&&c.t<21)for(const hand of [0,1])
      handGap=Math.max(handGap,child.mitten(hand,new THREE.Vector3()).distanceTo(c.blanketHand[hand]));
  }
  assert(firstCold>=4 && firstCold<=5,`cold cues should start 4–5 seconds after sleep, got ${firstCold}`);
  console.log(`Bedtime mitten gap at ${fps}fps: ${handGap.toFixed(3)}m`);
  assert(handGap<0.12,"the quilt must remain within the tucking hands reach");
  assert.equal(c.beat,'asleep','waiting cannot release the feather');
  assert(!sleeping.feather.flying);assert(c.dusk>1.8);
  for(let i=0;i<fps;i++){c.brushDry(0.25);step();}
  assert.equal(c.beat,'feather','a modest screen stroke must release the feather');
  const beats=[],starts={}; let minHeadClearance=Infinity,maxPreenGap=0; let preenSamples=0, worstHead=null;
  // The player: strokes at the drift and the fog once each asks for them, circles at the step, a tailwind on the crest
  // at 30 fps only, so the two runs compare the crest with and without it.
  const player={beat:null,since:0,ready:-1,held:null,deepest:0,hopedLow:0,steppedAt:null};
  const tailwind=fps===30;
  for(let i=0;i<fps*240&&c.beat!=='hilltop';i++){
    if(beats.at(-1)!==c.beat){beats.push(c.beat);starts[c.beat]??=f.time;}
    if(player.beat!==c.beat)Object.assign(player,{beat:c.beat,since:0,ready:-1});
    player.since+=1/fps;
    Object.assign(f.air,{x:0,z:0,energy:0,lift:0});
    if(c.beat==='snow'){
      if(!c.windInvitation){
        assert.equal(c.encounterStroke,0,'the drift counts strokes only once the bird has tried it');
        player.deepest=Math.max(player.deepest,sleeping.trail.snowDepthAt(k.position.x,k.position.z));
      } else {
        if(player.ready<0)player.ready=player.since;
        const into=player.since-player.ready;
        // One sweep, a long pause that must hold what it took, then sweeps until the drift is down.
        if(into>0.5&&into<0.95)c.brushDry(0.3);
        if(into>1.6&&into<3.4){player.held??=sleeping.trail.snow;assert.equal(sleeping.trail.snow,player.held,'an earned layer must hold while the player pauses');}
        if(into>3.6&&(into-3.6)%1.1<0.45)c.brushDry(0.3);
      }
    }
    if(c.beat==='step'){
      if(c.stage!=='ready'&&c.stage!=='over')assert(!c.invitesFlight,'the step asks for circles only after the try');
      if(c.stage==='ready'){
        if(player.ready<0)player.ready=player.since;
        const into=player.since-player.ready;
        // A gust under it and a shaky hand first, which only lift its hopes; then gentle circles, a loop in 1.6 s.
        if(into>1&&into<3){Object.assign(f.air,{lift:1.0,energy:0.3});c.circling(Math.sin(into*40)*.6);}
        if(into>=3){Object.assign(f.air,{lift:1.0,energy:0.3});c.circling((into-3)*Math.PI*2/1.6);}
      }
      if(c.stage==='over'&&player.steppedAt===null){
        player.steppedAt=player.since-player.ready;
        assert(player.steppedAt>3,`a gust and a shaky hand must not get it up the step: ${player.steppedAt}`);
      }
    }
    if(c.beat==='mist'){
      if(!c.windInvitation)assert.equal(c.encounterStroke,0,'the fog counts strokes only once the bird has turned uphill');
      else {
        if(player.ready<0)player.ready=player.since;
        if(player.since-player.ready>0.6&&(player.since-player.ready)%1.1<0.5)c.brushDry(0.22);
      }
    }
    if(c.beat==='crest'&&tailwind){
      const a=SLEEP_PATH[c.routeIndex-1],b=SLEEP_PATH[c.routeIndex],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
      Object.assign(f.air,{x:(b[0]-a[0])/l*6,z:(b[1]-a[1])/l*6,energy:0.5});
    }
    step();
    if(c.beat==='edge' && c.departureIndex<2) {
      const axis=new THREE.Vector2(-.35,-.94).normalize(),side=new THREE.Vector2(-axis.y,axis.x);
      const d=new THREE.Vector2(k.position.x-BED.x,k.position.z-BED.z);
      assert(Math.abs(d.dot(side))>1.05 || Math.abs(d.dot(axis))>1.95,'departure crossed the bed');
      assert(Math.abs(k.position.y-heightAt(k.position.x,k.position.z))<.08,'departure did not use the grass');
    }
    if(['edge','climb','snow','step','mist','crest'].includes(c.beat) && (c.beat!=='edge'||c.departureIndex>=2)) {
      const path=sleepPathAt(k.position.x,k.position.z);
      assert(path.distance<1.65,`bird left grass corridor: ${path.distance} at ${k.position.toArray()}`);
      const slope=Math.hypot(heightAt(k.position.x+.1,k.position.z)-heightAt(k.position.x-.1,k.position.z),heightAt(k.position.x,k.position.z+.1)-heightAt(k.position.x,k.position.z-.1))/.2;
      if(!onBank(k.position.x,k.position.z))assert(slope<0.65,`bird climbed cliff: slope ${slope}, at ${k.position.toArray()}, route ${c.routeIndex}`);
    }
    if(c.beat==='unbinding' && k.preenWeight>.2) {
      const head=k.nodes[6].localToWorld(new THREE.Vector3(0,.08,.01));
      k.nodes[1].worldToLocal(head);
      const clearance=Math.sqrt((head.x/.245)**2+((head.y-.02)/.22)**2+((head.z+.01)/.31)**2);
      if(clearance<minHeadClearance){minHeadClearance=clearance;worstHead={t:c.t,weight:k.preenWeight,local:head.toArray()};}
      if(k.preenWeight>.98)maxPreenGap=Math.max(maxPreenGap,k.billTip(new THREE.Vector3()).distanceTo(k.preenAt));preenSamples++;
    }
    if(c.beat==='climb' && c.snowDone && !c.stepDone) assert(sleeping.trail.snowDepthAt(k.position.x,k.position.z)<.13,`bird entered uncleared snow: ${sleeping.trail.snowDepthAt(k.position.x,k.position.z)} at ${k.position.toArray()} route ${c.routeIndex}`);
    if(['climb','crest'].includes(c.beat) && c.mistDone) assert.equal(sleeping.feather.heldBy,k,'feather must stay in the bill through the upper fog');
    if(['climb','crest'].includes(c.beat) && c.stepDone) assert(k.wing.recovery===1&&k.wing.state==='wrapped','the bandage stays on and the wing eases once over the step');
    if(c.beat==='step') assert(!k.flying&&k.wing.state==='wrapped','the step never lets it fly or unwraps it');
    assert(c.dusk>1.65,'morning arrived before the first flight');
  }
  for(const b of ['snow','step','mist','crest'])assert(beats.includes(b),`the ${b} stop must be on the walking route`);
  assert(player.deepest>.15&&player.deepest<.4,`the bird tries the drift chest deep: ${player.deepest}`);
  assert(player.steppedAt!==null&&player.steppedAt<6.5,`a loop and a half of gentle circles must get it up the step: ${player.steppedAt}`);
  assert(k.position.y>12.5,'the step leaves it on top');
  assert(c.glances===3,`three looks back: ${c.glances}`);
  const at=Object.entries(starts).map(([b,t])=>`${b} ${(t-starts.edge).toFixed(1)}s`).join(', ');
  console.log(`Climb ${fps}fps${tailwind?' with a tailwind on the crest':''}: ${at}; crest ${((starts.unbinding??f.time)-starts.crest).toFixed(1)}s`);
  climbs[fps]={total:starts.unbinding-starts.edge,crest:starts.unbinding-starts.crest};
  assert(preenSamples>fps*3,'the whole physical unwrapping must be observed');
  if(minHeadClearance<=1.1)console.log({worstHead});
  assert(minHeadClearance>1.1,`preening put the face inside the chest: ${minHeadClearance}`);
  assert(maxPreenGap<.035,`the bill lost the linen: ${maxPreenGap}`);
  assert.equal(k.preenAt,null,'the preen target must release before the bird asks for lift');
  assert.equal(k.preenWeight,0,'neck IK must completely release after unwrapping');
  console.log(`Preen ${fps}fps: body clearance ${minHeadClearance.toFixed(2)}, bill gap ${maxPreenGap.toFixed(3)}m`);
    assert.equal(c.beat,'hilltop');assert.equal(k.wing.state,'free');assert.equal(sleeping.curtains,0);
  for(let i=0;i<fps*80;i++)step();
  assert.equal(c.beat,'hilltop','waiting cannot complete the rescue');assert(!k.flying);
  Object.assign(f.air,{lift:1.1,energy:0.5});
  for(let i=0;i<fps*3&&c.beat!=='reachRibbon';i++)step();
  assert.equal(c.beat,'reachRibbon');
  assert.equal(sleeping.curtains,0);
  for(let i=0;i<fps*7&&c.beat!=='glide';i++){step();if(c.beat==='pullRibbon'){assert(k.billTip(new THREE.Vector3()).distanceTo(k.billGrip)<0.01);assert(sleeping.ribbon.held,'the tail remains in the bill while the curtains start opening');}}
  assert.equal(c.beat,'glide','gentle lift should start the glide');
  assert(sleeping.curtainOpening>=tuning.sleeping.ribbonReleaseOpening,'visible curtain opening must precede the bird releasing');
  assert(!sleeping.ribbon.held && !k.billGrip && !k.steadyLift,'the release must free the ribbon and normal flight');
  Object.assign(f.air,{lift:0,energy:0});
  for(let i=0;i<fps*2.5;i++)step();
  assert(sleeping.curtains===1 && sleeping.laneOpen<0.4,'the summit window opens before light reaches the bed');
  for(let i=0;i<fps*75&&!c.done;i++)step();
  assert(c.done,'both travellers must reach the boat');
  assert.equal(k.wing.state,'free');assert.equal(k.flights,1);
  assert(child.look.lie<1e-5,'sleeping pose leaked into walking');
  assert(sleeping.dawn===1&&sleeping.curtains===1&&sleeping.fog===0);
  fs.writeFileSync(`/tmp/updraft-sleeping-camera-${fps}-${process.env.W??1600}.json`,JSON.stringify(f.cameraMotion,null,2));
  for(const [beat,row] of Object.entries(f.cameraMotion))
    assert(row.worstPrimary<.901, `${beat}: primary leaves the eased frame (${row.worstPrimary})`);
  for(const beat of ['glide','waking'])
    assert(f.cameraMotion[beat].maxTurn<.2, `${beat}: camera reverses across the bird`);
  console.log('Sleeping camera',JSON.stringify(f.cameraMotion));
  console.log(`${fps}fps: idle gates, modest pillow stroke, cold ascent, healed wing, gentle lift, dawn and boarding pass.`);
}

// The summit window must read from the bedside establishing shot, and its light must reach the pillow.
for(const [name,eye] of [['bedside camera',BED.clone().add(new THREE.Vector3(14,7,15))],['pillow',PILLOW.clone().add(new THREE.Vector3(0,.4,0))]]){
  let lowest=Infinity;
  for(let i=1;i<100;i++){
    const p=WINDOW.clone().lerp(eye,i/100);
    lowest=Math.min(lowest,p.y-heightAt(p.x,p.z));
  }
  assert(lowest>.08,`terrain hides window from ${name}: clearance ${lowest}`);
}

// Keep the lower curtain corners visible too, not merely the centre of the landmark.
const bedsideEye=BED.clone().add(new THREE.Vector3(14,7,15));
for(const side of [-1,1])for(let i=1;i<100;i++){
  const p=WINDOW.clone().add(new THREE.Vector3(side,-.9,0)).lerp(bedsideEye,i/100);
  assert(p.y-heightAt(p.x,p.z)>.08,'the hillside hides the lower curtain from the bed');
}

// The ribbon really hangs above the exposed slope, and the bed is on a terrace rather than in a pit.
assert(CURTAIN_END.y-heightAt(CURTAIN_END.x,CURTAIN_END.z)>4,'the ribbon needs visible empty air beneath it');
for(let i=1;i<SLEEP_PATH.length;i++)for(let j=0;j<=20;j++)for(const side of [-0.6,0,0.6]){
  const a=SLEEP_PATH[i-1],b=SLEEP_PATH[i],u=j/20,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  const x=a[0]+dx*u-dz/len*side,z=a[1]+dz*u+dx/len*side;
  const slope=Math.hypot(heightAt(x+.1,z)-heightAt(x-.1,z),heightAt(x,z+.1)-heightAt(x,z-.1))/.2;
  if(!onBank(x,z))assert(slope<0.65,`grass shelf slope ${slope} at ${x},${z}`);
}
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

// A player can thrash the wind sideways, reverse it, then leave. The bird must keep its footing.
{
  const f=fixture(30),c=new SleepingChapter(f.cast),k=f.cast.cygnet,feather=f.cast.sleeping.feather;
  restoreWingCare(k,'sleeping');c.restoreCheckpoint('feather');
  const stops=new Set();let worstSlope=0;
  for(let i=0;i<30*220&&c.beat!=='unbinding';i++){
    const angle=Math.floor(i/90)*2.4;
    Object.assign(f.air,{x:Math.cos(angle)*24,z:Math.sin(angle)*24,lift:i%240<120?2:0,energy:1.5});
    if(['snow','step','mist'].includes(c.beat))stops.add(c.beat);
    if(['snow','mist'].includes(c.beat)){
      if(!c.windInvitation)assert.equal(c.encounterStroke,0,'ambient and violent wind must not solve a winter gate');
      else c.brushDry(.3);
    }
    if(c.beat==='step')c.circling(i*.12);
    f.step(c);feather.update(1/30,f.time);
    const slope=Math.hypot(heightAt(k.position.x+.1,k.position.z)-heightAt(k.position.x-.1,k.position.z),heightAt(k.position.x,k.position.z+.1)-heightAt(k.position.x,k.position.z-.1))/.2;
    if(!onBank(k.position.x,k.position.z)){worstSlope=Math.max(worstSlope,slope);assert(slope<.65,'crosswinds steered the bird onto the cliff');}
    assert(sleepPathAt(k.position.x,k.position.z).distance<1.65,'crosswinds pulled the bird off its route');
    // Over the drift it hangs above the snow it is waiting on, so its height there is the drift's, not a stray.
    assert(Math.hypot(feather.position.x-k.position.x,feather.position.z-k.position.z)<6,'crosswinds hid the guide far from the bird');
    assert(Number.isFinite(k.position.length()+feather.position.length()),'gust reversal produced an invalid position');
  }
  assert.equal(c.beat,'unbinding','hostile crosswinds stalled the ascent');
  assert(stops.has('snow')&&stops.has('step')&&stops.has('mist'),'hostile wind skipped a stop');
  console.log(`Reversing crosswinds passed; worst walking slope ${worstSlope.toFixed(3)}.`);
}

// ADVERSARIAL=1: at each stop the player waits until the invitation shows, then uses the wrong verb, then gives a
// little of the right one and stops. Nothing may solve itself, nothing earned may be lost, and the crest needs nothing.
if(process.env.ADVERSARIAL==='1'){
  const f=fixture(30),c=new SleepingChapter(f.cast),k=f.cast.cygnet,feather=f.cast.sleeping.feather,trail=f.cast.sleeping.trail;
  restoreWingCare(k,'sleeping');c.restoreCheckpoint('feather');
  const run=(seconds,each=()=>{})=>{for(let i=0;i<seconds*30;i++){Object.assign(f.air,{x:0,z:0,energy:0,lift:0});each(i/30);f.step(c);feather.update(1/30,f.time);}};
  const until=(beat,limit=120)=>{for(let i=0;i<limit*30&&c.beat!==beat;i++){Object.assign(f.air,{x:0,z:0,energy:0,lift:0});f.step(c);feather.update(1/30,f.time);}assert.equal(c.beat,beat,`never reached ${beat}`);};
  const invited=()=>c.beat==='step'?!!c.coax:!!c.windInvitation;
  for(const stop of ['snow','step','mist']){
    until(stop);
    let shown=-1;
    run(40,t=>{if(shown<0&&invited())shown=t;});
    assert.equal(c.beat,stop,`${stop}: waiting solved the stop`);
    assert(shown>0,`${stop}: the invitation never showed`);
    if(stop==='step')assert.equal(c.stage,'ready','waiting got it up the step');else assert.equal(c.encounterStroke,0,`${stop}: waiting gave progress`);
    // The wrong verb: circles where strokes are wanted, strokes where circles are.
    if(stop==='step')run(10,()=>{c.brushDry(.4);Object.assign(f.air,{energy:1,x:6});});
    else run(10,()=>Object.assign(f.air,{lift:1.4}));
    assert.equal(c.beat,stop,`${stop}: the wrong verb solved it`);
    if(stop==='step'){assert.equal(c.stage,'ready','strokes at the step must not get it over');}
    else {
      assert.equal(c.encounterStroke,0,`${stop}: circles gave stroke progress`);
      run(0.5,()=>c.brushDry(.3));run(1);
      const earned=c.encounterStroke,shownLayer=trail.snow;
      assert(earned>0,`${stop}: a short stroke gave nothing`);
      run(12);
      assert.equal(c.encounterStroke,earned,`${stop}: interrupted progress was lost`);
      if(stop==='snow')assert(shownLayer>0&&trail.snow===shownLayer,'a short sweep takes a whole layer and keeps it');
      console.log(`Adversarial ${stop}: invitation at ${shown.toFixed(1)}s, wrong verb harmless, ${stop==='snow'?`${(shownLayer*tuning.sleeping.snowLayers).toFixed(0)} layer kept`:`${earned.toFixed(2)} kept`}`);
    }
    if(stop==='step'){run(6,t=>{if(t>1)Object.assign(f.air,{lift:1});});console.log(`Adversarial step: coax after ${shown.toFixed(1)}s, strokes harmless`);}
    else for(let i=0;i<30*30&&c.beat===stop;i++){c.brushDry(.3);f.step(c);feather.update(1/30,f.time);}
    assert.notEqual(c.beat,stop,`${stop}: the right verb did not solve it`);
  }
  until('crest');const at=f.time;until('unbinding',60);
  console.log(`Adversarial crest: no input, arrived in ${(f.time-at).toFixed(1)}s with the feather held: ${feather.heldBy===k}`);
  assert.equal(feather.heldBy,k,'the bird reaches the summit with the feather in its bill');
}

assert(Math.hypot(SNOW_AT.x-SLEEP_PATH[SLEEP_DRIFT_STOP][0],SNOW_AT.z-SLEEP_PATH[SLEEP_DRIFT_STOP][1])>3.25,'the bird must wait on turf before trying the drift');

// Spent fuel stays cold under later wind and after a restored morning checkpoint.
{
  const hearth=new SleepingHearth(),camera=new THREE.PerspectiveCamera();
  const wind={sample(_x,_z,out){Object.assign(out,{x:8,z:3,energy:4,lift:0});}};
  hearth.update(1/60,0,0,camera,wind);assert.equal(hearth.flame.value,1);
  hearth.update(1/60,1,.5,camera,wind);assert.equal(hearth.flame.value,0);assert(hearth.embers.value>0);
  hearth.update(1/60,2,.65,camera,wind);assert.equal(hearth.embers.value,0);
  hearth.update(1/60,3,0,camera,wind);assert.equal(hearth.flame.value,0);assert.equal(hearth.embers.value,0);
  const restored=new SleepingHearth();restored.extinguish();restored.update(1/60,0,0,camera,wind);
  assert.equal(restored.flame.value,0);console.log('Hearth: flame, embers, ash and spent-fuel checkpoint pass.');
}
