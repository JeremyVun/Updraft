// Frozen, same-camera throughput comparisons. Includes wind ticks and reflections,
// excludes story/CPU updates; these are completed-work costs, NOT measured gameplay fps.
// Interleaved A/B/B/A batches bracket changing background load. GPU completion waits
// avoid unreliable Metal timer queries. Report delta spread; contention can still swamp small effects.
// Usage: node tools/quality-budget-profile.mjs [island|meadow|mirror ...]
import fs from 'node:fs/promises';
import {openBrowser} from './lib/browser.mjs';
const {browser,close}=await openBrowser();
const results=[];
const variants=[
  {name:'full',density:1,reach:1,ratio:1,detail:2,mirror:1},
  {name:'no-grass',density:1,reach:1,ratio:1,detail:2,mirror:1,hideGrass:true},
  {name:'no-reflection',density:1,reach:1,ratio:1,detail:2,mirror:0},
  {name:'no-bloom',density:1,reach:1,ratio:1,detail:2,mirror:1,noBloom:true},
  {name:'density-75',density:.75,reach:1,ratio:1,detail:2,mirror:1},
  {name:'reach-85',density:1,reach:.85,ratio:1,detail:2,mirror:1},
  {name:'old-medium',density:.55,reach:.85,ratio:1,detail:1,mirror:1},
  {name:'medium-candidate',density:.8,reach:.95,ratio:1,detail:1,mirror:1},
  {name:'old-low',density:.25,reach:.7,ratio:.72,detail:0,mirror:2},
  {name:'low-candidate',density:.55,reach:.85,ratio:.85,detail:0,mirror:2},
  {name:'full-retina',density:1,reach:1,ratio:2,detail:2,mirror:1},
];
try {
 for(const chapter of process.argv.slice(2).length?process.argv.slice(2):['island','meadow','mirror']) {
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();let source=await response.text();
   const hold='if (params.hold !== null && frameIndex >= params.hold) {';
   if(!source.includes(hold))throw Error('Missing hold hook');
   source=source.replace(hold,hold+' if (window.__qualityProbe?.paused) { requestAnimationFrame(frame); return; }');
   source+=`\nwindow.__qualityProbe={paused:false, configure(v){
    this.variant=v; pixelRatio=v.ratio; post.samples=2; resize();
    grass.group.visible=!v.hideGrass; grass.setQuality(v.density,v.reach,true);
    terrain.detail=[1.1,1.35,1.6][v.detail]; terrain.update(rig.camera);
    water.mirrorEvery=v.mirror; water.mirrorScale=[.5,.625,.75][v.detail];
    grass.update(rig.camera);grass.bake(renderer);
   }, draw(){
    renderer.info.reset();wind.step(1/60,time,false);
    if(this.variant.mirror)water.update(rig.camera,c=>terrain.beginMirror(c),()=>terrain.endMirror());
    const bloom=post.bloom.render;
    if(this.variant.noBloom)post.bloom.render=()=>{};
    post.render(time);post.bloom.render=bloom;
   }};`;
   await route.fulfill({response,body:source});
  });
  await page.goto('http://127.0.0.1:5230/?shot&hold=120&ratio=1&msaa=2&analytics=0&progress=0'+(chapter==='island'?'':'&chapter='+chapter));
  await page.waitForFunction(()=>window.__stats?.frame>=120,null,{timeout:120000});
  await page.evaluate(()=>{__qualityProbe.paused=true});
  const pairs=[
   {name:'density 55 to 80',a:{name:'a',density:.55,reach:.95,ratio:1,detail:1,mirror:1},b:{name:'b',density:.8,reach:.95,ratio:1,detail:1,mirror:1}},
   {name:'density 25 to 55',a:{name:'a',density:.25,reach:.85,ratio:.85,detail:0,mirror:2},b:{name:'b',density:.55,reach:.85,ratio:.85,detail:0,mirror:2}},
   {name:'reach 85 to 95',a:{name:'a',density:.8,reach:.85,ratio:1,detail:1,mirror:1},b:{name:'b',density:.8,reach:.95,ratio:1,detail:1,mirror:1}},
   {name:'scale 72 to 85',a:{name:'a',density:.55,reach:.85,ratio:.72,detail:0,mirror:2},b:{name:'b',density:.55,reach:.85,ratio:.85,detail:0,mirror:2}},
   {name:'reflection every second frame',a:variants[0],b:{...variants[0],mirror:2}},
   {name:'bloom off',a:variants[0],b:variants.find(v=>v.name==='no-bloom')},
   {name:'grass hidden',a:variants[0],b:variants.find(v=>v.name==='no-grass')},
   {name:'scale 1 to 2',a:variants[0],b:variants.find(v=>v.name==='full-retina')},
   {name:'Medium old to new',a:variants.find(v=>v.name==='old-medium'),b:variants.find(v=>v.name==='medium-candidate')},
   {name:'Low old to new',a:variants.find(v=>v.name==='old-low'),b:variants.find(v=>v.name==='low-candidate')},
  ];
  for(const pair of pairs){
   const runs=await page.evaluate(async pair=>{
    const gl=__game.renderer.getContext();
    async function complete(){
     const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
     const until=performance.now()+15000;
     try{for(;;){const status=gl.clientWaitSync(fence,0,0);
      if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;
      if(status===gl.WAIT_FAILED||performance.now()>until)throw Error('GPU fence did not complete');
      await new Promise(r=>setTimeout(r,0));
     }}finally{gl.deleteSync(fence)}
    }
    async function measure(v){
     __qualityProbe.configure(v);
     for(let i=0;i<2;i++)__qualityProbe.draw();await complete();
     const start=performance.now();for(let i=0;i<8;i++)__qualityProbe.draw();await complete();
     return (performance.now()-start)/8;
    }
    const runs=[];
    for(let round=0;round<5;round++){
     const order=round%2?['b','a','a','b']:['a','b','b','a'];
     const samples={a:[],b:[]};
     for(const key of order)samples[key].push(await measure(pair[key]));
     const a=(samples.a[0]+samples.a[1])/2,b=(samples.b[0]+samples.b[1])/2;
     runs.push({a,b,delta:b-a,percent:(b/a-1)*100});
    }
    return runs;
   },pair);
   const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
   const round=n=>Math.round(n*100)/100;
   const row={chapter,pair:pair.name,deltaMs:round(median(runs.map(r=>r.delta))),percent:round(median(runs.map(r=>r.percent))),
    rangeMs:[round(Math.min(...runs.map(r=>r.delta))),round(Math.max(...runs.map(r=>r.delta)))],runs};
   results.push(row);console.log(JSON.stringify(row));
  }
  for(const name of ['full','old-medium','medium-candidate','old-low','low-candidate']){
   await page.evaluate(v=>{__qualityProbe.configure(v);__qualityProbe.draw()},variants.find(v=>v.name===name));
   await page.screenshot({path:`/tmp/updraft-budget-${chapter}-${name}.png`});
  }
  if(errors.length)throw Error(errors.join('\n'));
  await page.close();
 }
 await fs.writeFile('/tmp/updraft-quality-budget-paired.json',JSON.stringify(results,null,2));
}finally{await close()}
