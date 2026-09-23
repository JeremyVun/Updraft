// Phrasing, repeated entrances, restrained gestures and cue harmony in real Web Audio; no GPU.
// node tools/audio-direction-check.mjs (Vite on 5230).
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';
const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const checks = [], renders = [];
    const check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const { schedulePhrase, phrasePosition, phraseHandoff, JOURNEY_THEME, JOURNEY_ANSWER, isMelody } = await productionModule('/src/audio/phrasing.ts');
    const { LINES_SECTIONS } = await productionModule('/src/audio/lines-score.ts');
    const { BIRCHES_SECTIONS } = await productionModule('/src/audio/birches-score.ts');
    const { MEADOW_SECTIONS } = await productionModule('/src/audio/meadow-score.ts');
    const { SLEEPING_SECTIONS } = await productionModule('/src/audio/sleeping-score.ts');
    const { SEA_SECTIONS } = await productionModule('/src/audio/sea-score.ts');
    const { BOATS_PHRASE } = await productionModule('/src/audio/little-boats-score.ts');
    const { ArrivalTransition } = await productionModule('/src/audio/arrival-music.ts');
    const melody = p => p.notes.filter(isMelody).map(n => n.midi);
    check(JSON.stringify(melody(LINES_SECTIONS.first).slice(0,3)) === JSON.stringify(JOURNEY_THEME.slice(0,3)), 'Lines introduces the piano theme as a fragment');
    check(JSON.stringify(melody(BOATS_PHRASE).slice(0,4)) === JSON.stringify(JOURNEY_THEME), 'Boats recalls the theme in its plucked voice');
    check(JSON.stringify(melody(BIRCHES_SECTIONS.walk).slice(0,4)) === JSON.stringify(JOURNEY_ANSWER), 'Birches answers with the theme in reverse');
    check(JSON.stringify(melody(SEA_SECTIONS.open)) === JSON.stringify(JOURNEY_THEME), 'The sea stretches the same theme across its opening');
    check(JSON.stringify(melody(SLEEPING_SECTIONS.climb).slice(0,3)) === '[62,64,65]', 'The winter recollection begins in minor');
    check(JSON.stringify(melody(SLEEPING_SECTIONS.climb).slice(3)) === '[69,64,62,57]', 'The cygnet remembers the bedside melody during the journey');
    for (const [name, pattern] of [['meadow',MEADOW_SECTIONS.return],['morning',SLEEPING_SECTIONS.morning]]) {
      const clock = {epoch:.08,cycle:0,next:0}, events=[];
      for (let now=0; now<pattern.seconds*4; now+=1/60) schedulePhrase(clock,pattern,now,(n,at)=>events.push({n,at}));
      const first=pattern.notes[0], starts=events.filter(e=>e.n.voice===first.voice&&e.n.midi===first.midi&&e.n.at===first.at);
      check(Math.abs(starts[0].at-.08-pattern.loopFrom)<.001,`${name}: first entry keeps its story-cue rest`);
      check(Math.abs(starts[1].at-.08-pattern.seconds)<.001,`${name}: the next verse omits the introductory rest`);
      check(starts.slice(1).every((e,i)=>!i||Math.abs(e.at-starts[i].at-(pattern.seconds-pattern.loopFrom))<.001),`${name}: later verses have no accumulating clock drift`);
      check(Math.abs(phrasePosition(pattern,.08,starts[1].at)-pattern.loopFrom)<.001,`${name}: harmony uses the repeating body's clock`);
    }
    for (const table of [LINES_SECTIONS,BIRCHES_SECTIONS,MEADOW_SECTIONS,SEA_SECTIONS]) for (const [name,p] of Object.entries(table)) {
      if (!p.variants) continue;
      const lastPad=p.notes.filter(n=>n.voice==='pad').at(-1);
      check(lastPad.at+lastPad.duration>p.seconds-1,`${name}: harmony covers the end of its loop`);
      check(p.variants[1].filter(isMelody).length<=Math.ceil(p.notes.filter(isMelody).length/2),`${name}: alternating verse makes melodic space`);
    }
    check(SLEEPING_SECTIONS.cold.notes.length===0,'Frost retains its deliberate musical silence');
    check(SLEEPING_SECTIONS.summit===SLEEPING_SECTIONS.climb,'The climb carries its phrase through the summit');
    const end=phraseHandoff(LINES_SECTIONS.first,.08,6);
    check(end>6&&end<8,'A handoff near the end of a melodic gesture waits for it');
    const transition=new ArrivalTransition(), state={...baseState,music:'lines',linesScore:'first',arrivalMusic:'boats'};
    check(transition.update(state,6,end).stage==='wait'&&transition.update(state,end).stage==='fade','Arrival waits once, then begins its fade on the phrase clock');
    const clock={epoch:.08,cycle:0,next:0}, scheduled=[];
    for(let now=0;now<7;now+=.05)schedulePhrase(clock,LINES_SECTIONS.first,now,(n,at)=>scheduled.push(at),end);
    check(scheduled.every(at=>at<end),'Lookahead does not start a new phrase beyond the handoff');

    const {ctx,sound}=offlineSound(1), events=[];
    sound.chime=(...a)=>events.push(a);
    const tick=(now,state)=>{Object.defineProperty(ctx,'currentTime',{configurable:true,value:now});sound.update(.05,{...baseState,...state,flockChatter:false});};
    for(let now=0;now<10;now+=.05)tick(now,{music:'still',startingIsland:true,gust:26,charge:.8});
    check(events.length>=14&&events.length<=17&&new Set(events.map(e=>e[3])).size===events.length,'Combined gust/lift emits one gentle response, at most 1.6 times per second');
    const pitchAtCharge=charge=>{events.length=0;sound.lastNote=sound.lastArp=-100;tick(10,{music:'still',startingIsland:true,charge});return events[0][0];};
    check(pitchAtCharge(.59)===pitchAtCharge(.61),'Crossing the former charge threshold does not jump an octave');
    for (const fps of [30,60,144]) for (const forest of [false,true]) {
      events.length=0;sound.lastNote=sound.lastArp=sound.lastGlider=-100;sound.prevGliderLift=0;
      for(let frame=0;frame<fps*24;frame++)tick(frame/fps,{
        music:forest?'wood':'still',startingIsland:!forest,forestWind:forest,
        gust:26,charge:frame%fps<fps/2?.8:0,gliderLift:frame%(fps*3)<fps/3?1:0,
      });
      const times=events.map(e=>e[3]).sort((a,b)=>a-b),gap=forest?1.25:.625;
      check(times.length>10&&times.slice(1).every((at,i)=>at-times[i]>=gap-1e-6),
        `${fps} Hz ${forest?'forest':'opening'}: gust, lift and both glider notes share the minimum gap`);
    }
    for(const lift of [false,true]) {
      events.length=0;sound.lastNote=sound.lastArp=-100;sound.noteIndex=0;
      for(let now=0;now<22;now+=.05)tick(now,{music:'wood',forestWind:true,gust:lift?0:26,charge:lift?.8:0});
      const notes=events.map(e=>e[0]);
      check(notes.includes(50)&&notes.every(m=>m>=50&&m<=(lift?69:72)),
        `Forest ${lift?'updraft':'stroke'} retains its low D register`);
      if(!lift)check(notes.includes(53)&&notes.includes(60)&&notes.includes(65), 'Forest strokes retain the original minor colours outside the D/A pedal');
    }
    events.length=0;tick(12,{music:'birches',birchesScore:'scarf'});tick(32,{music:'birches',birchesScore:'scarf',cues:['restored']});
    check(JSON.stringify(events.map(e=>e[0]))==='[62,66,69,74,78,81,86]', 'Completion retains its original melody over the scarf harmony');
    check(events.every(e=>!e[5]&&!e[6]), 'Completion uses the original bell voice and is independent of cursor tail gating');
    events.length=0;tick(34,{music:'birches',birchesScore:'scarf',cues:['delight']});
    check(JSON.stringify(events.map(e=>e[0]))==='[81,86,90]'&&events.every(e=>!e[5]&&!e[6]), 'Small successes retain the original high three-note bell phrase');
    events.length=0;tick(36,{music:'birches',birchesScore:'scarf',cues:['breeze']});
    check(JSON.stringify(events.map(e=>e[0]))==='[74,78,81]', 'The first breeze retains its original three-note phrase');
    events.length=0;tick(40,{music:'home',cues:['unfold']});
    check(JSON.stringify(events.map(e=>e[0]))==='[74,78,81,83,81,78,76,78,74,71,74,76,78,76,74]','The selected home melody retains every pitch');
    check(sound.cueSpaceUntil>50,'The background makes room for the whole recognition melody');
    delete ctx.currentTime;

    // Departure releases even a common-tone opening gesture without a hard cut.
    const tail=offlineSound(4); let tracked, held, released;
    tail.sound.update(.1,{...baseState,music:'still',startingIsland:true});
    tail.sound.chime(62,.5,0,1,2.2,false,true);tracked=tail.sound.gestureVoices[0];
    let pause=tail.ctx.suspend(1.25), rendering=tail.ctx.startRendering();await pause;
    tail.sound.update(.1,{...baseState,music:'still',startingIsland:false});held=tracked.out.gain.value;
    pause=tail.ctx.suspend(1.625);await tail.ctx.resume();await pause;released=tracked.out.gain.value;
    await tail.ctx.resume();await rendering;
    check(held===1&&released===0,'A common-tone opening chime fades on departure even while the opening music continues');
    check(tail.sound.gestureVoices.length===0,'Finished gesture voices leave no tracked nodes');

    const minor=offlineSound(1);
    minor.sound.update(.1,{...baseState,music:'wood',forestWind:true});
    minor.sound.chime(53,.5,0,.1,2.2,false,true);
    minor.sound.update(.1,{...baseState,music:'wood',forestWind:true});
    check(minor.sound.gestureVoices.length===1, 'The wood does not immediately mute its restored minor notes');
    minor.sound.update(.1,{...baseState,music:'wood',forestWind:false});
    check(minor.sound.gestureVoices.length===0, 'The restored forest palette still releases on departure');
    await minor.ctx.startRendering();

    // Reviewable sustained passages expose joins, variation, reward overlap and phrase-aware departure.
    for (const item of [
      {name:'lines-loops',seconds:58,state:{music:'lines',linesScore:'family'}},
      {name:'birches-rewards',seconds:48,state:{music:'birches',birchesScore:'walk'}},
      {name:'sea-theme',seconds:38,state:{music:'sea',seaScore:'open'}},
      {name:'phrase-handoff',seconds:16,state:{music:'lines',linesScore:'first'}},
    ]) {
      const {ctx,sound}=offlineSound(item.seconds), phases=[];let outgoing, checkedRetirement=false;
      if(item.name==='lines-loops'){sound.master.disconnect();sound.backgroundGate.disconnect();sound.backgroundGate.connect(ctx.destination);}
      const update=tick=>{
        const now=tick/8;
        if(now===6)outgoing=sound.linesScore;
        sound.update(.125,{...baseState,...item.state,land:0,flockChatter:false,
          ...(item.name==='phrase-handoff'?{arrivalMusic:now>=6?'boats':undefined}:{}),
          ...(item.name==='birches-rewards'?{cues:now===10?['restored']:[],gust:now>=8&&now<15?12:0,charge:now>=26&&now<30?.7:0}:{}),
        });
        const stage=sound.arrivalTransition.stage;if(phases.at(-1)?.stage!==stage)phases.push({now,stage});
        if(item.name==='phrase-handoff'&&stage==='incoming'&&!checkedRetirement){check(outgoing.parts.size===0,'Outgoing voices are retired before the new composition enters');checkedRetirement=true;}
      };
      update(0);let pause=ctx.suspend(.125),rendering=ctx.startRendering();
      for(let tick=1;tick<item.seconds*8;tick++){await pause;update(tick);if(tick+1<item.seconds*8)pause=ctx.suspend((tick+1)/8);await ctx.resume();}
      const buffer=await rendering,encoded=encodeAudio(buffer);
      check(encoded.clipped===0&&encoded.peakDbFS<-3,`${item.name}: combined render has headroom without clipping`);
      if(item.name==='lines-loops') {
        const d=buffer.getChannelData(0);
        for(const [from,to] of [[12,17],[30,35],[48,53]]) {
          let sum=0;for(let i=from*24000;i<to*24000;i++)sum+=d[i]**2;
          check(10*Math.log10(sum/((to-from)*24000))>-55,`Lines ${from}–${to}s: former loop hole remains audible`);
        }
      }
      if(item.name==='phrase-handoff')check(phases.some(p=>p.stage==='wait'),'Production Soundscape uses the melodic handoff boundary');
      renders.push({name:item.name,phases,...encoded});
    }
    return {checks,renders};
  });
  for(const render of result.renders){fs.writeFileSync(`/tmp/updraft-${render.name}.wav`,wav(Buffer.from(render.pcm,'base64')));delete render.pcm;}
  fs.writeFileSync('/tmp/updraft-audio-direction.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({checks:result.checks.length,renders:result.renders}));
} finally { await browser.close(); }
