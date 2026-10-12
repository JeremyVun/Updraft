// Persistent, recoverable seed transfers at 30/60/120 Hz. NEGATIVE=1 permits idle drift and must fail.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
const { MeadowSeeds } = await import('../src/world/meadow-seeds.ts');

for(const fps of [30,60,120]) {
  const s = new MeadowSeeds(),dt=1/fps;
  s.release();
  for(let i=0;i<fps*40;i++) { if(process.env.NEGATIVE)s.blow(dt*.3); s.update(dt); }
  assert.equal(s.completed,0,'idle cannot complete');
  assert.equal(s.progress,0,'idle starts at source');
  for(let i=0;i<fps*3;i++) { s.blow(-dt*.3); s.update(dt); }
  assert.equal(s.progress,0,'opposing strokes cannot complete');
  for(let i=0;i<fps*3;i++) { s.blow(dt*.15); s.update(dt); }
  assert(s.progress>0.3&&s.progress<0.65,'a broad gentle effort makes partial progress');
  for(let i=0;i<fps*50;i++)s.update(dt);
  assert.equal(s.progress,0,'lost interest returns seeds safely to source');
  for(let round=0;round<2;round++) {
    for(let i=0;i<fps*20&&s.active;i++) { s.blow(dt*.15); s.update(dt); }
    assert.equal(s.completed,round+1);
    assert.equal(s.active,false);
    for(let i=0;i<fps*30;i++)s.update(dt);
    assert.equal(s.completed,round+1,'completed blooms persist');
    if(round===0)s.release();
  }
  s.reset(1);assert.equal(s.completed,1);s.release();
  assert.equal(s.progress,0);assert(s.active,'resume remaining transfer');
  s.reset(2);s.release();assert(!s.active,'completed saves never replay');
  console.log(`PASS ${fps}fps: idle, direction, partial effort, recovery, two transfers, restoration.`);
}
