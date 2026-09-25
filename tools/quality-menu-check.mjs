// DOM-only custom menu checks; no WebGL load or shared GPU lock needed.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
try {
  for(const [name,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]) {
    const page=await browser.newPage({viewport,...(name==='phone'?{hasTouch:true,isMobile:true,deviceScaleFactor:2}:{})});
    await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
    await page.route('**/src/main.ts*',r=>r.fulfill({contentType:'application/javascript',body:'await new Promise(()=>{});'}));
    await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?analytics=0&progress=0');
    await page.evaluate(async()=>{
      // Reuse Vite's loaded URLs, including its cache-busting query. A second URL
      // would instantiate another controller and double-bind the same buttons.
      const loaded = path => performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname===path).name;
      const {startScreen}=await import(loaded('/src/start-screen.ts'));
      const {controls}=await import(loaded('/src/controls.ts'));
      window.__begins=0;window.__choices=[];
      startScreen.ready(()=>window.__begins++);
      controls.onQualityChange=mode=>window.__choices.push(mode);
    });
    await page.waitForTimeout(900);
    const open=async()=>{if(name==='phone')await page.locator('#quality').tap();else await page.locator('#quality').click()};
    await open();
    assert.equal(await page.locator('#quality').getAttribute('aria-expanded'),'true');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.mode),'auto');
    await page.screenshot({path:`/tmp/updraft-quality-menu-${name}.png`});
    const box=await page.locator('#quality-menu').boundingBox();
    assert(box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0);
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    assert.equal(await page.locator('#quality').getAttribute('aria-expanded'),'false');
    assert.equal(await page.evaluate(()=>localStorage.getItem('updraft.quality.v1')),'high');
    assert.deepEqual(await page.evaluate(()=>__choices),['high']);
    await open();await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'quality');
    await open();
    await page.locator('#quality-dismiss').click({position:{x:20,y:20}});
    assert.equal(await page.evaluate(()=>__begins),0,'outside dismissal must not enter the game');
    await open();const sound=await page.locator('#sound').getAttribute('data-on');
    await page.keyboard.press('m');await page.keyboard.press('Enter');
    assert.equal(await page.locator('#sound').getAttribute('data-on'),sound);
    assert.equal(await page.evaluate(()=>localStorage.getItem('updraft.quality.v1')),'medium');
    await open();await page.keyboard.press('Tab');
    assert.equal(await page.locator('#quality-menu').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'sound');
    await open();
    if(name==='phone')await page.locator('[data-mode="low"]').tap();
    else await page.locator('[data-mode="low"]').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('updraft.quality.v1')),'low');
    assert.equal(await page.locator('[data-mode="low"]').getAttribute('aria-checked'),'true');
    assert.equal(await page.evaluate(()=>__begins),0);
    await open();await page.locator('[data-mode="auto"]').click();
    await page.evaluate(async()=>{
      const url = performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname==='/src/controls.ts').name;
      const {controls}=await import(url);
      const {Quality}=await import('/src/gl/quality.ts');
      const governor=new Quality(1,2,800,600,false,level=>controls.setQualityDetail(level.detail));
      controls.setQualityDetail(governor.level.detail);
      window.__governor=governor;
    });
    assert.equal(await page.locator('#quality').getAttribute('data-quality'),'high');
    await page.evaluate(()=>{
      __governor.reset(0);
      for(let t=0;t<16000;t+=40)__governor.frame(t,40);
    });
    assert.equal(await page.locator('#quality').getAttribute('data-quality'),'low');
    assert.equal(await page.locator('#quality').getAttribute('title'),'Graphics quality: Auto (Low)');
    assert.equal(await page.locator('[data-mode="auto"]').getAttribute('aria-checked'),'true');
    await page.evaluate(()=>{
      for(let t=16000;t<120000;t+=1000/60)__governor.frame(t,1000/60);
    });
    assert.equal(await page.locator('#quality').getAttribute('data-quality'),'high');
    assert.equal(await page.locator('#quality').getAttribute('title'),'Graphics quality: Auto (High)');
    await open();
    await page.screenshot({path:`/tmp/updraft-quality-menu-${name}.png`});
    await page.close();
  }
  console.log('Custom quality menu passed: desktop/phone layout, selection callbacks and persistence, arrows/type-ahead, Escape/Tab, touch and safe outside dismissal.');
} finally {await browser.close()}
