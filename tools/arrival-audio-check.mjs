// Real Web Audio: background-only silence, live wind feedback and uninterrupted landing phrases.
// node tools/arrival-audio-check.mjs (Vite on 5230; no GPU).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';
const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { ARRIVAL_MUSIC, ArrivalTransition } = await import('/src/audio/arrival-music.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const checks=[], renders=[], F=tuning.audio.arrivalFadeOut, Q=tuning.audio.arrivalQuiet;
    const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
    const source = target => ({...baseState,music:target==='birches'?'birches':target==='sleeping'?'wood':target==='drowned'?'birches':target==='home'?'home':'sea',
      // Explicitly enable the opening's playable voice to verify that the background gate cannot mute it.
      // Ordinary arrivals themselves no longer enable gesture chimes.
      seaScore:target==='mirror'?'arrival':undefined,flockChatter:false,startingIsland:true});
    for(const target of Object.keys(ARRIVAL_MUSIC)) {
      const {ctx,sound}=offlineSound(36), notes=[], phases=[];
      // Hear just the background, including its reverb, while still scheduling real gestures and environment.
      sound.master.disconnect();sound.backgroundGate.disconnect();sound.backgroundGate.connect(ctx.destination);
      const chime=sound.chime.bind(sound);
      sound.chime=(...a)=>{notes.push({now:ctx.currentTime,midi:a[0]});chime(...a);};
      let incoming, epoch, reverb;
      const score=()=>sound.seaScore??sound.summitScore??sound.dreamScore??sound.linesScore??sound.boatsScore??sound.birchesScore??sound.sleepingScore;
      const update=tick=>{
        const now=tick/8, landed=now>=28;
        sound.update(.125,{...source(target),...(landed?ARRIVAL_MUSIC[target]:{}),
          arrivalMusic:now>=8&&!landed?target:undefined,
          gust:now>=10&&now<10.5?10:0,charge:now>=12&&now<13?.65:0});
        const stage=sound.arrivalTransition.stage;if(phases.at(-1)?.stage!==stage)phases.push({at:now,stage});
        if(now===22){incoming=score();epoch=incoming?.current?.epoch??incoming?.epoch;}
        if(now===27){
          reverb=sound.backgroundReverb;
          check(sound.mood===ARRIVAL_MUSIC[target].music,`${target}: the destination mood is active before landing`);
        }
        if(now===30){
          check(score()===incoming,`${target}: landing does not replace its score`);
          check((score()?.current?.epoch??score()?.epoch)===epoch,`${target}: landing does not restart its phrase`);
          check(sound.backgroundReverb===reverb,`${target}: landing retains the incoming reverberation`);
        }
      };
      update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
      for(let tick=1;tick<36*8;tick++){await pause;update(tick);if(tick+1<36*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
      const buffer=await rendering;
      let gapPeak=0, before=0, after=0;
      for(let ch=0;ch<2;ch++){
        const data=buffer.getChannelData(ch);
        for(let i=(phases.find(p=>p.stage==='gap').at+.02)*24000;i<phases.find(p=>p.stage==='incoming').at*24000;i++)gapPeak=Math.max(gapPeak,Math.abs(data[Math.floor(i)]));
        for(let i=6*24000;i<7*24000;i++)before+=data[i]**2;
        for(let i=18*24000;i<21*24000;i++)after+=data[i]**2;
      }
      check(gapPeak===0,`${target}: background rest is digitally silent, including reverb`);
      check(before>1e-5&&after>1e-5,`${target}: music sounds on both sides of the gap`);
      check(notes.some(n=>n.now>=10&&n.now<10.5)&&notes.some(n=>n.now>=12&&n.now<13),`${target}: cursor and updraft chimes remain responsive through the handoff`);
      renders.push({target,gapPeak,phases});
    }
    const transition=new ArrivalTransition(), s={...source('lines'),arrivalMusic:'lines'};
    transition.update(s,0);transition.update(s,F);
    check(Array.from({length:100},()=>transition.update(s,F).stage).every(stage=>stage==='gap'),'Suspended audio time preserves the gap');
    check(transition.update({...s,arrivalMusic:undefined,music:'lines',linesScore:'first'},F+.2).stage==='gap','An early landing cannot cancel the pause');
    check(transition.update({...s,arrivalMusic:undefined,music:'wood'},3.5).stage==='none','A chapter jump cancels an unrelated transition');
    const stalled=new ArrivalTransition();stalled.update(s,0);
    check(stalled.update(s,10).stage==='gap'&&stalled.update(s,10+Q-.01).stage==='gap'&&stalled.update(s,10+Q+.01).stage==='incoming',
      'A long stalled frame still gives retired sources the full full rest');
    const missedFade=new ArrivalTransition();missedFade.update(s,0);
    check(missedFade.update(s,5).stage==='gap'&&missedFade.update(s,5+Q-.01).stage==='gap',
      'A frame near the end of the gap cannot reopen still-retiring sources');
    const lateLanding=new ArrivalTransition();lateLanding.update(s,0);lateLanding.update(s,F);
    const reopened=lateLanding.update({...s,arrivalMusic:undefined,music:'lines',linesScore:'first'},10);
    check(reopened.stage==='none'&&reopened.changed,'Landing after a stalled gap reopens the background gate');

    // An audible example of the production handoff, including unmuted sea and wind gestures.
    const {ctx,sound}=offlineSound(36);
    const update=tick=>{const now=tick/8;sound.update(.125,{...source('lines'),...(now>=28?ARRIVAL_MUSIC.lines:{}),
      arrivalMusic:now>=8&&now<28?'lines':undefined,gust:now>=11&&now<11.5?8:0});};
    update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
    for(let tick=1;tick<36*8;tick++){await pause;update(tick);if(tick+1<36*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
    const mixed=await rendering, data=mixed.getChannelData(0);
    const power=(from,to)=>{let sum=0;for(let i=from*24000;i<to*24000;i++)sum+=data[i]**2;return sum/((to-from)*24000);};
    check(power(12.5,13)>1e-8,'The environment remains audible during the background pause');
    check(power(11.1,11.5)>power(12.5,13)*2,'Wind and gesture feedback remain audible during the pause');
    return {checks,renders,quiet:tuning.audio.arrivalQuiet,...encodeAudio(mixed)};
  });
  assert.equal(result.clipped,0);
  fs.writeFileSync('/tmp/updraft-arrival-audio.wav',wav(Buffer.from(result.pcm,'base64')));
  const {pcm,...report}=result;fs.writeFileSync('/tmp/updraft-arrival-audio.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks.length,quiet:report.quiet,peakDbFS:report.peakDbFS,renders:report.renders}));
} finally {await browser.close();}
