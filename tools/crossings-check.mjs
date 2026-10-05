// Plays the drowned village's two crossings on the QA stage with real pointer gestures and checks each one: that the
// tree takes two or three firm pushes and she crosses it, that one firm push (however long) only loosens it, that a
// gentle stroke or wrong-way pushes only rock it, that pumping the swing carries her over and the empty swing then
// dies away, and that nothing happens on its own before the safety valve (and that the valve then does it).
// Usage: node tools/crossings-check.mjs [scenario ...]
//   scenarios: tree, tree-one, tree-long, tree-rock, tree-wrong, swing (the default set); run (both in a row with the
//   walk between); tree-idle, swing-idle (each idles past the 90 s valve, about two minutes apiece)
//   env: BASE (default http://127.0.0.1:5287/), W/H viewport (default 1600x900), OUT (stills and video prefix,
//        default /tmp/updraft-crossings), SHOTS=1 saves stills at the moments that matter, VIDEO=1 records
//        <OUT>-<scenario>.webm.
// Gestures are paced in game time: every pointer move waits for a rendered frame, and with `shot` the game steps a
// fixed 1/60 s a frame, so a stroke of 15 moves lasts a quarter of a second however fast the machine draws.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5287/';
const width = Number(process.env.W ?? 1600);
const height = Number(process.env.H ?? 900);
const out = process.env.OUT ?? '/tmp/updraft-crossings';
const shots = process.env.SHOTS === '1';
const video = process.env.VIDEO === '1';
const asked = process.argv.slice(2);
const scenarios = asked.length ? asked : ['tree', 'tree-one', 'tree-long', 'tree-rock', 'tree-wrong', 'swing'];

function expect(ok, message) {
  if (!ok) throw new Error(message);
}

class Game {
  constructor(page, name) {
    this.page = page;
    this.name = name;
    this.notes = [];
    this.pointer = null;
  }

  async open(gap) {
    await this.page.goto(`${base}?shot=1&chapter=stage&gap=${gap}`, { waitUntil: 'load' });
    await this.page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await this.page.waitForFunction(() => window.__game?.story?.current?.crossings?.playing, null, { timeout: 30000 });
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
    return this.page.evaluate(() => window.__game.story.current.crossings.state);
  }

  async shot(label) {
    if (!shots) return;
    const path = `${out}-${this.name}-${label}.png`;
    await this.page.screenshot({ path });
    console.log(`     ${path}`);
  }

  /** Where a world point is on screen, as fractions of the viewport, and the screen angle of a heading there. */
  async aim(which) {
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
    await browser.close();
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

await main();
