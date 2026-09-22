// Geography, save migration, mirror blend and dolphin entry/exit regressions without a renderer.
// Usage: node tools/geography-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) specifier += '.ts';
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: transformSync(new URL(url).pathname, fs.readFileSync(new URL(url), 'utf8')).code };
  },
});

globalThis.document = {createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
globalThis.location = {search:'?shot'};
globalThis.window = {matchMedia:()=>({matches:false})};
const {ROOMS,visibleRooms,drawJourneyRooms} = await import('../src/world/journey-rooms.ts');
const {mirrorWater,SKY_MIRROR,MIRROR_LANDING,MIRROR_BERTH} = await import('../src/world/sky-mirror-layout.ts');
const {migrateGeography} = await import('../src/story/geography-progress.ts');
const {BOATS_SHIFT,BOATS_OFFSHORE_SHIFT,BOATS_SHORTENING,SHORE_SHIFT,HOME_SHIFT,MIRROR_SHIFT,SEA_SHORTENING,GEOGRAPHY_VERSION} = await import('../src/world/geography.ts');
const {Dolphins} = await import('../src/fx/sealife/dolphin.ts');
const {tuning} = await import('../src/tuning.ts');
const {worldHeight} = await import('../src/world/heightfield.ts');
assert.deepEqual(visibleRooms('toMeadow',-550),['boats','meadow']);
assert.deepEqual(visibleRooms('toHarbour',-2250),['mirror','home']);
for(const chapter of ['island','toLines','lines','toBoats','boats','toMeadow','meadow','toBirches','birches','drowned','wood','toSleeping','sleeping','toMirror','mirror','toHarbour','home']) {
 const rooms=visibleRooms(chapter,-1440);assert(rooms.length<=2);assert(rooms.every(r=>ROOMS[r]));
}
const prop=new THREE.Group(), hidden=new THREE.Group();hidden.visible=false;
drawJourneyRooms(['boats'],{lines:[prop,hidden]},()=>{assert(!prop.visible);assert(!hidden.visible);});
assert(prop.visible);assert(!hidden.visible);
assert.throws(()=>drawJourneyRooms(['boats'],{lines:[prop]},()=>{throw Error('draw');}));assert(prop.visible);
for(const [chapter,shift] of [['boats',BOATS_SHIFT],['toBoats',SHORE_SHIFT],['toMeadow',BOATS_SHIFT],['mirror',MIRROR_SHIFT],['toHarbour',MIRROR_SHIFT],['home',HOME_SHIFT]]) {
 const saved={version:1,chapter,point:'entry',data:[],child:[10,2,-600,0,1],boat:[10,-600,0,1,0],bird:[10,2,-600,0,0,0,1],life:[[0,0,0,0],[0,0,0,0],[0,0,0,0]]};
 const p=migrateGeography(saved);assert.equal(p.child[0],10+shift.x);assert.equal(p.child[2],-600+shift.z);assert.equal(p.boat[1],p.child[2]);
 const once=JSON.stringify(p);migrateGeography(p);assert.equal(JSON.stringify(p),once);
}
assert(worldHeight(MIRROR_LANDING.x,MIRROR_LANDING.z)<-.3,'arrival hull stays in deep water');
assert(worldHeight(MIRROR_BERTH.x,MIRROR_BERTH.z)<-.3,'departure hull stays in deep water');
assert.equal(mirrorWater(SKY_MIRROR.x,SKY_MIRROR.z),1);
assert.equal(mirrorWater(SKY_MIRROR.x+tuning.skyMirror.waterOuter,SKY_MIRROR.z),0);
let previous=1;for(let r=0;r<=300;r+=.05){const v=mirrorWater(SKY_MIRROR.x+r,SKY_MIRROR.z);assert(v<=previous+1e-12);assert(Math.abs(v-previous)<.002);previous=v;}
let seed=41;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const fps of [30,60,120]) {
 const pod=new Dolphins(),boat=new THREE.Vector3(),first=Array(8).fill(null);let time=0;
 for(let frame=0;frame<fps*45;frame++) {
  time=frame/fps;boat.z+=4.5/fps;pod.run(boat,0,1,true);pod.update(1/fps,time);
  pod.pod.forEach((d,i)=>{if(d.y>-.2&&first[i]===null)first[i]=time;});
 }
 const arrivals=first.filter(t=>t!==null).sort((a,b)=>a-b);
 assert(arrivals.length>=6,'the pod grows into view');assert(arrivals[0]>2,'none materialises at the surface');
 assert(arrivals.at(-1)-arrivals[0]>10,'arrivals are spread over time');
 pod.run(null,0);
 let was=pod.pod.map(d=>d.z), minStep=Infinity;
 for(let frame=0;frame<fps*10;frame++) {
  pod.update(1/fps,time+frame/fps);
  pod.pod.forEach((d,i)=>{minStep=Math.min(minStep,d.z-was[i]);was[i]=d.z;});
 }
 assert(minStep>=-1e-6,'departing dolphins keep swimming forward');assert(!pod.mesh.visible&&!pod.ghost.visible,'pod vanishes below water');
 assert(pod.pod.every(d=>d.y < -5),'all bodies are deep before their meshes retire');
 console.log(JSON.stringify({fps,firstAppearances:first,minDepartureStep:minStep}));
}
console.log('Room exclusions, relocated checkpoints, mirror continuity and gradual dolphin arrival/forward dive passed.');

const {ROUTES}=await import('../src/story/journey.ts');
const {BOATS_BERTH}=await import('../src/world/little-boats-layout.ts');
const {LINES_BERTH}=await import('../src/world/lines-passage.ts');
const {WOOD_BERTH}=await import('../src/world/wood.ts');
const {SLEEP_BERTH}=await import('../src/world/sleeping.ts');
for(const [name,start] of Object.entries({toBoats:LINES_BERTH,toMeadow:BOATS_BERTH,toSleeping:WOOD_BERTH,toMirror:SLEEP_BERTH,toHarbour:MIRROR_BERTH})) {
 let x=start.x,z=start.z,length=0;for(const p of ROUTES[name]){length+=Math.hypot(p.x-x,p.y-z);x=p.x;z=p.y;}
 const distance=Math.hypot(x-start.x,z-start.z);
 console.log(JSON.stringify({passage:name,direct:+distance.toFixed(1),route:+length.toFixed(1)}));
 if(name==='toMeadow')assert(length<400,'the open-water meadow crossing stays within its route budget');
 if(name==='toHarbour')assert(length<250,'Home is a short onward passage');
}

for(const [chapter,x,z,destination] of [['toMeadow',240,-483.5,BOATS_BERTH],['toHarbour',-455,-2274,MIRROR_BERTH]]) {
 const p=migrateGeography({version:1,chapter,point:'entry',data:[],child:[x,1,z,0,1],boat:[x,z,0,1,0],bird:[x,1,z,0,0,0,1],life:[]});
 assert.equal(p.boat[0],destination.x);assert.equal(p.boat[1],destination.z);
 if(chapter==='toHarbour')assert(worldHeight(p.boat[0],p.boat[1])<-.3,'legacy mirror departure resumes offshore');
}
console.log('Pre-Little-Boats and northern-mirror-shelf saves resume at safe departure berths.');

// Revision 1 saves receive every later relocation, each exactly once.
const boatsFromV2={x:BOATS_OFFSHORE_SHIFT.x+BOATS_SHORTENING.x,z:BOATS_OFFSHORE_SHIFT.z+BOATS_SHORTENING.z};
for (const chapter of ['boats','toMeadow','toSleeping','sleeping','mirror','toHarbour','home']) {
 const late=['mirror','toHarbour','home'].includes(chapter), x=late?-330:233,z=late?-2233:-557;
 const saved={version:1,geography:1,chapter,point:'entry',data:[],child:[x,2,z,0,1],boat:[x,z,0,1,0],bird:[x,2,z,0,0,0,1],life:[[-395,-2220,1,2],[-150,-2500,1,2],[233,-495,1,2]]};
 const p=migrateGeography(saved);
 assert.equal(p.geography,GEOGRAPHY_VERSION);
 const move=late?SEA_SHORTENING:['boats','toMeadow'].includes(chapter)?boatsFromV2:{x:0,z:0};
 assert.equal(p.boat[0],x+move.x);assert.equal(p.boat[1],z+move.z);
 assert.deepEqual(p.life,[[-345,-2090,1,2],[-100,-2370,1,2],[233+boatsFromV2.x,-495+boatsFromV2.z,1,2]]);
 const once=JSON.stringify(p);migrateGeography(p);assert.equal(JSON.stringify(p),once);
}
for (const geography of [undefined,1]) {
 const p=migrateGeography({version:1,geography,chapter:'toMirror',point:'swim',data:[3,84],child:[-450,2,-2100,0,1],boat:[-450,-2100,0,1,0],bird:[-450,2,-2100,0,0,0,1],life:[]});
 assert(worldHeight(p.boat[0],p.boat[1])<-.3,'old swim resumes in open water');
 assert.equal(p.data[1],84,'keeps completed swim story time');
}
// The offshore curve changes the passage, while the relocated berth and safe water stay fixed.
const homeEnd=ROUTES.toHarbour.at(-1);
assert(Math.abs(homeEnd.x-SEA_SHORTENING.x-(-150.3))<1e-6);
assert(Math.abs(homeEnd.y-SEA_SHORTENING.z-(-2306.25))<1e-6);
let homeFrom=new THREE.Vector2(MIRROR_BERTH.x,MIRROR_BERTH.z);
for(const point of ROUTES.toHarbour) {
 const span=point.distanceTo(homeFrom);
 for(let d=0;d<=span;d+=1) {
  const p=homeFrom.clone().lerp(point,d/span);
  assert(worldHeight(p.x,p.y)<-.3,'homeward curve stays in navigable water');
 }
 homeFrom=point;
}
console.log('Revision 1 saves, open-sea resumes, home berth and offshore route clearance passed.');

const {readProgress}=await import('../src/story/progress.ts');
for(const geography of [undefined,1,2,3,4,5,-1,1.5,'1']) {
 const saved={version:1,geography,chapter:'home',point:'entry',data:[],child:[-150,2,-2500,0,0],boat:[-150,-2306,0,0,1],bird:[-150,2,-2500,0,1,0,1],seat:'cradle',life:[[0,0,0,0],[0,0,0,0],[0,0,0,0]],plane:[1,0]};
 globalThis.localStorage={getItem(){return JSON.stringify(saved);}};
 const p=readProgress();
 if(geography===undefined||geography===1||geography===2||geography===3||geography===4)assert.equal(p?.geography,GEOGRAPHY_VERSION,'supported saves reach migration through the reader');
 else assert.equal(p,null,'reject malformed or future geography');
}
console.log('Save reader accepts all supported geography revisions and rejects unknown versions.');

// Revisions 2/3 only move Little Boats; late-island positions and swim progress stay intact.
for (const geography of [2,3]) for (const chapter of ['boats','toMeadow','toBoats','lines','meadow','sleeping','toMirror','mirror','toHarbour','home']) {
 const boats=['boats','toMeadow'].includes(chapter), swim=chapter==='toMirror';
 const start=geography===2?{x:233,z:-557}:{x:203,z:-292};
 const shift=geography===2?boatsFromV2:BOATS_SHORTENING;
 const p={version:1,geography,chapter,point:swim?'swim':chapter==='boats'?'pool-2':'entry',data:swim?[3,84]:chapter==='boats'?[79]:[],
  child:[start.x,2,start.z,0,1],boat:[start.x,start.z,0,1,0],bird:[start.x,2,start.z,0,0,0,1],
  life:[[start.x-3,start.z+62,100,1],[-345,-2090,1,2],[-100,-2370,1,2]]};
 const data=structuredClone(p.data);migrateGeography(p);
 for (const [v,z] of [[p.child,2],[p.bird,2],[p.boat,1]]) {
  assert.equal(v[0],start.x+(boats?shift.x:0));
  assert.equal(v[z],start.z+(boats?shift.z:0));
 }
 assert.deepEqual(p.data,data,'keeps completed pools and revision 2 swim data');
 assert.deepEqual(p.life,[[130,-420,100,1],[-345,-2090,1,2],[-100,-2370,1,2]]);
 const once=JSON.stringify(p);migrateGeography(p);assert.equal(JSON.stringify(p),once);
}

// Separation is measured to actual dry terrain, not centres or the length of a detour.
function dryPoints(room) {
 const points=[];for(let z=room.z-room.rz*1.2;z<=room.z+room.rz*1.2;z+=4)
  for(let x=room.x-room.rx*1.2;x<=room.x+room.rx*1.2;x+=4)if(worldHeight(x,z)>.25)points.push([x,z]);
 return points;
}
function coastDistance(x,z,points) { let nearest=Infinity;for(const [px,pz] of points)nearest=Math.min(nearest,Math.hypot(x-px,z-pz));return nearest; }
const meadowDry=dryPoints(ROOMS.meadow), boatsDry=dryPoints(ROOMS.boats);
assert(coastDistance(LINES_BERTH.x,LINES_BERTH.z,boatsDry)>65,'Little Boats has clear water beyond the door shore');
assert(coastDistance(BOATS_BERTH.x,BOATS_BERTH.z,meadowDry)>110,'the meadow is distant when the child boards');
let length=0,px=BOATS_BERTH.x,pz=BOATS_BERTH.z;
for(const p of ROUTES.toMeadow){length+=Math.hypot(p.x-px,p.y-pz);px=p.x;pz=p.y;}
let traveled=0,closest=Infinity;px=BOATS_BERTH.x;pz=BOATS_BERTH.z;
for(const p of ROUTES.toMeadow) {
 const span=Math.hypot(p.x-px,p.y-pz);
 for(let d=0;d<span&&traveled+d<length*2/3;d+=3)closest=Math.min(closest,coastDistance(px+(p.x-px)*d/span,pz+(p.y-pz)*d/span,meadowDry));
 traveled+=span;px=p.x;pz=p.y;
}
assert(closest>35,`the first two thirds of the crossing run alongside the meadow: ${closest}`);
const {boatsCourse}=await import('../src/world/little-boats-layout.ts');
for(let s=135;s<=230;s+=.5) {
 const p={};boatsCourse(s,p);assert(worldHeight(p.x,p.z)<-.5,'departing toy fleet must not cross the door shore');
}
console.log(JSON.stringify({revision:GEOGRAPHY_VERSION,meadowClearanceFirstTwoThirds:closest}));
