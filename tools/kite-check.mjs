// Departure fixtures in the game renderer, using each chapter's own boarding camera.
// node tools/kite-check.mjs [prefix]; TOUCH=1 for 390x844, ONLY=island,wood to select rooms.
// SOFTWARE=1 uses a separate software WebGL runner when the shared GPU runner is occupied.
// Fixtures skip the preceding story; output includes framing/ground checks and screenshots in /tmp.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const software = process.env.SOFTWARE === '1';
const lock = software ? '/tmp/updraft-chromium-software.lock' : '/tmp/updraft-chromium.lock';
let browser;
function releaseLock() {
  try {
    if (Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true });
  } catch {}
}
process.on('exit', releaseLock);
process.on('SIGINT', async () => { await browser?.close(); process.exit(130); });
process.on('SIGTERM', async () => { await browser?.close(); process.exit(143); });

for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let holder = 0;
    try { holder = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    let alive = true;
    if (holder) { try { process.kill(holder, 0); } catch { alive = false; } }
    if (holder && !alive) fs.rmSync(lock, { recursive: true, force: true });
    else await new Promise(resolve => setTimeout(resolve, 400));
  }
}
console.log(`${software ? 'Software' : 'GPU'} capture lock acquired`);
const prefix = process.argv[2] ?? '/tmp/updraft-kites';
const portrait = process.env.TOUCH === '1';
const viewport = portrait ? { width: 390, height: 844 } : { width: 1200, height: 800 };
const report = [], errors = [];
try {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-gpu', software ? '--use-angle=swiftshader' : '--use-angle=metal', ...(software ? ['--enable-unsafe-swiftshader'] : []), '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
  const settle = async ms => {
    if (!software) { await page.waitForTimeout(ms); return; }
    // Settle the CPU kite simulation without paying for hundreds of software-rendered frames.
    // This uses the live field sampled at the fixture, with no synthetic gusts.
    await page.evaluate(() => {
      const g = __game;
      for (let i = 0; i < 240; i++) g.departureKites.update(1 / 60, i / 60, g.rig.camera, g.story);
    });
    const frame = await page.evaluate(() => __stats.frame);
    await page.waitForFunction(frame => __stats.frame >= frame + 2, frame, { timeout: 90000 });
  };
  const cases = [
    ['island', '', 8.5, 21.5, .95], ['lines', 'washing', 240, -483.5, .1],
    ['boats', 'boats', 353, -652, Math.PI], ['meadow', 'meadow', -2 / 3, -974 - 2 / 3, .2],
    ['birches', 'birches', -4, -1197, .15], ['wood', 'wood', -34, -1908, .2],
    ['sleeping', 'sleeping', -214.5, -1926, -1.76], ['mirror', 'mirror', -390, -2323, Math.PI],
  ].filter(([name]) => !process.env.ONLY || process.env.ONLY.split(',').includes(name));
  for (const [name, query, x, z, yaw] of cases) {
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=${query}${process.env.QUERY ? '&' + process.env.QUERY : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(software => software ? window.__stats?.frame >= 2 : window.__ready, software, { timeout: 120000 }).catch(async error => {
      await page.screenshot({ path: `${prefix}-${name}-startup.png` }); throw error;
    });
    await page.waitForTimeout(400);
    const arrival = await page.evaluate(() => Object.entries(__game.departureKites.markers).filter(([, k]) => k.group.visible).map(([n]) => n));
    if (['boats', 'wood', 'sleeping'].includes(name)) assert.deepEqual(arrival, [], `${name}: arrival does not advertise an unavailable exit`);
    if (name === 'mirror') {
      for (const [mask, target] of [[0, 0], [1, 1], [3, 2]]) {
        await page.evaluate(({ mask, target }) => {
          const g = __game, c = g.story.current;
          c.restoreCheckpoint(`stars-${mask}`, [mask, target]); c.update(0, 0); g.rig.cut(c.shot);
          g.story.update = () => {};
        }, { mask, target });
        await settle(1800);
        const marker = await page.evaluate(() => {
          const k = __game.departureKites.markers.mirror;
          return { visible: k.group.visible, screen: k.position.clone().project(__game.rig.camera).toArray() };
        });
        console.log(`mirror-stars-${mask}`, JSON.stringify(marker));
        assert(marker.visible && Math.abs(marker.screen[0]) < .95 && Math.abs(marker.screen[1]) < .95,
          `mirror stars-${mask}: the kite remains inside the star-play view`);
        await page.screenshot({ path: `${prefix}-mirror-stars-${mask}.png` });
      }
    }
    await page.evaluate(({ name, x, z, yaw }) => {
      const g = __game, c = g.story.current;
      g.child.stop(); g.child.standUp(); g.child.dismount();
      g.boat.beach(x, z, yaw); g.boat.grounded = true;
      g.child.place(name === 'sleeping' ? x + 20 : x, name === 'sleeping' ? z : name === 'island' ? z - 12 : z + 20, Math.PI);
      g.cygnet.visible = true; g.cygnet.rideIn('cradle'); g.cygnet.seating.snap();
      g.glider.hold(g.child);
      if (name === 'island') { c.breeze = 1; c.worldLife = 1; g.life.regions.island.w = 1; }
      if (name === 'lines') c.restoreCheckpoint('family', [0, 1]);
      if (name === 'boats') {
        g.littleBoats.restore(96); c.beat = 'reveal';
        const bank = g.child.position.clone(); c.bankAt(94, bank); g.child.place(bank.x, bank.z, Math.PI);
      }
      else c.beat = 'toBoat';
      if (name === 'wood') { c.storm = 0; c.dusk = 1.05; }
      if (name === 'sleeping') {
        c.dusk = 1.02; c.haze = .6;
        g.sleeping.dawn = g.sleeping.curtains = g.sleeping.laneOpen = 1;
        g.sleeping.fog = g.sleeping.frost = 0;
      }
      if (name === 'mirror') {
        // Resume a real completed-star checkpoint: the reveal precedes the walk and boat arrival.
        c.restoreCheckpoint('stars-7', [7, 2]); c.update(0, 0);
      }
      c.frame(); g.rig.cut(c.shot);
      // Keep the authored departure shot and actors still while the live wind animates the kite.
      g.story.update = () => {};
    }, { name, x, z, yaw });
    await settle(2600);
    const result = await page.evaluate(name => {
      const g = __game, k = g.departureKites.markers[name], p = k.position.clone().project(g.rig.camera);
      const b = g.boat.position.clone().project(g.rig.camera);
      const visible = Object.entries(g.departureKites.markers).filter(([, k]) => k.group.visible).map(([n]) => n);
      const positions = Object.values(g.departureKites.markers).map(k => k.position);
      return { name, visible, independent: new Set(positions).size === positions.length,
        anchor: k.tieOff.toArray(), ground: k.tieOff.y - 1.05, position: k.position.toArray(),
        screen: p.toArray(), boatScreen: b.toArray(), camera: g.rig.camera.position.toArray() };
    }, name);
    await page.screenshot({ path: `${prefix}-${name}.png` });
    report.push(result); console.log(JSON.stringify(result));
    assert(result.independent, 'kites must not share their simulated position');
    assert(Math.abs(result.screen[0]) < .98 && Math.abs(result.screen[1]) < .98,
      `${name}: the departure kite must remain on screen`);
    assert.deepEqual(result.visible, [name], 'only this departure is marked');
    if (name === 'mirror') {
      await page.evaluate(() => {
        const g = __game, c = g.story.current;
        g.child.stop(); g.child.place(-399, -2323, Math.PI / 2);
        g.boat.beach(-390, -2323, Math.PI); g.boat.mooring = { x: -390, z: -2323, yaw: Math.PI };
        c.beat = 'jetty'; c.frame(); g.rig.cut(c.shot);
      });
      await settle(1800);
      await page.screenshot({ path: `${prefix}-mirror-jetty.png` });
      console.log('mirror-jetty', await page.evaluate(() => __game.departureKites.markers.mirror.position.clone().project(__game.rig.camera).toArray()));
    }
  }
  fs.writeFileSync(`${prefix}.json`, JSON.stringify({ viewport, report, errors }, null, 2));
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  releaseLock();
}
