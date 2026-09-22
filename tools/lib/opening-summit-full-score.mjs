// Full listening arrangements developed from the endorsed twenty-second opening-question.mjs.
// 80% tempo: a 4.25-second harmonic step becomes 5.3125 seconds. Pitches are not slowed/lowered.
// Original four-voice drone only. Playback form is illustrative; eventual runtime phases follow story state.
export const tempo = .8;
const step = 4.25 / tempo;
const opening = [
  // A — The approved question. Keep all five opening voicings, including its small minor turn.
  [50,57,62,69], [52,59,62,67], [54,57,62,66], [55,59,62,64],
  [55,58,62,64], [53,57,62,65], [52,55,61,64], [45,57,62,64],
  // B — Wandering. The answer rises as its foundations fall away; familiar pitches change their meaning.
  [45,55,62,64], [46,53,57,65], [45,55,60,67], [43,55,62,69],
  [41,57,60,67], [40,57,60,65], [46,53,57,64], [45,53,58,62],
  // C — A glimpse of warmth. The contrary motion returns through a different bass; the third then darkens.
  [47,54,62,69], [49,55,59,67], [50,57,62,66], [52,55,59,64],
  [54,57,62,66], [55,59,62,69], [54,57,62,67], [53,57,62,65],
  // A' — Recognisable, changed. B-flat and F-natural give the question an older, more uncertain colour.
  [50,57,62,69], [52,58,62,67], [53,57,62,65], [55,58,62,64],
  [46,53,57,62], [45,52,57,64], [45,55,62,64], [50,57,62,64],
];
const summit = [
  // A — Bring the same question back with everything the two travellers have been through.
  [50,57,62,69], [52,59,62,67], [54,57,62,66], [55,59,62,64],
  [55,58,62,64], [54,57,62,66], [52,55,62,67], [45,55,62,69],
  // B — Flight. The upper line rises E–F#–G–A–B while the bass descends A–G–F#–E–D.
  [45,55,62,64], [43,55,62,66], [42,57,62,67], [40,55,62,69],
  [38,54,62,71], [43,59,62,69], [45,55,61,67], [50,57,59,66],
  // C — Absence. The upper voice leaves; the three remaining voices carry a smaller, quieter thought.
  [47,54,62,66], [45,54,61,64], [43,55,59,62], [43,58,62,64],
  [42,57,62,66], [40,55,59,64], [45,55,62,64], [45,55,61,64],
  // A' — Home. The original question returns; the minor turn can now find its way to a final D.
  [50,57,62,69], [52,59,62,67], [54,57,62,66], [55,59,62,64],
  [55,58,62,64], [54,57,62,66], [45,55,61,64], [50,54,59,62],
];
const phrases = {
  opening:['the question','wandering','a glimpse of warmth','the question, changed'],
  summit:['the question remembered','flight','absence','home'],
};
export const studies = Object.fromEntries([
  ['opening','still',opening,'Lostness and curiosity, with warmth that does not yet become home.'],
  ['summit','home',summit,'The same question opens into flight, feels a voice leave, and finally finds its answer.'],
].map(([name,mood,voicings,intent])=>[name,{
  mood,seconds:180,usesProductionPad:true,preserveIntro:false,fadeOut:4,intent,tempo,
  phases:phrases[name].map((label,i)=>[i*8*step,label]),
  chords:voicings.map((tones,i)=>[i*step,i===31?180-i*step:step,tones,phrases[name][Math.floor(i/8)]]),
}]));

export function studyState(name,t,base) {
  return {...base,music:studies[name].mood,startingIsland:name==='opening',
    life:name==='opening'?Math.min(1,.1+t*tempo/48):1,
    night:0,hush:0,gust:0,breeze:0,sea:0,land:1,meadow:0,flockChatter:false,cues:[]};
}

export function scheduleStudy(name,ctx,sound,_piano,study=studies[name]) {
  const pad=sound.padVoices,voices=new Set(),schedule=[];
  sound.padVoices=[];
  const phrase=ctx.createGain();
  sound.padFilter.disconnect();sound.padFilter.connect(phrase).connect(sound.backgroundBus);
  const dynamics=study.dynamics??(name==='opening'
    ? [[0,1],[25,1],[42.5,.88],[63.75,.90],[85,1],[106.25,1],[127.5,.92],[148.75,.84],[169,.82],[176,.78]]
    : [[0,.85],[25,.90],[42.5,.92],[63.75,1.06],[80,1],[90,.65],[105,.58],[122,.64],[127.5,.68],[143,.78],[163,.82],[176,.70]]);
  dynamics.forEach(([at,gain],i)=>{
    if(!i)phrase.gain.setValueAtTime(gain,at);else phrase.gain.linearRampToValueAtTime(gain,at);
  });
  let previous;
  for(const [at,,chord,section] of study.chords) {
    pad.forEach((voice,i)=>{
      if(previous&&previous[i]===chord[i])return;
      for(const osc of voice.osc) {
        const frequency=440*2**((chord[i]-69)/12);
        if(at===0)osc.frequency.setValueAtTime(frequency,0);
        else osc.frequency.setTargetAtTime(frequency,at+(i===1?.12/tempo:0),(i===0?.45:.55)/tempo);
      }
    });
    schedule.push({at,chord,section});previous=chord;
  }
  pad.forEach((voice,i)=>{
    voice.gain.gain.setTargetAtTime(.25,0,.75/tempo);
    if(name==='summit'&&i===3) {
      voice.gain.gain.setValueAtTime(.25,82.5);
      voice.gain.gain.linearRampToValueAtTime(0,87.5);
      voice.gain.gain.setValueAtTime(0,127.5);
      voice.gain.gain.linearRampToValueAtTime(.25,133.5);
    }
    for(const osc of voice.osc) {
      voices.add(osc);osc.stop(study.seconds+4);
      osc.addEventListener('ended',()=>{voices.delete(osc);osc.disconnect();},{once:true});
    }
  });
  return {voices,schedule,dispose(){
    phrase.disconnect();for(const voice of pad)voice.gain.disconnect();sound.padVoices=pad;
  }};
}
