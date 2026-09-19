// The irregular musical front must be permanent, bounded and shared with its visible curls.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return n(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c)}});
const {musicLife,musicDistance,musicFront}=await import('../src/world/music-growth.ts');
for(let i=0;i<180;i++){
  const a=i*2.399963,r=3+i*1.7,x=Math.sin(a)*r,z=Math.cos(a)*r;
  let previous=0;
  for(let radius=13;radius<=360;radius+=2){
    const life=musicLife(x,z,radius,4);
    assert(life>=previous-1e-10,'earned colour must never retreat as the music advances');
    previous=life;
  }
  assert.equal(previous,1,'the final front covers the full meadow');
}
for(const radius of [13,25,45,85,125,300])for(let i=0;i<64;i++){
  const a=i*Math.PI/32,r=musicFront(radius,a);
  assert(Math.abs(musicDistance(Math.sin(a)*r,-Math.cos(a)*r)-radius)<.08,'visible curl and colour front agree');
}
for(const r of [0,3,7,12,13])assert(Math.abs(musicLife(r,0,13,4)-Math.max(0,Math.min(1,(13-r)/4)))<1e-10,'arrival patch stays unchanged');
console.log('PASS: colour never retreats, final coverage, initial patch, and visible front agree.');
