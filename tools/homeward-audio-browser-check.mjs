// Arrange the completed mirror departure; let the real boat, camera and audio decide the entrance.
// node tools/homeward-audio-browser-check.mjs (Vite on 5230; shared GPU lock).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {openBrowser} from './lib/browser.mjs';
// A private server prevents a concurrent workspace edit from reloading the game mid-transition.
const server=await createServer({configFile:false,envDir:false,define:{__BUILD_ID__:JSON.stringify('homeward-audio-check')},
  server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await server.listen();
const {browser,close}=await openBrowser(),errors=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?shot&chapter=mirror&ratio=1&msaa=2&progress=0`);
  await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
  await page.mouse.click(10,10);
  await page.evaluate(async()=>{
    const {MIRROR_BERTH}=await import('/src/world/sky-mirror-layout.ts'),g=__game;
    g.sound.start();
    window.homewardAudio={phases:[],entry:null};
    const update=g.sound.update.bind(g.sound);
    g.sound.update=(dt,state)=>{
      update(dt,state);if(!g.sound.running)return;
      const stage=g.sound.arrivalTransition.stage,now=g.sound.ctx.currentTime;
      if(homewardAudio.phases.at(-1)?.stage!==stage)homewardAudio.phases.push({stage,now,chapter:g.story.name});
      if(stage==='incoming'&&!homewardAudio.entry){
        const c=g.story.current;
        homewardAudio.entry={now,chapter:g.story.name,leg:c.leg,ready:c.homewardReady,
          distance:Math.hypot(g.boat.position.x-c.departure.x,g.boat.position.z-c.departure.y),
          boat:g.boat.position.toArray(),camera:g.rig.camera.position.toArray(),phase:g.sound.summitScore?.phase};
      }
    };
    g.story.sail(MIRROR_BERTH.x,MIRROR_BERTH.z,MIRROR_BERTH.yaw);g.story.begin('toHarbour');
  });
  await page.waitForFunction(()=>__game.sound.arrivalTransition.stage==='gap',null,{timeout:20000});
  await page.screenshot({path:'/tmp/updraft-homeward-silence.png'});
  await page.waitForFunction(()=>homewardAudio.entry,null,{timeout:60000});
  await page.screenshot({path:'/tmp/updraft-homeward-entry.png'});
  const report=await page.evaluate(()=>homewardAudio),fade=report.phases.find(p=>p.stage==='fade'),gap=report.phases.find(p=>p.stage==='gap'),incoming=report.phases.find(p=>p.stage==='incoming');
  assert(fade&&gap&&incoming,'The real game runs the complete transition');
  assert(gap.now-fade.now>=2.95,'The mirror fades for three seconds');
  assert(incoming.now-gap.now>=5,'The real game keeps at least five seconds of musical silence');
  assert.equal(report.entry.chapter,'toHarbour');assert.equal(report.entry.phase,'approach');
  assert(report.entry.leg>0&&report.entry.distance>=30&&report.entry.ready,'The new score enters after the first offshore turn');
  assert.deepEqual(errors,[]);
  fs.writeFileSync('/tmp/updraft-homeward-browser.json',JSON.stringify({report,errors},null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await close();await server.close();}
