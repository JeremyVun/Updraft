// Real WEBGL_lose_context, native reload and checkpoint recovery; no simulated loss events.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
const {browser,close}=await openBrowser();
const base=process.env.BASE??'http://127.0.0.1:5230/';
const report=[];
try {
 for(const saved of [true,false]) {
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/object does not belong to this context/.test(m.text()))errors.push(m.text())});
  await page.goto(base+`?shot=1&start=1&progress=${saved?1:0}&chapter=meadow`);
  await page.waitForSelector('#veil.ready',{timeout:60000});await page.locator('#begin').click();
  await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
  const checkpoint=await page.evaluate(()=>localStorage.getItem('updraft.progress.v1'));
  assert.equal(!!checkpoint,saved);
  await page.evaluate(()=>{window.__loss=__game.renderer.getContext().getExtension('WEBGL_lose_context');if(!__loss)throw Error('WEBGL_lose_context unavailable');__loss.loseContext()});
  await page.waitForSelector('#graphics-recovery:not([hidden])');
  assert.equal(await page.locator('#graphics-recovery button').innerText(),saved?'Continue from checkpoint':'Restart game');
  assert(await page.evaluate(()=>document.activeElement===document.querySelector('#graphics-recovery button')&&document.querySelector('#view').inert));
  const frame=await page.evaluate(()=>__stats.frame);
  await page.keyboard.press('m');
  await page.waitForFunction(()=>!__game.sound.running);
  await page.waitForTimeout(300);await page.evaluate(()=>__loss.restoreContext());await page.waitForTimeout(900);
  assert.equal(await page.evaluate(()=>__stats.frame),frame,'restoration must not resume invalid GPU simulation');
  assert.equal(await page.evaluate(()=>localStorage.getItem('updraft.progress.v1')),checkpoint,'loss must preserve checkpoint');
  await page.screenshot({path:`/tmp/updraft-context-loss-${saved?'saved':'fresh'}.png`});
  await page.locator('#graphics-recovery button').click();await page.waitForSelector('#veil.ready',{timeout:60000});
  assert.equal(await page.locator('#begin').innerText(),saved?'Continue':'Begin');await page.locator('#begin').click();
  await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
  const delivered=await page.evaluate(()=>__stats.readbacksDelivered);
  await page.waitForFunction(n=>__stats.readbacksDelivered>n+5,delivered);
  assert.equal(await page.locator('#graphics-recovery').isVisible(),false);
  assert.deepEqual(errors,[]);report.push({saved,paused:true,checkpointPreserved:true,reloaded:true,windReadbacksRecovered:true});
  await context.close();
 }
 // Also lose the context during startup, before sound or the first game frame exists.
 const bootContext=await browser.newContext(),bootPage=await bootContext.newPage();
 await bootPage.addInitScript(()=>{
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(...args){
   const gl=get.apply(this,args);
   if(args[0]==='webgl2'&&gl&&!sessionStorage.getItem('updraft.loss-injected')){
    sessionStorage.setItem('updraft.loss-injected','1');
    setTimeout(()=>gl.getExtension('WEBGL_lose_context').loseContext(),0);
   }
   return gl;
  };
 });
 await bootPage.goto(base+'?shot=1&start=1&progress=1');
 await bootPage.waitForSelector('#graphics-recovery:not([hidden])',{timeout:60000});
 assert.equal(await bootPage.locator('#graphics-recovery button').innerText(),'Restart game');
 assert.equal(await bootPage.evaluate(()=>localStorage.getItem('updraft.progress.v1')),null);
 await bootPage.locator('#graphics-recovery button').click();
 await bootPage.waitForSelector('#veil.ready',{timeout:60000});
 await bootPage.locator('#begin').click();await bootPage.waitForFunction(()=>window.__ready,null,{timeout:60000});
 report.push({duringBoot:true,reloaded:true});await bootContext.close();
}finally{fs.writeFileSync('/tmp/updraft-context-loss.json',JSON.stringify(report,null,2));console.log(report);await close()}
