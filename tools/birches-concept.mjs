// STAGING (birches-uplift-concept): concept stills for the fallen birch under the swing and round 3's row of heaps.
// Poses the birches room by hand (the story's own update is stood down) and takes stills through the lens each beat
// would use. Not a check and not the build.
// Usage: BASE=http://127.0.0.1:5249/ node tools/birches-concept.mjs <out-dir> <landscape|portrait> <scene> [scene...]
import { openBrowser } from './lib/browser.mjs';
import fs from 'node:fs';

const [outDir, orientation = 'landscape', ...scenes] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:5249/';
const [W, H] = orientation === 'portrait' ? [900, 1600] : [1600, 900];
fs.mkdirSync(outDir, { recursive: true });

/** Waits for the shared browser lock as closely as the next job does, then takes it through `openBrowser`. */
for (const lock = '/tmp/updraft-chromium.lock'; fs.existsSync(lock);) await new Promise((r) => setTimeout(r, 25));
const { browser, close } = await openBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.goto(`${base}?shot=1&chapter=birches${process.env.QUERY ? '&' + process.env.QUERY : ''}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await page.evaluate(async () => {
    const [rounds, world, layout, scarf, island, concept] = await Promise.all([import('/src/story/birches-rounds.ts'), import('/src/world/birches.ts'),
      import('/src/world/birches-layout.ts'), import('/src/world/birch-scarf.ts'), import('/src/world/island.ts'), import('/src/story/birches-concept.ts')]);
    window.__sq = { ...rounds, ...world, ...layout, SCARF_SNAGS: scarf.SCARF_SNAGS, heightAt: island.heightAt, ...concept };
    window.__screen = (p) => { const v = p.clone().project(__game.rig.camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; };
  });
  await page.waitForTimeout(2500);
  for (const scene of scenes) {
    const [name, arg] = scene.split(':');
    const stage = await page.evaluate(({ name, arg }) => __sq.stageScene(__game, name, arg), { name, arg });
    if (stage === -1) continue;
    if (typeof stage === 'object' && stage) {
      try { await page.waitForFunction(stage.until, null, { timeout: stage.timeout ?? 60000, polling: 50 }); }
      catch { console.log(name, 'never got there:', JSON.stringify(await page.evaluate(() => ({ action: __game.child.action?.kind ?? null, frozen: __sq.isFrozen(), report: __sq.sceneReport(__game) })))); }
      await page.waitForTimeout(stage.after ?? 0);
    } else await page.waitForTimeout(stage ?? 2500);
    const report = await page.evaluate(({ name }) => __sq.sceneReport?.(__game, name), { name });
    if (report) console.log(name, JSON.stringify(report));
    await page.screenshot({ path: `${outDir}/${(process.env.TAG ?? '') + scene.replace(':', '-')}-${orientation}.png` });
  }
} finally {
  if (errors.length) console.log('errors:', errors.slice(0, 5).join('\n'));
  await close();
}
