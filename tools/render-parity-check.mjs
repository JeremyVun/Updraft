// Seeded, fixed-frame visual/state comparison against a frozen production build.
// COMPARE_BASE is the baseline URL; BASE is the changed build. Both must expose ?shot.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
import { smoothstepCalls, literalNumber } from './lib/glsl.mjs';
const before=process.env.COMPARE_BASE??'http://127.0.0.1:5233/';
const after=process.env.BASE??'http://127.0.0.1:5234/';
const prefix=process.argv[2]??'/tmp/updraft-render-parity';
const cases=[['island',''],['lines','chapter=washing'],['boats','chapter=boats'],['meadow','chapter=meadow'],['birches','chapter=birches'],['drowned','chapter=drowned&shower=1'],['wood','chapter=wood'],['sleeping','chapter=sleeping'],['sea','chapter=sea'],['mirror','chapter=mirror'],['home','chapter=summit'],['portrait','chapter=sleeping',390,844]];
const {browser,close}=await openBrowser();
const report=[];
try {
 const comparison=await browser.newPage();
 for(const [name,query,width=960,height=600] of cases){
  const captures=[];
  for(const [label,base] of [['before',before],['after',after]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   await page.route('**/favicon.ico',route=>route.fulfill({status:204}));
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text())});
   await page.addInitScript(()=>{
    let seed=1234567;Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
    const raf=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>raf(time=>{
     if(window.__stats?.frame>=120){window.__frozen=true;return;}callback(time);
    });
   });
   await page.goto(`${base}?shot=1&ratio=1&msaa=4&progress=0&analytics=0&${query}`);
   await page.waitForFunction(()=>window.__frozen,null,{polling:50,timeout:90000});
   const state=await page.evaluate(()=>{
    const g=__game;
    return {frame:__stats.frame,chapter:g.story.name,beat:g.story.current.beat,child:g.child.position.toArray(),bird:g.cygnet.position.toArray(),camera:g.rig.camera.position.toArray(),parity:__stats.heightParity};
   });
   assert(state.parity<.02,`${name}/${label}: CPU/GPU height mismatch ${state.parity}`);
   if(label==='after'){
    const shaders=await page.evaluate(()=>{
     const renderer=__game.renderer,gl=renderer.getContext();
     return renderer.info.programs.flatMap(p=>[gl.getShaderSource(p.vertexShader),gl.getShaderSource(p.fragmentShader)]).filter(Boolean);
    });
    assert(shaders.length>100,'inspect actual compiled shader sources');
    for(const shader of shaders)for(const call of smoothstepCalls(shader)){
     const [a,b]=call.args.map(literalNumber);
     if(a!==null&&b!==null)assert(a<b,`${name}: compiled smoothstep(${call.args.join(', ')})`);
    }
   }
   const png=await page.screenshot({path:`${prefix}-${name}-${label}.png`});
   assert.deepEqual(errors,[],`${name}/${label}`);
   captures.push({state,png:png.toString('base64')});await page.close();
  }
  const [a,b]=captures;
  assert.equal(a.state.chapter,b.state.chapter);assert.equal(a.state.beat,b.state.beat);
  const gap=(key)=>Math.hypot(...a.state[key].map((value,i)=>value-b.state[key][i]));
  // Single-precision equivalent shader arithmetic can move interpolated GPU-baked heights slightly.
  assert(gap('child')<.02&&gap('bird')<.02&&gap('camera')<.02,`${name}: character/camera state changed`);
  const pixels=await comparison.evaluate(async images=>{
   const data=[];
   for(const image of images){
    const bitmap=await createImageBitmap(await(await fetch('data:image/png;base64,'+image)).blob());
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);data.push(context.getImageData(0,0,canvas.width,canvas.height).data);bitmap.close();
   }
   let total=0,changed=0,max=0;
   for(let i=0;i<data[0].length;i+=4){let delta=0;for(let k=0;k<3;k++){const d=Math.abs(data[0][i+k]-data[1][i+k]);total+=d;delta=Math.max(delta,d);}if(delta>8)changed++;max=Math.max(max,delta);}
   return {meanChannelDelta:total/(data[0].length/4*3),fractionOver8:changed/(data[0].length/4),maxChannelDelta:max};
  },captures.map(c=>c.png));
  const entry={name,...pixels,childGap:gap('child'),birdGap:gap('bird'),cameraGap:gap('camera'),heightParity:b.state.parity};
  report.push(entry);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(entry));
  assert(pixels.meanChannelDelta<1&&pixels.fractionOver8<.02,`${name}: investigate visual differences`);
 }
}finally{await close()}
