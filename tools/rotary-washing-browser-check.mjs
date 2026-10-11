// Real pointer sweeps at the rotary, followed through the third curtain to the door.
// BASE=http://127.0.0.1:5243 W=1440 H=900 OUT=/tmp/... node tools/rotary-washing-browser-check.mjs
// FULL=1 starts at the arrival and opens the first two curtains normally. REVERSE=1 turns clockwise.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
import { turnRotary } from './lib/rotary-gesture.mjs';
const width=Number(process.env.W??1440),height=Number(process.env.H??900);
const touchMode=!!process.env.TOUCH;
const out=process.env.OUT??fs.mkdtempSync('/tmp/updraft-rotary-browser-');
fs.mkdirSync(out,{recursive:true});
const {browser,close}=await openBrowser();
let page;
const errors=[];
try {
  page=await browser.newPage({viewport:{width,height},hasTouch:touchMode,recordVideo:{dir:out,size:{width,height}}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
  await page.goto(`${process.env.BASE??'http://127.0.0.1:5243/'}?shot&chapter=washing&progress=0&ratio=1`);
  await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
  const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`});console.log(name);};
  const touch=touchMode?await page.context().newCDPSession(page):null;
  async function swipe(a,b,ms=900) {
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a[0]*width,y:a[1]*height}]});
    else {await page.mouse.move(-10,-10);await page.mouse.move(a[0]*width,a[1]*height);}
    for(let i=1;i<=45;i++){
      const x=(a[0]+(b[0]-a[0])*i/45)*width,y=(a[1]+(b[1]-a[1])*i/45)*height;
      if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(ms/45);
    }
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async function curtain(gate) {
    await page.waitForFunction(i=>__game.story.current.gate===i&&__game.story.current.beat==='curtain',gate,{timeout:120000});
    await page.waitForTimeout(2300);
    await shot(`curtain-${gate+1}-waiting`);
    for(let stroke=0;stroke<16;stroke++){
      const [x,y]=await page.evaluate(i=>{const v=__game.curtains[i].center.clone().project(__game.rig.camera);return[(v.x+1)/2,(1-v.y)/2];},gate);
      const span=width<height?.29:.21;
      await swipe([x-span,y],[x+span,y]);
      if(await page.evaluate(i=>__game.curtains[i].cleared,gate))break;
    }
    await page.waitForFunction(i=>__game.story.current.gate>i,gate,{timeout:60000});
  }
  if(process.env.FULL) {await curtain(0);await curtain(1);}
  else await page.evaluate(async()=>{
    const {ROTARY_BEFORE}=await import('/src/world/lines-rotary.ts');
    const g=__game;g.child.dismount();g.child.stop();g.child.place(ROTARY_BEFORE.x,ROTARY_BEFORE.z,Math.PI);g.child.standUp();
    g.cygnet.release(g.child.position.clone().add({x:1.5,y:0,z:0}));g.cygnet.seating.snap();
    g.story.current.restoreCheckpoint('rotary',[2,0]);
  });
  await page.waitForFunction(()=>__game.story.current.beat==='rotary',null,{timeout:60000});
  await page.waitForTimeout(7000);
  await shot('rotary-waiting');
  assert.equal(await page.evaluate(()=>__game.rotaryWashing.angle),0,'idle rotor must stay closed');
  let midpoint=false;
  for(let stroke=0;stroke<35;stroke++){
    await turnRotary(page, !!process.env.REVERSE, touch);
    const state=await page.evaluate(()=>({angle:__game.rotaryWashing.angle,speed:__game.rotaryWashing.speed,open:__game.rotaryWashing.open,caught:__game.rotaryWashing.caught}));
    console.log(stroke,state);
    if(!midpoint&&Math.abs(state.angle)>1.3){await shot('rotary-turning');midpoint=true;}
    if(state.caught)break;
  }
  await page.waitForFunction(()=>__game.story.current.beat==='rotaryOpen',null,{timeout:15000});
  await shot('rotary-open');
  await page.waitForTimeout(3300);
  await shot('rotary-crossing');
  await curtain(2);
  await page.waitForFunction(()=>__game.story.current.beat==='family',null,{timeout:60000});
  await page.waitForTimeout(2200);
  await shot('family');
  await page.waitForFunction(()=>__game.story.current.beat==='haul',null,{timeout:120000});
  await shot('shore');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/report.json`,JSON.stringify({width,height,touch:touchMode,errors,full:!!process.env.FULL,reverse:!!process.env.REVERSE},null,2));
  const video=page.video();await page.close();await video.saveAs(`${out}/playthrough.webm`);
  console.log(`PASS: ${out}`);
} catch(e){if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});console.error(errors);throw e;}
finally {await close();}
