// Real mouse/touch sweeps through the piano; idle, colour-front and completion checks.
// W=390 H=844 node tools/piano-check.mjs for portrait. Captures/reports stay in /tmp.
// PREFIX=<path> names the outputs; VIDEO=1 also records <prefix>-video/*.webm of the whole puzzle.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {reviewCapture} from './lib/review-capture.mjs';
import {holdGpu} from './lib/browser.mjs';
const viewport = { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) };
const portrait = viewport.width < viewport.height;
const prefix = process.env.PREFIX ?? `/tmp/updraft-piano-new-${portrait ? 'portrait' : 'desktop'}`;
const release = await holdGpu();
let browser,stopReview;
const report={viewport,states:[],errors:[]};
try {
  browser=await chromium.launch({channel:'chromium',headless:true,
    args:['--enable-gpu','--use-angle=metal','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  const context=await browser.newContext({viewport,hasTouch:portrait,
    ...(process.env.VIDEO==='1'?{recordVideo:{dir:prefix+'-video',size:viewport}}:{})});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))report.errors.push(m.text());});
  await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot=1&chapter=piano`);
  await page.waitForFunction(()=>window.__ready&&window.__game?.piano,null,{timeout:90000});
  if(process.env.REVIEW==='1')stopReview=reviewCapture(page,prefix);
  await page.mouse.click(10,10);
  await page.evaluate(()=>__game.sound.start());
  const state=()=>page.evaluate(()=>{
    const g=__game,p=g.piano,s=g.story.current.piano;
    // The guide in the order it is traced, from its ringed start.
    const path=Array.from({length:25},(_,i)=>{const v=p.guideAlong(i/24,p.keys.clone()).project(g.rig.camera);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2]});
    const plane=g.glider.position.clone().project(g.rig.camera);
    return {time:s.now,beat:s.at,phrase:s.phrase,matched:p.matched,expect:p.expect&&{index:p.expect.index,tilt:p.expect.tilt},progress:p.gesture.progress,
      music:g.meadowMusic?.state,duet:g.meadowMusic?.log.slice(),
      path,wave:g.life.regions.wave.toArray(),waiting:g.life.regions.waiting.toArray(),roseFrom:s.roseFrom,
      checkpoint:g.story.current.checkpoint,lineVisible:p.line.batch.mesh.visible,
      plane:{visible:g.glider.visible,held:g.glider.held,screen:[+plane.x.toFixed(3),+plane.y.toFixed(3),+plane.z.toFixed(3)]},
      bough:g.windBough?.log.slice(),
      subjects:[g.child.position.clone().add({x:0,y:1.5,z:0}),p.keys.clone(),...(g.windBough?[g.windBough.crown.clone()]:[])].map(v=>{v.project(g.rig.camera);return [v.x,v.y,v.z]}),
      plants:g.meadowEchoes?.group.children.map(mesh=>({
        waiting:mesh.material.uniforms.uWaiting.value.toArray(),wave:mesh.material.uniforms.uLifeWave.value.toArray(),
      })),notes:p.log.slice()};
  });
  const waitSeconds=async seconds=>{const start=(await state()).time;await page.waitForFunction(t=>__game.story.current.piano.now>=t,start+seconds,{timeout:180000});};
  const shot=async name=>{
    const s=await state();
    for(const plant of s.plants??[]) {
      assert.deepEqual(plant.waiting,s.waiting,'Meadow plants must remain grey with the surrounding ground');
      assert.deepEqual(plant.wave,s.wave,'Meadow plants must follow every piano colour wave');
    }
    const {notes,duet,plants,...brief}=s;
    report.states.push({name,...s});await page.screenshot({path:`${prefix}-${name}.png`});console.log(JSON.stringify({name,...brief}));
  };
  const touch=portrait?await page.context().newCDPSession(page):null;
  const pointer=async(points,ms)=>{
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:points[0][0],y:points[0][1]}]});
    else await page.mouse.move(...points[0]);
    for(const [x,y] of points.slice(1)){
      if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(ms);
    }
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  // Gusts across the keys and circles over them: the piano is never the wind's to play.
  const windOverKeys=async()=>{
    const k=await page.evaluate(()=>{const v=__game.piano.keys.clone().project(__game.rig.camera);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];});
    const r=Math.min(viewport.width,viewport.height)*.12;
    await pointer(Array.from({length:30},(_,i)=>[k[0]-2*r+4*r*i/29,k[1]+r*.3*Math.sin(i)]),8);
    await pointer(Array.from({length:30},(_,i)=>[k[0]+2*r-4*r*i/29,k[1]-r*.2]),8);
    await pointer(Array.from({length:90},(_,i)=>[k[0]+r*Math.cos(i/6),k[1]+r*.6*Math.sin(i/6)]),12);
  };
  const pianoSounds=s=>s.notes.length+s.duet.filter(d=>!['call','finale'].includes(d.what)).length;
  await page.waitForFunction(()=>__game.story.current.piano.at==='seated',null,{timeout:120000});
  await windOverKeys();
  assert.equal(pianoSounds(await state()),0,'nothing sounds from the piano before the bough calls, whatever the wind does');
  await page.waitForFunction(()=>__game.windBough.log.length>0,null,{timeout:120000});
  assert.equal(pianoSounds(await state()),0,'no note when she sits: the bough opens the duet');
  await waitSeconds(1.4);
  await shot('wind-call');
  assert((await state()).plane.visible&&!(await state()).plane.held,'the paper waits in the bough\'s fork, in view');
  assert.equal((await state()).expect,null,'piano input waits for the wind call');
  // Wind during the call, kept inside it: a slow, shared GPU can otherwise stretch these strokes past the guide opening.
  await pointer((await state()).path,12);
  const callLeft=()=>page.evaluate(()=>{const s=__game.story.current.piano;return s.callEnds-s.now;});
  if(await callLeft()>3)await windOverKeys();
  assert.equal((await state()).expect,null,'the strokes stayed inside the call');
  assert.equal((await state()).matched,0,'following the guide during the call cannot answer it');
  assert.equal(pianoSounds(await state()),0,'wind during the call plays nothing');
  await page.waitForFunction(()=>window.__game?.piano.expect!==null&&window.__game?.story.current.piano.at==='seated',null,{timeout:120000});
  await waitSeconds(2);
  await shot('invitation');
  {
    const s=await state();
    assert(Math.abs(s.plane.screen[0])<1&&Math.abs(s.plane.screen[1])<1&&s.plane.screen[2]<1,'the paper plane is in frame at the invitation');
    assert(s.path[0][0]<s.path.at(-1)[0],'the first guide sweeps to the right');
  }
  // Left alone, the bough says the call once more, softer, and then waits; idle wind never answers.
  const said=(await state()).bough.length;
  await page.waitForFunction(n=>__game.windBough.log.length>n,said,{timeout:120000});
  const again=(await state()).bough.at(-1);
  assert(!again.finale&&Math.abs(again.trimDb-(await page.evaluate(()=>__game.tuning.meadowMusic.callAgainDb)))<1e-6,'the repeat is the same call, softer');
  const gap=again.at-(await state()).bough.at(-2).at;
  report.repeat={gap,trimDb:again.trimDb};
  await waitSeconds(40);
  const idle=await state();
  assert.equal(idle.bough.length,said+1,'after its repeat the bough stays silent');
  assert.equal(idle.matched,0);assert.equal(idle.beat,'seated');assert(idle.lineVisible,'the guide alone invites');
  await shot('waiting');
  // Moderate, fast, slow and moderate strokes: the answer plays at its own tempo every time.
  const strokeMs=[30,3,75,30];
  report.answers=[];
  for(let n=0;n<4;n++){
    await page.waitForFunction(()=>__game.piano.expect!==null,null,{timeout:90000});
    const before=await state();
    const trace=before.path;
    for(const [x,y] of trace)assert(x>4&&x<viewport.width-4&&y>4&&y<viewport.height-4,'guide must fit in view');
    const points=Array.from({length:81},(_,i)=>{const f=i/80*(trace.length-1),k=Math.min(trace.length-2,Math.floor(f)),u=f-k;
      return [trace[k][0]+(trace[k+1][0]-trace[k][0])*u,trace[k][1]+(trace[k+1][1]-trace[k][1])*u+(n===0?18:0)];});
    const startedAt=Date.now();
    await pointer(points,strokeMs[n]);
    const strokeSeconds=(Date.now()-startedAt)/1000;
    await page.waitForFunction(m=>__game.piano.matched===m,before.matched+1,{timeout:10000});
    await waitSeconds(0.8);
    await shot(`answer-${n+1}-start`);
    await waitSeconds(1.8);
    await shot(`answer-${n+1}-front`);
    await waitSeconds(4.5);
    await shot(`answer-${n+1}`);
    const s=await state();
    const reply=await page.evaluate(async i=>{const {MEADOW_ANSWERS}=await import('/src/audio/meadow-duet.ts');const a=MEADOW_ANSWERS[i];return {clip:a.clip.duration,end:a.end,onsets:a.notes.map(x=>x.at)};},n);
    const sounded=s.duet.filter(d=>d.what===`answer ${n+1}`);
    assert.equal(sounded.length,1,`answer ${n+1} sounds once, as one recording`);
    const hands=s.notes.slice(-reply.onsets.length);
    const offsets=hands.map(x=>x.t-hands[0].t),expected=reply.onsets.map(t=>t-reply.onsets[0]);
    const drift=Math.max(...offsets.map((t,i)=>Math.abs(t-expected[i])));
    assert(drift<0.05,`her hands follow answer ${n+1}'s own onsets whatever the stroke (${drift.toFixed(3)} s)`);
    report.answers.push({answer:n+1,strokeSeconds:+strokeSeconds.toFixed(2),audioStart:sounded[0].at,audioEnd:+(sounded[0].at+reply.clip).toFixed(2),
      clipSeconds:reply.clip,rungDownAt:reply.end,handOnsets:offsets.map(t=>+t.toFixed(2)),recordedOnsets:expected.map(t=>+t.toFixed(2))});
    assert(s.plane.visible,'the paper stays in view through the duet');
    if(n<3){
      const reward=await page.evaluate(()=>{
        const g=__game,m=g.story.current,w=g.life.regions.wave;
        return {reach:m.waveTo,radius:w.z,colour:[-0.85,0,0.85].map(a=>g.life.at(w.x+Math.sin(a)*(m.waveTo-24),w.y-Math.cos(a)*(m.waveTo-24)))};
      });
      assert.equal(reward.reach,[45,85,125][n],'every answer has a distinct colour reward');
      assert.equal(reward.radius,reward.reach,'the musical front reaches its colour target');
      assert(reward.colour.every(v=>v>.98),'colour reaches the left, middle and right of the meadow');
      for(const p of s.subjects)assert(Math.abs(p[0])<.94&&Math.abs(p[1])<.94,'child and piano remain in each reward frame');
      const next=s.bough.length;
      await windOverKeys();
      assert.equal((await state()).notes.length,s.notes.length,'wind between answers plays nothing');
      await page.waitForFunction(k=>__game.windBough.log.length>k,next,{timeout:60000});
      const call=(await state()).bough.at(-1);
      assert(call.at>=s.notes.at(-1).t,'the next call waits for her answer');
    }
  }
  console.log('ANSWERS',JSON.stringify(report.answers));
  await page.waitForFunction(()=>__game.story.current.piano.roseFrom>0,null,{timeout:90000});
  {
    const s=await state(),finale=s.bough.at(-1);
    const due=finale.at+(await page.evaluate(()=>__game.tuning.windBough.inhale))+(await page.evaluate(async()=>(await import('/src/audio/meadow-duet.ts')).MEADOW_FINALE.greenAt));
    assert(finale.finale&&Math.abs(s.roseFrom-due)<0.05,`the greening starts on the finale's arrival (${s.roseFrom} vs ${due})`);
    assert(s.duet.some(d=>d.what==='finale'),'the flute finale sounded');
    assert(finale.at>s.notes.at(-1).t,'the finale waits for her last answer');
    report.greening={roseFrom:s.roseFrom,due,finaleAt:finale.at};
  }
  const answered=(await state()).notes.length,inSatchel=()=>page.evaluate(()=>__game.cygnet.seat==='satchel');
  assert((await state()).waiting[2]>0,'far ground stays grey at the start of the final wave');
  await shot('wave-start');assert(await inSatchel(),'the cygnet hears the finale from the satchel');
  await waitSeconds(5);await shot('cygnet-satchel');assert(await inSatchel(),'the cygnet stays in the satchel');
  await waitSeconds(3);await shot('wave-wide');
  for(const p of (await state()).subjects)assert(Math.abs(p[0])<0.94&&Math.abs(p[1])<0.94&&p[2]<1,'child and piano remain in the finale frame');
  await page.waitForFunction(()=>__game.story.current.piano.at==='done',null,{timeout:90000});
  await shot('done');
  {
    const s=await state();
    assert.equal(s.notes.length,answered,'nothing plays the keys under the finale: the flute carries it alone');
    assert(s.plane.visible&&s.plane.held,'the paper is back in her hand');
  }
  assert.equal((await state()).matched,4);
  assert.equal((await state()).waiting[2],0,'the completed wave releases the grey hold');
  const after=(await state()).notes.length;
  await windOverKeys();
  await waitSeconds(1);
  assert.equal((await state()).notes.length,after,'after the duet the wind plays nothing on the piano');
  await waitSeconds(3);
  assert(await page.evaluate(()=>__game.child.moving||!__game.glider.held),'the walk resumes after the piano');
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  console.log('Piano passed: bough opens, one softer repeat, four answers at their own tempo, idle and wind silent, finale cue with the cygnet in the satchel and the keys still, paper in view.');
} finally {
  fs.writeFileSync(`${prefix}-report.json`,JSON.stringify(report,null,2));
  try{await stopReview?.();}finally{
    await browser?.close();
    release();
  }
}
