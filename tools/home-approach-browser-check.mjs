// Completed mirror departure through the real crossing, docking and jetty walk, in both aspects.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {openBrowser} from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-home-approach';
const server=await createServer({configFile:false,envDir:false,define:{__BUILD_ID__:JSON.stringify('home-approach-check')},
  server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await server.listen();
const {browser,close}=await openBrowser();const report=[];
try {
 for(const [width,height] of [[1280,720],[390,844]].filter(([w])=>!process.env.W||w===Number(process.env.W))) {
  const page=await browser.newPage({viewport:{width,height},
   ...(process.env.VIDEO?{recordVideo:{dir:`${prefix}-video`,size:{width,height}}}:{})}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?shot&chapter=mirror&ratio=1&msaa=2&progress=0`);
  await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
  await page.evaluate(async()=>{
   const {MIRROR_BERTH}=await import('/src/world/sky-mirror-layout.ts'),g=__game;
   g.skyMirror.restore(g.skyMirror.stars.length);
   g.story.sail(MIRROR_BERTH.x,MIRROR_BERTH.z,MIRROR_BERTH.yaw);
   g.story.current.beat='aboard';g.story.current.frame();g.rig.cut(g.story.shot);
   window.homeApproachLog={frames:0,worstChild:0,maxTurn:0,homeAt:null,elapsed:0,states:[]};
   const update=g.rig.update.bind(g.rig),direction=g.boat.position.clone(),last=direction.clone();
   g.rig.camera.getWorldDirection(last);
   g.rig.update=(dt,...rest)=>{
    update(dt,...rest);const log=homeApproachLog;log.elapsed+=dt;log.frames++;
    const p=g.child.position.clone();p.y+=1.2;p.project(g.rig.camera);
    log.worstChild=Math.max(log.worstChild,Math.abs(p.x),Math.abs(p.y));
    g.rig.camera.getWorldDirection(direction);
    log.maxTurn=Math.max(log.maxTurn,last.angleTo(direction));last.copy(direction);
    if(g.story.name==='home'&&log.homeAt===null)log.homeAt=log.elapsed;
   };
  });
  for(const [label,time] of [['leaving',5],['first-light',15],['approach',25],
   ...(process.env.VIDEO?[['clearing-27',27],['clearing-29',29],['clearing-31',31],['clearing-33',33]]:[]),
   ['settling',35],['docked',0],['planks',8],['shore',17]]) {
   const afterDock=['docked','planks','shore'].includes(label);
   await page.waitForFunction(({time,afterDock})=>afterDock
    ? homeApproachLog.homeAt!==null&&homeApproachLog.elapsed-homeApproachLog.homeAt>=time
    : homeApproachLog.elapsed>=time,{time,afterDock},{timeout:60000});
   await page.screenshot({path:`${prefix}-${width}-${label}.png`});
   const state=await page.evaluate(()=>({chapter:__game.story.name,beat:__game.story.current.beat,time:homeApproachLog.elapsed,
    haze:__game.story.haze,eye:__game.rig.camera.position.toArray(),child:__game.child.position.toArray(),boat:__game.boat.position.toArray(),
    veil:__game.terrain.mesh.material.uniforms.uVeil.value.toArray()}));
   console.log(JSON.stringify({width,label,...state}));await page.evaluate(state=>homeApproachLog.states.push(state),{label,...state});
  }
  const result=await page.evaluate(()=>homeApproachLog);report.push({width,height,...result,errors});
  assert(result.homeAt!==null,'real sailing must reach Home');
  assert(result.worstChild<1,'child stays in view through docking');
  assert(result.maxTurn<.08,'camera must stay continuous through docking');
  assert(result.states.at(-1).haze<.6,'mist clears while the child walks in');
  assert.deepEqual(errors,[]);
  await page.close();
  if(process.env.VIDEO)await page.video().saveAs(`${prefix}-${width}.webm`);
 }
}finally{fs.writeFileSync(`${prefix}.json`,JSON.stringify(report,null,2));await close();await server.close();}
