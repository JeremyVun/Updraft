import assert from 'node:assert/strict';
import './lib/typescript.mjs';
import * as THREE from 'three';
globalThis.location = { search: '' };
const { RotaryWashing, ROTARY_ROUTE } = await import('../src/world/lines-rotary.ts');
const { tuning } = await import('../src/tuning.ts');
const k = tuning.rotaryWashing;
const wind = { calm: 0, air: { x: 0, z: 0, energy: 0, lift: 0 }, splats: [],
  sample(x,z,out) { return Object.assign(out, this.air); },
  addSplat(s) { this.splats.push(s); Object.assign(this.air, { x:s.vx, z:s.vz, energy:s.energy }); } };
for (const fps of [30,60,120]) for (const direction of [-1,1]) {
  const pair = new RotaryWashing(); pair.active = true;
  const sounds = []; pair.onSound = kind => sounds.push(kind);
  const [near,far] = pair.rotors;
  const step = seconds => { for(let i=0;i<fps*seconds;i++)pair.update(1/fps,wind); };
  Object.assign(wind.air,{x:20,z:12,energy:1,lift:3}); step(30);
  assert.equal(far.unhook,0); assert.equal(near.angle,k.startAngle);
  const cam=new THREE.PerspectiveCamera(38,1600/900,.1,1000);
  cam.position.copy(near.top).add(new THREE.Vector3(0,3,25));cam.lookAt(near.top);cam.updateMatrixWorld();
  const input={present:true,muted:false,gust:14,charge:1,updraftAt:far.snagPoint.clone().add(new THREE.Vector3(20,0,0)),
    prevNdc:new THREE.Vector2(-.99,-.99),ndc:new THREE.Vector2(-.9,-.99)};
  for(let i=0;i<fps*8;i++){pair.brush(cam,input,wind);pair.update(1/fps,wind);}
  assert.equal(far.unhook,0,'distant circles cannot free the hem');
  input.updraftAt.copy(far.snagPoint);input.muted=true;
  for(let i=0;i<fps*8;i++){pair.brush(cam,input,wind);pair.update(1/fps,wind);}
  assert.equal(far.unhook,0,'muted gestures ignored');input.muted=false;
  pair.activeRotor=0;
  for(let i=0;i<fps*8;i++){pair.brush(cam,input,wind);pair.update(1/fps,wind);}
  assert.equal(far.unhook,0,'the distant snag cannot solve before entry into green');
  assert.equal(pair.snagTarget,null,'no snag invitation before entry');
  pair.activeRotor=-1;
  input.charge=0;
  function stroke(r) {
    const p=r.clothPoint(1,.5,2,new THREE.Vector3()),a=p.clone().project(cam);
    const tangent=new THREE.Vector3(p.z-r.foot.z,0,r.foot.x-p.x).normalize();
    const b=p.clone().addScaledVector(tangent,direction).project(cam);
    input.prevNdc.set(a.x,a.y);input.ndc.set(b.x,b.y);r.touchedAt.copy(p);r.brush(input,wind);
  }
  for(let i=0;i<fps*.6;i++){stroke(near);pair.update(1/fps,wind);}
  assert(near.preferredDirection*(near.angle-k.startAngle)>.02 && !near.aligned,'stroke turns promptly without completing');
  assert(Math.abs(near.speed)<.6,'the frame gathers momentum instead of reaching full speed immediately');
  const releasedAt=near.angle;step(.5);
  assert(near.preferredDirection*(near.angle-releasedAt)>.01,'the weighted frame coasts after the sweep');step(15);
  const held=near.angle;step(15);assert(Math.abs(near.angle-held)<.001,'partial turn stays put');
  for(let i=0;i<fps*45&&!near.open;i++){stroke(near);pair.update(1/fps,wind);}
  assert(near.open && !pair.open,'one aligned rotor cannot open passage');
  for(let i=0;i<fps*8;i++){stroke(far);pair.update(1/fps,wind);}
  assert(Math.abs(far.angle-k.startAngle)<=k.snagTurn+1e-8 && !far.aligned,'tether stops the fixed turn until release');
  const snag=far.snagPoint.clone().project(cam);
  input.prevNdc.set(snag.x-.01,snag.y);input.ndc.set(snag.x+.01,snag.y);
  Object.assign(wind.air,{lift:0});input.charge=0;
  for(let i=0;i<fps*2;i++){pair.brush(cam,input,wind);pair.update(1/fps,wind);}
  assert.equal(far.unhook,1,'sustained local sweeps free the hem without any updraft');
  for(let i=0;i<fps*45&&!pair.open;i++){stroke(far);pair.update(1/fps,wind);}
  assert(pair.open,'both independently align');step(15);
  assert(Math.abs(Math.sin(near.angle))<1e-8 && Math.abs(Math.sin(far.angle))<1e-8);
  assert.deepEqual(sounds.sort(),['creak','creak','release','settle','settle'],'each frame creaks once and settles once, with one cloth release');
  sounds.length=0;pair.reset(true);step(5);assert(pair.open,'legacy restore bypasses both');
  assert.equal(sounds.length,0,'restoring the completed rotaries is silent');
  pair.reset();assert(!pair.open && near.angle===k.startAngle && far.unhook===0);
  console.log(`PASS ${fps} Hz, direction ${direction}: weight, local sweep, persistent progress, tether, independent catches, sparse sound, restore`);
}
assert(Math.hypot(k.x-k.farX,k.z-k.farZ)>2*k.radius+2,'swept circles do not meet');
assert(ROTARY_ROUTE[0].x>k.x+2 && ROTARY_ROUTE[2].x<k.farX-2,'route follows the two bare halves');

for (const direction of [-1,1]) {
  const pair=new RotaryWashing();pair.active=true;const r=pair.rotors[0];
  const cam=new THREE.PerspectiveCamera(40,1.6,.1,1000);
  cam.position.set(7,r.top.y+3,-251);cam.lookAt(14.5,r.top.y-2.7,-282.5);cam.updateMatrixWorld();
  const p=r.clothPoint(1,.24,2.5,new THREE.Vector3());
  const tangent=new THREE.Vector3(p.z-r.foot.z,0,r.foot.x-p.x).normalize();
  const a=p.clone().addScaledVector(tangent,-2.6*direction).project(cam);
  const b=p.clone().addScaledVector(tangent,2.6*direction).project(cam);
  const input={present:true,muted:false,gust:2,charge:0,prevNdc:new THREE.Vector2(a.x,a.y),ndc:new THREE.Vector2(a.x,a.y)};
  let contacts=0;
  Object.assign(wind.air,{x:0,z:0,energy:0,lift:0});
  for(let i=1;i<=90;i++){
    input.prevNdc.copy(input.ndc);input.ndc.set(a.x+(b.x-a.x)*i/90,a.y+(b.y-a.y)*i/90);
    pair.brush(cam,input,wind);
    if(r.brushAge===0)contacts++;
    const before=r.angle;
    pair.update(1/60,wind);
    assert((r.angle-before)*r.preferredDirection>=0,'either stroke direction must advance the same turn');
  }
  assert(contacts>15,'test contacts the moving visible sheets');
  assert(Math.abs(r.angle-k.startAngle)>.25,'a slow sweep visibly turns the frame');
}
console.log('PASS: real screen hit selection turns only one way under either sweep direction');

{
  const pair=new RotaryWashing(), far=pair.rotors[1];pair.active=true;pair.activeRotor=0;
  const cam=new THREE.PerspectiveCamera(40,1.6,.1,1000);
  cam.position.copy(far.snagPoint).add(new THREE.Vector3(0,2,20));cam.lookAt(far.snagPoint);cam.updateMatrixWorld();
  const p=far.snagPoint.clone().project(cam);
  const input={present:true,muted:false,gust:2,prevNdc:new THREE.Vector2(p.x-.01,p.y),ndc:new THREE.Vector2(p.x+.01,p.y)};
  for(let i=0;i<120;i++){pair.brush(cam,input,wind);pair.update(1/60,wind);}
  assert.equal(far.unhook,0,'a real sweep directly on the snag still waits for the child to enter green');
  pair.activeRotor=1;input.muted=true;
  for(let i=0;i<120;i++){pair.brush(cam,input,wind);pair.update(1/60,wind);}
  assert.equal(far.unhook,0,'muted local sweeps cannot release the hem');
  input.muted=false;
  for(let i=0;i<12;i++){pair.brush(cam,input,wind);pair.update(1/60,wind);}
  assert(far.unhook>0&&far.unhook<1,'a little local work does not instantly release');
  for(let i=0;i<60;i++)pair.update(1/60,wind);
  const held=far.unhook;
  for(let i=0;i<600;i++)pair.update(1/60,wind);
  assert.equal(far.unhook,held,'partial release work persists without an idle solve');
}

for(const fps of [30,60,120]) {
  const pair=new RotaryWashing();pair.active=true;const r=pair.rotors[0];
  for(let i=0;i<fps;i++) {
    r.strokeWind=14;r.brushAge=0;
    pair.update(1/fps,wind);
  }
  const angle=Math.abs(r.angle-k.startAngle);
  assert(angle>.39&&angle<.48,'lighter response retains gradual acceleration');
  for(const rotor of pair.rotors) {
    rotor.angle=rotor.goal-rotor.preferredDirection*.16;
    rotor.speed=rotor.preferredDirection*.72;rotor.aligned=true;rotor.unhook=1;
  }
  for(let i=0;i<fps*5;i++) {
    const before=pair.rotors.map(r=>r.angle);
    pair.update(1/fps,wind);
    pair.rotors.forEach((r,j)=>assert((r.angle-before[j])*r.preferredDirection>=0,'even an over-speed catch cannot reverse'));
  }
  console.log(`PASS ${fps} Hz: lighter turn ${angle.toFixed(3)} rad, one-way settling`);

  for(const where of ['base','middle','cap','base-updraft']) {
    const pair=new RotaryWashing(),r=pair.rotors[1];pair.active=true;pair.activeRotor=1;
    const cam=new THREE.PerspectiveCamera(40,1.6,.1,1000);
    cam.position.copy(r.snagPoint).add(new THREE.Vector3(0,2,20));cam.lookAt(r.snagPoint);cam.updateMatrixWorld();
    const p=r.snagFoot.clone().lerp(r.snagPoint,where==='cap'?1:where==='middle'?.5:0).project(cam);
    const input={present:true,muted:false,gust:2,charge:0,updraftAt:r.snagFoot.clone(),
      prevNdc:new THREE.Vector2(p.x-.035,p.y-.02),ndc:new THREE.Vector2(p.x+.035,p.y-.02)};
    if(where==='base-updraft') {
      input.prevNdc.set(-.99,-.99);input.ndc.set(-.95,-.99);input.gust=.1;input.charge=.3;
      input.updraftAt.x+=2;
    }
    for(let i=0;i<fps*.5;i++){pair.brush(cam,input,wind);pair.update(1/fps,wind);}
    assert(r.unhook>.2&&r.unhook<.4,`${where}: a brief gesture works the snag without freeing it`);
    assert(r.snagPull>.9,'the cloth answers by pulling taut');
    let recoil=0;
    for(let i=0;i<fps*1.5;i++){pair.update(1/fps,wind);recoil=Math.min(recoil,r.snagPull);}
    assert(recoil<-.05,'the stretched cloth springs back past where it hung');
    assert(Math.abs(r.snagPull)<.04,'tension relaxes when the player stops');
    const held=r.unhook;
    for(let i=0;i<fps*2;i++)pair.update(1/fps,wind);
    assert.equal(r.unhook,held,'pausing keeps progress without an idle release');
    let seconds=0;
    while(!r.ready&&seconds<3){pair.brush(cam,input,wind);pair.update(1/fps,wind);seconds+=1/fps;}
    assert(seconds>.6&&seconds<1.5,`${where}: a second modest effort releases the cloth`);
    assert.equal(r.unhook,1,`${where} must release without precise cap targeting`);
  }
}
console.log('PASS: cap, middle, base sweeps and nearby ground-level updraft release the snag');
