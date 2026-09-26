// An evolution of the original opening, for audition only. The production pad is retained verbatim.
export const openingStudy = {
  seconds: 96,
  phases: [[0,'arrival'],[6,'first wind'],[16,'exploration'],[40,'colour returns'],
    [56,'flock overhead'],[61,'cygnet falls'],[66,'landing and care'],[80,'departure']],
  intent: 'Keep the original uncertain harmony and timbre; let a few answering notes find shape as the island wakes.',
};
export const openingNotes = [
  // Answers arrive after the first gestures, with enough space for the player to remain the lead.
  [18,64,3.8,.007], [23,69,4,.0075], [28,64,3.5,.0065],
  [33,62,3.5,.0075], [36,64,3.7,.007],
  // Let the original completion cue finish. A quiet third brings warmth to the existing open D chord.
  [44,66,4,.0028,'warmth'],
  // One small thought, not a full theme: A–F-sharp–E, left open before the flock arrives.
  [48,69,3.1,.008], [50.5,66,2.8,.0075], [53,64,2.7,.0065],
  // The fall and tending have no added music. Only after they leave does the answer return, subdued.
  [83,69,3.6,.0055], [87,64,3.7,.005], [91,62,3.4,.0045],
].map(([at,midi,duration,level,voice='answer'])=>({at,midi,duration,level,voice}));

export function openingState(t,base) {
  const clamp=x=>Math.max(0,Math.min(1,x));
  const life=t<6?0:t<40?clamp((t-6)/42)*.65:t<44?.53+(t-40)/4*.47:1;
  const hush=t<56?0:t<61?.55:t<76?1:t<80?1-(t-76)/4*.55:t<86?.45*(1-(t-80)/6):0;
  return {...base,music:'still',life,hush,breeze:t<6?0:t<80?.6:.75,
    sea:t<80?.4:1,land:t<80?1:0,night:0,meadow:0,cold:0,flockChatter:false,
    scripted:t>=56&&t<76,pianoActive:false,
    gust:[6,13,20,29,34,82,88].some(at=>t>=at&&t<at+.625)?6:0,
    cues:t===6?['breeze']:t===40?['restored']:t===61?['fallen']:t===66?['landed']:[]};
}

/** The added voice sits inside the same room as the original, with a soft onset and few overtones. */
export function scheduleOpening(ctx,sound) {
  const gate=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain(),verb=ctx.createConvolver();
  gate.connect(sound.backgroundDuck);dry.connect(gate);wet.gain.value=.495;
  verb.buffer=sound.reverbConvolver.buffer;wet.connect(verb).connect(gate);
  // Retire the added dry sound AND its reverberation before the opening's authored fall sequence.
  gate.gain.setValueAtTime(1,0);gate.gain.setValueAtTime(1,54.5);
  gate.gain.linearRampToValueAtTime(0,56);gate.gain.setValueAtTime(0,80);
  gate.gain.linearRampToValueAtTime(1,82);
  const voices=new Set();
  for(const n of openingNotes){
    const end=n.at+n.duration,p=ctx.createStereoPanner(),filter=ctx.createBiquadFilter(),env=ctx.createGain();
    p.pan.value=n.voice==='warmth'?0:-.12;p.connect(dry);p.connect(wet);
    filter.type='lowpass';filter.frequency.value=n.voice==='warmth'?900:1500;filter.Q.value=.35;filter.connect(p);env.connect(filter);
    const attack=n.voice==='warmth'?1.2:.28;
    env.gain.setValueAtTime(0,n.at);
    env.gain.setValueCurveAtTime(new Float32Array([0,.038,.146,.309,.5,.691,.854,.962,1]).map(x=>x*n.level),n.at,attack);
    env.gain.exponentialRampToValueAtTime(n.level*.5,end-1.2);env.gain.linearRampToValueAtTime(0,end);
    const partials=[[1,1],[2,.055],[3,.065],[5,.012]];let left=partials.length;
    for(const [ratio,amplitude] of partials){
      const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.value=440*2**((n.midi-69)/12)*ratio;
      g.gain.value=amplitude;osc.connect(g).connect(env);voices.add(osc);osc.start(n.at);osc.stop(end+.02);
      osc.onended=()=>{voices.delete(osc);osc.disconnect();g.disconnect();if(--left===0){env.disconnect();filter.disconnect();p.disconnect();}};
    }
  }
  return {voices,gate,dispose(){gate.disconnect();dry.disconnect();wet.disconnect();verb.disconnect();}};
}
