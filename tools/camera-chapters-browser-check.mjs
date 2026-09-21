// Real renderer smoke review of every chapter entrance, in landscape and portrait.
// Complements complete crossing/village/pond/ending checks; this is not a full interactive playthrough.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
const {browser,close}=await openBrowser();
const report=[];
try {
  for(const [width,height] of [[1280,720],[390,844]]) {
    const page=await browser.newPage({viewport:{width,height}});
    for(const chapter of ['island','washing','boats','meadow','birches','wood','sleeping','sea','mirror','jetty','summit']) {
      const errors=[];
      const onError=e=>errors.push(e.message);page.on('pageerror',onError);
      await page.goto(`${process.env.BASE??'http://127.0.0.1:5259/'}?shot&chapter=${chapter}&progress=0&ratio=1&msaa=2`);
      await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
      await page.evaluate(()=>{
        const g=__game,original=g.rig.update.bind(g.rig),last=g.boat.position.clone();
        g.rig.camera.getWorldDirection(last);
        window.cameraReview={frames:0,maxTurn:0,worstPrimary:0,nonFinite:0};
        g.rig.update=(...args)=>{
          original(...args);const s=g.story.shot;
          const dir=g.rig.camera.getWorldDirection(last.clone());
          cameraReview.maxTurn=Math.max(cameraReview.maxTurn,last.angleTo(dir));last.copy(dir);
          if(!g.rig.camera.position.toArray().every(Number.isFinite))cameraReview.nonFinite++;
          if(s.subjects&&cameraReview.frames>120){const p=s.subjects.primary.clone().project(g.rig.camera);
            cameraReview.worstPrimary=Math.max(cameraReview.worstPrimary,Math.abs(p.x),Math.abs(p.y));}
          cameraReview.frames++;
        };
      });
      await page.waitForFunction(()=>cameraReview.frames>=360,null,{timeout:45000});
      const row=await page.evaluate(()=>({...cameraReview,beat:__game.story.current.beat,
        eye:__game.rig.camera.position.toArray(),child:__game.child.position.toArray()}));
      await page.screenshot({path:`/tmp/updraft-direction-${chapter}-${width}.png`});
      report.push({chapter,width,height,...row,errors});console.log(JSON.stringify(report.at(-1)));
      assert.deepEqual(errors,[]);assert.equal(row.nonFinite,0);assert(row.maxTurn<.1,`${chapter}: discontinuous turn`);
      assert(row.worstPrimary<1,`${chapter}: primary lost during entrance`);
      page.off('pageerror',onError);
    }
    await page.close();
  }
} finally {
  fs.writeFileSync('/tmp/updraft-direction-chapters.json',JSON.stringify(report,null,2));await close();
}
