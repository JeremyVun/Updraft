import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drownedCast } from './lib/storm-cast.mjs';
const { Cat } = await import('../src/creatures/cat.ts');
const { StrandedCat } = await import('../src/story/drowned-cat.ts');
const { MillCrossing } = await import('../src/world/crossings/mill-crossing.ts');
const W = await import('../src/world/drowned-way.ts');
const { buildHouse, LIME, SLATE, SLATED } = await import('../src/world/drowned-houses.ts');
const { hullGeometry, KIND } = await import('../src/traveller/boat/parts.ts');
const { tuning } = await import('../src/tuning.ts');
if(process.env.NEGATIVE) Cat.prototype.clearSurface=function(){};
const wind = { breeze: new THREE.Vector2(2,-1), calm: 3, addSplat() {}, sample(x,z,out) {return Object.assign(out,{x:2,z:-1,energy:0,lift:0});} };
const v = new THREE.Vector3(), b = new THREE.Vector3();

function surface(parts) {
  const triangles=[];
  for(const g of parts) {
    const p=g.attributes.position, idx=g.index;
    for(let i=0;i<(idx?.count??p.count);i+=3) {
      const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j));
      const det=(b.x-a.x)*(c.z-a.z)-(c.x-a.x)*(b.z-a.z);
      if(Math.abs(det)>1e-9) triangles.push({a,b,c,det});
    }
  }
  return (x,z)=>{
    let top=-Infinity;
    for(const {a,b,c,det} of triangles) {
      const u=((x-a.x)*(c.z-a.z)-(z-a.z)*(c.x-a.x))/det;
      const w=((b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x))/det;
      if(u>=-1e-5&&w>=-1e-5&&u+w<=1.00001) top=Math.max(top,a.y+u*(b.y-a.y)+w*(c.y-a.y));
    }
    return top;
  };
}
function roof(h) {
  const parts=[], frame=new THREE.Matrix4().makeRotationY(h.yaw).setPosition(h.x,-h.sink,h.z);
  buildHouse({add(g,colour,kind,m){if(kind===SLATED) parts.push(g.clone().applyMatrix4(m));}},'cottage',
    {...h,exact:true,lime:LIME[0],roof:SLATE[0],stacks:[]},()=>.5,frame);
  return surface(parts);
}
const bowGeo=hullGeometry(), p=bowGeo.attributes.position, grain=bowGeo.attributes.aGrain, bow=[];
for(let i=0;i<p.count;i+=3) if([0,1,2].every(j=>grain.getX(i+j)===KIND.boards&&p.getZ(i+j)>1.7&&p.getY(i+j)>.5)) {
  for(let j=0;j<3;j++) bow.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));
}
const deck=surface([new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(bow,3))]);
function measure(cat,floor,inverse=new THREE.Matrix4()) {
  const {position:p,aSkin:s}=cat.mesh.geometry.attributes;
  let body=Infinity, foot=Infinity;
  for(let i=0;i<p.count;i++) {
    const bone=s.getX(i), paw=[16,20,23,27].indexOf(bone);
    if(bone>3&&paw<0) continue;
    v.fromBufferAttribute(p,i); b.copy(v).applyMatrix4(cat.rig.bones[s.getY(i)]);
    v.applyMatrix4(cat.rig.bones[bone]).lerp(b,s.getZ(i)).applyMatrix4(inverse);
    const gap=v.y-floor(v.x,v.z);
    if(bone<=3) body=Math.min(body,gap); else foot=Math.min(foot,gap);
  }
  return {body,foot};
}
for(const fps of [30,60,120]) {
  const cast=drownedCast(wind), {cat,boat,village}=cast;
  cast.carry={stow(){}};
  boat.beach(W.CAT_HOLD.x,W.CAT_HOLD.y,W.CAT_HOLD_YAW);boat.launch();boat.speed=0;
  const rescue=new StrandedCat(cast,()=>{});rescue.begin();rescue.to('waiting');
  let t=0;
  const tick=()=>{t+=1/fps;rescue.update(1/fps,t);cat.update(1/fps);};
  const idle=(step)=>{
    const before=village.tub.position.clone();
    for(let i=0;i<fps*180;i++) tick();
    assert.equal(rescue.step,step,'idle never completes either tub trip');
    assert(Math.hypot(village.tub.position.x-before.x,village.tub.position.z-before.z)<.001,'untended tub stays put');
    assert(village.tub.destination.visible,'the current destination is shown');
  };
  idle('waiting');
  assert(cat.position.y>.6,'waiting cat is safely up the slope');
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,100);
  camera.position.set(W.CAT_HOLD.x,14,W.CAT_HOLD.y+10);camera.lookAt(village.tub.position);camera.updateMatrixWorld(true);
  const push=()=>{
    const tub=village.tub, toward=rescue.goal.clone().sub(tub.position).setY(0).normalize();
    const centre=tub.position.clone();
    for(let i=0;i<fps*.2;i++) {
      const a=centre.clone().addScaledVector(toward,-.5+i/fps*6).project(camera);
      const b=centre.clone().addScaledVector(toward,-.5+(i+1)/fps*6).project(camera);
      tub.brush(camera,{muted:false,present:true,prevNdc:new THREE.Vector2(a.x,a.y),ndc:new THREE.Vector2(b.x,b.y)},1/fps);tick();
    }
    for(let i=0;i<fps;i++) tick();
  };
  for(let i=0;i<20&&rescue.step==='waiting';i++) push();
  for(let i=0;i<fps*10&&rescue.step==='coming';i++) tick();
  assert.equal(rescue.step,'ferried','player strokes rescue the cat');idle('ferried');
  for(let i=0;i<24&&rescue.step==='ferried';i++) push();
  assert(['boarding','aboard'].includes(rescue.step),'player strokes return the tub');
  rescue.aboard();
  for(let i=0;i<fps*3;i++) cat.update(1/fps);
  const aboard=measure(cat,deck,boat.group.matrixWorld.clone().invert());
  assert(aboard.body>-.008&&aboard.foot>-.012&&aboard.foot<.025,`bow contact ${JSON.stringify(aboard)}`);
  const d=W.WAY.strand, floor=roof(W.STRAND_HOUSE);
  let low=Infinity, sole=Infinity;
  for(const fear of [0,.7,1.2]) {
    cat.unease=fear;cat.place(new THREE.Vector3(d.x1,d.height,d.z1),Math.atan2(d.x0-d.x1,d.z0-d.z1),{pose:'sit',floor:W.strandRoof});
    for(let i=0;i<fps*4;i++) {cat.update(1/fps);if(i%Math.max(1,fps/10))continue;const m=measure(cat,floor);low=Math.min(low,m.body);sole=Math.min(sole,m.foot);}
  }
  assert(low>-.008&&sole>-.025,`rendered ridge contact ${low}, feet ${sole}`);
  rescue.aboard();rescue.to('bolting');
  for(let i=0;i<fps*14;i++) {
    tick();
    if(cat.frame||cat.flying||i%Math.max(1,fps/10))continue;
    const m=measure(cat,floor);low=Math.min(low,m.body);sole=Math.min(sole,m.foot);
  }
  assert(low>-.012&&sole>-.015,`boat-to-roof landing/run/sit ${low}, feet ${sole}`);
  console.log(`${fps} Hz: both 180 s idle waits stay still; both trips accept strokes; bow body/foot ${aboard.body.toFixed(3)}/${aboard.foot.toFixed(3)} m; roof ${low.toFixed(3)}/${sole.toFixed(3)} m`);
}
const c=new Cat();c.visible=true;c.place(new THREE.Vector3(),0);c.mewing=false;
const calls=[];
for(let i=0;i<60*120;i++) {if(i%270===0)c.mew(1);c.update(1/60);if(c.heard.some(x=>x.kind==='mew'))calls.push(i/60);c.heard.length=0;}
assert(calls.length<=10&&calls.every((x,i)=>!i||x-calls[i-1]>=11.99),'recurring and scripted calls share a cooldown');
const cast=drownedCast(wind), mill=cast.village.mill;
const crossing=new MillCrossing(mill,{},cast), steps=crossing.catWay();
for(const step of steps.slice(0,3)) {
  c.place(step.leap??step.hop,step.yaw,{frame:step.frame,upright:step.upright,pose:'crouch'});
  for(let i=0;i<180;i++) {
    mill.angle=THREE.MathUtils.lerp(tuning.crossings.mill.rest,tuning.crossings.mill.catLeap,i/180);mill.pose();c.update(1/60);
    const m=measure(c,()=>0,mill.perch.matrixWorld.clone().invert());
    assert(m.body>-.012&&m.foot>-.018&&m.foot<.03,`rotating stock contact ${JSON.stringify(m)}`);
  }
}
c.mewing=true;const stranded=[];
for(let i=0;i<60*120;i++) {if(i%270===0)c.mew(1);c.update(1/60);if(c.heard.some(x=>x.kind==='mew'))stranded.push(i/60);c.heard.length=0;}
assert(stranded.length>calls.length&&stranded.every((x,i)=>!i||x-stranded[i-1]>=6.99),'stranded calls are more frequent but separated');
console.log(`rescued ${calls.length}, stranded ${stranded.length} calls/120 s; all three mill landings stay on their rotating stock`);
