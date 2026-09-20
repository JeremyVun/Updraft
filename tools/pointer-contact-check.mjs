// Pointer ownership, cancellation and page lifecycle; no browser/GPU required.
// Usage: node tools/pointer-contact-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';

registerHooks({
  resolve(s, c, next) { return next(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s, c); },
  load(u, c, next) {
    return u.endsWith('.ts')
      ? { format: 'module', shortCircuit: true, source: transformSync(new URL(u).pathname, fs.readFileSync(new URL(u), 'utf8')).code }
      : next(u, c);
  },
});
globalThis.location = { search: '?shot' };
const { PointerInput } = await import('../src/input/pointer.ts');

function fixture() {
  const document = Object.assign(new EventTarget(), { hidden: false, defaultView: new EventTarget() });
  const element = Object.assign(new EventTarget(), {
    ownerDocument: document,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
    setPointerCapture() {},
  });
  const input = new PointerInput(element);
  // Isolate event handling from terrain: a screen coordinate maps to a known ground point.
  input.pick = (_camera, ndc, out) => out.set(ndc.x * 10, 0, ndc.y * 10);
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 1000);
  const splats = [], buttons = [];
  input.onButton(kind => buttons.push(kind));
  const tick = () => { input.beginFrame(); input.update(1 / 60, camera, { addSplat: s => splats.push(s) }, 1); };
  const event = (type, values = {}) => element.dispatchEvent(Object.assign(new Event(type), {
    pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0, clientX: 200, clientY: 500, ...values,
  }));
  return { input, document, tick, event, splats, buttons };
}

const tests = {
  'secondary contact cannot move or release the primary stroke'() {
    const f = fixture();
    f.event('pointerdown'); f.tick();
    f.event('pointermove', { clientX: 250 }); f.tick();
    const at = f.input.ndc.clone();
    f.event('pointerdown', { pointerId: 2, isPrimary: false, clientX: 850 });
    f.event('pointermove', { pointerId: 2, isPrimary: false, clientX: 900 }); f.tick();
    assert(f.input.ndc.equals(at), 'second finger must not reposition the stroke');
    f.event('pointerup', { pointerId: 2, isPrimary: false });
    assert(f.input.down && f.input.present, 'lifting a second finger must not end the first');
    assert.deepEqual(f.buttons, ['down']);
    f.event('pointermove', { clientX: 350 }); f.tick();
    assert(f.input.gust > 0, 'primary touch still supplies wind');
    f.event('pointerup'); assert(!f.input.down && !f.input.present);
  },
  'another primary pointer type cannot steal an active stroke'() {
    const f = fixture(); f.event('pointerdown'); f.tick();
    const at = f.input.ndc.clone();
    f.event('pointermove', { pointerType: 'mouse', pointerId: 8, clientX: 800 }); f.tick();
    assert(f.input.ndc.equals(at));
    f.event('pointerup', { pointerType: 'mouse', pointerId: 8 });
    assert(f.input.down);
  },
  'cancel and lost capture discard pending motion and lift'() {
    for (const type of ['pointercancel', 'lostpointercapture']) {
      const f = fixture(); f.event('pointerdown'); f.tick();
      f.event('pointermove', { clientX: 800 }); f.input.charge = .8;
      f.event(type); const count = f.splats.length; f.tick();
      assert(!f.input.down && !f.input.present, type);
      assert.equal(f.input.gust, 0, type); assert.equal(f.input.charge, 0, type);
      assert.equal(f.splats.length, count, type);
      f.event('pointermove', { clientX: 900 }); f.tick();
      assert(!f.input.present && !f.input.down, 'cancelled touch cannot return as hover');
      assert.equal(f.splats.length, count);
      f.event('pointerdown', { pointerId: 3, clientX: 700 }); f.tick();
      assert.equal(f.splats.length, count, 'new contact must not bridge to cancelled one');
    }
  },
  'blur, hidden pages, pagehide and resize discard stale contact'() {
    for (const type of ['blur', 'visibilitychange', 'pagehide', 'resize']) {
      const f = fixture(); f.event('pointerdown'); f.tick();
      f.event('pointermove', { clientX: 800 }); f.input.charge = .8;
      if (type === 'visibilitychange') { f.document.hidden = true; f.document.dispatchEvent(new Event(type)); }
      else f.document.defaultView.dispatchEvent(new Event(type));
      assert(!f.input.present && !f.input.down, type);
      f.document.hidden = false; f.tick();
      assert.equal(f.splats.length, 0, 'returning to the page must not play a stale stroke');
      assert.equal(f.input.charge, 0);
    }
  },
  'mouse hover and ordinary touch release keep their existing behavior'() {
    const f = fixture();
    f.event('pointermove', { pointerType: 'mouse', clientX: 200 }); f.tick();
    f.event('pointermove', { pointerType: 'mouse', clientX: 400 }); f.tick();
    assert(f.input.gust > 0 && !f.input.down, 'hover still makes wind');
    f.event('pointerdown', { pointerType: 'mouse', clientX: 400 });
    f.event('pointerup', { pointerType: 'mouse', clientX: 400 });
    assert(f.input.present && !f.input.down, 'mouse remains available after release');
    const t = fixture(); t.event('pointerdown'); t.tick();
    t.event('pointermove', { clientX: 400 }); t.tick();
    const gust = t.input.gust;
    t.event('pointerup'); t.event('lostpointercapture'); t.tick();
    assert(t.input.gust > 0 && t.input.gust < gust, 'normal release retains its soft decay');
    const count = t.splats.length;
    t.event('pointerdown', { pointerId: 4, clientX: 800 }); t.tick();
    assert.equal(t.splats.length, count, 'fresh touch cannot bridge between contacts');
  },
};
let failed = 0;
for (const [name, test] of Object.entries(tests)) {
  try { test(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
assert.equal(failed, 0, `${failed} pointer contact checks failed`);
