// Player controls against the real game; read-only probes expose state without enabling shot timing.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
async function choose(page, mode) {
  await page.locator('#quality').click();
  await page.locator(`#quality-menu [data-mode="${mode}"]`).click();
}
const errors = [];
async function prepare(context) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  // Other local tasks may edit files during the check; don't let HMR restart it.
  await page.route('**/@vite/client', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch(), source = await response.text();
    assert.equal((source.match(/if \(params.shot\) \{/g) ?? []).length, 2);
    await route.fulfill({ response, body: source.replaceAll('if (params.shot) {', 'if (true) {') });
  });
  return page;
}
async function start(page) {
  await page.waitForSelector('#veil.ready', { timeout: 90000 });
  assert.equal(await page.locator('#quality').isVisible(), true, 'quality available before Begin');
  await page.locator('#begin').click();
  await page.waitForSelector('#veil', { state: 'detached' });
}
async function select(page, mode, density, ratio) {
  await choose(page, mode);
  await page.waitForFunction(({mode,density,ratio}) => __game.quality.mode === mode &&
    Math.abs(__game.grass.quality.density-density) < .001 && Math.abs(__game.renderer.getPixelRatio()-ratio) < .001,
  {mode,density,ratio}, {timeout:30000});
  assert.equal(await page.evaluate(() => __game.input.down), false, 'selection must not blow wind');
  assert.equal(await page.evaluate(() => localStorage.getItem('updraft.quality.v1')), mode);
}
try {
  const context = await browser.newContext({viewport:{width:1100,height:700},deviceScaleFactor:2});
  const page = await prepare(context);
  await page.goto(base+'?analytics=0&progress=0'); await start(page);
  assert.equal(await page.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'auto');
  await select(page, 'low', .8, .85);
  await select(page, 'high', 1, 1.5);
  // A sustained synthetic overload still must not override the player's setting.
  assert.equal(await page.evaluate(() => {
    for(let t=0;t<20000;t+=40)__game.quality.frame(performance.now()+t,40);
    return __game.quality.level.detail;
  }), 2);
  await page.screenshot({path:'/tmp/updraft-quality-setting-desktop.png'});
  await select(page, 'medium', 1, 1);
  await page.reload(); await start(page);
  assert.equal(await page.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'medium');
  assert.equal(await page.evaluate(() => __game.quality.level.detail), 1);
  await choose(page, 'auto');
  assert.equal(await page.evaluate(() => __game.quality.mode), 'auto');
  assert.equal(await page.evaluate(() => __game.quality.level.detail), 1, 'Auto starts at current quality');
  await page.locator('#quality').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('h'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'high', 'keyboard selection');
  const sound = await page.locator('#sound').getAttribute('data-on');
  await page.locator('#quality').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('m'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#quality-menu [aria-checked="true"]').getAttribute('data-mode'), 'medium');
  assert.equal(await page.locator('#sound').getAttribute('data-on'), sound, 'Medium type-ahead must not mute audio');
  await select(page, 'high', 1, 1.5);
  await page.goto(base+'?shot&ratio=.6&analytics=0');
  await page.waitForFunction(() => window.__ready, null, {timeout:90000});
  assert.equal(await page.locator('#quality-control').isVisible(), false);
  assert.equal(await page.evaluate(() => __game.quality.level.ratio), .6, 'saved High cannot change QA override');
  await context.close();
  const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone = await prepare(mobile);
  await phone.goto(base+'?analytics=0&progress=0'); await start(phone);
  await select(phone, 'medium', 1, 1);
  const boxes = await phone.locator('#quality-control, #sound, #fullscreen').evaluateAll(elements => elements.filter(e=>!e.hidden).map(e=>{
    const r=e.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom};
  }));
  assert(boxes.every(r=>r.x>=0&&r.right<=390&&r.bottom<=844));
  const ordered=boxes.sort((a,b)=>a.x-b.x);
  assert(ordered.every((r,i)=>!i||ordered[i-1].right<r.x), 'controls must not overlap');
  await phone.locator('#quality').blur();
  await phone.screenshot({path:'/tmp/updraft-quality-setting-phone.png'});
  assert.deepEqual(errors,[]);
  console.log('Quality controls: live presets, full-grass restoration, overload lock, persistence, Auto resume, keyboard selection, QA isolation and phone layout passed.');
} finally { await close(); }
