import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
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
  piano.gesture.lay((t,out)=>out.set(-.3+.6*t,0));
  piano.gesture.follow(new THREE.Vector2(-.3,0),new THREE.Vector2(-.15,0),tuning.piano.guideTolerance*.3);
  assert(piano.gesture.progress>.2&&piano.gesture.progress<.3,'a stroke along part of the guide traces that part');
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
    assert(answer.notes.length>=4,'every answer has its onsets for her hands');
    assert(answer.notes.every((n,i)=>i===0||n.at>answer.notes[i-1].at),'onsets in order');
    assert(answer.end>answer.notes.at(-1).at&&answer.end<=answer.clip.duration,'its take hands over after its last note, within its cut');
    assert(Math.abs(answer.tilt)<=1,'the guide tilts gently');
  }
  for(const {call} of MEADOW_CALLS)assert(call.startAt<=0&&call.startAt>=-tuning.windBough.inhale&&call.duration>2,'each call starts within the inhale');
  assert(MEADOW_FINALE.greenAt>0&&MEADOW_FINALE.greenAt<MEADOW_FINALE.duration,'the greening falls inside the finale');
  const part=Object.getOwnPropertyDescriptor(MeadowChapter.prototype,'meadowMusic').get;
  const room=(at,extra={})=>({piano:{at},song:{beat:'ahead'},beat:'walk',duetDone:false,crestDone:false,cast:{flock:{active:true}},...extra});
  for(const at of ['ahead','walking','looking'])assert.equal(part.call(room(at)),'walk');
  for(const at of ['sitting','seated'])assert.equal(part.call(room(at)),'duet');
  assert.equal(part.call(room('leaving',{duetDone:true})),'after','the warm bed begins with the duet complete');
  assert.equal(part.call(room('done',{song:{beat:'play'}})),'after');
  for(const beat of ['listen','gather','done'])assert.equal(part.call(room('done',{song:{beat}})),'swans','the bed goes down a little for the family from the listening rest');
  for(const beat of ['crest','down','pond'])assert.equal(part.call(room('done',{song:{beat:'done'},beat,crestDone:true})),'swans');
  assert.equal(part.call(room('done',{song:{beat:'done'},beat:'pond',crestDone:true,cast:{flock:{active:false}}})),'boat','and comes back up once they are out of sight');
  assert.equal(part.call(room('done',{song:{beat:'done'},beat:'walk',crestDone:true,cast:{flock:{active:false}}})),'boat','a pond restore plays the warm bed from its loop');
  for(const beat of ['push','aboard'])assert.equal(part.call(room('done',{song:{beat:'done'},beat,crestDone:true,cast:{flock:{active:false}}})),'onward');
  const {meadowFilesAt,nextCloseSeam}=await import('../src/audio/meadow-music.ts');
  for(const p of ['after','swans','boat'])assert.deepEqual(meadowFilesAt(p),['after']);
  assert.deepEqual(meadowFilesAt('onward'),[]);
  assert.deepEqual(meadowFilesAhead('boats',undefined,true),['walk','duet']);
  assert.deepEqual(meadowFilesAhead('meadow','duet',true),['duet','after']);
  assert.deepEqual(meadowFilesAhead('meadow','swans',true),['after']);
  // The close waits for a phrase end on the pass under way, and finds one after the loop's wrap.
  const {MEADOW_MEASURED}=await import('../src/audio/meadow-cuts-measured.ts');
  const {seams,loopStart,loopEnd,close}=MEADOW_MEASURED.after,span=loopEnd-loopStart;
  assert(seams.length>=4&&close.duration-close.entry>5,'the warm bed has phrase ends into a close of its own');
  assert.equal(nextCloseSeam(100,100),100+seams[0]);
  assert.equal(nextCloseSeam(100,100+seams[0]+.01),100+seams[1]);
  const looping=seams.filter(s=>s>=loopStart);
  assert(Math.abs(nextCloseSeam(100,100+loopEnd)-(100+loopEnd+looping[0]-loopStart))<1e-9,'after the wrap, the first phrase end of the loop');
  assert(Math.abs(nextCloseSeam(100,100+loopEnd+span+looping.at(-1)-loopStart+.01)-(100+loopEnd+2*span+looping[0]-loopStart))<1e-9,'and again on later passes');
  for(const answer of MEADOW_ANSWERS)assert(answer.clip.duration-answer.end>5,'every answer rings on well past where its take moved on');
  assert.deepEqual(meadowFilesAhead('meadow','duet',false),['duet'],'music off still fetches the duet: it is the instruments');
  assert.deepEqual(meadowFilesAhead('birches',undefined,true),[]);
  // Left alone, the bough calls once and once more, softer, then waits.
  windBough.reset();piano.matched=0;piano.expect=null;
  const stop=new PianoStop(),cast={child:{reachFor(){},lean:0},carry:{busy:false,unstow(){}}};
  let time=0;
  for(let i=0;i<60*120;i++){time+=1/60;stop.now=time;stop.duet(time,cast);}
  assert.deepEqual(windBough.log.map(l=>l.trimDb),[0,tuning.meadowMusic.callAgainDb],'one call, one softer repeat, then silence');
  assert(Math.abs(windBough.log[1].at-windBough.log[0].at-(MEADOW_CALLS[0].call.duration+tuning.windBough.inhale+tuning.windBough.answerAfter+tuning.meadowMusic.callAgainAfter))<.05,'the repeat comes callAgainAfter after the reply opens');
  console.log('PASS: recorded answers, calls and their one repeat, finale cue, the meadow music parts and what is fetched ahead.');
}

{
  // Each phrase's guide is traced by a child's finger: wobbly, fast or slow, in one stroke or several; never by a leap.
  const {PianoStroke,guideShape}=await import('../src/world/piano-stroke.ts');
  const half=.3,tol=tuning.piano.guideTolerance*half,place=(phrase)=>(t,out)=>guideShape(phrase,t,1,out).multiplyScalar(half);
  const trace=(stroke,phrase,from,to,points,wobble)=>{
    const a=new THREE.Vector2(),b=new THREE.Vector2();
    for(let i=0;i<=points;i++){
      const t=from+(to-from)*i/points;place(phrase)(t,b);b.y+=Math.sin(i*1.7)*wobble;
      if(i)stroke.follow(a,b,tol);a.copy(b);
    }
    return stroke.progress;
  };
  const xs=[0,1,2,3].map(p=>[0,1].map(t=>guideShape(p,t,1,new THREE.Vector2()).x));
  assert(xs[0][0]<xs[0][1]&&xs[1][0]>xs[1][1]&&xs[2][0]<xs[2][1]&&xs[3][0]>xs[3][1],'the sweeps run both ways');
  for(let phrase=0;phrase<4;phrase++){
    for(const [points,wobble] of [[60,.03],[6,.02],[200,.06]]){
      const s=new PianoStroke();s.lay(place(phrase));
      assert(trace(s,phrase,.02,.97,points,wobble)>=tuning.piano.guideEnough,`phrase ${phrase+1}: a ${points}-sample stroke wobbling ${wobble} traces it`);
    }
    const kept=new PianoStroke();kept.lay(place(phrase));
    trace(kept,phrase,0,.5,30,.02);const half=kept.progress;
    assert(half>.4&&half<.6,'half a stroke traces half');
    assert(trace(kept,phrase,.45,1,30,.02)>=tuning.piano.guideEnough,'a second stroke carries on from where the first stopped');
    const leap=new PianoStroke();leap.lay(place(phrase));
    trace(leap,phrase,0,.2,10,0);leap.follow(new THREE.Vector2(0,.4),place(phrase)(1,new THREE.Vector2()),tol);
    assert(leap.progress<.6,'leaping to the far end traces nothing past where the finger left the guide');
    const backwards=new PianoStroke();backwards.lay(place(phrase));
    assert(trace(backwards,phrase,1,0,60,0)<.35,'tracing from the far end does not count');
    const away=new PianoStroke();away.lay(place(phrase));
    const off=new THREE.Vector2(),on=new THREE.Vector2();
    for(let i=0;i<=40;i++){place(phrase)(i/40,on);on.y+=tol*1.6;if(i)away.follow(off,on,tol);off.copy(on);}
    assert.equal(away.progress,0,'a stroke well clear of the guide traces nothing');
  }
  console.log('PASS: four guide shapes, traced with a wobble at any speed and across strokes; leaps, reversals and misses do not count.');
}
