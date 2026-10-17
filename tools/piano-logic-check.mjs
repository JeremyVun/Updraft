// Pure gesture checks: node tools/piano-logic-check.mjs (Node's TypeScript stripping).
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PianoStroke, guideShape } from '../src/world/piano-stroke.ts';
const tolerance = 0.11, half = 0.25;
const place = phrase => (t, out) => guideShape(phrase, t, 1, out).multiplyScalar(half);
const at = (phrase, t, off = 0) => { const p = place(phrase)(t, new THREE.Vector2()); p.y += off; return p; };
const move = (s, phrase, from, to, frames, off = 0) => {
  for (let i = 1; i <= frames; i++) s.follow(at(phrase, from + (to - from) * (i - 1) / frames, off), at(phrase, from + (to - from) * i / frames, off), tolerance);
  return s.progress;
};
for (const fps of [30, 60, 120]) for (let phrase = 0; phrase < 4; phrase++) {
  const s = new PianoStroke();
  s.lay(place(phrase));
  assert(move(s, phrase, 0, 1, fps) > 0.99, `deliberate trace at ${fps} fps`);
  s.reset();
  for (let i = 0; i < fps * 90; i++) s.follow(at(phrase, 0.5), at(phrase, 0.5), tolerance);
  assert.equal(s.progress, 0, 'idle does not progress');
  assert.equal(move(s, phrase, 0, 1, fps, 0.2), 0, 'off-target motion does not progress');
  assert.equal(move(s, phrase, 1, 0, fps), 0, 'the wrong way from the far end does not progress');
  for (let i = 0; i < fps * 10; i++) { move(s, phrase, 0.1, 0.12, 1); move(s, phrase, 0.12, 0.1, 1); }
  assert(s.progress < 0.15, 'scribbling near the start cannot accumulate an answer');
  s.reset(); move(s, phrase, 0, 0.2, fps / 4); const partial = s.progress;
  move(s, phrase, 0.8, 0.95, fps / 4);
  assert.equal(s.progress, partial, 're-entry at the end cannot skip the middle');
  assert(move(s, phrase, 0.2, 1, fps) > 0.99, 'an interrupted trace can resume');
}
console.log('Piano gestures pass at 30/60/120 fps for all four guides: trace, idle, wrong way, off-target, scribble and resume.');
