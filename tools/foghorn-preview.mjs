// node tools/foghorn-preview.mjs [/tmp/updraft-foghorn-study]
// Approved reference, production cue integration, scene without the horn, and an isolated call.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createServer} from 'vite';
import {audioPage,wav} from './lib/audio-render.mjs';
import {foghornProposal} from './lib/foghorn-proposal.mjs';
const dir=path.resolve(process.argv[2]??'/tmp/updraft-foghorn-study');fs.mkdirSync(dir,{recursive:true});
const root=fs.mkdtempSync(path.join(os.tmpdir(),'updraft-horn-source-'));
const files=['src/tuning.ts',...fs.readdirSync('src/audio').filter(f=>f.endsWith('.ts')).map(f=>'src/audio/'+f),'tools/lib/foghorn-proposal.mjs'];
const hashes={};for(const file of files){const b=fs.readFileSync(file),to=path.join(root,file);
  hashes[file]=crypto.createHash('sha256').update(b).digest('hex');fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,b);}
const report={source:hashes,seconds:32,events:{horn:8,hornEnd:8+foghornProposal.duration,thunder:17.4,lighthouseFades:19,planeTaken:22},
  method:'Illustrative storm timeline with production Drowned score, wind/rain and thunder. Compare the approved synthesis reference with the integrated production cue at the same fixed playback gain. This is not a recorded gameplay traversal.',checks:[],clips:[]};
const check=(ok,m)=>{assert(ok,m);report.checks.push(m);};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:path.join(root,'.vite'),server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
function measure(file){const r=spawnSync('ffmpeg',['-hide_banner','-nostats','-i',file,'-af','ebur128=peak=true','-f','null','-'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);return {lufs:Number([...r.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)[1]),peak:Number([...r.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)[1])};}
try{
  await server.listen();const session=await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);browser=session.browser;
  const renders={};
  for(const kind of ['without','with','isolated','integrated']){
    const result=await session.page.evaluate(async kind=>{
      const {foghorn,foghornProposal}=await import('/tools/lib/foghorn-proposal.mjs');
      const random=Math.random;let seed=84731;Math.random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
      try{
        const {ctx,sound}=offlineSound(32);
        for(const fn of ['cricket','owl','skylark','peep','bugle'])sound[fn]=()=>{};
        let horn=kind==='with'||kind==='isolated'?foghorn(ctx,sound.master,sound.reverb,8):null;
        let calls=0;
        const productionHorn=sound.foghorn.bind(sound);
        sound.foghorn=()=>{calls++;horn=productionHorn();return horn;};
        if(kind==='isolated'){sound.backgroundGate.disconnect();sound.wetGate.disconnect();}
        if(kind!=='isolated'){
          Object.defineProperty(ctx,'currentTime',{configurable:true,value:17.4});
          try{sound.thunder(.22,-.15);}finally{delete ctx.currentTime;}
        }
        const update=tick=>{
          const time=tick/8;
          sound.update(.125,{...baseState,music:'drowned',drownedScore:time<22?'gather':'loss',hush:time<22?.6:.85,
            sea:1,land:0,overLand:false,breeze:1,night:.55+Math.min(1,time/20)*.45,shower:Math.min(1,time/14),
            flockChatter:false,scripted:time>=22&&time<26,cues:kind==='integrated'&&tick===64?['foghorn']:[]});
          if(kind==='isolated')for(const field of ['breezeGain','seaGain','rainGain','patterGain','gustGain','whistleGain','rustleGain','liftGain']){
            sound[field].gain.cancelScheduledValues(ctx.currentTime);sound[field].gain.value=0;
          }
        };
        update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
        for(let tick=1;tick<32*8;tick++){await pause;update(tick);if(tick+1<32*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
        const buffer=await rendering;
        const rms=(from,to)=>{let sum=0;for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch).subarray(Math.floor(from*24000),Math.floor(to*24000)))sum+=x*x;
          return 10*Math.log10(Math.max(1e-20,sum/(2*(to-from)*24000)));};
        return {...encodeAudio(buffer),remaining:horn?.sources.size??0,horn:foghornProposal,calls,cueSpaceUntil:sound.cueSpaceUntil,
          early:rms(8,8.1),body:rms(9.5,11),beforeThunder:rms(17,17.4),beforePlane:rms(21,22)};
      }finally{Math.random=random;}
    },kind);
    check(result.clipped===0,`${kind}: no clipping`);check(result.remaining===0,`${kind}: all horn sources release`);
    if(kind==='integrated'){
      check(result.calls===1,'Production cue plays exactly one call');
      check(result.cueSpaceUntil===0,'Environmental horn does not duck the score');
    }
    if(kind==='isolated'){
      check(result.early<result.body-20,'Horn enters softly rather than striking');
      check(result.beforeThunder< -65,'Horn tail is faint before the first thunder');
      check(result.beforePlane< -85,'Horn is clear of the plane snatch');
      check(result.horn.midi===50&&result.horn.partials.every(([ratio])=>Number.isInteger(ratio)),'D3 and harmonic partials match the gathering harmony');
    }
    const pcm=Buffer.from(result.pcm,'base64'),file=path.join(dir,kind+'-raw.wav');fs.writeFileSync(file,wav(pcm));
    const {pcm:_,...metrics}=result;renders[kind]={pcm,...metrics,...measure(file)};console.log(`Rendered ${kind}`);
  }
  let maxPcmDifference=0;
  for(let i=0;i<renders.with.pcm.length;i+=2)maxPcmDifference=Math.max(maxPcmDifference,
    Math.abs(renders.with.pcm.readInt16LE(i)-renders.integrated.pcm.readInt16LE(i)));
  report.maxPcmDifference=maxPcmDifference;
  check(maxPcmDifference<=1,'Integrated cue matches the accepted reference within PCM rounding');
  // Preserve the first audition's playback level so the revision changes the horn's balance alone.
  const gainDb=Math.min(4.8,-3-Math.max(...Object.values(renders).map(r=>r.peakDbFS)));
  report.gainDb=gainDb;
  for(const [kind,r] of Object.entries(renders)){
    const file=path.join(dir,{with:'storm-with-foghorn',without:'storm-original',isolated:'foghorn-alone',integrated:'storm-integrated'}[kind]);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(dir,kind+'-raw.wav'),'-af',`volume=${gainDb}dB,afade=t=out:st=30.5:d=1.5`,'-c:a','libmp3lame','-b:a','192k',file+'.mp3']);
    const metrics=measure(file+'.mp3');check(metrics.peak<-2,`${kind}: encoded preview retains headroom`);
    const {pcm,...raw}=r;report.clips.push({kind,file:file+'.mp3',...metrics,raw});
  }
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(dir,'isolated-raw.wav'),'-af',
    `atrim=start=8:end=18,asetpts=PTS-STARTPTS,volume=${gainDb}dB`,'-c:a','libmp3lame','-b:a','192k',path.join(dir,'foghorn-close-listen.mp3')]);
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks.length,gainDb,clips:report.clips.map(({raw,...r})=>r)},null,2));
}finally{await browser?.close();await server.close();fs.rmSync(root,{recursive:true,force:true});}
