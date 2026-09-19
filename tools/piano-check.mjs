// Real mouse/touch sweeps through the piano; idle, colour-front and completion checks.
// W=390 H=844 node tools/piano-check.mjs for portrait. Captures/reports stay in /tmp.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const viewport = { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) };
const portrait = viewport.width < viewport.height;
const prefix = `/tmp/updraft-piano-new-${portrait ? 'portrait' : 'desktop'}`;
const lock = '/tmp/updraft-chromium.lock';
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let owner=0; try { owner=Number(fs.readFileSync(`${lock}/pid`,'utf8')); } catch {}
    if (owner) { try {process.kill(owner,0);} catch {fs.rmSync(lock,{recursive:true,force:true});continue;} }
    await new Promise(r=>setTimeout(r,500));
  }
}
let browser;
const report={viewport,states:[],errors:[]};
try {
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
    args:['--enable-gpu','--use-angle=metal','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport,hasTouch:portrait});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))report.errors.push(m.text());});
  await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot=1&chapter=piano`);
  await page.waitForFunction(()=>window.__ready&&window.__game?.piano,null,{timeout:90000});
  await page.mouse.click(10,10);
  const state=()=>page.evaluate(()=>{
    const g=__game,p=g.piano,s=g.story.current.piano;
    const path=[0,1].map(t=>{const v=p.guideAlong(t,p.keys.clone()).project(g.rig.camera);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2]});
    return {time:s.now,beat:s.at,phrase:s.phrase,part:s.part,matched:p.matched,expect:p.expect,progress:p.gesture.progress,
      path,wave:g.life.regions.wave.toArray(),waiting:g.life.regions.waiting.toArray(),roseFrom:s.roseFrom,
      checkpoint:g.story.current.checkpoint,lineVisible:p.line.batch.mesh.visible,
      subjects:[g.child.position.clone().add({x:0,y:1.5,z:0}),p.keys.clone()].map(v=>{v.project(g.rig.camera);return [v.x,v.y,v.z]}),
      notes:p.log.slice(-8)};
  });
  const waitSeconds=async seconds=>{const start=(await state()).time;await page.waitForFunction(t=>__game.story.current.piano.now>=t,start+seconds,{timeout:120000});};
  const shot=async name=>{const s=await state();report.states.push({name,...s});await page.screenshot({path:`${prefix}-${name}.png`});console.log(JSON.stringify({name,...s}));};
  await page.waitForFunction(()=>window.__game?.piano.expect!==null&&window.__game?.story.current.piano.at==='seated',null,{timeout:120000});
  await waitSeconds(2);
  await shot('invitation');
  await waitSeconds(17);
  const idle=await state();assert.equal(idle.matched,0);assert.equal(idle.beat,'seated');assert(idle.lineVisible,'guide persists while listening');
  await shot('waiting');
  const touch=portrait?await page.context().newCDPSession(page):null;
  for(let n=0;n<4;n++){
    await page.waitForFunction(()=>__game.piano.expect!==null,null,{timeout:45000});
    const before=await state();
    const forward=before.expect.at(-1)>before.expect[0];
    const a=before.path[forward?0:1],b=before.path[forward?1:0];
    for(const [x,y] of [a,b])assert(x>4&&x<viewport.width-4&&y>4&&y<viewport.height-4,'guide must fit in view');
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a[0],y:a[1]}]});
    else await page.mouse.move(...a);
    await page.waitForTimeout(160);
    for(let i=1;i<=40;i++){
      const x=a[0]+(b[0]-a[0])*i/40,y=a[1]+(b[1]-a[1])*i/40;
      if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(30);
    }
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(m=>__game.piano.matched===m,before.matched+1,{timeout:10000});
    await waitSeconds(0.8);
    await shot(`answer-${n+1}-start`);
    await waitSeconds(1.8);
    await shot(`answer-${n+1}-front`);
    await waitSeconds(2.6);
    await shot(`answer-${n+1}`);
    if(n<3){
      const reward=await page.evaluate(()=>{
        const g=__game,m=g.story.current,w=g.life.regions.wave;
        return {reach:m.waveTo,radius:w.z,colour:[-0.85,0,0.85].map(a=>g.life.at(w.x+Math.sin(a)*(m.waveTo-24),w.y-Math.cos(a)*(m.waveTo-24)))};
      });
      assert.equal(reward.reach,[45,85,125][n],'every mirrored action has a distinct colour reward');
      assert.equal(reward.radius,reward.reach,'the musical front reaches its colour target');
      assert(reward.colour.every(v=>v>.98),'colour reaches the left, middle and right of the meadow');
      for(const p of (await state()).subjects)assert(Math.abs(p[0])<.94&&Math.abs(p[1])<.94,'child and piano remain in each reward frame');
    }
  }
  await page.waitForFunction(()=>__game.story.current.piano.roseFrom>0,null,{timeout:90000});
  assert((await state()).waiting[2]>0,'far ground stays grey at the start of the final wave');
  await shot('wave-start');await waitSeconds(8);await shot('wave-wide');
  for(const p of (await state()).subjects)assert(Math.abs(p[0])<0.94&&Math.abs(p[1])<0.94&&p[2]<1,'child and piano remain in the finale frame');
  await page.waitForFunction(()=>__game.story.current.piano.at==='done',null,{timeout:90000});
  await shot('done');
  assert.equal((await state()).matched,4);
  assert.equal((await state()).waiting[2],0,'the completed wave releases the grey hold');
  await waitSeconds(4);
  assert(await page.evaluate(()=>__game.child.moving||!__game.glider.held),'the walk resumes after the piano');
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  console.log('Piano passed: four real sweeps, no idle completion, visible guide, travelling restoration, departure.');
} finally {
  fs.writeFileSync(`${prefix}-report.json`,JSON.stringify(report,null,2));
  await browser?.close();
  if(Number(fs.readFileSync(`${lock}/pid`,'utf8'))===process.pid)fs.rmSync(lock,{recursive:true,force:true});
}
