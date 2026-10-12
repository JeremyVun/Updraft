// Replay the shore's actual departure and arrival; sample the rendered sea-state handoffs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';
const out=process.env.OUT??fs.mkdtempSync('/tmp/updraft-lines-sea-');
fs.mkdirSync(out,{recursive:true});
const {browser,close}=await openBrowser();
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 await withoutHotReload(page);
 await page.goto(`${process.env.BASE??'http://127.0.0.1:5243/'}?shot&chapter=shore&progress=0&ratio=1`);
 await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
 await page.evaluate(async()=>{
  const {atmo}=await import('/src/world/atmosphere.ts');
  const {DOOR_SHORE}=await import('/src/world/heightfield.ts');
  const source=await(await fetch('/src/world/atmosphere.ts')).text();
  const THREE=await import(source.match(/from ["']([^"']*three[^"']*)["']/)[1]);
  const g=__game,u=g.water.mesh.material.uniforms,render=g.renderer.render.bind(g.renderer);
  const target=new THREE.WebGLRenderTarget(640,400),a=new Uint8Array(640*400*4),b=new Uint8Array(a.length);
  window.__seaSamples=[];window.__roomCompare=[];let last=-Infinity;
  g.renderer.render=(scene,camera)=>{
   render(scene,camera);
   if(scene!==g.scene||camera!==g.rig.camera||atmo.uniforms.uMirrorPass.value>0)return;
   if(__stats.time===last)return;last=__stats.time;
   window.__seaSamples.push({t:__stats.time,chapter:g.story.name,beat:g.story.current.beat,
    time:g.story.current.time,sea:u.uSeaState.value,swell:u.uSwell.value,breeze:g.wind.breeze.length(),
    eye:camera.position.toArray(),room:atmo.uniforms.uRoom.value.toArray(),boat:g.boat.position.toArray()});
   if(g.story.name!=='toBoats'||g.story.current.time>2||window.__roomCompare.length>=3)return;
   const room=atmo.uniforms.uRoom.value,saved=room.clone(),old=g.renderer.getRenderTarget();
   try {
    g.renderer.setRenderTarget(target);room.set(DOOR_SHORE.x,DOOR_SHORE.z,48);render(scene,camera);
    g.renderer.readRenderTargetPixels(target,0,0,640,400,a);
    room.set(0,0,0);render(scene,camera);g.renderer.readRenderTargetPixels(target,0,0,640,400,b);
    let changed=0,sum=0,max=0;for(let i=0;i<a.length;i+=4){const d=Math.max(...[0,1,2].map(c=>Math.abs(a[i+c]-b[i+c])));if(d>3)changed++;sum+=d;max=Math.max(max,d);}
    window.__roomCompare.push({t:__stats.time,changed,mean:sum/(640*400),max});
   } finally {room.copy(saved);g.renderer.setRenderTarget(old);}
  };
 });
 await page.waitForFunction(()=>__game.story.current.beat==='haul',null,{timeout:60000});
 await page.screenshot({path:`${out}/shore.png`});
 for(let stroke=0;stroke<40;stroke++) {
  const [x,y,run]=await page.evaluate(()=>{const v=__game.shoreHaul.pinwheel.clone().project(__game.rig.camera);return[(v.x+1)/2,(1-v.y)/2,__game.shoreHaul.run];});
  if(run>=12.99)break;
  const a=Math.max(.02,x-.13),b=Math.min(.98,x+.13);
  await page.mouse.move(-10,-10);await page.mouse.move(a*1440,y*900);
  for(let i=1;i<=45;i++){await page.mouse.move((a+(b-a)*i/45)*1440,y*900);await page.waitForTimeout(600/45);}
 }
 await page.waitForFunction(()=>__game.story.current.beat==='push',null,{timeout:90000});
 await page.mouse.move(-10,-10);
 await page.screenshot({path:`${out}/before-departure.png`});
 await page.waitForFunction(()=>__game.story.name==='toBoats',null,{timeout:60000});
 for(const t of [0,1,3,8,13,18,23,28,33]) {
  await page.waitForFunction(t=>__game.story.current.time>=t,t,{timeout:30000});
  await page.screenshot({path:`${out}/sailing-${String(t).padStart(2,'0')}.png`});
 }
 await page.waitForFunction(()=>__game.story.name==='boats',null,{timeout:60000});
 for(const ms of [0,250,500,1000,2500,5000]){await page.waitForTimeout(ms);await page.screenshot({path:`${out}/arrival-${ms}.png`});}
 const report=await page.evaluate(()=>({samples:window.__seaSamples,rooms:window.__roomCompare}));
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({...report,errors},null,2));
 assert.deepEqual(errors,[]);
 assert.equal(report.rooms.length,3,'compare the actual portal departure');
 assert(report.rooms.every(r=>r.changed===0),'portal handoff must preserve the rendered sea');
 const arrival=report.samples.filter(s=>s.chapter==='boats');assert(arrival.length>60);
 assert(arrival[0].sea>.98,'carry the incoming sea state across arrival');
 assert(arrival.at(-1).sea<.51,'settle to the sheltered sea');
 const step=Math.max(...report.samples.slice(1).map((s,i)=>Math.abs(s.sea-report.samples[i].sea)));
 assert(step<.015,`sea state changes continuously (${step})`);
 console.log(JSON.stringify({out,maxSeaStep:step,roomComparison:report.rooms}));
 await page.close();
} finally {await close();}
