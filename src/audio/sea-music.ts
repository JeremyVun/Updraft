import { PhraseClips, type Clip } from './phrase-clips';

/**
 * Cut points in the supplied `sea.ogg` ("Another Shore"), each just before an attack. The crossing runs from the top
 * to the near-silent break before the bass enters, as the boat comes to rest. The rescue's bed is what follows it in
 * the recording: the bass section's four two-bar phrases, unhurried piano over the bass (F♯ major, then turning to its
 * A and G colours and back), before the section thickens. The release is the close's theme from 2:39, through its
 * eight bars to their resolution on F♯, before the recording thickens and turns tinny from 3:08.
 */
export const SEA_CROSSING_END = 56.43;
/** Where each of the bed's phrases begins, and where the last ends. */
export const SEA_BED = [56.43, 63.78, 70.93, 77.69, 85.24] as const;
export const SEA_RELEASE = { from: 159.47, to: 188.27, fade: 1.67 } as const;
/** A phrase that goes on somewhere other than its own continuation eases off over its last this long (s). */
export const SEA_SEAM_FADE = 0.35;
/** How far ahead of a phrase's end the next is chosen and scheduled (s). */
const DECIDE = 0.8;
/** Coming to rest before the rescue begins, the crossing fades into the break over its last this long (s). */
const CROSSING_FADE = 0.3;

/**
 * Where the rescue is, for the music: coming in and resting in the quiet, under way from the net first lifting, the
 * last loop being pulled off and the whale free, gone.
 */
export type SeaRescue = 'coming' | 'rescue' | 'freeing' | 'gone';

type Placed = { clip: Clip; part: 'crossing' | 'bed' | 'release'; phrase: number; end: number };

/**
 * The open sea's recording, as one passage from the crossing to the whale's farewell. The crossing plays on the
 * passage clock into the quiet break as the boat comes to rest; the bed enters, as the bass does in the recording, when
 * the net over the blowhole first lifts (carried straight on from the crossing if that comes before the break), plays
 * its four phrases and goes round again, at the end of its last phrase, for as long as the rescue takes. Once it is being freed the bed
 * finishes the phrase it is in and the release follows at that phrase's end, resolving and ending before the recording
 * turns tinny. Nothing is ever cut mid-phrase and nothing fires on an act.
 */
export class SeaMusic extends PhraseClips {
  private crossingTried = false;
  private levelled = false;
  private last: Placed | null = null;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    super(ctx, SeaMusic.bus(ctx, output), 'sea');
  }

  private static bus(ctx: BaseAudioContext, output: AudioNode): GainNode {
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(output);
    return bus;
  }

  /** `time` is recording time on the passage clock (negative before it begins); `rescue` where the rescue is. */
  update(time: number, rescue: SeaRescue, level: number): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime, bus = (this.output as GainNode).gain;
    if (!this.levelled) bus.setValueAtTime(level, now);
    else bus.setTargetAtTime(level, now, .25);
    this.levelled = true;
    if (!this.buffer) return;
    if (!this.crossingTried && time >= 0) {
      this.crossingTried = true;
      // Within a frame or two of its start it begins from the top; a later start joins the passage's own time.
      const from = time < .1 ? 0 : time;
      if (from < SEA_CROSSING_END - 1 && rescue === 'coming') this.place('crossing', 0, from, SEA_CROSSING_END, now, from ? .5 : .01, CROSSING_FADE);
    }
    const last = this.last, sounding = last && this.voices.has(last.clip) && !last.clip.finishing;
    if (last?.part === 'release' || rescue === 'coming') return;
    if (!last) {
      if (rescue === 'freeing') this.letGo(now);
      else if (rescue === 'rescue') this.bed(0, now);
    } else if (!sounding) this.follow(last, rescue, now, false);
    else if (last.end - now <= DECIDE) this.follow(last, rescue, last.end, true);
  }

  /** What comes after `last` at `at`: the bed's next phrase, round to its first again, or the release once it is let go. */
  private follow(last: Placed, rescue: SeaRescue, at: number, eased: boolean): void {
    if (rescue === 'freeing' || rescue === 'gone') {
      if (eased) this.seam(last);
      this.letGo(at);
    } else if (last.part === 'crossing') {
      // Begun before the break: the crossing carries straight on into the bed, as the recording does.
      if (eased) last.clip.gain.gain.cancelScheduledValues(Math.max(this.ctx.currentTime, last.end - CROSSING_FADE - 1e-3));
      this.bed(0, at);
    }
    else if (last.phrase + 2 < SEA_BED.length) this.bed(last.phrase + 1, at);
    else {
      if (eased) this.seam(last);
      this.bed(0, at);
    }
  }

  private bed(phrase: number, at: number): void {
    this.place('bed', phrase, SEA_BED[phrase], SEA_BED[phrase + 1], at, .01);
  }

  private letGo(at: number): void {
    const { from, to, fade } = SEA_RELEASE;
    this.place('release', 0, from, to, at, .01, fade);
  }

  /** Not carried straight on: its last moment eases off before the next phrase's attack. */
  private seam(placed: Placed): void {
    const gain = placed.clip.gain.gain, from = Math.max(this.ctx.currentTime, placed.end - SEA_SEAM_FADE);
    gain.cancelScheduledValues(from);
    gain.setValueAtTime(1, from);
    gain.linearRampToValueAtTime(0, placed.end);
  }

  private place(part: Placed['part'], phrase: number, from: number, to: number, at: number, fadeIn: number, fade = 0): void {
    const clip = this.play(from, to, 1, fade, at, fadeIn);
    if (clip) this.last = { clip, part, phrase, end: at + Math.min(to, this.buffer!.duration) - from };
  }
}
