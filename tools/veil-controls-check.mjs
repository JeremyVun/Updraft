// Shared controls must work before the game module loads, without starting play or audio.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
async function choose(page, mode) {
  await page.locator('#quality').click();
  await page.locator(`#quality-menu [data-mode="${mode}"]`).click();
}
const errors = [];
try {
  const page = await browser.newPage({viewport:{width:1100,height:700}});
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.__audio = [];
    window.AudioContext = class extends Native { constructor(...args) { super(...args); window.__audio.push(this); } };
  });
  await page.route('**/@vite/client', r => r.fulfill({contentType:'application/javascript',body:''}));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/src/main.ts*', async route => {
    await gate;
    const response = await route.fetch(), body = await response.text();
    // Expose probes without enabling shot mode's hidden controls/fixed clock.
    assert.equal((body.match(/if \(params.shot\) \{/g) ?? []).length, 2);
    await route.fulfill({response,body:body.replaceAll('if (params.shot) {','if (true) {')});
  });
  await page.goto(base+'?analytics=0&progress=0');
  await page.waitForFunction(() => document.querySelector('#sound').dataset.on === 'true');
  for(const selector of ['#sound','#fullscreen','#quality'])assert(await page.locator(selector).isVisible());
  await page.locator('#sound').click();
  await choose(page, 'high');
  assert.equal(await page.locator('#sound').getAttribute('data-on'),'false');
  assert.equal(await page.evaluate(() => __audio.length),0);
  assert.equal(await page.locator('#begin').isEnabled(),false);
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  assert(await page.locator('#veil').isVisible());
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.screenshot({path:'/tmp/updraft-veil-controls-loading.png'});
  release();
  await page.waitForSelector('#veil.ready',{timeout:90000});
  assert.equal(await page.evaluate(() => __game.quality.mode),'high');
  assert.equal(await page.evaluate(() => __game.quality.level.detail),2);
  assert.equal(await page.evaluate(() => __audio.length),0);
  await choose(page, 'medium');
  assert.equal(await page.evaluate(() => __game.quality.level.detail),1);
  await page.locator('#sound').click(); await page.locator('#sound').click();
  assert.equal(await page.evaluate(() => __audio.length),0,'ready veil must remain silent');
  assert.equal(await page.locator('#veil').evaluate(e=>e.classList.contains('departing')),false);
  await page.locator('#quality').blur();
  await page.screenshot({path:'/tmp/updraft-veil-controls-ready.png'});
  await page.locator('#begin').click();
  await page.waitForSelector('#veil',{state:'detached'});
  assert.equal(await page.locator('#sound').getAttribute('data-on'),'false','Begin respects mute');
  assert.equal(await page.evaluate(() => __audio.length),0);
  await page.locator('#sound').click();
  await page.waitForFunction(() => __audio.length===1 && __audio[0].state==='running');
  await page.close();
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await phone.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await phone.route('**/src/main.ts*',r=>r.fulfill({contentType:'application/javascript',body:'await new Promise(() => {});'}));
  await phone.goto(base+'?analytics=0&progress=0');
  await phone.waitForFunction(() => document.querySelector('#sound').dataset.on==='true');
  await phone.locator('#sound').tap();
  await choose(phone, 'low');
  assert.equal(await phone.locator('#sound').getAttribute('data-on'),'false');
  assert.equal(await phone.locator('#begin').isEnabled(),false);
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth),390);
  await phone.locator('#quality').blur();
  await phone.screenshot({path:'/tmp/updraft-veil-controls-phone.png'});
  assert.deepEqual(errors,[]);
  console.log('Veil controls passed: loading-time mute/quality/fullscreen, no accidental Begin, queued quality, silent startup, mute retained on entry, in-game unmute and phone touch.');
} finally { await close(); }
