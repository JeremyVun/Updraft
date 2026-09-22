// Approved opening in the production pad: harmony, looping, care, playable wind and Lines handoff.
// node tools/opening-score-check.mjs (Vite on 5230; no GPU).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {audioPage} from './lib/audio-render.mjs';
import {studies} from './lib/opening-resolution-revision.mjs';
const {browser,page}=await audioPage();
try {
  const report=await page.evaluate(async approved=>{
    const {OPENING_CHORDS,OPENING_STEP,OPENING_SECONDS,OPENING_DYNAMICS}=await import('/src/audio/opening-score.ts');
    const checks=[],check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
    check(JSON.stringify(OPENING_CHORDS)===JSON.stringify(approved.chords.map(c=>c[2])),'Every approved opening voicing is preserved');
    check(OPENING_SECONDS===approved.seconds&&approved.chords.every((c,i)=>c[0]===i*OPENING_STEP),'Approved tempo, resolution hold and full duration are preserved');
    check(JSON.stringify(OPENING_DYNAMICS)===JSON.stringify(approved.dynamics),'Approved phrase dynamics are preserved');
    const {ctx,sound}=offlineSound(215),notes=[],stages=[];
    let score,epoch,normal,quiet,duck,looped=false;
    const voices=sound.padVoices.map(v=>v.osc),chime=sound.chime.bind(sound);
    sound.chime=(...args)=>{
      if(args[6]&&sound.openingScore)notes.push({midi:args[0],at:args[3],chord:[...sound.openingScore.chordAt(args[3])]});
      chime(...args);
    };
    const update=tick=>{
      const t=tick/8,care=t>=60&&t<70,crossing=t>=192,landed=t>=207;
      sound.update(.125,{...baseState,music:landed?'lines':'still',openingScore:!landed,
        startingIsland:!crossing,linesScore:landed?'first':undefined,
        arrivalMusic:t>=198&&!landed?'lines':undefined,
        life:Math.min(1,.1+t*.8/48),hush:care?1:0,scripted:care,flockChatter:false,
        gust:t%1<.25?12:0,charge:t%4>=2&&t%4<2.5?.5:0,
        silence:t>=212,cues:t===60?['fallen']:[]});
      score??=sound.openingScore;epoch??=score?.epoch;
      const stage=sound.arrivalTransition.stage;if(stages.at(-1)?.stage!==stage)stages.push({at:t,stage});
      if(t===58)normal=sound.padGain.gain.value;
      if(t===64){quiet=sound.padGain.gain.value;duck=sound.backgroundDuck.gain.value;}
      if(t===85)check(JSON.stringify(score.chordAt(ctx.currentTime))==='[42,57,62,66]','The new D/F# resolution sounds at 1:25');
      if(t===90.375)check(JSON.stringify(score.chordAt(ctx.currentTime))==='[47,54,62,66]','The motif waits for the full resolution');
      if(t===188){
        looped=true;check(score===sound.openingScore&&score.epoch===epoch,'A long opening repeats without replacing its instrument or clock');
        check(JSON.stringify(score.chordAt(ctx.currentTime))===JSON.stringify(OPENING_CHORDS[0]),'The held ending glides back into the first chord');
      }
      if(t===195)check(score===sound.openingScore&&score.epoch===epoch,'The opening continues across the first boat departure');
      if(t===206)check(!sound.openingScore&&!!sound.linesScore,'The Lines handoff retires the opening conductor');
    };
    update(0);
    check(score.chordAt(epoch+85)[0]===42&&score.chordAt(epoch+90.3125)[0]===47,'Scheduled wind notes can look across the resolution boundary');
    check(sound.padVoices.every((v,i)=>v.osc===voices[i]),'The score uses the original eight pad oscillators');
    let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
    for(let tick=1;tick<215*8;tick++){await pause;update(tick);if(tick+1<215*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
    const buffer=await rendering;
    check(looped,'The production render crosses the complete composition loop');
    check(quiet<normal*.12,'The fallen cygnet hush still withdraws the pad');
    check(duck<.34,'The authored fall cue retains its accompaniment duck');
    check(notes.length>100&&notes.every(n=>n.chord.some(m=>(m-n.midi)%12===0)),'Playable wind follows the new harmony at each scheduled onset');
    check(notes.every(n=>n.at<192.5),'The first crossing does not enable opening gesture chimes');
    check(sound.padVoices.every((v,i)=>v.osc===voices[i]),'Loops and departure allocate no replacement pad oscillators');
    let peak=0;for(let ch=0;ch<2;ch++)for(const sample of buffer.getChannelData(ch))peak=Math.max(peak,Math.abs(sample));
    check(peak<1,'The mixed production render does not clip');
    return {checks,stages,gestureNotes:notes.length,careLevelRatio:quiet/normal,peakDbFS:20*Math.log10(peak)};
  },studies.opening);
  assert(report.checks.length>10);
  fs.writeFileSync('/tmp/updraft-opening-score-check.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
