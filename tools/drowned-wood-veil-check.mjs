// Compare the rendered rock with the same frozen view with its mesh absent.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const prefix = process.argv[2] ?? '/tmp/updraft-wood-veil';
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 700 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    const next = window.requestAnimationFrame.bind(window);
    window.__nativeRAF = next;
    window.requestAnimationFrame = callback => next(t => { if (!window.__freeze) callback(t); });
  });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=drowned&ratio=1`);
  await page.waitForFunction(() => window.__ready && __stats.time > 9, null, { timeout: 90000 });
  await page.evaluate(() => { window.__freeze = true; });
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.requestAnimationFrame = __nativeRAF; });
  const visible = await page.evaluate(() => __game.wood.shape.mesh.visible);
  assert(visible, 'the rock is within the world draw range, so the veil must conceal it');
  await page.screenshot({ path: `${prefix}-after.png` });
  await page.evaluate(() => {
    const material = __game.wood.shape.mesh.material;
    window.__rockShader = material.fragmentShader;
    material.fragmentShader = material.fragmentShader.replace('float cover = mix(0.45, 1.0, journeyVeilAt(vWorld));', 'float cover = 0.45;');
    material.needsUpdate = true;
    __game.post.render(__stats.time);
  });
  await page.screenshot({ path: `${prefix}-before.png` });
  await page.evaluate(() => {
    __game.wood.shape.mesh.material.visible = false;
    __game.post.render(__stats.time);
  });
  await page.screenshot({ path: `${prefix}-absent.png` });
  const result = JSON.parse(execFileSync('python3', ['-c', `
import json, sys
from PIL import Image
p=sys.argv[1]
a,b,c=[Image.open(p+'-'+name+'.png').convert('RGB') for name in ['before','after','absent']]
errors=[]
for old,new,empty in zip(a.getdata(),b.getdata(),c.getdata()):
    if max(abs(x-y) for x,y in zip(old,empty))>12:
        errors.append(max(abs(x-y) for x,y in zip(new,empty)))
print(json.dumps({'revealedPixels':len(errors),'remainingMean':sum(errors)/max(1,len(errors)),'remainingMax':max(errors,default=0)}))
`, prefix], { encoding: 'utf8' }));
  console.log(result);
  assert(result.revealedPixels > 30, 'negative control must show the woodland silhouette');
  assert(result.remainingMean < 2, 'the rock must blend into the same view without its mesh');
} finally { await close(); }
