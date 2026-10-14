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
