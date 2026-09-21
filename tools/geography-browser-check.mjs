// Real sea approach plus arranged views of relocated routes, with the shared GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-geography-views';
const {browser,close}=await openBrowser();
const results=[];
try {
 for(const [width,height] of (process.env.VIEWPORT==='portrait'?[[390,844]]:process.env.VIEWPORT==='landscape'?[[1440,900]]:[[1440,900],[390,844]])) {
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))errors.push(m.text());});
  await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot=1&chapter=sea`);
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:90000});
  console.log(`Sea renderer ready at ${width}x${height}`);
  await page.evaluate(()=>{
   const g=__game;window.geographyFrames=[];
   const tick=()=>{
    const c=g.story.current,p=g.sealife.pod,u=g.water.mesh.material.uniforms;
    geographyFrames.push({chapter:g.story.name,time:c.time,appearance:u.uSkyMirrorAppearance.value,
     reflection:u.uMirrorOn.value,size:[g.water.reflection.target.width,g.water.reflection.target.height],
     pod:p.mesh.visible,rooms:u.uJourneyRooms.value.toArray(),camera:g.rig.camera.position.toArray(),boat:g.boat.position.toArray()});
    if(g.story.name==='toMirror')requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  });
  for(const t of [0,20,40,60,80,100,120,140,160,180]) {
   await page.waitForFunction(t=>__game.story.name!=='toMirror'||__game.story.current.time>=t,t,{timeout:90000});
   const state=await page.evaluate(()=>({chapter:__game.story.name,time:__game.story.current.time,appearance:__game.water.skyMirrorAppearance,boat:__game.boat.position.toArray()}));
   console.log(JSON.stringify({width,...state}));
   if([0,20,40,60,80,100].includes(t)||state.chapter!=='toMirror')await page.screenshot({path:`${prefix}-${width}-sea-${t}.png`});
   if(state.chapter!=='toMirror')break;
  }
  const frames=await page.evaluate(()=>geographyFrames);
  const sea=frames.filter(f=>f.chapter==='toMirror');assert(sea.length>100);assert(sea.at(-1).time<=100,'sea finishes within 100 seconds');
  assert(frames.some(f=>f.chapter==='mirror'),'sea reaches relocated mirror');
  assert(sea.every(f=>f.reflection===1),'reflection prepared throughout approach');
  assert(sea.every(f=>f.size.join(',')===sea[0].size.join(',')),'no reflection target resize on entering mirror');
  assert(sea.every(f=>f.appearance<.001||!f.pod),'pod dives before mirror colour arrives');
  let maxBlendStep=0;for(let i=1;i<sea.length;i++)maxBlendStep=Math.max(maxBlendStep,Math.abs(sea[i].appearance-sea[i-1].appearance));
  assert(maxBlendStep<.025,`mirror colour jumped ${maxBlendStep}`);
  for(const name of ['toMeadow','toSleeping','toHarbour']) {
   for(const fraction of [.15,.55,.9]) {
    const state=await page.evaluate(({name,fraction})=>{
     const g=__game;
     const starts={toMeadow:[233,-557,Math.PI],toSleeping:[-34,-1908,.2],toHarbour:[-280,-2103,Math.PI]};
     g.story.sail(...starts[name]);g.story.begin(name);
     const c=g.story.current;let left=c.routeLength*fraction,i=0;
     while(i<c.spans.length-1&&left>c.spans[i])left-=c.spans[i++];
     const a=i===0?c.departure:c.route[i-1],b=c.route[i],t=left/c.spans[i];
     g.boat.beach(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,Math.atan2(b.x-a.x,b.y-a.y));g.boat.launch();
     c.leg=i;g.boat.steerFor=b;g.boat.canGround=false;
     c.update(1/60,0);g.rig.cut(c.shot);
     return {name,fraction,boat:g.boat.position.toArray()};
    },{name,fraction});
    await page.waitForTimeout(900);
    await page.screenshot({path:`${prefix}-${width}-${name}-${fraction}.png`});
    const rooms=await page.evaluate(()=>__game.water.mesh.material.uniforms.uJourneyRooms.value.toArray());
    assert.deepEqual(rooms,{toMeadow:[3,4],toSleeping:[7,8],toHarbour:[9,10]}[name]);
    results.push({...state,width,rooms});
   }
  }
  fs.writeFileSync(`${prefix}-${width}-frames.json`,JSON.stringify(frames));
  assert.equal(errors.length,0,errors.join('\n'));
  results.push({width,seaSeconds:sea.at(-1).time,maxBlendStep,frames:sea.length,errors});
  fs.writeFileSync(`${prefix}-${width}-frames.json`,JSON.stringify(frames));
  await page.close();
 }
 fs.writeFileSync(`${prefix}.json`,JSON.stringify(results,null,2));
 console.log('Sea continuity, reflection readiness, dolphin retirement and route room masks passed.');
}finally{await close();}
