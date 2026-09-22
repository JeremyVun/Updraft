// Twenty-second opening question: hear one contrapuntal phrase before developing a whole island.
// Actual production drone oscillators; no piano, chimes or new instrument.
export const studies = {opening: {
  mood:'still',seconds:20,usesProductionPad:true,preserveIntro:false,fadeOut:1.6,
  intent:'A falls through G and F-sharp to E as the bass climbs D–E–F-sharp–G. An inner D is held. A final B-flat leaves the question tender and unfinished.',
  chords:[
    [0,4.25,[50,57,62,69],'D5: the question begins'],
    [4.25,4.25,[52,59,62,67],'Em7: bass rises, upper voice falls'],
    [8.5,4.25,[54,57,62,66],'D/F#: a brief consonant meeting'],
    [12.75,4.25,[55,59,62,64],'G6: the lines draw closer'],
    [17,3,[55,58,62,64],'Gm6: B lowers to B-flat; no final home chord'],
  ],
}};

export function studyState(name,t,base) {
  return {...base,music:'still',startingIsland:true,life:.1+Math.min(t,20)/48,
    night:0,hush:0,gust:0,breeze:0,sea:0,land:1,meadow:0,flockChatter:false,cues:[]};
}

export function scheduleStudy(name,ctx,sound) {
  const pad=sound.padVoices,voices=new Set(),schedule=[];
  sound.padVoices=[];
  let previous;
  for(const [at,,chord,meaning] of studies.opening.chords) {
    pad.forEach((voice,i)=>{
      if(previous&&previous[i]===chord[i])return;
      for(const osc of voice.osc) {
        const f=440*2**((chord[i]-69)/12);
        // The first chord is present at entrance; subsequent notes remain connected by a soft glide.
        if(at===0)osc.frequency.setValueAtTime(f,0);
        else osc.frequency.setTargetAtTime(f,at+(i===1?.12:0),i===0?.45:.55);
      }
    });
    schedule.push({at,chord,meaning});previous=chord;
  }
  for(const voice of pad) {
    voice.gain.gain.setTargetAtTime(.25,0,.75);
    for(const osc of voice.osc) {
      voices.add(osc);osc.stop(24);
      osc.addEventListener('ended',()=>{voices.delete(osc);osc.disconnect();},{once:true});
    }
  }
  return {voices,schedule,dispose(){for(const voice of pad)voice.gain.disconnect();sound.padVoices=pad;}};
}
