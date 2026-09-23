// Check real Soundscape gesture scheduling against score data, including notes queued across chord boundaries.
// node tools/gesture-harmony-check.mjs (Vite on 5230; no GPU).
import fs from 'node:fs';
import { audioPage } from './lib/audio-render.mjs';
const {browser,page}=await audioPage();
try {
  const report=await page.evaluate(async()=>{
    // Expose existing private composition data only in this isolated test module; runtime is unmodified.
    const source=(await (await fetch('/src/audio/audio.ts')).text()).replace(/(["'])\/(src|@vite|node_modules)\//g,`$1${location.origin}/$2/`);
    const url=URL.createObjectURL(new Blob([source+'\nexport { MOODS };'],{type:'text/javascript'}));
    const {MOODS}=await import(url);URL.revokeObjectURL(url);
    const {phrasePosition}=await productionModule('/src/audio/phrasing.ts');
    const checks=[],cases=[];
    const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
    const pitchIn=(midi,chord)=>chord.some(m=>(midi-m)%12===0);
    const plain=Object.entries(MOODS).filter(([name])=>name!=='boats').map(([music,m])=>({name:music,state:{music,startingIsland:music==='still',forestWind:music==='wood'},
      seconds:m.seconds*m.chords.length,changes:m.chords.map((_,i)=>i*m.seconds),
      // Forest chimes use the original low minor palette (the whole scale), not filtered to the current chord's tones (docs/contracts/audio.md).
      harmony:at=>music==='wood'?m.scale:m.chords[Math.floor(at/m.seconds)%m.chords.length]}));
    const {BOATS_CHORDS,BOATS_PHRASE_SECONDS}=await productionModule('/src/audio/little-boats-score.ts');
    cases.push(...plain,{name:'boats',state:{music:'boats'},key:'boatsScore',seconds:BOATS_PHRASE_SECONDS,
      changes:BOATS_CHORDS.map((_,i)=>i*4.5),harmony:(at,score)=>BOATS_CHORDS[Math.floor(Math.max(0,at-score.epoch)%BOATS_PHRASE_SECONDS/4.5)]});
    for(const [file,key,music,table] of [['lines','linesScore','lines','LINES_SECTIONS'],['birches','birchesScore','birches','BIRCHES_SECTIONS'],
      ['meadow','meadowScore','meadow','MEADOW_SECTIONS'],['sleeping','sleepingScore','wood','SLEEPING_SECTIONS'],['sea','seaScore','sea','SEA_SECTIONS']]) {
      const module=await productionModule(`/src/audio/${file}-score.ts`);
      for(const [phase,pattern] of Object.entries(module[table])) {
        const chords=file==='sea'?pattern.chords.map(([at,index])=>({at,tones:module.SEA_CHORDS[index]})):pattern.chords;
        cases.push({name:`${file}/${phase}`,state:{music,[key]:phase},key,seconds:pattern.seconds,
          changes:chords.map(c=>c.at),harmony:(at,score)=>{
            if(!chords.length)return [50,57,64,69];
            const local=phrasePosition(pattern,score.current.epoch,at);
            return chords.findLast(c=>c.at<=local)?.tones??chords[0].tones;
          }});
      }
    }
    let notes=0,boundaryNotes=0;
    for(const c of cases) {
      const {ctx,sound}=offlineSound(1),events=[];
      sound.chime=(midi,velocity,pan,at,decay,soft)=>events.push({midi,at,decay,velocity,soft,now:ctx.currentTime});
      Object.defineProperty(ctx,'currentTime',{configurable:true,value:0});
      sound.update(.1,{...baseState,...c.state,flockChatter:false});
      const score=c.key?sound[c.key]:null,epoch=score?.current?.epoch??score?.epoch??0;
      const times=[1,3,5,...[0,1,2].flatMap(cycle=>c.changes.flatMap(at=>[-.12,.03,.6].map(offset=>epoch+cycle*c.seconds+at+offset)))];
      for(const now of [...new Set(times.filter(t=>t>0))].sort((a,b)=>a-b)) {
        Object.defineProperty(ctx,'currentTime',{configurable:true,value:now});
        // Exercise each voice independently; combined input deliberately shares one response.
        for (const input of [{gust:20},{charge:.8},{gliderLift:.8}]) {
          sound.lastNote=sound.lastArp=sound.lastGlider=-100;sound.prevGliderLift=0;
          sound.update(.1,{...baseState,...c.state,...input,rise:now%2>1?-1:1,flockChatter:false});
        }
      }
      if (!c.state.startingIsland && !c.state.forestWind) {
        check(events.length === 0, `${c.name}: no cursor chimes outside the opening island and forest`);
        delete ctx.currentTime;
        continue;
      }
      check(events.length>=12,`${c.name}: strokes, lifts and glider responses all schedule`);
      check(events.every(e=>pitchIn(e.midi,c.harmony(e.at,score))),`${c.name}: every gesture note belongs to the harmony at its scheduled onset`);
      check(events.some(e=>e.decay===1.6)&&events.some(e=>e.decay===1.8)&&events.some(e=>e.decay===2.2),`${c.name}: all three gesture voices are covered`);
      boundaryNotes+=events.filter(e=>JSON.stringify(c.harmony(e.at,score))!==JSON.stringify(c.harmony(e.now,score))).length;
      notes+=events.length;
      delete ctx.currentTime;
    }
    check(boundaryNotes>0,'Queued notes crossing a chord boundary use the next harmony');
    const {ctx,sound}=offlineSound(1),events=[];
    sound.chime=(...args)=>events.push(args);
    const tick=(now,state)=>{Object.defineProperty(ctx,'currentTime',{configurable:true,value:now});sound.update(.1,{...baseState,...state});};
    tick(0,{music:'wood',sleepingScore:'climb'});
    for (let now=.1; now<10; now+=.1) tick(now,{music:'wood',sleepingScore:'climb',sleepingWind:true,gust:26,charge:.8});
    check(events.length>=7&&events.length<=9,'Feather climb offers sparse notes, at most once every four pulses');
    check(events.every(e=>e[5]&&Math.abs(e[1]-(.25+.8*.35)*.7)<1e-9&&pitchIn(e[0],sound.sleepingScore.chordAt(e[3]))),'Feather climb uses a soft, quiet voice following its own score');
    events.length=0;tick(11,{music:'wood',sleepingScore:'climb',sleepingWind:true,gliderLift:1});
    check(events.length===0,'The stowed glider cannot add chimes during the feather climb');
    tick(12,{music:'wood',sleepingScore:'climb'});
    const climb=sound.sleepingScore.current, epoch=climb.epoch;
    tick(13,{music:'wood',sleepingScore:'summit',gust:20,charge:.8});
    check(sound.sleepingScore.current===climb&&climb.epoch===epoch,'Sleeping carries the ongoing harmony and clock through the summit');
    check(events.length===0,'Sleeping summit wind has no chimes');
    events.length=0;tick(15,{music:'wood',forestWind:true,caringWind:true,gust:20,charge:.8,gliderLift:.8});
    check(events.length>0&&events.every(e=>e[5]===true&&e[1]<.4&&pitchIn(e[0],[38,45])),'Forest rescue keeps its quiet caring timbre and stable harmony');
    events.length=0;tick(18,{music:'meadow',pianoActive:true,gust:20,charge:.8,gliderLift:.8});
    check(events.length===0,'The piano still supplies its own gesture response');
    delete ctx.currentTime;
    return {checks,sections:cases.length,notes,boundaryNotes};
  });
  fs.writeFileSync('/tmp/updraft-gesture-harmony.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks.length,sections:report.sections,notes:report.notes,boundaryNotes:report.boundaryNotes}));
}finally{await browser.close();}
