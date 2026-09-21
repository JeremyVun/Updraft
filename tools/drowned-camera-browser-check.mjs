// Sail the actual village, clear the becalming with real pointer strokes, and continue into the wood.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
import {reviewCapture} from './lib/review-capture.mjs';
const {browser,close}=await openBrowser();
const reports=[],errors=[];
let stopReview;
try {
  for(const [w,h] of (process.env.PORTRAIT==='1'?[[390,844]]:[[1280,720]])) {
    const page=await browser.newPage({viewport:{width:w,height:h}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${process.env.BASE??'http://127.0.0.1:5239/'}?shot&chapter=drowned&ratio=1&msaa=2`);
    await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
    if(process.env.REVIEW==='1')stopReview=reviewCapture(page,`${process.env.REVIEW_PREFIX??'/tmp/updraft-drowned-replay'}-${w}`);
    await page.evaluate(()=>{
      const g=__game,c=g.story.current,original=g.rig.update.bind(g.rig),last=g.boat.position.clone();
      g.rig.camera.getWorldDirection(last);
      window.villageCamera={frames:0,worstChild:0,worstHull:0,maxTurn:0,beats:[]};
      g.rig.update=(...args)=>{
        original(...args);if(g.story.current!==c)return;
        const p=g.child.position.clone();p.y+=1.2;p.project(g.rig.camera);
        villageCamera.worstChild=Math.max(villageCamera.worstChild,Math.abs(p.x),Math.abs(p.y));
        for(const point of c.shot.subjects.points??[]){
          const hull=point.clone().project(g.rig.camera);
          villageCamera.worstHull=Math.max(villageCamera.worstHull,Math.abs(hull.x),Math.abs(hull.y));
        }
        const dir=g.rig.camera.getWorldDirection(last.clone());
        villageCamera.maxTurn=Math.max(villageCamera.maxTurn,last.angleTo(dir));last.copy(dir);
        villageCamera.frames++;
        if(villageCamera.beats.at(-1)?.beat!==c.beat)villageCamera.beats.push({beat:c.beat,time:c.now});
      };
    });
    async function shot(label){await page.screenshot({path:`/tmp/updraft-camera-drowned-${w}-${label}.png`});
      console.log(label,JSON.stringify(await page.evaluate(()=>({beat:__game.story.current.beat,time:__game.story.current.now,
        position:__game.boat.position.toArray(),eye:__game.rig.camera.position.toArray()}))));}
    for(const [label,time] of [['entry',8],['roofs',25],['church',36]]){
      await page.waitForFunction(t=>__game.story.current.now>t,time,{timeout:60000});await shot(label);
    }
    await page.waitForFunction(()=>__game.story.current.beat==='still',null,{timeout:60000});
    await page.waitForTimeout(3000);await shot('sail');
    for(let i=0;i<35;i++){
      if(await page.evaluate(()=>__game.story.current.beat!=='still'))break;
      const p=await page.evaluate(()=>{const g=__game,p=g.boat.sailPoint(g.boat.position.clone()).project(g.rig.camera);return [p.x,p.y];});
      const x=(p[0]*.5+.5)*w,y=(-p[1]*.5+.5)*h;
      await page.mouse.move(x,Math.min(h-10,y+100));await page.mouse.down();
      for(let j=1;j<=25;j++){await page.mouse.move(x,Math.max(10,y+100-j*8));await page.waitForTimeout(20);}
      await page.mouse.up();await page.waitForTimeout(150);
    }
    assert(await page.evaluate(()=>__game.story.current.beat!=='still'),'real sail strokes release the boat');
    await page.waitForFunction(()=>__game.boat.position.z<-1445,null,{timeout:60000});await shot('passing');
    for(const [label,time] of [['lighthouse',7],['storm',16],['plane',23]]){
      await page.waitForFunction(t=>__game.story.current.stormTime>t,time,{timeout:60000});await shot(label);
    }
    await page.waitForFunction(()=>__game.story.name==='wood',null,{timeout:60000});await shot('landed');
    const row=await page.evaluate(()=>villageCamera);reports.push({w,h,...row});
    assert(row.worstChild<1,'child remains on screen throughout the village and storm');
    assert(row.worstHull<.95,'hull retains breathing room throughout the village and storm');
    assert(row.maxTurn<.1,'continuous camera through all village beats');
    await stopReview?.();stopReview=null;
    await page.close();
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`/tmp/updraft-drowned-camera-${reports[0].w}.json`,JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports));
}finally{try{await stopReview?.();}finally{await close();}}
