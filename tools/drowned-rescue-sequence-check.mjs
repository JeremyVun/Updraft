import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drownedCast } from './lib/storm-cast.mjs';
const { DrownedChapter } = await import('../src/story/drowned.ts');
const { takeCues } = await import('../src/story/cues.ts');
const W = await import('../src/world/drowned-way.ts');
const { MAST_Z } = await import('../src/traveller/boat/form.ts');
const v = new THREE.Vector3(), b = new THREE.Vector3();
function skin(cat, visit) {
  const { position: p, aSkin: s } = cat.mesh.geometry.attributes;
  for (let i = 0; i < p.count; i++) {
    if (s.getX(i) > 27) continue;
    v.fromBufferAttribute(p, i); b.copy(v).applyMatrix4(cat.rig.bones[s.getY(i)]);
    v.applyMatrix4(cat.rig.bones[s.getX(i)]).lerp(b, s.getZ(i)); visit(v);
  }
}
for (const fps of [30, 60, 120]) {
  const wind = { breeze: new THREE.Vector2(2.47,-.8), calm: 3, addSplat() {}, sample(x,z,out) { return Object.assign(out,{x:this.breeze.x,z:this.breeze.y,energy:0,lift:0}); } };
  const cast = drownedCast(wind); cast.carry = { stow() {} };
  const chapter = new DrownedChapter(cast), { cat, boat, child, village } = cast;
  const rescue = chapter.cat, tub = village.tub;
  if (process.env.NEGATIVE === 'approach') {
    const old = W.atHold(2.4, 1.6).lerp(new THREE.Vector2(W.CAT_EDGE.x, W.CAT_EDGE.z), .42);
    tub.place(old.x, old.y, 0);
  }
  const untouched = tub.position.clone();
  let untouchedDrift = 0;
  for (let i = 0; i < fps * 90; i++) {
    const dt = 1 / fps, t = i * dt;
    wind.breeze.set(2.47, -.8).multiplyScalar(chapter.breeze);
    chapter.update(dt, t); boat.update(dt, t); child.update(dt); cat.update(dt);
    untouchedDrift = Math.max(untouchedDrift, Math.hypot(tub.position.x - untouched.x, tub.position.z - untouched.z));
  }
  assert(untouchedDrift < .001, `untouched tub moved during the boat approach: ${untouchedDrift}`);
  assert.equal(rescue.step, 'waiting');
  assert.equal(tub.sinceBrushed, Infinity);
  rescue.begin();
  if(process.env.NEGATIVE==='input')tub.interactive=true;
  const camera = new THREE.PerspectiveCamera(50,16/9,.1,100);
  camera.position.copy(tub.position).add(new THREE.Vector3(0,10,10));camera.lookAt(tub.position);camera.updateMatrixWorld(true);
  const centre = tub.position.clone().project(camera), before = tub.position.clone();
  for(let i=0;i<fps;i++) {
    tub.brush(camera,{muted:false,present:true,prevNdc:new THREE.Vector2(centre.x-.1,centre.y),ndc:new THREE.Vector2(centre.x+.1,centre.y)},1/fps);
    tub.update(1/fps,i/fps);
  }
  assert.equal(tub.sinceBrushed,Infinity,'pre-rescue strokes are ignored');
  assert(Math.hypot(tub.position.x-before.x,tub.position.z-before.z)<.001,'pre-rescue tub stays put');
  boat.beach(W.CAT_HOLD.x,W.CAT_HOLD.y,W.CAT_HOLD_YAW);boat.launch();boat.speed=0;
  chapter.leg=3;chapter.to('drift');rescue.to('boarding');
  tub.place(W.CAT_HOLD.x+2,W.CAT_HOLD.y,0);tub.held=true;
  cat.place(new THREE.Vector3(0,.1,0),0,{frame:tub.group,pose:'sit'});
  let released=null, sailing=null, rescued=null, calm=null, grounded=null, bolt=null, mast=Infinity, moved=0, releaseAt=null, mastAt=null;
  const calmCues = [];
  takeCues();
  for(let i=0;i<fps*70;i++) {
    const dt=1/fps,t=i*dt;
    wind.breeze.set(2.47,-.8).multiplyScalar(chapter.breeze);
    chapter.update(dt,t);boat.update(dt,t);child.update(dt);cat.update(dt);
    if (chapter.sailingFrom >= 0 && sailing === null) sailing=t;
    if(rescue.step==='aboard'&&!rescue.rescuing&&!cat.busy&&rescued===null)rescued=t;
    if(rescue.released&&released===null){released=t;releaseAt=boat.position.clone();}
    if(chapter.beat==='still'&&calm===null){calm=t;moved=boat.position.distanceTo(releaseAt);}
    for(const cue of takeCues())if(cue==='becalmed'||cue.kind==='becalmed')calmCues.push(t);
    if(calm===null) {
      assert.equal(calmCues.length,0,'no becalming tone during rescue or the sailing interval');
      assert(chapter.breeze>.999,'the breeze remains before becalming');
      assert.equal(village.dark.rise,0,'fog waits for becalming');
      if(sailing===null || t-sailing<1.99)assert(!chapter.drownedQuiet,'music continues through recovery and the extra two seconds');
    }
    if(chapter.beat==='becalmed'&&grounded===null)grounded=t;
    if(rescue.step==='bolting'&&bolt===null)bolt=t;
    if(chapter.beat==='still') {
      assert(chapter.drownedQuiet,'windless drift has no music');
      assert(!chapter.silence,'temporary quiet must not mute cue sounds');
    }
    if((rescue.rescuing || rescue.step === 'boarding')&&i%Math.max(1,fps/30)===0) {
      const inverse=boat.group.matrixWorld.clone().invert();
      skin(cat,p=>{p.applyMatrix4(inverse);if(p.y>-.1&&p.y<4.8){const gap=Math.hypot(p.x,p.z-MAST_Z)-.07;if(gap<mast){mast=gap;mastAt={t,at:p.toArray(),doing:cat.doing,air:cat.air};}};});
      assert.equal(child.kneeling,0,'no pickup');
    }
    if(bolt!==null)break;
  }
  assert(sailing>released,'the sail refills before counting the sailing interval');
  assert(calm-sailing>=3.99&&calm-sailing<4.05,`four seconds at sailing speed: ${calm-sailing}`);
  assert(moved>7,`boat visibly sails before becalming: ${moved}`);
  assert(bolt-grounded<1.6,`cat leaves promptly: ${bolt-grounded}`);
  assert(mast>.015,`cat clears mast during shake/hop: ${mast} ${JSON.stringify(mastAt)}`);
  assert(rescued!==null&&released>=rescued,'sailing follows the finished shake and bow hop');
  assert.deepEqual(calmCues,[calm],'becalming tone fires once, with the effect');
  console.log(`${fps} Hz: tone/effect ${(calm-rescued).toFixed(2)} s after the bow hop; sailing ${(calm-sailing).toFixed(2)} s after recovery / ${moved.toFixed(2)} m; grounded pause ${(bolt-grounded).toFixed(2)} s; mast clearance ${mast.toFixed(3)} m`);

  const { hullGeometry, KIND } = await import('../src/traveller/boat/parts.ts');
  const hull = hullGeometry();hull.computeBoundingBox();
  const bowEnd=hull.boundingBox.max.z,inverse=boat.group.matrixWorld.clone().invert();
  const hp=hull.attributes.position,hg=hull.attributes.aGrain;
  let hullTop=-Infinity;
  for(let j=0;j<hp.count;j++)if(hg.getX(j)===KIND.boards)hullTop=Math.max(hullTop,hp.getY(j));
  let hullGap=Infinity;
  for(let i=0;i<fps*5;i++) {
    rescue.update(1/fps,i/fps);cat.update(1/fps);
    if(cat.frame||cat.flying)continue;
    skin(cat,p=>{p.applyMatrix4(inverse);hullGap=Math.min(hullGap,Math.max(p.z-bowEnd,p.y-hullTop-.08));});
  }
  assert(hullGap>.08,`roof landing clears the hull: ${hullGap}`);
  console.log(`roof landing clearance ${hullGap.toFixed(3)} m`);

  chapter.skipToBelfry();
  assert.equal(cat.pose,'sit','restored mother cat is alert');
  chapter.church.catIn();
  for(let i=0;i<fps*12;i++) {chapter.church.update(1/fps);cat.update(1/fps);}
  assert.equal(cat.pose,'sit','mother cat stays alert when reunited');

  const steps=chapter.run.catSteps('tree'), landing=steps[3], path=steps[4];
  cat.place(landing.leap,0,{floor:landing.floor,pose:'stand'});
  cat.run(path.run,path.floor,{pace:'trot',speed:1.8,then:'sit'});
  const barn=W.PLACED[1], c=Math.cos(barn.yaw), s=Math.sin(barn.yaw), stack=barn.stacks[0]*(barn.len/2-.75);
  let gap=Infinity;
  for(let i=0;i<fps*12;i++) {
    cat.update(1/fps);
    if(i%Math.max(1,fps/30))continue;
    skin(cat,p=>{const dx=p.x-barn.x,dz=p.z-barn.z,x=dx*c-dz*s,z=dx*s+dz*c;gap=Math.min(gap,Math.max(Math.abs(x-stack)-.5,Math.abs(z)-.476));});
  }
  assert(gap>.04,`tree route clears chimney including the cat's skin: ${gap}`);
  console.log(`belfry cat alert; tree chimney clearance ${gap.toFixed(3)} m`);
}
