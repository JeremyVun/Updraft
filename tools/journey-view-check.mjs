// Review the pond departure and chapter visibility gates in the real renderer, desktop and portrait.
// Usage: node tools/journey-view-check.mjs /tmp/updraft-journey-view. Uses the shared GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix=process.argv[2] ?? '/tmp/updraft-journey-view';
const base=process.env.BASE ?? 'http://127.0.0.1:5230/';
console.log('Waiting for the shared browser, then checking pond and crossing views.');
const {browser,close}=await openBrowser();
const report=[];
try {
  for(const [width,height] of [[1600,900],[390,844]]) {
    const page=await browser.newPage({viewport:{width,height}}), errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
    page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico')){errors.push(m.text());console.error(m.text());}});
    await page.goto(`${base}?shot=1&chapter=meadow&ratio=1`);
    await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
    await page.evaluate(()=>{
      const g=__game,c=g.story.current;
      g.child.stop();g.child.place(40,-842,Math.PI);g.cygnet.rideIn('satchel');g.glider.hold(g.child);
      c.leg=3;c.piano.restoreDone();c.reveal();c.frame();g.rig.cut(c.shot);
    });
    await page.waitForTimeout(3800);
    await page.screenshot({path:`${prefix}-${width}-family.png`});
    await page.waitForFunction(()=>__game.story.current.beat==='down'&&__game.story.current.t>1,null,{timeout:15000});
    assert.equal(await page.evaluate(()=>__game.child.moving),false,'migration begins before the child approaches');
    await page.screenshot({path:`${prefix}-${width}-migration.png`});
    await page.waitForTimeout(3800);
    await page.screenshot({path:`${prefix}-${width}-following.png`});
    const parity=await page.evaluate(()=>__stats.heightParity);
    assert(parity<.02,'new channel has CPU/GPU height parity');

    // A known place on the crossing where the secret shore used to be visible.
    await page.evaluate(()=>{
      const g=__game;g.story.sail(285,-582,-Math.PI/2);g.story.begin('toMeadow');
      g.story.current.frame(null);g.rig.cut(g.story.current.shot);
      const before=g.terrain.mesh.onBeforeRender;
      g.terrain.mesh.onBeforeRender=function(...args){
        before.apply(this,args);
        window.concealedShore=this.material.uniforms.uRoom.value.z<0
          && g.doorwayView.shoreObjects.every(o=>!o.visible);
      };
    });
    await page.waitForFunction(()=>window.concealedShore===true);
    await page.waitForTimeout(2500);
    await page.screenshot({path:`${prefix}-${width}-hidden-shore.png`});
    await page.evaluate(()=>{
      const g=__game;g.story.sail(-34,-1908,.2);g.story.begin('toSleeping');
      g.story.current.frame(null);g.rig.cut(g.story.current.shot);
    });
    await page.waitForTimeout(2500);
    assert.equal(await page.evaluate(()=>__game.scene.getObjectByName('home-jetty').visible),false);
    await page.screenshot({path:`${prefix}-${width}-wood-exit.png`});
    await page.evaluate(()=>__game.story.begin('toHarbour'));
    await page.waitForFunction(()=>__game.scene.getObjectByName('home-jetty').visible===true);
    assert.deepEqual(errors,[]);
    report.push({width,height,parity,errors,shoreHidden:true,jettyWithheld:true});
    console.log(JSON.stringify(report.at(-1)));
    await page.close();
  }
  fs.writeFileSync(`${prefix}.json`,JSON.stringify(report,null,2));
} finally {await close();}
