// Approved-score parity, real Web Audio chapter timing and the Drowned → Wood handoff.
// node tools/dream-score-check.mjs (local Vite, no GPU).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {audioPage,wav} from './lib/audio-render.mjs';
import {composition,palette} from './lib/mirror-drowned-score-proposals.mjs';
const {browser,page}=await audioPage();
try {
  const result=await page.evaluate(async reference=>{
    const {DreamScore,DREAM_SECTIONS}=await productionModule('/src/audio/dream-score.ts');
    const {DREAM_NOTES,DREAM_PALETTE}=await productionModule('/src/audio/dream-score-data.ts');
    const {ArrivalTransition,ARRIVAL_MUSIC}=await productionModule('/src/audio/arrival-music.ts');
    const checks=[],renders=[];
    const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
    check(JSON.stringify(DREAM_NOTES)===JSON.stringify(reference.notes),'Both integrated scores retain every approved note, strength, pan and duration');
    check(JSON.stringify(DREAM_PALETTE)===JSON.stringify(reference.palette),'Every approved instrument envelope and partial is retained');
    for(const [name,section] of Object.entries(DREAM_SECTIONS)) {
      check(section.chords.length>0&&section.notes.some(n=>n.role==='harmony'&&n.at<.25),`${name}: harmony starts with the phase`);
      check(!section.notes.some(n=>n.role==='star'),`${name}: repeated phases never replay star rewards`);
      check(section.notes.every(n=>n.duration>DREAM_PALETTE[n.voice].attack+DREAM_PALETTE[n.voice].release),`${name}: valid envelopes after section slicing`);
    }
    const t=new ArrivalTransition(),v={...baseState,music:'drowned',drownedScore:'after',hush:.85};
    t.update(v,0);
    const first=t.update({...v,arrivalMusic:'wood'},10);
    check(first.legato&&first.stage==='blend'&&first.background.music==='wood','Drowned to Wood begins an overlap without a gap');
    check(t.update({...v,arrivalMusic:'wood'},10).stage==='blend','Frozen audio time cannot advance the overlap');
    check(t.update({...baseState,...ARRIVAL_MUSIC.wood},14.1).legato,'Landing completes the overlap without clearing reverb');
    const ordinary=new ArrivalTransition();ordinary.update({...baseState,music:'mirror',mirrorScore:'depart'},0);
    check(ordinary.update({...baseState,music:'mirror',mirrorScore:'depart',arrivalMusic:'home'},1).stage==='fade','Other island handoffs retain their established timing');

    async function render(name,kind,seconds) {
      const {ctx,sound}=offlineSound(seconds),history=[],retiring=[];
      let reverb=null,oldScore=null,gateMin=1,blooms=0;
      const originalChime=sound.chime.bind(sound),notes=[];
      sound.chime=(...a)=>{notes.push(a);originalChime(...a);};
      for(const method of ['cricket','owl','skylark','peep','bugle'])sound[method]=()=>{};
      if(kind==='music'){sound.master.disconnect();sound.backgroundGate.disconnect();sound.backgroundGate.connect(ctx.destination);}
      const update=tick=>{
        const now=tick/8;
        let state;
        if(name==='mirror') {
          // Extended middle phases cover two loop joins; restored entry at 'one' must not bloom.
          const phase=now<42?'one':now<64?'two':now<86?'three':now<94?'constellation':'depart';
          state={...baseState,music:'mirror',mirrorScore:phase,hush:.5,breeze:.025,night:.65,land:0,sea:.35,
            cues:[42,64,86].includes(now)?['star']:[],silence:now>=114,
            gust:now>=20&&now<21?6:0,charge:now>=66&&now<67?.2:0};
        } else {
          const phase=now<22?'gather':now<38?'loss':'after';
          state={...baseState,music:'drowned',drownedScore:phase,hush:now<22?.6:.85,land:0,sea:1,
            night:.55+Math.min(1,now/20)*.45,shower:Math.min(1,now/14),breeze:1,
            arrivalMusic:now>=46&&now<54?'wood':undefined,
            ...(now>=54?ARRIVAL_MUSIC.wood:{}),
            forestWind:now>=54,
            cues:now===58?['kindled']:now===64?['comfort']:[],
            gust:now>=47&&now<48?7:0,charge:now>=55&&now<56?.18:0};
        }
        if(sound.dreamScore && oldScore!==sound.dreamScore){oldScore=sound.dreamScore;retiring.push(oldScore);}
        sound.update(.125,{...state,flockChatter:false});
        if(sound.dreamScore&&!sound.dreamScore.probed) {
          sound.dreamScore.probed=true;const bloom=sound.dreamScore.bloom.bind(sound.dreamScore);
          sound.dreamScore.bloom=()=>{blooms++;bloom();};
        }
        if(name==='drowned') {
          if(now===45)reverb=sound.backgroundReverb;
          if(now>=46){gateMin=Math.min(gateMin,sound.backgroundGate.gain.value);check(sound.backgroundReverb===reverb,`wood ${now}: existing reverb survives`);}
          if(now===46.125)check(sound.padVoices.every((v,i)=>Math.abs(v.osc[0].frequency.value-440*2**(([38,45,50,57][i]-69)/12))<.01),
            'Forest pad starts on the shared D/A pitches before becoming audible');
        }
        const phase=sound.dreamScore?.current?.phase??sound.mood;
        if(history.at(-1)?.phase!==phase)history.push({now,phase,stage:sound.arrivalTransition.stage});
      };
      update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
      for(let tick=1;tick<seconds*8;tick++){await pause;update(tick);if(tick+1<seconds*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
      const buffer=await rendering,windows=[];
      for(let second=0;second<seconds;second++){
        let power=0;for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch).subarray(second*24000,(second+1)*24000))power+=x*x;
        windows.push(10*Math.log10(Math.max(1e-20,power/48000)));
      }
      check(retiring.every(score=>score.parts.size===0),`${name}/${kind}: retiring voices, echoes and phase buses all disconnect`);
      if(name==='mirror'){
        check(blooms===3,`${kind}: three real returns bloom once each; restored entry and loops stay quiet`);
        check(windows.slice(5,110).every(db=>db>-65),`${kind}: mirror loops and phase changes have no accidental silence`);
      } else {
        check(gateMin>.99,`${kind}: background gate stays open throughout the forest overlap`);
        check(windows.slice(43,59).every(db=>db>-65),`${kind}: music remains audible across the village/forest boundary`);
        check(!notes.some(n=>n[6]&&n[3]>=47&&n[3]<48)&&notes.some(n=>n[6]&&n[3]>=55&&n[3]<56),`${kind}: musical wind begins in the actual forest, not the departing village`);
        const jumps=windows.slice(44,57).slice(1).map((db,i)=>Math.abs(db-windows[44+i]));
        if(kind==='music')check(Math.max(...jumps)<6,'Forest overlap has no one-second loudness jump over 6 dB');
      }
      const encoded=encodeAudio(buffer);check(encoded.clipped===0,`${name}/${kind}: no clipping`);
      renders.push({name,kind,history,gateMin,blooms,windows,...encoded});
    }
    await render('mirror','music',120);
    await render('drowned','music',72);
    await render('drowned','scene',72);
    return {checks,renders};
  },{notes:{mirror:composition('mirror'),drowned:composition('drowned')},palette});
  for(const r of result.renders){
    const stem=r.name==='drowned'?`/tmp/updraft-drowned-forest-${r.kind}`:'/tmp/updraft-mirror-integrated';
    fs.writeFileSync(stem+'.wav',wav(Buffer.from(r.pcm,'base64')));
    // Listening gain is fixed for the whole clip; retain all relative levels and transitions.
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',stem+'.wav','-af',`volume=${Math.min(10,-3-r.peakDbFS)}dB`,'-c:a','libmp3lame','-b:a','192k',stem+'.mp3']);
    delete r.pcm;
  }
  fs.writeFileSync('/tmp/updraft-dream-score-check.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({checks:result.checks.length,renders:result.renders.map(({windows,...r})=>r)},null,2));
}finally{await browser.close();}
