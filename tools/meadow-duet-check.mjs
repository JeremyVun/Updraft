import './lib/typescript.mjs';
import assert from 'node:assert/strict';
globalThis.location={search:'?shot'};
globalThis.window={innerWidth:1600,innerHeight:900,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {PianoStop}=await import('../src/story/piano.ts');
const {piano}=await import('../src/world/piano.ts');
const {windBough}=await import('../src/world/wind-bough.ts');
const {MEADOW_CALLS,MEADOW_FINALE}=await import('../src/audio/meadow-duet.ts');
const {tuning}=await import('../src/tuning.ts');

for(const fps of [30,60,120]){
  windBough.reset();piano.matched=0;piano.expect=null;
  const stop=new PianoStop(),wakes=[];
  const cast={child:{reachFor(){},lean:0},carry:{busy:false,unstow(){} }};
  stop.onWake=stage=>wakes.push(stage);
  let time=0;
  const step=()=>{time+=1/fps;stop.now=time;stop.duet(time,cast);stop.wakeIsland(time);};
  const until=condition=>{const end=time+35;while(!condition()&&time<end)step();assert(condition(),'duet transition timed out');};
  until(()=>windBough.log.length===1);
  const call=windBough.log[0];
  until(()=>time>=call.at+tuning.windBough.inhale+MEADOW_CALLS[0].call.duration-.1);
  assert.equal(piano.expect,null,'the call must finish before the piano can accept an answer');
  assert.equal(piano.matched,0);assert.deepEqual(wakes,[],'calls cannot restore the meadow');
  until(()=>!!piano.expect);
  piano.gesture.step(0,.25,0,tuning.piano.guideTolerance);
  const partial=piano.gesture.progress;
  const count=windBough.log.length;
  until(()=>time>stop.sayAt+2);
  assert.equal(windBough.log.length,count,'a partial reply must not be interrupted by another call');
  assert.equal(piano.gesture.progress,partial,'partial reply must survive waiting');
  for(let answer=1;answer<=4;answer++){
    piano.matched++;piano.expect=null;step();
    if(answer<4){
      assert.deepEqual(wakes,Array.from({length:answer},(_,i)=>i+1));
      until(()=>!!piano.expect);
    }
  }
  const final=windBough.log.at(-1);
  assert(final.finale);assert.equal(wakes.length,3,'last reply waits for the bough finale to turn the hills green');
  const green=final.at+tuning.windBough.inhale+MEADOW_FINALE.greenAt;
  until(()=>time>=green-2/fps);
  assert.equal(wakes.length,3,'final greening must not precede its musical cue');
  until(()=>wakes.length===4);
  assert(time>=green&&time<green+2/fps);
  assert(stop.finishedAt>=final.at+tuning.windBough.inhale+MEADOW_FINALE.duration);
  stop.restoreDone();assert(!windBough.sounding(time));assert.equal(piano.expect,null);
  console.log(`PASS ${fps}fps: call/listen/reply, retained partial input, four answers, final bough cue and restored completion.`);
}

{
  const {MEADOW_ANSWERS}=await import('../src/audio/meadow-duet.ts');
  const {meadowFilesAhead}=await import('../src/audio/meadow-music.ts');
  const {MeadowChapter}=await import('../src/story/meadow.ts');
  for(const answer of MEADOW_ANSWERS){
    assert(answer.notes.length>=4,'every answer has its notes');
    assert(answer.notes.every((n,i)=>i===0||n.share>answer.notes[i-1].share),'notes sound in order along the trace');
    assert(answer.notes[0].share>0&&answer.notes.at(-1).share<1,'the first note waits for the stroke, the last comes before completion');
    assert(answer.outline.every(([,h])=>h>=-1&&h<=1)&&new Set(answer.outline.map(([,h])=>h)).size>1,'the outline rises and falls');
  }
  assert.deepEqual(MEADOW_ANSWERS.map(a=>a.direction),[1,-1,1,-1],'the mirrored sweeps still alternate');
  for(const {call} of MEADOW_CALLS)assert(call.startAt<=0&&call.startAt>=-tuning.windBough.inhale&&call.duration>2,'each call starts within the inhale');
  assert(MEADOW_FINALE.greenAt>0&&MEADOW_FINALE.greenAt<MEADOW_FINALE.duration,'the greening falls inside the finale');
  const part=Object.getOwnPropertyDescriptor(MeadowChapter.prototype,'meadowMusic').get;
  const room=(at,extra={})=>({piano:{at},song:{beat:'ahead'},beat:'walk',duetDone:false,featherFrom:-1,endingDue:false,crestDone:false,...extra});
  for(const at of ['ahead','walking','looking'])assert.equal(part.call(room(at)),'walk');
  for(const at of ['sitting','seated'])assert.equal(part.call(room(at)),'duet');
  assert.equal(part.call(room('leaving',{duetDone:true})),'after','the warm bed begins with the duet complete');
  assert.equal(part.call(room('done',{song:{beat:'play'}})),'after');
  assert.equal(part.call(room('done',{song:{beat:'listen'}})),'listen');
  assert.equal(part.call(room('done',{song:{beat:'done'}})),'quiet');
  assert.equal(part.call(room('done',{song:{beat:'done'},beat:'pond',crestDone:true})),'quiet','the family leaves in silence');
  assert.equal(part.call(room('done',{song:{beat:'done'},beat:'pond',crestDone:true,featherFrom:3})),'ending');
  assert.equal(part.call(room('done',{song:{beat:'done'},crestDone:true,endingDue:true})),'ending','a pond restore plays the ending');
  assert.deepEqual(meadowFilesAhead('boats',undefined,true),['walk','duet']);
  assert.deepEqual(meadowFilesAhead('meadow','duet',true),['duet','after','ending']);
  assert.deepEqual(meadowFilesAhead('meadow','duet',false),['duet'],'music off still fetches the duet: it is the instruments');
  assert.deepEqual(meadowFilesAhead('birches',undefined,true),[]);
  console.log('PASS: recorded answers, calls, finale cue, the meadow music parts and what is fetched ahead.');
}
