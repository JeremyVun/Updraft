// BASE selects the dev server; CHAPTER, W/H, DSF and SECONDS select one fixed view and sample length. TIME freezes fog motion for comparisons.
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const out = process.argv[2];
if (!out) throw new Error('Usage: node tools/drowned-perf.mjs <output-directory>');
fs.mkdirSync(out, { recursive: true });
const chapter = process.env.CHAPTER ?? 'belfry';
const seconds = Number(process.env.SECONDS ?? 8);
const { browser, close } = await openBrowser();
const errors = [], results = [];
try {
  const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1600), height: Number(process.env.H ?? 900) },
    deviceScaleFactor: Number(process.env.DSF ?? 2) });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=${chapter}&villagefog=${process.env.FOG ?? '1'}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.evaluate(async fixedTime => {
    const url = performance.getEntriesByType('resource').findLast(r => new URL(r.name).pathname === '/src/world/atmosphere.ts').name;
    const { atmo } = await import(url);
    __game.story.current.update = () => {};
    const render = __game.renderer.render.bind(__game.renderer);
    window.__perfFogOff = false;
    __game.renderer.render = (...args) => {
      const strength = atmo.uniforms.uSeaFogShape.value.w, time = atmo.uniforms.uTime.value;
      if (fixedTime !== null) atmo.uniforms.uTime.value = fixedTime;
      if (window.__perfFogOff) atmo.uniforms.uSeaFogShape.value.w = 0;
      try { return render(...args); }
      finally { atmo.uniforms.uSeaFogShape.value.w = strength; atmo.uniforms.uTime.value = time; }
    };
  }, process.env.TIME ? Number(process.env.TIME) : null);
  const cases = process.env.CASES?.split(',') ?? ['ultra', 'low', 'ultra-no-fog', 'ultra-no-reflection', 'ultra-no-post', 'ultra'];
  for (const name of cases) {
    await page.evaluate(name => {
      const { quality, water, post } = __game;
      quality.setMode('low', performance.now());
      quality.setMode(name === 'low' ? 'low' : 'ultra', performance.now());
      window.__perfFogOff = name === 'ultra-no-fog';
      water.seaReflection = name !== 'low' && name !== 'ultra-no-reflection';
      post.setBloom(name === 'low' || name === 'ultra-no-post' ? 'off' : 'full', true);
      post.setDepthBlur(name !== 'low' && name !== 'ultra-no-post', true);
    }, name);
    await page.waitForTimeout(3500);
    const result = await page.evaluate(seconds => new Promise(resolve => {
      const times = [];
      let first = null, last = null;
      const tick = t => {
        first ??= t;
        if (last !== null) times.push(t - last);
        last = t;
        if (t - first < seconds * 1000) return requestAnimationFrame(tick);
        times.sort((a, b) => a - b);
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        resolve({ frames: times.length, fps: 1000 / mean, mean, p50: times[Math.floor(times.length * .5)],
          p95: times[Math.floor(times.length * .95)], over25: times.filter(t => t > 25).length / times.length,
          quality: __game.quality.level, stats: __stats });
      };
      requestAnimationFrame(tick);
    }), seconds);
    results.push({ name, chapter, ...result });
    console.log(JSON.stringify(results.at(-1)));
    if (name === 'ultra' || name === 'low') await page.screenshot({ path: `${out}/${chapter}-${name}.png` });
    fs.writeFileSync(`${out}/${chapter}.json`, JSON.stringify({ results, errors }, null, 2));
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await close();
}
