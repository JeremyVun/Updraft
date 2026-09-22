// The two previously premature/missing handoffs, with real departure, boat, main loop and audio clock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {openBrowser} from './lib/browser.mjs';
const server=await createServer({configFile:false,envDir:false,define:{__BUILD_ID__:JSON.stringify('transition-scenes')},
  server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const {browser,close}=await openBrowser(),reports=[];
try {
  for(const scene of ['birches','sea']){
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const chapter=scene==='birches'?'meadow':'sleeping';
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?shot&chapter=${chapter}&ratio=1&msaa=2&progress=0`);
    await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
    await page.mouse.click(10,10);
    await page.evaluate(scene=>{
      __game.sound.start();
      if(scene==='birches')__game.story.current.skipAhead();
      else __game.story.current.restoreCheckpoint('morning',[]);
    },scene);
    await page.waitForFunction(scene=>scene==='birches'?!!__game.sound.meadowScore:!!__game.sound.sleepingScore,scene);
    await page.evaluate(async scene=>{
      const g=__game;
      window.transitionScene={scene,phases:[],entry:null,departure:g.sound.ctx.currentTime};
      const update=g.sound.update.bind(g.sound);
      g.sound.update=(dt,state)=>{update(dt,state);if(!g.sound.running)return;
        const stage=g.sound.arrivalTransition.stage,now=g.sound.ctx.currentTime-transitionScene.departure;
        if(transitionScene.phases.at(-1)?.stage!==stage)transitionScene.phases.push({stage,now});
        if(stage==='incoming'&&!transitionScene.entry)transitionScene.entry={now,chapter:g.story.name,
          ready:g.story.current.arrivalReady,remaining:g.story.current.remainingSail?.(),
          score:scene==='birches'?!!g.sound.birchesScore:!!g.sound.seaScore,
          outgoingGone:scene==='birches'?!g.sound.meadowScore:!g.sound.sleepingScore};
      };
      if(scene==='birches'){
        const {FAR_SHORE}=await import('/src/story/meadow.ts');g.story.sail(FAR_SHORE.x,FAR_SHORE.z,.2);g.story.begin('toBirches');
      }else{
        const {SLEEP_BERTH}=await import('/src/world/sleeping.ts');g.story.sail(SLEEP_BERTH.x,SLEEP_BERTH.z,-1.76);g.story.begin('toMirror');
      }
    },scene);
    await page.waitForFunction(()=>!!transitionScene.entry,null,{timeout:60000});
    await page.screenshot({path:`/tmp/updraft-${scene}-music-entry.png`});
    const report=await page.evaluate(()=>transitionScene),fade=report.phases.find(p=>p.stage==='fade'),gap=report.phases.find(p=>p.stage==='gap');
    assert(fade&&gap);assert(gap.now-fade.now>=2.95);assert(report.entry.now-gap.now>=3);
    assert(report.entry.score&&report.entry.outgoingGone&&report.entry.ready);
    if(scene==='birches')assert(fade.now>5,'Meadow continues after departure before the Birches approach');
    assert.deepEqual(errors,[]);reports.push({...report,errors});await page.close();
  }
  fs.writeFileSync('/tmp/updraft-transition-scenes-browser.json',JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports,null,2));
}finally{await close();await server.close();}
