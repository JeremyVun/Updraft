// Pure gesture checks: node tools/piano-logic-check.mjs (Node's TypeScript stripping).
import assert from 'node:assert/strict';
import { PianoStroke } from '../src/world/piano-stroke.ts';
for (const fps of [30,60,120]) {
  const s=new PianoStroke();
  for(let i=1;i<=fps;i++)s.step((i-1)/fps,i/fps,0.02,0.045);
  assert.equal(s.progress,1,`deliberate sweep at ${fps} fps`);
  s.reset();for(let i=0;i<fps*90;i++)s.step(0.5,0.5,0,0.045);
  assert.equal(s.progress,0,'idle does not progress');
  for(let i=1;i<=fps;i++)s.step((i-1)/fps,i/fps,0.15,0.045);
  assert.equal(s.progress,0,'off-target motion does not progress');
  for(let i=1;i<=fps;i++)s.step(1-(i-1)/fps,1-i/fps,0,0.045);
  assert.equal(s.progress,0,'wrong direction does not progress');
  for(let i=0;i<fps*10;i++){s.step(0.1,0.12,0,0.045);s.step(0.12,0.1,0,0.045);}
  assert(s.progress<0.04,'tiny scribbling cannot accumulate an answer');
  s.reset();s.step(0,0.2,0,0.045);const partial=s.progress;
  s.step(0.8,0.95,0,0.045);assert.equal(s.progress,partial,'re-entry at the end cannot skip the middle');
  for(let i=1;i<=fps;i++)s.step(0.2+0.8*(i-1)/fps,0.2+0.8*i/fps,0,0.045);
  assert.equal(s.progress,1,'an interrupted sweep can resume');
}
console.log('Piano gestures pass at 30/60/120 fps: sweep, idle, wrong direction, off-target, scribble and resume.');
