// Production Web Audio: the mirror departure, complete approved score, story phases and finale.
// node tools/homeward-audio-check.mjs (Vite on 5230; no GPU).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {audioPage,wav} from './lib/audio-render.mjs';
import {studies} from './lib/opening-summit-full-score.mjs';
const {browser,page}=await audioPage();
try {
  const result=await page.evaluate(async approved=>{
    const {ArrivalTransition}=await import('/src/audio/arrival-music.ts');
    const {SUMMIT_CHORDS}=await import('/src/audio/summit-score.ts');
    const {tuning}=await productionModule('/src/tuning.ts');
    const checks=[],check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
    check(JSON.stringify(SUMMIT_CHORDS)===JSON.stringify(approved),'All 32 approved summit voicings are preserved');
    const mirror={...baseState,music:'mirror',mirrorScore:'depart',hush:.5,flockChatter:false};
    const leaving={...mirror,arrivalMusic:'home',homewardReady:true};
    const transition=new ArrivalTransition();transition.update(mirror,0);transition.update(leaving,1);
    check(transition.update(leaving,4).stage==='gap','Three-second mirror fade ends before the silence');
    check(transition.update(leaving,8.99).stage==='gap','Fast sailing cannot shorten the five-second rest');
    check(transition.update({...leaving,homewardReady:false},9).stage==='gap','An uncleared headland extends the rest');
    check(transition.update({...leaving,homewardReady:false},15).stage==='gap','Readiness is required even after the clock expires');
    check(transition.update(leaving,16).stage==='incoming','The first offshore turn releases the summit entrance');
    check(transition.update({...leaving,homewardReady:false},17).stage==='incoming','Sailing back cannot restart the silence');
    const stalled=new ArrivalTransition();stalled.update(mirror,0);stalled.update(leaving,1);
    check(stalled.update(leaving,30).stage==='gap'&&stalled.update(leaving,34.99).stage==='gap','A stalled frame still gets five full seconds after source retirement');
    check(Array.from({length:20},()=>stalled.update(leaving,34.99).stage).every(s=>s==='gap'),'Suspended audio time cannot consume the rest');
    check(stalled.update(leaving,35.01).stage==='incoming','The stalled transition can finish');

    // Render the complete offshore form, then exercise actual story phases, finale and permanent silence.
    const {ctx,sound}=offlineSound(274),phases=[],chords=[];
    // Keep the real mixed output; separately record the background gate to verify reverb silence.
    let incoming,epoch,reverb,retired,homeScore;
    const update=tick=>{
      const t=tick/8,landed=t>=210;
      const phase=t<214?'approach':t<230?'flight':t<240?'farewell':'home';
      sound.update(.125,{...mirror,...(landed?{music:'home',mirrorScore:undefined,hush:0,summitScore:phase}:{}),
        arrivalMusic:t>=12&&!landed?'home':undefined,homewardReady:t>=24,
        silence:t>=270,cues:t===247?['finale']:[],sea:landed?.1:.85});
      const stage=sound.arrivalTransition.stage;
      if(phases.at(-1)?.stage!==stage)phases.push({at:t,stage});
      if(sound.summitScore&&t<210){incoming??=sound.summitScore;epoch??=incoming.epoch;reverb??=sound.backgroundReverb;
        const chord=[...incoming.chordAt()];if(JSON.stringify(chords.at(-1))!==JSON.stringify(chord))chords.push(chord);}
      if(t===211){check(sound.summitScore===incoming&&incoming.epoch===epoch,'Landing preserves the offshore score and its clock');
        check(sound.backgroundReverb===reverb,'Landing preserves the incoming reverb');}
      if(t===215)check(sound.summitScore.phase==='flight','Reunion enters the flight section');
      if(t===232)check(sound.summitScore.phase==='farewell'&&sound.summitScore.voices[3].gain.gain.value<.03,'The upper voice leaves with the bird');
      if(t===245){homeScore=sound.summitScore;check(homeScore.phase==='home','Recognition returns the home section');}
      if(t===248){retired=homeScore;check(!sound.summitScore&&sound.summitFinale,'Finale takes over without two backgrounds playing');}
      if(t===269)check(!sound.summitScore,'The summit arrangement cannot restart underneath the finale');
    };
    update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
    for(let tick=1;tick<274*8;tick++){await pause;update(tick);if(tick+1<274*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
    const mixed=await rendering;
    check(retired.remaining===0,'All eight retired drone oscillators disconnect');
    check(approved.every(chord=>chords.some(c=>JSON.stringify(c)===JSON.stringify(chord))),'The crossing reaches every approved chord, including the second half');
    const {ctx:quietCtx,sound:quietSound}=offlineSound(38);
    quietSound.master.disconnect();quietSound.backgroundGate.disconnect();quietSound.backgroundGate.connect(quietCtx.destination);
    const quietPhases=[];
    function quietUpdate(tick){const t=tick/8;
      quietSound.update(.125,{...mirror,arrivalMusic:t>=12?'home':undefined,homewardReady:t>=24});
      const stage=quietSound.arrivalTransition.stage;if(quietPhases.at(-1)?.stage!==stage)quietPhases.push({at:t,stage});}
    quietUpdate(0);let quietPause=quietCtx.suspend(.125);const quietRendering=quietCtx.startRendering();
    for(let tick=1;tick<38*8;tick++){await quietPause;quietUpdate(tick);if(tick+1<38*8)quietPause=quietCtx.suspend((tick+1)/8);await quietCtx.resume();}
    const quiet=await quietRendering,gap=quietPhases.find(p=>p.stage==='gap').at,incomingAt=quietPhases.find(p=>p.stage==='incoming').at;
    let gapPeak=0,before=0,after=0,environment=0;
    for(let ch=0;ch<2;ch++){
      const data=quiet.getChannelData(ch),mix=mixed.getChannelData(ch);
      for(let i=Math.ceil((gap+.02)*24000);i<Math.floor(incomingAt*24000);i++){gapPeak=Math.max(gapPeak,Math.abs(data[i]));environment+=mix[i]**2;}
      for(let i=8*24000;i<10*24000;i++)before+=data[i]**2;
      for(let i=30*24000;i<35*24000;i++)after+=data[i]**2;
    }
    check(incomingAt-gap>=tuning.audio.homewardQuiet,'Actual rendered background rest lasts at least five seconds');
    check(gapPeak===0,'The background and its reverberation are digitally silent throughout the rest');
    check(before>1e-5&&after>1e-5,'Mirror and summit both sound on their sides of the rest');
    check(environment>1e-5,'Wind and water remain audible during the musical silence');
    return {checks,phases,quietPhases,gapPeak,rest:incomingAt-gap,...encodeAudio(mixed)};
  },studies.summit.chords.map(row=>row[2]));
  assert.equal(result.clipped,0,'Mixed production audio has no clipping');
  const {pcm,...report}=result;
  fs.writeFileSync('/tmp/updraft-homeward-audio.json',JSON.stringify(report,null,2));
  fs.writeFileSync('/tmp/updraft-homeward-audio.wav',wav(Buffer.from(pcm,'base64')));
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','/tmp/updraft-homeward-audio.wav','-t','90','-af','afade=t=out:st=86:d=4','-c:a','libmp3lame','-b:a','192k','/tmp/updraft-homeward-transition.mp3']);
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
