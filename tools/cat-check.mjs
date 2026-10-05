// Stills of the drowned village's cat doing every one of its actions, at game distances and in the room's light.
// Usage: node tools/cat-check.mjs [out-dir]        (needs a dev server; BASE as for tools/play.mjs)
//   Plays each action on the QA stage's cat yard (?chapter=stage: `__game.story.current.play('cat:<action>')`),
//   stands the camera off it about 4 m (c-near) and 12 m (c-far), and shoots it at the moments that say the most,
//   at dusk (the drowned village's own light) and in storm dark. Then it sits the cat on the real boat in the
//   drowned village (?chapter=drowned) and shoots it from the game's own camera, calm and in the storm.
//   Writes <out-dir>/<light>-<action>-<moment>-<view>.png and <out-dir>/sheet-<light>.png, a contact sheet of each.
//   env: ONLY=sit,run (actions), VIEWS=c-near,c-far,c-close,c-side (any stage view), LIGHTS=dusk,storm, ROOM=0 skips
//        the drowned village; SLIP=1 also prints the furthest a planted paw moved in a frame during each action.
//        STRIP=run@0.8,leap-roof@0.6 shoots each named action as a strip of 16 frames a thirtieth of a second apart
//        from that many seconds in, side on (STRIP_VIEW, default c-side), to judge how it moves; nothing else is shot.
//   Default out-dir: /tmp/updraft-cat-check.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const out = path.resolve(process.argv[2] ?? '/tmp/updraft-cat-check');
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const list = (v, all) => (v ? v.split(',') : all);

/** Each action, and the moments after it starts (seconds of game time) that show it best. */
const ACTIONS = {
  sit: [2.5],
  stand: [2],
  crouch: [2],
  wash: [1.6, 3.2],
  mew: [0.45],
  chirrup: [0.12],
  afraid: [0.25, 2],
  strand: [1.5],
  'hop-tub': [0.18, 0.45, 2.5],
  'ride-tub': [3],
  'jump-boat': [0.5, 0.95, 3],
  boat: [3],
  'leap-roof': [0.55, 1.05, 2.4],
  walk: [1.6],
  trot: [0.9],
  run: [0.55, 2.4],
  rail: [2.5, 6.5],
  gap: [1.1, 1.45, 3],
  climb: [0.9, 2.4, 5.5],
};
const LIGHTS = {
  dusk: 'dusk=0.75',
  storm: 'dusk=0.75&storm=1&shower=0.7',
};
const actions = list(process.env.ONLY, Object.keys(ACTIONS));
const views = list(process.env.VIEWS, ['c-near', 'c-far']);
const lights = list(process.env.LIGHTS, Object.keys(LIGHTS));

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const shots = {};
const errors = [];

async function open(query) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&grass=0&${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  /** The world is held still between shots (`params.hold`), so every still is exactly as far into its action as it says. */
  const advance = async (seconds) => {
    const from = await page.evaluate(() => window.__stats.frame);
    const to = from + Math.max(1, Math.round(seconds * 60));
    await page.evaluate((h) => {
      window.__game.params.hold = h;
    }, to);
    await page.waitForFunction((h) => window.__stats.frame >= h, to, { timeout: 120000, polling: 16 });
  };
  return { context, page, advance };
}

const strips = process.env.STRIP ? process.env.STRIP.split(',').map((s) => s.split('@')) : [];
try {
  for (const light of strips.length ? [] : lights) {
    const { context, page, advance } = await open(`chapter=stage&${LIGHTS[light]}`);
    await advance(1.5);
    shots[light] = [];
    for (const action of actions) {
      for (const view of views) {
        await page.evaluate(([a, v]) => {
          const stage = window.__game.story.current;
          stage.play(`cat:${a}`);
          stage.look(v);
          window.__game.cat.probe.slip = 0;
        }, [action, view]);
        let at = 0;
        for (const moment of ACTIONS[action]) {
          await advance(moment - at);
          at = moment;
          const file = path.join(out, `${light}-${action}-${moment}-${view}.png`);
          await page.screenshot({ path: file });
          shots[light].push({ file, label: `${action} ${moment}s ${view}` });
        }
        if (process.env.SLIP) console.log(`slip ${action} ${view} ${(await page.evaluate(() => window.__game.cat.probe.slip)).toFixed(4)}`);
      }
    }
    await context.close();
  }

  if (strips.length) {
    const { context, page, advance } = await open(`chapter=stage&${LIGHTS[lights[0]]}`);
    await advance(1.5);
    for (const [action, from] of strips) {
      shots[`strip-${action}`] = [];
      await page.evaluate(([a, v]) => {
        const stage = window.__game.story.current;
        stage.play(`cat:${a}`);
        stage.look(v);
      }, [action, process.env.STRIP_VIEW ?? 'c-side']);
      await advance(Number(from));
      for (let i = 0; i < 16; i++) {
        const file = path.join(out, `strip-${action}-${String(i).padStart(2, '0')}.png`);
        /** Cut close round the cat, wherever it is in the frame. */
        const [cx, cy] = await page.evaluate(() => {
          const { cat, rig } = window.__game;
          const p = cat.position.clone();
          p.y += 0.15;
          p.project(rig.camera);
          return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
        });
        const clip = { x: Math.min(1600 - 720, Math.max(0, cx - 360)), y: Math.min(900 - 450, Math.max(0, cy - 225)), width: 720, height: 450 };
        await page.screenshot({ path: file, clip });
        shots[`strip-${action}`].push({ file, label: `${action} +${(i * Number(process.env.STRIP_STEP ?? 1 / 30)).toFixed(3)}s` });
        await advance(Number(process.env.STRIP_STEP ?? 1 / 30));
      }
    }
    await context.close();
  }

  if (process.env.ROOM !== '0' && !strips.length) {
    for (const light of lights) {
      const { context, page, advance } = await open(`chapter=drowned&${LIGHTS[light]}`);
      await advance(4);
      const room = `room-${light}`;
      shots[room] = [];
      /** On the mast thwart, the bow's end of the boat, as far from the water as it can get. */
      await page.evaluate(() => {
        const { cat, boat, child } = window.__game;
        cat.visible = true;
        cat.place(new boat.group.position.constructor(0, 0.07, 0.55), 0, { frame: boat.group, pose: 'sit' });
        cat.curious = child.position;
      });
      for (const [moment, label] of [[1, 'sits'], [6, 'later']]) {
        await advance(moment);
        const file = path.join(out, `${room}-${label}.png`);
        await page.screenshot({ path: file });
        shots[room].push({ file, label: `drowned village, aboard (${light}) ${label}` });
      }
      await context.close();
    }
  }

  /** A contact sheet of each light: the browser lays them out with their names under them. */
  const sheet = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await sheet.newPage();
  for (const [name, list] of Object.entries(shots)) {
    if (!list.length) continue;
    const cells = list
      .map(({ file, label }) => `<figure><img src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"><figcaption>${label}</figcaption></figure>`)
      .join('');
    await page.setContent(`<style>body{margin:0;background:#111;color:#ddd;font:13px system-ui}main{display:grid;grid-template-columns:repeat(4,400px)}figure{margin:0}img{width:400px;height:225px;display:block}figcaption{padding:2px 6px 6px}</style><main>${cells}</main>`);
    const file = path.join(out, `sheet-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await sheet.close();
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
