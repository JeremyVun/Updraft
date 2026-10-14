// Leaving the Sky Mirror in the real game, with no input from `?chapter=mirrorEnd`: the Mirror's position as the boat
// leaves, the seam chosen, when the Mirror falls silent and when `home.ogg` begins, on the audio clock and the crossing's.
// node tools/homeward-audio-browser-check.mjs (about 2 minutes; shared GPU lock). Seam rules: `homeward-audio-check.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {openBrowser} from './lib/browser.mjs';
// A private server prevents a concurrent workspace edit from reloading the game mid-transition.
const server=await createServer({configFile:false,envDir:false,define:{__BUILD_ID__:JSON.stringify('homeward-audio-check')},
  server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await server.listen();
const {browser,close}=await openBrowser({allowAutoplay:false}),errors=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?shot&start=1&progress=0&chapter=mirrorEnd&ratio=1&msaa=2`);
  await page.waitForSelector('#veil.ready',{timeout:60000});
  await page.evaluate(()=>{
    const g=__game,sound=g.sound,update=sound.update.bind(sound);
    const level=bus=>{
      if(!bus)return -Infinity;
      bus.meter??=Object.assign(sound.ctx.createAnalyser(),{fftSize:2048});
      if(!bus.metered){bus.connect(bus.meter);bus.metered=true;}
      const data=new Float32Array(2048);bus.meter.getFloatTimeDomainData(data);
      return 10*Math.log10(data.reduce((sum,v)=>sum+v*v,0)/data.length+1e-20);
    };
    window.homeward={chapters:[],leave:null,mirrorHeard:null,homeStart:null,homeHeard:null};
    sound.update=(dt,state)=>{
      const mirror=sound.mirrorScore;
      update(dt,state);
      if(!sound.running)return;
      const now=sound.ctx.currentTime,story=g.story,w=homeward;
      if(w.chapters.at(-1)?.name!==story.name)w.chapters.push({name:story.name,now});
      const transition=sound.arrivalTransition;
      if(!w.leave&&story.name==='toHarbour'){
        w.leave={now,story:story.current.homewardTime,stage:transition.stage,position:mirror?.position(now)??null,
          seam:transition.began,homeAt:transition.homeAt,release:transition.release,after:g.tuning.audio.homeStartAfter};
      }
      if(!w.leave)return;
      const t=now-w.leave.now,crossing=story.current.homewardTime;
      if(sound.mirrorScore&&level(sound.mirrorScore.bus)>-90)w.mirrorHeard=t;
      if(!w.homeStart&&sound.summitScore?.source)w.homeStart={audio:sound.summitScore.epoch-w.leave.now,crossing,
        offset:sound.summitScore.start};
      if(w.homeStart&&!w.homeHeard&&level(sound.summitScore?.bus)>-60)w.homeHeard=t;
    };
  });
  await page.locator('#sound').evaluate(button=>button.click());
  await page.locator('#begin').click();
  await page.waitForFunction(()=>homeward.homeHeard!==null&&__game.sound.ctx.currentTime>homeward.leave.now+homeward.homeStart.audio+2,null,{timeout:240000});
  const report=await page.evaluate(()=>homeward),{leave}=report;
  const timeline={
    leftAfter:+(leave.now-report.chapters[0].now).toFixed(2),
    mirrorPosition:leave.position===null?null:+leave.position.toFixed(2),
    seamAt:+(leave.seam-leave.now).toFixed(3),release:leave.release,
    seamInRecording:leave.position===null?null:+((leave.position+leave.seam-leave.now)%214.884).toFixed(2),
    mirrorLastHeard:report.mirrorHeard===null?null:+report.mirrorHeard.toFixed(3),
    homeStartAudio:+report.homeStart.audio.toFixed(3),homeStartCrossing:+report.homeStart.crossing.toFixed(3),
    homeOffset:+report.homeStart.offset.toFixed(3),homeHeard:+report.homeHeard.toFixed(3),
    chapters:report.chapters.map(c=>({name:c.name,at:+(c.now-leave.now).toFixed(2)})),
  };
  console.log(JSON.stringify(timeline,null,2));
  fs.writeFileSync('/tmp/updraft-homeward-browser.json',JSON.stringify({timeline,report,errors},null,2));
  assert(leave.position!==null,'The Mirror is sounding as the boat leaves');
  assert(report.mirrorHeard<=leave.seam-leave.now+.1,'The Mirror is silent from its seam');
  assert(Math.abs(report.homeStart.crossing-leave.after)<=.05&&report.homeStart.offset<.1,'Home begins from its top on schedule');
  assert.deepEqual(errors,[]);
}finally{await close();await server.close();}
