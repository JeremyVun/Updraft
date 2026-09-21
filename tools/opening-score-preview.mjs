// node tools/opening-score-preview.mjs [/tmp/updraft-opening-study]
// Original opening versus a restrained evolution. No runtime changes; fixed-source Web Audio render.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createServer} from 'vite';
import {audioPage,wav} from './lib/audio-render.mjs';
import {openingStudy,openingNotes} from './lib/opening-score-proposal.mjs';
const dir=path.resolve(process.argv[2]??'/tmp/updraft-opening-study');fs.mkdirSync(dir,{recursive:true});
const snapshot=fs.mkdtempSync(path.join(os.tmpdir(),'updraft-opening-source-'));
const sources=['src/tuning.ts',...fs.readdirSync('src/audio').filter(f=>f.endsWith('.ts')).map(f=>'src/audio/'+f),
  'tools/lib/opening-score-proposal.mjs'];
const hashes={};for(const file of sources){const b=fs.readFileSync(file),to=path.join(snapshot,file);
  hashes[file]=crypto.createHash('sha256').update(b).digest('hex');fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,b);}
const report={...openingStudy,notes:openingNotes,source:hashes,checks:[],clips:[],
  method:'The production opening pad, chord clock, life response and cue ducking are unchanged in both alternatives. Revised adds only a quiet answering voice. Identical seeded environment and input in the scene versions. One common playback gain for all files, no per-version normalization. Condensed story timing, not a gameplay recording. Numerical checks are not a listening sign-off.'};
const check=(ok,label)=>{assert(ok,label);report.checks.push(label);};
check(openingNotes.every(n=>n.at>=16),'No new notes in the first sixteen seconds');
check(!openingNotes.some(n=>n.at>=56&&n.at<80),'No added notes during the fall or tending');
check(openingNotes.every(n=>n.midi>=62&&n.midi<=69&&n.level<=.008),'Added melody stays quiet and within one fifth');
function measure(file){const p=spawnSync('ffmpeg',['-hide_banner','-nostats','-i',file,'-af','ebur128=peak=true','-f','null','-'],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);return {lufs:Number([...p.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)[1]),
    peak:Number([...p.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)[1])};}
const server=await createServer({root:snapshot,configFile:false,envDir:false,cacheDir:path.join(snapshot,'.vite'),server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
try{
  await server.listen();const session=await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);browser=session.browser;
  const renders={};
  for(const kind of ['music','scene'])for(const version of ['original','revised']){
    const r=await session.page.evaluate(async({kind,version,seconds})=>{
      const {openingState,scheduleOpening}=await import('/tools/lib/opening-score-proposal.mjs');
      const random=Math.random;let seed=51473;Math.random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
      try{
        const {ctx,sound}=offlineSound(seconds);
        for(const f of ['cricket','owl','skylark','peep','bugle'])sound[f]=()=>{};
        // Background-only versions leave out player chimes and authored one-shots, but retain their ducking.
        if(kind==='music')sound.chime=()=>{};
        const added=version==='revised'?scheduleOpening(ctx,sound):null;
        const update=tick=>{const t=tick/8;sound.update(.125,openingState(t,baseState));
          if(kind==='music')for(const f of ['breezeGain','seaGain','gustGain','whistleGain','rustleGain','liftGain','rainGain','patterGain']){
            sound[f].gain.cancelScheduledValues(ctx.currentTime);sound[f].gain.value=0;
          }};
        update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
        for(let tick=1;tick<seconds*8;tick++){await pause;update(tick);if(tick+1<seconds*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
        const buffer=await rendering;const remaining=added?.voices.size??0;added?.dispose();
        return {...encodeAudio(buffer),remaining};
      }finally{Math.random=random;}
    },{kind,version,seconds:openingStudy.seconds});
    check(r.clipped===0,`${version}/${kind}: no clipping`);check(r.remaining===0,`${version}/${kind}: added voices release`);
    const pcm=Buffer.from(r.pcm,'base64'),file=path.join(dir,`${version}-${kind}-raw.wav`);fs.writeFileSync(file,wav(pcm));
    renders[`${version}-${kind}`]={pcm,...measure(file),peakDbFS:r.peakDbFS};
    console.log(`Rendered ${version}/${kind}`);
  }
  for(const kind of ['music','scene']){
    const a=renders[`original-${kind}`].pcm,b=renders[`revised-${kind}`].pcm;
    const x=new Int16Array(a.buffer,a.byteOffset,a.byteLength/2),y=new Int16Array(b.buffer,b.byteOffset,b.byteLength/2);
    // Separate Chrome graphs can round a handful of samples to adjacent PCM values.
    let introPeak=0,introPower=0;for(let i=0;i<16*48000;i++){const delta=x[i]-y[i];introPeak=Math.max(introPeak,Math.abs(delta));introPower+=(delta/32768)**2;}
    check(introPeak<=1&&10*Math.log10(Math.max(1e-20,introPower/(16*48000)))<-110,
      `${kind}: original first sixteen seconds retained within PCM rounding precision`);
    let diff=0,count=0;for(let i=58*48000;i<79*48000;i++){diff+=((x[i]-y[i])/32768)**2;count++;}
    check(10*Math.log10(Math.max(1e-20,diff/count))<-85,`${kind}: added dry sound and reverb clear for the fall and care`);
  }
  const gainDb=Math.min(14,-23-Math.max(...Object.values(renders).map(r=>r.lufs)),-3-Math.max(...Object.values(renders).map(r=>r.peakDbFS)));
  report.playbackGainDb=gainDb;
  const gain=10**(gainDb/20);
  function exportClip(name,pcm){
    const source=new Int16Array(pcm.buffer,pcm.byteOffset,pcm.byteLength/2),out=new Int16Array(source.length);
    for(let i=0;i<source.length;i++){
      const fade=Math.max(0,Math.min(1,i/(48000*.03),(source.length-i-1)/(48000*1.2)));
      const value=source[i]*gain*fade;assert(Math.abs(value)<32767);out[i]=Math.round(value);
    }
    const file=path.join(dir,name);fs.writeFileSync(file+'.wav',wav(Buffer.from(out.buffer)));
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',file+'.wav','-c:a','libmp3lame','-b:a','192k',file+'.mp3']);
    const metrics=measure(file+'.mp3');check(metrics.peak<-2,`${name}: decoded MP3 retains headroom`);
    report.clips.push({name,...metrics});return Buffer.from(out.buffer);
  }
  for(const [name,r] of Object.entries(renders))exportClip(name,r.pcm);
  // Compare the discovery/awakening portion: the original first, revised enters at 0:58.
  const count=56*24000*4;
  const a=exportClip('comparison-original',renders['original-music'].pcm.subarray(0,count));
  const b=exportClip('comparison-revised',renders['revised-music'].pcm.subarray(0,count));
  fs.writeFileSync(path.join(dir,'comparison.wav'),wav(Buffer.concat([a,Buffer.alloc(2*24000*4),b])));
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(dir,'comparison.wav'),'-c:a','libmp3lame','-b:a','192k',path.join(dir,'comparison.mp3')]);
  report.comparison={seconds:114,revisedStarts:58};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks.length,gainDb,clips:report.clips},null,2));
}finally{await browser?.close();await server.close();fs.rmSync(snapshot,{recursive:true,force:true});}
