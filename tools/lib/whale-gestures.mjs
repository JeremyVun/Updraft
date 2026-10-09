// The real pointer gestures that play the whale in the net's five steps, shared by the tools that drive it in a
// browser: circles over the blowhole for the breath, then a stroke across its eye, the cork, the net on its head and
// the flipper. Each comes in from off the window and leaves it again, as a hand does.

/** A point in the world on screen, in pixels: `expr` evaluated in the page. */
export const screenOf = (page, expr) => page.evaluate((e) => {
  const p = eval(e).clone().project(__game.rig.camera);
  return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
}, expr);

/** Where a point on the whale is on screen, in pixels: the blowhole, or `s` along its back (0 snout, 1 flukes). */
export const onScreen = (page, s, up = 0) => page.evaluate(([s, up]) => {
  const w = __game.sealife.sleeper;
  const p = s === 'blowhole' ? w.blowhole.clone() : w.point(0, 1.1, s, w.blowhole.clone());
  p.y += up;
  p.project(__game.rig.camera);
  return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
}, [s, up]);

/** Off the window: nothing it does is wind. */
export const away = (page) => page.evaluate(() => __game.renderer.domElement.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));

/**
 * The pointer taken off the window and brought back in at (x, y), as a hand leaves the mouse and comes back: no stroke
 * in between. A bare move from wherever it was parked is a stroke of its own across whatever lies between.
 */
export async function jumpTo(page, x, y) {
  await away(page);
  await page.mouse.move(x, y);
  await page.waitForTimeout(100);
}

export async function stroke(page, points, ms, started = false) {
  const n = Math.max(2, Math.round(ms / 8));
  if (!started) await page.mouse.move(...points[0]);
  for (let i = 1; i <= n; i++) {
    const f = (i / n) * (points.length - 1);
    const k = Math.min(points.length - 2, Math.floor(f));
    const t = f - k;
    await page.mouse.move(points[k][0] + (points[k + 1][0] - points[k][0]) * t, points[k][1] + (points[k + 1][1] - points[k][1]) * t);
    await page.waitForTimeout(ms / n);
  }
}

/**
 * Until `seconds` of game time have passed. With `shot` the game steps 1/60 s a frame, so on a loaded machine its clock
 * runs slow, and a hand paced by the wall clock would circle faster than any player could.
 */
export const gameWait = (page, seconds) => page.evaluate((seconds) => new Promise((resolve) => {
  const end = __game.story.current.time + seconds;
  const tick = () => (__game.story.current.time >= end ? resolve() : requestAnimationFrame(tick));
  tick();
}), seconds);

/**
 * Round and round over the blowhole, a loop each 0.8 s of game time, re-aimed each turn, until `done()` gives
 * something truthy (returned) or the wall clock runs out. The radius is `r` of the window's height (60 px at 900).
 */
export async function circle(page, done, wallSeconds = 60, r = 1 / 15) {
  const end = Date.now() + wallSeconds * 1000;
  const { height } = page.viewportSize();
  const [sx, sy] = await onScreen(page, 'blowhole', 1.2);
  await jumpTo(page, sx + r * height, sy);
  let a = 0;
  for (;;) {
    const [cx, cy] = await onScreen(page, 'blowhole', 1.2);
    for (let i = 0; i < 24; i++) {
      a += (Math.PI * 2) / 24;
      await page.mouse.move(cx + Math.cos(a) * r * height, cy + Math.sin(a) * r * height * 0.83);
      await gameWait(page, 0.029);
    }
    const s = await done();
    if (s) return s;
    if (Date.now() > end) throw new Error('circling over the blowhole never did it');
  }
}

/** One stroke up across its eye from below the fold, a long one or (`weak`) a short slow one. */
export async function sweepEye(page, weak = false) {
  const [ex, ey] = await screenOf(page, '__game.sealife.sleeper.eye');
  const L = weak ? 50 : 260;
  await jumpTo(page, ex - 20, ey + L * 0.5);
  await stroke(page, [[ex - 20, ey + L * 0.5], [ex + 20, ey - L * 0.6]], weak ? 300 : 280, true);
  await away(page);
  await page.waitForTimeout(700);
}

/**
 * One sweep across the near cork on screen, `way` 1 toward the boat or -1 away from it, from well short to well past.
 * The pointer comes in at the start and leaves at the end: a bare move to or from a parked corner is a stroke of its
 * own, back across the cork.
 */
export async function sweepCork(page, way = 1) {
  const [cx, cy] = await screenOf(page, '__game.sealife.net.float.position');
  const [bx, by] = await screenOf(page, '__game.boat.position');
  const d = Math.hypot(bx - cx, by - cy) || 1;
  const ux = ((bx - cx) / d) * way, uy = ((by - cy) / d) * way;
  await jumpTo(page, cx - ux * 110, cy - uy * 110);
  await stroke(page, [[cx - ux * 110, cy - uy * 110], [cx + ux * 150, cy + uy * 150]], 240, true);
  await away(page);
  const { width, height } = page.viewportSize();
  await page.mouse.move(width - 10, height - 10);
  await page.waitForTimeout(1200);
}

/** One stroke from the net on its head toward her, over the water between. */
export async function sweepHead(page) {
  const [hx, hy] = await screenOf(page, '(() => { const s = __game.sealife.sleeper; return s.eye.clone().lerp(s.blowhole, 0.45); })()');
  const [bx, by] = await screenOf(page, '__game.boat.position');
  await jumpTo(page, hx, hy);
  await stroke(page, [[hx, hy], [(hx + bx) / 2, (hy + by) / 2]], 300, true);
  await away(page);
  await page.waitForTimeout(500);
}

/** Points `t` of the way out along the near flipper (0 root .. 1 tip) on screen, in pixels. */
export const finOnScreen = (page, ...ts) => page.evaluate((ts) => {
  const s = __game.sealife.sleeper;
  return ts.map((t) => {
    const p = s.finRoot.clone().lerp(s.finTip, t).project(__game.rig.camera);
    return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
  });
}, ts);

/**
 * One sweep along the flipper on screen, from inside its outer half out past its tip; or, `across`, a scrub back and
 * forth across it, which stays on it as long as a sweep along it does.
 */
export async function sweepFin(page, across = false) {
  const [[ax, ay], [bx, by]] = await finOnScreen(page, 0.5, 1);
  const d = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / d, uy = (by - ay) / d;
  const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
  const half = Math.max(160, d * 0.65);
  const points = across ? Array.from({ length: 9 }, (_, i) => [mx - uy * 45 * (i % 2 ? 1 : -1) + ux * (i - 4) * 12, my + ux * 45 * (i % 2 ? 1 : -1) + uy * (i - 4) * 12])
    : [[mx - ux * half, my - uy * half], [mx + ux * half, my + uy * half]];
  await jumpTo(page, ...points[0]);
  await stroke(page, points, across ? 640 : 320, true);
  await away(page);
  await page.waitForTimeout(900);
}

/** The whale's step and what it still asks, read from the page. */
export const whaleNow = (page) => page.evaluate(() => {
  const c = __game.story.current, w = c.whale;
  if (!w) return null;
  const asked = Math.min(__game.tuning.netWhale.heaves, w.heaves + w.owed + (w.haul === 'heaving' ? 1 : 0));
  const asks = { breath: w.progress < 1, eye: w.foldT < 0, line: w.haul === 'out', heave: asked < __game.tuning.netWhale.heaves,
    flipper: w.bird === 'holding' && w.slipT < 0 }[w.step] ?? false;
  return { step: w.step, stepTime: w.stepTime, asks, shown: !!w.offered || !!c.coax, time: c.time };
});

const SWEEP = { eye: sweepEye, line: (p) => sweepCork(p, 1), heave: sweepHead, flipper: sweepFin };

/**
 * One go at the whale's current step, as a prompt player has: once its gesture has been drawn (or after a first go),
 * circling over the blowhole until the breath is done, or one stroke across what the step asks for. False when the
 * step asks nothing yet. `tries` counts the goes each step took.
 */
export async function whaleGo(page, tries = {}) {
  const s = await whaleNow(page);
  if (!s?.asks || (!s.shown && !tries[s.step])) return false;
  tries[s.step] = (tries[s.step] ?? 0) + 1;
  if (s.step === 'breath') {
    await circle(page, async () => !(await whaleNow(page))?.asks, 60);
    await away(page);
  } else await SWEEP[s.step](page);
  return true;
}
