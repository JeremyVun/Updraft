// Real pond sequence and camera: framing plus terrain/grass sight lines, in both viewport shapes.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location={search:'?shot'};
globalThis.window={innerWidth:1600,innerHeight:800,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {Traveller}=await import('../src/traveller/traveller.ts');
const {Cygnet}=await import('../src/creatures/cygnet.ts');
const {Carry}=await import('../src/companion/carry.ts');
const {SwanFlock}=await import('../src/creatures/flock.ts');
const {Glider}=await import('../src/glider/glider.ts');
const {Boat}=await import('../src/traveller/boat.ts');
const {MeadowChapter}=await import('../src/story/meadow.ts');
const {CameraRig}=await import('../src/camera.ts');
const {heightAt}=await import('../src/world/island.ts');
const {grassHeightAt}=await import('../src/world/grass.ts');
const {atmo}=await import('../src/world/atmosphere.ts');
const {tuning}=await import('../src/tuning.ts');

for(const fps of [30,60,120]) for(const [width,height] of [[1600,800],[390,844]]) for(const startX of [8,40]) {
  let seed=731+startX;
  Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  window.innerWidth=width;window.innerHeight=height;
  const air={x:0,z:0,energy:0,lift:0};
  const wind={breeze:new THREE.Vector2(),sample(_x,_z,out){return Object.assign(out,air);},addSplat(){}};
  const child=new Traveller(wind),cygnet=new Cygnet(),flock=new SwanFlock(),boat=new Boat(wind),plane=new Glider(wind,[]);
  cygnet.mount=child;cygnet.visible=true;cygnet.wing.restore('wrapped',.4);
  const carry=new Carry(child,cygnet),rig=new CameraRig();rig.resize(width,height);
  const cast={child,cygnet,flock,boat,plane,carry,wind,nearby:()=>false,
    life:{regions:{island:new THREE.Vector4(),wave:new THREE.Vector4(),waiting:new THREE.Vector4()}}};
  const chapter=new MeadowChapter(cast);
  child.stop();child.place(startX,-842,Math.PI);cygnet.rideIn('satchel');plane.hold(child);
  chapter.leg=3;chapter.piano.restoreDone();chapter.reveal();
  chapter.frame();rig.cut(chapter.shot);
  const ray=new THREE.Vector3(),points=[new THREE.Vector3(),new THREE.Vector3()];
  let returned=false,worstEdge=0,worstCover=-Infinity,checked=0,flockChecked=0,airborne=false;
  const phases=new Set();
  for(let frame=0;frame<fps*110;frame++) {
    const time=frame/fps,dt=1/fps;
    chapter.update(dt,time);child.update(dt);carry.update(dt);flock.update(dt,time);
    cygnet.update(dt,time,child.position,air);carry.after();
    rig.update(dt,time,chapter.shot,chapter.pace);
    const flat=chapter.trodden;
    if(flat)atmo.uniforms.uTrodden.value.set(flat.x,flat.z,flat.y,1);
    else atmo.uniforms.uTrodden.value.w=0;
    if(chapter.beat==='gather')returned=true;
    if(returned&&chapter.beat==='walk')break;
    if(frame%Math.round(fps/10)!==0||time<4)continue;
    if(chapter.beat==='down'&&chapter.leftAt>=0&&time-chapter.leftAt<tuning.crest.setsDown) {
      for(const bird of flock.birds) {
        const p=bird.at.clone().add(new THREE.Vector3(0,.6,0)),screen=p.clone().project(rig.camera);
        assert(Math.max(Math.abs(screen.x),Math.abs(screen.y))<.9&&screen.z<1,
          `${width}x${height}: departing swan left frame at ${(time-chapter.leftAt).toFixed(1)}s: ${screen.toArray()}`);
        for(let j=1;j<32;j++) {
          ray.copy(rig.camera.position).lerp(p,j/32);
          assert(heightAt(ray.x,ray.z)+grassHeightAt(ray.x,ray.z)*1.3-ray.y<.25,
            `${width}x${height}: bank hides departing swan at ${time.toFixed(2)}, lift ${(time-chapter.leftAt).toFixed(2)}, ray ${ray.toArray()}, camera ${rig.camera.position.toArray()}`);
        }
        phases.add(bird.run===0?'alert':bird.run<flock.runFor?'run':'flight');
        flockChecked++;
      }
      if(flock.birds.every(b=>b.run>flock.runFor))airborne=true;
    }
    const close=chapter.beat==='pond'||chapter.beat==='gather'||chapter.beat==='down';
    if(!close)continue;
    points[0].copy(child.position).y+=child.kneeling>.5?.85:1.2;
    points[1].copy(cygnet.position).y+=.45;
    for(const p of points) {
      const screen=p.clone().project(rig.camera),edge=Math.max(Math.abs(screen.x),Math.abs(screen.y));
      worstEdge=Math.max(worstEdge,edge);
      assert(edge<.9&&screen.z<1,`${width}x${height} ${chapter.beat}: companion left frame (${edge})`);
      // Check the approach to the torso/head, including the near bank the old target-only test missed.
      for(let j=1;j<32;j++) {
        ray.copy(rig.camera.position).lerp(p,j/32);
        const cover=heightAt(ray.x,ray.z)+grassHeightAt(ray.x,ray.z)*1.3-ray.y;
        worstCover=Math.max(worstCover,cover);
        assert(cover<.25,`${width}x${height} ${chapter.beat} t=${time.toFixed(1)}, gap=${child.position.distanceTo(chapter.edge).toFixed(1)}: bank hides companion by ${cover.toFixed(2)}`);
      }
      checked++;
    }
  }
  assert(returned&&chapter.beat==='walk','pond did not finish');
  assert(checked>100,'missed pond camera coverage');
  assert(flockChecked>100,'missed flock departure');
  assert(airborne&&phases.size===3,'camera did not cover alert, run and whole family airborne');
  console.log(`${fps}fps ${width}x${height}, x=${startX}: ${flockChecked} swan and ${checked} companion sight lines, edge ${worstEdge.toFixed(2)}, cover ${worstCover.toFixed(2)}; returned and resumed.`);
}
