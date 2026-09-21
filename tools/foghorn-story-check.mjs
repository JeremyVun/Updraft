// Actual Drowned weather event, stale-event suppression, and accepted synthesis/timing contract.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {transformSync} from 'rolldown/utils';
import {foghornProposal} from './lib/foghorn-proposal.mjs';
registerHooks({resolve(s,c,n){return n(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);},
  load(u,c,n){return u.endsWith('.ts')?{format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:n(u,c);}});
globalThis.location={search:'?shot'};
const {DrownedChapter}=await import('../src/story/drowned.ts');
const {Soundscape}=await import('../src/audio/audio.ts');
const {takeCues}=await import('../src/story/cues.ts');
const {tuning}=await import('../src/tuning.ts');
const {gatherAt,...approved}=foghornProposal;
assert.deepEqual(tuning.audio.foghorn,approved);
assert.equal(tuning.storm.foghornAt,gatherAt);
assert(tuning.storm.foghornAt+tuning.storm.foghornLateAllowance+approved.duration+approved.diffuseSeconds+.05
  <tuning.storm.firstLightning+tuning.storm.thunderDelay,'Latest permitted call drains before thunder');

function chapter(){
  const c=Object.create(DrownedChapter.prototype);
  Object.assign(c,{beat:'gather',stormTime:0,hornPassed:false,shook:false,sheltered:false,breeze:1,hush:.3,
    cast:{boat:{becalmed:0},cygnet:{mind:{perform(){},startle(){}}}}});
  return c;
}
function advance(c,dt){c.weather(dt,.7);return takeCues().filter(n=>n==='foghorn');}
for(const hz of [30,60,144]){
  const c=chapter(),heard=[];takeCues();
  for(let i=0;i<hz*35;i++){
    if(c.stormTime>=22)c.beat='snatch';
    if(c.stormTime>=26)c.beat='after';
    for(const cue of advance(c,1/hz))heard.push({cue,at:c.stormTime});
  }
  assert.equal(heard.length,1,`${hz} Hz: single passage call`);
  assert(heard[0].at>=8&&heard[0].at<=8+1/hz+1e-8);
}
for(const beat of ['enter','drift','still']){
  const c=chapter();c.beat=beat;assert.deepEqual(advance(c,120),[]);
  assert.equal(c.stormTime,0);assert.equal(c.hornPassed,false);
}
const stale=chapter();assert.deepEqual(advance(stale,12),[]);assert.equal(stale.hornPassed,true);
assert.deepEqual(advance(stale,.1),[]);
for(const beat of ['snatch','after']){
  const c=chapter();c.beat=beat;assert.deepEqual(advance(c,8),[]);
}
const restored=chapter();restored.restoreCheckpoint('sail',[2]);
assert.deepEqual(takeCues(),[]);assert.deepEqual(advance(restored,4),[]);
restored.beat='gather';assert.deepEqual(advance(restored,8),['foghorn']);
assert.deepEqual(advance(restored,.1),[]);
// Muted/hidden/not-started audio consumes the event without creating a delayed playback debt.
assert.equal(Soundscape.prototype.foghorn.call({running:false}),null);
console.log('Foghorn approval parity, frame-rate timing, once-only event, stale-event suppression, checkpoint and inactive-audio checks pass.');
