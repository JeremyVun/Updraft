// Sail both relocated passages end to end in the real renderer, landscape and portrait.
// Usage: BASE=http://127.0.0.1:5230/ node tools/boats-offshore-browser-check.mjs /tmp/updraft-boats-offshore
// BASE must be a Vite dev server (a fixed source snapshot avoids concurrent-edit reloads).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-boats-offshore';
const {browser,close}=await openBrowser();
const results=[];
try {
 for(const [width,height] of [[1280,720],[390,844]]) for(const name of ['toBoats','toMeadow']) {
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
  await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot=1&chapter=boats&ratio=1&progress=0`);
  await page.waitForFunction(()=>window.__ready,null,{timeout:90000});
  await page.evaluate(async name=>{
   const {BOATS_BERTH}=await import('/src/world/little-boats-layout.ts');
   const {LINES_BERTH}=await import('/src/world/lines-passage.ts');
   const {journeyReveal,visibleRooms}=await import('/src/world/journey-rooms.ts');
   const {worldHeight}=await import('/src/world/heightfield.ts');
   const {atmo}=await import('/src/world/atmosphere.ts');
   const g=__game,from=name==='toBoats'?'lines':'boats',berth=name==='toBoats'?LINES_BERTH:BOATS_BERTH;
   if(from==='lines')g.doorway.reset(true);
   g.story.sail(berth.x,berth.z,name==='toBoats'?.1:Math.PI);
   journeyReveal.ages.clear();journeyReveal.initialized=false;journeyReveal.update(visibleRooms(from,berth.z),0);
   g.story.begin(name);g.story.update(0,__stats.time);g.rig.cut(g.story.shot);
   const c=g.story.current;
   window.passage={name,frames:0,seconds:0,done:false,maxHeight:-100,peakSpeed:0,maxFogStep:0,lastFog:0,positions:[],view:[]};
   const frame=()=>{
    if(g.story.current!==c){passage.done=true;passage.arrived=g.story.name;return;}
    passage.frames++;passage.seconds=c.time;passage.peakSpeed=Math.max(passage.peakSpeed,g.boat.speed);
    if(c.leg<c.route.length-1&&Math.hypot(g.boat.position.x-berth.x,g.boat.position.z-berth.z)>35)
     passage.maxHeight=Math.max(passage.maxHeight,worldHeight(g.boat.position.x,g.boat.position.z));
    const fog=atmo.uniforms.uJourneyVeilAmounts.value.x;
    passage.maxFogStep=Math.max(passage.maxFogStep,Math.abs(fog-passage.lastFog));passage.lastFog=fog;
    if(passage.frames%60===0)passage.positions.push([c.time,...g.boat.position.toArray()]);
    if(passage.frames%30===0) {
     const p=g.child.position.clone();p.y+=1.2;p.project(g.rig.camera);passage.view.push([p.x,p.y,p.z]);
    }
    requestAnimationFrame(frame);
   };requestAnimationFrame(frame);
  },name);
  console.log(`${width} ${name}: sailing`);
  for(const seconds of [2,12,30,50,65,80,100]) {
   await page.waitForFunction(t=>passage.done||passage.seconds>=t,seconds,{timeout:60000});
   await page.screenshot({path:`${prefix}-${width}-${name}-${seconds}.png`});
   if(await page.evaluate(()=>passage.done))break;
  }
  const report=await page.evaluate(()=>passage);
  assert(report.done,`${name}: did not land`);
  assert.equal(report.arrived,name==='toBoats'?'boats':'meadow');
  assert(report.maxHeight<-.3,`${name}: sailed over shallow ground (${report.maxHeight})`);
  assert(report.peakSpeed<=10.0001);assert(report.maxFogStep<.04);
  assert(report.view.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&z<1),'child stays in the frame');
  assert.deepEqual(errors,[]);
  results.push({width,height,...report,errors});
  console.log(JSON.stringify({width,name,seconds:report.seconds,maxHeight:report.maxHeight,maxFogStep:report.maxFogStep,errors}));
  await page.close();
 }
}finally {
 fs.writeFileSync(`${prefix}.json`,JSON.stringify(results,null,2));
 await close();
}
