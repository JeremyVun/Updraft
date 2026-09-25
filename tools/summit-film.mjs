// Full summit film with the real game audio: Sky Mirror departure, the harbour crossing, the jetty, the climb,
// the fledging, the drawing, the walk home and the credits, on one fixed 60 Hz clock.
// Usage: node tools/summit-film.mjs [outDir]. LIFT_AFTER=<s> delays the simulated updraft after `tries` begins.
// Writes summit.webm, audio.wav, marks.json (beats, camera turn rate per frame).
import fs from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { openBrowser } from './lib/browser.mjs';
import { wav } from './lib/audio-render.mjs';
const out=process.argv[2]??fs.mkdtempSync('/tmp/updraft-summit-film-');
fs.mkdirSync(out,{recursive:true});
const W=Number(process.env.W??1280),H=Number(process.env.H??720),creditsFor=Number(process.env.CREDITS_FOR??30);
const liftAfter=Number(process.env.LIFT_AFTER??6),skipUntil=process.env.FROM_BEAT;
const server=await createServer({configFile:false,envDir:false,define:{__BUILD_ID__:JSON.stringify('summit-film')},server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await server.listen();
console.log(JSON.stringify({out,stage:'waiting for GPU'}));
const {browser,close}=await openBrowser();
let encoder;
try {
 const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>{if(cb.name==='frame'){window.__nextFrame=cb;return 1}return raf(cb)};
  window.__drive=()=>{window.__clock+=1000/60;const cb=window.__nextFrame;window.__nextFrame=null;cb(window.__clock)};
 });
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?shot=1&chapter=mirror&ratio=1&msaa=2&analytics=0&progress=0`);
 await page.waitForFunction(()=>!!window.__nextFrame&&window.__game,null,{timeout:120000});
 await page.evaluate(()=>{window.__clock=performance.now()+100;__drive()});
 await page.waitForFunction(()=>{for(let j=0;j<5;j++)if(window.__nextFrame)__drive();return window.__ready===true},null,{timeout:120000,polling:50});
 await page.exposeFunction('saveAudioChunk',b64=>fs.appendFileSync(`${out}/audio.pcm`,Buffer.from(b64,'base64')));
 fs.rmSync(`${out}/audio.pcm`,{force:true});
 await page.evaluate(async({liftAfter})=>{
  const {MIRROR_BERTH}=await import('/src/world/sky-mirror-layout.ts'),g=__game;
  g.skyMirror.restore(g.skyMirror.stars.length);
  g.story.sail(MIRROR_BERTH.x,MIRROR_BERTH.z,MIRROR_BERTH.yaw);
  g.story.current.beat='aboard';g.story.current.frame();g.rig.cut(g.story.shot);
  const ctx=new OfflineAudioContext(2,480*24000,24000),Native=window.AudioContext;
  window.AudioContext=function(){return ctx};
  try{g.sound.start()}finally{window.AudioContext=Native}
  Object.defineProperty(g.sound,'running',{get:()=>true});
  window.__marks=[];window.__turn=[];
  let lastKey='',triesAt=-1;
  const dir=new g.rig.camera.position.constructor(),last=dir.clone();let haveLast=false;
  const soundUpdate=g.sound.update.bind(g.sound);
  g.sound.update=(dt,state)=>{
   soundUpdate(dt,state);
   const c=g.story.current,key=`${g.story.name}:${c.beat}`;
   if(key!==lastKey){lastKey=key;__marks.push({chapter:g.story.name,beat:c.beat,audio:ctx.currentTime});}
   if(c.beat==='tries'&&triesAt<0)triesAt=ctx.currentTime;
   window.__liftOn=triesAt>=0&&ctx.currentTime-triesAt>=liftAfter;
   g.rig.camera.getWorldDirection(dir);
   if(haveLast)__turn.push([+ctx.currentTime.toFixed(3),+(THREE_deg(last.angleTo(dir))/dt).toFixed(2),g.story.name,c.beat]);
   last.copy(dir);haveLast=true;
  };
  function THREE_deg(r){return r*180/Math.PI}
  const sample=g.wind.sample.bind(g.wind);
  g.wind.sample=(x,z,o)=>{
   const r=sample(x,z,o),c=g.story.current;
   if(window.__liftOn&&['tries','flying','answered'].includes(c.beat)&&Math.hypot(x-g.cygnet.position.x,z-g.cygnet.position.z)<4)r.lift=2;
   return r;
  };
  let tick=1,pause=ctx.suspend(tick/60);
  const rendered=ctx.startRendering();
  window.__advance=async(count)=>{
   for(let i=0;i<count;i++){await pause;__drive();pause=ctx.suspend(++tick/60);await ctx.resume();}
   const c=g.story.current;
   if(c.beat==='credits'){
    for(const a of document.getAnimations()){const t=a.effect?.target;if(t?.closest('#credits,#again')){a.pause();a.currentTime=c.t*1000;}}
   }
   return {chapter:g.story.name,beat:c.beat,t:c.t,audio:ctx.currentTime};
  };
  window.__finishAudio=async()=>{
   await pause;await ctx.resume();const buffer=await rendered;
   let peak=0,clipped=0;const from=Math.round((window.__videoAudioStart??0)*24000),length=Math.round(window.__videoDuration*24000);
   for(let offset=from;offset<from+length;offset+=24000){
    const count=Math.min(24000,from+length-offset),pcm=new Int16Array(count*2);
    for(let ch=0;ch<2;ch++){const d=buffer.getChannelData(ch);
     for(let i=0;i<count;i++){const v=d[offset+i];peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=1)clipped++;pcm[i*2+ch]=Math.round(Math.max(-1,Math.min(1,v))*32767);}}
    const bytes=new Uint8Array(pcm.buffer);let bin='';
    for(let i=0;i<bytes.length;i+=16384)bin+=String.fromCharCode(...bytes.subarray(i,i+16384));
    await saveAudioChunk(btoa(bin));
   }
   return {peakDbFS:20*Math.log10(peak),clipped};
  };
 },{liftAfter});
 encoder=spawn('ffmpeg',['-v','error','-f','image2pipe','-vcodec','mjpeg','-framerate','30','-i','pipe:0','-an','-c:v','libvpx-vp9','-crf','34','-b:v','2500k','-deadline','realtime','-cpu-used','6','-row-mt','1','-threads','4','-pix_fmt','yuv420p',`${out}/picture.webm`],{stdio:['pipe','ignore','pipe']});
 let ffErrors='';encoder.stderr.on('data',b=>ffErrors+=b);
 const completed=once(encoder,'close');
 let state=await page.evaluate(()=>__advance(1)),frames=0,lastBeat='';
 if(skipUntil){while(state.beat!==skipUntil)state=await page.evaluate(()=>__advance(20));console.log('capturing from',JSON.stringify(state));}
 await page.evaluate(()=>{window.__videoAudioStart=__game.sound.ctx.currentTime;});
 for(;frames<30*480;frames++){
  const shot=await page.screenshot({type:'jpeg',quality:88,timeout:60000});
  if(!encoder.stdin.write(shot))await once(encoder.stdin,'drain');
  const key=`${state.chapter}:${state.beat}`;
  if(key!==lastBeat){lastBeat=key;console.log(JSON.stringify({frame:frames,video:+(frames/30).toFixed(2),...state}));fs.writeFileSync(`${out}/beat-${String(frames).padStart(5,'0')}-${state.chapter}-${state.beat}.jpg`,shot);}
  if(state.beat==='credits'&&state.t>=creditsFor){frames++;break;}
  state=await page.evaluate(()=>__advance(2));
 }
 encoder.stdin.end();const [code]=await completed;assert.equal(code,0,ffErrors);
 await page.evaluate(d=>{window.__videoDuration=d},frames/30);
 const report=await page.evaluate(()=>__finishAudio());
 const marks=await page.evaluate(()=>({marks:__marks,turn:__turn}));
 fs.writeFileSync(`${out}/audio.wav`,wav(fs.readFileSync(`${out}/audio.pcm`)));
 fs.rmSync(`${out}/audio.pcm`);
 execFileSync('ffmpeg',['-v','error','-y','-i',`${out}/picture.webm`,'-i',`${out}/audio.wav`,'-c:v','copy','-c:a','libopus','-b:a','160k','-shortest',`${out}/summit.webm`]);
 fs.writeFileSync(`${out}/marks.json`,JSON.stringify({frames,duration:frames/30,...report,errors,...marks}));
 console.log(JSON.stringify({out,frames,duration:frames/30,...report,errors:errors.length}));
}finally{encoder?.stdin.destroy();await close();await server.close();}
