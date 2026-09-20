// Real app -> configured analytics ingest. QA events carry environment=qa.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
const {browser,close}=await openBrowser(),report={accepted:[],offline:false,defaultOff:false};
const base=process.env.BASE??'http://127.0.0.1:5230/';
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{
  if(r.url()!=='https://analytics.jeremyvun.com/e')return;
  const request=r.request(),events=JSON.parse(request.postData());
  report.accepted.push({status:r.status(),events});
 });
 await page.goto(base+'?shot=1&start=1&analytics=1');await page.waitForSelector('#veil.ready',{timeout:60000});await page.locator('#begin').click();
 await page.waitForFunction(()=>window.__ready,null,{timeout:60000});await page.waitForTimeout(5500);
 assert(report.accepted.length>0,'app must send real analytics');
 assert(report.accepted.every(r=>r.status===204),'ingest must accept every event');
 const events=report.accepted.flatMap(r=>r.events);
 for(const name of ['loading_finished','game_started','chapter_entered','quality_changed'])assert(events.some(e=>e.t===name),name);
 for(const e of events){assert.equal(e.p,'updraft');assert.equal(e.d.environment,'qa');assert.equal(e.u,undefined);assert.equal(e.sid,undefined)}
 await page.route('https://analytics.jeremyvun.com/e',r=>r.abort());
 const before=await page.evaluate(()=>__stats.frame);
 await page.evaluate(()=>{window.dispatchEvent(new ErrorEvent('error',{error:new TypeError('Private message must not leave browser')}))});
 await page.waitForFunction(n=>__stats.frame>n+90,before);report.offline=true;
 assert.deepEqual(errors,[]);await page.close();
 const qa=await browser.newPage();let requests=0;qa.on('request',r=>{if(r.url().includes('analytics.jeremyvun.com'))requests++});
 await qa.goto(base+'?shot=1');await qa.waitForFunction(()=>window.__ready,null,{timeout:60000});await qa.waitForTimeout(5500);
 assert.equal(requests,0);report.defaultOff=true;
} finally {fs.writeFileSync('/tmp/updraft-analytics-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await close()}
