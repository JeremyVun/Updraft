import type { SoundState } from './audio';
import { tuning } from '../tuning';

export type ArrivalMusic = 'lines' | 'boats' | 'meadow' | 'birches' | 'drowned' | 'wood' | 'sleeping' | 'mirror' | 'home';
type Stage = 'wait' | 'none' | 'fade' | 'gap' | 'incoming' | 'blend';
type Background = Pick<SoundState, 'music' | 'hush' | 'seaScore' | 'sleepingScore' | 'meadowScore' | 'birchesScore' | 'linesScore' | 'linesMelodyQuiet' | 'mirrorScore' | 'drownedScore'>;
const empty = { seaScore: undefined, sleepingScore: undefined, meadowScore: undefined,
  birchesScore: undefined, linesScore: undefined, linesMelodyQuiet: false, mirrorScore: undefined, drownedScore: undefined };
export const ARRIVAL_MUSIC: Record<ArrivalMusic, Background> = {
  lines: { ...empty, music: 'lines', hush: 0, linesScore: 'first' },
  boats: { ...empty, music: 'boats', hush: .28 },
  // The meadow must still be grey and unawakened before the piano.
  meadow: { ...empty, music: 'meadow', hush: 0 },
  birches: { ...empty, music: 'birches', hush: 0, birchesScore: 'walk' },
  drowned: { ...empty, music: 'drowned', hush: .3, drownedScore: 'rooftops' },
  wood: { ...empty, music: 'wood', hush: .6 },
  sleeping: { ...empty, music: 'wood', hush: .5, sleepingScore: 'shelter' },
  mirror: { ...empty, music: 'mirror', hush: .5, mirrorScore: 'approach' },
  home: { ...empty, music: 'home', hush: 0 },
};
const background = (s: SoundState): Background => ({ music: s.music, hush: s.hush,
  mirrorScore: s.mirrorScore, drownedScore: s.drownedScore,
  seaScore: s.seaScore, sleepingScore: s.sleepingScore, meadowScore: s.meadowScore,
  birchesScore: s.birchesScore, linesScore: s.linesScore, linesMelodyQuiet: s.linesMelodyQuiet });

/** Uses the audio clock, so the complete pause survives mute/hidden-page suspension. */
export class ArrivalTransition {
  private request?: ArrivalMusic;
  private target?: ArrivalMusic;
  private outgoing?: Background;
  private last?: Background;
  private began = 0;
  private stage: Stage = 'none';

  update(s: SoundState, now: number, phraseEnd = now): { background: Background; stage: Stage; changed: boolean; handoffAt: number; legato?: boolean } {
    const previous = this.stage;
    let beganNow = false;
    if (s.arrivalMusic && s.arrivalMusic !== this.request) {
      this.target = s.arrivalMusic; this.outgoing = this.last ?? background(s);
      this.began = Math.max(now, Math.min(phraseEnd, now + tuning.audio.arrivalPhraseWait));
      this.stage = this.began > now ? 'wait' : 'fade';
      beganNow = true;
    }
    this.request = s.arrivalMusic;
    if (this.target) {
      const target = ARRIVAL_MUSIC[this.target];
      const landed = s.music === target.music &&
        (!target.linesScore || !!s.linesScore) && (!target.birchesScore || !!s.birchesScore) &&
        (!target.mirrorScore || !!s.mirrorScore) && (!target.drownedScore || !!s.drownedScore) &&
        (!target.sleepingScore || !!s.sleepingScore);
      if (s.silence || (!s.arrivalMusic && !landed)) {
        // A debug jump or a different chapter must not inherit another island's pause.
        this.target = undefined; this.stage = 'none';
      } else {
        // One storm continues from the village into the wood: overlap their backgrounds without
        // closing the common gate or clearing the reverberation. Other arrivals keep their short breath.
        if(this.target==='wood' && this.outgoing?.music==='drowned') {
          const elapsed=now-this.began;
          this.stage=elapsed<0?'wait':'blend';
          this.last=elapsed<0?this.outgoing:landed?background(s):target;
          if(elapsed>=tuning.audio.forestMusicBlend && !s.arrivalMusic && landed) {
            this.target=undefined;this.stage='none';
          }
          return {background:this.last,stage:this.stage,changed:beganNow||previous!==this.stage,
            handoffAt:elapsed<0?this.began:Infinity,legato:true};
        }
        // Retire sources on the first gap update, then give them the full rest even after a stalled frame.
        if ((previous === 'fade' || previous === 'wait') && now - this.began >= tuning.audio.arrivalFadeOut) {
          this.began = now - tuning.audio.arrivalFadeOut;
        }
        const elapsed = now - this.began;
        this.stage = elapsed < 0 ? 'wait' : elapsed < tuning.audio.arrivalFadeOut ? 'fade'
          : elapsed < tuning.audio.arrivalFadeOut + tuning.audio.arrivalQuiet ? 'gap' : 'incoming';
        const incoming = landed ? background(s) : target;
        this.last = (this.stage === 'fade' || this.stage === 'wait') ? this.outgoing! : incoming;
        if (!s.arrivalMusic && landed && elapsed >= tuning.audio.arrivalFadeOut + tuning.audio.arrivalQuiet + tuning.audio.arrivalFadeIn) {
          this.target = undefined; this.stage = 'none';
          // A stalled frame may land after the entire incoming fade: reopen a gate still held at zero.
          return { background: this.last, stage: 'none', changed: previous !== 'incoming', handoffAt: Infinity };
        }
        return { background: this.last,
          stage: this.stage, changed: beganNow || previous !== this.stage, handoffAt: this.stage === 'wait' ? this.began : Infinity };
      }
    }
    this.last = background(s);
    return { background: this.last, stage: 'none', changed: previous !== 'none', handoffAt: Infinity };
  }
}
