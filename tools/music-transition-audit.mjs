// Every inter-piece handoff, then every adaptive score phase, through production Web Audio.
// node tools/music-transition-audit.mjs [/tmp/updraft-music-transitions] (Vite on 5230; no GPU).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {audioPage,wav} from './lib/audio-render.mjs';
const dir=path.resolve(process.argv[2]??'/tmp/updraft-music-transitions');fs.mkdirSync(dir,{recursive:true});
const cases=[
  ['opening-lines','Opening → Lines',{music:'still',openingScore:'wander'},'lines'],
  ['lines-boats','Lines → Little Boats',{music:'lines',linesScore:'shore'},'boats'],
  ['boats-meadow','Little Boats → grey Meadow',{music:'boats',hush:.28},'meadow'],
  ['meadow-birches','Meadow → Birches',{music:'meadow',meadowScore:'return'},'birches'],
  ['birches-stairs','Birches → the stairs',{music:'birches',birchesScore:'return',birchesLoop:true},'stairs'],
  ['drowned-wood','Drowned Village → Wood',{music:'drowned',drownedScore:'farewell',hush:.85},'wood'],
  ['wood-sleeping','Wood → Sleeping',{music:'wood',hush:.55},'sleeping'],
  ['sleeping-sea','Sleeping morning → open sea',{music:'sea',sleepingScore:'morning',hush:.1},'sea'],
  ['sea-mirror','Open sea → Sky Mirror',{music:'sea',seaScore:'arrival'},'mirror'],
  ['mirror-summit','Sky Mirror → Summit',{music:'mirror',mirrorScore:'depart'},'home'],
];
const {browser,page}=await audioPage(),reports=[];
try {
  for(const [id,label,source,target] of cases) {
    const result=await page.evaluate(async({source,target})=>{
      const {ARRIVAL_MUSIC,ArrivalTransition,arrivalQuiet}=await import('/src/audio/arrival-music.ts');
      const {tuning}=await productionModule('/src/tuning.ts');
      const checks=[],check=(ok,message)=>{if(!ok)throw Error(`${target}: ${message}`);checks.push(message);};
      const legato=source.music==='drowned'&&target==='wood',homeward=source.music==='mirror'&&target==='home';
      const approach=legato?88:18,landing=approach+24,seconds=landing+8;
      const {ctx,sound}=offlineSound(seconds),phases=[];
      backgroundOnly(ctx,sound);
      let outgoing,incoming,epoch,reverb;
      const score=()=>sound.openingScore??sound.summitScore??sound.mirrorScore??sound.villageScore??sound.linesScore??sound.boatsScore
        ??sound.meadowScore??sound.birchesScore??sound.stairsScore??sound.sleepingMusic??sound.seaMusic;
      const update=tick=>{
        const t=tick/8,landed=t>=landing;
        // The sea's recording keeps the passage clock: it starts its crossing after the morning, and leaves in its close.
        const sea=target==='sea'?{seaMusicTime:t-approach-tuning.audio.seaMusicLead,seaPhrase:-1}:source.seaScore?{seaMusicTime:200,seaPhrase:5}:{};
        sound.update(.125,{...baseState,...(landed?ARRIVAL_MUSIC[target]:source),...sea,flockChatter:false,
          arrivalMusic:t>=approach&&!landed?target:undefined,arrivalReady:t>=approach+6,
          homewardTime:homeward&&t>=approach&&!landed?t-approach:undefined});
        const stage=sound.arrivalTransition.stage;
        if(phases.at(-1)?.stage!==stage)phases.push({at:t,stage});
        if(t===approach-1)outgoing=score();
        if(t===landing-3){incoming=score();epoch=incoming?.current?.epoch??incoming?.epoch;reverb=sound.reverbConvolver;}
        if(t===landing+2){check(score()===incoming,'Landing keeps the incoming score');
          check((score()?.current?.epoch??score()?.epoch)===epoch,'Landing keeps its musical clock');
          check(sound.reverbConvolver===reverb,'Landing keeps the shared reverb');}
      };
      update(0);await sound.birchesScore?.ready;await sound.linesScore?.ready;await sound.boatsScore?.ready;await sound.summitScore?.ready;let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
      for(let tick=1;tick<seconds*8;tick++){await pause;update(tick);await sound.seaMusic?.ready;await sound.preparedScore?.ready;await sound.birchesScore?.ready;await sound.linesScore?.ready;await sound.boatsScore?.ready;await sound.summitScore?.ready;await sound.villageScore?.ready;await sound.sleepingMusic?.lullaby?.ready;if(tick+1<seconds*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
      const buffer=await rendering;
      const fade=phases.find(p=>p.stage==='fade'),gap=phases.find(p=>p.stage==='gap'),entry=phases.find(p=>p.stage==='incoming');
      let gapPeak=0;
      if(homeward){
        // The Mirror finishes at a phrase seam (homeward-audio-check); Home begins on its schedule.
        check(!!gap&&!!entry&&entry.at-approach===tuning.audio.homeStartAfter,'Home begins on schedule after a rest');
        for(let ch=0;ch<2;ch++)for(let i=Math.ceil((gap.at+.02)*24000);i<entry.at*24000;i++)gapPeak=Math.max(gapPeak,Math.abs(buffer.getChannelData(ch)[i]));
        check(gapPeak===0,'The entire music/reverb rest is digitally silent');
      }else if(!legato){
        check(!!fade&&!!gap&&!!entry,'The handoff has a fade, rest and entrance');
        const quiet=arrivalQuiet(target);
        check(gap.at-fade.at>=3,'The outgoing fade lasts three seconds');
        check(entry.at-gap.at>=quiet,'The full destination-specific rest is preserved');
        for(let ch=0;ch<2;ch++)for(let i=Math.ceil((gap.at+.02)*24000);i<entry.at*24000;i++)gapPeak=Math.max(gapPeak,Math.abs(buffer.getChannelData(ch)[i]));
        check(gapPeak===0,'The entire music/reverb rest is digitally silent');
      }else check(phases.some(p=>p.stage==='blend')&&!gap,'The silent storm hands to the wood\'s drone without a gap');
      if(outgoing)check(outgoing.stopped===true||outgoing.stoppedAt!==undefined,'Outgoing scheduling is retired');
      // Entering an already-playing composition must not manufacture a second pause.
      const same=new ArrivalTransition(),state={...baseState,...ARRIVAL_MUSIC[target]};same.update(state,0);
      check(same.update({...state,arrivalMusic:target},1).stage==='none','Same-piece approach does not restart the handoff');
      const late=new ArrivalTransition();late.update({...baseState,...source},0);
      const requested={...baseState,...source,arrivalMusic:target,arrivalReady:true};
      late.update(requested,1);
      if(!legato&&!homeward){late.update(requested,30);const quiet=arrivalQuiet(target);
        check(late.update(requested,30+quiet-.01).stage==='gap','A stalled frame cannot eat the rest');
        check(late.update({...baseState,...ARRIVAL_MUSIC[target]},30+quiet+.01).changed,'Fast landing can finish the complete rest');}
      return {checks,phases,gapPeak,rest:gap&&entry?entry.at-gap.at:null,...encodeAudio(buffer)};
    },{source,target});
    assert.equal(result.clipped,0);
    const {pcm,...report}=result;reports.push({id,label,...report});
    const stem=path.join(dir,id);fs.writeFileSync(stem+'.wav',wav(Buffer.from(pcm,'base64')));
    const gain=Math.min(6,-4-report.peakDbFS);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',stem+'.wav','-af',`volume=${gain}dB,afade=t=out:st=47:d=3`,'-c:a','libmp3lame','-b:a','160k',stem+'.mp3']);
    console.log(JSON.stringify({id,rest:report.rest,phases:report.phases,checks:report.checks.length}));
  }
  // These are developments inside one composition, not new island tunes. Exercise every phase edge.
  const internal=await page.evaluate(async()=>{
    const tables=[
      ['lines','linesScore','/src/audio/lines-score.ts','LINES_SECTIONS'],
      ['meadow','meadowScore','/src/audio/meadow-score.ts','MEADOW_SECTIONS'],
      ['birches','birchesScore','/src/audio/birches-score.ts','BIRCHES_SECTIONS'],
    ];
    const rows=[];
    for(const [music,field,url,key] of tables){const table=(await import(url))[key];rows.push({music,field,phases:Object.keys(table)});}
    rows.push({music:'mirror',field:'mirrorScore',phases:['approach','search','one','two','three','constellation','depart']},
      {music:'home',field:'summitScore',phases:['approach','flight','farewell','home']});
    const reports=[];
    for(const row of rows){
      const seconds=row.phases.length*12+5,{ctx,sound}=offlineSound(seconds);let starts=0,last;
      const update=tick=>{const t=tick/8,phase=row.phases[Math.min(row.phases.length-1,Math.floor(t/12))];
        sound.update(.125,{...baseState,music:row.music,[row.field]:phase,flockChatter:false,silence:t>=seconds-3});
        if(phase!==last){starts++;last=phase;}
        if(sound.arrivalTransition.stage!=='none')throw Error('An internal section must not create an island handoff');};
      update(0);await sound.birchesScore?.ready;await sound.linesScore?.ready;await sound.boatsScore?.ready;await sound.summitScore?.ready;let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
      for(let tick=1;tick<seconds*8;tick++){await pause;update(tick);await sound.preparedScore?.ready;await sound.birchesScore?.ready;await sound.linesScore?.ready;await sound.boatsScore?.ready;await sound.summitScore?.ready;if(tick+1<seconds*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
      const buffer=await rendering;let peak=0;for(let ch=0;ch<2;ch++)for(const value of buffer.getChannelData(ch))peak=Math.max(peak,Math.abs(value));
      if(peak>=1)throw Error(`${row.field}: phase render clipped`);
      if(sound[row.field]!==null)throw Error(`${row.field}: permanent silence did not retire the score`);
      reports.push({...row,starts,peakDbFS:20*Math.log10(peak),released:true});
    }
    return reports;
  });
  // The sail from the birches to the stairs, the whole mix, on the crossing measured with no input (push-off at 0; the
  // real game's numbers come from `village-music-browser-check.mjs sail`), the birches early in a pass and near its end.
  const SAIL={aboard:2.8,request:14,ready:20.4,landing:29.4,white:69.4,end:76,
    arrivalIn:[[2.8,18.9],[4.9,18.7],[5.9,17.3],[6.9,16.7],[7.9,15.9],[8.9,14.5],[9.9,12.2],[10.9,10.5],[11.9,9.2],[12.9,8],[13.9,6.8],[14.9,5.8],[15.9,4.7],[16.9,3.6],[17.9,2.6],[18.9,1.6],[19.9,.6],[20.9,0]]};
  const sails=[];
  for(const [id,label,from] of [['sail-faded','The birches 30 s into a pass at push-off: they fade',30],['sail-ended','The birches 8 s from their end at push-off: they end on their own',238.893-8]]){
    const result=await page.evaluate(async({SAIL,from})=>{
      const {tuning}=await productionModule('/src/tuning.ts');
      const {RecordedScore}=await productionModule('/src/audio/recorded-score.ts');
      const RATE=24000,STEP=1/8,{ctx,sound}=offlineSound(SAIL.end),starts=[];
      const native=AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration){
        const length=this.buffer?.duration??0;
        if(this.context===ctx&&length>200)starts.push({track:Math.abs(length-238.89)<.05?'birches':'stairs',when,offset});
        return native.call(this,when,offset,duration);
      };
      const arrivalIn=t=>{const a=SAIL.arrivalIn,i=a.findIndex(([x])=>x>t);if(i<=0)return a[i<0?a.length-1:0][1];
        const [[t0,v0],[t1,v1]]=[a[i-1],a[i]];return v0+(v1-v0)*(t-t0)/(t1-t0);};
      const air=phase=>({phase,cloud:phase==='cloud'?1:0,climb:phase==='under'?0:1,open:0,fog:0,speed:0,clear:false});
      const state=t=>t<SAIL.aboard?{...baseState,music:'birches',birchesScore:'return',birchesLoop:true}
        :t<SAIL.landing?{...baseState,music:'birches',birchesScore:'return',birchesLoop:false,hush:.3,arrivalIn:arrivalIn(t),
          arrivalMusic:t>=SAIL.request?'stairs':undefined,arrivalReady:t>=SAIL.ready}
        :{...baseState,music:'birches',stairsSong:true,hush:.35,stairsAir:air(t<SAIL.white?'under':'cloud')};
      sound.birchesScore=new RecordedScore(ctx,sound.backgroundDry,'birches');
      sound.birchesScore.update('return',10**(tuning.audio.recordedMusicDb.birches/20),from);
      let birches=sound.birchesScore,decided=null,endsAt=null,songEnd=null;
      const step=async t=>{sound.update(STEP,state(t));
        for(const score of [sound.preparedScore,sound.birchesScore,sound.stairsScore])await score?.ready;
        if(birches.finishing&&decided===null){decided=t;endsAt=birches.endsAt;}
        if(sound.stairsScore?.finishing&&songEnd===null)songEnd=sound.stairsScore.endsAt;};
      await step(0);let pause=ctx.suspend(STEP);const rendering=ctx.startRendering();
      for(let tick=1;tick<SAIL.end/STEP;tick++){await pause;await step(tick*STEP);if(tick+1<SAIL.end/STEP)pause=ctx.suspend((tick+1)*STEP);await ctx.resume();}
      const buffer=await rendering;AudioBufferSourceNode.prototype.start=native;
      const b=starts.find(s=>s.track==='birches'),song=starts.filter(s=>s.track==='stairs');
      const ends=endsAt??b.when+238.893-b.offset,fade=tuning.audio.birchesSailFade;
      const report={birchesAtPushOff:from,birchesFadeFrom:decided===null?null:+Math.max(decided,ends-fade).toFixed(2),birchesEnds:+ends.toFixed(2),
        stairsSongStarts:song[0]?.when,quietGap:song[0]?+(song[0].when-ends).toFixed(2):null,landing:SAIL.landing,
        songBeforeLanding:song[0]?+(SAIL.landing-song[0].when).toFixed(2):null,white:SAIL.white,songEndsAfterWhite:songEnd===null?null:+(songEnd-SAIL.white).toFixed(2),
        handoffReady:SAIL.ready,songOffset:song[0]?.offset,songStarts:song.length};
      return {report,...encodeAudio(buffer)};
    },{SAIL,from});
    assert.equal(result.clipped,0);
    const r=result.report;
    assert(r.songStarts===1&&r.songOffset===0,`${id}: the stairs song starts once, from its top`);
    assert(r.quietGap>=10-.13,`${id}: at least ten seconds of quiet between the songs (${r.quietGap})`);
    const stem=path.join(dir,id);fs.writeFileSync(stem+'.wav',wav(Buffer.from(result.pcm,'base64')));
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',stem+'.wav','-c:a','libmp3lame','-b:a','160k',stem+'.mp3']);
    sails.push({id,label,...r,peakDbFS:result.peakDbFS});
    console.log(JSON.stringify({id,...r}));
  }
  // Going round on the Birches island, the whole mix: the last 10 s of a pass, its rest, the first 10 s of the next.
  // The gap and the entrance are measured on the recording alone, against the file.
  const seam=await page.evaluate(async()=>{
    const {tuning}=await productionModule('/src/tuning.ts');
    const {RecordedScore}=await productionModule('/src/audio/recorded-score.ts');
    const TAIL=10,{rest}=tuning.audio.recordedMusicLoop.birches,SECONDS=TAIL+rest+10,STEP=1/8,level=10**(tuning.audio.recordedMusicDb.birches/20);
    const go=async alone=>{
      const {ctx,sound}=offlineSound(SECONDS),starts=[],native=AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration){
        if(this.context===ctx&&(this.buffer?.duration??0)>200)starts.push({when,offset});
        return native.call(this,when,offset,duration);
      };
      if(alone)sound.master.disconnect();
      sound.birchesScore=new RecordedScore(ctx,alone?ctx.destination:sound.backgroundDry,'birches');
      sound.birchesScore.update('return',level,238.893-TAIL);
      let raw=null;
      const step=async t=>{sound.update(STEP,{...baseState,music:'birches',birchesScore:'return',birchesLoop:true});
        await sound.birchesScore?.ready;raw??=sound.birchesScore.buffer;};
      await step(0);let pause=ctx.suspend(STEP);const rendering=ctx.startRendering();
      for(let tick=1;tick<SECONDS/STEP;tick++){await pause;await step(tick*STEP);if(tick+1<SECONDS/STEP)pause=ctx.suspend((tick+1)*STEP);await ctx.resume();}
      const buffer=await rendering;AudioBufferSourceNode.prototype.start=native;
      return {buffer,raw,starts};
    };
    const {buffer,raw,starts}=await go(true);
    const power=(b,from,to)=>{let sum=0;const l=b.getChannelData(0),r=b.getChannelData(1);
      for(let i=Math.max(0,Math.round(from*b.sampleRate));i<Math.min(b.length,Math.round(to*b.sampleRate));i++)sum+=(l[i]**2+r[i]**2)/2;return sum;};
    const sounding=(b,from,to,dir)=>{const l=b.getChannelData(0),r=b.getChannelData(1),a=Math.round(from*b.sampleRate),z=Math.round(to*b.sampleRate);
      if(dir<0){for(let i=z-1;i>=a;i--)if(Math.abs(l[i])+Math.abs(r[i])>1e-5)return i/b.sampleRate;}
      else for(let i=a;i<z;i++)if(Math.abs(l[i])+Math.abs(r[i])>1e-5)return i/b.sampleRate;return null;};
    // Audible: a 50 ms window within 30 dB of the recording's average as played (about -60 dBFS), the level under
    // which its tail is lost under the room's own sound.
    const audible=(b,from,to,dir)=>{const W=.05,floor=10**(-6)*W*b.sampleRate;
      if(dir<0){for(let t=to-W;t>=from;t-=W/5)if(power(b,t,t+W)>floor)return t+W;}
      else for(let t=from;t<to-W;t+=W/5)if(power(b,t,t+W)>floor)return t;return null;};
    const next=starts[1],ended=starts[0].when+238.893-starts[0].offset;
    const lastHeard=sounding(buffer,0,next.when,-1),firstHeard=sounding(buffer,next.when,SECONDS,1);
    const lastAudible=audible(buffer,0,next.when,-1),firstAudible=audible(buffer,next.when,SECONDS,1);
    const envelope=Object.fromEntries([0,1,2,3,5].map(t=>{const a=Math.max(0,t-.05),b=t+.05;
      return [t,+(Math.sqrt(power(buffer,next.when+a,next.when+b)/power(raw,a,b))/level).toFixed(3)];}));
    const report={passEnds:+ended.toFixed(3),lastHeard:+lastHeard.toFixed(3),nextStarts:+next.when.toFixed(3),nextOffset:next.offset,firstHeard:+firstHeard.toFixed(3),
      gap:+(next.when-ended).toFixed(3),heardGap:+(firstHeard-lastHeard).toFixed(3),
      lastAudible:+lastAudible.toFixed(3),firstAudible:+firstAudible.toFixed(3),audibleGap:+(firstAudible-lastAudible).toFixed(3),rest,fadeIn:tuning.audio.recordedMusicFadeIn.birches,envelope};
    return {report,...encodeAudio((await go(false)).buffer)};
  });
  assert.equal(seam.clipped,0);
  assert(seam.report.nextOffset===0&&seam.report.gap>=seam.report.rest-.01,'the next pass rests, then begins from its top');
  {const stem=path.join(dir,'birches-seam');fs.writeFileSync(stem+'.wav',wav(Buffer.from(seam.pcm,'base64')));
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',stem+'.wav','-c:a','libmp3lame','-b:a','160k',stem+'.mp3']);}
  console.log(JSON.stringify({id:'birches-seam',...seam.report}));
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({method:'Production audio fixtures, not full gameplay recordings or perceptual listening approval. Files isolate background and reverb. Common playback boost capped for headroom. Handoffs requested at 0:18, except Drowned to Wood at 1:28; arranged landings 24 seconds later. The sails are the whole mix, unboosted, timed from the push-off. The birches seam is the whole mix too, the last 10 s of a pass through the first 10 s of the next.',handoffs:reports,internal,sails,birchesSeam:seam.report},null,2));
  console.log(JSON.stringify({handoffs:reports.length,internalSections:internal.reduce((n,r)=>n+r.starts,0),dir}));
}finally{await browser.close();}
