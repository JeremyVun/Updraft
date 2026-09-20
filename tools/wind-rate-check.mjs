// Real GPU field comparisons for equal elapsed time and equivalent input at different render rates.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
import {chromium} from 'playwright-core';
const software=process.env.SOFTWARE==='1';
let browser,close;
if(software){
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 close=()=>browser.close();
}else{
 console.log('Waiting for exclusive GPU browser access.');
 ({browser,close}=await openBrowser());
}
console.log(`Comparing wind fields in Chrome/${software?'SwiftShader':'Metal'}.`);
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/__wind-check',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await page.goto((process.env.BASE??'http://127.0.0.1:5230')+'/__wind-check');
 const report=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {WindField}=await import('/src/wind/field.ts');
  const {WindClock}=await import('/src/wind/clock.ts');
  const renderer=new THREE.WebGLRenderer();renderer.setSize(16,16);
  const report=[];
  for(const options of [{res:256,iterations:24},{res:128,iterations:12}]) {
   const wind=new WindField(renderer,options);wind.readBack=()=>{};
   for(const scenario of ['breeze','held','stroke','circle','impulse','crowded']) {
    let reference, referenceNorm;
    for(const fps of [60,20,30,90,120,144]) {
     for(const pp of [wind.vel,wind.pressure,wind.bend,wind.sway]){wind.gpu.clear(pp.read);wind.gpu.clear(pp.write)}
     wind.clock=new WindClock();wind.breeze.set(2,.8);
     let ticks=0;const original=wind.substep.bind(wind);wind.substep=(...args)=>{ticks++;original(...args)};
     for(let f=0;f<fps*2;f++) {
      const t=(f+1)/fps,prev=f/fps;
      const base={source:'test',ax:0,az:0,bx:0,bz:0,vx:8,vz:2,radius:12,energy:.003,swirl:.4,lift:.2};
      if(scenario==='held' || scenario==='crowded')wind.addSplat(base);
      if(scenario==='stroke')wind.addSplat({...base,trail:true,ax:prev*12,az:4,bx:t*12,bz:4});
      if(scenario==='circle')wind.addSplat({...base,trail:true,ax:Math.sin(prev*2)*12,az:Math.cos(prev*2)*12,bx:Math.sin(t*2)*12,bz:Math.cos(t*2)*12});
      if(scenario==='impulse'&&f===0)wind.addSplat({...base,impulse:true,energy:.6,lift:2});
      if(scenario==='crowded')for(let i=0;i<12;i++)wind.addSplat({...base,source:`crowd-${i}`,ax:50+i,bx:50+i,az:50,bz:50});
      wind.step(1/fps,t);
     }
     wind.substep=original;
     wind.scaleMat.uniforms.uSrc.value=wind.texture;wind.scaleMat.uniforms.uScale.value=1;
     wind.gpu.run(wind.scaleMat,wind.readTarget);
     const data=new Float32Array(128*128*4);renderer.readRenderTargetPixels(wind.readTarget,0,0,128,128,data);
     if(!reference)reference=data;
     const error=[0,0,0,0],norm=[0,0,0,0],power=[0,0,0,0];
     for(let i=0;i<data.length;i++){const c=i%4;error[c]+=(data[i]-reference[i])**2;norm[c]+=reference[i]**2;power[c]+=data[i]**2}
     if(!referenceNorm)referenceNorm=power;
     if(scenario==='held' && power[2]<.01)throw Error('Gust energy did not reach the GPU field');
     report.push({powerError:power.map((v,c)=>Math.abs(Math.sqrt(v/Math.max(referenceNorm[c],1e-10))-1)),res:options.res,scenario,fps,ticks,error:error.map((v,c)=>Math.sqrt(v/Math.max(norm[c],1e-10)))});
    }
   }
  }
  return report;
 });
 fs.writeFileSync(`/tmp/updraft-wind-rates${software?'-software':''}.json`,JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);
 for(const r of report){
  assert.equal(r.ticks,120);
  // Circle samples trace different polygons at each input rate. Turbulence can change phase;
  // compare speed power and the transported gust/lift, rather than requiring identical eddies.
  const values=r.scenario==='circle'?[...r.powerError,...r.error.slice(2)]:r.error;
  assert(values.every(v=>Number.isFinite(v)&&v<(r.scenario==='circle'?.08:.001)),JSON.stringify(r));
 }
 console.log(JSON.stringify({cases:report.length,maxExactScenarioError:Math.max(...report.filter(r=>r.scenario!=='circle').flatMap(r=>r.error)),maxCirclePowerError:Math.max(...report.filter(r=>r.scenario==='circle').flatMap(r=>r.powerError)),maxCircleGustLiftError:Math.max(...report.filter(r=>r.scenario==='circle').flatMap(r=>r.error.slice(2))),report:`/tmp/updraft-wind-rates${software?'-software':''}.json`}));
}finally{await close()}
