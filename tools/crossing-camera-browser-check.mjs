// Render actual uninterrupted crossings. Includes desktop farewell/whale/arrival and portrait pod/swim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const {browser,close}=await openBrowser();
const report=[],errors=[];
try {
  for(const [name,width,height] of [['crossing',1280,720],['sea',390,844]].filter(([n])=>!process.env.CASE||process.env.CASE===n)) {
    const page=await browser.newPage({viewport:{width,height}});
    page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot&chapter=${name}&ratio=1&msaa=2`);
    await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
    console.log(name,'ready');
    await page.evaluate(()=>{
      const g=__game,c=g.story.current;
      window.cameraLog={name:g.story.name,frames:0,worstChild:0,maxAngularStep:0,behind:0,worstWhale:0,whaleFrames:0};
      const update=g.rig.update.bind(g.rig),direction=g.boat.position.clone(),last=direction.clone();
      g.rig.camera.getWorldDirection(last);
      g.rig.update=(...args)=>{
        update(...args);
        if(g.story.current!==c)return;
        g.rig.camera.updateMatrixWorld();
        const p=g.child.position.clone();p.y+=1.2;p.project(g.rig.camera);
        cameraLog.worstChild=Math.max(cameraLog.worstChild,Math.abs(p.x),Math.abs(p.y));
        if(p.z>1)cameraLog.behind++;
        g.rig.camera.getWorldDirection(direction);
        cameraLog.maxAngularStep=Math.max(cameraLog.maxAngularStep,last.angleTo(direction));
        last.copy(direction);cameraLog.frames++;
        if(g.sealife.whale&&g.sealife.body.time>5&&c.watching>.99&&c.swimFrame<.01){
          for(const along of [0,.45,1])for(const side of [-2.75,2.75]){
            const point=g.sealife.body.point(side,1,along,g.boat.position.clone());
            if(point.y<-.5)continue;
            point.project(g.rig.camera);
            cameraLog.worstWhale=Math.max(cameraLog.worstWhale,Math.abs(point.x),Math.abs(point.y));
          }
          cameraLog.whaleFrames++;
        }
      };
    });
    const marks=name==='crossing'?[['farewell',8],['turn',36],['companions',47],['whale',62],['whale-tail',72],['arrival',84]]:
      [['pod',20],['swim',70],['return',112],['approach',138]];
    for(const [label,time] of marks) {
      await page.waitForFunction(t=>__game.story.current.time>=t||__game.story.name!==cameraLog.name,time,{timeout:60000});
      const state=await page.evaluate(()=>({chapter:__game.story.name,time:__game.story.current.time,
        swim:__game.story.current.swim,whale:!!__game.sealife.whale,camera:__game.rig.camera.position.toArray()}));
      await page.screenshot({path:`/tmp/updraft-camera-${name}-${label}.png`});
      console.log(name,label,JSON.stringify(state));
    }
    report.push(await page.evaluate(()=>cameraLog));
    await page.close();
  }
  assert.deepEqual(errors,[]);
  for(const row of report){assert(row.behind===0);assert(row.worstChild<1,`${row.name}: child outside frame`);
    assert(row.maxAngularStep<.06,`${row.name}: camera turn jumped`);
    if(row.name==='toLines')assert(row.whaleFrames>0&&row.worstWhale<1,'surfacing whale must share the frame');}
  fs.writeFileSync(`/tmp/updraft-crossing-camera-browser${process.env.CASE?'-'+process.env.CASE:''}.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally {await close();}
