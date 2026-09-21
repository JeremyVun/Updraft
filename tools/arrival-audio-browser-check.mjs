// Arrange the final sailing leg, then let the real boat, story, audio clock and pointer run through arrival.
// node tools/arrival-audio-browser-check.mjs (Vite on 5230; shared GPU lock).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
const {browser,close}=await openBrowser();
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?shot&chapter=lines&ratio=1&msaa=2&progress=0');
  await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
  await page.mouse.click(10,10);
  await page.evaluate(()=>{
    const g=__game;g.sound.start();g.story.sail(8.5,21.5,.95);g.story.begin('toLines');
    window.arrivalAudio={phases:[],notes:[],landed:null,restarted:false};
    const update=g.sound.update.bind(g.sound),chime=g.sound.chime.bind(g.sound);
    g.sound.chime=(...args)=>{
      if(g.sound.linesScore)arrivalAudio.notes.push({midi:args[0],chord:[...g.sound.linesScore.chordAt(args[3])]});
      chime(...args);
    };
    g.sound.update=(dt,state)=>{
      update(dt,state);if(!g.sound.running)return;
      const stage=g.sound.arrivalTransition.stage,now=g.sound.ctx.currentTime;
      if(arrivalAudio.phases.at(-1)?.stage!==stage)arrivalAudio.phases.push({stage,now,chapter:g.story.name});
      if(g.sound.linesScore&&g.story.name==='toLines')window.approachScore=g.sound.linesScore;
      if(g.story.name==='lines'){
        arrivalAudio.landed??={now,epoch:g.sound.linesScore?.current?.epoch,beat:g.story.current.beat};
        if(g.sound.linesScore!==window.approachScore)arrivalAudio.restarted=true;
      }
    };
  });
  await page.waitForFunction(()=>__game.sound.running&&__game.sound.mood==='still');
  await page.evaluate(()=>{
    const g=__game,c=g.story.current;
    c.leg=c.route.length-1;
    const target=c.route[c.leg],previous=c.route[c.leg-1],direction=target.clone().sub(previous).normalize();
    g.story.sail(target.x-direction.x*75,target.y-direction.y*75,Math.atan2(direction.x,direction.y));
    g.boat.steerFor=target;g.boat.canGround=true;
  });
  await page.waitForFunction(()=>__game.sound.arrivalTransition.stage==='incoming',null,{timeout:20000});
  await page.mouse.move(300,420);await page.mouse.down();
  await page.mouse.move(1000,360,{steps:36});await page.mouse.up();
  try {
    await page.waitForFunction(()=>arrivalAudio.landed&&__game.story.current.beat!=='ashore',null,{timeout:45000});
  } catch(error) {
    console.log(await page.evaluate(()=>({audio:arrivalAudio,chapter:__game.story.name,beat:__game.story.current.beat,
      position:__game.boat.position.toArray(),speed:__game.boat.speed,grounded:__game.boat.grounded,
      leg:__game.story.current.leg,route:__game.story.current.route})));
    throw error;
  }
  const report=await page.evaluate(()=>arrivalAudio);
  const fade=report.phases.find(p=>p.stage==='fade'),gap=report.phases.find(p=>p.stage==='gap'),incoming=report.phases.find(p=>p.stage==='incoming');
  assert(fade&&gap&&incoming);
  assert(Math.abs(gap.now-fade.now-1.5)<.15,'Fade duration follows the audio clock');
  assert(Math.abs(incoming.now-gap.now-.4)<.15,'Short background breath');
  assert.equal(incoming.chapter,'toLines','Incoming music begins while still sailing');
  assert(report.landed.now-report.landed.epoch>2,'The first melody notes begin before grounding');
  assert.equal(report.restarted,false,'Landing keeps the approach phrase running');
  assert(report.notes.length>0&&report.notes.every(n=>n.chord.some(m=>(m-n.midi)%12===0)),'Real pointer gestures match the approach score');
  assert.deepEqual(errors,[]);
  fs.writeFileSync('/tmp/updraft-arrival-audio-browser.json',JSON.stringify({report,errors},null,2));
  console.log(JSON.stringify({phases:report.phases,landed:report.landed,matchedChimes:report.notes.length}));
}finally{await close();}
