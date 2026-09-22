// Read-only spacing audit. Dry-land distances use a two-unit grid, not nominal coastline ellipses.
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
registerHooks({
  resolve(s,c,next) { return next(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s+'.ts' : s,c); },
  load(u,c,next) { return u.endsWith('.ts') ? {format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code} : next(u,c); },
});
globalThis.document = {createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
globalThis.location = {search:'?shot'};
globalThis.window = {matchMedia:()=>({matches:false})};
const { ROOMS } = await import('../src/world/journey-rooms.ts');
const { worldHeight } = await import('../src/world/heightfield.ts');
const { ROUTES } = await import('../src/story/journey.ts');
const { BOAT_BERTH } = await import('../src/story/island.ts');
const { LINES_BERTH } = await import('../src/world/lines-passage.ts');
const { BOATS_BERTH } = await import('../src/world/little-boats-layout.ts');
const { FAR_SHORE } = await import('../src/story/meadow.ts');
const { BIRCHES_BERTH } = await import('../src/world/birches.ts');
const { WOOD_BERTH } = await import('../src/world/wood.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { MIRROR_BERTH } = await import('../src/world/sky-mirror-layout.ts');
const { DROWNED_CHANNEL } = await import('../src/world/drowned.ts');
const nearestRoom = (x,z) => Object.entries(ROOMS).reduce((best,[name,c]) => {
  const distance = (Math.hypot((x-c.x)/c.rx,(z-c.z)/c.rz)-1)*Math.min(c.rx,c.rz);
  return distance < best.distance ? {name,distance} : best;
}, {distance:Infinity}).name;
const passages = [
  ['island','lines',BOAT_BERTH,ROUTES.toLines], ['shore','boats',LINES_BERTH,ROUTES.toBoats],
  ['boats','meadow',BOATS_BERTH,ROUTES.toMeadow], ['meadow','birches',FAR_SHORE,ROUTES.toBirches],
  ['birches','drowned',BIRCHES_BERTH,[DROWNED_CHANNEL[0]]],
  ['wood','sleeping',WOOD_BERTH,ROUTES.toSleeping], ['sleeping','mirror',SLEEP_BERTH,ROUTES.toMirror],
  ['mirror','home',MIRROR_BERTH,ROUTES.toHarbour],
];
const result = [];
for(const [from,to,start,route] of passages) {
  const c=ROOMS[to]; let nearest=Infinity, point=null, maxRadius=0, count=0;
  for(let z=c.z-c.rz*1.6;z<=c.z+c.rz*1.6;z+=2) for(let x=c.x-c.rx*1.6;x<=c.x+c.rx*1.6;x+=2) {
    if(nearestRoom(x,z)!==to)continue;
    const y=worldHeight(x,z); if(y<.25)continue;
    count++; maxRadius=Math.max(maxRadius,Math.hypot((x-c.x)/c.rx,(z-c.z)/c.rz));
    const d=Math.hypot(x-start.x,z-start.z);
    if(d<nearest) {nearest=d;point=[x,y,z];}
  }
  const arrival=route.at(-1);let x=start.x,z=start.z,length=0;
  for(const p of route){length+=Math.hypot(p.x-x,p.y-z);x=p.x;z=p.y;}
  const round=n=>Math.round(n*10)/10;
  result.push({from,to,directToArrival:round(Math.hypot(arrival.x-start.x,arrival.y-start.z)),route:round(length),
    nearestDryLand:count?round(nearest):null,nearestPoint:point?.map(round),maxDryLandRadius:round(maxRadius),samples:count});
}
console.log(JSON.stringify({units:'horizontal world units; dry terrain above .25 sampled every 2 units; props excluded; village target is channel entry',passages:result},null,2));
