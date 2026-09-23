// CPU audit of hull/terrain clearance at every berth, launch and crossing landing.
// AUDIT=1 prints failures without stopping, to measure a baseline.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { Boat } = await import('../src/traveller/boat.ts');
const { CrossingChapter } = await import('../src/story/crossing.ts');
const { DrownedChapter } = await import('../src/story/drowned.ts');
const { BOATS_BERTH } = await import('../src/world/little-boats-layout.ts');
const { ROUTES } = await import('../src/story/journey.ts');
const { BOAT_BERTH } = await import('../src/story/island.ts');
const { LINES_BERTH } = await import('../src/story/lines.ts');
const { FAR_SHORE } = await import('../src/story/meadow.ts');
const { BIRCHES_BERTH } = await import('../src/world/birches.ts');
const { WOOD_BERTH } = await import('../src/world/wood.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { HOME_MOORING } = await import('../src/story/home.ts');
const { heightAt } = await import('../src/world/island.ts');
const { tuning } = await import('../src/tuning.ts');
const { DOOR_EXIT } = await import('../src/world/doorway.ts');
function fixture(gust = 0) {
  const wind = { breeze: new THREE.Vector2(2.47, -0.80), calm: 3,
    sample(_x, _z, out) { return Object.assign(out, { x: this.breeze.x + gust, z: this.breeze.y - gust, energy: gust ? 0.8 : 0, lift: 0 }); } };
  const boat = new Boat(wind);
  const child = { position: new THREE.Vector3(), ride(p) { this.position.copy(p); },
    handPosition(out) { return out.copy(this.position).add(new THREE.Vector3(0, 1, 0)); }, reach() {}, wave() {} };
  const plane = { held: true, position: new THREE.Vector3(), hold() {}, launch(p) { this.position.copy(p); this.held = false; }, depart() {} };
  return { wind, boat, child, plane, cygnet: { carried: true, mind: { perform() {}, startle() {} }, eye: out => out.copy(child.position) },
    sealife: { fishNear() {}, dolphinsWith() {}, whale: null, dolphinShow: null } };
}
// Read the rendered mesh, including triangle centres, independently of collision support points.
const geo = fixture().boat.group.children[0].geometry.attributes.position;
const samples = [], seen = new Set();
function sample(x, y, z) {
  if (y > 0.3) return;
  const key = [x,y,z].map(v => v.toFixed(4)).join(',');
  if (!seen.has(key)) { samples.push(new THREE.Vector3(x,y,z)); seen.add(key); }
}
for (let i=0; i<geo.count; i++) sample(geo.getX(i),geo.getY(i),geo.getZ(i));
for (let i=0; i<geo.count; i+=3) sample(
  (geo.getX(i)+geo.getX(i+1)+geo.getX(i+2))/3,
  (geo.getY(i)+geo.getY(i+1)+geo.getY(i+2))/3,
  (geo.getZ(i)+geo.getZ(i+1)+geo.getZ(i+2))/3);
const p = new THREE.Vector3();
function clearance(boat) {
  let gap = Infinity;
  for (const s of samples) {
    p.copy(s).applyMatrix4(boat.group.matrixWorld);
    gap = Math.min(gap, p.y-heightAt(p.x,p.z));
  }
  return gap;
}
const report = [], failures = [];
function record(name, gap, extra = {}) {
  report.push({ name, clearance: +gap.toFixed(4), ...extra });
  if (gap < -0.015) failures.push(`${name}: hull buried ${(-gap).toFixed(3)} units`);
}
const berths = [ ['opening',BOAT_BERTH,0.95], ['lines',LINES_BERTH,0.1], ['meadow',FAR_SHORE,0.2],
  ['birches',BIRCHES_BERTH,0.15], ['wood',WOOD_BERTH,0.2], ['sleeping',SLEEP_BERTH,-1.76], ['home',HOME_MOORING,HOME_MOORING.yaw] ];
for (const [name, at, yaw] of berths) {
  const { boat:b } = fixture(8); b.beach(at.x,at.z,yaw);
  let worst=clearance(b);
  for(let i=0;i<120;i++){b.update(1/60,i/60);worst=Math.min(worst,clearance(b));}
  record(`${name} berth`,worst,{position:b.position.toArray()});
  if(name==='lines') {
    const beside=b.boardingPoint(new THREE.Vector3());
    assert(heightAt(beside.x,beside.z)>0,'secret shore boarding point must be on dry sand');
    // The child steps onto the shore at DOOR_EXIT (src/world/doorway.ts) after crossDoor() in
    // src/story/lines.ts, then walks to the boat's boardingPoint() for board().
    for(let step=0;step<=20;step++) {
      const x=THREE.MathUtils.lerp(DOOR_EXIT.x,beside.x,step/20);
      const z=THREE.MathUtils.lerp(DOOR_EXIT.z,beside.z,step/20);
      assert(heightAt(x,z)>0,'secret shore approach must not walk through water');
    }
  }
  if(name==='home')continue;
  b.canGround=false;b.launch();
  b.steerFor=new THREE.Vector2(b.position.x+b.pushDir.x*40,b.position.z+b.pushDir.y*40);worst=Infinity;
  for(let i=0;i<900;i++){b.update(1/60,i/60);if(i%10===0)worst=Math.min(worst,clearance(b));}
  record(`${name} launch`,worst);
}
const starts = { toLines:[16.5,29.5,0.95],toBoats:[LINES_BERTH.x,LINES_BERTH.z,0.1],toMeadow:[BOATS_BERTH.x,BOATS_BERTH.z,Math.PI],
  toBirches:[FAR_SHORE.x,FAR_SHORE.z,0.2],toWood:[-14,-1614,Math.PI],
  toSleeping:[WOOD_BERTH.x,WOOD_BERTH.z,0.2],toHome:[SLEEP_BERTH.x-5,SLEEP_BERTH.z-2,-1.76] };
for(const [name,start] of Object.entries(starts)) for(const gust of [0,8]) {
  const cast=fixture(gust),b=cast.boat;b.beach(...start);b.launch();
  const c=new CrossingChapter(cast,{route:ROUTES[name],arrivalSpeed:name==='toMeadow'?tuning.sail.meadowArrivalSpeed:undefined,...(name==='toHome'?{moor:HOME_MOORING}:{})});
  let worst=Infinity,reached=false;
  for(let i=0;i<600*60;i++) {
    c.update(1/60);b.update(1/60,i/60);
    if(i%20===0 && heightAt(b.position.x,b.position.z)>-4)worst=Math.min(worst,clearance(b));
    if(c.done){reached=true;worst=Math.min(worst,clearance(b));break;}
  }
  assert(reached,`${name} must still arrive`);
  for(let i=0;i<120;i++){b.update(1/60,i/60);worst=Math.min(worst,clearance(b));}
  record(`${name}, gust ${gust}`,worst,{position:b.position.toArray()});
}
for(const gust of [0,8]) {
  const cast=fixture(gust),b=cast.boat;b.beach(BIRCHES_BERTH.x,BIRCHES_BERTH.z-6,Math.PI);b.launch();
  const c=new DrownedChapter(cast);let worst=Infinity,reached=false;
  for(let i=0;i<300*60;i++) {
    cast.wind.breeze.set(2.47,-0.80).multiplyScalar(c.breeze);cast.wind.calm=cast.wind.breeze.length()*tuning.wind.calm;
    c.update(1/60,i/60);b.swell=c.storm;b.update(1/60,i/60);
    if(i%20===0 && heightAt(b.position.x,b.position.z)>-4)worst=Math.min(worst,clearance(b));
    if(c.done){reached=true;worst=Math.min(worst,clearance(b));break;}
  }
  assert(reached,'storm must still arrive');record(`storm, gust ${gust}`,worst);
}
console.log(JSON.stringify({samples:samples.length,report,failures},null,2));
if(!process.env.AUDIT)assert.deepEqual(failures,[]);
