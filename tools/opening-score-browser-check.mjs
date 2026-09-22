// Real main-loop wiring: first input, mute/resume, departure continuity and chapter cleanup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {openBrowser} from './lib/browser.mjs';
const server=await createServer({configFile:false,envDir:false,define:{__BUILD_ID__:JSON.stringify('opening-score-check')},
  server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await server.listen();
const {browser,close}=await openBrowser(),errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?shot&progress=0&ratio=1&msaa=2`);
  await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
  await page.mouse.click(10,10);await page.evaluate(()=>__game.sound.start());
  await page.waitForFunction(()=>!!__game.sound.openingScore);
  const first=await page.evaluate(()=>{
    window.openingFixture={score:__game.sound.openingScore,epoch:__game.sound.openingScore.epoch};
    return [...openingFixture.score.chordAt(__game.sound.ctx.currentTime)];
  });
  assert.deepEqual(first,[50,57,62,69]);
  await page.waitForFunction(()=>__game.sound.ctx.currentTime-openingFixture.epoch>5.5);
  assert.deepEqual(await page.evaluate(()=>[...openingFixture.score.chordAt(__game.sound.ctx.currentTime)]),[52,59,62,67]);
  await page.evaluate(()=>__game.sound.setMuted(true));
  await page.waitForFunction(()=>__game.sound.ctx.state==='suspended');
  const paused=await page.evaluate(()=>__game.sound.ctx.currentTime);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>__game.sound.ctx.currentTime),paused,'Mute suspends the score clock');
  await page.evaluate(()=>__game.sound.setMuted(false));
  await page.waitForFunction(()=>__game.sound.running);
  await page.evaluate(()=>{__game.story.sail(8.5,21.5,.95);__game.story.begin('toLines');});
  await page.waitForFunction(()=>__game.story.name==='toLines'&&__game.sound.openingScore?.epoch===openingFixture.epoch);
  assert(await page.evaluate(()=>__game.sound.openingScore===openingFixture.score),'Departure retains the same conductor');
  await page.evaluate(()=>__game.story.begin('lines'));
  await page.waitForFunction(()=>__game.sound.linesScore&&!__game.sound.openingScore);
  assert.deepEqual(errors,[]);
  const report={first,second:[52,59,62,67],muteFreezesClock:true,departureContinues:true,chapterCleanup:true,errors};
  fs.writeFileSync('/tmp/updraft-opening-score-browser.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{await close();await server.close();}
