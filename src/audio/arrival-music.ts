import type { SoundState } from './audio';
import { tuning } from '../tuning';

export type ArrivalMusic = 'lines' | 'boats' | 'meadow' | 'birches' | 'drowned' | 'wood' | 'sleeping' | 'sea' | 'mirror' | 'home';
type Stage = 'wait' | 'none' | 'fade' | 'gap' | 'incoming' | 'blend';
type Background = Pick<SoundState, 'music' | 'hush' | 'seaScore' | 'sleepingScore' | 'meadowScore' | 'birchesScore' | 'linesScore' | 'linesMelodyQuiet' | 'mirrorScore' | 'drownedScore' | 'summitScore' | 'openingScore'>;
const empty = { seaScore: undefined, sleepingScore: undefined, meadowScore: undefined,
  birchesScore: undefined, linesScore: undefined, linesMelodyQuiet: false, mirrorScore: undefined, drownedScore: undefined, summitScore: undefined, openingScore: undefined };
export const ARRIVAL_MUSIC: Record<ArrivalMusic, Background> = {
  lines: { ...empty, music: 'lines', hush: 0, linesScore: 'first' },
  boats: { ...empty, music: 'boats', hush: .28 },
  // The meadow must still be grey and unawakened before the piano.
  meadow: { ...empty, music: 'meadow', hush: 0 },
  birches: { ...empty, music: 'birches', hush: 0, birchesScore: 'walk' },
  drowned: { ...empty, music: 'drowned', hush: .3, drownedScore: 'rooftops' },
  wood: { ...empty, music: 'wood', hush: .6 },
  sleeping: { ...empty, music: 'wood', hush: .5, sleepingScore: 'shelter' },
  sea: { ...empty, music: 'sea', hush: 0, seaScore: 'open' },
  mirror: { ...empty, music: 'mirror', hush: .5, mirrorScore: 'approach' },
  home: { ...empty, music: 'home', hush: 0, summitScore: 'approach' },
};
const background = (s: SoundState): Background => ({ music: s.music, hush: s.hush,
  mirrorScore: s.mirrorScore, drownedScore: s.drownedScore, openingScore: s.openingScore,
  seaScore: s.seaScore, sleepingScore: s.sleepingScore, meadowScore: s.meadowScore,
  birchesScore: s.birchesScore, linesScore: s.linesScore, linesMelodyQuiet: s.linesMelodyQuiet, summitScore: s.summitScore });

const identity = (s: Background): string => s.openingScore ? 'opening' : s.sleepingScore ? 'sleeping'
  : s.meadowScore ? 'meadow' : s.birchesScore ? 'birches' : s.linesScore ? 'lines'
  : s.mirrorScore ? 'mirror' : s.drownedScore ? 'drowned' : s.summitScore ? 'summit'
  : s.seaScore ? 'sea' : s.music === 'boats' ? 'boats' : `${s.music}-pad`;

export function arrivalQuiet(target: ArrivalMusic, homeward = false): number {
  return homeward ? tuning.audio.homewardQuiet : target === 'sleeping' ? tuning.audio.sleepingArrivalQuiet
    : target === 'mirror' ? tuning.audio.mirrorArrivalQuiet : tuning.audio.arrivalQuiet;
}

/** Uses the audio clock, so the complete pause survives mute/hidden-page suspension. */
export class ArrivalTransition {
  private request?: ArrivalMusic;
  private target?: ArrivalMusic;
  private outgoing?: Background;
  private last?: Background;
  private began = 0;
  private stage: Stage = 'none';

  update(s: SoundState, now: number, phraseEnd = now): { background: Background; stage: Stage; changed: boolean; handoffAt: number; legato?: boolean; fadeOut?: number; fadeIn?: number } {
    const previous = this.stage;
    let beganNow = false;
    if (s.arrivalMusic && s.arrivalMusic !== this.request) {
      const current=background(s),same=identity(current)===identity(ARRIVAL_MUSIC[s.arrivalMusic]);
      // A restored chapter, or Wood reaching Wood after its storm handoff, has no new tune to introduce.
      if (!this.target && same && (!this.last || identity(this.last)===identity(current))) this.stage='none';
      else {
        this.target = s.arrivalMusic; this.outgoing = this.last ?? current;
        this.began = Math.max(now, Math.min(phraseEnd, now + tuning.audio.arrivalPhraseWait));
        this.stage = this.began > now ? 'wait' : 'fade';
        beganNow = true;
      }
    }
    this.request = s.arrivalMusic;
    if (this.target) {
      const target = ARRIVAL_MUSIC[this.target];
      const landed = s.music === target.music &&
        (!target.linesScore || !!s.linesScore) && (!target.birchesScore || !!s.birchesScore) &&
        (!target.mirrorScore || !!s.mirrorScore) && (!target.drownedScore || !!s.drownedScore) &&
        (!target.sleepingScore || !!s.sleepingScore) && (!target.summitScore || !!s.summitScore) &&
        (!target.seaScore || !!s.seaScore && !s.sleepingScore);
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
        // Home begins after the mirror is astern: clear the outgoing reverb, then keep five full seconds.
        const homeward = this.target === 'home' && this.outgoing?.music === 'mirror';
        const fadeOut = homeward ? tuning.audio.homewardFadeOut : tuning.audio.arrivalFadeOut;
        const quiet = arrivalQuiet(this.target, homeward);
        const fadeIn = homeward ? tuning.audio.homewardFadeIn : tuning.audio.arrivalFadeIn;
        // Retire sources on the first gap update, then give them the full rest even after a stalled frame.
        if ((previous === 'fade' || previous === 'wait') && now - this.began >= fadeOut) {
          this.began = now - fadeOut;
        }
        const elapsed = now - this.began;
        this.stage = elapsed < 0 ? 'wait' : elapsed < fadeOut ? 'fade'
          : elapsed < fadeOut + quiet || (previous !== 'incoming' && (homeward ? s.homewardReady === false : s.arrivalReady === false)) ? 'gap' : 'incoming';
        const incoming = landed ? background(s) : target;
        this.last = (this.stage === 'fade' || this.stage === 'wait') ? this.outgoing! : incoming;
        if (this.stage === 'incoming' && !s.arrivalMusic && landed && elapsed >= fadeOut + quiet + fadeIn) {
          this.target = undefined; this.stage = 'none';
          // A stalled frame may land after the entire incoming fade: reopen a gate still held at zero.
          return { background: this.last, stage: 'none', changed: previous !== 'incoming', handoffAt: Infinity, fadeOut, fadeIn };
        }
        return { background: this.last,
          stage: this.stage, changed: beganNow || previous !== this.stage, handoffAt: this.stage === 'wait' ? this.began : Infinity, fadeOut, fadeIn };
      }
    }
    this.last = background(s);
    return { background: this.last, stage: 'none', changed: previous !== 'none', handoffAt: Infinity };
  }
}
