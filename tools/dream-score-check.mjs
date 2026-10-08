// Approved-score parity, the drowned cues' key and phrasing, real Web Audio chapter timing and the Drowned → Wood handoff.
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
    const {press,relax}=(await productionModule('/src/tuning.ts')).tuning.audio.drownedChase;
    const checks=[],renders=[];
    const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
    check(JSON.stringify(DREAM_NOTES)===JSON.stringify(reference.notes),'Both integrated scores retain every approved note, strength, pan and duration');
    check(JSON.stringify(DREAM_PALETTE)===JSON.stringify(reference.palette),'Every approved instrument envelope and partial is retained');
    const envelope=n=>n.duration>DREAM_PALETTE[n.voice].attack+(n.release??DREAM_PALETTE[n.voice].release);
    for(const [name,section] of Object.entries(DREAM_SECTIONS)) {
      check(section.chords.length>0&&section.notes.some(n=>n.role==='harmony'&&n.at<.25),`${name}: harmony starts with the phase`);
      check(!section.notes.some(n=>n.role==='star'),`${name}: repeated phases never replay star rewards`);
      check((section.variants??[section.notes]).every(notes=>notes.every(envelope)),`${name}: valid envelopes after section slicing`);
    }
    // Sections the story can hold for a while repeat a body long enough not to be heard looping.
    for(const name of ['stuck','chase','belfry','answer1','answer2','answer3','home'])
      check(DREAM_SECTIONS[name].seconds-(DREAM_SECTIONS[name].loopFrom??0)>=20,`${name}: repeats a body of at least 20 s`);
    // Every passage the chase can choose, so the checks below see all of it.
    const passages=[],conductor=DREAM_SECTIONS.chase.conduct();
    for(const tension of [0,0,0,0,0,0,0,1,1])passages.push(conductor.next(tension));
    const chase=passages.map(p=>p.chords.map(c=>c.tones[0]%12).join());
    const EASED='11,7,2,9',PRESSED='11,7,4,6';
    check(chase.slice(1).every(roots=>roots===EASED||roots===PRESSED)&&chase.includes(EASED)&&chase.includes(PRESSED),
      'The chase has two progressions only: B minor, G, D, A eased and B minor, G, E minor, F♯ pressing');
    // B minor and its relative D major share one scale; the leading note A♯ belongs only to the dominant F♯.
    const scale=new Set([11,1,2,4,6,7,9]);
    const diatonic=(notes,chords)=>notes.every(n=>scale.has(n.midi%12)||n.midi%12===10&&
      [...chords].reverse().find(c=>c.at<=n.at+.05).tones[0]%12===6);
    for(const name of ['stuck','chase','climb','belfry','answer1','answer2','answer3','home','farewell']) {
      const section=DREAM_SECTIONS[name];
      check((section.variants??[section.notes]).every(notes=>diatonic(notes,section.chords))
        &&(name!=='chase'||passages.every(p=>diatonic(p.notes,p.chords)&&p.notes.every(envelope))),
        `${name}: its harmony and melody are diatonic to B minor (D major), A♯ only over the dominant`);
    }
    // The chase as the game drives it: what it played, and each passage as it was chosen.
    const conducted=(tensionAt,seconds)=>{
      const ctx=new OfflineAudioContext(2,24000,24000),score=new DreamScore(ctx,ctx.destination,'drowned'),played=[],chosen=[];
      score.play=(part,note,at)=>played.push({...note,when:at});
      const section=DREAM_SECTIONS.chase,conduct=section.conduct;
      section.conduct=()=>{const c=conduct(),next=c.next.bind(c);
        c.next=tension=>{const passage=next(tension);chosen.push({start:score.current.start,passage});return passage;};return c;};
      try{for(let t=0;t<seconds;t+=.125){Object.defineProperty(ctx,'currentTime',{configurable:true,value:t});score.update('chase',1,Infinity,tensionAt(t));}}
      finally{section.conduct=conduct;}
      return {played,chosen:chosen.filter(c=>c.start+c.passage.seconds<seconds-.5),tensionAt};
    };
    const pressing=passage=>passage.chords.map(c=>c.tones[0]%12).join()===PRESSED;
    const key=n=>`${n.voice}:${n.midi}:${n.when.toFixed(3)}`;
    const noise=k=>{const x=Math.sin(k*12.9898)*43758.5453;return x-Math.floor(x);};
    const restless=conducted(t=>noise(Math.floor(t/.7)),240);
    let turned=0,crossed=0;
    restless.chosen.forEach(({start,passage},i)=>{
      const next=restless.chosen[i+1];
      if(next){check(Math.abs(next.start-start-passage.seconds)<1e-6,'The chase\'s passages follow each other without a gap or overlap');
        if(pressing(next.passage)!==pressing(passage))turned++;}
      const within=restless.played.filter(n=>n.when>=start-.01&&n.when<start+passage.seconds-.01);
      const wanted=passage.notes.filter(n=>n.role!=='accompaniment').map(n=>key({...n,when:start+n.at})).sort();
      const sung=within.filter(n=>n.role!=='accompaniment').map(key).sort();
      check(JSON.stringify(sung)===JSON.stringify(wanted),'Every chase passage plays its chords and its whole tune, with nothing from another progression');
      const tensions=[];for(let t=start;t<start+passage.seconds;t+=.25)tensions.push(restless.tensionAt(t));
      if(Math.min(...tensions)<relax&&Math.max(...tensions)>=press)crossed++;
      for(let bar=0;bar*passage.bar<passage.seconds-1e-6;bar++){
        const from=start+bar*passage.bar,beats=within.filter(n=>n.role==='accompaniment'&&n.when>=from-.01&&n.when<from+passage.bar-.01);
        const count=fill=>beats.filter(n=>(n.fill??0)===fill).length;
        check(count(0)===4&&[0,2].includes(count(1))&&[0,4].includes(count(2))&&(count(2)===0||count(1)===2),
          'The chase\'s pulse fills or thins only at a bar line, never within a bar');
      }
    });
    check(turned>=2&&crossed>=3,'The chase was pressed and eased across many phrases while its tension changed mid-phrase');
    // Between the two thresholds the chase keeps its course: no turning at every phrase.
    const between=t=>Math.floor(t/12.8)%2?press-.02:relax+.02,hovering=t=>t<60||t>=75?between(t):press+.05;
    const held=conducted(hovering,170).chosen.slice(1);
    check(held.filter(c=>c.start<60).every(c=>!pressing(c.passage))&&held.filter(c=>c.start>=76).every(c=>pressing(c.passage))
      &&held.some(c=>c.start>=76),'The chase turns only past its margin, not at every phrase');
    // The fog far, the theme over the eased round; near, the question's head climbing over the pressing one.
    const notes=tension=>conducted(()=>tension,52).played,eased=notes(0),pressed=notes(1);
    const melody=list=>list.filter(n=>n.role==='melody').map(n=>n.midi%12);
    check([2,4,6,11].every(pc=>melody(eased).includes(pc))&&!melody(eased).includes(10),'Eased, the chase sings the question D–E–F♯–B');
    check(melody(pressed).includes(10)&&melody(pressed).includes(7)&&eased.some(n=>n.midi===38)&&!pressed.some(n=>n.midi===38),
      'Pressed, its head climbs to the leading note over the pressing round');
    const pulse=list=>list.filter(n=>n.role==='accompaniment').length;
    check(pulse(pressed)>=2.4*pulse(eased),'The chase pulse tightens as the fog nears');
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
      if(kind==='music')backgroundOnly(ctx,sound);
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
          if(now===45)reverb=sound.reverbConvolver;
          if(now>=46){gateMin=Math.min(gateMin,sound.backgroundGate.gain.value,sound.wetGate.gain.value);check(sound.reverbConvolver===reverb,`wood ${now}: the shared reverb survives`);}
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
