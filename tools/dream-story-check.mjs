// Actual chapter getters and return-cue branch; physics/checkpoints are covered by sky-mirror-logic-check.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {transformSync} from 'rolldown/utils';
registerHooks({resolve(s,c,n){return n(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);},
  load(u,c,n){return u.endsWith('.ts')?{format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:n(u,c);}});
globalThis.location={search:'?shot'};
const {SkyMirrorChapter}=await import('../src/story/sky-mirror.ts');
const {DrownedChapter}=await import('../src/story/drowned.ts');
const {takeCues}=await import('../src/story/cues.ts');
const {MIRROR_STARS}=await import('../src/world/sky-mirror-layout.ts');
const mirror=Object.getOwnPropertyDescriptor(SkyMirrorChapter.prototype,'mirrorScore').get;
const drowned=Object.getOwnPropertyDescriptor(DrownedChapter.prototype,'drownedScore').get;
const room={progress:0,stars:MIRROR_STARS.map(()=>({state:'fallen'})),holdingWand:true};
const m={beat:'play',cast:{skyMirror:room}};
for(const [progress,phase] of [[0,'search'],[1,'one'],[2,'two'],[3,'three'],[4,'constellation']]) {
  room.progress=progress;assert.equal(mirror.call(m),phase);
}
m.beat='jetty';assert.equal(mirror.call(m),'depart');
room.progress=0;room.holdingWand=false;assert.equal(mirror.call(m),'approach');
for(const [beat,stirred,t,phase] of [['enter',false,0,'rooftops'],['drift',false,2,'rooftops'],
  ['still',false,40,'still'],['drift',true,0,'resume'],['gather',true,15,'gather'],
  ['snatch',true,2,'loss'],['after',true,3,'loss'],['after',true,13,'after']])
  assert.equal(drowned.call({beat,stirred,t}),phase);

// Four actual returns must each emit exactly one star cue; an existing completed save emits none.
const child={},plane={held:false},cygnet={};
const c=Object.create(SkyMirrorChapter.prototype);
Object.assign(c,{beat:'play',elapsed:0,returned:0,cast:{skyMirror:room,child,cygnet,plane},
  driftBoat(){},frame(){},walkToStar(){},nearest(){return 0;},to(beat){this.beat=beat;},companion:{update(){}}});
room.carried=null;room.bubbles=[];room.requestedStar=-1;room.aim={};room.holdingWand=true;
takeCues();
for(let progress=1;progress<=room.stars.length;progress++){
  c.beat='play';room.progress=progress;c.update(1/60,progress);
  assert.deepEqual(takeCues(),['star']);
  c.beat='play';c.update(1/60,progress+.1);assert.deepEqual(takeCues(),[]);
}
c.returned=room.progress;c.beat='play';c.update(1/60,10);assert.deepEqual(takeCues(),[]);
console.log('Chapter audio phases, all four star events, event de-duplication and restored completion pass.');
