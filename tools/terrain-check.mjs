// Cross-chapter terrain regression: actual GPU draw, shader errors, height parity and reviewable screenshots.
// Usage: node tools/terrain-check.mjs [prefix]. Uses the shared GPU lock; captures go to /tmp.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const LOCK = '/tmp/updraft-chromium.lock';
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function acquireLock() {
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      fs.writeFileSync(`${LOCK}/pid`, String(process.pid));
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let holder = 0;
      try {
        holder = Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) || 0;
      } catch {}
      let stale = holder ? !alive(holder) : false;
      try {
        if (!holder) stale = Date.now() - fs.statSync(LOCK).mtimeMs > 10000;
      } catch {}
      if (stale) fs.rmSync(LOCK, { recursive: true, force: true });
      else await new Promise((r) => setTimeout(r, 400));
    }
  }
}
function releaseLock() {
  try {
    if (Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) === process.pid) fs.rmSync(LOCK, { recursive: true, force: true });
  } catch {}
}
process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const prefix = process.argv[2] ?? '/tmp/updraft-terrain';
await acquireLock();
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({viewport:{width:1100,height:700}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error' && !m.location().url.endsWith('/favicon.ico'))errors.push(m.text()+' '+m.location().url);});
const results=[];
try {
  for(const chapter of ['island','washing','boats','piano','birches','drowned','wood','sleeping','jetty']) {
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=${chapter}`);
    await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
    await page.evaluate(()=>{
      window.terrainDrawn=false;
      __game.terrain.mesh.onAfterRender=(_r,_s,camera)=>{if(camera===__game.rig.camera)window.terrainDrawn=true;};
    });
    await page.waitForFunction(()=>window.terrainDrawn,null,{timeout:15000});
    await page.waitForTimeout(500);
    const result=await page.evaluate(()=>({
      visible:__game.terrain.mesh.visible, leaves:__game.terrain.mesh.geometry.instanceCount,
      blades:__stats.blades, heightParity:__stats.heightParity,
      room:__game.terrain.mesh.material.uniforms.uRoom.value.toArray(),
      mirrorActive:__game.skyMirror.active,
    }));
    assert(result.visible && result.leaves>0,`${chapter}: terrain must render in the main view`);
    assert(!result.mirrorActive,`${chapter}: mirror objects must remain local`);
    assert(Number.isFinite(result.heightParity) && result.heightParity<0.02,`${chapter}: terrain heights agree`);
    if(!['drowned','wood'].includes(chapter))assert(result.blades>0,`${chapter}: land has grass`);
    assert.deepEqual(errors,[],`${chapter}: no shader or browser errors`);
    await page.screenshot({path:`${prefix}-${chapter}.png`});
    results.push({chapter,...result});console.log(JSON.stringify(results.at(-1)));
  }
  fs.writeFileSync(`${prefix}.json`,JSON.stringify(results,null,2));
} finally { await browser.close(); }
