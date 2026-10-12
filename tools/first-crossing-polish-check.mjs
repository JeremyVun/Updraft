// Follow the first crossing from departure through whale, linen procession and landfall.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
import {withoutHotReload} from './lib/vite-client-stub.mjs';
const out=process.env.OUT??fs.mkdtempSync('/tmp/updraft-first-crossing-');fs.mkdirSync(out,{recursive:true});
const {browser,close}=await openBrowser();
try {
 const page=await browser.newPage({viewport:{width:Number(process.env.W??1440),height:Number(process.env.H??900)}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await withoutHotReload(page);
 await page.goto(`${process.env.BASE??'http://127.0.0.1:5243/'}?shot&chapter=toLines&progress=0&ratio=1`);
 await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
 await page.evaluate(()=>{
  window.__procession=[];const g=__game,echo=g.crossingLinen,update=echo.update.bind(echo);
  echo.update=(...args)=>{update(...args);
   const t=g.story.current.time;if(g.story.name!=='toLines'||t<65)return;
   const camera=g.rig.camera;
   const linen=echo.linen.map(l=>l.mesh.visible&&Array.from({length:l.cloth.count},(_,i)=>{
    const p=g.boat.position.clone().fromArray(l.cloth.view,i*3).project(camera);return Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1&&p.z>-1;
   }).some(Boolean));
   window.__procession.push({t,linen});
  };
 });
 for(const t of [42,47,50,54,59,68,74,80,86,92,98,104,110]) {
  await page.waitForFunction(t=>__game.story.current.time>=t,t,{timeout:90000});
  await page.screenshot({path:`${out}/${t}.png`});console.log(`captured ${t}`);
 }
 await page.waitForFunction(()=>__game.story.name==='lines',null,{timeout:60000});
 await page.screenshot({path:`${out}/landfall.png`});
 const rows=await page.evaluate(()=>window.__procession);fs.writeFileSync(`${out}/report.json`,JSON.stringify({rows,errors}));
 const seen=rows.filter(r=>r.linen.some(Boolean));
 const last=seen.at(-1)?.t,first=seen[0]?.t;
 assert(last-first>25,'a procession rather than one brief group');
 assert(rows.some(r=>r.linen.slice(5).some(Boolean)),'the later loose sheets actually enter the player view');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({out,first,last,visibleFor:last-first}));
 await page.close();
}finally{await close();}
