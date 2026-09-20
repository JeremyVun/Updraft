// Real actors, chapter and sailing routes. No renderer or synthetic chapter transitions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(s, c, n) { return n(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s, c); },
  load(u, c, n) { return u.endsWith('.ts') ? { format: 'module', shortCircuit: true, source: transformSync(new URL(u).pathname, fs.readFileSync(new URL(u), 'utf8')).code } : n(u, c); },
});
globalThis.document = { createElement: () => ({getContext: () => ({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})}) };
globalThis.location = { search: '?shot' };
globalThis.window = { innerWidth: 1600, innerHeight: 900, matchMedia: () => ({matches: false}) };
const { Glider } = await import('../src/glider/glider.ts');
const { Boat } = await import('../src/traveller/boat.ts');
const { Traveller } = await import('../src/traveller/traveller.ts');
const { Cygnet } = await import('../src/creatures/cygnet.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { SkyMirror } = await import('../src/world/sky-mirror.ts');
const { SkyMirrorChapter } = await import('../src/story/sky-mirror.ts');
const { DepartureKites } = await import('../src/story/departure-kites.ts');
const { CrossingChapter } = await import('../src/story/crossing.ts');
const { CameraRig } = await import('../src/camera.ts');
const { ROUTES } = await import('../src/story/journey.ts');
const { HOME_MOORING } = await import('../src/story/home.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { MIRROR_LANDING, MIRROR_ENTRY_DECK, MIRROR_WATCH, MIRROR_BERTH, mirrorBed } = await import('../src/world/sky-mirror-layout.ts');
const { worldHeight } = await import('../src/world/heightfield.ts');
const { tuning } = await import('../src/tuning.ts');
const { atmo } = await import('../src/world/atmosphere.ts');

function fixture(fps, portrait = false) {
  window.innerWidth = portrait ? 390 : 1600; window.innerHeight = portrait ? 844 : 900;
  const wind = { breeze: new THREE.Vector2(2.47, -0.8), calm: 3, addSplat(){}, sample(x,z,out) { return Object.assign(out,{x:2.47,z:-0.8,energy:0,lift:0}); } };
  const boat = new Boat(wind), child = new Traveller(wind), cygnet = new Cygnet(), skyMirror = new SkyMirror();
  cygnet.mount = child;
  const carry = new Carry(child, cygnet), rig = new CameraRig();
  rig.resize(portrait ? 390 : 1600, portrait ? 844 : 900);
  boat.beach(MIRROR_LANDING.x, MIRROR_LANDING.z, Math.PI); boat.grounded = true;
  child.place(MIRROR_LANDING.x + 2, MIRROR_LANDING.z - 3, Math.PI);
  cygnet.visible = true; cygnet.rideIn('cradle');
  const input = {world:new THREE.Vector3(MIRROR_WATCH.x,0,MIRROR_WATCH.z),ndc:new THREE.Vector2(),prevNdc:new THREE.Vector2(),present:true,muted:false,gust:0,gustDir:new THREE.Vector2(),charge:0};
  const cast = { boat, child, cygnet, carry, skyMirror, input, wind,
    plane: new Glider(wind, []),
    sealife: {dolphinsWith(){},fishNear(){},surfaceWhale(){},swimmerNear(){},whale:null,dolphinShow:null},
  };
  let chapter = new SkyMirrorChapter(cast), time=0;
  rig.cut(chapter.shot);
  const air={};
  return {cast,rig,get chapter(){return chapter;},set chapter(value){chapter=value;},get time(){return time;}, step(stroke=false) {
    const dt=1/fps;time+=dt;atmo.uniforms.uTime.value=time;
    input.prevNdc.copy(input.ndc); input.gust=0; input.charge=0;
    if(stroke && chapter.beat==='play') {
      const b=skyMirror.bubbles.find(b=>b.pop===0);
      const at=b?.position ?? skyMirror.wand;
      const screen=at.clone().project(rig.camera);
      input.prevNdc.set(screen.x-0.012,screen.y); input.ndc.set(screen.x+0.012,screen.y);
      input.world.copy(at).setY(0); input.gust=18;
      if(b?.star>=0)input.charge=0.9;
      else if(b){
        const star=skyMirror.stars[chapter.target].origin;
        input.gustDir.set(star.x-b.position.x,star.z-b.position.z).normalize();
        const toward=star.clone().setY(b.position.y).project(rig.camera).sub(screen).setZ(0).normalize();
        input.prevNdc.set(screen.x-toward.x*0.012,screen.y-toward.y*0.012);
        input.ndc.set(screen.x+toward.x*0.012,screen.y+toward.y*0.012);
      }
    }
    skyMirror.brush(dt,time,input,rig.camera);chapter.update(dt,time);
    cast.plane.update(dt,time);
    boat.update(dt,time);child.update(dt);skyMirror.pose(child);carry.update(dt);
    cygnet.update(dt,time,child.position,wind.sample(cygnet.position.x,cygnet.position.z,air));carry.after();
    skyMirror.update(dt,time,child.position,cygnet.position,!cygnet.carried);
    rig.update(dt,time,chapter.shot,chapter.pace);
  }};
}
const results=[];
// Actual sailing physics stop alongside the entry jetty, well before the walkable shallows.
{
  const f=fixture(60),{boat}=f.cast;
  boat.beach(-542,-2253,MIRROR_LANDING.yaw);boat.afloat=true;
  f.chapter=new CrossingChapter(f.cast,{route:[ROUTES.toMirror.at(-1)],moor:MIRROR_LANDING,arrivalSpeed:3});
  for(let i=0;i<60*90 && !f.chapter.done;i++) {
    f.step();assert(mirrorBed(boat.position.x,boat.position.z)<-2,'arrival hull stays in deep water');
  }
  assert(f.chapter.done,'boat reaches its mooring');
  f.chapter=new SkyMirrorChapter(f.cast);
  const d=MIRROR_ENTRY_DECK,dx=d.x1-d.x0,dz=d.z1-d.z0,length=Math.hypot(dx,dz);
  assert(length<17,'arrival jetty stays the same length as the departure jetty');
  for(let i=0;i<60*12;i++) {
    f.step();const p=f.cast.child.position;
    const along=((p.x-d.x0)*dx+(p.z-d.z0)*dz)/length;
    if(along<length)assert(Math.abs((p.x-d.x0)*dz-(p.z-d.z0)*dx)/length<0.2 && p.y>=0.27,'walk stays on entry planks');
  }
  assert(f.cast.child.position.z<MIRROR_ENTRY_DECK.z1,'child steps from the jetty onto the flat');
}
// The confident companion investigates and reacts, but never supplies puzzle progress or blocks departure.
{
  const f=fixture(60),{cygnet:k,skyMirror:room,child}=f.cast,c=f.chapter;
  c.restoreCheckpoint('stars-0',[0,0]);k.wing.restore('free',1);
  const from=k.position.clone();
  for(let i=0;i<60*10;i++) {
    f.step();
    if(k.errand)assert(k.errand.distanceTo(child.position)<tuning.mirrorCompanion.exploreRadius+.2);
    assert(mirrorBed(k.position.x,k.position.z)>-.04,'exploration stays on the shallow flat');
  }
  assert(k.position.distanceTo(from)>1,'the bird goes to investigate instead of staying a passenger');
  assert.equal(room.progress,0,'curiosity cannot complete a star');
  room.spawn();const b=room.bubbles.at(-1);b.position.copy(room.stars[0].origin).setY(b.radius+.08);
  for(let i=0;i<5;i++)f.step();
  assert(room.carried,'fixture bubble catches the light through the real simulation');
  assert.equal(k.mind.act,'stretch','both healed wings answer the captured light');
  assert.equal(k.errand,null,'the bird stops chasing once the bubble has a light');
  for(let i=0;i<60*5;i++)f.step();
  assert.equal(room.progress,0,'the player still supplies the updraft');
  c.gather();assert.equal(k.errand,null);assert.equal(k.pace,1);
}
// A reversal takes effect even while the shared wind still points the old way; release retains inertia.
{
  const f=fixture(60),room=f.cast.skyMirror,input=f.cast.input;
  f.chapter.restoreCheckpoint('stars-0',[0,0]);for(let i=0;i<60;i++)f.step();
  room.spawn();const b=room.bubbles[0];
  b.position.copy(f.cast.child.position).add(new THREE.Vector3(8,b.radius+0.08,2));
  const right=new THREE.Vector3().setFromMatrixColumn(f.rig.camera.matrixWorld,0).setY(0).normalize();
  b.velocity.copy(right).multiplyScalar(6);
  for(let i=0;i<3;i++) {
    const p=b.position.clone().project(f.rig.camera);
    input.prevNdc.set(p.x+0.012,p.y);input.ndc.set(p.x-0.012,p.y);
    input.gustDir.set(right.x,right.z);input.gust=10;input.charge=0;
    room.brush(1/60,f.time,input,f.rig.camera);
  }
  assert(b.velocity.dot(right)<-2,'left swipe visibly reverses rightward motion within 50ms');
  const from=b.position.clone();for(let i=0;i<30;i++)f.step();
  assert(b.position.distanceTo(from)>0.7,'bubble coasts after the stroke');
}
// A steering stroke can also cross a different star on the very frame this bubble catches its light.
// The chapter updates before the bubble simulation: navigation must already be locked while it is empty.
{
  const f=fixture(60),room=f.cast.skyMirror,c=f.chapter;
  c.restoreCheckpoint('stars-0',[0,0]);for(let i=0;i<60;i++)f.step();
  room.spawn();const b=room.bubbles[0];
  b.position.copy(room.stars[0].origin).setY(b.radius+0.08);b.velocity.set(0,0,0);
  room.requestedStar=1;f.step();
  assert(room.carried,'the bubble catches the first star');
  assert.equal(c.beat,'play','capture frame must not start walking to another star');
  assert.equal(c.target,0);
  const childAt=f.cast.child.position.clone();
  for(let i=0;i<60*20;i++) {
    room.requestedStar=1;f.step();
    assert.equal(c.beat,'play','wait for the player to lift the captured star');
    assert(f.cast.child.position.distanceTo(childAt)<0.1);
    const p=b.position.clone().project(f.rig.camera);
    assert(Math.abs(p.x)<0.85 && Math.abs(p.y)<0.85,'captured bubble remains visible');
  }
  assert.equal(room.progress,0,'capturing a star does not complete it');
  // Another bubble may finish its ascent while this one is still waiting for an updraft.
  room.stars[1].state='sky';room.completedMask=2;
  f.step();assert.equal(c.beat,'play','another returned star cannot abandon the currently captured light');
  assert.equal(c.target,0);
}
for(const [fps,portrait] of (process.env.RESTORE_ONLY?[]:[[60,false],[30,true]])) {
  const f=fixture(fps,portrait), c=f.chapter, room=f.cast.skyMirror;
  let arrival=0,sharedWalk=0;
  for(let i=0;i<fps*70;i++) {
    f.step();
    if(!arrival && c.beat==='play')arrival=f.time;
    if(!room.holdingWand && !f.cast.cygnet.carried && f.cast.child.moving)sharedWalk+=1/fps;
  }
  assert.equal(c.beat,'play',`arrival must reach the wand: child ${f.cast.child.position.toArray()}, stand ${c.stand.toArray()}, moving ${f.cast.child.moving}, acting ${f.cast.child.acting}, paper ${f.cast.plane.position.toArray()}, held ${f.cast.plane.held}, landed ${f.cast.plane.landed}`);
  assert(sharedWalk>15 && sharedWalk<30,'a short shared walk on the mirror, not a prolonged arrival');
  const wand=room.wand.clone().project(f.rig.camera),star=room.stars[0].origin.clone().project(f.rig.camera);
  assert(Math.abs(wand.x-star.x)>0.2,'hoop and target must read side by side');
  for(const at of [room.wand,room.stars[0].origin,f.cast.child.position]) {
    const p=at.clone().project(f.rig.camera);assert(Math.abs(p.x)<0.9 && Math.abs(p.y)<0.9,'play subjects stay on screen');
  }
  assert.equal(room.bubbles.length,0,'idle cannot make bubbles');
  assert.equal(room.progress,0,'idle cannot return stars');
  // Even a large stroke somewhere else must not create a bubble.
  f.cast.input.prevNdc.set(-0.99,-0.99);f.cast.input.ndc.set(-0.9,-0.99);
  room.brush(1/fps,f.time,f.cast.input,f.rig.camera);assert.equal(room.bubbles.length,0);
  let previous='',transitions=[];
  for(let i=0;i<fps*320 && !c.done;i++) {
    f.step(true);
    if(c.beat!==previous){transitions.push([c.beat,c.target,+f.time.toFixed(2),room.progress]);previous=c.beat;}
    assert(Number.isFinite(f.cast.child.position.y));
    for(const b of room.bubbles) assert(b.position.toArray().every(Number.isFinite));
    for(const light of room.stars.filter(s=>s.state==='rising' && s.flight>0.15)) {
      const p=light.light.position.clone().project(f.rig.camera);
      assert(Math.abs(p.x)<0.98 && Math.abs(p.y)<0.98,`rising star ${room.stars.indexOf(light)} at ${light.flight} stays in frame: ${p.toArray()}, portrait=${portrait}`);
    }
    if(c.beat==='reveal' && c.elapsed>3)for(const light of room.stars) {
      const p=light.sky.clone().project(f.rig.camera);
      assert(Math.abs(p.x)<0.95 && Math.abs(p.y)<0.95,`whole constellation visible: ${p.toArray()}, portrait=${portrait}`);
    }
    if(room.progress<3)assert(Math.hypot(f.cast.boat.position.x-MIRROR_BERTH.x,f.cast.boat.position.z-MIRROR_BERTH.z)>35,
      'the boat waits offshore until the constellation is complete');
  }
  assert(c.done,`chapter stalled: ${c.beat}, target ${c.target}, child ${f.cast.child.position.toArray()}, stand ${c.stand.toArray()}, plane ${f.cast.plane.position.toArray()}, held ${f.cast.plane.held}, moving ${f.cast.child.moving}, states ${room.stars.map(s=>s.state)}, bubbles ${JSON.stringify(room.bubbles.map(b=>({p:b.position.toArray(),star:b.star})))}`);
  assert.equal(room.completedMask,7);assert.equal(room.progress,3);
  assert(f.cast.child.riding && f.cast.cygnet.carried,'both aboard');
  assert(!room.active && !f.cast.plane.landingGround && f.cast.cygnet.mayFly,'chapter cleaned up');
  assert(f.cast.boat.position.x>-400,'far pier exit');
  results.push({fps,portrait,arrival,sharedWalk,transitions});console.error(`completed ${fps} fps portrait=${portrait}`);
}
// Every subset is a legal save; selected stars do not prescribe collection order.
for(let mask=0;mask<8;mask++) {
  const f=fixture(60);f.chapter.restoreCheckpoint(`stars-${mask}`,[mask,2]);
  assert.equal(f.chapter.checkpoint,`stars-${mask}`,'each completed subset has its own durable checkpoint');
  assert.equal(f.cast.skyMirror.completedMask,mask);
  if(!mask)assert(mirrorBed(f.cast.boat.position.x,f.cast.boat.position.z)<-2,'empty saves use the offshore entry mooring');
  assert(f.chapter.departureKite, 'the far-jetty kite is visible before and after restoring any star subset');
  for(let i=0;i<60;i++)f.step();
  assert.equal(f.cast.skyMirror.progress,mask.toString(2).replaceAll('0','').length);
  assert(f.cast.skyMirror.stars.every((s,i)=>s.state===((mask & (1<<i))?'sky':'fallen')));
  if(mask && mask<7)assert(Math.hypot(f.cast.boat.position.x-MIRROR_BERTH.x,f.cast.boat.position.z-MIRROR_BERTH.z)>35,
    'a partial save must not bypass the offshore gate');
}
// The almost still mirror must keep its exit marker in view from every playable star stop.
for (const portrait of [false, true]) for (const target of [0, 1, 2]) {
  const f = fixture(60, portrait); f.chapter.restoreCheckpoint('stars-0', [0, target]);
  const speed = tuning.wind.breeze * f.chapter.breeze;
  const wind = { calm: tuning.wind.calm * speed, sample(_x, _z, out) {
    return Object.assign(out, { x: Math.cos(-Math.PI / 10) * speed, z: Math.sin(-Math.PI / 10) * speed, energy: 0, lift: 0 });
  } };
  const kite = new DepartureKites(wind).markers.mirror;
  // Include several complete figure-eights; a single pose can miss the edge of the phone view.
  for (let i = 0; i < 1800; i++) {
    f.step(); kite.update(1 / 60, i / 60, f.rig.camera, f.chapter.departureKite);
    if (i < 120) continue;
    const p = kite.position.clone().project(f.rig.camera);
    assert(kite.group.visible && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95,
      `departure kite from star ${target}, portrait=${portrait}: ${p.toArray()}`);
  }
}
// The player can finish at any star; portrait must show the whole constellation from each stop.
for(const target of [0,1,2]) {
  const f=fixture(60,true);f.chapter.restoreCheckpoint('stars-7',[7,target]);
  for(let i=0;i<240;i++) {
    f.step();
    if(i<180)continue;
    for(const s of f.cast.skyMirror.stars) {
      const p=s.sky.clone().project(f.rig.camera);
      assert(Math.abs(p.x)<0.95 && Math.abs(p.y)<0.95,`portrait constellation after target ${target}: ${p.toArray()}`);
    }
  }
}
// Curled steering strokes cannot lift an empty bubble, nor leave a stale updraft on capture.
{
  const f=fixture(60),room=f.cast.skyMirror,input=f.cast.input;
  f.chapter.restoreCheckpoint('stars-0',[0,0]);
  for(let i=0;i<60;i++)f.step();
  room.spawn(); const b=room.bubbles[0];
  b.position.copy(room.stars[0].origin).add(new THREE.Vector3(4,b.radius,0));b.velocity.set(0,0,0);
  const brush=charge=>{
    const p=b.position.clone().project(f.rig.camera);input.prevNdc.set(p.x-0.015,p.y);input.ndc.set(p.x+0.015,p.y);
    input.charge=charge;input.gust=15;input.gustDir.set(-1,0);room.brush(1/60,f.time,input,f.rig.camera);
  };
  brush(0.95);assert.equal(b.velocity.y,0);assert(Math.hypot(b.velocity.x,b.velocity.z)>0,'charged empty stroke still steers');
  b.position.copy(room.stars[0].origin).setY(b.radius+0.08);b.velocity.set(0,0,0);
  room.update(1/60,f.time,f.cast.child.position,f.cast.cygnet.position,true);
  assert.equal(b.star,0);assert(!b.liftArmed);
  brush(0.95);assert(b.velocity.y<=0,'capture does not inherit an accidental updraft');
  const screen=b.position.clone().project(f.rig.camera);
  for(let i=0;i<20;i++) {
    const a=i*Math.PI*2/20,next=(i+1)*Math.PI*2/20;
    input.prevNdc.set(screen.x+Math.cos(a)*0.025,screen.y+Math.sin(a)*0.025);
    input.ndc.set(screen.x+Math.cos(next)*0.025,screen.y+Math.sin(next)*0.025);
    room.brush(1/60,f.time,input,f.rig.camera);
  }
  assert(b.liftArmed && b.velocity.y>0,'a continuous fresh circle can lift without a release');
  assert.equal(b.velocity.x,0,'filled bubbles settle instead of skating sideways under the lifting circle');
  brush(0);brush(0.95);assert(b.velocity.y>0,'a fresh circle lifts a filled bubble');
}
for(const point of ['moon','tide','lantern','reflection','window']) {
  const f=fixture(60);f.chapter.restoreCheckpoint(point,[0]);
  for(let i=0;i<60;i++)f.step();
  assert.equal(f.cast.skyMirror.progress,point==='tide'?1:point==='lantern'?2:0);
  assert.equal(f.chapter.beat,'play');
}
// A lost bubble returns its light without undoing any restored stars.
{
  const f=fixture(60),room=f.cast.skyMirror;
  f.chapter.restoreCheckpoint('stars',[1,2]);
  for(let i=0;i<60*30 && !room.carried;i++)f.step(true);
  assert(room.carried,'a bubble catches an unreturned light');
  room.pop(room.carried);
  for(let i=0;i<150;i++)f.step();
  assert.equal(room.completedMask,1);assert.equal(room.stars[2].state,'fallen');
}
console.log(JSON.stringify(results,null,2));
