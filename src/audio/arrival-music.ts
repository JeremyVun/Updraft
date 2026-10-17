import type { SoundState } from './audio';
import { tuning } from '../tuning';
import { mirrorEnding } from './mirror-seams';

export type ArrivalMusic = 'lines' | 'boats' | 'meadow' | 'birches' | 'stairs' | 'drowned' | 'wood' | 'sleeping' | 'sea' | 'mirror' | 'home';
type Stage = 'wait' | 'none' | 'fade' | 'gap' | 'incoming' | 'blend';
type Background = Pick<SoundState, 'music' | 'hush' | 'seaScore' | 'sleepingScore' | 'meadowScore' | 'birchesScore' | 'stairsSong' | 'linesScore' | 'linesMelodyQuiet' | 'mirrorScore' | 'drownedScore' | 'summitScore' | 'openingScore'>;
const empty = { seaScore: undefined, sleepingScore: undefined, meadowScore: undefined,
  birchesScore: undefined, stairsSong: undefined, linesScore: undefined, linesMelodyQuiet: false, mirrorScore: undefined, drownedScore: undefined, summitScore: undefined, openingScore: undefined };
export const ARRIVAL_MUSIC: Record<ArrivalMusic, Background> = {
  lines: { ...empty, music: 'lines', hush: 0, linesScore: 'first' },
  boats: { ...empty, music: 'boats', hush: .28 },
  // The meadow must still be grey and unawakened before the piano.
  meadow: { ...empty, music: 'meadow', hush: 0 },
  birches: { ...empty, music: 'birches', hush: 0, birchesScore: 'walk' },
  stairs: { ...empty, music: 'birches', hush: 0, stairsSong: true },
  drowned: { ...empty, music: 'drowned', hush: .3, drownedScore: 'drift' },
  wood: { ...empty, music: 'wood', hush: .6 },
  sleeping: { ...empty, music: 'wood', hush: .5, sleepingScore: 'shelter' },
  sea: { ...empty, music: 'sea', hush: 0, seaScore: 'open' },
  mirror: { ...empty, music: 'mirror', hush: .5, mirrorScore: 'approach' },
  home: { ...empty, music: 'home', hush: 0, summitScore: 'approach' },
};
const background = (s: SoundState): Background => ({ music: s.music, hush: s.hush,
  mirrorScore: s.mirrorScore, drownedScore: s.drownedScore, openingScore: s.openingScore,
  seaScore: s.seaScore, sleepingScore: s.sleepingScore, meadowScore: s.meadowScore,
  birchesScore: s.birchesScore, stairsSong: s.stairsSong, linesScore: s.linesScore, linesMelodyQuiet: s.linesMelodyQuiet, summitScore: s.summitScore });

const identity = (s: Background): string => s.openingScore ? 'opening' : s.sleepingScore ? 'sleeping'
  : s.meadowScore ? 'meadow' : s.stairsSong ? 'stairs' : s.birchesScore ? 'birches' : s.linesScore ? 'lines'
  : s.mirrorScore ? 'mirror' : s.drownedScore ? 'drowned' : s.summitScore ? 'summit'
  : s.seaScore ? 'sea' : s.music === 'boats' ? 'boats' : `${s.music}-pad`;

export function arrivalQuiet(target: ArrivalMusic): number {
  return target === 'sleeping' ? tuning.audio.sleepingArrivalQuiet
    : target === 'mirror' ? tuning.audio.mirrorArrivalQuiet : target === 'sea' ? tuning.audio.seaArrivalQuiet : tuning.audio.arrivalQuiet;
}

type ArrivalStep = { background: Background; stage: Stage; changed: boolean; handoffAt: number; legato?: boolean;
  fadeOut?: number; fadeIn?: number; release?: number; homeAt?: number };

/** Uses the audio clock, so the complete pause survives mute/hidden-page suspension. */
export class ArrivalTransition {
  private request?: ArrivalMusic;
  private target?: ArrivalMusic;
  private outgoing?: Background;
  private last?: Background;
  private began = 0;
  private stage: Stage = 'none';
  /** The outgoing recording plays to its own faded end before the rest begins. */
  private held = false;
  /** Leaving the Mirror: when Home begins, and how long the Mirror fades into its chosen seam. */
  private homeAt = Infinity;
  private release?: number;

  private get homeward(): boolean {
    return this.target === 'home' && this.outgoing?.music === 'mirror';
  }

  /** `mirror` is the Sky Mirror recording's playback, if it is sounding. */
  update(s: SoundState, now: number, phraseEnd = now, held = false, mirror?: { position: number; length: number }): ArrivalStep {
    const previous = this.stage;
    const stillRecording = tuning.audio.stillPhraseExperiment && s.stillDeparture;
    let beganNow = false;
    if (s.arrivalMusic && s.arrivalMusic !== this.request) {
      const current=background(s),same=identity(current)===identity(ARRIVAL_MUSIC[s.arrivalMusic]);
      // A restored chapter, or Wood reaching Wood after its storm handoff, has no new tune to introduce.
      if (!this.target && same && (!this.last || identity(this.last)===identity(current))) this.stage='none';
      else {
        this.target = s.arrivalMusic; this.outgoing = this.last ?? current;
        this.held = held && phraseEnd > now;
        if (this.homeward) {
          // Home is scheduled from the moment the boat leaves; the Mirror finishes at a phrase seam before it.
          this.homeAt = now + tuning.audio.homeStartAfter - (s.homewardTime ?? 0);
          const ending = mirror && mirrorEnding(mirror.position, this.homeAt - now, mirror.length);
          this.began = now + (ending ? ending.at : 0); this.release = ending?.release;
        } else {
          // The sea's recording keeps time with the passage, so the morning leaves at once.
          this.began = s.arrivalMusic === 'sea' ? now : Math.max(now, this.held || stillRecording && s.arrivalMusic === 'lines'
            ? phraseEnd : Math.min(phraseEnd, now + tuning.audio.arrivalPhraseWait));
          this.stage = this.began > now ? 'wait' : 'fade';
        }
        beganNow = true;
      }
    }
    this.request = s.arrivalMusic;
    if (this.target) {
      const target = ARRIVAL_MUSIC[this.target];
      const landed = s.music === target.music &&
        (!target.linesScore || !!s.linesScore) && (!target.birchesScore || !!s.birchesScore) && (!target.stairsSong || !!s.stairsSong) &&
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
        const incoming = landed ? background(s) : target;
        if (this.homeward) {
          // The crossing's own clock keeps Home on time through suspended audio; after landing it holds its time.
          if (s.homewardTime !== undefined) this.homeAt = now + tuning.audio.homeStartAfter - s.homewardTime;
          const due = s.homewardTime !== undefined ? s.homewardTime >= tuning.audio.homeStartAfter : now >= this.homeAt;
          this.stage = now < this.began ? 'wait' : !due && previous !== 'incoming' ? 'gap' : 'incoming';
          this.last = this.stage === 'wait' ? this.outgoing! : incoming;
          const step = { background: this.last, stage: this.stage, changed: beganNow || previous !== this.stage,
            handoffAt: this.stage === 'wait' ? this.began : Infinity, release: beganNow ? this.release : undefined, fadeIn: 0, homeAt: this.homeAt };
          if (this.stage === 'incoming' && !s.arrivalMusic && landed) { this.target = undefined; this.stage = 'none'; }
          return step;
        }
        const fadeOut = this.held || stillRecording && this.target === 'lines' ? 0
          : this.outgoing?.sleepingScore ? tuning.audio.sleepingDepartureFade : tuning.audio.arrivalFadeOut;
        const quiet = arrivalQuiet(this.target);
        const fadeIn = this.target === 'sea' ? tuning.audio.seaArrivalFadeIn
          : this.target === 'drowned' ? tuning.audio.villageArrivalFadeIn
          : this.target === 'sleeping' ? tuning.audio.sleepingArrivalFadeIn : tuning.audio.arrivalFadeIn;
        // Retire sources on the first gap update, then give them the full rest even after a stalled frame.
        if ((previous === 'fade' || previous === 'wait') && now - this.began >= fadeOut) {
          this.began = now - fadeOut;
        }
        const elapsed = now - this.began;
        this.stage = elapsed < 0 ? 'wait' : elapsed < fadeOut ? 'fade'
          : elapsed < fadeOut + quiet || (previous !== 'incoming' && s.arrivalReady === false) ? 'gap' : 'incoming';
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
