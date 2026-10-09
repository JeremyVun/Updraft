import { DREAM_NOTES, DREAM_PALETTE, DREAM_HARMONY, type DreamNote } from './dream-score-data';
import { phrasePosition, phraseHandoff, schedulePhrase, type Phrase } from './phrasing';
import { tuning } from '../tuning';

export type MirrorScorePhase = 'approach' | 'search' | 'one' | 'two' | 'three' | 'constellation' | 'depart';
interface Section extends Phrase<DreamNote> { chords: { at: number; tones: readonly number[] }[] }

function section(from: number, to: number, seconds = to - from): Section {
  const notes = DREAM_NOTES.filter(n => n.at >= from && n.at < to && n.role !== 'star')
    .map(n => ({ ...n, at: n.at - from }));
  // Held accompaniment crosses a story boundary even when that boundary falls between authored notes.
  for (const n of DREAM_NOTES) if (n.at < from && n.at + n.duration > from && ['harmony','weather'].includes(n.role)) {
    const patch = DREAM_PALETTE[n.voice];
    notes.push({ ...n, at: 0, level: n.level * .65,
      duration: Math.max(n.at + n.duration - from, patch.attack + patch.release + .3) });
  }
  if (!notes.some(n => n.role === 'harmony' && n.at < .25)) {
    const tones = [...DREAM_HARMONY].reverse().find(([at]) => at <= from)![1];
    tones.forEach((midi,i) => notes.push({ voice: 'halo',
      at: i*.045, midi, duration: seconds+2, level: .007,
      pan: (i-1.5)*.18, role: 'harmony' }));
  }
  // Repeated bodies need sustained harmony through the join; melody and intentional low dynamics stay intact.
  for (const n of notes) if (n.role === 'harmony') {
    const next = notes.filter(x => x.role === 'harmony' && x.at > n.at+.25).sort((a,b)=>a.at-b.at)[0]?.at ?? seconds;
    n.duration = Math.max(n.duration, next-n.at+2);
  }
  notes.sort((a,b)=>a.at-b.at);
  let melody = 0;
  const sparse = notes.filter(n => n.role !== 'melody' || melody++ % 2 === 0)
    .map(n => n.role === 'melody' ? {...n,level:n.level*.85} : n);
  const chords = [{ at: 0, tones: [...DREAM_HARMONY].reverse().find(([at])=>at<=from)![1] },
    ...DREAM_HARMONY.filter(([at])=>at>from&&at<to).map(([at,tones])=>({at:at-from,tones}))];
  // Intros leave room for cues only once. Subsequent cycles begin with accompaniment immediately.
  return {seconds, notes, variants:[notes,sparse,notes], chords};
}
export const DREAM_SECTIONS: Record<MirrorScorePhase, Section> = {
  approach: section(0,16), search: section(16,36), one: section(36,56),
  two: section(56,76), three: section(56,76), constellation: section(76,84), depart: section(84,100,18),
};
interface Part {
  phase: MirrorScorePhase; bus: GainNode; echo: GainNode | null; echoes: AudioNode[];
  epoch: number; cycle: number; next: number; stopped: boolean;
  voices: Set<OscillatorNode>; cleanup: OscillatorNode | null;
}

/** The Sky Mirror's approved notes and instruments, with independent phrase clocks following actual story progress. */
export class DreamScore {
  private readonly bus: GainNode;
  private readonly parts = new Set<Part>();
  private current: Part | null = null;
  private stopped = false;
  constructor(private readonly ctx: AudioContext, output: AudioNode) {
    this.bus=ctx.createGain();this.bus.gain.value=0;this.bus.connect(output);
  }
  chordAt(when: number): readonly number[] {
    const pattern=DREAM_SECTIONS[this.current?.phase ?? 'approach'];
    const position=this.current?phrasePosition(pattern,this.current.epoch,when):0;
    return [...pattern.chords].reverse().find(c=>c.at<=position)!.tones;
  }
  update(phase: MirrorScorePhase, level: number, until=Infinity): void {
    if(this.stopped)return;
    const now=this.ctx.currentTime,section=DREAM_SECTIONS[phase],fade=tuning.audio.dreamPhaseFade;
    this.bus.gain.setTargetAtTime(level,now,.8);
    if(this.current?.phase!==phase) {
      if(this.current)this.release(this.current,fade);
      const bus=this.ctx.createGain();bus.gain.value=0;bus.connect(this.bus);
      // Explicit anchor prevents a ramp from starting at audio-context creation.
      bus.gain.cancelScheduledValues(now);bus.gain.setValueAtTime(0,now);
      bus.gain.linearRampToValueAtTime(1,now+fade);
      const part: Part={phase,bus,echo:this.ctx.createGain(),echoes:[],epoch:now+.08,cycle:0,next:0,stopped:false,voices:new Set(),cleanup:null};
      for(const [seconds,level,position] of [[.73,.20,.48],[1.47,.115,-.42],[2.21,.065,.3]]) {
        const delay=this.ctx.createDelay(3),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain(),pan=this.ctx.createStereoPanner();
        delay.delayTime.value=seconds;filter.type='lowpass';filter.frequency.value=1900;filter.Q.value=.4;
        gain.gain.value=level;pan.pan.value=position;
        part.echo!.connect(delay).connect(filter).connect(gain).connect(pan).connect(bus);
        part.echoes.push(delay,filter,gain,pan);
      }
      this.current=part;this.parts.add(part);
    }
    const part=this.current;
    schedulePhrase(part,section,now,(note,at)=>this.play(part,note,at),until);
  }
  /** Only the chapter's real success event calls this; phase entry/checkpoint restore never does. */
  bloom(): void {
    if(this.stopped||!this.current)return;
    const from=this.current.phase==='one'?36:['two','three'].includes(this.current.phase)?56:76;
    for(const note of DREAM_NOTES.filter(n=>n.role==='star'&&n.at>=from&&n.at<from+4))
      this.play(this.current,note,this.ctx.currentTime+.02+note.at-from);
  }
  handoffAt(now:number):number {return this.current?phraseHandoff(DREAM_SECTIONS[this.current.phase],this.current.epoch,now):now;}
  stop(fade=tuning.audio.dreamPhaseFade):void {
    if(this.stopped)return;this.stopped=true;
    for(const part of this.parts)this.release(part,fade);
    if(!this.parts.size)this.bus.disconnect();
  }
  private release(part:Part,fade:number):void {
    // A departure may shorten an already-retiring phase, including its delay output.
    const now=this.ctx.currentTime;part.stopped=true;
    part.bus.gain.cancelAndHoldAtTime(now);part.bus.gain.setValueAtTime(part.bus.gain.value,now);
    part.bus.gain.linearRampToValueAtTime(0,now+fade);
    for(const source of part.voices)source.stop(now+fade);
    if(part.cleanup)part.cleanup.stop(now+fade+.025);
    else {
      // An audio-clock sentinel also releases echo-only parts while playback is suspended/resumed.
      const timer=this.ctx.createOscillator(),silent=this.ctx.createGain();silent.gain.value=0;
      timer.connect(silent).connect(part.bus);timer.start(now);timer.stop(now+fade+.025);part.cleanup=timer;
      timer.onended=()=>{timer.disconnect();silent.disconnect();part.echo?.disconnect();
        for(const node of part.echoes)node.disconnect();part.bus.disconnect();this.parts.delete(part);
        if(this.stopped&&!this.parts.size)this.bus.disconnect();};
    }
  }
  private play(part:Part,n:DreamNote,at:number):void {
    const ctx=this.ctx,patch=DREAM_PALETTE[n.voice],end=at+n.duration,release=patch.release;
    const pan=ctx.createStereoPanner();pan.pan.value=n.pan;pan.connect(part.bus);
    if(part.echo&&['starlight','bloom','reflection'].includes(n.voice))pan.connect(part.echo);
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.45;filter.frequency.value=patch.cutoff;filter.connect(pan);
    const env=ctx.createGain();env.connect(filter);env.gain.setValueAtTime(0,at);
    env.gain.setValueCurveAtTime(new Float32Array([0,.038,.146,.309,.5,.691,.854,.962,1]).map(v=>v*n.level),at,patch.attack);
    if(['glass','reflection','felt','starlight'].includes(n.voice))env.gain.exponentialRampToValueAtTime(n.level*.24,end-release);
    else env.gain.linearRampToValueAtTime(n.level*.84,end-release);
    env.gain.linearRampToValueAtTime(0,end);
    let left=patch.partials.length;
    const lfo=patch.vibrato?ctx.createOscillator():null,depth=lfo?ctx.createGain():null;
    if(lfo&&depth){lfo.frequency.value=.13+(n.midi%5)*.019;depth.gain.value=patch.vibrato;lfo.connect(depth);lfo.start(at);lfo.stop(end+.01);part.voices.add(lfo);}
    for(const [ratio,level] of patch.partials){
      const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.value=440*2**((n.midi-69)/12)*ratio;
      g.gain.value=level;osc.connect(g).connect(env);depth?.connect(osc.detune);part.voices.add(osc);
      osc.start(at);osc.stop(end+.015);osc.onended=()=>{part.voices.delete(osc);osc.disconnect();g.disconnect();
        if(--left===0){env.disconnect();filter.disconnect();pan.disconnect();lfo?.disconnect();depth?.disconnect();if(lfo)part.voices.delete(lfo);}};
    }
  }
}
