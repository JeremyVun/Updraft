// Real PointerInput gestures against the chapter and actors; TOUCH=1 checks portrait coordinates.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document = { createElement: () => ({getContext: () => ({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})}) };
globalThis.location = { search: '?shot' };
globalThis.window = { innerWidth: 1600, innerHeight: 900, matchMedia: () => ({matches: false}) };
const { PointerInput } = await import('../src/input/pointer.ts');
const { Glider } = await import('../src/glider/glider.ts');
const { Boat } = await import('../src/traveller/boat.ts');
const { Traveller } = await import('../src/traveller/traveller.ts');
const { Cygnet } = await import('../src/creatures/cygnet.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { SkyMirror } = await import('../src/world/sky-mirror.ts');
const { SkyMirrorChapter } = await import('../src/story/sky-mirror.ts');
const { CrossingChapter } = await import('../src/story/crossing.ts');
const { CameraRig } = await import('../src/camera.ts');
const { ROUTES } = await import('../src/story/journey.ts');
const { HOME_MOORING } = await import('../src/story/home.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { MIRROR_LANDING, MIRROR_WATCH } = await import('../src/world/sky-mirror-layout.ts');
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
  const handlers = new Map();
  const input = new PointerInput({
    addEventListener(name, handler) { handlers.set(name, handler); },
    setPointerCapture() {},
    getBoundingClientRect() { return {left:0,top:0,width:window.innerWidth,height:window.innerHeight}; },
  });
  const pointer = (name, point = {x:0,y:0}) => handlers.get(name)({
    clientX:point.x, clientY:point.y, isPrimary:true, pointerId:1, pointerType:portrait?'touch':'mouse',
  });

  const cast = { boat, child, cygnet, carry, skyMirror, input, wind,
    plane: new Glider(wind, []),
    sealife: {dolphinsWith(){},fishNear(){},surfaceWhale(){},swimmerNear(){},whale:null,dolphinShow:null},
  };
  let chapter = new SkyMirrorChapter(cast), time=0;
  rig.cut(chapter.shot);
  const air={};
  return {cast,rig,release(){if(input.down)pointer('pointerup');},get chapter(){return chapter;},set chapter(value){chapter=value;},get time(){return time;}, step(stroke=false) {
    const dt=1/fps;time+=dt;atmo.uniforms.uTime.value=time;
    if(stroke) pointer(portrait&&!input.down?'pointerdown':'pointermove',stroke);
    input.anchor=skyMirror.liftTarget; input.update(dt,rig.camera,wind);
    skyMirror.brush(dt,time,input,rig.camera);chapter.update(dt,time);
    cast.plane.update(dt,time);
    boat.update(dt,time);child.update(dt);skyMirror.pose(child);carry.update(dt);
    cygnet.update(dt,time,child.position,wind.sample(cygnet.position.x,cygnet.position.z,air));carry.after();
    skyMirror.update(dt,time,child.position,cygnet.position,!cygnet.carried);
    rig.update(dt,time,chapter.shot,chapter.pace);
  }};
}

const f=fixture(60,process.env.TOUCH==='1'),room=f.cast.skyMirror;
for(let i=0;i<60*70 && f.chapter.beat!=='play';i++)f.step();
for(let i=0;i<120;i++)f.step();
assert.equal(f.chapter.beat,'play');
const project=at=>{const p=at.clone().project(f.rig.camera);return{x:(p.x+1)*window.innerWidth/2,y:(1-p.y)*window.innerHeight/2};};
function sweep(p,dx,dy,length=110){
  const n=Math.hypot(dx,dy);dx/=n;dy/=n;
  const from={x:p.x-dx*length/2,y:p.y-dy*length/2};
  f.step({x:p.x-dy*length-dx*length/2,y:p.y+dx*length-dy*length/2});
  f.step(from);
  for(let i=1;i<=30;i++)f.step({x:from.x+dx*length*i/30,y:from.y+dy*length*i/30});
  f.release();
  for(let i=0;i<14;i++)f.step();
}
for(let i=0;i<12 && !room.bubbles.length;i++)sweep(project(room.wand),1,0,140);
assert(room.bubbles.length);
console.log('spawn',room.bubbles[0].position.toArray(),'star',room.stars[0].origin.toArray());
for(let i=0;i<30 && !room.carried;i++){
  const b=room.bubbles.find(b=>!b.pop);assert(b,'bubble disappeared');
  const p=project(b.position),q=project(room.stars[0].origin.clone().setY(b.position.y));
  sweep(p,q.x-p.x,q.y-p.y);
  console.log('steer',i,b.position.toArray(),b.velocity.toArray(),f.cast.input.gustDir.toArray(),f.cast.input.charge);
}
assert(room.carried,'real pointer sweeps collect the light');
for(let circle=0;circle<12 && room.carried;circle++){
  if(process.env.TOUCH==='1') {f.release(); f.step();}
  for(let i=0;i<60 && room.carried;i++){
    const p=project(room.carried.position),a=i/60*Math.PI*2;
    f.step({x:p.x+Math.cos(a)*(process.env.TOUCH==='1'?18:28),y:p.y+Math.sin(a)*(process.env.TOUCH==='1'?18:28)});
  }
  console.log('circle',circle,room.carried?.position.y,f.cast.input.charge);
}
for(let i=0;i<240;i++)f.step();
assert.equal(room.progress,1);
console.log('real pointer collection and lift passed');
// The player can choose the remaining light instead of following the suggested order.
for(let i=0;i<60*50 && f.chapter.beat!=='play';i++)f.step();
assert.equal(f.chapter.beat,'play');
const other=room.stars[2].origin;
for(let i=0;i<4;i++){
  const p=project(other);f.step({x:p.x+(i%2?3:-3),y:p.y});
}
assert.equal(f.chapter.target,2,'a visible stroke chooses another fallen light');
console.log('player-selected star order passed');
