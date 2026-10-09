// Stills of the dream-sized whale beside the concept paintings it is judged against
// (docs/backlog/path-puzzles/comps/crossings/whale-net/), for the whale's look.
// Usage: BASE=http://127.0.0.1:5230/ node tools/whale-look-stills.mjs <out-prefix> [shots] [orientations]
//   shots: comma list of k1, k2, eye, k3, heave, k4, k5, dive (default k1, k2, k5, dive); orientations: land (1600×900),
//   port (430×932) (default both).
//   Writes <prefix>-<shot>-<orientation>.png and <prefix>-compare-<shot>-<orientation>.jpg (concept left, game right).
//   k1: the open sea (`?chapter=sea`) as the pod leads the boat in, `K1_LEFT` metres short of the rest (default 24).
//   k2: at rest (`?chapter=whale`); `k2-shut` before it breathes, then `k2` circled at its blowhole with real
//     strokes until the patch is up and it has drawn its first full breath, its eye still shut under the fold.
//   eye: resumed after its breath, the fold over its eye, 1.5 s after the drawn sweep is first shown across it.
//   k3: resumed after its eye, the cork swept in with real strokes, `k3` as her mittens close on the line.
//   heave: resumed with the line in her mittens, strokes over the net on its head until it billows up, half a second
//     into the heave it asks for.
//   k4: resumed after the heave, the cygnet holding the loop's end: `k4-held` once the drawn sweep shows along the
//     flipper, then `k4` as the lift it is given (`liftFin`, as a stroke at it would) slides the loop to the tip.
//   k5: played on from there to the release, `k5` at the spout and `k5-flukes` as they wave.
//   dive: the first crossing (`?chapter=toLines`), its flukes at their highest as it dives far off, when it comes.
// Traps:
//   - k1 sails the open sea from the start (about 80 s) and dive waits for the crossing's sighting (about 45 s): a
//     full set takes about six minutes, so pass only the shots needed.
//   - The browser lock is shared with every capture tool: a run may wait for another session's capture first.
//   - eye, k3, heave, k4 and k5 resume a save in the running page (`restoreCheckpoint`), as the net check does; k4 and k5 lift
//     the flipper by `liftFin` rather than a stroke, so no drawn wind of the player's crosses the frame.
//   - Run it against your own dev server: a server that hot-reloads mid-capture yields a frame of the start screen.
//   - Portrait shots are composed beside `k2-portrait` for k2 and beside the landscape painting otherwise.
//   - The whale breathes and the swell runs, so the same shot moves a little from run to run: compare the read,
//     not pixels. k2 waits five seconds at rest first so the hold has settled.
//   - In portrait the first crossing's camera does not turn to the far whale, so `dive-port` shows only haze.
//   - A frame-rate step-down mid-run (another session's capture on the GPU) shows as `pairs` in the printed stats:
//     render-target pairs at the lower sample count, not new programs. Rerun on a quiet machine.
import { openBrowser } from './lib/browser.mjs';
import { circle, gameWait, sweepCork, sweepHead } from './lib/whale-gestures.mjs';
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
const CONCEPT = { k1: 'k1-island', k2: 'k2-the-breath', 'k2-shut': 'k2-the-breath', eye: 'k2-the-breath', k3: 'k3-the-child', heave: 'k3-the-child',
  k4: 'k4-the-cygnet', 'k4-held': 'k4-the-cygnet',
  k5: 'k5-free', 'k5-flukes': 'k5-free', dive: 'k1-island' };

const STARTS = {
  k1: 'sea',
  k2: 'whale',
  eye: 'whale',
  k3: 'whale',
  heave: 'whale',
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

/** At rest beside it, resumed at the save `point`. */
async function resume(page, point) {
  await atRest(page);
  await page.evaluate((p) => { const c = __game.story.current; c.restoreCheckpoint(p, [c.leg, c.time]); }, point);
}

/** Resumed after the heave, until the cygnet holds the loop's end with the camera come round to it. */
async function held(page) {
  await resume(page, 'whale-heave');
  await waitFor(page, () => { const w = __game.story.current.whale; return w.bird === 'holding' && w.birdT > 3; }, null, 120);
}

/** Strokes `sweep` until `done` holds in the page, at most `most` of them. */
async function strokesUntil(page, sweep, done, most, what) {
  for (let n = 0; n < most; n++) {
    if (await page.evaluate(done)) return;
    await sweep(page);
  }
  if (!(await page.evaluate(done))) throw new Error(`${most} strokes never ${what}`);
}

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
    await circle(page, () => page.evaluate(() => { const s = __game.sealife.sleeper; return s.phase === 'woken' && s.time > 4.4; }), 90);
    await snap('k2');
  },
  async eye(page, snap) {
    await resume(page, 'whale-breath');
    await waitFor(page, () => !!__game.story.current.whale.offered, null, 60);
    await page.waitForTimeout(1500);
    await snap('eye');
  },
  async k3(page, snap) {
    await resume(page, 'whale-eye');
    await waitFor(page, () => !!__game.story.current.whale.offered, null, 60);
    await strokesUntil(page, (p) => sweepCork(p, 1), () => __game.story.current.whale.haul !== 'out', 4, 'brought the cork');
    await waitFor(page, () => __game.sealife.net.grip !== null, null, 30);
    await snap('k3');
  },
  async heave(page, snap) {
    await resume(page, 'whale-line');
    await waitFor(page, () => !!__game.story.current.whale.offered, null, 60);
    // The still is taken as she draws, once the sheet has had a moment to stand up off its head.
    for (let n = 0; n < 6; n++) {
      const swept = sweepHead(page);
      const up = await page.waitForFunction(() => __game.story.current.whale.haul === 'heaving' && __game.sealife.net.billow > 0.6, null,
        { timeout: 3000, polling: 'raf' }).then(() => true, () => false);
      if (up) await gameWait(page, 0.5);
      if (up) await snap('heave');
      await swept;
      if (up) return;
    }
    throw new Error('six strokes over its head never billowed the net up as she heaves');
  },
  async k4(page, snap) {
    await held(page);
    await waitFor(page, () => !!__game.story.current.whale.offered, null, 60);
    await page.waitForTimeout(1500);
    await snap('k4-held');
    await page.evaluate(() => __game.story.current.whale.liftFin('sweeps'));
    await waitFor(page, () => __game.story.current.whale.slipT > 2.4, null, 20);
    await snap('k4');
  },
  async k5(page, snap) {
    await held(page);
    await page.evaluate(() => __game.story.current.whale.liftFin('sweeps'));
    await waitFor(page, () => __game.sealife.sleeper.phase === 'free' && __game.sealife.sleeper.time > 7.2, null, 90);
    await snap('k5');
    await waitFor(page, () => __game.sealife.sleeper.time > 31, null, 90);
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
