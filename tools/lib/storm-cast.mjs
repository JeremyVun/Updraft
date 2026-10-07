// A headless cast for the drowned village's storm, for the CPU checks: the real boat, child, cygnet, cat and village
// with the plane and the wind lines stubbed, started as `?chapter=storm` starts, with her just seated aboard at the
// nave and the fog closed round.
import './typescript.mjs';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ getContext: () => ({ beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {} }) }) };
globalThis.location ??= { search: '?shot' };
globalThis.window ??= { matchMedia: () => ({ matches: false }) };
const { Boat } = await import('../../src/traveller/boat.ts');
const { Traveller } = await import('../../src/traveller/traveller.ts');
const { Cygnet } = await import('../../src/creatures/cygnet.ts');
const { Cat } = await import('../../src/creatures/cat.ts');
const { DrownedChapter } = await import('../../src/story/drowned.ts');
const { DrownedVillage } = await import('../../src/world/drowned.ts');
const { DESCENT_END } = await import('../../src/world/stairs-layout.ts');

/** The cast as the stairs set the boat down at the drowned village; `wind` is the field the boat and the village read. */
export function drownedCast(wind) {
  const boat = new Boat(wind), child = new Traveller(wind), cygnet = new Cygnet(), cat = new Cat();
  cygnet.mount = child;
  cygnet.visible = true;
  const plane = { held: true, visible: true, homeRadius: 0, position: new THREE.Vector3(), hold() {},
    launch(p) { this.position.copy(p); this.held = false; }, depart() {} };
  const cast = { boat, child, cygnet, cat, wind, plane, village: new DrownedVillage(wind), lines: { gust() {} },
    sealife: { fishNear() {}, dolphinsWith() {}, whale: null, dolphinShow: null } };
  boat.beach(DESCENT_END.x, DESCENT_END.y, -1.9);
  child.ride(boat.seat(new THREE.Vector3()), boat.yaw);
  boat.launch();
  return cast;
}

/** The cast and the chapter, already at the storm's start. */
export function stormCast(wind) {
  const cast = drownedCast(wind);
  const chapter = new DrownedChapter(cast);
  chapter.skipToRun();
  chapter.skipToStorm();
  return { cast, chapter };
}
