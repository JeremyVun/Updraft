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
  ['birches-drowned','Birches → Drowned Village',{music:'birches',birchesScore:'return'},'drowned'],
  ['drowned-wood','Drowned Village → Wood',{music:'drowned',drownedScore:'after',hush:.85},'wood'],
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
      const {ctx,sound}=offlineSound(50),phases=[];
      sound.master.disconnect();sound.backgroundGate.disconnect();sound.backgroundGate.connect(ctx.destination);
      let outgoing,incoming,epoch,reverb;
      const score=()=>sound.openingScore??sound.summitScore??sound.dreamScore??sound.linesScore??sound.boatsScore
        ??sound.meadowScore??sound.birchesScore??sound.sleepingScore??sound.seaScore;
      const update=tick=>{
        const t=tick/8,landed=t>=42;
        sound.update(.125,{...baseState,...(landed?ARRIVAL_MUSIC[target]:source),flockChatter:false,
          arrivalMusic:t>=18&&!landed?target:undefined,arrivalReady:t>=24,homewardReady:t>=24});
        const stage=sound.arrivalTransition.stage;
        if(phases.at(-1)?.stage!==stage)phases.push({at:t,stage});
        if(t===17)outgoing=score();
        if(t===39){incoming=score();epoch=incoming?.current?.epoch??incoming?.epoch;reverb=sound.backgroundReverb;}
        if(t===44){check(score()===incoming,'Landing keeps the incoming score');
          check((score()?.current?.epoch??score()?.epoch)===epoch,'Landing keeps its musical clock');
          check(sound.backgroundReverb===reverb,'Landing keeps its reverberation');}
      };
      update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
      for(let tick=1;tick<400;tick++){await pause;update(tick);if(tick+1<400)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
      const buffer=await rendering,legato=source.music==='drowned'&&target==='wood';
      const fade=phases.find(p=>p.stage==='fade'),gap=phases.find(p=>p.stage==='gap'),entry=phases.find(p=>p.stage==='incoming');
      let gapPeak=0;
      if(!legato){
        check(!!fade&&!!gap&&!!entry,'The handoff has a fade, rest and entrance');
        const quiet=arrivalQuiet(target,target==='home'&&source.music==='mirror');
        check(gap.at-fade.at>=3,'The outgoing fade lasts three seconds');
        check(entry.at-gap.at>=quiet,'The full destination-specific rest is preserved');
        for(let ch=0;ch<2;ch++)for(let i=Math.ceil((gap.at+.02)*24000);i<entry.at*24000;i++)gapPeak=Math.max(gapPeak,Math.abs(buffer.getChannelData(ch)[i]));
        check(gapPeak===0,'The entire music/reverb rest is digitally silent');
      }else check(phases.some(p=>p.stage==='blend')&&!gap,'The approved continuous storm keeps its D/A overlap');
      if(outgoing)check(outgoing.stopped===true||outgoing.stoppedAt!==undefined,'Outgoing scheduling is retired');
      // Entering an already-playing composition must not manufacture a second pause.
      const same=new ArrivalTransition(),state={...baseState,...ARRIVAL_MUSIC[target]};same.update(state,0);
      check(same.update({...state,arrivalMusic:target},1).stage==='none','Same-piece approach does not restart the handoff');
      const late=new ArrivalTransition();late.update({...baseState,...source},0);
      const requested={...baseState,...source,arrivalMusic:target,arrivalReady:true,homewardReady:true};
      late.update(requested,1);
      if(!legato){late.update(requested,30);const quiet=arrivalQuiet(target,target==='home'&&source.music==='mirror');
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
      ['wood','sleepingScore','/src/audio/sleeping-score.ts','SLEEPING_SECTIONS'],
      ['sea','seaScore','/src/audio/sea-score.ts','SEA_SECTIONS'],
    ];
    const rows=[];
    for(const [music,field,url,key] of tables){const table=(await import(url))[key];rows.push({music,field,phases:Object.keys(table)});}
    rows.push({music:'mirror',field:'mirrorScore',phases:['approach','search','one','two','three','constellation','depart']},
      {music:'drowned',field:'drownedScore',phases:['rooftops','still','resume','gather','loss','after']},
      {music:'home',field:'summitScore',phases:['approach','flight','farewell','home']});
    const reports=[];
    for(const row of rows){
      const seconds=row.phases.length*12+5,{ctx,sound}=offlineSound(seconds);let starts=0,last;
      const update=tick=>{const t=tick/8,phase=row.phases[Math.min(row.phases.length-1,Math.floor(t/12))];
        sound.update(.125,{...baseState,music:row.music,[row.field]:phase,flockChatter:false,silence:t>=seconds-3});
        if(phase!==last){starts++;last=phase;}
        if(sound.arrivalTransition.stage!=='none')throw Error('An internal section must not create an island handoff');};
      update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
      for(let tick=1;tick<seconds*8;tick++){await pause;update(tick);if(tick+1<seconds*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
      const buffer=await rendering;let peak=0;for(let ch=0;ch<2;ch++)for(const value of buffer.getChannelData(ch))peak=Math.max(peak,Math.abs(value));
      if(peak>=1)throw Error(`${row.field}: phase render clipped`);
      if(sound[['mirrorScore','drownedScore'].includes(row.field)?'dreamScore':row.field]!==null)throw Error(`${row.field}: permanent silence did not retire the score`);
      reports.push({...row,starts,peakDbFS:20*Math.log10(peak),released:true});
    }
    return reports;
  });
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({method:'Production audio fixtures, not full gameplay recordings or perceptual listening approval. Files isolate background and reverb. Common playback boost capped for headroom. Handoffs requested at 0:18; arranged landing at 0:42.',handoffs:reports,internal},null,2));
  console.log(JSON.stringify({handoffs:reports.length,internalSections:internal.reduce((n,r)=>n+r.starts,0),dir}));
}finally{await browser.close();}
