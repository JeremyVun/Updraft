// Real pond sequence and camera: framing plus terrain/grass sight lines, in both viewport shapes. The family's startle,
// runs and lift are seen whole; the camera then lets the V fly out of the frame rather than backing away to hold it.
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
const {Feather}=await import('../src/fx/feather.ts');
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
  const cast={swanFeather:new Feather(wind),child,cygnet,flock,boat,plane,carry,wind,nearby:()=>false,
    life:{at:()=>1,regions:{island:new THREE.Vector4(),wave:new THREE.Vector4(),waiting:new THREE.Vector4()}}};
  const chapter=new MeadowChapter(cast);
  child.stop();child.place(startX,-842,Math.PI);cygnet.rideIn('satchel');plane.hold(child);
  chapter.leg=3;chapter.piano.restoreDone();chapter.reveal();
  chapter.frame();rig.cut(chapter.shot);
  const ray=new THREE.Vector3(),points=[new THREE.Vector3(),new THREE.Vector3()];
  let returned=false,worstEdge=0,worstCover=-Infinity,checked=0,flockChecked=0,airborne=false,gone=false,widest=0;
  const phases=new Set(),ran=new Set(),lifted=new Set();
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
    if(chapter.beat==='crest'&&chapter.t>4||chapter.beat==='down')
      widest=Math.max(widest,Math.hypot(rig.camera.position.x-child.position.x,rig.camera.position.z-child.position.z));
    if((chapter.beat==='down'||chapter.beat==='pond')&&flock.active&&chapter.leftAt>=0) {
      // Gone: out of the frame, or so far off that the crest's veil (main.ts: 900 - 780 x haze) is taking them.
      if(flock.birds.every(b=>{const s=b.at.clone().project(rig.camera);
        return Math.max(Math.abs(s.x),Math.abs(s.y))>1||b.at.distanceTo(rig.camera.position)>900-780*tuning.crest.haze;}))gone=true;
    }
    if(chapter.beat==='down'&&chapter.leftAt>=0) {
      // The raft is held in frame from the startle; every bird is seen running and lifting, then they may leave it.
      for(const bird of flock.birds.filter(b=>b.run<flock.runFor+.5)) {
        const p=bird.at.clone().add(new THREE.Vector3(0,.6,0)),screen=p.clone().project(rig.camera);
        const edge=Math.max(Math.abs(screen.x),Math.abs(screen.y)),inFrame=edge<1&&screen.z<1;
        assert(edge<.9&&screen.z<1||bird.run>0,
          `${width}x${height}: waiting swan out of frame at ${(time-chapter.leftAt).toFixed(1)}s: ${screen.toArray()}`);
        if(!inFrame)continue;
        for(let j=1;j<32;j++) {
          ray.copy(rig.camera.position).lerp(p,j/32);
          assert(heightAt(ray.x,ray.z)+grassHeightAt(ray.x,ray.z)*1.3-ray.y<.25,
            `${width}x${height}: bank hides departing swan at ${time.toFixed(2)}, lift ${(time-chapter.leftAt).toFixed(2)}, ray ${ray.toArray()}, camera ${rig.camera.position.toArray()}`);
        }
        phases.add(bird.run===0?'alert':bird.run<flock.runFor?'run':'flight');
        if(bird.run>0&&bird.run<flock.runFor)ran.add(bird);
        if(bird.run>=flock.runFor)lifted.add(bird);
        flockChecked++;
      }
      if(lifted.size===flock.birds.length&&ran.size===flock.birds.length)airborne=true;
    }
    const close=chapter.beat==='pond'||chapter.beat==='gather'||chapter.beat==='down';
    if(!close)continue;
    points[0].copy(child.position).y+=child.kneeling>.5?.85:1.2;
    points[1].copy(cygnet.position).y+=.45;
    for(const p of points) {
      const screen=p.clone().project(rig.camera),edge=Math.max(Math.abs(screen.x),Math.abs(screen.y));
      worstEdge=Math.max(worstEdge,edge);
      assert(edge<.9&&screen.z<1,`${width}x${height} ${chapter.beat}: companion left frame (${edge})`);
      // Check the approach to the torso/head, including the near bank the old target-only test missed. The last metre
      // and a half is the meadow she is wading through: its modelled blades (1.3 x up to 1.4 m) stand taller than she
      // does, which would call her hidden from any follow lower than a crane shot, so only ground counts there.
      const reach=rig.camera.position.distanceTo(p);
      for(let j=1;j<32;j++) {
        ray.copy(rig.camera.position).lerp(p,j/32);
        const cover=heightAt(ray.x,ray.z)+((1-j/32)*reach>1.5?grassHeightAt(ray.x,ray.z)*1.3:0)-ray.y;
        worstCover=Math.max(worstCover,cover);
        assert(cover<.25,`${width}x${height} ${chapter.beat} t=${time.toFixed(1)}, gap=${child.position.distanceTo(chapter.edge).toFixed(1)}: bank hides companion by ${cover.toFixed(2)}`);
      }
      checked++;
    }
  }
  assert(returned&&chapter.beat==='walk','pond did not finish');
  assert(checked>100,'missed pond camera coverage');
  assert(flockChecked>100,'missed flock departure');
  assert(airborne&&phases.size===3,`camera did not see every bird run and lift (${ran.size} ran, ${lifted.size} lifted)`);
  assert(gone,'the V never left the frame or went into the veil: the camera held the flock');
  assert(widest<tuning.crest.viewBack*1.2,`the camera backed away from her to ${widest.toFixed(1)} for the departure`);
  console.log(`${fps}fps ${width}x${height}, x=${startX}: ${lifted.size}/${flock.birds.length} seen lifting, ${flockChecked} swan and ${checked} companion sight lines, edge ${worstEdge.toFixed(2)}, cover ${worstCover.toFixed(2)}; returned and resumed.`);
}
