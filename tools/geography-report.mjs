// Read current layout exports and print horizontal distances; never changes game files or saves.
// Usage: node tools/geography-report.mjs > /tmp/updraft-geography.json
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
registerHooks({
  resolve(s, c, next) {
    return next(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s, c);
  },
  load(url, c, next) {
    if (!url.endsWith('.ts')) return next(url, c);
    return { format: 'module', shortCircuit: true,
      source: transformSync(new URL(url).pathname, fs.readFileSync(new URL(url), 'utf8')).code };
  },
});
// Imported scene modules bake a call sprite and inspect query/accessibility settings at construction.
globalThis.document = { createElement: () => ({ getContext: () => ({ beginPath(){}, moveTo(){}, quadraticCurveTo(){}, stroke(){} }) }) };
globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { ISLES, DOOR_SHORE } = await import('../src/world/heightfield.ts');
const { SKY_MIRROR, MIRROR_BERTH } = await import('../src/world/sky-mirror-layout.ts');
const { ROUTES } = await import('../src/story/journey.ts');
const { BOAT_BERTH } = await import('../src/story/island.ts');
const { LINES_BERTH } = await import('../src/world/lines-passage.ts');
const { BOATS_BERTH } = await import('../src/world/little-boats-layout.ts');
const { FAR_SHORE } = await import('../src/story/meadow.ts');
const { BIRCHES_BERTH } = await import('../src/world/birches.ts');
const { DROWNED_CHANNEL } = await import('../src/world/drowned.ts');
const { WOOD_BERTH, WOOD_LANDING } = await import('../src/world/wood.ts');
const { SLEEP_BERTH } = await import('../src/world/sleeping.ts');
const { tuning } = await import('../src/tuning.ts');
const xz = p => [p.x, p.z ?? p.y];
const distance = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const rounded = n => Math.round(n*10)/10;
const centres = [
  // The starting island has no ISLES entry: this is its base coastline ellipse in islandCoast().
  ['Starting island', {x:-6,z:-14}], ['Lines / washing', ISLES.lines],
  ['Door shore', DOOR_SHORE], ['Little boats', ISLES.boats], ['Meadow', ISLES.meadow],
  ['Birches', ISLES.birches], ['Drowned village', ISLES.drowned], ['Wood', ISLES.wood],
  ['Sleeping', ISLES.sleeping], ['Sky mirror', SKY_MIRROR], ['Home / summit', ISLES.home],
];
function route(name, start, targets) {
  const points=[start,...targets].map(xz);
  return {name,from:points[0],to:points.at(-1),direct:rounded(distance(points[0],points.at(-1))),
    polyline:rounded(points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0)),points};
}
const routes = [
  route('Starting island → Lines',BOAT_BERTH,ROUTES.toLines),
  route('Door shore → Little boats',LINES_BERTH,ROUTES.toBoats),
  route('Little boats → Meadow',BOATS_BERTH,ROUTES.toMeadow),
  route('Meadow → Birches',FAR_SHORE,ROUTES.toBirches),
  route('Birches → Village channel entry',BIRCHES_BERTH,[DROWNED_CHANNEL[0]]),
  route('Through village channel',DROWNED_CHANNEL[0],DROWNED_CHANNEL.slice(1)),
  route('Village channel exit → Wood',DROWNED_CHANNEL.at(-1),[WOOD_LANDING]),
  route('Birches → Wood (whole continuous passage)',BIRCHES_BERTH,[...DROWNED_CHANNEL,WOOD_LANDING]),
  route('Wood → Sleeping',WOOD_BERTH,ROUTES.toSleeping),
  route('Sleeping → Sky mirror',SLEEP_BERTH,ROUTES.toMirror),
  route('Sky mirror → Home',MIRROR_BERTH,ROUTES.toHarbour),
];
console.log(JSON.stringify({
  units:'horizontal world units; nominal berth-to-target polylines, not tracked sailing distances',
  centres:centres.map(([name,p])=>({name,at:xz(p)})),
  adjacentCentres:centres.slice(1).map(([name,p],i)=>({from:centres[i][0],to:name,distance:rounded(distance(xz(centres[i][1]),xz(p)))})),
  routes,
  speedSettings:{ordinaryBreeze:1,baseMin:tuning.wind.breeze*tuning.sail.drive,
    baseMax:tuning.wind.breeze*(tuning.sail.drive+tuning.sail.following),ordinaryTopSpeed:tuning.sail.topSpeed,
    meadowArrival:tuning.sail.meadowArrivalSpeed,seaDefaultCap:tuning.seaPassage.speed},
},null,2));
