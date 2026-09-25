// The moored hull's ground ceiling (perf-bakes E2): records the boat's pose every frame at the home mooring (the jetty
// walk, a nudge that makes it settle back and re-measure, and the summit), and on every frame where the contacts were
// skipped checks that testing them would have left the hull where it is. With OLD set, the same runs on the previous
// build must give bit-identical poses. BASE=<this checkout's Vite> [OLD=<previous build's Vite>] node tools/boat-mooring-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const old = process.env.OLD;
const runs = [
  { name: 'jetty', chapter: 'jetty', frames: Number(process.env.FRAMES ?? 2400), nudgeAt: 15 },
  { name: 'summit', chapter: 'summit', frames: Number(process.env.SUMMIT_FRAMES ?? 900) },
];

async function record(browser, url, run, verify) {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${url}?shot&start=1&analytics=0&progress=0&chapter=${run.chapter}`);
  await page.waitForSelector('#veil.ready', { timeout: 180000 }); await page.locator('#begin').click();
  await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
  await page.evaluate(async ({ frames, nudgeAt, verify }) => {
    const island = await import(performance.getEntriesByType('resource')
      .findLast(r => new URL(r.name).pathname === '/src/world/island.ts')?.name ?? '/src/world/island.ts');
    const { tuning } = await import(performance.getEntriesByType('resource')
      .findLast(r => new URL(r.name).pathname === '/src/tuning.ts')?.name ?? '/src/tuning.ts');
    const boat = __game.boat, update = boat.update.bind(boat), contact = boat.contact.clone();
    const log = window.__boatLog = { poses: [], skipped: 0, tested: 0, closest: Infinity, violations: [], measured: 0, ms: [] };
    let measure = boat.measureCeiling?.bind(boat);
    if (measure) boat.measureCeiling = (...a) => { log.measured++; return measure(...a); };
    let nudged = false;
    boat.update = (dt, time) => {
      if (!nudged && time >= nudgeAt) { boat.position.x += 2.4; nudged = true; }
      const started = performance.now();
      update(dt, time);
      log.ms.push(performance.now() - started);
      const q = boat.group.quaternion, p = boat.position;
      log.poses.push([time, p.x, p.y, p.z, q.x, q.y, q.z, q.w, boat.pitch, boat.roll, boat.yaw]);
      if (!verify || !boat.afloat || !boat.grounded || !boat.mooring) return;
      const skipped = boat.clearOfGround();
      skipped ? log.skipped++ : log.tested++;
      if (!skipped) return;
      let supported = -Infinity;
      for (let i = 0; i < boat.hullContacts.count; i++) {
        const c = contact.fromBufferAttribute(boat.hullContacts, i).applyQuaternion(q);
        supported = Math.max(supported, island.heightAt(p.x + c.x, p.z + c.z) - c.y);
      }
      const gap = p.y - (supported + tuning.sail.hullClearance);
      log.closest = Math.min(log.closest, gap);
      if (!(gap > 0)) log.violations.push({ frame: log.poses.length, gap });
    };
    await new Promise(resolve => { const wait = () => log.poses.length >= frames ? resolve() : setTimeout(wait, 200); wait(); });
    boat.update = update;
  }, { frames: run.frames, nudgeAt: run.nudgeAt ?? Infinity, verify });
  const log = await page.evaluate(() => window.__boatLog);
  await context.close();
  return { ...log, errors };
}

const { browser, close } = await openBrowser();
const report = {};
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
try {
  for (const run of runs) {
    const now = await record(browser, base, run, true);
    const entry = report[run.name] = { frames: now.poses.length, skipped: now.skipped, tested: now.tested, measured: now.measured,
      closestGap: now.closest, violations: now.violations.slice(0, 5), errors: now.errors, updateMs: median(now.ms) };
    if (old) {
      const before = await record(browser, old, run, false);
      // Recording starts on whichever frame the page reached; pair frames by game time.
      const at = new Map(before.poses.map(pose => [pose[0], pose]));
      const pairs = now.poses.filter(pose => at.has(pose[0]));
      const first = pairs.find(pose => at.get(pose[0]).some((v, k) => !Object.is(v, pose[k])));
      entry.compared = pairs.length;
      entry.previousUpdateMs = median(before.ms);
      entry.identical = pairs.length > 0.9 * run.frames && !first;
      entry.firstDifference = first ? { old: at.get(first[0]), new: first } : null;
    }
    console.log(JSON.stringify({ run: run.name, ...entry }));
  }
} finally { await close(); }
fs.writeFileSync('/tmp/updraft-boat-mooring.json', JSON.stringify(report, null, 2));
for (const [name, r] of Object.entries(report)) {
  assert.equal(r.errors.length, 0, `${name}: page errors ${r.errors.join('; ')}`);
  assert.equal(r.violations.length, 0, `${name}: a skipped frame's contacts would have lifted the hull`);
  assert(r.skipped > 0, `${name}: the moored hull never skipped its contacts`);
  if (old) assert(r.identical, `${name}: pose differs from the previous build (${r.compared} frames paired) ${JSON.stringify(r.firstDifference)}`);
}
console.log('boat-mooring-check passed');
