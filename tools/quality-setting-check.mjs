// Player controls against the real game; read-only probes expose state without enabling shot timing.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';
const { browser, close } = await openBrowser();
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const out = process.env.OUT ?? '/tmp/updraft-quality-setting';
async function choose(page, mode) {
  await page.locator('#quality').click();
  await page.locator(`#quality-menu [data-mode="${mode}"]`).click();
}
const errors = [];
async function prepare(context) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await withoutHotReload(page);
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch(), source = await response.text();
    assert.equal((source.match(/if \(QA && params.shot\) \{/g) ?? []).length, 2);
    await route.fulfill({ response, body: source.replaceAll('if (QA && params.shot) {', 'if (true) {') });
  });
  return page;
}
async function start(page) {
  await page.waitForSelector('#veil.ready', { timeout: 90000 });
  assert(await page.locator('#quality').isVisible() || await page.locator('#corner-toggle').isVisible(), 'quality available before Begin');
  await page.locator('#begin').click();
  await page.waitForSelector('#veil', { state: 'detached' });
}
const applied = page => page.evaluate(() => ({ mode: __game.quality.mode, name: __game.quality.level.name, ratio: __game.renderer.getPixelRatio(),
  reach: Math.round(__game.grass.quality.reach * 1e6) / 1e6, density: __game.grass.quality.density, split: __game.terrain.detail }));
// At a device pixel ratio of 2: the table in docs/engine.md, Quality governor.
const LEVELS = {
  ultra: { ratio: 1.5, reach: 1.15, density: 1, split: 1.6 },
  high: { ratio: 1.25, reach: 1.15, density: 1, split: 1.6 },
  medium: { ratio: 1, reach: 1, density: 1, split: 1.35 },
  low: { ratio: .85, reach: 1, density: 1, split: 1.1 },
};
async function select(page, mode) {
  await choose(page, mode);
  const want = { mode, name: mode, ...LEVELS[mode] };
  await page.waitForFunction(({want}) => __game.quality.mode === want.mode && Math.abs(__game.grass.quality.reach - want.reach) < 1e-9
    && Math.abs(__game.renderer.getPixelRatio() - want.ratio) < 1e-9, {want}, {timeout:30000}).catch(() => {});
  assert.deepEqual(await applied(page), want);
  assert.equal(await page.evaluate(() => __game.input.down), false, 'selection must not blow wind');
  assert.equal(await page.evaluate(() => localStorage.getItem('updraft.quality.v2')), mode);
}
const presented = page => page.evaluate(() => new Promise(resolve => {
  const from = __stats.frame, start = performance.now();
  setTimeout(() => resolve((__stats.frame - from) * 1000 / (performance.now() - start)), 3000);
}));
try {
  const context = await browser.newContext({viewport:{width:1100,height:700},deviceScaleFactor:2});
  const page = await prepare(context);
  await page.goto(base+'?analytics=0&progress=0'); await start(page);
  assert.equal(await page.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'auto');
  assert.equal((await applied(page)).name, 'ultra', 'Auto opens at Ultra');
  await select(page, 'low');
  const low = await presented(page);
  assert(low > 50, `Low presents at 60 fps: ${low.toFixed(1)}`);
  await select(page, 'high');
  await select(page, 'ultra');
  const ultra = await presented(page);
  assert(ultra > 50, `Ultra presents at 60 fps: ${ultra.toFixed(1)}`);
  // A sustained synthetic overload still must not override the player's setting.
  assert.equal(await page.evaluate(() => {
    for(let t=0;t<20000;t+=40)__game.quality.frame(performance.now()+t,40);
    return __game.quality.level.name;
  }), 'ultra');
  await page.screenshot({path:`${out}-desktop.png`});
  await select(page, 'medium');
  await page.reload(); await start(page);
  assert.equal(await page.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'medium');
  assert.equal(await page.evaluate(() => __game.quality.level.name), 'medium');
  await choose(page, 'auto');
  assert.equal(await page.evaluate(() => __game.quality.mode), 'auto');
  assert.equal(await page.evaluate(() => __game.quality.level.name), 'medium', 'Auto starts at current quality');
  assert.equal(await page.evaluate(() => localStorage.getItem('updraft.quality.v2')), 'auto');
  await page.locator('#quality').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('h'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'high', 'keyboard selection');
  const sound = await page.locator('#sound').getAttribute('data-on');
  await page.locator('#quality').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('m'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'medium');
  assert.equal(await page.locator('#sound').getAttribute('data-on'), sound, 'Medium type-ahead must not mute audio');
  await select(page, 'ultra');
  await page.goto(base+'?shot&ratio=.6&analytics=0');
  await page.waitForFunction(() => window.__ready, null, {timeout:90000});
  assert.equal(await page.locator('#quality-control').isVisible(), false);
  assert.deepEqual(await page.evaluate(() => ({ ...__game.quality.level })), { name: 'ultra', ratio: .6, samples: 4 }, 'a saved choice cannot change a QA override');
  await context.close();
  // A choice saved before the four levels: the old High was what Ultra is.
  const returning = await browser.newContext({viewport:{width:1100,height:700},deviceScaleFactor:2});
  await returning.addInitScript(() => { if (!localStorage.getItem('updraft.quality.v2')) localStorage.setItem('updraft.quality.v1', 'high'); });
  const old = await prepare(returning);
  await old.goto(base+'?analytics=0&progress=0'); await start(old);
  assert.equal(await old.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'ultra');
  assert.deepEqual(await applied(old), { mode: 'ultra', name: 'ultra', ...LEVELS.ultra });
  await returning.close();
  const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone = await prepare(mobile);
  await phone.goto(base+'?analytics=0&progress=0'); await start(phone);
  assert.equal((await applied(phone)).name, 'ultra', 'a touch display at DPR 1 opens at Ultra');
  await phone.locator('#corner-toggle').tap();
  await select(phone, 'medium');
  const boxes = await phone.locator('#quality-control, #sound, #fullscreen, #corner-toggle').evaluateAll(elements => elements.filter(e=>!e.hidden).map(e=>{
    const r=e.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom};
  }));
  assert(boxes.every(r=>r.x>=0&&r.right<=390&&r.bottom<=844));
  assert(boxes.every((a,i)=>boxes.every((b,j)=>i===j||a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y)), 'controls must not overlap');
  await phone.locator('#quality').blur();
  await phone.screenshot({path:`${out}-phone.png`});
  assert.deepEqual(errors,[]);
  console.log('Quality controls: the four levels live at 60 fps, overload lock, persistence, the old saved High as Ultra, Auto resume, keyboard selection, QA isolation and phone layout passed.');
} finally { await close(); }
