// Stills of the birches' red squirrel: every held pose, its face, ear tufts and tail close to, and its play beside
// the child and the cygnet at the round frames' distance in the birches themselves, portrait and landscape.
// Usage: node tools/squirrel-check.mjs [out-dir]     (needs a DEV server: BASE as for tools/play.mjs)
//   MODES=poses,close,room (default all three):
//     poses  On the QA stage's squirrel yard (?chapter=stage, `__game.story.current.play('squirrel:<pose>')`, a
//            round of birch litter out on the sea with a heap, a fallen birch and a standing one with a low limb),
//            each pose framed whole from three-quarters in front (pose-<name>.png) and from its other side
//            (pose-<name>-b.png), and all of them on one sheet (sheet-poses.png). Prints each pose's contact: how
//            far the deepest vertex is inside the floor, log, trunk or limb (clip; the heap is leaves and does not
//            count), and each paw's gap to the nearest of them (front L R, hind L R).
//     close  The face, the ear tufts, the tail and the back, close to (close-*.png, sheet-close.png).
//     room   ?chapter=birches: round 1's place staged by eval (heap 0 from `BIRCH_PILES`, the child at its near rim,
//            the cygnet beside her, the squirrel at the heap's edge), posed sitting (with its nut), scolding and
//            peeking from the heap's shoulder, shot through the game's own lens
//            (its vertical field of view for the aspect) from three-quarters behind her at 15 m and 17 m, at
//            1600x900 and 390x844 (room-<w>x<h>-<pose>-<m>m.png, sheet-room.png). Prints the squirrel's height on
//            screen in pixels (its skinned vertices projected), the measure the plan's portrait gate uses.
//   env: POSES=sit,perch picks poses; ROOM_POSES=sit,scold; LIGHT=<query> replaces the room light (e.g. dusk=0.7);
//        SCALE=2.3 draws the squirrel at another size than `tuning.squirrel.scale` (its life-size multiple).
// Traps:
//   - Dev server only: the room mode imports `/src/world/island.ts` and `/src/world/birches.ts` into the page for
//     the ground height and the heaps, which a production or QA preview build does not serve. The heap's own height
//     is the live litter field's, not the ground's: a pose inside it is judged by eye.
//   - The world is held still (`params.hold`) between shots and stepped a whole number of frames; anything set by
//     eval needs a step (`advance`) before it is drawn, and the squirrel eases into a pose over about half a second.
//   - Blinks and glances are random. Each pose puts off the next blink; glances are left alone (they are its life).
//   - The lens is set by hand on a held world; set `post.focusOn` round the subject or the depth of field blurs it.
//   - Vertex maths here mirrors the shader's skinning (two bones per vertex, `aSkin` = bone, bone, share); whiskers
//     and a hidden nut are left out of every measurement.
//   - One browser at a time across sessions: `lib/browser.mjs` holds a lock and waits for it.
//   - Phase 3b adds motion: give `shoot` a time list (frames after `play`) for strips, and use `measure` per frame.
import { openBrowser } from './lib/browser.mjs';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? '/tmp/updraft-squirrel-check');
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const list = (v, all) => (v ? v.split(',') : all);
const modes = list(process.env.MODES, ['poses', 'close', 'room']);

/** Each pose, and where the lens stands for it: bearing from the way it faces (to its left positive) and how high it looks down from. */
const POSES = {
  sit: { bearing: 0.7, elev: 0.2 },
  freeze: { bearing: 0.5, elev: 0.15 },
  scold: { bearing: 0.9, elev: 0.25 },
  perch: { bearing: 1.25, elev: 0.1 },
  'buried-out': { bearing: 1.3, elev: 0.55, distance: 4 },
  'buried-in': { bearing: 1.3, elev: 0.55, distance: 4 },
  peek: { bearing: 0.5, elev: 0.3, distance: 2.4 },
  bound: { bearing: 1.5, elev: 0.15 },
  climb: { bearing: 0.9, elev: 0.1 },
  stand: { bearing: 1.2, elev: 0.3 },
};
const poses = list(process.env.POSES, Object.keys(POSES));
const roomPoses = list(process.env.ROOM_POSES, ['sit', 'scold', 'peek']);

const { browser, close } = await openBrowser();
const errors = [];
const sheets = {};

async function open(query, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.evaluate(HELPERS);
  if (process.env.SCALE) await page.evaluate((k) => { window.__game.squirrel.scale = k; }, Number(process.env.SCALE));
  const advance = async (seconds) => {
    const from = await page.evaluate(() => window.__stats.frame);
    const to = from + Math.max(1, Math.round(seconds * 60));
    await page.evaluate((h) => { window.__game.params.hold = h; }, to);
    await page.waitForFunction((h) => window.__stats.frame >= h, to, { timeout: 120000, polling: 16 });
  };
  return { context, page, advance };
}

/** Page-side: the squirrel's skinned vertices as the shader places them, and a lens set by hand. */
const HELPERS = `(() => {
  const sq = () => window.__game.squirrel;
  const mul = (e, x, y, z) => [e[0]*x + e[4]*y + e[8]*z + e[12], e[1]*x + e[5]*y + e[9]*z + e[13], e[2]*x + e[6]*y + e[10]*z + e[14]];
  window.__sq = {
    /** World positions of every vertex but whiskers (5) and a hidden nut (6), each with the bone it hangs off. */
    verts() {
      const s = sq();
      const g = s.mesh.geometry.attributes;
      const nut = s.lookNow.nut;
      const out = [];
      for (let i = 0; i < g.position.count; i++) {
        const m = Math.round(g.aMat.getX(i));
        if (m === 5 || (m === 6 && !nut)) continue;
        const x = g.position.getX(i), y = g.position.getY(i), z = g.position.getZ(i);
        const a = mul(s.rig.bones[g.aSkin.getX(i)].elements, x, y, z);
        const k = g.aSkin.getZ(i);
        const p = k > 0 ? mul(s.rig.bones[g.aSkin.getY(i)].elements, x, y, z).map((v, j) => a[j] + (v - a[j]) * k) : a;
        out.push({ p, bone: g.aSkin.getX(i), mat: m });
      }
      return out;
    },
    bounds() {
      const vs = this.verts();
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const { p } of vs) for (let j = 0; j < 3; j++) { min[j] = Math.min(min[j], p[j]); max[j] = Math.max(max[j], p[j]); }
      const c = min.map((v, j) => (v + max[j]) / 2);
      const r = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
      return { min, max, c, r };
    },
    /** Its box on screen, in CSS pixels. */
    screen() {
      const cam = window.__game.rig.camera;
      cam.updateMatrixWorld();
      const v = window.__game.squirrel.position.clone();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const { p } of this.verts()) {
        v.set(p[0], p[1], p[2]).project(cam);
        const x = (v.x * 0.5 + 0.5) * innerWidth, y = (0.5 - v.y * 0.5) * innerHeight;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
    },
    lens(eye, aim, fov) {
      const { rig, post } = window.__game;
      const cam = rig.camera;
      cam.position.set(...eye);
      cam.lookAt(...aim);
      if (fov) cam.fov = fov;
      cam.near = 0.03;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      const far = Math.hypot(eye[0] - aim[0], eye[1] - aim[1], eye[2] - aim[2]);
      post.focusOn(far - Math.max(0.3, far * 0.1), far + Math.max(0.3, far * 0.1));
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
    /** Put off its next blink, so a still never catches its eyes half shut. */
    calm() { const s = sq(); s.nextBlink = 60; s.blinkT = -1; },
  };
})()`;

/** Frames the whole squirrel from `bearing` off the way it faces (off the bark's outward normal when it climbs). */
async function frameWhole(page, { bearing, elev, distance = 0 }, fov = 28, margin = 1.15) {
  return page.evaluate(async ([bearing, elev, fov, margin, distance]) => {
    const s = window.__game.squirrel;
    const b = window.__sq.bounds();
    const facing = s.up.y > 0.9 ? s.yaw : Math.atan2(s.up.x, s.up.z);
    const a = facing + bearing;
    const d = distance || (b.r * margin) / Math.sin(((fov / 2) * Math.PI) / 180);
    const eye = [b.c[0] + Math.sin(a) * Math.cos(elev) * d, b.c[1] + Math.sin(elev) * d, b.c[2] + Math.cos(a) * Math.cos(elev) * d];
    await window.__sq.lens(eye, b.c, fov);
    return d;
  }, [bearing, elev, fov, margin, distance]);
}

async function contact(page) {
  return page.evaluate(async () => {
    const { squirrel: s, story } = window.__game;
    const yard = story.current.squirrels;
    const body = await import('/src/creatures/squirrel/body.ts');
    const paws = [body.HAND_L, body.HAND_R, body.FOOT_L, body.FOOT_R];
    const tail = new Set(body.TAIL);
    const v = s.position.clone();
    let clip = Infinity, where = '';
    const gaps = [Infinity, Infinity, Infinity, Infinity];
    for (const { p, bone } of window.__sq.verts()) {
      const g = yard.gap(v.set(p[0], p[1], p[2]));
      if (g < clip && !tail.has(bone)) { clip = g; where = `bone ${bone}`; }
      const i = paws.indexOf(bone);
      if (i >= 0) gaps[i] = Math.min(gaps[i], g);
    }
    return { clip, where, gaps };
  });
}

const shoot = async (page, file, clip) => {
  await page.waitForTimeout(120);
  await page.screenshot({ path: file, clip });
  return file;
};

try {
  if (modes.includes('poses') || modes.includes('close')) {
    const { context, page, advance } = await open('chapter=stage&grass=0', 900, 900);
    await advance(1);
    if (modes.includes('poses')) {
      sheets.poses = [];
      for (const pose of poses) {
        await page.evaluate((p) => { window.__game.story.current.play(`squirrel:${p}`); window.__sq.calm(); }, pose);
        await advance(1.6);
        await frameWhole(page, POSES[pose]);
        sheets.poses.push({ file: await shoot(page, path.join(out, `pose-${pose}.png`)), label: pose });
        await frameWhole(page, { ...POSES[pose], bearing: -POSES[pose].bearing - 0.3, elev: POSES[pose].elev + 0.15 });
        sheets.poses.push({ file: await shoot(page, path.join(out, `pose-${pose}-b.png`)), label: `${pose}, other side` });
        const c = await contact(page);
        console.log(`${pose.padEnd(11)} clip ${(c.clip * 1000).toFixed(1).padStart(6)} mm (${c.where})  paws ${c.gaps.map((g) => (g * 1000).toFixed(1)).join(' ')} mm`);
      }
    }
    if (modes.includes('close')) {
      sheets.close = [];
      await page.evaluate(() => { window.__game.story.current.play('squirrel:sit'); window.__sq.calm(); });
      await advance(1.6);
      /** The head: from the joint between the eyes, a span about its own size. */
      const head = (bearing, elev, span) => page.evaluate(async ([bearing, elev, span]) => {
        const s = window.__game.squirrel;
        const h = s.eye(s.position.clone());
        const q = s.rig.nodes[5].getWorldQuaternion(s.rig.nodes[5].quaternion.clone());
        const fwd = s.position.clone().set(0, 0, 1).applyQuaternion(q);
        const aim = h.clone().addScaledVector(fwd, 0.02 * s.scale).add(s.position.clone().set(0, 0.006 * s.scale, 0));
        const a = Math.atan2(fwd.x, fwd.z) + bearing;
        const d = 0.6;
        const fov = (2 * Math.atan(span / 2 / d) * 180) / Math.PI;
        await window.__sq.lens([aim.x + Math.sin(a) * Math.cos(elev) * d, aim.y + Math.sin(elev) * d, aim.z + Math.cos(a) * Math.cos(elev) * d], [aim.x, aim.y, aim.z], fov);
      }, [bearing, elev, span]);
      await head(0.3, 0.05, 0.13);
      sheets.close.push({ file: await shoot(page, path.join(out, 'close-face.png')), label: 'face' });
      await head(1.35, 0.1, 0.13);
      sheets.close.push({ file: await shoot(page, path.join(out, 'close-profile.png')), label: 'profile' });
      await head(Math.PI - 0.7, 0.35, 0.15);
      sheets.close.push({ file: await shoot(page, path.join(out, 'close-tufts.png')), label: 'ear tufts from behind' });
      await frameWhole(page, { bearing: Math.PI / 2 + 0.25, elev: 0.1 }, 20, 1.05);
      sheets.close.push({ file: await shoot(page, path.join(out, 'close-tail.png')), label: 'tail, side on' });
      await frameWhole(page, { bearing: Math.PI - 0.35, elev: 0.3 }, 20, 1.05);
      sheets.close.push({ file: await shoot(page, path.join(out, 'close-back.png')), label: 'back and tail from behind' });
      await page.evaluate(() => window.__game.story.current.play('squirrel:perch'));
      await advance(1.6);
      await frameWhole(page, { bearing: Math.PI / 2, elev: 0.05 }, 20, 1.05);
      sheets.close.push({ file: await shoot(page, path.join(out, 'close-perch-tail.png')), label: 'perch, tail over its back' });
    }
    await context.close();
  }

  if (modes.includes('room')) {
    sheets.room = [];
    for (const [w, h] of [[1600, 900], [390, 844]]) {
      const { context, page, advance } = await open(`chapter=birches${process.env.LIGHT ? '&' + process.env.LIGHT : ''}`, w, h);
      await advance(9);
      for (const pose of roomPoses) {
        /**
         * Round 1's frame as the design draws it: heap 0 by the fallen log, the child at its near rim watching, the
         * cygnet beside her, the squirrel on the litter at the heap's west edge (peeking from the heap's shoulder).
         */
        await page.evaluate(async (pose) => {
          const { heightAt } = await import('/src/world/island.ts');
          const { BIRCH_PILES } = await import('/src/world/birches.ts');
          const { squirrel: s, child: c, cygnet: k } = window.__game;
          const heap = BIRCH_PILES[0];
          c.place(heap.x + 0.6, heap.z + heap.r + 0.9, Math.PI);
          c.stop();
          const at = s.position.clone().set(heap.x - heap.r * (pose === 'peek' ? 0.55 : 0.95), 0, heap.z + heap.r * (pose === 'peek' ? 0.45 : 0.2));
          at.y = heightAt(at.x, at.z);
          k.position.set(heap.x + 0.1, heightAt(heap.x + 0.1, heap.z + heap.r + 0.3), heap.z + heap.r + 0.3);
          k.yaw = Math.atan2(at.x - k.position.x, at.z - k.position.z);
          const yaw = Math.atan2(c.position.x - at.x, c.position.z - at.z) + (pose === 'peek' ? 0.3 : -0.5);
          s.visible = true;
          s.act(pose, { at, yaw, floor: (x, z) => heightAt(x, z), look: c.position.clone().setY(c.position.y + 0.9), nut: true });
          c.lookAt = s.position;
          k.watch(s.position);
          window.__sq.calm();
        }, pose);
        await advance(1.6);
        for (const metres of [15, 17]) {
          const size = await page.evaluate(async (metres) => {
            const { squirrel: s, child: c, rig } = window.__game;
            const aim = s.position.clone().lerp(c.position, 0.45);
            aim.y += 0.5;
            /** Side on to the line from her to the squirrel, from its down-ride side, so neither hides the other. */
            const v = s.position.clone().sub(c.position).setY(0).normalize();
            const dir = aim.clone().set(v.z, 0, -v.x).multiplyScalar(v.x < 0 ? 1 : -1).addScaledVector(v, -0.25).normalize();
            const flat = Math.sqrt(metres * metres - 3.8 * 3.8);
            await window.__sq.lens([aim.x + dir.x * flat, aim.y + 3.8, aim.z + dir.z * flat], [aim.x, aim.y, aim.z], null);
            return { ...window.__sq.screen(), fov: rig.camera.fov };
          }, metres);
          const file = path.join(out, `room-${w}x${h}-${pose}-${metres}m.png`);
          await shoot(page, file);
          const label = `${pose}, ${metres} m, ${w}x${h}: ${size.h.toFixed(0)} px tall (lens ${size.fov.toFixed(0)}°)`;
          console.log(label);
          sheets.room.push({ file, label, portrait: h > w });
          /** And the same frame cut close round it at full size, shown doubled: what a player's eye has to find. */
          const cx = Math.round((size.x0 + size.x1) / 2), cy = Math.round((size.y0 + size.y1) / 2);
          const half = 90;
          const clip = { x: Math.max(0, Math.min(w - 2 * half, cx - half)), y: Math.max(0, Math.min(h - 2 * half, cy - half)), width: 2 * half, height: 2 * half };
          const crop = path.join(out, `room-${w}x${h}-${pose}-${metres}m-crop.png`);
          await page.screenshot({ path: crop, clip });
          sheets.room.push({ file: crop, label: `${pose}, ${metres} m, ${w}x${h}, 1:1 doubled`, crop: true });
        }
      }
      await context.close();
    }
  }

  const page = await (await browser.newContext({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1 })).newPage();
  for (const [name, cells] of Object.entries(sheets)) {
    if (!cells.length) continue;
    const html = path.join(out, `sheet-${name}.html`);
    const tall = (c) => (c.crop ? 360 : name === 'room' ? (c.portrait ? 520 : 300) : 420);
    const img = (c) => `<figure><img src="${path.basename(c.file)}" style="height:${tall(c)}px${c.crop ? ';image-rendering:pixelated' : ''}"><figcaption>${c.label}</figcaption></figure>`;
    fs.writeFileSync(html, `<style>body{margin:0;background:#151515;color:#ddd;font:14px system-ui}main{display:flex;flex-wrap:wrap;gap:6px;padding:6px}figure{margin:0}img{display:block}figcaption{padding:2px 4px}</style><main>${cells.map(img).join('')}</main>`);
    await page.goto(`file://${html}`);
    const file = path.join(out, `sheet-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    fs.rmSync(html);
    console.log(file);
  }
} finally {
  await close();
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
