// Real summit arrival, camera and reaction timing; optional video via VIDEO=1.
// Usage: node tools/summit-arrival-check.mjs /tmp/updraft-arrival
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix = process.argv[2] ?? '/tmp/updraft-arrival';
const { browser, close } = await openBrowser();
try {
  for (const [width,height] of [[1600,900],[390,844]]) {
    const label = `${prefix}-${width}x${height}`;
    const page = await browser.newPage({viewport:{width,height}, ...(process.env.VIDEO ? {recordVideo:{dir:`${prefix}-video`,size:{width,height}}} : {})});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=summit`);
    await page.waitForFunction(() => window.__ready === true, null, {timeout:60000});
    // Keep the natural final steps up the hill and the camera's approach to the seated child.
    const results = [];
    for (const [name,time] of [['approach',3.5],['bank',6],['return',10],['call',14.2],['waiting',16.5]]) {
      await page.waitForFunction(t => __game.story.current.beat === 'summit' && __game.story.current.t >= t, time, {timeout:90000});
      await page.screenshot({path:`${label}-${name}.png`});
      results.push(await page.evaluate(name => {
        const h=__game.story.current, cam=__game.rig.camera;
        const birds=h.cast.flock.birds.map(b=>{const p=b.at.clone().project(cam);return {x:p.x,y:p.y,z:p.z};});
        const child=h.cast.child.position.clone().project(cam);
        return {name,time:h.t,wheel:h.cast.flock.wheeling,called:h.criedAfter,child:{x:child.x,y:child.y},birds};
      },name));
      console.log(`${label}-${name}.png`);
    }
    await page.waitForFunction(()=>__game.story.current.beat==='tries' && __game.story.current.t>3,null,{timeout:60000});
    await page.screenshot({path:`${label}-tries.png`});
    assert.equal(errors.length,0,errors.join('\n'));
    assert(!results[0].wheel && results[1].wheel, 'arrival did not precede the bank');
    assert(!results[2].called && results[3].called, 'cygnet called before the circuit was shown');
    for (const result of results.slice(2)) {
      assert(Math.abs(result.child.x)<0.9 && Math.abs(result.child.y)<0.9, 'child left the establishing shot');
      assert(result.birds.every(b=>Math.abs(b.x)<0.96 && Math.abs(b.y)<0.9 && Math.abs(b.z)<1), 'the circuit left the establishing shot');
    }
    fs.writeFileSync(`${label}.json`, JSON.stringify(results,null,2));
    await page.close();
    if (process.env.VIDEO) await page.video().saveAs(`${label}.webm`);
  }
} finally { await close(); }
