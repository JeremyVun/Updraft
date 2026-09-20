// Sleeping island: idle gates, real pillow sweeps, gentle circles, dawn and boarding.
// Usage: node tools/sleeping-check.mjs [prefix]; TOUCH=1 for 390x844. Shared GPU lock; captures in /tmp.
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


const prefix = process.argv[2] ?? '/tmp/updraft-sleeping';
const touch=process.env.TOUCH==='1',width=touch?390:1600,height=touch?844:900;
await acquireLock();
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-gpu','--use-angle=metal','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
try {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:touch,isMobile:touch});
  const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});
  await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?shot=1&chapter=sleeping');
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
  assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[width,height]);
  assert.deepEqual(errors,[],'initial shader compilation');
  const heightParity=await page.evaluate(()=>__stats.heightParity);
  assert(heightParity<0.02,'rendered hill and walking surface must agree');
  await page.evaluate(async()=>{(await import('/src/params.ts')).params.shot=false;});
  const shot=async name=>{await page.screenshot({path:prefix+'-'+name+'.png'});console.log(prefix+'-'+name+'.png')};
  const beat=async name=>page.waitForFunction(name=>__game.story.current.beat===name,name,{timeout:100000});
  const point=async kind=>page.evaluate(kind=>{const g=__game;const p=(kind==='pillow'?g.story.current.windInvitation:g.cygnet.position).clone().project(g.rig.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},kind);
  const gesture=async(kind)=>{
    const p=await point(kind),circle=kind==='bird',count=circle?100:28,rad=height*0.06;
    for(let i=0;i<=count;i++){
      const a=i/count*Math.PI*4;
      const x=p.x+(circle?Math.cos(a)*rad:(i/count-0.5)*Math.min(170,width*0.4));
      const y=p.y+(circle?Math.sin(a)*rad:Math.sin(i/count*Math.PI)*8);
      assert(x>0&&x<width&&y>0&&y<height,'wind target is outside the viewport');
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:i===0?'touchStart':'touchMove',touchPoints:[{x,y,id:1}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(circle?25:22);
      if(circle && i%5===0 && await page.evaluate(()=>__game.story.current.beat!=='hilltop'))break;
    }
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  if(process.env.SUMMIT==='1') {
    await page.evaluate(async()=>{
      const g=__game,c=g.story.current,{SLEEP_LEDGE,BED}=await import('/src/world/sleeping.ts');
      c.moored=true;c.laid=true;g.child.stop();g.child.position.copy(BED);g.child.abed=g.child.eyesShut=1;
      g.cygnet.release(SLEEP_LEDGE);g.cygnet.stay=true;g.cygnet.errand=null;g.cygnet.wing.recovery=1;
      c.leapFrom.copy(SLEEP_LEDGE);c.roundedShoulder=true;c.to('unbinding');
    });
    await page.waitForTimeout(4500);await shot('ledge');
  } else {
  await beat('tuckIn');await page.waitForTimeout(8500);await shot('sitting');
  await page.waitForTimeout(5000);await shot('drowsy');
  await page.waitForTimeout(5500);await shot('tucking');
  await beat('asleep');await page.waitForTimeout(26000);await shot('bed');
  assert.equal(await page.evaluate(()=>__game.story.current.beat),'asleep');
  assert(await page.evaluate(()=>!!__game.story.current.windInvitation),'pillow must invite a sweep');
  for(let i=0;i<5 && await page.evaluate(()=>__game.story.current.beat==='asleep');i++)await gesture('pillow');
  await beat('feather');await shot('feather');
  await beat('climb');await page.waitForTimeout(2500);await shot('climb');
  // Deliberately broad, imperfect sweeps across the actual feather; the path should assist them.
  for(let j=0;j<14&&await page.evaluate(()=>['climb','shiver'].includes(__game.story.current.beat));j++){
    const p=await page.evaluate(()=>{const g=__game,p=g.sleeping.feather.position.clone().project(g.rig.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
    for(let i=0;i<=24;i++){const x=Math.max(8,Math.min(width-8,p.x+(i/24-.5)*width*.42)),y=Math.max(8,Math.min(height-8,p.y+22-Math.sin(i/24*Math.PI)*50));
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:i===0?'touchStart':'touchMove',touchPoints:[{x,y,id:1}]});else await page.mouse.move(x,y);await page.waitForTimeout(25);}
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(500);
  }
  }
  await beat('hilltop');await page.waitForTimeout(7000);await shot('hilltop');
  const at=await page.evaluate(async()=>{const g=__game; const {WINDOW}=await import('/src/world/sleeping.ts'); const w=WINDOW.clone().project(g.rig.camera); return {time:g.story.current.now,dusk:g.story.current.dusk,wing:g.cygnet.wing.state,curtains:g.sleeping.curtains,window:w.toArray()};});
  assert(at.dusk>1.8 && at.wing==='free' && at.curtains===0,'the healed wing waits at the closed summit window');
  assert(Math.abs(at.window[0])<0.8 && Math.abs(at.window[1])<0.8 && at.window[2]<1,'summit window must be visible beside the bird');
  for(let i=0;i<4&&await page.evaluate(()=>__game.story.current.beat==='hilltop');i++)await gesture('bird');
  assert.equal(await page.evaluate(()=>__game.story.current.beat),'reachRibbon','gentle repeated circles must launch the reach');
  await page.waitForTimeout(800);await shot('leap');
  await beat('pullRibbon');await page.waitForTimeout(450);await shot('tug');
  const grip=await page.evaluate(async()=>{const k=__game.cygnet;return {gap:k.billTip(k.position.clone()).distanceTo(k.billGrip),nudge:k.mat.uniforms.uNudge.value,curtains:__game.sleeping.curtains};});
  assert(grip.gap<0.02&&grip.nudge<0.01&&grip.curtains===0,'the bird must grip the ribbon before the curtains can open');
  assert(await page.evaluate(async()=>{const {WINDOW,CURTAIN_END}=await import('/src/world/sleeping.ts');return [WINDOW,CURTAIN_END].every(at=>{const p=at.clone().project(__game.rig.camera);return Math.abs(p.x)<.85&&Math.abs(p.y)<.85&&p.z<1;});}),'both knot and free end remain visible during the tug');
  await beat('glide');
  const liftSeconds=await page.evaluate(at=>__game.story.current.now-at,at.time);
  await page.waitForTimeout(3200);await shot('window-open');
  assert(await page.evaluate(async()=>{const {WINDOW}=await import('/src/world/sleeping.ts');const p=WINDOW.clone().project(__game.rig.camera);return Math.abs(p.x)<0.9 && Math.abs(p.y)<0.9 && p.z<1;}),'the camera must retain the opening window');
  assert(await page.evaluate(()=>__game.sleeping.curtains>0.8 && __game.sleeping.laneOpen<0.4),'curtains open at the summit before light reaches the bed');
  await page.waitForTimeout(2800);await shot('glide');
  await beat('waking');await page.waitForTimeout(2500);await shot('morning');
  await beat('lap');await page.waitForTimeout(2200);await shot('together');
  assert(await page.evaluate(()=>!__game.glider.visible),'the paper stays tucked away through the embrace');
  await beat('toBoat');
  // The old midpoint shot abandoned the child for empty ground on the walk back. Sample the real transition.
  const departure=[];
  for(let i=0;i<20;i++) {
    await page.waitForTimeout(150);
    departure.push(await page.evaluate(()=>{
      const g=__game,p=g.child.position.clone();p.y+=1.2;p.project(g.rig.camera);return p.toArray();
    }));
    if(i===11)await shot('leaving-bed');
  }
  assert(departure.every(p=>Math.abs(p[0])<0.9&&Math.abs(p[1])<0.9&&p[2]<1),
    'the child stays in frame throughout the departure: '+JSON.stringify(departure));
  await page.waitForFunction(()=>__game.story.name==='toMirror',null,{timeout:60000});
  const result=await page.evaluate(()=>({chapter:__game.story.name,carried:__game.cygnet.carried,riding:__game.child.riding,coat:__game.child.rig.coat.scale.toArray(),dawn:__game.sleeping.dawn,curtains:__game.sleeping.curtains}));
  assert(result.carried&&result.riding&&result.dawn===1&&result.curtains===1);
  assert.deepEqual(result.coat,[1,1,1]);assert.deepEqual(errors,[]);
  fs.writeFileSync(prefix+'.json',JSON.stringify({touch,liftSeconds,heightParity,result,errors},null,2));
  console.log(JSON.stringify({touch,liftSeconds,heightParity,result,errors}));
} finally {await browser.close();}
