// Every room in chapter select: a pick made on a page that loaded a save from another room (the sleeping island's,
// or the meadow's for the sleeping island) must match a fresh `?chapter=<start>` load after 3 s of play at shot's
// fixed steps (`hold` stops both on the same frame): the chapter, its checkpoint, child, boat and cygnet within 1 cm,
// the cygnet's seat and visibility, the glider's visibility and the three life regions.
// Readbacks arrive when the GPU has finished, not on a fixed frame, so a side that misses one plays its next frames
// on older wind and drifts a little: a room that differs is played once more and fails only if it differs again.
// Every line says on which frame the boats parted and on which frames each side missed a readback.
// Usage: node tools/chapter-pick-check.mjs (BASE defaults to http://127.0.0.1:5230/; ONLY=wood,jetty picks rooms).
// Use a QA preview, not a dev server: about a minute a room. Report goes to /tmp/updraft-chapter-pick.json.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const only = process.env.ONLY?.split(',');
const key = 'updraft.progress.v1';
const HOLD = 180;
const CM = 0.01;
const source = fs.readFileSync(new URL('../src/chapter-select/chapter-select.ts', import.meta.url), 'utf8');
const rooms = [...source.matchAll(/\['(\w+)', '([^']+)', new URL/g)].map(m => ({ start: m[1], name: m[2] }));
assert.equal(rooms.length, 12, 'chapter select lists twelve rooms');
const { browser, close } = await openBrowser({ allowAutoplay: false });
const report = { rooms: [] };
const state = () => {
  const g = __game;
  const life = g.life.regions;
  return {
    frame: __stats.frame, name: g.story.name, checkpoint: g.story.current.checkpoint ?? null,
    child: g.child.position.toArray(), boat: g.boat.position.toArray(), cygnet: g.cygnet.position.toArray(),
    seat: g.cygnet.seat, cygnetVisible: g.cygnet.visible, glider: g.glider.visible,
    life: [life.island.toArray(), life.wave.toArray(), life.waiting.toArray()],
    trace: window.__trace,
  };
};
// Per frame: readbacks not delivered on time so far, and where the boat is; shows where two sides part.
const trace = hold => {
  window.__trace = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(now => {
    cb(now);
    const s = window.__stats;
    if (s?.frame > window.__trace.length && s.frame <= hold) window.__trace.push([s.readbacksSkipped + s.readbacksHeld + s.readbacksForced, ...window.__game.boat.position.toArray()]);
  });
};
const held = page => page.waitForFunction(hold => window.__stats?.frame >= hold, HOLD, { timeout: 120000 });
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

async function compare(start, name, from, saves) {
  const entry = { room: start, from };
  const errors = [];

  const fresh = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await fresh.addInitScript(trace, HOLD);
  const freshPage = await fresh.newPage();
  freshPage.on('pageerror', e => errors.push(`fresh: ${e.message}`));
  await freshPage.goto(`${base}?shot&chapter=${start}&hold=${HOLD}`);
  await held(freshPage);
  entry.fresh = await freshPage.evaluate(state);
  await fresh.close();

  const picked = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: { cookies: [], origins: [{ origin: new URL(base).origin, localStorage: [
      { name: key, value: JSON.stringify(saves[from]) }, { name: 'updraft.finished.v1', value: '1' }] }] },
  });
  await picked.addInitScript(trace, HOLD);
  const page = await picked.newPage();
  page.on('pageerror', e => errors.push(`pick: ${e.message}`));
  await page.goto(`${base}?shot&start=1&progress=1&hold=${HOLD}`);
  await page.waitForSelector('#veil.ready', { timeout: 90000 });
  await page.waitForTimeout(950);
  await page.locator('#sound').evaluate(button => { if (button.dataset.on === 'false') button.click(); });
  let navigations = 0;
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).chapter, key), saves[from].chapter, "the page loaded the other room's save");
  await page.locator('.chapters-toggle').click();
  await page.locator('.chapter', { hasText: name }).click();
  entry.atClick = await page.evaluate(() => __game.story.name);
  await held(page);
  entry.pick = await page.evaluate(state);
  entry.navigations = navigations;
  await picked.close();

  const a = entry.pick, b = entry.fresh;
  entry.metres = { child: distance(a.child, b.child), boat: distance(a.boat, b.boat), cygnet: distance(a.cygnet, b.cygnet) };
  entry.lifeDelta = Math.max(...a.life.flatMap((v, i) => v.map((x, j) => Math.abs(x - b.life[i][j]))));
  const differs = [];
  if (navigations) differs.push(`${navigations} navigations`);
  if (entry.atClick !== b.name) differs.push(`story at the click ${entry.atClick}, fresh ${b.name}`);
  for (const field of ['frame', 'name', 'checkpoint', 'seat', 'cygnetVisible', 'glider'])
    if (a[field] !== b[field]) differs.push(`${field} ${a[field]} vs ${b[field]}`);
  for (const [part, metres] of Object.entries(entry.metres))
    if (!(metres <= CM)) differs.push(`${part} ${(metres * 100).toFixed(2)} cm apart`);
  if (entry.lifeDelta !== 0) differs.push(`life regions differ by ${entry.lifeDelta}`);
  differs.push(...errors);
  entry.differs = differs;
  const late = t => t.flatMap((f, i) => (f[0] > (t[i - 1]?.[0] ?? 0) ? [i + 1] : []));
  const parted = a.trace.findIndex((f, i) => distance(f.slice(1), b.trace[i].slice(1)) > 1e-5) + 1;
  entry.evidence = { boatsPartOnFrame: parted || null, lateReadbackFrames: { pick: late(a.trace), fresh: late(b.trace) } };
  delete a.trace;
  delete b.trace;
  const { pick: lp, fresh: lf } = entry.evidence.lateReadbackFrames;
  console.log(`${start.padEnd(9)} from ${from.padEnd(8)} ${b.name}/${b.checkpoint}  child ${(entry.metres.child * 100).toFixed(3)} cm  boat ${(entry.metres.boat * 100).toFixed(3)} cm  cygnet ${(entry.metres.cygnet * 100).toFixed(3)} cm  ${differs.length ? 'DIFFERS: ' + differs.join('; ') : 'same'}  (boats part on frame ${parted || 'none'}; late readbacks pick [${lp}] fresh [${lf}])`);
  return entry;
}

try {
  const saves = {};
  for (const room of ['sleeping', 'meadow']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${base}?shot&progress=1&chapter=${room}`);
    saves[room] = await page.waitForFunction(([key, room]) => {
      const save = JSON.parse(localStorage.getItem(key) ?? 'null');
      return save?.chapter === room && save;
    }, [key, room], { timeout: 90000 }).then(h => h.jsonValue());
    await context.close();
  }

  const failed = [];
  for (const { start, name } of rooms.filter(r => !only || only.includes(r.start))) {
    const from = start === 'sleeping' ? 'meadow' : 'sleeping';
    const attempts = [await compare(start, name, from, saves)];
    if (attempts[0].differs.length) attempts.push(await compare(start, name, from, saves));
    report.rooms.push({ room: start, attempts });
    if (attempts.at(-1).differs.length) failed.push(`${start}: ${attempts.map(a => a.differs.join('; ')).join(' / then ')}`);
  }
  assert.deepEqual(failed, [], 'a pick matches a fresh ?chapter= load');
  const again = report.rooms.filter(r => r.attempts.length > 1).map(r => r.room);
  console.log(`chapter pick ok: ${report.rooms.length} rooms${again.length ? `; played twice: ${again.join(', ')}` : ''}`);
} finally {
  fs.writeFileSync('/tmp/updraft-chapter-pick.json', JSON.stringify(report, null, 2));
  await close();
}
