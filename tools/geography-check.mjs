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
const {BOATS_SHIFT,SHORE_SHIFT,HOME_SHIFT,MIRROR_SHIFT,SEA_SHORTENING,GEOGRAPHY_VERSION} = await import('../src/world/geography.ts');
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
 if(name==='toMeadow')assert(length<486.9*.7,'Meadow distance is at least 30% shorter');
 if(name==='toHarbour')assert(length<250,'Home is a short onward passage');
}

for(const [chapter,x,z,destination] of [['toMeadow',240,-483.5,BOATS_BERTH],['toHarbour',-455,-2274,MIRROR_BERTH]]) {
 const p=migrateGeography({version:1,chapter,point:'entry',data:[],child:[x,1,z,0,1],boat:[x,z,0,1,0],bird:[x,1,z,0,0,0,1],life:[]});
 assert.equal(p.boat[0],destination.x);assert.equal(p.boat[1],destination.z);
 if(chapter==='toHarbour')assert(worldHeight(p.boat[0],p.boat[1])<-.3,'legacy mirror departure resumes offshore');
}
console.log('Pre-Little-Boats and northern-mirror-shelf saves resume at safe departure berths.');

// The second relocation only moves the late islands, and never applies the first shift twice.
for (const chapter of ['boats','toMeadow','toSleeping','sleeping','mirror','toHarbour','home']) {
 const late=['mirror','toHarbour','home'].includes(chapter), x=late?-330:233,z=late?-2233:-557;
 const saved={version:1,geography:1,chapter,point:'entry',data:[],child:[x,2,z,0,1],boat:[x,z,0,1,0],bird:[x,2,z,0,0,0,1],life:[[-395,-2220,1,2],[-150,-2500,1,2],[233,-495,1,2]]};
 const p=migrateGeography(saved);
 assert.equal(p.geography,GEOGRAPHY_VERSION);
 assert.equal(p.boat[0],x+(late?SEA_SHORTENING.x:0));assert.equal(p.boat[1],z+(late?SEA_SHORTENING.z:0));
 assert.deepEqual(p.life,[[-345,-2090,1,2],[-100,-2370,1,2],[233,-495,1,2]]);
 const once=JSON.stringify(p);migrateGeography(p);assert.equal(JSON.stringify(p),once);
}
for (const geography of [undefined,1]) {
 const p=migrateGeography({version:1,geography,chapter:'toMirror',point:'swim',data:[3,84],child:[-450,2,-2100,0,1],boat:[-450,-2100,0,1,0],bird:[-450,2,-2100,0,0,0,1],life:[]});
 assert(worldHeight(p.boat[0],p.boat[1])<-.3,'old swim resumes in open water');
 assert.equal(p.data[1],84,'keeps completed swim story time');
}
// Translating both islands must preserve every relative waypoint of the final passage.
const priorHomeRoute=[[-310,-2250],[-265,-2285],[-220,-2304],[-185,-2306],[-150.3,-2306.25]];
ROUTES.toHarbour.forEach((p,i)=>{
 assert(Math.abs(p.x-SEA_SHORTENING.x-priorHomeRoute[i][0])<1e-6);
 assert(Math.abs(p.y-SEA_SHORTENING.z-priorHomeRoute[i][1])<1e-6);
});
console.log('Revision 1 saves, open-sea resumes and unchanged relative home route passed.');

const {readProgress}=await import('../src/story/progress.ts');
for(const geography of [undefined,1,2,3,-1,1.5,'1']) {
 const saved={version:1,geography,chapter:'home',point:'entry',data:[],child:[-150,2,-2500,0,0],boat:[-150,-2306,0,0,1],bird:[-150,2,-2500,0,1,0,1],seat:'cradle',life:[[0,0,0,0],[0,0,0,0],[0,0,0,0]],plane:[1,0]};
 globalThis.localStorage={getItem(){return JSON.stringify(saved);}};
 const p=readProgress();
 if(geography===undefined||geography===1||geography===2)assert.equal(p?.geography,GEOGRAPHY_VERSION,'supported saves reach migration through the reader');
 else assert.equal(p,null,'reject malformed or future geography');
}
console.log('Save reader accepts both supported geography revisions and rejects unknown versions.');
