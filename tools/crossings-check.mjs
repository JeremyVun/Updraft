// Plays the drowned village's crossings on the QA stage with real pointer gestures and checks each one: that the
// tree takes two or three firm pushes and she crosses it, that one firm push (however long) only loosens it, that a
// gentle stroke or wrong-way pushes only rock it, that pumping the swing carries her over and the empty swing then
// dies away; that strokes up the line fill the sheet and it carries her over holding on, that a gust that dies lets
// it sag back, that it holds her where she is when the player stops; that her feet are on a roof or her mittens on
// the piece throughout; and that nothing happens on its own before the safety valve (and that the valve then does it).
// Usage: node tools/crossings-check.mjs [scenario ...]
//   scenarios: tree, tree-three, tree-one, tree-long, tree-rock, tree-wrong, swing, sheet, sheet-start, sheet-sag, sheet-wrong,
//   sheet-stall, bell, bell-weak (the default set); run (tree and swing in a row with the walk between); climb,
//   climb-down (her climb up the ivy into the belfry, and back down: hands and feet on their holds); tree-idle,
//   swing-idle, sheet-idle, bell-idle (each idles past the 90 s valve, about two minutes apiece)
//   env: BASE (default http://127.0.0.1:5287/), W/H viewport (default 1600x900), OUT (stills and video prefix,
//        default /tmp/updraft-crossings), SHOTS=1 saves stills at the moments that matter, VIDEO=1 records
//        <OUT>-<scenario>.webm.
// Gestures are paced in game time: every pointer move waits for a rendered frame, and with `shot` the game steps a
// fixed 1/60 s a frame, so a stroke of 15 moves lasts a quarter of a second however fast the machine draws.
import { openBrowser } from './lib/browser.mjs';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5287/';
const width = Number(process.env.W ?? 1600);
const height = Number(process.env.H ?? 900);
const out = process.env.OUT ?? '/tmp/updraft-crossings';
const shots = process.env.SHOTS === '1';
const video = process.env.VIDEO === '1';
const asked = process.argv.slice(2);
const scenarios = asked.length ? asked : ['tree', 'tree-three', 'tree-one', 'tree-long', 'tree-rock', 'tree-wrong', 'swing',
  'sheet', 'sheet-start', 'sheet-sag', 'sheet-wrong', 'sheet-stall', 'bell', 'bell-weak'];

function expect(ok, message) {
  if (!ok) throw new Error(message);
}

class Game {
  constructor(page, name) {
    this.page = page;
    this.name = name;
    this.notes = [];
    this.pointer = null;
    this.yard = 'crossings';
  }

  /** `yard` is the stage's field the crossing lives in: `crossings` (tree, swing, run) or `sheet`. */
  async open(gap, yard = 'crossings', extra = '') {
    this.yard = yard;
    await this.page.goto(`${base}?shot=1&chapter=stage&gap=${gap}${extra}`, { waitUntil: 'load' });
    await this.page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await this.page.waitForFunction((y) => window.__game?.story?.current?.[y]?.playing, yard, { timeout: 30000 });
    await this.seconds(1.5);
  }

  /** Waits this many seconds of game time. */
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
    return this.page.evaluate((y) => window.__game.story.current[y].state, this.yard);
  }

  async shot(label) {
    if (!shots) return;
    const path = `${out}-${this.name}-${label}.png`;
    await this.page.screenshot({ path });
    console.log(`     ${path}`);
  }

  /** Where a world point is on screen, as fractions of the viewport, and the screen angle of a heading there. */
  async aim(which) {
    if (which === 'bell') return this.page.evaluate(() => {
      const yard = window.__game.story.current.bell;
      const camera = window.__game.rig.camera;
      const mid = yard.bell.middle(camera.position.clone());
      const p = mid.clone().project(camera);
      const side = mid.clone();
      side.x += yard.bell.toward.x * 0.97;
      side.z += yard.bell.toward.y * 0.97;
      side.project(camera);
      const width = Math.hypot((side.x - p.x) * camera.aspect, side.y - p.y);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, heading: yard.bell.screenHeading(camera), aspect: camera.aspect, width };
    });
    if (which === 'sheet') return this.page.evaluate((which) => {
      const yard = window.__game.story.current[which];
      const camera = window.__game.rig.camera;
      const at = yard.crossing.sheet.middle(camera.position.clone());
      const heading = yard.crossing.sheet.heading(camera);
      const p = at.project(camera);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, heading, aspect: camera.aspect };
    }, which);
    return this.page.evaluate((which) => {
      const yard = window.__game.story.current.crossings;
      const camera = window.__game.rig.camera;
      const at = which === 'tree' ? yard.tree.tree.trunkAt(0.5, camera.position.clone()) : yard.swing.swing.seat(camera.position.clone());
      const heading = which === 'tree' ? yard.tree.tree.fallHeading(camera) : (() => {
        const s = yard.swing.swing;
        const a = at.clone().project(camera);
        const b = at.clone().set(at.x + s.toward.x * 2, at.y, at.z + s.toward.y * 2).project(camera);
        return Math.atan2(b.y - a.y, (b.x - a.x) * camera.aspect);
      })();
      const p = at.project(camera);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, heading, aspect: camera.aspect };
    }, which);
  }

  /**
   * A stroke through `at` along `heading`, `length` screen heights long, over `frames` frames. The pointer gets to
   * its start along the bottom of the screen, so the way back never brushes what is being pushed.
   */
  async stroke(at, heading, length, frames) {
    const dx = (Math.cos(heading) * length) / at.aspect, dy = -Math.sin(heading) * length;
    const from = [at.x - dx / 2, at.y - dy / 2];
    if (this.pointer) {
      await this.page.mouse.move(this.pointer[0] * width, 0.99 * height);
      await this.frame();
      await this.page.mouse.move(from[0] * width, 0.99 * height);
      await this.frame();
    }
    await this.page.mouse.move(from[0] * width, from[1] * height);
    await this.frame();
    this.pointer = [from[0] + dx, from[1] + dy];
    for (let i = 1; i <= frames; i++) {
      const u = i / frames;
      await this.page.mouse.move((from[0] + dx * u) * width, (from[1] + dy * u) * height);
      await this.frame();
    }
  }

  /**
   * Circles round `at` (re-aimed each turn by `aim`), `radius` screen heights, `turns` of them at `rate` turns a
   * second, clockwise on screen unless `ccw`; `each(state)` after every quarter turn.
   */
  async circles(aim, radius, turns, rate = 1.1, each = null, ccw = false) {
    const perTurn = Math.round(60 / rate);
    let at = await aim();
    for (let i = 0; i <= turns * perTurn; i++) {
      if (i % perTurn === 0) at = await aim();
      const a = (ccw ? 1 : -1) * (i / perTurn) * Math.PI * 2;
      const x = at.x + (Math.cos(a) * radius) / at.aspect, y = at.y - Math.sin(a) * radius;
      await this.page.mouse.move(x * width, y * height);
      await this.frame();
      if (each && i % Math.round(perTurn / 4) === 0) each(await this.state());
    }
    this.pointer = null;
  }

  /** Polls every few frames until `test(state)` holds or `limit` seconds pass, keeping track along the way. */
  async until(test, limit, each) {
    for (let t = 0; t < limit; t += 0.1) {
      const s = await this.state();
      each?.(s);
      if (test(s)) return s;
      await this.seconds(0.1);
    }
    return null;
  }
}

const RUNS = {
  /** Each firm push the right way tears the roots a step, which shows; the second or third brings it down, and she walks over it. */
  async tree(game) {
    await game.open('tree');
    await game.shot('waiting');
    let strokes = 0;
    for (; strokes < 6; strokes++) {
      const s = await game.state();
      if (s.tree.state !== 'standing') break;
      const aim = await game.aim('tree');
      await game.stroke(aim, aim.heading, 0.62, 15);
      const fell = await game.until((x) => x.tree.state !== 'standing', 1.8);
      if (fell) { strokes++; break; }
      const after = await game.state();
      expect(after.tree.gives === strokes + 1, `firm stroke ${strokes + 1} did not give the roots (gives ${after.tree.gives}, loose ${after.tree.loose})`);
      game.notes.push(`firm stroke ${strokes + 1}: roots gave, loose ${after.tree.loose}, lean ${after.tree.lean}`);
      if (strokes === 0) await game.shot('loosened');
      await game.seconds(1.2);
      if (strokes === 0) await game.shot('loosened-later');
    }
    const s = await game.state();
    expect(s.tree.state !== 'standing', `still standing after ${strokes} firm strokes (lean ${s.tree.lean}, loose ${s.tree.loose})`);
    expect(strokes >= 2 && strokes <= 3, `went over after ${strokes} firm strokes, not two or three`);
    game.notes.push(`went over after ${strokes} firm strokes`);
    await game.seconds(0.9);
    await game.shot('falling');
    const down = await game.until((x) => x.tree.state === 'down', 8);
    expect(down, 'never came down');
    await game.seconds(0.15);
    await game.shot('down');
    const crossing = await game.until((x) => x.tree.phase === 'crossing', 4);
    expect(crossing, 'she never stepped onto it');
    await game.seconds(1.6);
    await game.shot('crossing');
    const over = await game.until((x) => x.tree.phase === 'over', 20);
    expect(over, `she never got over (phase ${(await game.state()).tree.phase})`);
    await game.shot('over');
    game.notes.push(`over at child ${over.child.join(', ')}`);
  },

  /** Shorter, less firm pushes that still tear the roots each take three to bring it down. */
  async 'tree-three'(game) {
    await game.open('tree');
    let strokes = 0;
    for (; strokes < 6; strokes++) {
      if ((await game.state()).tree.state !== 'standing') break;
      const aim = await game.aim('tree');
      await game.stroke(aim, aim.heading, 0.3, 10);
      if (await game.until((x) => x.tree.state !== 'standing', 2.2)) { strokes++; break; }
      const s = await game.state();
      game.notes.push(`push ${strokes + 1}: gives ${s.tree.gives}, loose ${s.tree.loose}`);
    }
    const s = await game.state();
    expect(s.tree.state !== 'standing', `still standing after ${strokes} pushes (loose ${s.tree.loose})`);
    expect(strokes === 3, `went over after ${strokes} pushes, not three`);
    game.notes.push(`went over after ${strokes} pushes`);
  },

  /** One firm push the right way loosens it for good, leaning further, but never brings it down on its own. */
  async 'tree-one'(game) {
    await game.open('tree');
    const rest = (await game.state()).tree.lean;
    const aim = await game.aim('tree');
    await game.stroke(aim, aim.heading, 0.62, 15);
    let most = rest;
    await game.until(() => false, 6, (s) => {
      most = Math.max(most, s.tree.lean);
      expect(s.tree.state === 'standing', 'one firm stroke brought it down');
    });
    const s = await game.state();
    game.notes.push(`one firm stroke: lean ${rest} to ${most.toFixed(3)}, settled at ${s.tree.lean}; gives ${s.tree.gives}, loose ${s.tree.loose}`);
    expect(s.tree.gives === 1, `one firm stroke gave the roots ${s.tree.gives} times`);
    expect(s.tree.lean > rest + 0.04, 'it does not stand leaning further after the roots gave');
  },

  /** One long, fast, unbroken stroke across it the right way is still one push. */
  async 'tree-long'(game) {
    await game.open('tree');
    const aim = await game.aim('tree');
    await game.stroke(aim, aim.heading, 1.4, 30);
    await game.until(() => false, 5, (s) => expect(s.tree.state === 'standing', 'one long stroke brought it down'));
    const s = await game.state();
    game.notes.push(`one long stroke: gives ${s.tree.gives}, loose ${s.tree.loose}`);
    expect(s.tree.gives <= 1, `one long stroke gave the roots ${s.tree.gives} times`);
  },

  /** A gentle stroke the right way rocks it a beat late and it springs back: the roots do not give. */
  async 'tree-rock'(game) {
    await game.open('tree');
    const rest = (await game.state()).tree.lean;
    let most = rest;
    const aim = await game.aim('tree');
    await game.stroke(aim, aim.heading, 0.4, 30);
    await game.shot('rocked');
    await game.until(() => false, 5, (s) => { most = Math.max(most, s.tree.lean); });
    const s = await game.state();
    game.notes.push(`one gentle stroke: lean ${rest} to ${most.toFixed(3)}, back to ${s.tree.lean}; gives ${s.tree.gives}`);
    expect(s.tree.state === 'standing', 'one gentle stroke brought it down');
    expect(most > rest + 0.04, 'a gentle stroke did not visibly rock it');
    expect(s.tree.gives === 0, 'a gentle stroke gave the roots');
    expect(Math.abs(s.tree.lean - rest) < 0.02, `it did not spring back (${s.tree.lean} against ${rest})`);
  },

  /** Strokes the wrong way rock it back and it springs upright again: no loosening, never over. */
  async 'tree-wrong'(game) {
    await game.open('tree');
    const rest = (await game.state()).tree.lean;
    let least = rest, most = rest, loose = 0;
    const watch = (s) => { least = Math.min(least, s.tree.lean); most = Math.max(most, s.tree.lean); loose = Math.max(loose, s.tree.loose); };
    for (let i = 0; i < 8; i++) {
      const aim = await game.aim('tree');
      await game.stroke(aim, aim.heading + Math.PI, 0.62, 15);
      await game.until(() => false, 1.2, watch);
    }
    await game.until(() => false, 3, watch);
    const s = await game.state();
    game.notes.push(`lean ${rest} at rest, ${least.toFixed(3)} to ${most.toFixed(3)} under 8 wrong-way strokes; loose ${loose.toFixed(3)}`);
    expect(s.tree.state === 'standing', 'it went over');
    expect(least < rest - 0.03, 'wrong-way strokes did not visibly rock it');
    expect(loose < 0.05, `wrong-way strokes loosened it (${loose})`);
    expect(Math.abs(s.tree.lean - rest) < 0.02, `it did not spring back (${s.tree.lean} against ${rest})`);
  },

  /** With no input it stands, rocking only in the air it has; the drawn push comes; then the valve brings it down. */
  async 'tree-idle'(game) {
    await game.open('tree');
    const rest = (await game.state()).tree.lean;
    let most = 0, invited = false;
    await game.until(() => false, 85, (s) => {
      most = Math.max(most, Math.abs(s.tree.lean - rest));
      invited ||= s.invitation;
      expect(s.tree.state === 'standing', `it went over by itself (${JSON.stringify(s.tree)})`);
    });
    await game.shot('invited');
    game.notes.push(`85 s idle: still standing, moved at most ${most.toFixed(3)} rad, invitation shown: ${invited}`);
    expect(invited, 'the drawn push never came');
    expect(most < 0.02, `it moved by itself (${most})`);
    const went = await game.until((s) => s.tree.state !== 'standing', 25);
    expect(went, 'the safety valve never brought it down');
    game.notes.push('the world\'s own gust brought it down');
    const over = await game.until((s) => s.tree.phase === 'over', 25);
    expect(over, 'she never got over after the valve');
  },

  /** She gets on by herself; strokes across the swing pump it; she lets go and lands on the far slope. */
  async swing(game) {
    await game.open('swing');
    const riding = await game.until((s) => s.swing.phase === 'riding', 5);
    expect(riding, 'she never got on');
    await game.shot('riding');
    let strokes = 0;
    let released = null;
    for (; strokes < 40 && !released; strokes++) {
      const aim = await game.aim('swing');
      await game.stroke(aim, aim.heading, 0.5, 12);
      released = await game.until((s) => ['flying', 'landed', 'leaving', 'over'].includes(s.swing.phase), 0.8);
      if (strokes === 4) await game.shot('pumping');
    }
    expect(released, `never let go after ${strokes} strokes (${JSON.stringify((await game.state()).swing)})`);
    game.notes.push(`let go after ${strokes} pumping strokes at ${released.swing.angle} rad (best ${released.swing.best})`);
    await game.seconds(0.25);
    await game.shot('flying');
    const landed = await game.until((s) => ['landed', 'leaving', 'over'].includes(s.swing.phase), 3);
    expect(landed, 'she never landed');
    await game.seconds(0.3);
    await game.shot('landed');
    const over = await game.until((s) => s.swing.phase === 'over', 12);
    expect(over, 'she never got up and on');
    await game.shot('over');
    const landing = await game.page.evaluate(() => window.__game.story.current.crossings.swing.way.landing.toArray());
    expect(over.child[2] < landing[2] + 0.3 && over.child[1] > 0.2, `she is not on the far slope (${over.child} against landing ${landing})`);
    game.notes.push(`on the far side at ${over.child.join(', ')}`);
    let swinging = 0;
    await game.until(() => false, 2, (x) => { swinging = Math.max(swinging, Math.abs(x.swing.angle)); });
    const since = await game.page.evaluate(() => window.__game.story.current.crossings.swing.t);
    game.notes.push(`the empty swing ${since.toFixed(1)} s after she landed: swinging ${swinging.toFixed(3)} rad`);
    expect(since < 14 && swinging < 0.08, `the empty swing has not died away (${swinging} rad, ${since} s after she landed)`);
  },

  /**
   * The cat runs the line first; a firm stroke up the line across the sheet fills it at once; she takes hold and it
   * carries her over, a few more strokes keeping it full; her feet are on a ridge or her mittens on the sheet throughout.
   */
  async sheet(game) {
    await game.open('sheet', 'sheet');
    await game.shot('idle');
    const watch = feetWatch(game);
    await game.until((s) => s.cat.onLine, 6, watch.see);
    await game.seconds(0.6);
    await game.shot('cat');
    const first = await game.aim('sheet');
    await game.stroke(first, first.heading, 0.6, 14);
    let most = 0;
    await game.until(() => false, 0.5, (s) => { watch.see(s); most = Math.max(most, s.fill); });
    game.notes.push(`one firm stroke: fill ${most.toFixed(2)} within half a second`);
    expect(most > 0.35, `one firm stroke did not visibly fill it (${most})`);
    await game.shot('answering');
    let strokes = 1, clearAt = null;
    let held = null;
    for (; strokes < 30; strokes++) {
      held = await game.until((s) => s.held, 0.6, watch.see);
      if (held) break;
      if (clearAt === null && (await game.state()).clear) clearAt = strokes;
      const aim = await game.aim('sheet');
      await game.stroke(aim, aim.heading, 0.6, 14);
    }
    expect(held, `she never took hold (${JSON.stringify(await game.state())})`);
    game.notes.push(`she took hold after ${strokes} strokes (the cat over: ${held.cat.done})`);
    expect(held.cat.done, 'she took hold while the cat was still on the line');
    let shotMid = false;
    let over = null;
    for (let i = 0; i < 40; i++) {
      over = await game.until((s) => ['landing', 'landed', 'leaving', 'over'].includes(s.phase), 0.5, watch.see);
      if (over) break;
      const s = await game.state();
      if (!shotMid && s.travel > (s.end + 2.4) / 2) { await game.shot('carried'); shotMid = true; }
      const aim = await game.aim('sheet');
      await game.stroke(aim, aim.heading, 0.6, 14);
      strokes++;
    }
    expect(over, `she was never set down (${JSON.stringify(await game.state())})`);
    game.notes.push(`set down after ${strokes} strokes in all, ${strokes - (clearAt ?? strokes)} of them once the cat was off the line`);
    await game.seconds(0.4);
    await game.shot('across');
    const done = await game.until((s) => s.phase === 'over', 10, watch.see);
    expect(done, 'she never went on from the far ridge');
    await game.seconds(1.5);
    await game.shot('after');
    watch.report();
    game.notes.push(`over at ${done.child.join(', ')}`);
  },

  async 'sheet-start'(game) {
    await game.open('sheet', 'sheet', '&catless');
    await game.seconds(3);
    expect(!(await game.state()).held, 'the sheet started without a gesture');
    let held = null, strokes = 0;
    while (!held && strokes < 3) {
      const aim = await game.aim('sheet');
      await game.stroke(aim, aim.heading, 0.45, 18);
      strokes++;
      held = await game.until(s => s.held, 0.6);
    }
    game.notes.push(`moderate strokes to take hold: ${strokes}`);
    expect(held, 'three moderate strokes did not get the sheet going');
  },

  /** A gentle stroke fills it a little and it sags back: she does not take hold. */
  async 'sheet-sag'(game) {
    await game.open('sheet', 'sheet', '&catless');
    const aim = await game.aim('sheet');
    await game.stroke(aim, aim.heading, 0.3, 24);
    let most = 0;
    await game.until(() => false, 1, (s) => { most = Math.max(most, s.fill); });
    await game.shot('sagging');
    await game.until(() => false, 3, (s) => expect(!s.held, 'a gentle stroke had her take hold'));
    const s = await game.state();
    game.notes.push(`gentle stroke: fill up to ${most.toFixed(2)}, ${s.fill} three seconds later; phase ${s.phase}`);
    expect(most > 0.12, `a gentle stroke did not visibly fill it (${most})`);
    expect(s.fill < 0.08, `it did not sag back (${s.fill})`);
  },

  /** Strokes back down the line only puff it back toward her: nothing fills, she never takes hold. */
  async 'sheet-wrong'(game) {
    await game.open('sheet', 'sheet', '&catless');
    let most = 0, least = 0;
    for (let i = 0; i < 6; i++) {
      const aim = await game.aim('sheet');
      await game.stroke(aim, aim.heading + Math.PI, 0.6, 14);
      await game.until(() => false, 0.8, (s) => { most = Math.max(most, s.fill); least = Math.min(least, s.press); expect(!s.held, 'she took hold'); });
    }
    game.notes.push(`six strokes back down the line: fill at most ${most.toFixed(3)}, press down to ${least.toFixed(3)}`);
    expect(most < 0.05, `strokes back down the line filled it (${most})`);
    expect(least < -0.1, 'strokes back down the line did not puff it back');
  },

  /** Carried part way, the player stops: it sags and she hangs where she is, her mittens on it; the drawn gust comes back; then on over. */
  async 'sheet-stall'(game) {
    await game.open('sheet', 'sheet', '&catless');
    const watch = feetWatch(game);
    for (let i = 0; i < 12 && !(await game.state()).held; i++) {
      const aim = await game.aim('sheet');
      await game.stroke(aim, aim.heading, 0.6, 14);
      await game.until((s) => s.held, 0.6, watch.see);
    }
    for (let i = 0; i < 12; i++) {
      const s = await game.state();
      if (s.travel > s.end * 0.45) break;
      const aim = await game.aim('sheet');
      await game.stroke(aim, aim.heading, 0.6, 14);
      await game.until(() => false, 0.4, watch.see);
    }
    const from = await game.state();
    let invited = false;
    await game.until(() => false, 8, (s) => { watch.see(s); invited ||= s.invitation; });
    const still = await game.state();
    await game.shot('hanging');
    game.notes.push(`stopped at ${from.travel} m: ${still.travel} m eight seconds later, phase ${still.phase}, fill ${still.fill}; drawn gust: ${invited}`);
    expect(still.phase === 'carried' && still.held, 'she is not still hanging from it');
    expect(still.travel - from.travel < 2.2, 'it carried her on by itself long after the last gust died');
    expect(still.travel >= from.travel - 0.01, 'it slid back with her on it');
    expect(invited, 'the drawn gust did not come back');
    for (let i = 0; i < 20; i++) {
      if (['landing', 'landed', 'leaving', 'over'].includes((await game.state()).phase)) break;
      const aim = await game.aim('sheet');
      await game.stroke(aim, aim.heading, 0.6, 14);
      await game.until(() => false, 0.5, watch.see);
    }
    const over = await game.until((s) => s.phase === 'over', 10, watch.see);
    expect(over, 'she never got over after starting again');
    watch.report();
  },

  /** With no input the sheet hangs, breathing only; the drawn gust comes; then the world's own gusts carry her over. */
  async 'sheet-idle'(game) {
    await game.open('sheet', 'sheet');
    const watch = feetWatch(game);
    let most = 0, invited = false;
    await game.until(() => false, 85, (s) => {
      watch.see(s);
      most = Math.max(most, s.fill);
      invited ||= s.invitation;
      expect(!s.held, 'she took hold by herself');
    });
    await game.shot('invited');
    game.notes.push(`85 s idle: fill at most ${most.toFixed(3)}, drawn gust shown: ${invited}`);
    expect(invited, 'the drawn gust never came');
    expect(most < 0.05, `it filled by itself (${most})`);
    const over = await game.until((s) => s.phase === 'over', 60, watch.see);
    expect(over, 'the safety valve never carried her over');
    game.notes.push('the world\'s own gusts carried her over');
    watch.report();
  },

  /** Firm strokes start the bell; it rings at either end and decays after the player stops. */
  async bell(game) {
    await game.open('bell', 'bell', '&bell=ring');
    await game.shot('ready');
    const start = await game.state();
    expect(start.bell.rings === 0 && start.phase === 'ringing', `the bell rang or she was not ready before a stroke (${JSON.stringify(start.bell)})`);
    let first = null, last = null;
    for (let i = 0; i < 4; i++) {
      const before = (await game.state()).bell.rings;
      const aim = await game.aim('bell');
      await game.stroke(aim, (i % 2 ? Math.PI : 0) + aim.heading, 0.42, 15);
      const rang = await game.until((s) => s.bell.rings > before, 2.5);
      expect(rang, `firm stroke ${i + 1} did not ring it (${JSON.stringify((await game.state()).bell)})`);
      expect(rang.bell.rings === before + 1, `firm stroke ${i + 1} rang it ${rang.bell.rings - before} times`);
      first ??= rang.t;
      last = rang.t;
      game.notes.push(`firm stroke ${i + 1}: rang at the top of a ${rang.bell.peak} rad swing, wave ${rang.waves}`);
      if (i === 0) {
        await game.seconds(0.7);
        await game.shot('ring');
        await game.seconds(1.4);
        await game.shot('wave');
      }
      await game.until(() => false, 1.0);
    }
    await game.seconds(9);
    const s = await game.state();
    game.notes.push(`four strokes: ${s.bell.rings} rings, ${s.bell.touches} touches; settled to ${s.bell.angle} rad`);
    expect(s.bell.rings >= 4, 'firm strokes did not sustain ringing');
    expect(Math.abs(s.bell.angle) < .05 && Math.abs(s.bell.speed) < .1, 'the bell did not settle after input stopped');
  },

  /** Tiny incidental motions only rock the bell; deliberate slow strokes are covered by SWAY in the chapter replay. */
  async 'bell-weak'(game) {
    await game.open('bell', 'bell', '&bell=ring');
    let most = 0;
    for (let i = 0; i < 5; i++) {
      const aim = await game.aim('bell');
      await game.stroke(aim, aim.heading, 0.08 * aim.width, 24);
      await game.until(() => false, 2.2, (s) => { most = Math.max(most, Math.abs(s.bell.angle)); expect(s.bell.rings === 0, `a weak stroke rang it (${JSON.stringify(s.bell)})`); });
    }
    await game.shot('rocked');
    const s = await game.state();
    game.notes.push(`five weak strokes: swung at most ${most.toFixed(3)} rad, ${s.bell.touches} touches of the clapper, no ring`);
    expect(most > 0.05, `weak strokes did not visibly rock it (${most})`);
    expect(s.bell.touches > 0, 'the clapper never touched');
    expect(most < tuningOf(s).ringAt, 'weak strokes swung it as far as a ring');
  },

  /** Nobody strokes it: it hangs still, the drawn stroke comes, and after the valve the world's own gust rings it. */
  async 'bell-idle'(game) {
    await game.open('bell', 'bell', '&bell=ring');
    let invited = false, most = 0;
    await game.until(() => false, 85, (s) => {
      invited ||= s.bell.invitation;
      most = Math.max(most, Math.abs(s.bell.angle));
      expect(s.bell.rings === 0 && s.bell.touches === 0, `it rang by itself (${JSON.stringify(s.bell)})`);
    });
    await game.shot('invited');
    game.notes.push(`85 s idle: swung at most ${most.toFixed(4)} rad, the drawn stroke shown: ${invited}`);
    expect(invited, 'the drawn stroke never came');
    const rang = await game.until((s) => s.bell.rings > 0, 20);
    expect(rang, 'the safety valve never rang it');
    game.notes.push(`the world's own gust rang it at ${rang.t} s`);
  },

  /** Her climb up the ivy and over the sill into the belfry: every mitten and boot on its hold the whole way. */
  async climb(game) {
    await game.open('bell', 'bell', '');
    await game.page.evaluate(() => window.__game.probe?.reset());
    const up = await game.until((s) => s.climb.phase === 'up', 8);
    expect(up, 'she never started climbing');
    await game.seconds(3.5);
    await game.shot('climbing');
    const done = await game.until((s) => s.phase === 'nest' || s.phase === 'ringing', 25);
    expect(done, `she never got in (${JSON.stringify((await game.state()).climb)})`);
    const s = await game.state();
    const probe = await game.page.evaluate(() => window.__game.probe?.report() ?? null);
    game.notes.push(`climbed ${s.climb.length} s; worst hand gap ${s.climb.hand} m (${s.climb.handAt}), foot slip ${s.climb.foot} m (${s.climb.footAt})`);
    game.notes.push(`probe: ${probe}`);
    expect(s.climb.hand < 0.05 && s.climb.foot < 0.05, 'a mitten or a boot came off its hold');
  },

  /** Back out over the sill and down the ivy, feet first, to the ridge. */
  async 'climb-down'(game) {
    await game.open('bell', 'bell', '&bell=down');
    await game.page.evaluate(() => window.__game.probe?.reset());
    const down = await game.until((s) => s.climb.phase === 'down', 8);
    expect(down, 'she never started down');
    await game.seconds(4);
    await game.shot('down');
    const done = await game.until((s) => s.phase === 'below', 30);
    expect(done, `she never got down (${JSON.stringify((await game.state()).climb)})`);
    const s = await game.state();
    const probe = await game.page.evaluate(() => window.__game.probe?.report() ?? null);
    game.notes.push(`climbed down in ${s.climb.length} s; worst hand gap ${s.climb.hand} m (${s.climb.handAt}), foot slip ${s.climb.foot} m (${s.climb.footAt}); on the ridge at ${s.child.join(', ')}`);
    game.notes.push(`probe: ${probe}`);
    expect(s.climb.hand < 0.05 && s.climb.foot < 0.05, 'a mitten or a boot came off its hold');
    expect(Math.abs(s.child[1] - 2.84) < 0.08, `she is not back on the ridge (${s.child[1]})`);
  },

  /** Both in a row: the tree, the walk along the wall and over the cottage to its eave, the swing. */
  async run(game) {
    await game.open('run');
    for (let i = 0; i < 6 && (await game.state()).tree.state === 'standing'; i++) {
      const aim = await game.aim('tree');
      await game.stroke(aim, aim.heading, 0.62, 15);
      await game.until((x) => x.tree.state !== 'standing', 1.6);
    }
    const riding = await game.until((s) => s.swing.phase === 'riding', 60);
    expect(riding, `she never got from the tree to the swing (${JSON.stringify(await game.state())})`);
    game.notes.push(`on the swing at ${riding.child.join(', ')}`);
    await game.shot('swing');
    let released = null;
    for (let i = 0; i < 40 && !released; i++) {
      const aim = await game.aim('swing');
      await game.stroke(aim, aim.heading, 0.5, 12);
      released = await game.until((s) => s.swing.phase !== 'riding', 0.8);
    }
    expect(released, 'never let go of the swing');
    const over = await game.until((s) => s.swing.phase === 'over', 15);
    expect(over, 'she never got up and on after the swing');
    await game.shot('over');
  },

  /** On the swing with nobody pumping, it dies away and she waits; the drawn push comes; then the valve carries her. */
  async 'swing-idle'(game) {
    await game.open('swing');
    await game.until((s) => s.swing.phase === 'riding', 5);
    let invited = false;
    await game.until(() => false, 85, (s) => {
      invited ||= s.invitation;
      expect(s.swing.phase === 'riding', `she let go by herself (${JSON.stringify(s.swing)})`);
    });
    const s = await game.state();
    await game.shot('waiting');
    game.notes.push(`85 s idle: still riding, swinging ${s.swing.angle} rad, best ${s.swing.best}; invitation shown: ${invited}`);
    expect(invited, 'the drawn push never came');
    const went = await game.until((x) => x.swing.phase !== 'riding', 40);
    expect(went, 'the safety valve never carried her over');
    game.notes.push('the world\'s own gusts carried her over');
    const over = await game.until((x) => x.swing.phase === 'over', 15);
    expect(over, 'she never got up and on after the valve');
  },
};

function tuningOf(state) {
  return state.tuning;
}

/**
 * Keeps an eye on her feet: on a ridge (within a few centimetres) whenever she is not hanging from the piece, and her
 * mittens on it whenever she is. Leaps on and off the piece are let through.
 */
function feetWatch(game) {
  let worstFeet = 0, worstHands = 0, hanging = 0, standing = 0;
  return {
    see(s) {
      if (s.phase === 'landing' || s.phase === 'taking' || s.phase === 'fetching' || s.phase === 'raising' || s.phase === 'lowering') return;
      if (s.hanging) {
        hanging++;
        worstHands = Math.max(worstHands, s.handGap);
        expect(s.handGap < 0.16, `her mittens left the piece while she hung from it (${s.handGap} m; ${JSON.stringify(s)})`);
        expect(s.feet > -0.05, `her feet went into the roof while she hung (${s.feet} m; ${JSON.stringify(s)})`);
      } else {
        standing++;
        worstFeet = Math.max(worstFeet, Math.abs(s.feet));
        expect(Math.abs(s.feet) < 0.08, `her feet are off the roof while she is not held (${s.feet} m; ${JSON.stringify(s)})`);
      }
    },
    report() {
      game.notes.push(`feet: on the roof to ${worstFeet.toFixed(3)} m over ${standing} looks; mittens on the piece to ${worstHands.toFixed(3)} m over ${hanging} looks hanging`);
    },
  };
}

async function main() {
  const { browser, close } = await openBrowser();

  const results = [];
  try {
    for (const name of scenarios) {
      const run = RUNS[name];
      if (!run) throw new Error(`no scenario called ${name}`);
      const videoDir = video ? fs.mkdtempSync('/tmp/updraft-crossings-video-') : null;
      const context = await browser.newContext({
        viewport: { width, height }, deviceScaleFactor: 1,
        ...(videoDir ? { recordVideo: { dir: videoDir, size: { width, height } } } : {}),
      });
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
      const pageVideo = videoDir ? page.video() : null;
      await context.close();
      if (pageVideo) {
        fs.renameSync(await pageVideo.path(), `${out}-${name}.webm`);
        fs.rmSync(videoDir, { recursive: true, force: true });
        console.log(`${out}-${name}.webm`);
      }
      results.push({ name, ok: !failure, failure, notes: game.notes });
      console.log(`${failure ? 'FAIL' : 'ok  '} ${name}${failure ? `: ${failure}` : ''}${game.notes.length ? `\n     ${game.notes.join('\n     ')}` : ''}`);
    }
  } finally {
    await close();
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

await main();
