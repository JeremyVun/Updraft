// Real-time gameplay frame pacing for the player presets, without shot timing.
// Usage: node tools/quality-preset-profile.mjs [island meadow mirror]
import fs from 'node:fs/promises';
import {openBrowser} from './lib/browser.mjs';
const {browser,close}=await openBrowser();
const results=[];
const variant=process.env.PROFILE_VARIANT??'current';
try {
 for(const chapter of process.argv.slice(2).length?process.argv.slice(2):['island','meadow','mirror'])for(const mode of (process.env.MODES??'medium,low').split(',')){
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(mode=>localStorage.setItem('updraft.quality.v1',mode),mode);
  await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch(), source=await response.text();
   if((source.match(/if \(params.shot\) \{/g)??[]).length!==2)throw Error('QA probe hook changed');
   await route.fulfill({response,body:source.replaceAll('if (params.shot) {','if (true) {')+`\nwindow.__presetOverride=(density,reach,ratio,mirror)=>{pixelRatio=ratio;resize();grass.setQuality(density,reach,true);water.mirrorEvery=mirror;};`});
  });
  await page.goto('http://127.0.0.1:5230/?analytics=0&progress=0'+(chapter==='island'?'':'&chapter='+chapter));
  await page.waitForSelector('#veil.ready',{timeout:120000});
  if(variant==='old')await page.evaluate(mode=>__presetOverride(...(mode==='medium'?[.55,.85,1,1]:[.25,.7,.72,2])),mode);
  if(variant==='medium-reflection')await page.evaluate(()=>__presetOverride(.8,.95,1,2));
  await page.locator('#begin').click();
  await page.waitForTimeout(2500);
  const result=await page.evaluate(()=>new Promise(resolve=>{
   const start=performance.now(), intervals=[];let last;
   function sample(now){if(last!==undefined)intervals.push(now-last);last=now;
    if(now-start<8000){requestAnimationFrame(sample);return;}
    intervals.sort((a,b)=>a-b);
    resolve({fps:Math.round(intervals.length*1000/intervals.reduce((a,b)=>a+b,0)*10)/10,
     p50:intervals[Math.floor(intervals.length*.5)],p90:intervals[Math.floor(intervals.length*.9)],p99:intervals[Math.floor(intervals.length*.99)],
     over34:intervals.filter(n=>n>34).length,frames:intervals.length,stats:window.__stats});
   }requestAnimationFrame(sample);
  }));
  const row={chapter,mode,variant,...result};results.push(row);console.log(JSON.stringify(row));
  await page.screenshot({path:`/tmp/updraft-preset-${variant}-${chapter}-${mode}.png`});
  if(errors.length)throw Error(errors.join('\n'));
  await page.close();
 }
 await fs.writeFile(`/tmp/updraft-quality-presets-${variant}.json`,JSON.stringify(results,null,2));
}finally{await close()}
