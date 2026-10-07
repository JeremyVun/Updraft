// Plays the drowned village's mill hoist on the QA stage with real pointer circles round its hub and checks it: that
// the cat goes first up a sail and onto the cap; that circling turns the sails and winds her up in the basket the
// whole height of the mill with her feet on its floor and never more than a step in a frame; that the climb takes a
// handful of circles and seconds (reported, for a steady hand and a hesitant one); that the basket never sinks back,
// whatever the pointer does; that the wrong way only rocks the sails; that they coast a little when the circling
// stops and the pawl holds her there; that frantic circling never goes past the speed cap; that the drawn spiral comes
// back after a pause and sooner after a wrong-way turn; and that idling never fails or ends anything.
// Usage: node tools/mill-check.mjs [scenario ...]
//   scenarios: ride, novice, wrong, coast, frantic, idle (the default set); valve (idles past the 90 s safety valve)
//   env: BASE (default http://127.0.0.1:5311/), W/H viewport (default 1600x900), OUT (stills prefix, default
//        /tmp/updraft-mill-check), SHOTS=1 saves stills at the moments that matter.
// Gestures are paced in game time (with `shot` the game steps a fixed 1/60 s a frame): the cursor's place on its
// circle comes from the game's clock, so the circles are as fast in the game however slowly the tool drives it.
import { openBrowser } from './lib/browser.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5311/';
const width = Number(process.env.W ?? 1600);
const height = Number(process.env.H ?? 900);
const out = process.env.OUT ?? '/tmp/updraft-mill-check';
const shots = process.env.SHOTS === '1';
const asked = process.argv.slice(2);
const scenarios = asked.length ? asked : ['ride', 'novice', 'wrong', 'coast', 'frantic', 'idle'];
let K = {};

function expect(ok, message) {
  if (!ok) throw new Error(message);
}

class Game {
  constructor(page, name) {
    this.page = page;
    this.name = name;
    this.notes = [];
    this.now = 0;
  }

  async open() {
    await this.page.goto(`${base}?shot=1&chapter=stage&gap=mill`, { waitUntil: 'load' });
    await this.page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await this.page.waitForFunction(() => window.__game?.story?.current?.mill?.playing, null, { timeout: 30000 });
    K = await this.page.evaluate(() => window.__game.story.current.mill.tuning);
    /** Every frame: where she is, what the mill is doing, and what it says. */
    await this.page.evaluate(() => {
      const yard = window.__game.story.current.mill;
      const log = window.__millLog = { frames: [], events: [] };
      const was = yard.crossing.onEvent;
      yard.crossing.onEvent = (kind, at, strength) => { log.events.push({ kind, strength, frame: log.frames.length }); was?.(kind, at, strength); };
      const tick = () => { log.frames.push({ ...yard.state, t: window.__stats.time }); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await this.seconds(0.2);
  }

  /** One rendered frame; the game's clock after it. */
  async frame() {
    this.now = await this.page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(window.__stats.time))));
    return this.now;
  }

  async seconds(s) {
    const until = (await this.frame()) + s;
    while (this.now < until) await this.frame();
  }

  state() {
    return this.page.evaluate(() => window.__game.story.current.mill.state);
  }

  log(from = 0) {
    return this.page.evaluate((from) => ({ frames: window.__millLog.frames.slice(from), events: window.__millLog.events.filter((e) => e.frame >= from) }), from);
  }

  mark() {
    return this.page.evaluate(() => window.__millLog.frames.length);
  }

  async shot(label) {
    if (!shots) return;
    const path = `${out}-${this.name}-${label}.png`;
    await this.page.screenshot({ path });
    console.log(`     ${path}`);
  }

  /**
   * Broad, imperfect circles round the hub for `seconds` of game time, `perTurn` seconds a turn, `radius` screen
   * heights across, clockwise on screen (the way the sails turn seen from the front) or anticlockwise with `way` -1;
   * stops early once `until(state)` holds.
   */
  async circle(seconds, perTurn = 1.25, radius = 0.22, way = 1, until = null) {
    const from = await this.frame();
    while (this.now - from < seconds) {
      const s = await this.page.evaluate(() => {
        const yard = window.__game.story.current.mill, p = yard.crossing.mill.hub.clone().project(window.__game.rig.camera);
        return { hub: [(p.x + 1) / 2, (1 - p.y) / 2], state: yard.state };
      });
      if (until?.(s.state)) return s.state;
      const a = ((this.now - from) / perTurn) * Math.PI * 2 * way;
      const r = radius * (1 + 0.15 * Math.sin(a * 1.7));
      await this.page.mouse.move((s.hub[0] + (Math.cos(a) * r * height) / width) * width, (s.hub[1] + Math.sin(a) * r) * height);
      await this.frame();
    }
    return null;
  }

  async until(test, limit) {
    const from = await this.frame();
    while (this.now - from < limit) {
      const s = await this.state();
      if (test(s)) return s;
      await this.seconds(0.1);
    }
    return null;
  }

  /** Waits, idle, until she is in the basket and the brake is off. */
  async aboard() {
    expect(await this.until((s) => s.phase === 'riding' && !s.hold, 8), 'she never got into the basket with the brake off');
  }
}

/** The largest move she makes in one frame, metres, and where. */
function biggestStep(frames) {
  let most = 0, at = null;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].child, b = frames[i].child;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (d > most) { most = d; at = `${frames[i - 1].phase} to ${frames[i].phase}`; }
  }
  return { most, at };
}

/** The most the basket's floor ever went down between frames. */
function sank(frames) {
  let most = 0;
  for (let i = 1; i < frames.length; i++) most = Math.max(most, frames[i - 1].floor - frames[i].floor);
  return most;
}

/** Circles from her getting in until she steps out at the top: the seconds, the turns of the cursor, and the checks on the way. */
async function climb(game, perTurn, radius, hesitate = 0) {
  await game.aboard();
  const from = await game.mark();
  const t0 = game.now;
  let paused = false;
  let top = null;
  while (!top && game.now - t0 < 60) {
    top = await game.circle(hesitate && !paused ? 2 : 60, perTurn, radius, 1, (s) => s.phase !== 'riding');
    if (!top && hesitate && !paused) {
      paused = true;
      await game.seconds(hesitate);
    }
  }
  expect(top, 'circling never wound her to the top');
  const circling = game.now - t0 - (paused ? hesitate : 0);
  const { frames, events } = await game.log(from);
  return { circling, turns: circling / perTurn, frames, events };
}

const RUNS = {
  /** A steady hand: the cat goes first, she is wound up the whole height and steps off onto the high roof. */
  async ride(game) {
    await game.open();
    await game.shot('waiting');
    const { circling, turns, frames, events } = await climb(game, 1.25, 0.22);
    const riding = frames.filter((f) => f.phase === 'riding');
    const gap = Math.max(...riding.map((f) => Math.abs(f.floorGap)));
    expect(gap < 0.03, `her feet left the basket's floor while she rode (worst ${gap.toFixed(3)} m)`);
    const down = sank(frames);
    expect(down < 1e-4, `the basket sank back ${down.toFixed(4)} m`);
    const step = biggestStep(frames);
    expect(step.most < 0.12, `she moved ${step.most.toFixed(3)} m in one frame (${step.at}): a jump`);
    const fastest = Math.max(...riding.map((f) => f.speed));
    expect(fastest <= K.capAboard + 1e-3, `with her aboard it turned at ${fastest} rad/s, over the cap`);
    const rise = Math.max(...frames.map((f) => f.floor)) - Math.min(...frames.map((f) => f.floor));
    const capAt = frames.find((f) => f.cat.step >= 4);
    const topAt = frames.find((f) => f.topped);
    expect(capAt, 'the cat never got onto the cap');
    expect(capAt.t <= topAt.t, 'the cat was not on the cap before she reached the top');
    await game.shot('top');
    const over = await game.until((s) => s.phase === 'over', 15);
    expect(over, `she never stepped off onto the high roof (phase ${(await game.state()).phase})`);
    await game.seconds(1);
    await game.shot('off');
    const kinds = [...new Set(events.map((e) => e.kind))];
    for (const k of ['start', 'creak', 'click', 'settle']) expect(kinds.includes(k), `never heard the mill ${k}`);
    const t0 = frames[0].t;
    game.notes.push(`a steady hand (${(1.25).toFixed(2)} s a circle): ${circling.toFixed(1)} s of circling, ${turns.toFixed(1)} circles, rose ${rise.toFixed(2)} m; the sails turned ${(riding.at(-1).angle - riding[0].angle).toFixed(2)} rad`);
    game.notes.push(`the cat on the cap ${(capAt.t - t0).toFixed(1)} s in, her at the top ${(topAt.t - t0).toFixed(1)} s in; ${riding.at(-1).clicks} clicks of the pawl; fastest ${fastest.toFixed(2)} rad/s; feet within ${gap.toFixed(3)} m of the floor; biggest frame move ${step.most.toFixed(3)} m; heard ${kinds.join(', ')}`);
  },

  /** A hesitant first-timer: slower, smaller circles, and a stop to look partway up. */
  async novice(game) {
    await game.open();
    const { circling, turns, frames } = await climb(game, 1.8, 0.15, 1.5);
    expect(sank(frames) < 1e-4, 'the basket sank back');
    game.notes.push(`a hesitant hand (1.8 s a circle, smaller, a 1.5 s stop): ${circling.toFixed(1)} s of circling, ${turns.toFixed(1)} circles`);
  },

  /** The wrong way only rocks it against the pawl, and never takes her down; the spiral comes to show the way. */
  async wrong(game) {
    await game.open();
    await game.aboard();
    await game.circle(1.2, 1.25);
    await game.until((s) => s.speed === 0, 6);
    const before = await game.state();
    const from = await game.mark();
    await game.circle(3.5, 1.2, 0.22, -1);
    await game.seconds(1.5);
    const { frames } = await game.log(from);
    const lowest = Math.min(...frames.map((f) => f.floor));
    const dip = Math.min(...frames.map((f) => f.rock));
    expect(lowest >= before.floor - 1e-6, `wrong-way circling took her down (${before.floor} to ${lowest})`);
    expect(Math.min(...frames.map((f) => f.angle)) >= before.angle - 1e-6, 'wrong-way circling turned the sails back');
    expect(dip >= -K.rockAboard - 1e-4 && dip < -0.002, `the rock gave ${dip}, not a small give within ${K.rockAboard}`);
    expect(frames.some((f) => f.inviting), 'the spiral did not come to show the way after a wrong-way turn');
    game.notes.push(`wrong way with her aboard: rocked ${(-dip).toFixed(3)} rad against the pawl, never lower; spiral redrawn`);
  },

  /** Let go mid-climb: the sails coast a little, then the pawl brings them to a stop and holds her there. */
  async coast(game) {
    await game.open();
    await game.aboard();
    await game.circle(2.5, 1.25);
    const let0 = await game.state();
    const from = await game.mark();
    const stopped = await game.until((s) => s.speed === 0 && s.drive < 0.05, 8);
    expect(stopped, 'it never came to a stop');
    const { frames, events } = await game.log(from);
    const coasted = stopped.angle - let0.angle, rose = stopped.floor - let0.floor;
    const t = (frames.find((f) => f.speed === 0).t - frames[0].t);
    expect(coasted > 0.05, `it stopped dead rather than coasting (${coasted.toFixed(3)} rad)`);
    expect(rose < 0.8, `it carried her on ${rose.toFixed(2)} m after the circling stopped`);
    expect(events.some((e) => e.kind === 'settle'), 'no settle as it braked to a stop');
    await game.seconds(6);
    const later = await game.state();
    expect(later.phase === 'riding' && Math.abs(later.floor - stopped.floor) < 1e-6, 'the pawl did not hold her where it stopped');
    expect(Math.abs(later.floorGap) < 0.03, 'she is not standing on the floor while it holds');
    expect(later.inviting, 'the spiral did not come back after a pause');
    game.notes.push(`let go at ${let0.speed.toFixed(2)} rad/s: coasted ${coasted.toFixed(2)} rad (${rose.toFixed(2)} m) over ${t.toFixed(1)} s, then held; spiral back after the pause`);
  },

  /** Frantic circling never turns it past the cap. */
  async frantic(game) {
    await game.open();
    await game.aboard();
    const from = await game.mark();
    await game.circle(30, 0.35, 0.3, 1, (s) => s.phase !== 'riding');
    await game.until((s) => s.phase === 'over', 15);
    const { frames } = await game.log(from);
    const loaded = Math.max(...frames.filter((f) => f.aboard).map((f) => f.speed));
    expect(loaded <= K.capAboard + 1e-3, `with her aboard it turned at ${loaded} rad/s, past the cap`);
    const step = biggestStep(frames);
    expect(step.most < 0.12, `she moved ${step.most.toFixed(3)} m in one frame (${step.at})`);
    game.notes.push(`fastest aboard ${loaded.toFixed(3)} rad/s; biggest frame move ${step.most.toFixed(3)} m`);
  },

  /** Nothing happens without the player: she gets in and waits, the sails stay put, nothing fails; the spiral comes. */
  async idle(game) {
    await game.open();
    await game.aboard();
    const start = await game.state();
    const from = await game.mark();
    await game.seconds(20);
    const { frames } = await game.log(from);
    expect(frames.every((f) => f.phase === 'riding'), 'something happened on its own');
    expect(frames.every((f) => Math.abs(f.floor - start.floor) < 1e-6), 'it wound her up on its own');
    expect(frames.some((f) => f.inviting), 'the spiral never came');
    game.notes.push(`20 s idle in the basket: still at ${start.floor} m, spiral shown`);
  },

  /** Idle past the safety valve: the world's own breath turns the sails and winds her up. */
  async valve(game) {
    await game.open();
    const went = await game.until((s) => s.phase === 'over', 170);
    expect(went, 'the safety valve never carried her up');
    game.notes.push('the world\'s own breath turned it and wound her up');
  },
};

async function main() {
  const { browser, close } = await openBrowser();
  const results = [];
  try {
    for (const name of scenarios) {
      const run = RUNS[name];
      if (!run) throw new Error(`no scenario called ${name}`);
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const game = new Game(page, name);
      let failure = null;
      try {
        await run(game);
      } catch (e) {
        failure = e.message;
      }
      if (errors.length) failure ??= `page errors: ${errors.slice(0, 2).join(' | ')}`;
      await context.close();
      results.push({ name, ok: !failure });
      console.log(`${failure ? 'FAIL' : 'ok  '} ${name}${failure ? `: ${failure}` : ''}${game.notes.length ? `\n     ${game.notes.join('\n     ')}` : ''}`);
    }
  } finally {
    await close();
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

await main();
