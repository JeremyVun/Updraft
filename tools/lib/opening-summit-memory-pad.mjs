// Musical-memory audition. The approved unfold cue is unchanged; its fragments live INSIDE the pad.
// Source phrase: D F# A B A F# E F# D | B D E F# E D (audio.ts PHRASES.unfold).
// Original detuned drone only, with no extra instrument or articulated lead melody.
const opening = [
  [0, [50,57,62,69], 'original entrance'],
  // An octave below the cue, the first four notes emerge, then the phrase loses its way.
  [6, [47,54,57,62], 'memory: D'],
  [12, [43,55,62,66], 'memory: F#'],
  [15, [45,55,62,69], 'memory: A'],
  [18, [47,54,62,71], 'memory: B; the answer is withheld'],
  [24, [40,55,62,67], 'E minor: an unfamiliar answer'],
  [30, [48,55,59,64], 'Cmaj7: drift outside the opening key'],
  [36, [46,53,57,62], 'Bbmaj7: D belongs to a different place'],
  [42, [45,52,57,64], 'open A; a breath'],
  // The remembered descending answer, stretched within the moving chords.
  [48, [43,54,62,71], 'memory: B'],
  [54, [47,54,62,69], 'memory: A'],
  [57, [50,57,62,66], 'memory: F#; a glimpse of warmth'],
  [60, [48,55,59,64], 'memory: E; the bass takes it elsewhere'],
  [66, [46,53,57,62], 'Bbmaj7; incomplete recollection'],
  [72, [43,55,58,62], 'G minor; tenderness without arrival'],
  [78, [45,55,62,64], 'A suspension'],
  [86, [50,57,62,64], 'D remains open; the journey has not been answered'],
];
const summit = [
  [0, [47,54,62,66], 'the journey still present'],
  // More of the same phrase, preserving its 2:1:1:2:1:1:2:1 proportions at a drone's pace.
  [6, [47,54,57,62], 'memory: D'],
  [12, [43,55,62,66], 'memory: F#'],
  [15, [45,55,62,69], 'memory: A'],
  [18, [47,54,62,71], 'memory: B'],
  [24, [43,59,62,69], 'memory: A'],
  [27, [42,57,62,66], 'memory: F#; bass descends under the bird'],
  [30, [40,55,59,64], 'memory: E'],
  [36, [45,55,61,66], 'memory: F#'],
  [39, [47,54,62,66], 'withhold the original final D; there is still a goodbye'],
  // The answer comes down into a smaller register after the bird goes.
  [45, [47,54,57,59], 'second phrase: B, in the lower answering register'],
  [48, [43,54,59,62], 'second phrase: D'],
  [51, [48,55,59,64], 'second phrase: E; the opening dream returns'],
  [57, [42,57,62,66], 'second phrase: F#'],
  [60, [43,58,62,64], 'second phrase: E; borrowed G minor colours the answer'],
  [63, [42,57,59,62], 'second phrase: D, still without a root-position home'],
  [70, [40,55,59,62], 'E minor; on toward the house'],
  [76, [45,55,62,64], 'A suspension'],
  [80, [45,55,61,64], 'the suspension settles'],
  [84, [50,57,59,66], 'D6; home beneath the remembered notes'],
  [90, [50,54,59,62], 'D6; the answer rests inside the drone'],
];
export const studies = Object.fromEntries([
  ['opening','still',opening,'An unfinished recollection of home, interrupted by dreamlike harmonic detours.'],
  ['summit','home',summit,'The recollection grows clearer; the answer returns quietly after separation.'],
].map(([name,mood,rows,intent]) => [name, {
  mood,seconds:100,usesProductionPad:true,intent,
  chords:rows.map(([at,chord,meaning],i) => [at,(rows[i+1]?.[0] ?? 100)-at,chord,meaning]),
  recognitionSource:[74,78,81,83,81,78,76,78,74,0,71,74,76,78,76,74],
  quotedFirstPhrase:[62,66,69,71,69,66,64,66],
  quotedSecondPhrase:[59,62,64,66,64,62],
}]));

export function studyState(name,t,base) {
  return {...base,music:studies[name].mood,startingIsland:name==='opening',
    life:name==='opening'?Math.min(1,.1+t/48):1,
    night:0,hush:0,gust:0,breeze:0,sea:0,land:1,meadow:0,flockChatter:false,cues:[]};
}

export function scheduleStudy(name,ctx,sound) {
  const pad=sound.padVoices,voices=new Set(),schedule=[],study=studies[name];
  sound.padVoices=[];
  const phrase=ctx.createGain();
  sound.padFilter.disconnect();sound.padFilter.connect(phrase).connect(sound.backgroundBus);
  const dynamics=name==='opening'
    ? [[0,1],[6,1],[18,.96],[30,.85],[42,.78],[48,.90],[57,1],[66,.84],[86,.78]]
    : [[0,.83],[12,.85],[24,.97],[36,1.02],[39,.88],[45,.47],[60,.46],[70,.53],[84,.76],[94,.72]];
  dynamics.forEach(([at,value],i)=>{
    if(!i)phrase.gain.setValueAtTime(value,at);else phrase.gain.linearRampToValueAtTime(value,at);
  });
  let previous;
  for(const [at,,chord,meaning] of study.chords) {
    pad.forEach((voice,i)=>{
      if(previous&&previous[i]===chord[i])return;
      // The remembered note is the fourth EXISTING pad voice, at its ordinary gain.
      const delay=at===0?0:i===0?0:i===3?.10:.23;
      for(const osc of voice.osc)osc.frequency.setTargetAtTime(
        440*2**((chord[i]-69)/12),at+delay,at===0?3.5:i===0?.62:.72);
    });
    schedule.push({at,chord,meaning});previous=chord;
  }
  for(const voice of pad) {
    voice.gain.gain.setTargetAtTime(.25,0,2.5);
    for(const osc of voice.osc) {
      voices.add(osc);osc.stop(study.seconds+4);
      osc.addEventListener('ended',()=>{voices.delete(osc);osc.disconnect();},{once:true});
    }
  }
  return {voices,schedule,dispose(){phrase.disconnect();for(const voice of pad)voice.gain.disconnect();sound.padVoices=pad;}};
}
