// Cold startup long tasks, veil frame gaps and blocking GL calls; one run also writes a CPU profile.
// BASE supports a production or QA preview. RUNS=<n> loads n times, each in a fresh browser (fresh profile, so the
// GPU shader disk cache is cold), without the CPU profiler. THROTTLE=<rate> slows the CPU (CDP
// Emulation.setCPUThrottlingRate). WARM=1 loads once in the same browser before measuring, for a warm-cache
// comparison. QUERY adds query params (no leading ?). Each run prints the worst veil frame gap, the worst long task,
// the worst long task after world construction (the `boot` mark), and the time to #veil.ready from navigation, with
// the time in each boot stage (marks), the longest construction steps and the veil's percent sequence.
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-boot';
const runs=Number(process.env.RUNS??1), throttle=Number(process.env.THROTTLE??1), profiling=!process.env.RUNS;
const url=(process.env.BASE??'http://127.0.0.1:5230/')+'?start=1&analytics=0'+(process.env.QUERY?'&'+process.env.QUERY:'');
async function load(context,profile) {
 const page=await context.newPage(), cdp=await context.newCDPSession(page);
 await page.addInitScript(()=>{
  window.__boot={long:[],gl:[],frames:[],ready:0};
  new PerformanceObserver(list=>{for(const e of list.getEntries())__boot.long.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true});
  for(const name of ['getUniformLocation','getAttribLocation','getProgramParameter','getShaderParameter','getProgramInfoLog','getParameter','bufferData','texImage2D','texStorage2D','drawElements','drawArrays','linkProgram','compileShader','clientWaitSync','readPixels']) {
   const original=WebGL2RenderingContext.prototype[name];
   WebGL2RenderingContext.prototype[name]=function(...args){const t=performance.now();try{return original.apply(this,args)}finally{const duration=performance.now()-t;if(duration>10)__boot.gl.push({name,start:t,duration})}};
  }
  let last=0;const tick=now=>{if(last)__boot.frames.push({at:now,gap:now-last});last=now;if(document.querySelector('#veil.ready'))__boot.ready||=performance.now();else requestAnimationFrame(tick)};requestAnimationFrame(tick);
  new MutationObserver(()=>{if(document.querySelector('#veil.ready'))__boot.ready||=performance.now()}).observe(document,{subtree:true,attributes:true,attributeFilter:['class']});
  __boot.percents=[];
  new MutationObserver(()=>{
   const p=document.querySelector('.progress-percent')?.textContent, s=document.querySelector('.progress-stage')?.textContent, ready=!!document.querySelector('#veil.ready'), last=__boot.percents.at(-1);
   if(p&&(!last||last.p!==p||last.s!==s||last.ready!==ready))__boot.percents.push({at:Math.round(performance.now()),p,s,ready});
  }).observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
 });
 if(throttle!==1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
 if(profile){await cdp.send('Profiler.enable');await cdp.send('Profiler.start')}
 await page.goto(url);
 await page.waitForSelector('#veil.ready',{timeout:90000*throttle});
 const cpu=profile?(await cdp.send('Profiler.stop')).profile:null;
 const timings=await page.evaluate(()=>({...window.__boot,boot:performance.getEntriesByName('boot')[0]?.startTime??null,
  marks:Object.fromEntries(performance.getEntriesByType('mark').map(m=>[m.name,Math.round(m.startTime)])),
  steps:performance.getEntriesByType('measure').filter(m=>m.name.startsWith('build step')).map(m=>({name:m.name,duration:Math.round(m.duration)}))}));
 await page.close();
 return {cpu,timings};
}
const round=n=>Math.round(n);
const results=[];
for(let run=0;run<runs;run++) {
 const {browser,close}=await openBrowser();
 try {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  if(process.env.WARM)await load(context,false);
  const {cpu,timings}=await load(context,profiling);
  const worst=timings.frames.reduce((a,f)=>f.gap>a.gap?f:a,{gap:0,at:0});
  const longest=list=>list.reduce((a,t)=>t.duration>a.duration?t:a,{duration:0,start:0});
  const long=longest(timings.long), after=timings.boot===null?null:longest(timings.long.filter(t=>t.start>=timings.boot));
  const summary={gap:round(worst.gap),gapAt:round(worst.at),long:round(long.duration),longAt:round(long.start),afterConstruction:after&&round(after.duration),afterAt:after&&round(after.start),construction:timings.boot&&round(timings.boot),ready:round(timings.ready)};
  results.push(summary);
  const m=timings.marks, stages=m.main&&m.boot&&m.ready?{A:m.main,B:m.boot-m.main,settle:m.settled-m.boot,warm:m.warmed-m.settled,D:m.ready-m.warmed}:null;
  const steps=[...timings.steps].sort((a,b)=>b.duration-a.duration).slice(0,3);
  console.log(`run ${run+1}: gap ${summary.gap} ms at ${summary.gapAt}; long task ${summary.long} ms at ${summary.longAt}; after construction (${summary.construction} ms) ${summary.afterConstruction} ms at ${summary.afterAt}; ready ${summary.ready} ms`);
  if(stages)console.log(`  stages ms ${JSON.stringify(stages)}; longest construction steps ${steps.map(t=>`${t.name.slice(11)}: ${t.duration}`).join(', ')}`);
  if(timings.percents.length)console.log(`  percent ${timings.percents.map(p=>`${p.p}${p.ready?' ready':''}`).join(' ')}`);
  const report={...summary,stages,steps:timings.steps,percents:timings.percents,worstFrame:worst.gap,long:timings.long,gl:timings.gl};
  if(cpu) {
   const totals=new Map(), nodes=new Map(cpu.nodes.map(n=>[n.id,n]));
   for(let i=0;i<cpu.samples.length;i++){const f=nodes.get(cpu.samples[i]).callFrame,key=`${f.functionName} ${f.url}:${f.lineNumber+1}`;totals.set(key,(totals.get(key)??0)+cpu.timeDeltas[i]/1000)}
   report.topCPU=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,30);
   fs.writeFileSync(prefix+'.cpuprofile',JSON.stringify(cpu));
  }
  fs.writeFileSync(runs>1?`${prefix}-${run+1}.json`:prefix+'.json',JSON.stringify(report,null,2));
  if(profiling)console.log(JSON.stringify(report,null,2));
 } finally {await close()}
}
if(runs>1) {
 const worst=key=>Math.max(...results.map(r=>r[key]??0)), median=key=>results.map(r=>r[key]??0).sort((a,b)=>a-b)[results.length>>1];
 console.log(`summary of ${runs} at ${throttle}x: worst gap ${worst('gap')} ms (median ${median('gap')}); worst long task ${worst('long')} ms; worst after construction ${worst('afterConstruction')} ms (median ${median('afterConstruction')}); ready worst ${worst('ready')} ms (median ${median('ready')})`);
}
