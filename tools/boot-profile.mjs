// Cold startup CPU profile, long tasks and blocking GL calls. BASE supports a production preview.
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-boot';
const {browser,close}=await openBrowser();
try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage(), cdp=await context.newCDPSession(page);
 await page.addInitScript(()=>{
  window.__boot={long:[],gl:[],frames:[]};
  new PerformanceObserver(list=>{for(const e of list.getEntries())__boot.long.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true});
  for(const name of ['getUniformLocation','getAttribLocation','getProgramParameter','getShaderParameter','getParameter','bufferData','texImage2D','texStorage2D','drawElements','drawArrays','linkProgram','compileShader']) {
   const original=WebGL2RenderingContext.prototype[name];
   WebGL2RenderingContext.prototype[name]=function(...args){const t=performance.now();try{return original.apply(this,args)}finally{const duration=performance.now()-t;if(duration>10)__boot.gl.push({name,start:t,duration})}};
  }
  let last=0;const tick=now=>{if(last)__boot.frames.push(now-last);last=now;if(!document.querySelector('#veil.ready'))requestAnimationFrame(tick)};requestAnimationFrame(tick);
 });
 await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?start=1&analytics=0');
 await page.waitForSelector('#veil.ready',{timeout:90000});
 const {profile}=await cdp.send('Profiler.stop');
 fs.writeFileSync(prefix+'.cpuprofile',JSON.stringify(profile));
 const timings=await page.evaluate(()=>window.__boot), totals=new Map(), nodes=new Map(profile.nodes.map(n=>[n.id,n]));
 for(let i=0;i<profile.samples.length;i++){const f=nodes.get(profile.samples[i]).callFrame,key=`${f.functionName} ${f.url}:${f.lineNumber+1}`;totals.set(key,(totals.get(key)??0)+profile.timeDeltas[i]/1000)}
 const report={worstFrame:Math.max(...timings.frames),long:timings.long,gl:timings.gl,topCPU:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,30)};
 fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await close()}
