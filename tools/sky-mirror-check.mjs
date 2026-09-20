// Fallen stars: real mouse/touch sweeps and circles, companion walks, checkpoint reload and far-side boarding.
// Usage: node tools/sky-mirror-check.mjs [prefix]; TOUCH=1 for 390x844. Shared GPU lock; captures in /tmp.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const LOCK = '/tmp/updraft-chromium.lock';
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function acquireLock() {
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      fs.writeFileSync(`${LOCK}/pid`, String(process.pid));
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let holder = 0;
      try {
        holder = Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) || 0;
      } catch {}
      let stale = holder ? !alive(holder) : false;
      try {
        if (!holder) stale = Date.now() - fs.statSync(LOCK).mtimeMs > 10000;
      } catch {}
      if (stale) fs.rmSync(LOCK, { recursive: true, force: true });
      else await new Promise((r) => setTimeout(r, 400));
    }
  }
}
function releaseLock() {
  try {
    if (Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) === process.pid) fs.rmSync(LOCK, { recursive: true, force: true });
  } catch {}
}
process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const prefix = process.argv[2] ?? '/tmp/updraft-sky-mirror';
const touch = process.env.TOUCH === '1',
  width = touch ? 390 : 1600,
  height = touch ? 844 : 900;
await acquireLock();
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
});
const cdp = await context.newCDPSession(page);
const base=process.env.BASE ?? 'http://127.0.0.1:5230/';
const move=async(x,y,down=false)=>{
  if(touch) await cdp.send('Input.dispatchTouchEvent',{type:down?'touchStart':'touchMove',touchPoints:[{x,y,id:1}]});
  else await page.mouse.move(x,y);
};
const up=async()=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
const point=async(kind)=>page.evaluate(kind=>{
  const g=__game,r=g.skyMirror,b=r.bubbles.find(b=>b.pop===0);
  const at=kind==='wand'?r.wand:kind==='star'?r.stars[g.story.current.target].origin:b?.position;
  if(!at)return null;const p=at.clone().project(g.rig.camera);
  return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
},kind);
async function sweep(p,dx,dy,length=100) {
  const n=Math.hypot(dx,dy);dx/=n;dy/=n;
  const from={x:p.x-dx*length/2,y:p.y-dy*length/2};
  if(!touch) {
    await page.mouse.move(p.x-dy*length-dx*length/2,p.y+dx*length-dy*length/2);
  }
  await move(from.x,from.y,true);
  for(let i=1;i<=24;i++) {await move(from.x+dx*length*i/24,from.y+dy*length*i/24);await page.waitForTimeout(18);}
  await up();await page.waitForTimeout(220);
}
try {
  await page.goto(`${base}?shot=1&chapter=mirror&progress=1`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
  await page.waitForFunction(()=>__game.story.current.beat==='play',null,{timeout:90000});
  await page.screenshot({path:`${prefix}-wand.png`});
  const outcomes=[];
  for(let star=0;star<3;star++) {
    await page.waitForFunction(()=>__game.story.current.beat==='play',null,{timeout:60000});
    for(let attempt=0;attempt<12;attempt++) {
      if(await page.evaluate(()=>__game.skyMirror.bubbles.some(b=>b.pop===0)))break;
      await sweep(await point('wand'),1,0,touch?90:140);
    }
    assert(await page.evaluate(()=>__game.skyMirror.bubbles.some(b=>b.pop===0)),'a sweep makes a bubble');
    await page.screenshot({path:`${prefix}-bubble-${star}.png`});
    for(let attempt=0;attempt<30;attempt++) {
      if(await page.evaluate(()=>!!__game.skyMirror.carried))break;
      const b=await point('bubble');
      if(!b)throw new Error('Bubble burst before reaching star');
      // Aim on the bubble's horizontal plane, so perspective does not turn forward wind into backward wind.
      const dir=await page.evaluate(()=>{
        const r=__game.skyMirror,b=r.bubbles.find(b=>b.pop===0),s=r.stars[__game.story.current.target].origin;
        const a=b.position.clone().project(__game.rig.camera),q=s.clone().setY(b.position.y).project(__game.rig.camera);
        return {x:(q.x-a.x)*innerWidth,y:-(q.y-a.y)*innerHeight};
      });
      await sweep(b,dir.x,dir.y,touch?75:110);

    }
    assert(await page.evaluate(()=>!!__game.skyMirror.carried),'a low bubble catches the light');
    await page.screenshot({path:`${prefix}-caught-${star}.png`});
    if(star===0) {
      const before=await page.evaluate(()=>__game.child.position.toArray());
      await page.waitForTimeout(4000);
      assert(await page.evaluate(at=>{
        const g=__game,b=g.skyMirror.carried;if(!b || g.story.current.beat!=='play')return false;
        const p=b.position.clone().project(g.rig.camera);
        return Math.hypot(g.child.position.x-at[0],g.child.position.z-at[2])<0.1 && Math.abs(p.x)<0.85 && Math.abs(p.y)<0.85;
      },before),'captured bubble and child wait visibly for the updraft');
    }
    let peakCharge=0;
    for(let circle=0;circle<12;circle++) {
      if(await page.evaluate(()=>!__game.skyMirror.carried))break;
      let p=await point('bubble');const radius=touch?18:28;
      await move(p.x+radius,p.y,true);
      // Keep one circle at 0.9 simulated seconds even when screenshot rendering or
      // browser RPCs change the wall-clock cadence. Only real pointer events supply wind.
      const firstFrame=await page.evaluate(()=>__stats.frame);
      let angle=0;
      while(angle<Math.PI*2) {
        const s=await page.evaluate(()=>{
          const b=__game.skyMirror.carried,p=b?.position.clone().project(__game.rig.camera);
          return {frame:__stats.frame,charge:__game.input.charge,p:p?{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}:null};
        });
        if(!s.p)break;
        p=s.p;peakCharge=Math.max(peakCharge,s.charge);
        angle=Math.min(Math.PI*2,(s.frame-firstFrame)/54*Math.PI*2);
        await move(p.x+Math.cos(angle)*radius,p.y+Math.sin(angle)*radius);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      }

      await up();
    }
    console.log(JSON.stringify({star,peakCharge}));
    await page.waitForFunction(n=>__game.skyMirror.progress>n,star,{timeout:15000});
    outcomes.push(await page.evaluate(()=>({mask:__game.skyMirror.completedMask,stars:__game.skyMirror.stars.map(s=>s.state)})));
    console.log(JSON.stringify(outcomes.at(-1)));
    await page.screenshot({path:`${prefix}-returned-${star}.png`});
    if(star===0) {
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('updraft.progress.v1')??'null')?.data?.[0]===1);
      await page.goto(`${base}?shot=1&progress=1`,{waitUntil:'load'});
      await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
      assert.equal(await page.evaluate(()=>__game.skyMirror.completedMask),1,'reload preserves the returned star');
    }
  }
  await page.waitForFunction(()=>__game.story.name==='toHarbour',null,{timeout:120000});
  const exit=await page.evaluate(()=>({childAboard:__game.child.riding,birdAboard:__game.cygnet.carried,active:__game.skyMirror.active,mask:__game.skyMirror.completedMask,paper:__game.glider.group.visible}));
  assert(exit.childAboard && exit.birdAboard && !exit.active && exit.mask===7 && exit.paper);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`${prefix}-departure.png`});
  fs.writeFileSync(`${prefix}.json`,JSON.stringify({touch,outcomes,exit,errors},null,2));
  console.log(JSON.stringify({exit,errors}));
} finally {
  if(errors.length)console.error(errors.join('\n'));
  console.log('state',await page.evaluate(()=>window.__game?({beat:__game.story.current.beat,mask:__game.skyMirror.completedMask,bubbles:__game.skyMirror.bubbles.map(b=>({p:b.position.toArray(),star:b.star})),charge:__game.input.charge}):null).catch(()=>null));
  await browser.close();releaseLock();
}
