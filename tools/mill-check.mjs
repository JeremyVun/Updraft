// Plays the drowned village's mill on the QA stage with real pointer circles round its hub and checks it: that
// circling turns it and a sail dwells level beside her wall until she is aboard; that she rides with her feet on the
// rail and is never moved by more than a step in a frame (no teleport onto or off the sail); that the wrong way only
// rocks it, empty and with her aboard, and never carries her back down; that it coasts and brakes to a stop when the
// circling stops and holds her there; that frantic circling never goes past the speed cap; that the drawn spiral
// comes back after a pause and sooner after a wrong-way turn; and that idling never fails or ends anything.
// Usage: node tools/mill-check.mjs [scenario ...]
//   scenarios: ride, wrong, coast, frantic, idle (the default set); valve (idles past the 90 s safety valve)
//   env: BASE (default http://127.0.0.1:5311/), W/H viewport (default 1600x900), OUT (stills prefix, default
//        /tmp/updraft-mill-check), SHOTS=1 saves stills at the moments that matter.
// Gestures are paced in game time: every pointer move waits for a rendered frame, and with `shot` the game steps a
// fixed 1/60 s a frame.
import { chromium } from 'playwright-core';

const base = process.env.BASE ?? 'http://127.0.0.1:5311/';
const width = Number(process.env.W ?? 1600);
const height = Number(process.env.H ?? 900);
const out = process.env.OUT ?? '/tmp/updraft-mill-check';
const shots = process.env.SHOTS === '1';
const asked = process.argv.slice(2);
const scenarios = asked.length ? asked : ['ride', 'wrong', 'coast', 'frantic', 'idle'];
const K = { board: -0.26, top: 0.44, cap: 0.6, capAboard: 0.24, rockMax: 0.07, rockAboard: 0.03 };

function expect(ok, message) {
  if (!ok) throw new Error(message);
}

class Game {
  constructor(page, name) {
    this.page = page;
    this.name = name;
    this.notes = [];
  }

  async open() {
    await this.page.goto(`${base}?shot=1&chapter=stage&gap=mill`, { waitUntil: 'load' });
    await this.page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await this.page.waitForFunction(() => window.__game?.story?.current?.mill?.playing, null, { timeout: 30000 });
    Object.assign(K, await this.page.evaluate(() => window.__game.story.current.mill.tuning));
    /** Every frame: where she is, what the mill is doing, and what it says. */
    await this.page.evaluate(() => {
      const yard = window.__game.story.current.mill;
      const log = window.__millLog = { frames: [], events: [] };
      const was = yard.crossing.onEvent;
      yard.crossing.onEvent = (kind, at, strength) => { log.events.push({ kind, strength, frame: log.frames.length }); was?.(kind, at, strength); };
      const tick = () => { log.frames.push(yard.state); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await this.seconds(1);
  }

  async seconds(s) {
    await this.page.evaluate((n) => new Promise((done) => {
      let i = 0;
      const tick = () => (++i >= n ? done() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    }), Math.max(1, Math.round(s * 60)));
  }

  async frame() {
    await this.page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done())));
  }

  state() {
    return this.page.evaluate(() => window.__game.story.current.mill.state);
  }

  /** Frames logged since `from`, and the events. */
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

  /** The hub on screen, as fractions of the viewport. */
  hub() {
    return this.page.evaluate(() => {
      const yard = window.__game.story.current.mill;
      const p = yard.crossing.mill.hub.clone().project(window.__game.rig.camera);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
    });
  }

  /**
   * Broad, imperfect circles round the hub: `turns` of them at `perTurn` seconds a turn, `radius` screen heights
   * across, clockwise on screen (the way the sails turn seen from the front) or anticlockwise with `way` -1.
   */
  async circle(turns, perTurn, radius = 0.22, way = 1) {
    const frames = Math.round(turns * perTurn * 60);
    for (let i = 0; i <= frames; i++) {
      const h = await this.hub();
      const a = (i / (perTurn * 60)) * Math.PI * 2 * way;
      const r = radius * (1 + 0.18 * Math.sin(a * 1.7));
      await this.page.mouse.move((h.x + (Math.cos(a) * r * height) / width) * width, (h.y + Math.sin(a) * r * 1.1) * height);
      await this.frame();
    }
  }

  /** Circles only until a sail dwells for her, then lets her get on by herself. */
  async aboard() {
    expect(await this.circleUntil((s) => s.dwelling || s.phase !== 'waiting', 25), 'no sail came round to her');
    expect(await this.until((s) => s.phase === 'riding', 10), 'never got her aboard');
  }

  async until(test, limit, each) {
    for (let t = 0; t < limit; t += 0.1) {
      const s = await this.state();
      each?.(s);
      if (test(s)) return s;
      await this.seconds(0.1);
    }
    return null;
  }

  /** Circles until `test` holds, in short bursts so nothing waits on a long gesture. */
  async circleUntil(test, limit, perTurn = 1.3) {
    for (let t = 0; t < limit; t += perTurn * 0.5) {
      const s = await this.state();
      if (test(s)) return s;
      await this.circle(0.5, perTurn);
    }
    return test(await this.state()) ? this.state() : null;
  }
}

/** The largest move she makes in one frame while on or stepping to and from the sail, metres. */
function biggestStep(frames) {
  let most = 0, at = null;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].child, b = frames[i].child;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (d > most) { most = d; at = `${frames[i - 1].phase} to ${frames[i].phase}, ${a.join(' ')} to ${b.join(' ')}`; }
  }
  return { most, at };
}

const RUNS = {
  /** Circling brings a sail to her and it dwells; she boards, rides with her feet on the rail, and walks off at the top. */
  async ride(game) {
    await game.open();
    if (shots) await game.seconds(2.5);
    await game.shot('waiting');
    const from = await game.mark();
    const dwelt = await game.circleUntil((s) => s.dwelling || s.phase !== 'waiting', 20);
    expect(dwelt, 'circling never brought a sail round to her');
    game.notes.push(`a sail came round and dwelt at ${dwelt.sail} rad`);
    await game.circle(0.75, 1.3);
    const held = await game.state();
    expect(held.phase !== 'waiting' || Math.abs(held.sail - K.board) < 0.01, `the sail did not hold for her while the player kept circling (sail ${held.sail})`);
    expect(await game.until((s) => s.phase === 'riding', 8), 'she never got on the sail');
    const aboard = (await game.log(from)).frames.find((f) => f.phase === 'riding');
    expect(Math.abs(aboard.sail - K.board) < 0.02, `she got on with the sail at ${aboard.sail}, not at its dwell`);
    await game.shot('aboard');
    await game.circle(0.5, 1.3);
    await game.seconds(0.4);
    await game.shot('mid-ride');
    const top = await game.circleUntil((s) => s.phase !== 'riding', 30);
    expect(top, 'the sail never carried her to the top');
    await game.shot('top');
    const over = await game.until((s) => s.phase === 'over', 15);
    expect(over, `she never walked off onto the high roof (phase ${(await game.state()).phase})`);
    await game.shot('off');
    if (shots) {
      await game.seconds(2);
      await game.shot('ahead');
    }
    const { frames, events } = await game.log(from);
    const riding = frames.filter((f) => f.phase === 'riding');
    const gaps = riding.map((f) => Math.abs(f.railGap));
    const gap = Math.max(...gaps);
    expect(gap < 0.03, `her feet left the rail while riding (worst ${gap.toFixed(3)} m)`);
    const steep = Math.max(...riding.map((f) => Math.abs(f.sail)));
    expect(steep <= Math.max(-K.board, K.top) + 0.01, `the rail went steeper than she can stand on (${steep.toFixed(3)} rad)`);
    const arc = Math.max(...riding.map((f) => f.sail)) - Math.min(...riding.map((f) => f.sail));
    expect(arc < Math.PI / 2, `she was carried through ${arc.toFixed(2)} rad, not well under half a turn`);
    const onSail = frames.filter((f) => f.phase !== 'waiting');
    const step = biggestStep(onSail);
    expect(step.most < 0.12, `she moved ${step.most.toFixed(3)} m in one frame while ${step.at}: a jump`);
    const fastest = Math.max(...riding.map((f) => f.speed));
    expect(fastest <= K.capAboard + 1e-3, `with her aboard it turned at ${fastest} rad/s, over the cap`);
    const lift = Math.max(...riding.map((f) => f.child[1])) - Math.min(...riding.map((f) => f.child[1]));
    const kinds = [...new Set(events.map((e) => e.kind))];
    const leaving = frames.findIndex((f) => f.phase === 'leaving'), done = frames.findIndex((f) => f.phase === 'over');
    game.notes.push(`from the top dwell to the high roof: ${((done - leaving) / 60).toFixed(1)} s`);
    game.notes.push(`rode ${arc.toFixed(2)} rad, lifted ${lift.toFixed(2)} m, feet within ${gap.toFixed(3)} m of the rail, steepest ${steep.toFixed(2)} rad, biggest frame move ${step.most.toFixed(3)} m (${step.at}), fastest ${fastest.toFixed(3)} rad/s; heard ${kinds.join(', ')}`);
  },

  /** The wrong way only rocks it: empty, a small give and back; aboard, a softer one that never takes her down. */
  async wrong(game) {
    await game.open();
    const start = await game.state();
    let from = await game.mark();
    await game.circle(3, 1.2, 0.22, -1);
    await game.seconds(1.5);
    let { frames } = await game.log(from);
    const turned = Math.max(...frames.map((f) => Math.abs(f.angle - start.angle)));
    const gave = Math.min(...frames.map((f) => f.rock));
    expect(turned < 1e-3, `wrong-way circling turned the empty mill ${turned.toFixed(3)} rad`);
    expect(gave < -0.01 && gave >= -K.rockMax - 1e-4, `the empty mill did not rock the wrong way within its give (rock ${gave})`);
    const invited = frames.some((f) => f.inviting);
    expect(invited, 'the spiral did not come to show the way after a wrong-way turn');
    game.notes.push(`empty: rocked back at most ${(-gave).toFixed(3)} rad, never turned; spiral redrawn`);
    await game.aboard();
    await game.circle(0.25, 1.3);
    await game.seconds(2);
    const before = await game.state();
    from = await game.mark();
    await game.circle(3, 1.2, 0.22, -1);
    await game.seconds(1.5);
    ({ frames } = await game.log(from));
    const lowest = Math.min(...frames.map((f) => f.angle));
    const dip = Math.min(...frames.map((f) => f.rock));
    const dropped = before.child[1] - Math.min(...frames.map((f) => f.child[1]));
    expect(lowest >= before.angle - 1e-6, `wrong-way circling carried her back down (${before.angle} to ${lowest})`);
    const worst = frames.find((f) => f.rock === dip);
    expect(dip >= -K.rockAboard - 1e-4, `the rock with her aboard gave ${dip}, more than ${K.rockAboard} (${JSON.stringify(worst)})`);
    expect(frames.every((f) => f.phase === 'riding'), 'she got off during the rock');
    game.notes.push(`aboard: rocked at most ${(-dip).toFixed(3)} rad, dipped her ${Math.max(0, dropped).toFixed(3)} m and back, never lower than she had come`);
  },

  /** Let go mid-turn: it coasts on, then brakes to a stop, and holds her there. */
  async coast(game) {
    await game.open();
    await game.circle(0.4, 1.2);
    const let0 = await game.state();
    const from = await game.mark();
    const stopped = await game.until((s) => s.speed === 0 && s.drive < 0.05, 8);
    expect(stopped, 'it never came to a stop');
    const { frames, events } = await game.log(from);
    const coasted = stopped.angle - let0.angle;
    expect(coasted > 0.01, `it stopped dead rather than coasting (${coasted.toFixed(3)} rad)`);
    expect(events.some((e) => e.kind === 'settle'), 'no settle as it braked to a stop');
    const t = frames.findIndex((f) => f.speed === 0) / 60;
    game.notes.push(`coasted ${coasted.toFixed(3)} rad over ${t.toFixed(1)} s from ${let0.speed} rad/s, then braked`);
    await game.aboard();
    await game.circle(0.25, 1.3);
    const ride0 = await game.until((s) => s.speed === 0 && s.drive < 0.05, 8);
    expect(ride0, 'with her aboard it never settled');
    await game.seconds(4);
    const later = await game.state();
    expect(later.phase === 'riding' && Math.abs(later.angle - ride0.angle) < 1e-6, `it did not hold her where it settled (${JSON.stringify(ride0)} then ${JSON.stringify(later)})`);
    expect(Math.abs(later.railGap) < 0.03, 'she is not standing on the rail while it holds');
    expect(later.inviting, 'the spiral did not come back after a pause');
    game.notes.push(`aboard: settled at ${ride0.sail} rad and held her; spiral back after the pause`);
  },

  /** Frantic circling never turns it past the cap, empty or with her aboard. */
  async frantic(game) {
    await game.open();
    const from = await game.mark();
    await game.circle(4, 0.35, 0.3);
    expect(await game.circleUntil((s) => s.phase === 'riding', 25, 0.35), 'never got her aboard');
    await game.circle(6, 0.35, 0.3);
    await game.until((s) => s.phase === 'over', 20);
    const { frames } = await game.log(from);
    const empty = Math.max(...frames.filter((f) => !f.aboard).map((f) => f.speed));
    const loaded = Math.max(0, ...frames.filter((f) => f.aboard).map((f) => f.speed));
    expect(empty <= K.cap + 1e-3, `empty it turned at ${empty} rad/s, past the cap`);
    expect(loaded <= K.capAboard + 1e-3, `with her aboard it turned at ${loaded} rad/s, past the cap`);
    const step = biggestStep(frames.filter((f) => f.phase !== 'waiting'));
    expect(step.most < 0.12, `she moved ${step.most.toFixed(3)} m in one frame while ${step.at}`);
    game.notes.push(`fastest empty ${empty.toFixed(3)}, aboard ${loaded.toFixed(3)} rad/s; biggest frame move ${step.most.toFixed(3)} m`);
  },

  /** Nothing happens without the player: the empty sails only sway, she waits, nothing fails; the spiral comes. */
  async idle(game) {
    await game.open();
    const start = await game.state();
    const from = await game.mark();
    await game.seconds(20);
    const { frames } = await game.log(from);
    expect(frames.every((f) => f.phase === 'waiting'), 'something happened on its own');
    expect(frames.every((f) => Math.abs(f.angle - start.angle) < 1e-6), 'it turned on its own');
    const sway = Math.max(...frames.map((f) => f.shown)) - Math.min(...frames.map((f) => f.shown));
    expect(sway > 0.02, 'the empty sails do not move in the fog\'s breath');
    expect(frames.some((f) => f.inviting), 'the spiral never came');
    game.notes.push(`20 s idle: still waiting, sails swayed ${sway.toFixed(3)} rad, spiral shown`);
  },

  /** Idle past the safety valve: the fog's breath brings a sail round and carries her up. */
  async valve(game) {
    await game.open();
    const went = await game.until((s) => s.phase === 'over', 160);
    expect(went, 'the safety valve never carried her over');
    game.notes.push('the world\'s own breath turned it and carried her over');
  },
};

async function main() {
  const browser = await chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
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
    await browser.close();
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

await main();
