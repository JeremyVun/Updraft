// Approved composition/instrument parity, independent melody trim and progress-driven audio lifecycle.
// node tools/lines-score-check.mjs (Vite on 5230, or BASE; no GPU).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { LinesScore, LINES_AUDITION_NOTES, LINES_SECTIONS } = await import('/src/audio/lines-score.ts');
    const { LinesChapter } = await import('/src/story/lines.ts');
    const { door } = await productionModule('/src/world/lines.ts');
    const { takeCues } = await productionModule('/src/story/cues.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const { scheduleProposal } = await import('/tools/lib/island-score-proposals.mjs');
    const passed = [], check = (ok, message) => { if (!ok) throw Error(message); passed.push(message); };
    const canonical = notes => notes.map(({ voice,midi,at,duration,level }) => ({ voice,midi,at,duration,level }))
      .sort((a,b) => a.at-b.at || a.midi-b.midi);
    const referenceContext = new OfflineAudioContext(2, 76*24000, 24000);
    const reference = scheduleProposal('lines', referenceContext, referenceContext.destination);
    check(JSON.stringify(canonical(reference.notes)) === JSON.stringify(canonical(LINES_AUDITION_NOTES)),
      'All approved notes, timing, durations and untrimmed strengths are preserved');
    const expected = await referenceContext.startRendering();
    const parityContext = new OfflineAudioContext(2, 76*24000, 24000), parity = new LinesScore(parityContext, parityContext.destination);
    const part = { bus: parityContext.destination, melody: parityContext.destination, voices: new Set(), stopped: false };
    for (const note of LINES_AUDITION_NOTES) parity.play(part, note, note.at);
    const actual = await parityContext.startRendering();
    let error=0, power=0;
    for (let ch=0;ch<2;ch++) {
      const a=actual.getChannelData(ch), b=expected.getChannelData(ch);
      for (let i=0;i<a.length;i++) { error+=(a[i]-b[i])**2; power+=b[i]**2; }
    }
    const relativeError=Math.sqrt(error/power);
    check(relativeError<.0001, `Production timbres match the approved waveform (${relativeError})`);
    check(!part.voices.size,'All audition voices finish');
    check(Math.abs(20*Math.log10(tuning.audio.linesScoreLevel)-17.6)<.001,'Approved accompaniment gain excludes the audition playback boost');

    const gainMeasurements=[];
    for(const voice of ['pad','soft-reed']) {
      const buffers=[];
      for(const trimmed of [false,true]) {
        const ctx=new OfflineAudioContext(2,12*24000,24000), score=new LinesScore(ctx,ctx.destination);
        const melody=ctx.createGain();melody.gain.value=trimmed?10**(tuning.audio.linesMelodyDb/20):1;melody.connect(ctx.destination);
        const p={bus:ctx.destination,melody,voices:new Set(),stopped:false};
        score.play(p,LINES_AUDITION_NOTES.find(n=>n.voice===voice),.2);
        const b=await ctx.startRendering();buffers.push(b.getChannelData(0).reduce((sum,v)=>sum+v*v,0));
      }
      const db=10*Math.log10(buffers[1]/buffers[0]);gainMeasurements.push({voice,db});
      check(Math.abs(db-(voice==='pad'?0:tuning.audio.linesMelodyDb))<.001,`${voice}: the melody trim affects only its intended voice (${db.toFixed(3)} dB)`);
    }

    const phase=Object.getOwnPropertyDescriptor(LinesChapter.prototype,'linesScore').get;
    const quiet=Object.getOwnPropertyDescriptor(LinesChapter.prototype,'linesMelodyQuiet').get;
    const story={beat:'wonder',gate:0};door.open=0;
    for(const [gate,want] of [[0,'first'],[1,'second'],[2,'third']]) {
      story.gate=gate;
      for(const beat of ['approach','curtain','birdThrough','childThrough']) {
        story.beat=beat;check(phase.call(story)===want,`${want}/${beat}: passage progress owns the musical section`);
        check(quiet.call(story)===(beat==='birdThrough'||beat==='childThrough'),`${want}/${beat}: melody space follows the bird leading`);
      }
    }
    for(const beat of ['familyApproach','family']) { story.beat=beat;check(phase.call(story)==='family',`${beat}: warmth begins at the family clothes`); }
    door.open=1;story.beat='family';check(phase.call(story)==='door','Opening the door gives completion its accompaniment-only section');
    for(const beat of ['throughDoor','shore','walk','toBoat','ashore','push','aboard']) {
      story.beat=beat;
      const want=beat==='throughDoor'?'door':['shore','walk','toBoat','push','aboard'].includes(beat)?'shore':'third';
      check(phase.call(story)===want,`${beat}: doorway, beach and original sailing transitions retain their places`);
    }
    // Exercise actual restoration; no cue or family reveal may replay from an existing save.
    const THREE=await import('/node_modules/three/build/three.module.js');
    for(const point of ['curtain-1','curtain-2','family']) {
      const restored=Object.assign(Object.create(LinesChapter.prototype),{
        cast:{child:{position:new THREE.Vector3(300,0,0),stop(){},walkTo(){}},
          cygnet:{follow(){},watch(){}},plane:{hold(){}},boat:{beach(){}}},
        now:0,beatStart:0,
      });
      takeCues();restored.restoreCheckpoint(point,point==='family'?[0,1]:[Number(point.slice(-1)),0]);
      check(restored.linesScore===(point==='family'?'shore':point==='curtain-1'?'second':'third')&&!takeCues().length,
        `${point}: restoration selects the right music without a reward`);
    }

    for(const fps of [10,60,144]) {
      const ctx=new OfflineAudioContext(2,24000,24000), score=new LinesScore(ctx,ctx.destination),events=[];
      score.play=(p,n,at)=>events.push({phase:p.phase,n,at,now:ctx.currentTime});
      const phases=Object.keys(LINES_SECTIONS);
      for(let tick=0;tick<fps*360;tick++) {
        const now=tick/fps;if(now>8&&now<13)continue;
        Object.defineProperty(ctx,'currentTime',{configurable:true,value:now});
        score.update(phases[Math.floor(now/60)],1,.8,now>=20&&now<35);
      }
      const reeds=events.filter(e=>e.n.voice==='soft-reed');
      check(reeds.every((e,i)=>!(e.now>=20&&e.now<35)||i&&reeds[i-1].phase===e.phase&&e.at-reeds[i-1].at-reeds[i-1].n.duration<=1.5),
        `${fps} Hz: quiet passages start no new figure and only finish one already sounding`);
      check(!events.some(e=>e.now>=13&&e.now<13.1),`${fps} Hz: stalled frames do not replay missed notes`);
      check(events.filter(e=>e.phase==='door').every(e=>e.n.voice==='pad'),`${fps} Hz: extended doorway waits have no lead melody`);
      check(phases.every(p=>events.some(e=>e.phase===p&&e.now%60>30)),`${fps} Hz: all sections can continue at the player's pace`);
      check(new Set(events.map(e=>`${e.phase}:${e.n.voice}:${e.n.midi}:${e.at.toFixed(5)}`)).size===events.length,`${fps} Hz: no duplicated attacks`);
      for(const phase of phases) {
        score.update(phase,1,.8);const epoch=score.current.epoch,pattern=LINES_SECTIONS[phase];
        check(pattern.chords.every(c=>JSON.stringify(score.chordAt(epoch+pattern.seconds*3+c.at+.001))===JSON.stringify(c.tones)),
          `${fps} Hz/${phase}: gesture harmony follows repeated sections`);
      }
      const count=events.length;score.stop();score.update('first',1,.8);
      check(events.length===count&&!score.parts.size,`${fps} Hz: stopped scores cannot restart`);
      delete ctx.currentTime;
    }

    const {ctx,sound}=offlineSound(87), feedback=[],glides=[],chords=[];
    let live,retiring,resumed;
    const chime=sound.chime.bind(sound);
    sound.chime=(...a)=>{feedback.push({now:ctx.currentTime,at:a[3],midi:a[0],duration:a[4],
      chord:sound.linesScore?[...sound.linesScore.chordAt(a[3])]:null});chime(...a);};
    const freq=sound.padVoices[0].osc[0].frequency,setTarget=freq.setTargetAtTime.bind(freq);
    freq.setTargetAtTime=(...a)=>{glides.push(a);return setTarget(...a);};
    const update=tick=>{
      const now=tick/8;
      const phase=now<4?undefined:now<16?'first':now<28?'second':now<40?'third':now<48?'family':now<60?'door':now<74?'shore':now<80?undefined:'first';
      const music=now>=78&&now<80?'meadow':'lines';
      sound.update(.125,{...baseState,music,linesScore:phase,linesMelodyQuiet:now>=10&&now<15,
        gust:[11,23,37,65].some(at=>now>=at&&now<at+.5)?9:0,charge:now>=21&&now<27?.65:0,
        pianoActive:now>=25&&now<25.75,silence:now>=83,cues:now===12?['delight']:now===48?['restored']:[]});
      chords.push({now,chord:sound.chord,music});
      if(now===4)live=sound.linesScore;
      if(now===15.5)retiring=live.current;
      if(now===19)check(!retiring.voices.size&&!live.parts.has(retiring),'A previous curtain section releases all its voices');
      if(now===14)check(live.current.resting&&live.current.melodyEnd<=now,'A passage and cue let the sounding figure finish, then hold the lead melody');
      if(now===22)check(sound.padGain.gain.value<.00001,'The legacy pad stays out of the composed Lines score');
      if(now===74)check(!sound.linesScore&&live.stopped,'Explicitly clearing the score retires its voices');
      if(now===77.5)check(sound.padGain.gain.value>.045,'An explicit fallback still restores the shared pad');
      if(now===80){resumed=sound.linesScore;check(resumed!==live,'Fresh chapter entry gets a fresh score');}
      if(now===83)check(!sound.linesScore&&resumed.stopped,'Permanent music silence stops Lines');
    };
    update(0);let pause=ctx.suspend(.125);const rendering=ctx.startRendering();
    for(let tick=1;tick<87*8;tick++){
      await pause;update(tick);if(tick+1<87*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();
    }
    const buffer=await rendering;
    // Cursor chimes are limited to the opening island, the forest and the Sleeping climb (docs/contracts/audio.md);
    // Lines is none of those, so gusts and held updrafts must stay silent even while the melody is quiet.
    check(![11,23,37,65].some(at=>feedback.some(e=>e.at>=at&&e.at<at+.5)),'Gusts do not trigger cursor chimes in Lines');
    const lifts=feedback.filter(e=>e.duration===1.6&&e.chord);
    check(lifts.length===0,'Held updrafts do not trigger cursor chimes in Lines');
    check(!feedback.some(e=>e.now>=25&&e.now<25.75),'Piano ownership still suppresses generic chimes');
    check(!live.parts.size&&!resumed.parts.size,'Exited scores release every voice and bus');
    check(chords.every(s=>s.chord===Math.floor(s.now/(s.music==='lines'?9:8.5))%4),'Shared chord clock continues independently');
    check(glides.some(([,at,seconds])=>at===78&&seconds===3.5),'Original island pitch glide is preserved');
    return {passed,relativeError,gainMeasurements,...encodeAudio(buffer)};
  });
  assert.equal(result.clipped,0);assert(result.peakDbFS<-.1);
  fs.writeFileSync('/tmp/updraft-lines-score-check.wav',wav(Buffer.from(result.pcm,'base64')));
  const {pcm,...report}=result;
  fs.writeFileSync('/tmp/updraft-lines-score-check.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:result.passed.length,relativeError:result.relativeError,gainMeasurements:result.gainMeasurements,peakDbFS:result.peakDbFS}));
} finally { await browser.close(); }
