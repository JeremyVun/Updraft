// Capture each room with nobody in it, in one browser session: the references the title screen's room paintings are
// made from (the regenerate script in assets/art-direction/continue/ takes one of these and writes the painting and its
// chapter-select tile). Usage: node tools/chapter-stills.mjs [room ...] (BASE defaults to http://127.0.0.1:5230/).
// Writes 1600x1000 PNGs to OUT (default /tmp/updraft-chapter-stills). Run against a dev server whose source nobody
// else is editing.
import { openBrowser } from './lib/browser.mjs';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const out = process.env.OUT ?? '/tmp/updraft-chapter-stills';

/**
 * `setup` runs with `g` (`__game`), `c` (the current chapter) and `h` (ground height at x, z) once the room is
 * ready. It may return [eye, target] as world [x, y, z] pairs to hold the camera there; otherwise the chapter's
 * own camera frames the room.
 */
const ROOMS = {
  island: { query: 'progress=0' },
  washing: { query: 'chapter=washing' },
  boats: { query: 'chapter=boats' },
  meadow: { query: 'chapter=piano', setup: `c.wake(4, true);
    const p = g.piano.group.position; return [[p.x + 7, h(p.x + 7, p.z + 9) + 2.6, p.z + 9], [p.x - 2, p.y + 0.4, p.z - 6]];` },
  birches: { query: 'chapter=birches', setup: `const { BIRCHES_LANDING: l } = await import('/src/world/birches.ts');
    return [[l.x, h(l.x, l.y - 8) + 4.5, l.y - 8], [l.x + 3, h(l.x + 3, l.y - 34) + 2, l.y - 34]];` },
  stairs: { query: 'chapter=stairs', setup: `const L = await import('/src/world/stairs-layout.ts');
    const f = L.STAIRS_LOOK_FROM, t = L.flight(7).landing;
    return [[f.x + 2, L.STAIRS_GROUND + 1.2, f.z - 4], [t.x, t.y - 2, t.z]];` },
  drowned: { query: 'chapter=drowned' },
  wood: { query: 'chapter=wood', setup: `const p = c.ahead.p; g.embers.blow(c.ahead, 1);
    return [[p.x + 2.2, h(p.x + 2.2, p.z + 4.5) + 1.3, p.z + 4.5], [p.x, p.y + 0.5, p.z]];` },
  sleeping: { query: 'chapter=sleeping', setup: `const { BED: b } = await import('/src/world/sleeping.ts');
    return [[b.x + 6, h(b.x + 6, b.z + 4) + 1.8, b.z + 4], [b.x - 3, b.y + 0.2, b.z - 1.5]];` },
  sea: { query: 'chapter=sea&dusk=1&whale', wait: 14000 },
  mirror: { query: 'chapter=mirror' },
  home: { query: 'chapter=jetty' },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ROOMS);
fs.mkdirSync(out, { recursive: true });
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  for (const name of names) {
    const room = ROOMS[name];
    await page.goto(`${base}?shot=1&${room.query}${process.env.QUERY ? '&' + process.env.QUERY : ''}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await page.evaluate(async setup => {
      const g = __game, c = g.story.current, { heightAt: h } = await import('/src/world/island.ts');
      const look = await new Function('g', 'c', 'h', `return (async () => { ${setup} })()`)(g, c, h);
      if (!look) return;
      g.rig.fixed = true;
      g.rig.camera.position.set(...look[0]);
      g.rig.camera.lookAt(...look[1]);
    }, room.setup ?? '');
    await page.waitForTimeout(room.wait ?? 6000);
    // Nobody is in the rooms. Chapters show the travellers and their plane again every frame, so they are held hidden.
    await page.evaluate(() => {
      const g = __game;
      for (const who of [g.child, g.cygnet, g.glider]) {
        who.visible = false;
        Object.defineProperty(who, 'visible', { get: () => false, set() {} });
      }
    });
    await page.waitForTimeout(300);
    const png = `${out}/${name}.png`;
    await page.screenshot({ path: png });
    console.log(png);
  }
} finally {
  await close();
}
