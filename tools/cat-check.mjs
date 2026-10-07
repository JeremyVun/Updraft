// Stills of the drowned village's cat doing every one of its actions, at game distances and in the room's light.
// Usage: node tools/cat-check.mjs [out-dir]        (needs a dev server; BASE as for tools/play.mjs)
//   Plays each action and feeling on the QA stage's cat yard (with the child on its quay for `press`) (?chapter=stage: `__game.story.current.play('cat:<action>')`),
//   stands the camera off it about 4 m (c-near) and 12 m (c-far), and shoots it at the moments that say the most,
//   at dusk (the drowned village's own light) and in storm dark. Then it sits the cat on the real boat's foredeck in
//   the drowned village (?chapter=drowned) and shoots it from the game's own camera, and from 5 m and 12 m off the
//   beam, calm and in the storm. The world is held still for every shot, so each is exactly as far in as it says.
//   Writes <out-dir>/<light>-<action>-<moment>-<view>.png, a contact sheet of each light and view
//   (sheet-<light>-<view>.png; 12 m shots cropped round the cat at full size), sheet-room-<light>.png, and
//   sheet-overview.png, the moments that say most. Takes about five minutes.
//   env: ONLY=sit,run (actions; ONLY=none for the drowned village alone), VIEWS=c-near,c-far,c-close,c-side (any
//        stage view), LIGHTS=dusk,storm, ROOM=0 skips the drowned village. SLIP=1 also prints, for each action, the
//        furthest a planted paw moved in a frame (slip: none) and the furthest a leg fell short of a planted paw
//        (short: a few millimetres standing, a few centimetres at the push-off of a gallop).
//        STRIP=run@0.8,leap-roof@0.6 shoots each named action as a strip of 16 frames, STRIP_STEP seconds apart
//        (a thirtieth by default), from that many seconds in, from STRIP_VIEW (default c-side; c-along and
//        c-across are side on to the yard and along it), cut close round the cat; nothing else is shot.
//        CLOSE=1 instead shoots the cat about a metre off against a plain card, posed and framed as each panel of the
//        model sheet and the expressions (docs/backlog/path-puzzles/comps/cat/, or SHEETS=<dir> holding
//        model-sheet and expressions as .jpg or .png), and writes each beside its panel (close-<panel>.png) and all
//        of them on one page (sheet-close.png). PANELS=sit-front,head-front picks some; LIGHTS picks the light;
//        AT=1.1,1.2 shoots each panel at those moments instead of its own (to see a gait through its cycle).
//        The above-* panels have no panel on the sheet: they look down on the cat from behind, as the game mostly does.
//   Default out-dir: /tmp/updraft-cat-check.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const out = path.resolve(process.argv[2] ?? '/tmp/updraft-cat-check');
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const list = (v, all) => (v === 'none' ? [] : v ? v.split(',') : all);

/** Each action, and the moments after it starts (seconds of game time) that show it best. */
const ACTIONS = {
  sit: [2.5],
  curious: [2.5],
  stand: [2],
  crouch: [2],
  wash: [1.6, 3.2],
  mew: [0.45],
  chirrup: [0.12],
  afraid: [0.25, 2],
  'hop-tub': [0.18, 0.45, 2.5],
  'ride-tub': [3],
  'jump-boat': [0.5, 1.2, 3],
  boat: [3],
  'leap-roof': [0.6, 1.4, 2.6],
  walk: [1.6],
  trot: [0.9],
  run: [0.55, 2.4],
  'scared-run': [1.2],
  rail: [2.5, 6.5],
  gap: [1.2, 1.85, 3.2],
  climb: [0.9, 2.4, 5.5],
  bolt: [0.7],
  'leap-pot': [0.9, 1.3, 2.2],
  'leap-boat': [0.8, 1.2, 2.2],
  'hop-down': [0.5, 0.9, 1.8],
  'climb-trunk': [1.2, 3, 5],
  'ride-sail': [1, 4, 7],
  'ride-swing': [1.5, 3, 4.5],
  strand: [1.5, 5.4],
  shiver: [2.5],
  shake: [0.75],
  stare: [2.5],
  'slow-blink': [1.5],
  press: [2.5, 4.2, 7],
  curl: [3],
  kittens: [3],
  tumble: [2, 4],
  sill: [2, 4],
  tub: [1.5],
};
const LIGHTS = {
  dusk: 'dusk=0.75',
  storm: 'dusk=0.75&storm=1&shower=0.7',
  day: 'dusk=0.25',
};
const actions = list(process.env.ONLY, Object.keys(ACTIONS));
const views = list(process.env.VIEWS, ['c-near', 'c-far']);
const lights = list(process.env.LIGHTS, process.env.CLOSE ? ['day'] : ['dusk', 'storm']);

/**
 * The model sheet's panels and the expressions, each as the action that shows it and how far in, the camera's bearing
 * from the way the cat faces (to its left positive), its height and the height it aims at above what the cat stands
 * on (metres for a cat of scale 1), how far off it stands, how tall a slice of the world the frame takes in, and the
 * panel's place on its sheet in pixels. `head` aims at the eyes rather than at a height.
 */
/** The sheet never shows the cat from above and behind, which is how the game mostly sees it: these stand alone. */
const ABOVE = { eye: 0.62, aim: 0.06, distance: 0.75, span: 0.42, crop: [0, 0, 400, 300] };
const PANELS = {
  'sit-front': { action: 'sit', at: 2.5, bearing: 0, look: 'camera', eye: 0.24, aim: 0.15, distance: 1, span: 0.36, sheet: 'model-sheet', crop: [55, 25, 230, 310] },
  'sit-side': { action: 'sit', at: 2.5, bearing: Math.PI / 2, look: 'ahead', eye: 0.24, aim: 0.15, distance: 1, span: 0.36, sheet: 'model-sheet', crop: [355, 25, 260, 310] },
  'sit-34': { action: 'sit', at: 2.5, bearing: 0.62, look: 'camera', eye: 0.24, aim: 0.15, distance: 1, span: 0.36, sheet: 'model-sheet', crop: [690, 25, 230, 310] },
  'fright-side': { action: 'strand', at: 2, bearing: -Math.PI / 2, eye: 0.14, aim: 0.02, distance: 1, span: 0.36, sheet: 'model-sheet', crop: [965, 70, 330, 270] },
  'fright-34': { action: 'strand', at: 2, bearing: -0.75, eye: 0.16, aim: 0.02, distance: 1, span: 0.36, sheet: 'model-sheet', crop: [1335, 70, 300, 270] },
  gallop: { action: 'run', at: 1.0, look: 'none', bearing: Math.PI / 2, eye: 0.18, aim: 0.13, distance: 1.4, span: 0.36, sheet: 'model-sheet', crop: [225, 365, 510, 215] },
  rail: { action: 'rail', at: 3, look: 'none', bearing: Math.PI / 2, eye: 0.18, aim: 0.13, distance: 1.4, span: 0.36, sheet: 'model-sheet', crop: [925, 365, 520, 215] },
  'head-front': { action: 'sit', at: 2.5, bearing: 0, look: 'camera', head: true, distance: 0.5, span: 0.15, sheet: 'model-sheet', crop: [40, 600, 360, 300] },
  'head-side': { action: 'sit', at: 2.5, bearing: 1.3, look: 'ahead', head: true, distance: 0.5, span: 0.15, sheet: 'model-sheet', crop: [455, 600, 320, 300] },
  content: { action: 'sit', at: 2.5, bearing: 0.15, look: 'camera', head: true, distance: 0.55, span: 0.17, sheet: 'expressions', crop: [110, 20, 370, 410] },
  curious: { action: 'curious', at: 2.5, bearing: -0.3, head: true, distance: 0.55, span: 0.17, sheet: 'expressions', crop: [640, 20, 380, 410] },
  mewing: { action: 'mew', at: 0.45, bearing: 0.15, look: 'camera', head: true, distance: 0.55, span: 0.17, sheet: 'expressions', crop: [1160, 20, 400, 410] },
  frightened: { action: 'afraid', at: 0.6, bearing: 0.15, head: true, distance: 0.55, span: 0.17, sheet: 'expressions', crop: [60, 470, 460, 400] },
  chirrup: { action: 'chirrup', at: 0.12, bearing: 0.15, look: 'camera', head: true, distance: 0.55, span: 0.17, sheet: 'expressions', crop: [640, 450, 380, 420] },
  'back-sit': { action: 'sit', at: 2.5, bearing: Math.PI, look: 'ahead', eye: 0.3, aim: 0.1, distance: 1, span: 0.36, crop: [0, 0, 230, 310] },
  'back-34': { action: 'sit', at: 2.5, bearing: Math.PI - 1.15, look: 'ahead', eye: 0.2, aim: 0.12, distance: 1, span: 0.36, crop: [0, 0, 260, 310] },
  'above-sit': { action: 'sit', at: 2.5, bearing: Math.PI - 0.6, look: 'ahead', ...ABOVE },
  'above-stand': { action: 'stand', at: 2, bearing: Math.PI - 0.6, look: 'ahead', ...ABOVE },
  'above-walk': { action: 'walk', at: 1.6, bearing: Math.PI - 0.6, look: 'none', ...ABOVE },
  'above-fright': { action: 'strand', at: 2, bearing: Math.PI - 0.6, ...ABOVE },
  'above-tub': { action: 'ride-tub', at: 3, bearing: Math.PI - 0.6, ...ABOVE },
  'above-boat': { action: 'boat', at: 3, bearing: Math.PI - 0.6, ...ABOVE },
};
const panels = list(process.env.PANELS, Object.keys(PANELS));
const sheetsDir = process.env.SHEETS ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '../docs/backlog/path-puzzles/comps/cat');
const sheetFile = (name) => ['.jpg', '.png'].map((ext) => path.join(sheetsDir, name + ext)).find((f) => fs.existsSync(f)) ?? path.join(sheetsDir, `${name}.jpg`);

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
const close = !!process.env.CLOSE;
const pairs = [];
try {
  for (const light of close ? lights : []) {
    const { context, page, advance } = await open(`chapter=stage&${LIGHTS[light]}`);
    await advance(1.5);
    for (const [name, p] of panels.flatMap((n) => (process.env.AT ? process.env.AT.split(',').map((t) => [`${n}@${t}`, { ...PANELS[n], at: Number(t) }]) : [[n, PANELS[n]]]))) {
      await page.evaluate((p) => {
        const { cat, story } = window.__game;
        story.current.play(`cat:${p.action}`);
        /** It looks where the panel's cat looks: at the camera, or straight ahead past it. */
        const bearing = cat.yaw + (p.look === 'ahead' ? 0 : p.bearing);
        const at = cat.position.clone();
        at.set(at.x + Math.sin(bearing) * 2, at.y + 0.25 * cat.scale, at.z + Math.cos(bearing) * 2);
        if (p.look) cat.look(p.look === 'none' ? null : at);
      }, p);
      await advance(p.at);
      const file = path.join(out, `close-${light}-${name}.png`);
      const [, , w, h] = p.crop;
      const width = Math.min(1600, Math.round((900 * w) / h));
      const height = Math.round((width * h) / w);
      await page.evaluate(([p, tall]) => {
        const { cat, rig, post, story } = window.__game;
        const k = cat.scale;
        const camera = rig.camera;
        const ground = cat.position.clone();
        const headTurn = cat.rig.nodes[5].getWorldQuaternion(camera.quaternion.clone());
        const skull = new ground.constructor(0, 0.024 * k, 0.024 * k).applyQuaternion(headTurn).add(cat.eye(ground.clone()));
        const face = new ground.constructor(0, 0, 1).applyQuaternion(headTurn);
        const target = p.head ? skull.addScaledVector(face, 0.02 * k) : ground.clone().setY(ground.y + p.aim * k);
        const bearing = (p.head ? Math.atan2(face.x, face.z) : cat.yaw) + p.bearing;
        const eyeY = p.head ? target.y + 0.02 * k : ground.y + p.eye * k;
        camera.position.set(target.x + Math.sin(bearing) * p.distance * k, eyeY, target.z + Math.cos(bearing) * p.distance * k);
        camera.lookAt(target);
        camera.fov = (2 * Math.atan((p.span * tall * k) / (2 * p.distance * k)) * 180) / Math.PI;
        camera.near = 0.05;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        story.current.yard.backdrop(camera.position, target);
        const far = camera.position.distanceTo(target);
        post.focusOn(far - 0.3, far + 0.3);
      }, [p, 900 / height]);
      await page.waitForTimeout(200);
      await page.screenshot({ path: file, clip: { x: Math.round((1600 - width) / 2), y: Math.round((900 - height) / 2), width, height } });
      await page.evaluate(() => window.__game.story.current.yard.backdrop(null, null));
      pairs.push({ name, light, file, panel: p });
    }
    await context.close();
  }

  for (const light of strips.length || close ? [] : lights) {
    const { context, page, advance } = await open(`chapter=stage&${LIGHTS[light]}`);
    await advance(1.5);
    for (const action of actions) {
      for (const view of views) {
        await page.evaluate(([a, v]) => {
          const stage = window.__game.story.current;
          stage.play('cat:sit');
          stage.yard.child = window.__game.child;
          stage.play(`cat:${a}`);
          stage.look(v);
          window.__game.cat.probe.slip = 0;
          window.__game.cat.probe.reach = 0;
          window.__game.cat.probe.where = '';
        }, [action, view]);
        let at = 0;
        for (const moment of ACTIONS[action]) {
          await advance(moment - at);
          at = moment;
          const file = path.join(out, `${light}-${action}-${moment}-${view}.png`);
          await page.screenshot({ path: file });
          (shots[`${light}-${view}`] ??= []).push({ file, label: `${action} ${moment}s`, far: view === 'c-far' || view === 'c-near' });
        }
        if (process.env.SLIP) {
          const { slip, reach, where } = await page.evaluate(() => window.__game.cat.probe);
          console.log(`${action.padEnd(10)} slip ${slip.toFixed(4)} m  short ${reach.toFixed(4)} m  (${where})`);
        }
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
          const p = cat.eye(cat.position.clone()).add(cat.position).multiplyScalar(0.5);
          p.project(rig.camera);
          return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
        });
        const clip = { x: Math.min(1600 - 800, Math.max(0, cx - 400)), y: Math.min(900 - 500, Math.max(0, cy - 250)), width: 800, height: 500 };
        await page.screenshot({ path: file, clip });
        shots[`strip-${action}`].push({ file, label: `${action} +${(i * Number(process.env.STRIP_STEP ?? 1 / 30)).toFixed(3)}s` });
        await advance(Number(process.env.STRIP_STEP ?? 1 / 30));
      }
    }
    await context.close();
  }

  if (process.env.ROOM !== '0' && !strips.length && !close) {
    for (const light of lights) {
      const { context, page, advance } = await open(`chapter=drowned&${LIGHTS[light]}`);
      await advance(4);
      const room = `room-${light}`;
      shots[room] = [];
      /** Up on the foredeck, as far from the water as it can get, facing aft to the child. */
      await page.evaluate(() => {
        const { cat, boat, child } = window.__game;
        const head = child.position.clone();
        cat.visible = true;
        cat.place(new head.constructor(0, 0.668, 1.85), Math.PI, { frame: boat.group, pose: 'sit' });
        cat.look(head);
        cat.curious = head;
        window.__catLook = () => head.copy(child.position).setY(child.position.y + 0.9);
      });
      let at = 0;
      for (const [moment, label] of [[8, 'drifting'], [20, 'among-roofs']]) {
        for (let k = at; k < moment; k += 0.5) {
          await advance(0.5);
          await page.evaluate(() => window.__catLook());
        }
        at = moment;
        const file = path.join(out, `${room}-${label}.png`);
        await page.screenshot({ path: file });
        shots[room].push({ file, label: `drowned village, aboard (${light}) ${label}, the game's camera` });
        /** While the world is held, the lens can be stood anywhere: off the beam at the game's distances. */
        for (const [distance, rise] of [[5, 1.6], [12, 4]]) {
          await page.evaluate(([d, h]) => {
            const { cat, rig, boat } = window.__game;
            const side = new cat.position.constructor(1, 0, 0).transformDirection(boat.group.matrixWorld);
            const at = cat.position.clone();
            at.y += 0.2;
            rig.camera.position.copy(at).addScaledVector(side, d).add(new at.constructor(0, h, 0));
            rig.camera.lookAt(at);
            rig.camera.updateMatrixWorld();
            const far = rig.camera.position.distanceTo(at);
            window.__game.post.focusOn(far - 0.6, far + 1);
          }, [distance, rise]);
          await page.waitForTimeout(150);
          const shot = path.join(out, `${room}-${label}-${distance}m.png`);
          await page.screenshot({ path: shot });
          shots[room].push({ file: shot, label: `drowned village, aboard (${light}) ${label}, ${distance} m off the beam` });
        }
      }
      await context.close();
    }
  }

  /** One sheet of the moments that say most, for a first look. */
  const pick = (light, view, action, moment) => path.join(out, `${light}-${action}-${moment}-${view}.png`);
  shots.overview = [
    ['dusk', 'c-near', 'strand', 1.5], ['dusk', 'c-near', 'hop-tub', 0.45], ['dusk', 'c-near', 'ride-tub', 3], ['dusk', 'c-near', 'jump-boat', 1.2],
    ['dusk', 'c-near', 'boat', 3], ['dusk', 'c-near', 'leap-roof', 1.4], ['dusk', 'c-near', 'run', 0.55], ['dusk', 'c-near', 'rail', 2.5],
    ['dusk', 'c-near', 'gap', 1.85], ['dusk', 'c-near', 'climb', 2.4], ['dusk', 'c-near', 'climb', 5.5], ['dusk', 'c-near', 'afraid', 0.25],
    ['storm', 'c-near', 'strand', 1.5], ['storm', 'c-near', 'run', 0.55], ['storm', 'c-far', 'rail', 2.5], ['storm', 'c-far', 'climb', 5.5],
  ]
    .map(([light, view, action, moment]) => ({ file: pick(light, view, action, moment), label: `${action} ${moment}s, ${light}, ${view === 'c-far' ? '12 m' : '4 m'}`, far: view === 'c-far' }))
    .filter(({ file }) => fs.existsSync(file));
  for (const light of lights) shots.overview.push(...(shots[`room-${light}`] ?? []).filter(({ file }) => file.endsWith('-5m.png')));

  /**
   * A contact sheet of each light and view, laid out by the browser with names under them. Far shots are shown as a
   * crop of their middle at full size, which is where the camera put the cat, so it is seen as small as it really is.
   */
  const sheet = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await sheet.newPage();
  for (const [name, list] of Object.entries(shots)) {
    if (!list.length) continue;
    const cells = list
      .map(({ file, label, far }) => {
        const look = far ? 'background-size:1600px 900px;background-position:-600px -325px' : 'background-size:400px 225px';
        return `<figure><div style="background-image:url('${path.basename(file)}');${look}"></div><figcaption>${label}</figcaption></figure>`;
      })
      .join('');
    const html = path.join(out, `sheet-${name}.html`);
    fs.writeFileSync(html, `<style>body{margin:0;background:#111;color:#ddd;font:13px system-ui}main{display:grid;grid-template-columns:repeat(4,400px)}figure{margin:0}div{width:400px;height:225px}figcaption{padding:2px 6px 6px}</style><main>${cells}</main>`);
    await page.goto(`file://${html}`);
    const file = path.join(out, `sheet-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    fs.rmSync(html);
    console.log(file);
  }
  /** Each close shot beside its panel of the sheet at the same height, then all of them on one page. */
  const H = 420;
  const pair = ({ name, light, file, panel }) => {
    const [x, y, w, h] = panel.crop;
    const s = H / h;
    const art = panel.sheet && `url('file://${sheetFile(panel.sheet)}')`;
    const ref = art ? `<div style="width:${w * s}px;height:${H}px;background:${art} ${-x * s}px ${-y * s}px/${1664 * s}px ${936 * s}px"></div>` : '';
    return `<figure><section>${ref}<img src="file://${file}" style="height:${H}px"></section><figcaption>${name} (${light})${art ? ': the sheet, then the game' : ''}</figcaption></figure>`;
  };
  const style = `<style>body{margin:0;background:#222;color:#ddd;font:14px system-ui}main{display:flex;flex-wrap:wrap;gap:8px;padding:8px}figure{margin:0}section{display:flex;gap:4px}figcaption{padding:3px 6px}</style>`;
  for (const [i, list] of [...pairs.map((p) => [p]), pairs].entries()) {
    if (!list.length) continue;
    const name = i < pairs.length ? `close-${list[0].light}-${list[0].name}-pair` : 'sheet-close';
    const html = path.join(out, `${name}.html`);
    fs.writeFileSync(html, `${style}<main style="${i < pairs.length ? '' : 'width:2400px'}">${list.map(pair).join('')}</main>`);
    const wide = Math.ceil((2 * H * list[0].panel.crop[2]) / list[0].panel.crop[3]) + 24;
    await page.setViewportSize({ width: i < pairs.length ? wide : 2400, height: 600 });
    await page.goto(`file://${html}`);
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    fs.rmSync(html);
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
