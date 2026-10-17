import { PhraseClips, type Clip } from './phrase-clips';
import { tuning } from '../tuning';

/** How far Sleeping's story has come, as its recordings follow it (`SleepingChapter.sleepingMusic`). */
export type SleepingGate = 'bedtime' | 'asleep' | 'feather' | 'mist' | 'catch' | 'summit' | 'ribbon' | 'glide';
const GATES: readonly SleepingGate[] = ['bedtime', 'asleep', 'feather', 'mist', 'catch', 'summit', 'ribbon', 'glide'];
const gate = (name: SleepingGate) => GATES.indexOf(name);

/**
 * `sleeping.ogg` ("A Tune for the Sleeping Meadow") plays from its top to the seam before its second half: the note
 * attacked at 60.8 s has rung down to −47 dB when the next attacks at 63.73 s.
 */
export const LULLABY_END = 63.7;
/**
 * Where each recording can stop, measured on the decoded samples as `MIRROR_SEAMS` were: 30 ms before each attack
 * whose last 0.3 s averages at least 5 dB under the piece's median level and is not rising into it, the attack's
 * loudest 50 ms in the next 0.3 s at least 9 dB over that rest; attacks under 2 s apart keep the first.
 */
export const LULLABY_SEAMS: readonly number[] = [
  .77, 3.97, 6.21, 9.94, 11.96, 15.57, 17.68, 20.35, 23.13, 28.22, 33.58, 38.69, 41.36, 44.32, 52.76, 56.88, 63.7,
];
export const BRAVE_SEAMS: readonly number[] = [
  .84, 4.08, 6.13, 8.18, 16.1, 24.02, 27.63, 49.96, 57.86, 65.69, 80.5, 92.67, 96.27, 104.18, 112.11, 126.67, 153.18,
  157.15, 161.24,
];
export const MORNING_SEAMS: readonly number[] = [
  1.75, 5.47, 12.02, 16.46, 23.62, 27.8, 31.81, 35.67, 38.26, 41.39, 50.93, 61.1, 69.02, 72.91, 75.81, 79.37, 89.25,
  99.58, 109.68, 118.83,
];
/**
 * `cygnet_brave.ogg` ("Fragments for a Swan Who Stayed") in three parts, back to back in the recording, each from 30 ms
 * before the attack after one of its clean rests: the climb theme, the sparse commitment and the summit, each with the
 * gate that starts it.
 */
export const BRAVE_PARTS: readonly (readonly [from: number, to: number, gate: SleepingGate])[] = [
  [0, 96.27, 'feather'], [96.27, 112.11, 'catch'], [112.11, 153.18, 'summit'],
];
/**
 * `sleeping_morning.ogg` ("Colour Returns to the Meadow") plays from its second phrase as the curtains open, so the
 * third comes in as the child wakes. Jeremy's "around 11 seconds" takes in the last second of the rest before the
 * phrase's 12.02 s seam: that second is what lands the third phrase on the bird's landing.
 */
export const MORNING_FROM = 11;
/** Each excerpt ends in a rest; this short fade only keeps the cut clean. */
const END_FADE = .4;
/** A part waiting on the one sounding is placed this long before that one ends, ahead of its fade. */
const PLACE_AHEAD = 1;

/**
 * How much longer to hold Sleeping's winter, `t` seconds into her sleep with the lullaby `left` seconds from silent and
 * `waited` held so far: before the bird's first try, until the frost can come `frostRest` after the lullaby, and no
 * more than `frostWaitMost` in all.
 */
export function winterHold(t: number, left: number, waited: number): number {
  const { triesFrom, winterBeginsAt, frostRest, frostWaitMost } = tuning.sleeping;
  const hold = Math.min(triesFrom, winterBeginsAt);
  // A hair short of the hold, so the first try's `t > triesFrom` cannot slip through on rounding.
  return t > hold && left + frostRest > winterBeginsAt - hold ? Math.max(0, Math.min(t - hold + 1e-6, frostWaitMost - waited)) : 0;
}

type Placed = { clip: Clip; part: number; at: number; end: number; cut: boolean };

/** One recording's excerpts on the shared audio clock. */
class Recording extends PhraseClips {
  get decoded(): boolean { return !!this.buffer; }

  excerpt(from: number, to: number, at: number, fadeIn: number): Clip | null {
    return this.play(from, to, 1, END_FADE, at, fadeIn);
  }

  /** Fades over `release` into silence at `at` on the audio clock, and stops there. */
  endAt(clip: Clip, at: number, release: number): void {
    const now = this.ctx.currentTime, from = Math.max(now, at - release), gain = clip.gain.gain;
    gain.cancelAndHoldAtTime(from);
    gain.setValueAtTime(from > now ? 1 : gain.value, from);
    gain.linearRampToValueAtTime(0, Math.max(from, at));
    clip.source.stop(Math.max(from, at));
  }

  /** Keeps the clip at full level through its end, so the next excerpt carries the recording on unbroken. */
  holdThrough(clip: Clip, end: number): void {
    clip.gain.gain.cancelScheduledValues(end - END_FADE - 1e-3);
  }

  /** Gives a held clip its own end fade back. */
  fadeAtEnd(clip: Clip, end: number): void {
    this.endAt(clip, end, END_FADE);
  }
}

/**
 * Sleeping's three recordings, each on its own trim on the dry music route. The lullaby plays once from bedtime and the
 * frost waits for it (`lullabyLeft`); falling asleep early in it ends it at its next seam. The climb's parts each begin
 * as their gate is reached and never overlap, are never cut or faded early but for the climb theme, which the fog ends
 * at its next seam, or over a slow fade when none is near: a part reached while another sounds starts as that one ends,
 * the latest reached playing instead of any passed over. The bandage coming free lets the climb go the same way,
 * and nothing plays until the curtains open and start the morning at once. A save or a late start plays nothing until
 * the next gate, but for bedtime and the freed feather.
 */
export class SleepingMusic {
  private readonly lullabyBus: GainNode;
  private readonly braveBus: GainNode;
  private readonly morningBus: GainNode;
  private lullaby: Recording | null = null;
  private brave: Recording | null = null;
  private morning: Recording | null = null;
  /** Begun or passed over: the morning never starts again. */
  private morningDone = false;
  private morningEnds = Infinity;
  /** Begun, passed over or finished: the lullaby never starts again. */
  private lullabyDone = false;
  private lullabyClip: Clip | null = null;
  private lullabyFrom = 0;
  /** When the lullaby falls silent on the audio clock; −Infinity until it sounds. */
  private lullabyEnds = -Infinity;
  private asleepSeen = false;
  /** When the bird reached the top on the audio clock. */
  private summitAt = -Infinity;
  /** The latest climb ending applied: the bandage freed, then the curtains. */
  private letGo = -1;
  /** The latest gate reached, and the latest part played or passed over. */
  private heard = -1;
  private placed = -1;
  private sounding: Placed | null = null;
  /** The part placed to follow the sounding one, until it begins; `held` the sounding one through its end. */
  private queued: Placed & { held: boolean } | null = null;
  private stopped = false;

  constructor(private readonly ctx: BaseAudioContext, output: AudioNode) {
    this.lullabyBus = SleepingMusic.bus(ctx, output);
    this.braveBus = SleepingMusic.bus(ctx, output);
    this.morningBus = SleepingMusic.bus(ctx, output);
  }

  private static bus(ctx: BaseAudioContext, output: AudioNode): GainNode {
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(output);
    return bus;
  }

  /** Starts decoding a recording that is still to play; resolves once it can. */
  prepare(track: 'sleeping' | 'cygnetBrave' | 'sleepingMorning'): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (track === 'sleeping') {
      if (!this.lullabyDone) this.lullaby ??= new Recording(this.ctx, this.lullabyBus, 'sleeping');
      return this.lullaby?.ready ?? Promise.resolve();
    }
    if (track === 'sleepingMorning') {
      if (!this.morningDone) this.morning ??= new Recording(this.ctx, this.morningBus, 'sleepingMorning');
      return this.morning?.ready ?? Promise.resolve();
    }
    if (this.placed < BRAVE_PARTS.length - 1) this.brave ??= new Recording(this.ctx, this.braveBus, 'cygnetBrave');
    return this.brave?.ready ?? Promise.resolve();
  }

  /** Seconds until the lullaby is silent on the audio clock: negative once it is, −Infinity if it never sounded. */
  lullabyLeft(now: number): number {
    return this.lullabyEnds - now;
  }

  update(reached: SleepingGate, level: number): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime, index = gate(reached);
    const lullabyLevel = level * 10 ** (tuning.audio.recordedMusicDb.sleeping / 20);
    const braveLevel = level * 10 ** (tuning.audio.recordedMusicDb.cygnetBrave / 20);
    const morningLevel = level * 10 ** (tuning.audio.recordedMusicDb.sleepingMorning / 20);
    if (this.heard < 0) {
      this.lullabyBus.gain.setValueAtTime(lullabyLevel, now);
      this.braveBus.gain.setValueAtTime(braveLevel, now);
      this.morningBus.gain.setValueAtTime(morningLevel, now);
      if (index > gate('bedtime')) this.lullabyDone = true;
      if (index > gate('feather')) this.placed = BRAVE_PARTS.filter(part => gate(part[2]) <= index).length - 1;
      if (index >= gate('glide')) this.morningDone = true;
    } else {
      this.lullabyBus.gain.setTargetAtTime(lullabyLevel, now, .25);
      this.braveBus.gain.setTargetAtTime(braveLevel, now, .25);
      this.morningBus.gain.setTargetAtTime(morningLevel, now, .25);
    }
    if (index >= gate('summit') && this.heard < gate('summit')) this.summitAt = now;
    this.heard = Math.max(this.heard, index);
    this.bedtime(now);
    this.climb(now);
    this.dawn(now);
  }

  private bedtime(now: number): void {
    const asleep = this.heard >= gate('asleep');
    if (!this.lullabyDone && !asleep) {
      void this.prepare('sleeping');
      if (this.lullaby?.decoded) {
        this.lullabyClip = this.lullaby.excerpt(0, LULLABY_END, now, .01);
        this.lullabyFrom = now;
        this.lullabyEnds = now + LULLABY_END;
        this.lullabyDone = true;
      }
    }
    if (asleep && !this.asleepSeen) {
      this.asleepSeen = true;
      this.lullabyDone = true;
      // The frost waits for it only so long: ending past that, it ends at its next seam.
      const { winterBeginsAt, frostWaitMost, frostRest } = tuning.sleeping;
      const latest = now + winterBeginsAt + frostWaitMost - frostRest;
      if (this.lullaby && this.lullabyClip && this.lullabyEnds > latest) {
        const position = now - this.lullabyFrom;
        const seam = LULLABY_SEAMS.find(seam => seam - position >= tuning.audio.mirrorSeamSoonest);
        const at = seam === undefined ? latest : Math.min(latest, this.lullabyFrom + seam);
        this.lullaby.endAt(this.lullabyClip, at, Math.min(tuning.audio.mirrorSeamRelease, at - now));
        this.lullabyEnds = at;
      }
    }
    // Over, or never to begin: its decoded audio goes.
    if (this.lullaby && this.lullabyDone && now >= this.lullabyEnds) {
      this.lullaby.stop(0);
      this.lullaby = null;
    }
  }

  private climb(now: number): void {
    // Decoded from when she falls asleep, long before the feather can be freed.
    if (this.heard >= gate('asleep')) void this.prepare('cygnetBrave');
    const brave = this.brave;
    if (!brave?.decoded) return;
    if (this.queued && now >= this.queued.at) { this.sounding = this.queued; this.queued = null; }
    const sounding = this.sounding && now < this.sounding.end ? this.sounding : null;
    const ending = this.heard >= gate('glide') ? gate('glide') : this.heard >= gate('ribbon') ? gate('ribbon') : -1;
    if (ending > this.letGo) { this.letGo = ending; this.giveWay(brave, sounding, now, ending === gate('glide')); }
    if (sounding?.part === 0 && !sounding.cut && this.heard >= gate('mist')) {
      const { mirrorSeamSoonest, mirrorSeamRelease, fogSeamWithin, fogFade } = tuning.audio;
      const position = now - sounding.at;
      const seam = BRAVE_SEAMS.find(seam => seam - position >= mirrorSeamSoonest);
      if (seam !== undefined && seam < BRAVE_PARTS[0][1]) {
        // No phrase ends soon enough, so the fog takes the theme mid-phrase over a slow fade.
        const near = seam - position <= fogSeamWithin, at = near ? sounding.at + seam : now + fogFade;
        brave.endAt(sounding.clip, at, near ? Math.min(mirrorSeamRelease, at - now) : fogFade);
        sounding.clip.finishing = true;
        sounding.end = at;
        sounding.cut = true;
      }
    }
    let next = -1;
    for (let part = this.placed + 1; part < BRAVE_PARTS.length; part++) if (gate(BRAVE_PARTS[part][2]) <= this.heard) next = part;
    if (next >= 0 && this.queued) {
      // A later gate before the queued part begins: that part is passed over for this one.
      this.queued.clip.source.stop();
      if (this.queued.held && sounding) brave.fadeAtEnd(sounding.clip, sounding.end);
      this.queued = null;
    }
    if (next < 0) {
      if (!sounding && !this.queued && this.placed >= BRAVE_PARTS.length - 1) {
        brave.stop(0);
        this.brave = null;
      }
      return;
    }
    if (sounding && now < sounding.end - PLACE_AHEAD) return;
    const [from, to, reached] = BRAVE_PARTS[next];
    const held = !!sounding && !sounding.cut && BRAVE_PARTS[sounding.part][1] === from && now < sounding.end - END_FADE;
    // Begun on its own, the summit part lets the arrival at the top settle and rises in.
    const settles = reached === 'summit' && !held;
    const at = Math.max(sounding ? Math.max(now, sounding.end) : now, settles ? this.summitAt + tuning.audio.summitDelay : now);
    if (held) brave.holdThrough(sounding.clip, sounding.end);
    const clip = brave.excerpt(from, to, at, held ? 1e-3 : settles ? tuning.audio.summitFadeIn : .01);
    if (!clip) return;
    this.placed = next;
    const placed = { clip, part: next, at, end: at + Math.min(to, clip.source.buffer!.duration) - from, cut: false };
    if (at > now) this.queued = { ...placed, held };
    else this.sounding = placed;
  }

  /**
   * The bandage freed, and the curtains: the part waiting is passed over, and the one sounding ends at its next
   * seam if one comes within `ribbonSeamWithin` (at least `mirrorSeamSoonest` ahead, over up to `mirrorSeamRelease`),
   * or else over `ribbonFade`; at the curtains, within `mirrorSeamRelease`, or else over `curtainsFade`. Nothing in the
   * climb plays after.
   */
  private giveWay(brave: Recording, sounding: Placed | null, now: number, curtains: boolean): void {
    if (this.queued) {
      this.queued.clip.source.stop();
      if (this.queued.held && sounding) brave.fadeAtEnd(sounding.clip, sounding.end);
      this.queued = null;
    }
    this.placed = BRAVE_PARTS.length;
    if (!sounding || sounding.cut) return;
    const { mirrorSeamSoonest, mirrorSeamRelease, curtainsFade, ribbonSeamWithin, ribbonFade } = tuning.audio;
    const within = curtains ? mirrorSeamRelease : ribbonSeamWithin, fade = curtains ? curtainsFade : ribbonFade;
    const soonest = curtains ? 0 : mirrorSeamSoonest;
    const position = now - sounding.at, length = sounding.end - sounding.at, from = BRAVE_PARTS[sounding.part][0];
    const seam = BRAVE_SEAMS.map(seam => seam - from).find(seam => seam > position + soonest - 1e-6 && seam < length - 1e-6) ?? length;
    const near = seam - position <= within;
    // Its own end is near enough: it rings out there as it would have.
    if (near && seam === length) return;
    const at = near ? sounding.at + seam : now + fade;
    brave.endAt(sounding.clip, at, near ? Math.min(curtains ? Infinity : mirrorSeamRelease, at - now) : fade);
    sounding.clip.finishing = true;
    sounding.end = at;
    sounding.cut = true;
  }

  /** Decoded from the catch; from the curtains it plays once to its end, and its decoded audio goes. */
  private dawn(now: number): void {
    if (this.heard >= gate('catch')) void this.prepare('sleepingMorning');
    const morning = this.morning;
    if (!morning?.decoded) return;
    if (!this.morningDone && this.heard >= gate('glide')) {
      const clip = morning.excerpt(MORNING_FROM, Infinity, now, .01);
      if (!clip) return;
      this.morningDone = true;
      this.morningEnds = now + clip.source.buffer!.duration - MORNING_FROM;
    }
    if (this.morningDone && now >= this.morningEnds) {
      morning.stop(0);
      this.morning = null;
    }
  }

  stop(fade: number): void {
    if (this.stopped) return;
    this.stopped = true;
    this.lullaby?.stop(fade); this.lullaby = null;
    this.brave?.stop(fade); this.brave = null;
    this.morning?.stop(fade); this.morning = null;
  }
}
