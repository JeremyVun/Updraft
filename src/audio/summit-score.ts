/** Jeremy's approved three-minute drone, in sections that can follow the real journey home. */
export type SummitScorePhase = 'approach' | 'flight' | 'farewell' | 'home';
export const SUMMIT_STEP = 4.25 / .8;
export const SUMMIT_CHORDS: readonly (readonly number[])[] = [
  [50,57,62,69], [52,59,62,67], [54,57,62,66], [55,59,62,64],
  [55,58,62,64], [54,57,62,66], [52,55,62,67], [45,55,62,69],
  [45,55,62,64], [43,55,62,66], [42,57,62,67], [40,55,62,69],
  [38,54,62,71], [43,59,62,69], [45,55,61,67], [50,57,59,66],
  [47,54,62,66], [45,54,61,64], [43,55,59,62], [43,58,62,64],
  [42,57,62,66], [40,55,59,64], [45,55,62,64], [45,55,61,64],
  [50,57,62,69], [52,59,62,67], [54,57,62,66], [55,59,62,64],
  [55,58,62,64], [54,57,62,66], [45,55,61,64], [50,54,59,62],
];
const order: SummitScorePhase[] = ['approach','flight','farewell','home'];
const dynamics: Record<SummitScorePhase, readonly (readonly [number, number])[]> = {
  // Offshore, play the whole approved piece. A slow crossing must still reach its loved second half.
  approach: [[0,.85],[25,.90],[42.5,.92],[63.75,1.06],[80,1],[90,.65],[105,.58],[122,.64],[127.5,.68],[143,.78],[163,.82],[176,.70]],
  flight: [[0,.92],[21.25,1.06],[37.5,1],[42.5,.825]],
  farewell: [[0,.825],[5,.65],[20,.58],[37,.64],[42.5,.68]],
  home: [[0,.68],[15.5,.78],[35.5,.82],[48.5,.70]],
};
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** Seconds the scripted ending takes to rise from wherever the approach left the music. */
const ENTRY_EASE = 4;
/** The last cadence broadens instead of hurrying (5.1, 5.5, 6 s) and the final chord rings 7 s before the fade. */
export const HOME_ENDING_CHORDS: readonly (readonly [number, readonly number[]])[] = [
  ...Array.from({length:8},(_,i): [number,readonly number[]] => [i*5.25,SUMMIT_CHORDS[8+i]]),
  ...Array.from({length:8},(_,i): [number,readonly number[]] => [41+i*4.25,SUMMIT_CHORDS[16+i]]),
  ...[73.05,78.15,83.25,88.35,93.45,98.55,103.65].map((at,i): [number,readonly number[]] => [at,SUMMIT_CHORDS[24+i]]),
  [109.15,[50,57,61,66]], [115.15,[50,57,62,66]],
];
const endingUpper: readonly (readonly [number, readonly number[]])[] = [
  [0,[69,73]], [93.45,[69,74]], [98.55,[69,73]], [103.65,[67,71]], [109.15,[69,76]],
];
const endingDynamics = [[0,.92],[21,1.06],[40,.825],[46,.65],[61,.58],[70,.64],
  [73.05,.68],[88.35,.78],[98.55,.82],[109.15,.90]];
function smooth(time: number, from: number, to: number): number {
  const x=Math.max(0,Math.min(1,(time-from)/(to-from)));
  return x*x*(3-2*x);
}
function dynamic(phase: SummitScorePhase, time: number): number {
  const keys = dynamics[phase];
  for (let i=1;i<keys.length;i++) if(time<keys[i][0]) {
    const [from,a]=keys[i-1], [to,b]=keys[i]; return a+(b-a)*(time-from)/(to-from);
  }
  return keys[keys.length-1][1];
}

/** Four continuous voices; held notes keep their phase across chords and story changes. */
export class SummitScore {
  private readonly bus: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly voices: {gain: GainNode; oscillators: OscillatorNode[]}[] = [];
  private phase?: SummitScorePhase;
  private epoch=0;
  private key='';
  private chord: readonly number[] = [];
  private stopped=false;
  private remaining=12;
  /** Where the approach left the level and the upper voice, so the scripted ending rises from there. */
  private heard?: {expression: number; upper: number};
  private entry?: {at: number; expression: number; upper: number} | null;

  constructor(private readonly ctx: AudioContext, output: AudioNode) {
    this.bus=ctx.createGain(); this.bus.gain.value=0;
    this.filter=ctx.createBiquadFilter(); this.filter.type='lowpass'; this.filter.Q.value=.3;
    this.filter.frequency.value=1710;
    this.bus.connect(this.filter).connect(output);
    for(let i=0;i<6;i++) {
      const gain=ctx.createGain(); gain.gain.value=0; gain.connect(this.bus);
      const oscillators=[0,1].map(k=>{
        const osc=ctx.createOscillator(); osc.type=k===0?'triangle':'sine'; osc.detune.value=k===0?-6:7;
        osc.connect(gain); osc.start();
        osc.onended=()=>{
          osc.disconnect();
          if(--this.remaining===0) {
            for(const voice of this.voices)voice.gain.disconnect();
            this.bus.disconnect(); this.filter.disconnect();
          }
        };
        return osc;
      });
      if(i<4)gain.gain.setTargetAtTime(.25,ctx.currentTime,.75/.8);
      this.voices.push({gain,oscillators});
    }
  }

  update(phase: SummitScorePhase, level: number, night: number, endingTime?: number): void {
    if(this.stopped)return;
    if(endingTime!==undefined) {this.updateEnding(endingTime,level,night);return;}
    const now=this.ctx.currentTime;
    if(this.phase!==phase) {this.phase=phase;this.epoch=now;this.key='';}
    const elapsed=now-this.epoch, span=phase==='approach'?180:8*SUMMIT_STEP;
    const time=phase==='home'?elapsed:elapsed%span;
    const index=Math.min(phase==='approach'?31:7,Math.floor(time/SUMMIT_STEP));
    const cycle=phase==='home'?0:Math.floor(elapsed/span);
    const key=`${phase}:${cycle}:${index}`;
    if(key!==this.key) {
      const chord=SUMMIT_CHORDS[order.indexOf(phase)*8+index];
      this.voices.slice(0,4).forEach((voice,i)=>{
        if(this.chord[i]===chord[i])return;
        for(const osc of voice.oscillators) {
          const frequency=hz(chord[i]);
          if(!this.chord.length)osc.frequency.setValueAtTime(frequency,now);
          else {
            // Anchor the currently sounding pitch, including a transition interrupted by a story beat.
            osc.frequency.cancelAndHoldAtTime(now); osc.frequency.setValueAtTime(osc.frequency.value,now);
            osc.frequency.setTargetAtTime(frequency,now+(i===1?.12/.8:0),(i===0?.45:.55)/.8);
          }
        }
      });
      this.chord=chord;this.key=key;
    }
    const upper=phase==='approach'
      ? time<82.5?1:time<87.5?1-(time-82.5)/5:time<127.5?0:Math.min(1,(time-127.5)/6)
      : phase==='farewell'?0:1;
    this.voices[3].gain.gain.setTargetAtTime(upper*.25,now,phase==='approach'?(time<82.5?.75/.8:.1):phase==='farewell'?.8:1.5);
    this.heard={expression:dynamic(phase,time),upper:upper*.25};
    // Approved balance, without export normalization. Chapter hush and cue ducking still own their space.
    this.bus.gain.setTargetAtTime(level*dynamic(phase,time),now,.65);
    this.filter.frequency.setTargetAtTime(1710-200*night,now,2.5);
  }

  private updateEnding(time: number, level: number, night: number): void {
    const now=this.ctx.currentTime;
    let base=0,upper=0;
    while(base+1<HOME_ENDING_CHORDS.length&&time>=HOME_ENDING_CHORDS[base+1][0])base++;
    while(upper+1<endingUpper.length&&time>=endingUpper[upper+1][0])upper++;
    const key=`ending:${base}:${upper}`;
    if(key!==this.key) {
      const chord=[...HOME_ENDING_CHORDS[base][1],...endingUpper[upper][1]];
      this.voices.forEach((voice,i)=>{
        if(this.chord[i]===chord[i])return;
        for(const osc of voice.oscillators) {
          if(!this.chord.length)osc.frequency.setValueAtTime(hz(chord[i]),now);
          else {
            osc.frequency.cancelAndHoldAtTime(now);
            osc.frequency.setValueAtTime(osc.frequency.value,now);
            osc.frequency.setTargetAtTime(hz(chord[i]),now+(i===1?.15:0),i===0?.5625:.6875);
          }
        }
      });
      this.chord=chord;this.key=key;
    }
    const thinning=1-smooth(time,41,44)+smooth(time,73.05,79.05);
    // A resumed save has no approach to rise from.
    if(this.entry===undefined)this.entry=this.heard?{at:time,...this.heard}:null;
    const entry=this.entry,settle=entry?smooth(time,entry.at,entry.at+ENTRY_EASE):1;
    const upperGain=.25*thinning;
    this.voices[3].gain.gain.setTargetAtTime(entry?entry.upper+(upperGain-entry.upper)*settle:upperGain,now,.3);
    for(let i=4;i<6;i++)this.voices[i].gain.gain.setTargetAtTime(time<86?0:time<103.65?.055:.085,now,2.4);
    let expression=endingDynamics[endingDynamics.length-1][1];
    for(let i=1;i<endingDynamics.length;i++)if(time<endingDynamics[i][0]) {
      const [from,a]=endingDynamics[i-1],[to,b]=endingDynamics[i];
      expression=a+(b-a)*smooth(time,from,to);break;
    }
    if(entry)expression=entry.expression+(expression-entry.expression)*settle;
    this.bus.gain.setTargetAtTime(level*expression,now,.3);
    this.filter.frequency.setTargetAtTime(1710-200*night,now,2.5);
  }

  chordAt(): readonly number[] {return this.chord.length?this.chord:SUMMIT_CHORDS[0];}
  handoffAt(now: number): number {return now;}
  stop(fade=1.8): void {
    if(this.stopped)return;this.stopped=true;
    const now=this.ctx.currentTime;
    this.bus.gain.cancelAndHoldAtTime(now);this.bus.gain.setValueAtTime(this.bus.gain.value,now);
    this.bus.gain.linearRampToValueAtTime(0,now+fade);
    for(const voice of this.voices)for(const osc of voice.oscillators)osc.stop(now+fade+.03);
  }
}
