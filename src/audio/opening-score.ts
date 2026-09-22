import { tuning } from '../tuning';
/** Approved opening, including the held D/F# resolution before the returning motif. */
export const OPENING_STEP = 4.25 / .8;
export const OPENING_SECONDS = 180 + OPENING_STEP;
export const OPENING_CHORDS: readonly (readonly number[])[] = [
  [50,57,62,69], [52,59,62,67], [54,57,62,66], [55,59,62,64],
  [55,58,62,64], [53,57,62,65], [52,55,61,64], [45,57,62,64],
  [45,55,62,64], [43,57,62,66], [42,57,62,67], [41,57,62,69],
  [40,55,62,67], [39,58,62,65], [38,57,62,65], [43,58,62,64],
  [42,57,62,66], // 1:25: let Gm6 resolve before the motif returns.
  [47,54,62,66], [49,55,62,67], [50,57,62,66], [52,55,59,64],
  [54,57,62,66], [55,59,62,69], [54,57,62,67], [53,57,62,65],
  [50,57,62,69], [52,58,62,67], [53,57,62,65], [55,58,62,64],
  [46,53,57,62], [45,52,57,64], [45,55,62,64], [50,57,62,64],
];
export const OPENING_DYNAMICS: readonly (readonly [number,number])[] = [
  [0,1],[25,1],[42.5,.88],[63.75,.90],[85,1],[90.3125,1],[111.5625,1],
  [132.8125,.92],[154.0625,.84],[174.3125,.82],[181.3125,.78],
];
type PadVoice = {osc: OscillatorNode[];gain: GainNode};
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Conducts the original pad: no second instrument, extra oscillators or independent life/hush mix. */
export class OpeningScore {
  readonly epoch: number;
  private chord: readonly number[] = [];
  private stoppedAt?: number;

  constructor(private readonly ctx: AudioContext,private readonly voices: PadVoice[]) {
    this.epoch=ctx.currentTime;
    for(const voice of voices) {
      voice.gain.gain.cancelAndHoldAtTime(this.epoch);
      voice.gain.gain.setTargetAtTime(.25,this.epoch,.75/.8);
    }
  }

  private position(at: number): number {return Math.max(0,(this.stoppedAt??at)-this.epoch)%OPENING_SECONDS;}

  chordAt(at: number): readonly number[] {
    return OPENING_CHORDS[Math.min(OPENING_CHORDS.length-1,Math.floor(this.position(at)/OPENING_STEP))];
  }

  gainAt(at: number): number {
    const time=this.position(at);
    for(let i=1;i<OPENING_DYNAMICS.length;i++) if(time<OPENING_DYNAMICS[i][0]) {
      const [from,a]=OPENING_DYNAMICS[i-1],[to,b]=OPENING_DYNAMICS[i];
      return a+(b-a)*(time-from)/(to-from);
    }
    return OPENING_DYNAMICS[OPENING_DYNAMICS.length-1][1];
  }

  update(): void {
    if(this.stoppedAt!==undefined)return;
    const now=this.ctx.currentTime,chord=this.chordAt(now);
    this.voices.forEach((voice,i)=>{
      if(this.chord[i]===chord[i])return;
      for(const osc of voice.osc) {
        osc.frequency.cancelAndHoldAtTime(now);
        if(!this.chord.length)osc.frequency.setValueAtTime(hz(chord[i]),now);
        else osc.frequency.setTargetAtTime(hz(chord[i]),now+(i===1?.12/.8:0),(i===0?.45:.55)/.8);
      }
    });
    this.chord=chord;
  }

  handoffAt(now: number): number {
    const position=this.position(now),index=Math.min(OPENING_CHORDS.length-1,Math.floor(position/OPENING_STEP));
    // Let the existing voices arrive before fading; never invent a cadence or stop halfway through a glide.
    return Math.max(now,now-position+index*OPENING_STEP+tuning.audio.openingHandoffSettle);
  }
  // Arrival's shared gate owns the fade. Keep the last chord until the shared pad changes rooms.
  stop(_fade?: number): void {this.stoppedAt??=this.ctx.currentTime;}
}
