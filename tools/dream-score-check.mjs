// The Sky Mirror's approved-score parity; the drowned village's pieces (key, phrasing, the boat's tune coming home,
// crossings at chord changes) and real Web Audio chapter timing into the Drowned → Wood handoff.
// node tools/dream-score-check.mjs (local Vite, no GPU).
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {audioPage,wav} from './lib/audio-render.mjs';
import {composition,palette} from './lib/mirror-drowned-score-proposals.mjs';
const {browser,page}=await audioPage();
try {
  const result=await page.evaluate(async reference=>{
    const {DREAM_SECTIONS}=await productionModule('/src/audio/dream-score.ts');
    const {DREAM_NOTES,DREAM_PALETTE}=await productionModule('/src/audio/dream-score-data.ts');
    const {DrownedScore,DROWNED_SECTIONS}=await productionModule('/src/audio/drowned-score.ts');
    const {ArrivalTransition,ARRIVAL_MUSIC}=await productionModule('/src/audio/arrival-music.ts');
    const checks=[],renders=[],W=78;
    const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
    check(JSON.stringify(DREAM_NOTES)===JSON.stringify(reference.notes),'The Sky Mirror retains every approved note, strength, pan and duration');
    check(JSON.stringify(DREAM_PALETTE)===JSON.stringify(Object.fromEntries(Object.keys(DREAM_PALETTE).map(k=>[k,reference.palette[k]])))
      &&DREAM_NOTES.every(n=>DREAM_PALETTE[n.voice]),'Every approved mirror instrument envelope and partial is retained');
    const envelope=n=>n.duration>DREAM_PALETTE[n.voice].attack+DREAM_PALETTE[n.voice].release;
    for(const [name,section] of Object.entries(DREAM_SECTIONS)) {
      check(section.chords.length>0&&section.notes.some(n=>n.role==='harmony'&&n.at<.25),`${name}: harmony starts with the phase`);
      check(!section.notes.some(n=>n.role==='star'),`${name}: repeated phases never replay star rewards`);
      check((section.variants??[section.notes]).every(notes=>notes.every(envelope)),`${name}: valid envelopes after section slicing`);
    }

    // The drowned village: the pad under every piece, moving at least every eight seconds.
    const sections=Object.entries(DROWNED_SECTIONS);
    for(const [name,section] of sections) {
      const all=section.variants??[section.notes];
      check(all.every(notes=>notes.some(n=>n.voice==='pad'&&n.at<.25)&&notes.some(n=>n.role==='melody')),`${name}: the pad begins with the piece and every pass has a tune`);
      const times=[...section.chords.map(c=>c.at),section.seconds];
      check(times.slice(1).every((at,i)=>at-times[i]<=8+1e-6)&&new Set(section.chords.map(c=>c.tones.join())).size>=4,
        `${name}: its harmony moves at least every eight seconds through at least four chords`);
      check((section.handoffs??[]).every(at=>times.includes(at)),`${name}: it hands over only where its chord changes`);
    }
    // One key: B minor and its relative D major, then D minor for the dark after the farewell.
    const major=new Set([11,1,2,4,6,7,9]),minor=new Set([2,4,5,7,9,10,0]);
    for(const [name,section] of sections) {
      const dark=section.chords.find(c=>c.tones.some(m=>m%12===5))?.at??Infinity;
      check((section.variants??[section.notes]).every(notes=>notes.every(n=>(n.at<dark?major:minor).has(n.midi%12))),
        `${name}: every note is diatonic to B minor and D major${name==='farewell'?', the dark to D minor':''}`);
    }
    // Regular phrases: the boat's lilt (six to a four-second bar) or a steady beat, never a scatter of times.
    const grid=(t,unit)=>Math.abs(t/unit-Math.round(t/unit))<1e-6;
    for(const [name,section] of sections) {
      const from=name==='drift'?8:0,melody=section.notes.filter(n=>n.role==='melody');
      check(melody.every(n=>grid(n.at-from,4/6)||grid(n.at-from,.5)),`${name}: its tune keeps to the bar's grid`);
    }
    const tune=(name,from,to,offset=0)=>DROWNED_SECTIONS[name].notes.filter(n=>n.voice==='piano'&&n.role==='melody'&&n.at-offset>=from&&n.at-offset<to)
      .map(n=>`${n.midi}@${(n.at-offset-from).toFixed(3)}`).join();
    check(tune('drift',32,56,8)===tune('home',32,56),'The boat\'s question comes back unchanged when the boat comes home');
    const question=DROWNED_SECTIONS.drift.notes.filter(n=>n.voice==='piano'&&n.at>=40&&n.at<44.1).map(n=>n.midi%12);
    check(JSON.stringify(question)===JSON.stringify([2,4,6,11]),'The drift asks the piano\'s question, D–E–F♯–B');
    const storm=DROWNED_SECTIONS.storm.chords;
    check(storm.every(c=>c.tones.some(m=>m%12===2)&&c.tones.some(m=>m%12===9)),'Every chord of the dark keeps D and A for the wood\'s drone');

    // Crossings: a piece the story leaves plays on to its next chord change, and the next one starts there.
    const conducted=(script,seconds)=>{
      const ctx=new OfflineAudioContext(2,24000,24000),out={ctx,bus:ctx.createGain(),reverb:ctx.createGain()};
      const score=new DrownedScore(out,()=>({note:()=>[]})),played=[];
      score.play=(part,note,at)=>played.push({...note,phase:part.phase,when:at});
      for(let t=0;t<seconds;t+=.125){Object.defineProperty(ctx,'currentTime',{configurable:true,value:t});score.update(script(t),1);}
      return played;
    };
    const crossed=conducted(t=>t<21?'drift':'fog',40);
    const fogFrom=Math.min(...crossed.filter(n=>n.phase==='fog').map(n=>n.when));
    check(Math.abs(fogFrom-24.08)<.01&&crossed.filter(n=>n.phase==='drift').every(n=>n.when<fogFrom),
      'Asked for mid-chord, the fog begins at the drift\'s next chord change and the drift starts nothing after it');
    check(crossed.some(n=>n.phase==='fog'&&n.voice==='pad'&&Math.abs(n.when-fogFrom)<.2),'The new piece comes in with its own chord');
    const back=conducted(t=>t>=17&&t<19?'fog':'drift',40);
    check(back.every(n=>n.phase==='drift'),'A request withdrawn before the chord change leaves the piece playing');
    const quick=conducted(t=>t<5?'refuge':t<6?'home':'farewell',30);
    check(!quick.some(n=>n.phase==='home')&&quick.some(n=>n.phase==='farewell'&&Math.abs(n.when-8.08)<.2),'Several requests before a change go straight to the latest');

    const t=new ArrivalTransition(),v={...baseState,music:'drowned',drownedScore:'storm',hush:.85};
    t.update(v,0);
    const first=t.update({...v,arrivalMusic:'wood'},10);
    check(first.legato&&first.stage==='blend'&&first.background.music==='wood','Drowned to Wood begins an overlap without a gap');
    check(t.update({...v,arrivalMusic:'wood'},10).stage==='blend','Frozen audio time cannot advance the overlap');
    check(t.update({...baseState,...ARRIVAL_MUSIC.wood},14.1).legato,'Landing completes the overlap without clearing reverb');
    const ordinary=new ArrivalTransition();ordinary.update({...baseState,music:'mirror',mirrorScore:'depart'},0);
    check(ordinary.update({...baseState,music:'mirror',mirrorScore:'depart',arrivalMusic:'home'},1).stage==='fade','Other island handoffs retain their established timing');

    async function render(name,kind,seconds) {
      const {ctx,sound}=offlineSound(seconds),history=[],retiring=[];
      let reverb=null,oldScore=null,gateMin=1,blooms=0,forestStarted=null,forestTuned=false;
      const originalChime=sound.chime.bind(sound),notes=[];
      sound.chime=(...a)=>{notes.push(a);originalChime(...a);};
      for(const method of ['cricket','owl','skylark','peep','bugle'])sound[method]=()=>{};
      if(kind==='music')backgroundOnly(ctx,sound);
      const scoreOf=()=>name==='mirror'?sound.dreamScore:sound.drownedScore;
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
          // The farewell darkens with the storm before the forest handoff.
          state={...baseState,music:'drowned',drownedScore:now<10?'farewell':'storm',hush:now<22?.6:.85,land:0,sea:1,
            night:.55+Math.min(1,now/20)*.45,shower:Math.min(1,now/14),breeze:1,
            arrivalMusic:now>=W&&now<W+8?'wood':undefined,
            ...(now>=W+8?ARRIVAL_MUSIC.wood:{}),
            forestWind:now>=W+8,
            cues:now===W+12?['kindled']:now===W+18?['comfort']:[],
            gust:now>=W+1&&now<W+2?7:0,charge:now>=W+9&&now<W+10?.18:0};
        }
        if(scoreOf() && oldScore!==scoreOf()){oldScore=scoreOf();retiring.push(oldScore);}
        sound.update(.125,{...state,flockChatter:false});
        if(name==='mirror'&&sound.dreamScore&&!sound.dreamScore.probed) {
          sound.dreamScore.probed=true;const bloom=sound.dreamScore.bloom.bind(sound.dreamScore);
          sound.dreamScore.bloom=()=>{blooms++;bloom();};
        }
        if(name==='drowned') {
          if(now===W-1)reverb=sound.reverbConvolver;
          if(now>=W){gateMin=Math.min(gateMin,sound.backgroundGate.gain.value,sound.wetGate.gain.value);check(sound.reverbConvolver===reverb,`wood ${now}: the shared reverb survives`);}
          if(sound.arrivalTransition.stage==='blend')forestStarted??=now;
          if(forestStarted!==null&&!forestTuned&&now>=forestStarted+.125) {
            check(sound.padVoices.every((v,i)=>Math.abs(v.osc[0].frequency.value-440*2**(([38,45,50,57][i]-69)/12))<.01),
              'Forest pad starts on the shared D/A pitches at the musical handoff');
            forestTuned=true;
          }
        }
        const phase=scoreOf()?.current?.phase??sound.mood;
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
        check(windows.slice(W-3,W+13).every(db=>db>-65),`${kind}: music remains audible across the village/forest boundary`);
        check(!notes.some(n=>n[6]&&n[3]>=W+1&&n[3]<W+2)&&notes.some(n=>n[6]&&n[3]>=W+9&&n[3]<W+10),`${kind}: musical wind begins in the actual forest, not the departing village`);
        const jumps=windows.slice(W-2,W+11).slice(1).map((db,i)=>Math.abs(db-windows[W-2+i]));
        if(kind==='music')check(Math.max(...jumps)<6,`Forest overlap has no one-second loudness jump over 6 dB: ${Math.max(...jumps).toFixed(2)}; ${JSON.stringify(windows.slice(W-2,W+11).map(n=>+n.toFixed(1)))}; ${JSON.stringify(history)}`);
      }
      const encoded=encodeAudio(buffer);check(encoded.clipped===0,`${name}/${kind}: no clipping`);
      renders.push({name,kind,history,gateMin,blooms,windows,...encoded});
    }
    await render('mirror','music',120);
    await render('drowned','music',W+26);
    await render('drowned','scene',W+26);
    return {checks,renders};
  },{notes:composition('mirror'),palette});
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
