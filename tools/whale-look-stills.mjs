// Stills of the dream-sized whale beside the concept paintings it is judged against
// (docs/backlog/path-puzzles/comps/crossings/whale-net/), for the whale's look.
// Usage: BASE=http://127.0.0.1:5230/ node tools/whale-look-stills.mjs <out-prefix> [shots] [orientations]
//   shots: comma list of k1, k2, k3, k4, k5, dive (default all); orientations: land (1600×900), port (430×932) (default both).
//   Writes <prefix>-<shot>-<orientation>.png and <prefix>-compare-<shot>-<orientation>.jpg (concept left, game right).
//   k1: the open sea (`?chapter=sea`) as the pod leads the boat in, `K1_LEFT` metres short of the rest (default 24).
//   k2: at rest (`?chapter=whale`); `k2-shut` before its eye opens, then `k2` with it open on the child (`look`).
//   k3: resumed after its breath, the cork swept in with real strokes and the still taken mid-haul.
//   k4: resumed after the line, held for the flipper until the camera has come round.
//   k5: freed from rest (`goTo('free')`), `k5` at the spout and `k5-flukes` as they wave.
//   dive: the first crossing (`?chapter=toLines`), its flukes at their highest as it dives far off, when it comes.
// Traps:
//   - k1 sails the open sea from the start (about 80 s) and dive waits for the crossing's sighting (about 45 s): a
//     full set takes about six minutes, so pass only the shots needed.
//   - The browser lock is shared with every capture tool: a run may wait for another session's capture first.
//   - k5 skips the net's steps, so whatever those steps leave on the water is not in the frame.
//   - k3 and k4 resume a save in the running page (`restoreCheckpoint`), as the net check does.
//   - Run it against your own dev server: a server that hot-reloads mid-capture yields a frame of the start screen.
//   - Portrait shots are composed beside `k2-portrait` for k2 and beside the landscape painting otherwise.
//   - The whale breathes and the swell runs, so the same shot moves a little from run to run: compare the read,
//     not pixels. k2 waits five seconds at rest first so the hold has settled.
//   - In portrait the first crossing's camera does not turn to the far whale, so `dive-port` shows only haze.
//   - A frame-rate step-down mid-run (another session's capture on the GPU) shows as `pairs` in the printed stats:
//     render-target pairs at the lower sample count, not new programs. Rerun on a quiet machine.
import { openBrowser } from './lib/browser.mjs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [prefix, shotList = 'k1,k2,k5,dive', orientList = 'land,port'] = process.argv.slice(2);
if (!prefix) {
  console.error('usage: node tools/whale-look-stills.mjs <out-prefix> [k1,k2,k5,dive] [land,port]');
  process.exit(1);
}
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const k1Left = Number(process.env.K1_LEFT ?? 24);
const comps = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/backlog/path-puzzles/comps/crossings/whale-net');
const SIZES = { land: [1600, 900], port: [430, 932] };
const CONCEPT = { k1: 'k1-island', k2: 'k2-the-breath', 'k2-shut': 'k2-the-breath', k3: 'k3-the-child', k4: 'k4-the-cygnet',
  k5: 'k5-free', 'k5-flukes': 'k5-free', dive: 'k1-island' };

const STARTS = {
  k1: 'sea',
  k2: 'whale',
  k3: 'whale',
  k4: 'whale',
  k5: 'whale',
  dive: 'toLines',
};

async function waitFor(page, test, arg, seconds) {
  await page.waitForFunction(test, arg, { timeout: seconds * 1000, polling: 200 });
}

const atRest = (page) => waitFor(page, () => {
  const w = __game.story.current.whale;
  return w && w.step === 'breath' && w.stepTime > 1.2;
}, null, 120);

/** Each shot's moments: its own frames, named, taken from one page. */
const SHOOT = {
  async k1(page, snap) {
    await waitFor(page, (left) => {
      const w = __game.story.current.whale;
      return w && w.led && w.remaining() < left;
    }, k1Left, 240);
    await snap('k1');
  },
  async k2(page, snap) {
    await atRest(page);
    await page.waitForTimeout(5000);
    await snap('k2-shut');
    await page.evaluate(() => __game.sealife.sleeper.look(__game.child.position));
    await page.waitForTimeout(4000);
    await snap('k2');
  },
  async k3(page, snap) {
    await atRest(page);
    await page.evaluate(() => { const c = __game.story.current; c.restoreCheckpoint('whale-breath', [c.leg, c.time]); });
    await waitFor(page, () => __game.story.current.whale.stepTime > 6, null, 30);
    const view = page.viewportSize();
    for (let i = 0; i < 12; i++) {
      if (await page.evaluate(() => __game.story.current.whale.haul !== 'out')) break;
      const [cx, cy, bx, by] = await page.evaluate(() => {
        const s = (v) => { const p = v.clone().project(__game.rig.camera); return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight]; };
        return [...s(__game.sealife.net.float.position), ...s(__game.boat.position)];
      });
      const d = Math.hypot(bx - cx, by - cy) || 1, reach = view.height * 0.14;
      await page.mouse.move(cx - ((bx - cx) / d) * reach, cy - ((by - cy) / d) * reach);
      for (let k = 1; k <= 24; k++) {
        const f = -1 + (k / 24) * 2.3;
        await page.mouse.move(cx + ((bx - cx) / d) * reach * f, cy + ((by - cy) / d) * reach * f);
        await page.waitForTimeout(10);
      }
      await page.mouse.move(view.width - 5, view.height - 5);
      await page.waitForTimeout(1200);
    }
    await waitFor(page, () => __game.story.current.whale.hauledIn >= 1.8, null, 40);
    await snap('k3');
  },
  async k4(page, snap) {
    await atRest(page);
    // Held at the start of the flipper (its stand-in plays through in a few seconds) while the camera comes round.
    await page.evaluate(() => { const c = __game.story.current; c.restoreCheckpoint('whale-line', [c.leg, c.time]); c.whale.stepTime = -6; });
    await page.waitForTimeout(6000);
    await snap('k4');
  },
  async k5(page, snap) {
    await atRest(page);
    await page.evaluate(() => __game.story.current.whale.goTo('free'));
    await waitFor(page, () => __game.sealife.sleeper.time > 5.6, null, 60);
    await snap('k5');
    await waitFor(page, () => __game.sealife.sleeper.time > 16.5, null, 60);
    await snap('k5-flukes');
  },
  async dive(page, snap) {
    await waitFor(page, () => __game.sealife.body.time > 9.2 && __game.sealife.body.time < 20, null, 240);
    await snap('dive');
  },
};

function compare(shot, orient, game, out, height) {
  const concept = path.join(comps, `${orient === 'port' && shot === 'k2' ? 'k2-portrait' : CONCEPT[shot]}.jpg`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', concept, '-i', game, '-filter_complex',
    `[0]scale=-2:${height}[a];[1]scale=-2:${height}[b];[a][b]hstack=inputs=2`, '-q:v', '3', out]);
}

const { browser, close } = await openBrowser();
try {
  for (const orient of orientList.split(',')) {
    const [width, height] = SIZES[orient];
    for (const shot of shotList.split(',')) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${base}?shot=1&chapter=${STARTS[shot]}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
      const snap = async (name) => {
        const file = `${prefix}-${name}-${orient}.png`;
        await page.screenshot({ path: file });
        compare(name, orient, file, `${prefix}-compare-${name}-${orient}.jpg`, orient === 'port' ? 932 : 600);
        console.log(file);
      };
      await SHOOT[shot](page, snap);
      const stats = await page.evaluate(() => ({ stray: __stats.bootStrayPrograms, first: __stats.playFirstDraws }));
      if (stats.stray?.count || stats.first?.programs || stats.first?.pairs) console.log(`${shot}-${orient}: ${JSON.stringify(stats)}`);
      if (errors.length) console.log(`${shot}-${orient} errors: ${errors.join(' | ')}`);
      await context.close();
    }
  }
} finally {
  await close();
}
