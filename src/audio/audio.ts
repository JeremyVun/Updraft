import type { MirrorScorePhase } from './dream-score';
import type { DrownedScorePhase } from './drowned-score';
import type { SummitScorePhase } from './summit-score';
import { RecordedScore, type RecordedMusic } from './recorded-score';
import { StillPhrases } from './still-phrases';
import type { MusicTrack } from './music-loading';
import { HOME_JUMP_LEAD, homeEndingNext, homeEndingPosition } from '../story/home-ending';
import { HOME_ASK, homeAskEntry, homeAskExit, homeAskExitNear, homeEnding } from './home-seams';
import { OpeningScore, type OpeningScorePhase } from './opening-score';
import type { Cue } from '../story/cues';
import type { AudioOut } from '../creatures/voices';
import { tuning } from '../tuning';
import { BOATS_CHORDS } from './little-boats-score';
import type { SeaScorePhase } from './sea-score';
import { SeaMusic } from './sea-music';
import type { SleepingScorePhase } from './sleeping-score';
import { SleepingMusic, type SleepingGate } from './sleeping-music';
import { MeadowScore, MEADOW_SECTIONS, type MeadowScorePhase } from './meadow-score';
import type { BirchesScorePhase } from './birches-score';
import type { StairsAir } from './stairs-air';
import { flightKnock, OUTSIDE_STAIRS, StairsSound, type StairsMix } from './stairs-sound';
import type { LinesScorePhase } from './lines-score';
import { meadowMusic, type MeadowFile, type MeadowMusicPart } from './meadow-music';
import { ArrivalTransition, type ArrivalMusic } from './arrival-music';
import { chordNote } from './gesture-harmony';
import { foghornParts, playFoghorn, type FoghornParts } from './foghorn';
import { advance, ALONE, Sliced, slices, SLICES_PER_SECOND, type Pace } from './sliced';

/**
 * Recorded chapter music joins synthesised air and sea, a pad that warms as the world comes back, chimes
 * that follow the player's gestures, skylarks over the hills, crickets and an owl at night, and short phrases that
 * answer the story's moments.
 */

export interface AudioEmitter {
  pan: number;
  distance: number;
  active: boolean;
}

export interface SoundState {
  /** True only during the opening island chapter, never its departing crossing. */
  startingIsland?: boolean;
  stillPhrase?: boolean;
  stillFlying?: boolean;
  stillCrossingTime?: number;
  stillDeparture?: boolean;
  stillDepartureSoon?: boolean;
  /** Approved opening drone; continues on its own clock during the first crossing. */
  openingScore?: OpeningScorePhase;
  /** The actual forest chapter, the only one whose wind gestures chime. */
  forestWind?: boolean;
  /** Player gust speed, 0..~26. */
  gust: number;
  winterGust?: number;
  /** Pointer position across the screen, -1..1. */
  pan: number;
  /** Gesture direction on screen: +1 moving up/right, -1 down/left. */
  rise: number;
  /** Updraft charge while holding, 0..1. */
  charge: number;
  overLand: boolean;
  /** Natural breeze strength near the island, 0..1. */
  breeze: number;
  /** How hard the glider is being lifted, 0..1. */
  gliderLift: number;
  /** How alive the world is, 0 grey and still to 1. */
  life: number;
  /** 0 by day, 1 at full night. */
  night: number;
  /** How close the sea is: 1 on the island and at sea, falling away inland. */
  sea: number;
  /** How far a fog lying over the water muffles it, 0 to 1. */
  seaMuffle?: number;
  /** 1 out over the green hills, where skylarks sing. */
  meadow: number;
  /** Ground beneath the story, independent of the pointer's overLand test. */
  land: number;
  /** Local frost; the final home's requested night ambience remains available. */
  cold: number;
  /** A passing shower, 0 dry to 1. */
  shower: number;
  /** How far the music pulls back, 0 normal to 1 almost gone, so a moment can be heard on its own. */
  hush: number;
  piano?: number;
  pianoActive?: boolean;
  /** Only the wood's rescue ember changes the ordinary wind chime. */
  caringWind?: boolean;
  cygnet?: AudioEmitter;
  flock?: AudioEmitter;
  /** Authored conversations own their pauses; incidental calls must stay out. */
  flockChatter?: boolean;
  /** Which room's music is playing. */
  music: Mood;
  arrivalMusic?: ArrivalMusic;
  /** The final approach is visible; a completed musical rest may now admit the destination. */
  arrivalReady?: boolean;
  /** Seconds until the destination's music may begin, at the boat's speed now. */
  arrivalIn?: number;
  /** Seconds since the boat left the Mirror, on the crossing's clock; Home begins `homeStartAfter` in. */
  homewardTime?: number;
  summitScore?: SummitScorePhase;
  homeEndingTime?: number;
  homeAsk?: boolean;
  homeSetDownIn?: number;
  /** Only the long dolphin crossing uses the approved adaptive sea arrangement. */
  mirrorScore?: MirrorScorePhase;
  drownedScore?: DrownedScorePhase;
  drownedQuiet?: boolean;
  /** The bell's fourth ring has sounded, or a save is past it. */
  bellsRung?: boolean;
  seaScore?: SeaScorePhase;
  /** The open sea's recording: seconds into it on the passage clock, and the rescue phrase reached (`SeaMusic`). */
  seaMusicTime?: number;
  seaPhrase?: number;
  /** How far into one of its calls the whale is, 0..1, so the recording can make room under its voice. */
  whaleCalling?: number;
  sleepingScore?: SleepingScorePhase;
  /** How far Sleeping's story has come, for its recordings (`SleepingMusic`). */
  sleepingMusic?: SleepingGate;
  /** The approved arrangement starts after the piano and continues until the next arrival handoff. */
  meadowScore?: MeadowScorePhase;
  /** Where the meadow's recordings are, from the walk to the stool to the feather (`meadow-music.ts`). */
  meadowMusic?: MeadowMusicPart;
  birchesScore?: BirchesScorePhase;
  /** On the Birches island or the approach to it its recording loops; once they have sailed, its pass plays out. */
  birchesLoop?: boolean;
  /** The stairs song, under the cloud. */
  stairsSong?: boolean;
  stairsAir?: StairsAir;
  linesScore?: LinesScorePhase;
  linesMelodyQuiet?: boolean;
  /** True while the story is playing a beat out on its own and the player's gestures are not driving anything. */
  scripted: boolean;
  /** True once the music has been cut for good: the pad and the chimes go, and the world is all that is left. */
  silence: boolean;
  cues: Cue[];
}

/**
 * Each room has its own music in the same key family: the chords it turns over,
 * how long it holds each one, how bright the pad is allowed to be, how loud it sits, and the notes the player's
 * own gestures ring out of it. The shared pad glides between rooms. Little Boats and the long sea crossing
 * instead play their approved compositions, with stable notes and fading transitions.
 */
export type Mood = 'still' | 'lines' | 'boats' | 'meadow' | 'birches' | 'drowned' | 'wood' | 'sea' | 'mirror' | 'home';

interface MoodMusic {
  chords: number[][];
  /** How long each chord is held. */
  seconds: number;
  /** Where the pad's low-pass sits before life and night move it. */
  cutoff: number;
  /** How loud the pad sits in this room, 1 being the meadow. */
  level: number;
  /** Desired gesture contour/register, quantized to the sounding harmony. */
  scale: number[];
}

const MOODS: Record<Mood, MoodMusic> = {
  /** Open fifths with no third in them: nothing has been decided yet, and nothing is moving. */
  still: { chords: [[50, 57, 62, 69], [45, 52, 57, 64]], seconds: 16, cutoff: 680, level: 0.8, scale: [62, 64, 69, 71, 74, 76, 81, 83, 86] },
  /** The first delight in the journey, and the brightest thing in it. */
  lines: { chords: [[50, 57, 64, 71], [43, 50, 59, 66], [45, 52, 61, 66], [47, 54, 57, 62]], seconds: 9, cutoff: 1500, level: 1, scale: [62, 64, 66, 69, 71, 73, 74, 76, 78, 81, 83, 86] },
  /** Its approved plucked score replaces the shared pad; gestures retain the same bright voice. */
  boats: { chords: BOATS_CHORDS, seconds: 4.5, cutoff: 1500, level: 0, scale: [62, 64, 66, 69, 71, 73, 74, 76, 78, 81, 83, 86] },
  /** The last warm afternoon of the year, in the F minor of its recordings, which replace the shared pad. */
  meadow: { chords: [[53, 60, 65, 68], [49, 56, 63, 68], [44, 51, 60, 63], [46, 53, 60, 65]], seconds: 8.5, cutoff: 1600, level: 0, scale: [63, 65, 68, 70, 72, 75, 77, 80, 82, 84, 87, 89] },
  /** Slower than the meadow and a step lower each time round: warm, falling, and it never comes back up. */
  birches: { chords: [[50, 57, 62, 66], [48, 55, 62, 67], [47, 54, 59, 66], [45, 52, 59, 64]], seconds: 11, cutoff: 1250, level: 0.95, scale: [62, 64, 66, 69, 71, 72, 74, 76, 78, 81, 83] },
  /** Suspended, hollow, never landing on a third: homes the water took. */
  drowned: { chords: [[47, 54, 59, 66], [45, 52, 57, 64], [43, 50, 57, 62], [42, 49, 57, 64]], seconds: 13, cutoff: 820, level: 0.85, scale: [59, 62, 64, 66, 69, 71, 74, 76, 78, 81] },
  /** A drone and the semitone above it, turning over and never resolving. Barely music at all. */
  wood: { chords: [[38, 45, 50, 57], [38, 45, 51, 58]], seconds: 15, cutoff: 440, level: 0.65, scale: [50, 53, 57, 60, 62, 65, 69, 72] },
  /** Out of the dark and into open water, with the bass climbing under it. */
  sea: { chords: [[45, 52, 57, 64], [43, 50, 59, 66], [50, 57, 64, 71], [47, 54, 61, 69]], seconds: 11, cutoff: 1300, level: 1, scale: [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86] },
  /** Suspended above the water; the same two open voicings trade places slowly. */
  mirror: { chords: [[50, 57, 64, 69], [45, 52, 62, 69]], seconds: 19, cutoff: 920, level: 0.55, scale: [69, 74, 76, 81, 83, 88] },
  /** Clear, frozen and resolved: the only room whose chords come home. */
  home: { chords: [[50, 57, 62, 69], [43, 50, 59, 66], [45, 52, 61, 64], [50, 57, 64, 71]], seconds: 10, cutoff: 1450, level: 1.15, scale: [62, 66, 69, 71, 74, 78, 81, 83, 86, 90] },
};

const PULSE = 60 / 96 / 2;

/** The wood's two phrases as [midi, beats] pairs on its D/A drone. */
const PHRASES: Record<'kindled' | 'comfort', [number, number][]> = {
  /** A coal takes in the dark wood: three notes up out of the drone, the only lift the room's music is allowed. */
  kindled: [[62, 1], [69, 1], [74, 2]],
  comfort: [[62, 1], [69, 2]],
};
const PHRASE_BEAT: Record<'kindled' | 'comfort', number> = { kindled: 0.17, comfort: 0.3 };

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
// The tail blends into this prefix; loop playback resumes immediately after it.
const NOISE_OVERLAP = 0.04;

function* pinkNoise(ctx: BaseAudioContext, seconds: number): Generator<void, AudioBuffer> {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (const [from, to] of slices(d.length)) {
      for (let i = from; i < to; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      yield;
    }
    const overlap = Math.floor(ctx.sampleRate * NOISE_OVERLAP);
    for (let i = 0; i < overlap; i++) {
      const angle = i / (overlap - 1) * Math.PI / 2;
      const tail = d.length - overlap + i;
      d[tail] = d[tail] * Math.cos(angle) + d[i] * Math.sin(angle);
    }
  }
  return buffer;
}

function* impulse(ctx: BaseAudioContext, seconds: number): Generator<void, AudioBuffer> {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    for (const [from, to] of slices(len)) {
      for (let i = from; i < to; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
      }
      yield;
    }
  }
  return buffer;
}

/** Ambient beds join the graph once their noise exists; a short fade keeps that late entry from clicking. */
const NOISE_ENTRY = 0.25;
/** −120 dB: a gain this close to a zero target is held at exactly 0. */
const SILENT = 1e-6;

interface Fade { value: number; target: number; at: number; tc: number; held: boolean }

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private reverb!: GainNode;
  /** Gesture chimes and authored cues; the ending cuts this alongside the background bus. */
  private musicBus!: GainNode;
  /** Background music is gated apart from everything else, so an arrival rest never silences gestures or physical sounds. */
  private backgroundBus!: GainNode;
  private backgroundDry!: GainNode;
  private backgroundWet!: GainNode;
  private backgroundGate!: GainNode;
  private backgroundDuck!: GainNode;
  private musicDryGain!: GainNode;
  private musicWetGain!: GainNode;
  /** The background's wet send is gated on its way into the shared reverb. */
  private wetGate!: GainNode;
  private wetDuck!: GainNode;
  private homeJumped = false;
  /** The latest of the ending's passages placed to take over, on the ending's clock. */
  private homeSplicedTo = -Infinity;
  /** When Home's quiet opening begins looping for the cygnet's ask, on the audio clock. */
  private homeAskAt: number | undefined;
  private gestureVoices: { midi: number; at: number; out: GainNode }[] = [];
  private reverbConvolver!: ConvolverNode;
  private readonly arrivalTransition = new ArrivalTransition();
  private noiseWork: Sliced<AudioBuffer> | null = null;
  private foghornWork: Sliced<FoghornParts> | null = null;
  /** Buffers and convolvers still being prepared, in order, at a steady rate of story time. */
  private readonly synthesis: Sliced<unknown>[] = [];
  /** Ambient bed filters waiting for the loop noise. */
  private noiseInputs: AudioNode[] = [];
  private graph: AudioOut | null = null;
  /** Only a real-time context can be interrupted; an offline render suspends itself on purpose. */
  private realtime = false;
  /** Story cues raised while a call or Siri interrupted a visible, unmuted context. */
  private heldCues: { cue: Cue; at: number }[] = [];
  /** Story time seen by `update`, which keeps running through an interruption. */
  private cueClock = 0;
  private breezeGain!: GainNode;
  private breezeFilter!: BiquadFilterNode;
  private gustGain!: GainNode;
  private gustFilter!: BiquadFilterNode;
  private gustPan!: StereoPannerNode;
  private whistleGain!: GainNode;
  private whistleFilter!: BiquadFilterNode;
  private rustleGain!: GainNode;
  private nightGain!: GainNode;
  private nightFilter!: BiquadFilterNode;
  private nightWhistleGain!: GainNode;
  private nightWhistleFilter!: BiquadFilterNode;
  private nightPan!: StereoPannerNode;
  private seaGain!: GainNode;
  private seaFilter!: BiquadFilterNode;
  private liftGain!: GainNode;
  private liftFilter!: BiquadFilterNode;
  private padVoices: { osc: OscillatorNode[]; gain: GainNode }[] = [];
  private padGain!: GainNode;
  /** Each faded gain's last scheduled target and its value then, following `setTargetAtTime`'s curve. */
  private readonly fades = new Map<AudioParam, Fade>();
  private chord = -1;
  private mood: Mood | null = null;
  private noteIndex = 4;
  private lastNote = -Infinity;
  private lastArp = -Infinity;
  private prevGliderLift = 0;
  private lastGlider = 0;
  private activity = 0;
  private muted = false;
  private musicMuted = false;
  private hidden = document.hidden;
  private padFilter!: BiquadFilterNode;
  private rainGain!: GainNode;
  private patterGain!: GainNode;
  private nextCricket = 0;
  private nextOwl = 20;
  private nextLark = 8;
  private nextFlock = 0;
  private flockQuietUntil = 0;
  private boatsScore: RecordedScore | null = null;
  private seaMusic: SeaMusic | null = null;
  private sleepingMusic: SleepingMusic | null = null;
  private meadowScore: MeadowScore | null = null;
  private birchesScore: RecordedScore | null = null;
  /** Sailing to the stairs, when the birches' pass ends has been settled. */
  private birchesEndSet = false;
  /** When the birches' recording was last sounding: the stairs song waits `stairsSongRest` after it. */
  private birchesHeard = -Infinity;
  private stairsScore: RecordedScore | null = null;
  private cloudsScore: RecordedScore | null = null;
  /** When they came out on top of the cloud, on the audio clock: `clouds.ogg` keeps time from there. */
  private cloudsAt: number | null = null;
  private stairsSound: StairsSound | null = null;
  private linesScore: RecordedScore | null = null;
  private mirrorScore: RecordedScore | null = null;
  /** The village's approach, played once from its top at the handoff; `villageAt` is when that top was due. */
  private villageScore: RecordedScore | null = null;
  private villageAt: number | null = null;
  /** The belfry's goodbye, played once from the fourth ring on into the storm; `belfryAt` is when it began. */
  private belfryScore: RecordedScore | null = null;
  private belfryAt: number | null = null;
  /** Up in the white the stairs song has faded for good. */
  private stairsSongGone = false;
  private summitScore: RecordedScore | null = null;
  /** The audio-clock moment Home's recording was scheduled to begin, leaving the Mirror. */
  private homeFrom?: number;
  private preparedScore: RecordedScore | null = null;
  private openingScore: OpeningScore | null = null;
  private forestBlendUntil = 0;
  private stillPhrases: StillPhrases | null = null;
  private stillDepartureScore: RecordedScore | null = null;

  get running(): boolean {
    return this.ctx?.state === 'running' && !this.muted && !this.hidden;
  }

  prepareMusic(track: MusicTrack): Promise<void> {
    if (!this.ctx) return Promise.resolve();
    if (track === 'still') {
      this.stillPhrases ??= new StillPhrases(this.ctx, this.backgroundDry);
      return this.stillPhrases.ready;
    }
    if (track === 'sea') {
      this.seaMusic ??= new SeaMusic(this.ctx, this.backgroundDry);
      return this.seaMusic.ready;
    }
    if (track === 'sleeping' || track === 'cygnetBrave' || track === 'sleepingMorning') {
      this.sleepingMusic ??= new SleepingMusic(this.ctx, this.backgroundDry);
      return this.sleepingMusic.prepare(track);
    }
    const active = track === 'stillDeparture' ? this.stillDepartureScore : track === 'home' ? this.summitScore : track === 'mirror' ? this.mirrorScore : track === 'lines' ? this.linesScore : track === 'boats' ? this.boatsScore : track === 'clouds' ? this.cloudsScore : track === 'villageApproach' ? this.villageScore : track === 'belfry' ? this.belfryScore : track === 'stairs' ? this.stairsScore : this.birchesScore;
    if (active) return active.ready;
    if (this.preparedScore?.track !== track) {
      this.preparedScore?.stop(0);
      this.preparedScore = new RecordedScore(this.ctx, this.backgroundDry, track);
    }
    return this.preparedScore.ready;
  }

  /** The meadow's first recordings for a start or restore there; the duet's voices need sound only, not music. */
  prepareMeadow(files: MeadowFile[]): Promise<void> {
    if (!this.ctx) return Promise.resolve();
    return meadowMusic.prepareFor(this.musicMuted ? files.filter(file => file === 'duet') : files);
  }

  cancelStartingMusic(): void {
    this.preparedScore?.stop(0); this.preparedScore = null;
    this.stillPhrases?.stop(0); this.stillPhrases = null;
    this.seaMusic?.stop(0); this.seaMusic = null;
    this.sleepingMusic?.stop(0); this.sleepingMusic = null;
  }

  /** Seconds until Home's ending attack would land if the updraft succeeded now; undefined with no ask under way. */
  get homeReturnIn(): number | undefined {
    if (!this.running || this.musicMuted || this.homeJumped || this.homeAskAt === undefined || !this.summitScore) return undefined;
    const now = this.ctx!.currentTime, { mirrorSeamSoonest, homeJumpAt, homeAnswerBy } = tuning.audio;
    // Far enough ahead that the success comes no later than `homeAnswerBy` on the ending's clock.
    const from = now + Math.max(mirrorSeamSoonest, homeJumpAt - homeAnswerBy - HOME_JUMP_LEAD);
    return homeAskExit(this.homeAskAt, from).at + HOME_JUMP_LEAD - now;
  }

  /** Seconds until Sleeping's lullaby is silent, negative once it is; −Infinity when none is heard. The frost waits for it. */
  get lullabyLeft(): number {
    return this.running && !this.musicMuted && this.sleepingMusic ? this.sleepingMusic.lullabyLeft(this.ctx!.currentTime) : -Infinity;
  }

  private takeRecordedScore(track: RecordedMusic): RecordedScore {
    void this.prepareMusic(track);
    const score = this.preparedScore!;
    this.preparedScore = null;
    return score;
  }

  /** Something outside the game (a call, Siri, another app) has stopped audio the player expects to hear. */
  private get interrupted(): boolean {
    const state = this.ctx?.state;
    return this.realtime && !this.muted && !this.hidden && state !== 'running' && state !== 'closed';
  }

  constructor() {
    document.addEventListener('visibilitychange', () => this.setHidden(document.hidden));
    window.addEventListener('pagehide', () => this.setHidden(true));
    window.addEventListener('pageshow', () => this.setHidden(document.hidden));
    window.addEventListener('focus', () => this.retry());
    // A mouse grants activation on press, a touch on release.
    for (const type of ['pointerdown', 'pointerup']) window.addEventListener(type, () => this.retry(), { capture: true, passive: true });
  }

  private setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) this.heldCues.length = 0;
    this.syncPlayback();
  }

  private retry(): void {
    if (this.interrupted) this.syncPlayback();
  }

  private syncPlayback(): void {
    if (!this.ctx || this.ctx.state === 'closed') return;
    // Resume may require another gesture on some browsers; start() retries on the next touch.
    void (this.hidden || this.muted ? this.ctx.suspend() : this.ctx.resume()).catch(() => undefined);
  }

  /** The background's arrival and ending gates: one on its dry sound, one on its send to the reverb. */
  private get gates(): AudioParam[] {
    return [this.backgroundGate.gain, this.wetGate.gain];
  }

  /** The live audio graph for other modules' sounds: connect to `bus` (dry) and optionally `reverb` (wet). Null until sound starts or while muted. */
  get output(): AudioOut | null {
    return this.running ? this.graph : null;
  }

  /** The loop noise; a sound that needs it before its turn finishes the synthesis at once. */
  private get noise(): AudioBuffer {
    return this.noiseWork!.finish();
  }

  /** Must be called from a user gesture. Only the context and its graph are made here; buffers follow frame by frame. */
  start(): void {
    if (this.hidden) return;
    if (this.ctx) {
      this.syncPlayback();
      return;
    }
    holdFallback();
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.realtime = ctx instanceof AudioContext;
    try {
      this.buildGraph(ctx);
      this.syncPlayback();
    } catch (error) {
      this.ctx = null;
      this.realtime = false;
      this.graph = null;
      this.noiseWork = null;
      this.noiseInputs = [];
      this.synthesis.length = this.padVoices.length = 0;
      void ctx.close().catch(() => undefined);
      throw error;
    }
  }

  private buildGraph(ctx: AudioContext): void {
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running' ? this.hidden || this.muted : this.interrupted) this.syncPlayback();
    });
    this.noiseWork = new Sliced(pinkNoise(ctx, 6));
    this.synthesis.push(this.noiseWork, new Sliced(this.reverbs(ctx)));

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.8);
    this.master.connect(comp);

    this.reverbConvolver = ctx.createConvolver();
    this.reverb = ctx.createGain();
    this.reverb.gain.value = 0.55;
    this.reverb.connect(this.reverbConvolver).connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    const musicSend = ctx.createGain();
    musicSend.gain.value = 0.9;
    this.musicBus.connect(musicSend).connect(this.reverb);
    this.musicDryGain = ctx.createGain();
    this.musicDryGain.gain.value = this.musicMuted ? 0 : 1;
    this.musicDryGain.connect(this.master);
    this.musicWetGain = ctx.createGain();
    this.musicWetGain.gain.value = this.musicMuted ? 0 : 1;
    this.musicWetGain.connect(this.reverbConvolver);
    this.backgroundDuck = ctx.createGain(); this.backgroundDuck.connect(this.musicDryGain);
    this.backgroundGate = ctx.createGain(); this.backgroundGate.connect(this.backgroundDuck);
    this.backgroundDry = ctx.createGain(); this.backgroundDry.connect(this.backgroundGate);
    this.backgroundWet = ctx.createGain(); this.backgroundWet.gain.value = .55;
    this.wetDuck = ctx.createGain(); this.wetDuck.connect(this.musicWetGain);
    this.wetGate = ctx.createGain(); this.wetGate.connect(this.wetDuck);
    this.backgroundWet.connect(this.wetGate);
    this.backgroundBus = ctx.createGain(); this.backgroundBus.connect(this.backgroundDry);
    const backgroundSend = ctx.createGain(); backgroundSend.gain.value = .9;
    this.backgroundBus.connect(backgroundSend).connect(this.backgroundWet);

    [this.breezeGain, this.breezeFilter] = this.noiseLayer('lowpass', 520, 0.4, 0);
    const breezeLfo = ctx.createOscillator();
    const breezeLfoGain = ctx.createGain();
    breezeLfo.frequency.value = 0.07;
    breezeLfoGain.gain.value = 180;
    breezeLfo.connect(breezeLfoGain).connect(this.breezeFilter.frequency);
    breezeLfo.start();

    this.gustPan = ctx.createStereoPanner();
    this.gustPan.connect(this.master);
    [this.gustGain, this.gustFilter] = this.noiseLayer('bandpass', 400, 1.1, 0.25, this.gustPan);
    [this.whistleGain, this.whistleFilter] = this.noiseLayer('bandpass', 1200, 14, 0.1, this.gustPan);
    [this.rustleGain] = this.noiseLayer('highpass', 2800, 0.6, 0.05, this.gustPan);
    // Sleeping's night wind has its own voice, so the player's gust stays distinct over it.
    this.nightPan = ctx.createStereoPanner();
    this.nightPan.connect(this.master);
    [this.nightGain, this.nightFilter] = this.noiseLayer('bandpass', 400, 1.1, 0.25, this.nightPan);
    [this.nightWhistleGain, this.nightWhistleFilter] = this.noiseLayer('bandpass', 1200, 14, 0.1, this.nightPan);
    [this.liftGain, this.liftFilter] = this.noiseLayer('bandpass', 300, 3, 0.3);

    const [seaGain, seaFilter] = this.noiseLayer('lowpass', 380, 0.5, 0);
    this.seaGain = seaGain;
    this.seaFilter = seaFilter;
    [this.rainGain] = this.noiseLayer('highpass', 2600, 0.5, 0.2);
    [this.patterGain] = this.noiseLayer('bandpass', 900, 0.7, 0.3);

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.0;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 1100;
    padFilter.Q.value = 0.3;
    this.padFilter = padFilter;
    this.padGain.connect(padFilter);
    padFilter.connect(this.backgroundBus);
    for (let v = 0; v < 4; v++) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.padGain);
      const osc = [0, 1].map((k) => {
        const o = ctx.createOscillator();
        o.type = k === 0 ? 'triangle' : 'sine';
        o.detune.value = k === 0 ? -6 : 7;
        o.connect(gain);
        o.start();
        return o;
      });
      this.padVoices.push({ osc, gain });
    }
    this.graph = { ctx, bus: this.master, reverb: this.reverb };
    meadowMusic.attach(ctx, this.master, this.backgroundDry);
  }

  /** The impulse, then the convolver's analysis of it (10–30 ms on a desktop) on a frame of its own. */
  private *reverbs(ctx: BaseAudioContext): Generator<Pace, void> {
    const reverb = yield* impulse(ctx, 4.5);
    yield ALONE;
    this.reverbConvolver.buffer = reverb;
  }

  /** Advances deferred preparation by this frame's share and connects the noise once it exists, on the audio clock. */
  private synthesise(dt: number): void {
    advance(this.synthesis, Math.max(1, Math.round(dt * SLICES_PER_SECOND)));
    if (this.noiseInputs.length && this.noiseWork?.ready) this.startNoise();
  }

  private startNoise(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const noise = this.noise;
    for (const input of this.noiseInputs) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.loopStart = NOISE_OVERLAP;
      const entry = ctx.createGain();
      entry.gain.setValueAtTime(0, now);
      entry.gain.linearRampToValueAtTime(1, now + NOISE_ENTRY);
      src.connect(entry).connect(input);
      src.start(now, Math.random() * 5);
    }
    this.noiseInputs = [];
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.heldCues.length = 0;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.25);
    this.syncPlayback();
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    if (!this.ctx) return;
    for (const node of [this.musicDryGain, this.musicWetGain]) {
      node.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.25);
    }
  }

  /** An unseen ship beyond the lighthouse, outside the musical cue/ducking path. */
  foghorn(): ReturnType<typeof playFoghorn> | null {
    if (!this.running || !this.ctx) return null;
    return playFoghorn(this.ctx, this.master, this.reverb, this.ctx.currentTime, this.prepareFoghorn().finish());
  }

  /** The horn's buffers and diffuse field are made ahead of the storm, so the cue's frame only connects nodes. */
  private prepareFoghorn(): Sliced<FoghornParts> {
    if (!this.foghornWork) {
      this.foghornWork = new Sliced(foghornParts(this.ctx!));
      this.synthesis.push(this.foghornWork);
    }
    return this.foghornWork;
  }

  /** Rolling thunder, with a sharper, immediate crack for the one close strike in the wood. */
  thunder(strength: number, pan: number, close = false): void {
    if (!this.running || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.master);
    panner.connect(this.reverb);
    let remaining = 2;
    for (let layer = 0; layer < 2; layer++) {
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      source.loopStart = NOISE_OVERLAP;
      source.playbackRate.value = layer === 0 ? 0.65 : 1;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(layer === 0 ? 220 : close ? 4200 : 950, now);
      filter.frequency.exponentialRampToValueAtTime(layer === 0 ? 65 : 160, now + (close && layer === 1 ? 0.8 : 3.8));
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      const peak = strength * tuning.storm.thunderGain * (layer === 0 ? 1 : close ? 0.85 : tuning.storm.thunderPresence);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + (layer === 0 ? 0.28 : close ? 0.012 : 0.06));
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.4), now + 1.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (layer === 0 ? 4.8 : 1.9));
      gain.gain.linearRampToValueAtTime(0, now + 5.2);
      source.connect(filter).connect(gain).connect(panner);
      source.start(now, layer * 2.3);
      source.stop(now + 5.3);
      source.onended = () => {
        source.disconnect(); filter.disconnect(); gain.disconnect();
        if (--remaining === 0) panner.disconnect();
      };
    }
  }

  private noiseLayer(
    type: BiquadFilterType,
    freq: number,
    q: number,
    reverbSend: number,
    out?: AudioNode,
  ): [GainNode, BiquadFilterNode] {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(out ?? this.master);
    if (reverbSend > 0) {
      const send = ctx.createGain();
      send.gain.value = reverbSend;
      gain.connect(send).connect(this.reverb);
    }
    this.noiseInputs.push(filter);
    return [gain, filter];
  }

  /**
   * `setTargetAtTime`, except that a gain within `SILENT` of a zero target is held at exactly 0. Re-targeted every frame,
   * a gain counts as automation even at 0, and its zeros keep every convolver it feeds running; held, they idle after
   * their tails. The engine's own value must agree too, in case its clock runs behind the schedule.
   */
  private fade(param: AudioParam, target: number, now: number, tc: number): void {
    let f = this.fades.get(param);
    if (!f) this.fades.set(param, f = { value: param.value, target: param.value, at: now, tc, held: false });
    const value = f.target + (f.value - f.target) * Math.exp(-(now - f.at) / f.tc);
    if (target === 0 && f.target === 0 && Math.abs(value) < SILENT && Math.abs(param.value) < SILENT) {
      if (!f.held) {
        param.cancelScheduledValues(0);
        param.setValueAtTime(0, now);
      }
      f.value = 0;
      f.held = true;
    } else {
      param.setTargetAtTime(target, now, tc);
      f.value = value;
      f.held = false;
    }
    f.target = target;
    f.at = now;
    f.tc = tc;
  }

  private chime(midi: number, velocity: number, pan: number, when: number, decay = 2.2, soft = false, gesture = false): void {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    out.connect(panner);
    panner.connect(this.musicBus);
    const f = hz(midi);
    const partials: [number, number][] = soft
      ? [[1, 1], [2, 0.12], [3, 0.025]]
      : [[1, 1], [2.0, 0.28], [3.01, 0.1], [4.2, 0.04]];
    if (gesture) this.gestureVoices.push({ midi, at: when, out });
    let remaining = partials.length;
    for (const [ratio, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      const g = ctx.createGain();
      const peak = velocity * amp * 0.16 * (gesture ? tuning.audio.gestureLevel : 1);
      g.gain.value = 0;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(peak, when + (soft ? tuning.audio.careChimeAttack : gesture ? tuning.audio.gestureAttack : 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, when + decay / ratio);
      g.gain.linearRampToValueAtTime(0, when + decay + 0.08);
      o.connect(g).connect(out);
      o.onended = () => {
        o.disconnect(); g.disconnect();
        if (--remaining === 0) {
          out.disconnect(); panner.disconnect();
          this.gestureVoices = this.gestureVoices.filter(v => v.out !== out);
        }
      };
      o.start(when);
      o.stop(when + decay + 0.1);
    }
  }

  /** A short tone with its own envelope, for birds and insects. */
  private tone(freq: number, to: number, when: number, length: number, level: number, pan: number, wet: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    o.frequency.exponentialRampToValueAtTime(to, when + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(level, when + Math.min(0.02, length * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, when + length);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    o.connect(g).connect(panner).connect(this.master);
    const send = wet > 0 ? ctx.createGain() : null;
    if (send) {
      send.gain.value = wet;
      panner.connect(send).connect(this.reverb);
    }
    g.gain.linearRampToValueAtTime(0, when + length + 0.04);
    o.onended = () => { o.disconnect(); g.disconnect(); panner.disconnect(); send?.disconnect(); };
    o.start(when);
    o.stop(when + length + 0.05);
  }

  /**
   * A coal taking the wind in the dark wood: a soft whoomph of air and then the hiss of it burning, which is the
   * one sound in the game the player makes happen with their hands alone.
   */
  private flare(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.02;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = NOISE_OVERLAP;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(240, t0);
    filter.frequency.exponentialRampToValueAtTime(1500, t0 + 0.22);
    filter.frequency.exponentialRampToValueAtTime(700, t0 + 1.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
    src.connect(filter).connect(gain);
    gain.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.3;
    gain.connect(send).connect(this.reverb);
    src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); send.disconnect(); };
    src.start(t0, Math.random() * 4);
    src.stop(t0 + 2);
  }

  /** A field cricket: three quick pulses of a high tone. */
  private cricket(when: number, pan: number, level: number): void {
    const f = 4300 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this.tone(f, f * 0.98, when + i * 0.045, 0.03, level, pan, 0.15);
  }

  /** A tawny owl far off: a soft hoo, a pause, a long wavering hoooo. */
  private owl(when: number, pan: number): void {
    this.tone(390, 370, when, 0.35, 0.05, pan, 0.8);
    this.tone(395, 360, when + 1.1, 1.3, 0.045, pan, 0.8);
  }

  /** The owl in the stump, close by: one soft, round hoo and a shorter one after, as if it were only clearing its throat. */
  private hoot(): void {
    const at = this.ctx!.currentTime + 0.05;
    this.tone(420, 392, at, 0.42, 0.075, 0.2, 0.55);
    this.tone(410, 380, at + 0.62, 0.3, 0.05, 0.2, 0.55);
  }

  /** A skylark high over the hills: a run of quick, bright, tumbling notes. */
  private skylark(when: number, pan: number, level: number): void {
    let t = when;
    const notes = 18 + Math.floor(Math.random() * 20);
    for (let i = 0; i < notes; i++) {
      const f = 2600 + Math.random() * 2400;
      const len = 0.04 + Math.random() * 0.06;
      this.tone(f, f * (0.9 + Math.random() * 0.25), t, len, level * (0.6 + Math.random() * 0.4), pan, 0.35);
      t += len + Math.random() * 0.05;
    }
  }

  /**
   * The cygnet's voice. It is the only sound either traveller ever makes, so it is kept for the few moments that
   * matter: a small bird calling for a family that is not coming back. Thin, high, and pitched to be heard over
   * nothing at all.
   */
  private peep(loudness = 1, longing = false, source?: AudioEmitter, asking = false): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.02;
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.85, Math.min(0.85, source?.pan ?? 0));
    out.gain.value = Math.min(1, tuning.audio.cygnetFullDistance / Math.max(tuning.audio.cygnetFullDistance, source?.distance ?? 0));
    out.connect(panner);
    panner.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.8;
    panner.connect(send).connect(this.reverb);

    /** Calling out to them is lower and longer than calling for help: less panic in it, and more hope. */
    const calls = asking ? 1 : longing ? 2 : 2 + Math.floor(Math.random() * 2);
    let remaining = calls;
    let at = t0;
    for (let i = 0; i < calls; i++) {
      const len = (longing ? 0.4 : asking ? 0.24 : 0.16) + Math.random() * 0.08;
      /** A cygnet's note is a thin whistle, well above where a crane chick's sat. */
      const f = (longing ? 1480 : asking ? 1850 : 2050) + Math.random() * 380 - i * 70;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.72, at);
      if (asking) {
        // A question: it dips and then goes up at the end.
        osc.frequency.exponentialRampToValueAtTime(f * 0.66, at + len * 0.45);
        osc.frequency.exponentialRampToValueAtTime(f * 1.3, at + len);
      } else {
        osc.frequency.exponentialRampToValueAtTime(f * 1.12, at + len * 0.3);
        osc.frequency.exponentialRampToValueAtTime(f * 0.62, at + len);
      }
      const waver = ctx.createOscillator();
      waver.frequency.value = 17 + Math.random() * 6;
      const depth = ctx.createGain();
      depth.gain.value = f * 0.035;
      waver.connect(depth).connect(osc.frequency);
      const throat = ctx.createBiquadFilter();
      throat.type = 'bandpass';
      throat.frequency.value = f * 1.5;
      throat.Q.value = 2.2;
      const env = ctx.createGain();
      const peak = 0.075 * loudness * (1 - i * 0.16);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(peak, at + 0.03);
      env.gain.setValueAtTime(peak, at + len * 0.5);
      env.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(throat).connect(env).connect(out);
      osc.onended = () => {
        osc.disconnect(); throat.disconnect(); env.disconnect();
        if (--remaining === 0) { out.disconnect(); panner.disconnect(); send.disconnect(); }
      };
      waver.onended = () => { waver.disconnect(); depth.disconnect(); };
      osc.start(at);
      osc.stop(at + len + 0.05);
      waver.start(at);
      waver.stop(at + len + 0.05);
      at += len + (longing ? 0.34 : 0.1) + Math.random() * 0.07;
    }
  }

  /**
   * A grown swan calling on the wing: two bugled notes, the second higher, nasal and carrying. `far` is 0 overhead
   * to 1 a long way off, which takes the top off it and leaves most of it in the air.
   */
  private bugle(source?: AudioEmitter, loudness = 1): void {
    const out = this.output;
    if (!out || !source?.active) return;
    if (source.distance >= tuning.audio.flockDistance) return;
    const pan = source.pan;
    const far = Math.min(1, source.distance / tuning.audio.flockDistance);
    const reach = Math.min(1, (1 - far) * 2);
    const level = reach * reach * (3 - 2 * reach);
    const { ctx } = out;
    const now = ctx.currentTime + 0.02;
    const base = 470 + Math.random() * 90;
    const voice = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4200 - 3000 * far;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    const dry = ctx.createGain();
    dry.gain.value = 1 - 0.6 * far;
    const send = ctx.createGain();
    send.gain.value = 0.5 + 0.5 * far;
    voice.connect(tone).connect(p);
    p.connect(dry).connect(out.bus);
    p.connect(send).connect(out.reverb);
    let remaining = 2;
    let at = now;
    for (const [ratio, len] of [
      [1, 0.2],
      [1.26, 0.34],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f = base * ratio;
      osc.frequency.setValueAtTime(f * 0.9, at);
      osc.frequency.exponentialRampToValueAtTime(f, at + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f * 0.95, at + len);
      /** Two fixed resonances over a moving note are what make it a throat and not a horn. */
      const mouth = ctx.createBiquadFilter();
      mouth.type = 'bandpass';
      mouth.frequency.value = 950;
      mouth.Q.value = 3;
      const nose = ctx.createBiquadFilter();
      nose.type = 'bandpass';
      nose.frequency.value = 1750;
      nose.Q.value = 4;
      const env = ctx.createGain();
      const peak = 0.05 * loudness * (1 - 0.55 * far) * level;
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(peak, at + 0.035);
      env.gain.setValueAtTime(peak * 0.8, at + len * 0.6);
      env.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(mouth).connect(env);
      const thin = ctx.createGain();
      thin.gain.value = 0.5;
      osc.connect(nose).connect(thin).connect(env);
      env.connect(voice);
      osc.onended = () => {
        osc.disconnect(); mouth.disconnect(); nose.disconnect(); thin.disconnect(); env.disconnect();
        if (--remaining === 0) { voice.disconnect(); tone.disconnect(); p.disconnect(); dry.disconnect(); send.disconnect(); }
      };
      osc.start(at);
      osc.stop(at + len + 0.05);
      at += len + 0.05;
    }
  }

  private phrase(name: 'kindled' | 'comfort'): void {
    const beat = PHRASE_BEAT[name];
    let at = this.nextPulse() + 0.05;
    for (const [midi, beats] of PHRASES[name]) {
      this.chime(midi, name === 'comfort' ? 0.5 * tuning.audio.careChimeLevel : 0.5, 0, at, Math.max(2.2, beats * beat * 3), name === 'comfort');
      at += beats * beat;
    }
  }

  private nextPulse(): number {
    const now = this.ctx!.currentTime;
    return Math.ceil(now / PULSE) * PULSE;
  }

  update(dt: number, s: SoundState): void {
    this.cueClock += dt;
    const ctx = this.ctx;
    if (!ctx || !this.running) {
      // Muted, hidden and not-started audio consume cues; an interruption keeps them briefly.
      if (this.interrupted) this.holdCues(s.cues);
      return;
    }
    const cues = this.heldCues.length ? this.releaseCues(s.cues) : s.cues;
    this.synthesise(dt);
    if (s.music === 'drowned' || s.drownedScore) this.prepareFoghorn();
    const now = ctx.currentTime;
    const tc = 0.08;
    const room = this.stairs(s, now, dt);
    if (!s.stairsAir) this.stairsSongGone = false;
    else if (s.stairsAir.phase !== 'under') this.stairsSongGone = true;
    const villageOnce = tuning.audio.recordedMusicOnce.villageApproach!;
    const villageAhead = this.villageAt === null ? (s.drownedScore ?? 'drift') === 'drift' && !s.drownedQuiet : now - this.villageAt < villageOnce.end;
    const belfryOnce = tuning.audio.recordedMusicOnce.belfry!, belfryFrom = belfryOnce.from ?? 0;
    // Decoded from when she reaches the belfry, so it is ready for the fourth ring.
    const belfryAhead = this.belfryAt === null ? s.drownedScore === 'refuge' || s.drownedScore === 'home' || !!s.bellsRung
      : now - this.belfryAt < belfryOnce.end - belfryFrom;
    const recorded = s.arrivalMusic ? (s.arrivalMusic === 'home' || s.arrivalMusic === 'mirror' || s.arrivalMusic === 'birches' || s.arrivalMusic === 'stairs' || s.arrivalMusic === 'lines' || s.arrivalMusic === 'boats' ? s.arrivalMusic
        : s.arrivalMusic === 'drowned' ? villageAhead ? 'villageApproach' : belfryAhead ? 'belfry' : null : null)
      : tuning.audio.stillPhraseExperiment && (s.stillDeparture || s.stillDepartureSoon) ? 'stillDeparture'
      : s.summitScore ? 'home' : s.mirrorScore ? 'mirror' : s.stairsAir && s.stairsAir.phase !== 'under' ? 'clouds'
      : s.stairsSong && !this.stairsSongGone ? 'stairs' : s.birchesScore && (s.birchesLoop || this.birchesScore) ? 'birches' : s.linesScore ? 'lines' : s.music === 'boats' ? 'boats' : null;
    if (recorded && !s.silence && !this.musicMuted) void this.prepareMusic(recorded);
    else if (this.preparedScore) {
      this.preparedScore.stop(0); this.preparedScore = null;
    }
    if (s.seaMusicTime !== undefined && !s.silence && !this.musicMuted) void this.prepareMusic('sea');
    if (s.arrivalMusic === 'sleeping' && !s.silence && !this.musicMuted) void this.prepareMusic('sleeping');
    const g = Math.min(s.gust / 26, 1);
    const winter = s.winterGust ?? 0;
    const weatherGust = winter * .76 * (1 - tuning.audio.nightWindUnder * Math.min(1, g / tuning.audio.nightWindUnderAt));
    const filterGust = g * tuning.audio.playerWindFilterRange;
    const musicalWind = s.forestWind;
    const playerWindGain = 10 ** ((tuning.audio.playerWindDb + tuning.audio.nightPlayerDb * Math.min(1, winter / .2)
      + (s.summitScore ? tuning.audio.homePlayerWindDb : 0)) / 20);
    const playerWindEase = 1 - tuning.audio.playerWindEase * g * g;
    const playerWind = playerWindGain * playerWindEase;
    const grassRustle = 10 ** (tuning.audio.grassRustleDb / 20) * playerWindEase;
    const gustLevel = Math.pow(g, 1.4) * playerWind;
    const whistleLevel = Math.max(0, g - .55) * playerWind;
    const rustleLevel = Math.max(Math.pow(g, 1.2) * grassRustle, Math.pow(weatherGust, 1.2));
    const piano = s.piano ?? 0;
    const air = (1 - piano * 0.82) * 10 ** (tuning.audio.windDb / 20);
    this.activity += (Math.max(g, s.charge) - this.activity) * (1 - Math.exp(-dt * (g > this.activity ? 2 : 0.25)));

    this.fade(this.breezeGain.gain, (0.02 + s.breeze * 0.2) * air * room.breeze, now, 0.5);
    this.fade(this.rainGain.gain, s.shower * 0.07, now, 1.2);
    this.fade(this.patterGain.gain, s.shower * (0.05 + 0.02 * Math.sin(now * 1.7)), now, 1.2);
    const muffle = s.seaMuffle ?? 0;
    this.fade(this.seaGain.gain, (0.05 + 0.035 * Math.sin(now * 0.8) * Math.sin(now * 0.37)) * (0.15 + 0.85 * s.sea) * (0.4 + 0.6 * s.breeze) * room.sea
      * (1 - tuning.audio.seaMuffleLevel * muffle), now, 0.3);
    this.seaFilter.frequency.setTargetAtTime(380 * (1 - tuning.audio.seaMuffleCutoff * muffle), now, 0.5);
    this.fade(this.gustGain.gain, gustLevel * 0.55 * air, now, tc);
    this.gustFilter.frequency.setTargetAtTime(260 + filterGust * 1100, now, tc);
    this.gustPan.pan.setTargetAtTime(s.pan * .7, now, tc);
    this.fade(this.whistleGain.gain, whistleLevel * 0.12 * air, now, tc);
    this.whistleFilter.frequency.setTargetAtTime(900 + filterGust * 900, now, tc);
    this.fade(this.nightGain.gain, Math.pow(weatherGust, 1.4) * 0.55 * air, now, tc);
    this.nightFilter.frequency.setTargetAtTime(260 + weatherGust * 1100, now, tc);
    this.fade(this.nightWhistleGain.gain, Math.max(0, weatherGust - .55) * 0.12 * air, now, tc);
    this.nightWhistleFilter.frequency.setTargetAtTime(900 + weatherGust * 900, now, tc);
    this.nightPan.pan.setTargetAtTime(Math.sin(now * .31) * .55, now, .3);
    this.fade(this.rustleGain.gain, (s.overLand || winter > 0) ? rustleLevel * 0.2 * air : 0, now, tc);
    this.fade(this.liftGain.gain, s.charge * (1 - tuning.audio.playerWindEase * s.charge * s.charge) * playerWindGain * 0.35 * air, now, 0.15);
    this.liftFilter.frequency.setTargetAtTime(220 + s.charge * 1500 * tuning.audio.playerWindFilterRange, now, 0.2);

    const activeScore = this.stillDepartureScore ?? this.cloudsScore ?? this.stillPhrases ?? this.openingScore ?? this.summitScore ?? this.mirrorScore ?? this.villageScore ?? this.belfryScore ?? this.linesScore ?? this.boatsScore ?? this.meadowScore ?? this.birchesScore ?? this.stairsScore ?? this.seaMusic;
    const mirrorAt = this.mirrorScore?.position(now);
    // The meadow's warm bed, playing out to its close as they sail, holds the next room's music like a once-played recording.
    const meadowCloses = activeScore ? undefined : meadowMusic.closesAt;
    const arrival = this.arrivalTransition.update(s, now, s.arrivalMusic ? activeScore?.handoffAt(now) ?? meadowCloses : now,
      !!s.arrivalMusic && (activeScore instanceof RecordedScore && activeScore.holdsHandoff || meadowCloses !== undefined),
      mirrorAt === undefined ? undefined : { position: mirrorAt, length: this.mirrorScore!.duration }), bg = arrival.background;
    // Leaving the Mirror: it fades itself into its chosen phrase seam while Home's start is held to the crossing.
    if (arrival.changed && arrival.stage === 'wait' && arrival.release !== undefined) this.mirrorScore?.finishAt(arrival.handoffAt, arrival.release);
    if (arrival.homeAt !== undefined) this.homeFrom = arrival.homeAt;
    else if (!bg.summitScore) this.homeFrom = undefined;
    if (arrival.changed && (arrival.stage === 'fade' || arrival.stage === 'gap')) {
      // Retire every outgoing source before the short rest ends; do not let long tails reopen with the next room.
      const fade = arrival.stage === 'fade' ? (arrival.fadeOut ?? tuning.audio.arrivalFadeOut) : .08;
      for (const score of [this.stillDepartureScore, this.stillPhrases, this.openingScore, this.summitScore, this.mirrorScore, this.villageScore, this.belfryScore, this.linesScore, this.boatsScore, this.meadowScore, this.birchesScore, this.stairsScore, this.cloudsScore]) score?.stop(fade);
      // The sea's recording is prepared as the passage begins, Sleeping's lullaby as it is asked for; only a handoff
      // away from each retires it.
      if (s.arrivalMusic !== 'sea') this.seaMusic?.stop(fade);
      if (s.arrivalMusic !== 'sleeping') this.sleepingMusic?.stop(fade);
    }
    const backgroundPaused = arrival.stage === 'gap';
    const homeMusicForward = !!bg.summitScore && !tuning.audio.homeMusicDucking;
    if (arrival.changed && arrival.stage !== 'wait' && !arrival.legato) {
      for (const gain of this.gates) {
        gain.cancelAndHoldAtTime(now);
        // Holding an already constant parameter need not insert an automation event. Without
        // this anchor, the incoming ramp can start at the beginning of the rest.
        gain.setValueAtTime(gain.value, now);
        if (arrival.stage === 'fade') gain.linearRampToValueAtTime(0, now + (arrival.fadeOut ?? tuning.audio.arrivalFadeOut));
        else if (backgroundPaused) gain.setValueAtTime(0, now);
        else gain.linearRampToValueAtTime(1, now + (arrival.fadeIn ?? tuning.audio.arrivalFadeIn));
      }
    }
    if (bg.music === 'boats' && !s.silence && !backgroundPaused && (!this.musicMuted || this.boatsScore)) {
      this.boatsScore ??= this.takeRecordedScore('boats');
      this.boatsScore.update('play', 10 ** (tuning.audio.recordedMusicDb.boats / 20) * (1 - piano));
    } else if (this.boatsScore) {
      this.boatsScore.stop(s.silence ? .12 : 1.8); this.boatsScore = null;
    }
    // The recording carries its own dynamics: no hush, only room under the whale's calls.
    if (s.seaMusicTime === undefined || s.silence) {
      this.seaMusic?.stop(s.silence ? .12 : 1.8); this.seaMusic = null;
    } else if (bg.music === 'sea' && bg.seaScore && !backgroundPaused && this.seaMusic) {
      this.seaMusic.update(s.seaMusicTime, s.seaPhrase ?? -1,
        10 ** ((tuning.audio.recordedMusicDb.sea + tuning.audio.whaleCallRoomDb * (s.whaleCalling ?? 0)) / 20) * (1 - piano));
    }
    // Sleeping's recordings carry their own dynamics: no hush. Arriving it is bedtime; leaving, past the curtains.
    if (bg.sleepingScore && !s.silence && !backgroundPaused && (this.sleepingMusic || !this.musicMuted)) {
      this.sleepingMusic ??= new SleepingMusic(ctx, this.backgroundDry);
      this.sleepingMusic.update(s.sleepingMusic ?? (bg.sleepingScore === 'shelter' ? 'bedtime' : 'glide'), 1 - piano);
    } else if (this.sleepingMusic && (s.arrivalMusic !== 'sleeping' || s.silence)) {
      this.sleepingMusic.stop(s.silence ? .12 : 1.8); this.sleepingMusic = null;
    }
    // The meadow plays its recordings in place of its pad and synthesised score; a handoff away fades them.
    meadowMusic.update(bg.music === 'meadow' && !s.silence && !backgroundPaused && arrival.stage !== 'fade'
      ? s.meadowMusic ?? (bg.meadowScore === 'return' ? 'onward' : 'walk') : undefined,
      1 - piano, this.musicMuted, (this.backgroundGate?.gain.value ?? 1) > .98, s.silence ? .12 : arrival.fadeOut ?? 1.8);
    // Birches loops on its island and the approach to it, and never begins once they have sailed: the pass under way
    // plays out, ending `stairsSongRest` before the stairs song can begin.
    if (bg.music === 'birches' && bg.birchesScore && !s.silence && !backgroundPaused
      && (this.birchesScore || s.birchesLoop && !this.musicMuted)) {
      this.birchesScore ??= this.takeRecordedScore('birches');
      if (!s.birchesLoop) {
        this.birchesScore.playOut();
        const at = this.birchesScore.position(now), { stairsSongRest: rest, birchesSailFade: fade } = tuning.audio;
        if (at !== undefined && s.arrivalIn !== undefined && s.arrivalIn <= rest + fade && !this.birchesEndSet) {
          this.birchesEndSet = true;
          const end = now + Math.max(0, s.arrivalIn - rest);
          if (now + this.birchesScore.duration - at > end) this.birchesScore.finishAt(end, fade);
        }
      }
      this.birchesScore.update(bg.birchesScore, 10 ** (tuning.audio.recordedMusicDb.birches / 20) * (1 - piano));
      if (this.birchesScore.position(now) !== undefined) this.birchesHeard = now;
    } else if (this.birchesScore) {
      this.birchesScore.stop(s.silence ? .12 : 1.8); this.birchesScore = null;
    }
    if (!this.birchesScore) this.birchesEndSet = false;
    // The stairs song loops under the cloud; up in the white it fades for good, and silence holds until `clouds.ogg`.
    // A boat sped on by gusts can bring its entrance sooner than foreseen: it still waits out the rest.
    if (bg.music === 'birches' && bg.stairsSong && !this.stairsSongGone && !s.silence && !backgroundPaused
      && (this.stairsScore || !this.musicMuted && now >= this.birchesHeard + tuning.audio.stairsSongRest)) {
      this.stairsScore ??= this.takeRecordedScore('stairs');
      this.stairsScore.update('under', 10 ** (tuning.audio.recordedMusicDb.stairs / 20) * (1 - piano));
    } else if (this.stairsScore) {
      this.stairsScore.stop(s.silence ? .12 : this.stairsSongGone ? tuning.audio.stairsSongCloudFade : 1.8); this.stairsScore = null;
    }
    // Once she stands at the top with the haze lifted off the sun, `clouds.ogg` plays once on its own clock; the
    // village's music waits for its end. No hush or fog thinning: the recording carries its own dynamics.
    const stairsMusic = !!s.stairsAir && bg.music === 'birches';
    const onTop = stairsMusic && s.stairsAir!.clear;
    if (onTop && this.cloudsAt === null) this.cloudsAt = now;
    const cloudsFrom = (this.cloudsAt ?? Infinity) + tuning.audio.cloudsMusicDelay;
    if (now >= cloudsFrom && bg.music === 'birches' && !s.silence && !backgroundPaused && (this.cloudsScore || onTop && !this.musicMuted)) {
      const late = now - Math.max(cloudsFrom, this.cloudsAt!) > tuning.audio.recordedMusicFade;
      this.cloudsScore ??= this.takeRecordedScore('clouds');
      this.cloudsScore.update('top', 10 ** (tuning.audio.recordedMusicDb.clouds / 20) * (1 - piano), now - cloudsFrom, late);
    } else if (this.cloudsScore) {
      this.cloudsScore.stop(s.silence ? .12 : 1.8); this.cloudsScore = null;
    }
    if (!s.stairsAir && !this.cloudsScore) this.cloudsAt = null;
    if (bg.music === 'lines' && bg.linesScore && !s.silence && !backgroundPaused && (!this.musicMuted || this.linesScore)) {
      this.linesScore ??= this.takeRecordedScore('lines');
      this.linesScore.update(bg.linesScore, 10 ** (tuning.audio.recordedMusicDb.lines / 20) * (1 - piano));
    } else if (this.linesScore) {
      this.linesScore.stop(s.silence ? .12 : 1.8); this.linesScore = null;
    }
    const forestEntry = arrival.legato && arrival.stage === 'blend' && arrival.changed;
    if (forestEntry) this.forestBlendUntil = now + tuning.audio.forestMusicBlend;
    // Dynamics are already composed into these arrangements; hush must not attenuate them twice.
    // A handoff already fading the Mirror out must not begin its recording just to fade it.
    if (bg.mirrorScore && !s.silence && !backgroundPaused && (!this.musicMuted || this.mirrorScore) && (this.mirrorScore || arrival.stage !== 'fade')) {
      this.mirrorScore ??= this.takeRecordedScore('mirror');
      this.mirrorScore.update(bg.mirrorScore, 10 ** (tuning.audio.recordedMusicDb.mirror / 20) * (1 - piano));
    } else if (this.mirrorScore) {
      this.mirrorScore.stop(s.silence ? .12 : 1.8); this.mirrorScore = null;
    }
    // The village's approach plays once, from its top as the village's music begins, to the seam before the bass, on
    // its own clock; the rescue's quiet lets it go early, for good. Nothing follows it in the village or the storm.
    if (bg.music !== 'drowned') this.villageAt = null;
    else if (s.drownedQuiet) this.villageAt = -Infinity;
    else if (this.villageAt === null && bg.drownedScore === 'drift' && !s.silence && !backgroundPaused) this.villageAt = now;
    const villageTime = this.villageAt === null ? Infinity : now - this.villageAt;
    if (villageTime < villageOnce.end && !s.drownedQuiet && !s.silence && !backgroundPaused && (this.villageScore || !this.musicMuted)) {
      this.villageScore ??= this.takeRecordedScore('villageApproach');
      this.villageScore.update('approach', 10 ** (tuning.audio.recordedMusicDb.villageApproach / 20) * (1 - piano), villageTime, false, true);
    } else if (this.villageScore) {
      this.villageScore.stop(s.drownedQuiet ? tuning.drowned.rescue.musicFade : s.silence ? .12 : 1.8);
      this.villageScore = null;
    }
    // The belfry's goodbye comes in slowly from the fourth ring (or with a save past it) and plays once on its own clock
    // to its end fade, through boarding, the look back and on into the storm: nothing in the village cuts it.
    if (s.music !== 'drowned') this.belfryAt = null;
    else if (this.belfryAt === null && s.bellsRung && !s.silence) this.belfryAt = now;
    const belfryTime = this.belfryAt === null ? Infinity : now - this.belfryAt;
    if (belfryTime < belfryOnce.end - belfryFrom && !s.silence && !backgroundPaused && (this.belfryScore || !this.musicMuted)) {
      this.belfryScore ??= this.takeRecordedScore('belfry');
      this.belfryScore.update('goodbye', 10 ** (tuning.audio.recordedMusicDb.belfry / 20) * (1 - piano), belfryFrom + belfryTime,
        belfryTime > tuning.audio.recordedMusicFade, true);
    } else if (this.belfryScore) {
      this.belfryScore.stop(s.silence ? .12 : 1.8); this.belfryScore = null;
    }
    const ending = s.homeEndingTime;
    if (ending === undefined) { this.homeJumped = false; this.homeSplicedTo = -Infinity; }
    if (ending === undefined && s.homeSetDownIn === undefined) this.homeAskAt = undefined;
    // As the cygnet is set down, Home goes on at a cycle seam into its own quiet opening, which loops while it asks.
    const asking = this.summitScore?.position(now);
    if (s.homeSetDownIn !== undefined && ending === undefined && this.homeAskAt === undefined && asking !== undefined) {
      const entry = homeAskEntry(asking, this.summitScore!.duration, s.homeSetDownIn);
      const at = entry ?? (s.homeAsk ? tuning.audio.fogFade : undefined);
      if (at !== undefined) {
        this.homeAskAt = now + at;
        this.summitScore!.finishAt(this.homeAskAt, Math.min(at, entry === undefined ? tuning.audio.fogFade : tuning.audio.homeSeamCut));
        this.summitScore!.cueAt(this.homeAskAt, HOME_ASK.from, 0, [HOME_ASK.from, HOME_ASK.to]);
      }
    }
    if (bg.music === 'home' && bg.summitScore && !s.silence && !backgroundPaused && (!this.musicMuted || this.summitScore)
      && (!s.homeAsk || this.summitScore)) {
      const earlier = !!this.summitScore;
      this.summitScore ??= this.takeRecordedScore('home');
      if (ending !== undefined && !this.homeJumped) {
        // The ask hands over at the exit the story's clock was set by, on the ending's attack. With no ask sounding, a
        // pass still sounding ends first, and the return joins the phrase where it has got to.
        this.homeJumped = true;
        const score = this.summitScore, zero = now - ending, quick = tuning.audio.homeQuickFade;
        const attack = zero + tuning.audio.homeJumpAt - HOME_JUMP_LEAD;
        const exit = earlier && this.homeAskAt !== undefined ? homeAskExitNear(this.homeAskAt, now, attack) : undefined;
        if (exit) {
          if (exit.at > this.homeAskAt! + 1e-3) score.finishAt(exit.at, Math.min(exit.release, exit.at - now));
          score.cueAt(exit.at, homeEndingPosition(exit.at - zero), tuning.audio.homeSpliceFadeIn);
        } else {
          const position = earlier ? score.position(now) : undefined;
          if (position !== undefined && score.silentFrom(now) > now + quick) {
            const end = homeEnding(position, score.duration, quick, quick);
            score.finishAt(now + end.at, end.release);
          }
          const at = Math.max(attack, earlier ? score.silentFrom(now) : now, now);
          score.cueAt(at, homeEndingPosition(at - zero), at > attack ? tuning.audio.homeQuickFadeIn : 0);
        }
      }
      // After the Mirror, Home keeps the time it was scheduled for, even if music comes back on later.
      const scheduled = ending === undefined && this.homeFrom !== undefined;
      this.summitScore.update(bg.summitScore,
        10 ** (tuning.audio.recordedMusicDb.home / 20) * (homeMusicForward ? 1 : 1 - .92 * bg.hush) * (1 - piano),
        scheduled ? Math.max(0, now - this.homeFrom!) : ending === undefined ? 0 : homeEndingPosition(ending), false, ending !== undefined || scheduled);
      // The ending's later passages take over attack to attack, each placed a second ahead on the ending's clock.
      const next = ending === undefined ? undefined : homeEndingNext(ending);
      if (next && next.at > this.homeSplicedTo && next.at - ending! < 1 && this.summitScore.position(now) !== undefined) {
        this.homeSplicedTo = next.at;
        const at = now + next.at - ending!;
        this.summitScore.finishAt(at, Math.min(tuning.audio.homeSpliceFade, at - now));
        this.summitScore.cueAt(at, next.from, tuning.audio.homeSpliceFadeIn);
      }
    } else if (this.summitScore) {
      this.summitScore.stop(s.silence ? .12 : 1.8); this.summitScore = null; this.homeAskAt = undefined;
    }
    const stillExperiment = tuning.audio.stillPhraseExperiment && !!bg.openingScore && bg.music === 'still';
    if (stillExperiment && s.stillDeparture && !s.silence && !backgroundPaused && (!this.musicMuted || this.stillDepartureScore)) {
      this.stillDepartureScore ??= this.takeRecordedScore('stillDeparture');
      this.stillDepartureScore.update('departure', 10 ** (tuning.audio.stillDepartureDb / 20), tuning.audio.stillDepartureOffset);
    } else if (this.stillDepartureScore) {
      this.stillDepartureScore.stop(s.silence ? .12 : 1.8); this.stillDepartureScore = null;
    }
    if (stillExperiment && s.startingIsland && !s.stillDeparture && !s.stillDepartureSoon && !s.silence && !backgroundPaused && (!this.musicMuted || this.stillPhrases)) {
      this.stillPhrases ??= new StillPhrases(ctx, this.backgroundDry);
      if (!s.scripted && !this.musicMuted) {
        if (s.stillPhrase) this.stillPhrases.trigger();
        else if (s.stillFlying) this.stillPhrases.trigger(tuning.audio.stillFlightEvery);
      }
      if (s.scripted) this.stillPhrases.finish();
    } else if (this.stillPhrases) {
      this.stillPhrases.stop(); this.stillPhrases = null;
    }
    if (!stillExperiment && bg.music === 'still' && bg.openingScore && !s.silence && !backgroundPaused) {
      this.openingScore ??= new OpeningScore(ctx, this.padVoices);
      this.openingScore.update(bg.openingScore);
      this.mood = bg.music;
      this.chord = -1;
    } else if (this.openingScore) {
      this.openingScore.stop(); this.openingScore = null;
    }
    const mood = MOODS[bg.music] ?? MOODS.meadow;
    const chord = bg.music === 'wood' && now < this.forestBlendUntil ? 0 : Math.floor(now / mood.seconds) % mood.chords.length;
    if (s.silence) {
      this.fade(this.musicBus.gain, 0, now, 0.12);
      if (this.backgroundBus) this.fade(this.backgroundBus.gain, 0, now, 0.12);
    }
    if (!this.openingScore && (chord !== this.chord || bg.music !== this.mood)) {
      /** A room change glides the voices to their new notes rather than cutting: the chord bends into the next. */
      const glide = bg.music !== this.mood ? 3.5 : 1.2;
      this.chord = chord;
      this.mood = bg.music;
      this.padVoices.forEach((voice, i) => {
        const f = hz(mood.chords[chord][i]);
        voice.osc.forEach((o) => {
          // The pad was silent through the village and the storm. Tune it before bringing it in.
          if (forestEntry) { o.frequency.cancelScheduledValues(now); o.frequency.setValueAtTime(f, now); }
          else o.frequency.setTargetAtTime(f, now, glide);
        });
        voice.gain.gain.setTargetAtTime(0.25, now, 2.5);
      });
    }
    const hush = (1 - 0.92 * bg.hush) * (1 - piano);
    const padLife = 0.012 + 0.045 * s.life;
    // The opening grows less with life; wind warms it in the same proportion.
    const lifeLevel = this.openingScore ? 0.012 + tuning.audio.openingPadRise * s.life : padLife;
    // The village and the storm keep no pad; the wood's drone (and the crossing on from it) sits `woodDroneDb` down.
    const woodDrone = bg.music === 'wood' && !bg.sleepingScore ? 10 ** (tuning.audio.woodDroneDb / 20) : 1;
    this.fade(this.padGain.gain,
      stillExperiment || backgroundPaused || bg.seaScore || bg.music === 'drowned' || stairsMusic || this.cloudsScore || this.summitScore || this.mirrorScore || bg.sleepingScore || this.meadowScore || this.birchesScore || this.stairsScore || this.linesScore || this.boatsScore ? 0 : (lifeLevel * (1 - 0.35 * s.night) + this.activity * tuning.audio.padActivityLevel * lifeLevel / padLife) * hush * mood.level * woodDrone * (this.openingScore ? this.openingScore.gainAt(now) * 10 ** (tuning.audio.openingScoreDb / 20) : 1),
      now,
      piano > 0 ? tuning.piano.mixResponse : now < this.forestBlendUntil ? tuning.audio.forestMusicBlend / 3 : bg.hush > 0.5 ? 0.7 : 1.5,
    );
    this.padFilter.frequency.setTargetAtTime(mood.cutoff + 260 * s.life - 200 * s.night, now, 2.5);

    const harmonyAt = (at: number): readonly number[] => {
      const composed = this.openingScore?.chordAt(at) ?? this.meadowScore?.chordAt(at);
      if (composed) return composed;
      // During the music-free arrival gap, use the opening harmony of the incoming composition.
      if (backgroundPaused) {
        if (bg.meadowScore) return MEADOW_SECTIONS[bg.meadowScore].chords[0].tones;
        if (bg.music === 'boats') return BOATS_CHORDS[0];
      }
      const index = Math.floor(at / mood.seconds) % mood.chords.length;
      const tones = mood.chords[index];
      // The wood's upper semitones belong to its unsettled drone; touch answers on its steady D/A pedal.
      return bg.music === 'wood' ? MOODS.wood.chords[0] : tones;
    };
    const forestChimes = !!s.forestWind && !s.caringWind;
    // The wood's original minor palette includes notes outside the D/A pedal. Let them ring.
    const gestureHarmonyAt = (at: number): readonly number[] => forestChimes ? MOODS.wood.scale : harmonyAt(at);
    // Release gesture tails outside musical wind scenes, and incompatible notes at harmonic changes.
    this.gestureVoices = this.gestureVoices.filter(voice => {
      if (musicalWind && gestureHarmonyAt(Math.max(now, voice.at)).some(m => (m - voice.midi) % 12 === 0)) return true;
      voice.out.gain.cancelAndHoldAtTime(now);
      voice.out.gain.setValueAtTime(voice.out.gain.value, now);
      voice.out.gain.linearRampToValueAtTime(0, now + tuning.audio.gestureTailRelease);
      return false;
    });

    for (const name of cues) {
      if (name === 'foghorn') { this.foghorn(); }
      else if (name === 'flightHome') flightKnock(ctx, this.master, this.reverb, this.noiseWork?.ready ? this.noise : null);
      else if (name === 'kindled' || name === 'comfort') {
        this.flare();
        this.phrase(name);
      } else if (name === 'hoot') {
        this.hoot();
      } else if (name === 'puzzled') {
        this.peep(0.6, false, s.cygnet, true);
      } else if (name === 'distress' || name === 'calling') {
        this.peep(name === 'distress' ? 1 : 0.95, name === 'calling', s.cygnet);
        this.flockQuietUntil = now + tuning.audio.callSpace;
      } else if (name === 'bugle') {
        this.bugle(s.flock);
        this.flockQuietUntil = now + tuning.audio.callSpace;
      }
    }

    if (s.flockChatter !== false && s.flock?.active && now > this.nextFlock && now > this.flockQuietUntil) {
      this.bugle(s.flock, 0.8 + Math.random() * 0.4);
      this.nextFlock = now + 1.6 + Math.random() * 4.5;
    }

    const wildlife = Math.max(0, Math.min(1, s.land)) * (1 - Math.min(1, s.cold))
      * Math.max(0, 1 - s.shower / 0.6);
    if (wildlife > 0.1 && s.night > 0.3 && now > this.nextCricket) {
      this.cricket(now + 0.05, Math.random() * 1.6 - 0.8, 0.012 * s.night * wildlife);
      this.nextCricket = now + 0.25 + Math.random() * (1.6 - s.night);
    }
    if (wildlife > 0.5 && s.night > 0.7 && now > this.nextOwl) {
      this.owl(now + 0.1, Math.random() * 1.2 - 0.6);
      this.nextOwl = now + 25 + Math.random() * 30;
    }
    if (s.meadow > 0.5 && s.night < 0.2 && s.shower < 0.2 && now > this.nextLark) {
      this.skylark(now + 0.1, Math.random() * 1.4 - 0.7, 0.01 * s.meadow);
      this.nextLark = now + 6 + Math.random() * 10;
    }

    // Musical wind accompanies the forest search.
    const gestures = musicalWind && !s.scripted && !s.silence && !(s.pianoActive ?? (piano >= 0.05));
    const care = !!s.caringWind;
    const scale = care ? [62, 64, 69, 71, 74, 76] : forestChimes ? MOODS.wood.scale : mood.scale;
    const velocity = care ? tuning.audio.careChimeLevel : 1;
    const gusting = s.gust > tuning.pointer.minGust && gestures;
    const lifting = s.charge > tuning.pointer.minLift && gestures;
    const at = this.nextPulse();
    const interval = PULSE * (s.forestWind ? tuning.audio.forestChimePulses : tuning.audio.gesturePulses);
    const ready = at - Math.max(this.lastNote, this.lastArp) >= interval - 1e-3;
    const glider = s.gliderLift > .45 && this.prevGliderLift <= .45 && now - this.lastGlider > 2.5 && gestures;
    if (glider && ready) {
      const base = forestChimes ? MOODS.wood.chords[0][0] + 24 : chordNote(harmonyAt(at)[0] + 24, harmonyAt(at), 62, 81);
      this.chime(base, .4 * velocity, 0, at, 1.8, care, true);
      this.chime(forestChimes ? base + 7 : chordNote(base + 7, harmonyAt(at + interval), base + 1, Math.min(86, base + 12)),
        .35 * velocity, 0, at + interval, 2.2, care, true);
      this.lastNote = this.lastArp = at + interval;
      this.lastGlider = now;
    } else if ((gusting || lifting) && ready) {
      // One answer per pulse: circular pointer input can be both gust and lift.
      if (lifting) {
        const step = Math.floor(at / (forestChimes ? interval : PULSE * 2)) % 4;
        const pitch = forestChimes ? MOODS.wood.chords[0][step] + 12
          : chordNote([62, 66, 69, 74][step], harmonyAt(at), 62, 81);
        this.chime(pitch,
          (.25 + s.charge * .35) * velocity, s.pan, at, 1.6, care, true);
        this.lastArp = at;
      } else {
        this.noteIndex = (this.noteIndex + (s.rise >= 0 ? 1 : -1) + scale.length) % scale.length;
        const wanted = scale[this.noteIndex];
        this.chime(forestChimes ? wanted : chordNote(wanted, harmonyAt(at), scale[0], Math.min(86, scale[scale.length - 1])),
          (.45 + g * .55) * velocity, s.pan, at, 2.2, care, true);
        this.lastNote = at;
      }
    }

    this.prevGliderLift = s.gliderLift;
  }

  /** The stairs in the clouds keep their own air, and say how much of the shared beds and the birches' phrase to keep. */
  private stairs(s: SoundState, now: number, dt: number): Readonly<StairsMix> {
    if (s.stairsAir && !this.stairsSound) this.stairsSound = new StairsSound(this.ctx!, this.master, this.reverb);
    if (!this.stairsSound) return OUTSIDE_STAIRS;
    const mix = this.stairsSound.update(s.stairsAir, this.noiseWork?.ready ? this.noise : null, now, dt);
    if (this.stairsSound.finished) this.stairsSound = null;
    return mix;
  }

  private holdCues(cues: readonly Cue[]): void {
    for (const cue of cues) this.heldCues.push({ cue, at: this.cueClock });
    if (this.heldCues.length) this.heldCues = this.heldCues.filter(held => this.cueClock - held.at <= this.cueLife(held.cue));
  }

  /** Cues still meaningful after an interruption play before this frame's; stale ones are dropped. */
  private releaseCues(cues: readonly Cue[]): Cue[] {
    const fresh = this.heldCues.filter(held => this.cueClock - held.at <= this.cueLife(held.cue)).map(held => held.cue);
    this.heldCues.length = 0;
    return [...fresh, ...cues];
  }

  private cueLife(cue: Cue): number {
    // The horn keeps its own lateness allowance, so a late call can never reach the thunder.
    return cue === 'foghorn' ? tuning.storm.foghornLateAllowance : tuning.audio.heldCueLife;
  }
}

/** At most this many notes may be sounding at once, so a storm of gestures cannot pile up oscillators. */
const PIANO_VOICES = 10;

/** How flat or sharp each key has drifted, in cents: the same key is always out by the same amount. */
function outOfTune(midi: number): number {
  const h = Math.sin(midi * 12.9898) * 43758.5453;
  return (h - Math.floor(h) - 0.5) * 13;
}

/**
 * The upright piano standing in the meadow. Felted hammers gone soft, a case that has been
 * out in the weather, and strings that have drifted apart from each other: a dull, warm tone with a little beating
 * in it and the knock of the action underneath. Synthesised like everything else here; nothing is sampled.
 */
export class PianoStrings {
  private out: AudioOut | null = null;
  private ctx: BaseAudioContext | null = null;
  private knock: AudioBuffer | null = null;
  /** When each voice frees up, so a run can never start more notes than the piano has strings for. */
  private readonly ends = new Float64Array(PIANO_VOICES);

  setOutput(out: AudioOut | null): void {
    // Muting suspends the same context with its notes still scheduled, so reservations last as long as the context.
    if (out && out.ctx !== this.ctx) {
      this.ctx = out.ctx;
      this.knock = null;
      this.ends.fill(0);
    }
    this.out = out;
  }

  /** One note: velocity is strike strength, level is proximity. Optional audio time and returned sources
   * let a composed score schedule ahead and release the note on a story transition. */
  note(midi: number, velocity: number, pan: number, level: number, when?: number): AudioScheduledSourceNode[] {
    const out = this.out;
    if (!out || level <= 0.01) return [];
    const { ctx } = out;
    const now = when ?? ctx.currentTime;
    let slot = -1;
    for (let i = 0; i < PIANO_VOICES; i++) if (this.ends[i] <= now) slot = i;
    if (slot < 0) return [];
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    let remaining = 0;
    const track = (source: AudioScheduledSourceNode): void => {
      sources.push(source); remaining++;
      source.onended = () => {
        source.disconnect();
        if (--remaining === 0) for (const node of nodes) node.disconnect();
      };
    };

    const t0 = now + 0.012;
    const f = hz(midi) * Math.pow(2, outOfTune(midi) / 1200);
    /** Long in the bass, short and dead in the treble, and a soft blow rings for less time than a hard one. */
    const decay = (midi < 60 ? 5 : midi < 72 ? 3.6 : 2.5) * (0.7 + 0.5 * velocity);
    this.ends[slot] = t0 + decay + 0.2;

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.7, Math.min(0.7, pan));
    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    panner.connect(dry).connect(out.bus);
    panner.connect(wet).connect(out.reverb);

    /** Felt: the harder it is hit the brighter it starts, and the brightness is gone within the first second. */
    const felt = ctx.createBiquadFilter();
    felt.type = 'lowpass';
    felt.Q.value = 0.5;
    felt.frequency.setValueAtTime(Math.min(12000, 900 + f * 3 + velocity * 6500), t0);
    felt.frequency.exponentialRampToValueAtTime(Math.min(7000, 700 + f * 2.2), t0 + 0.9);
    felt.connect(panner);
    nodes.push(panner, dry, wet, felt);

    const peak = 0.085 * velocity * level;
    /**
     * What makes a struck string a piano and not an organ: a dozen partials, each a little sharper than a true
     * harmonic because the wire is stiff; the ones the hammer's striking point cancels left weak; every partial
     * dropping fast at first and then ringing on quietly; and the high ones gone long before the low ones.
     */
    const stiffness = 0.00018 * Math.pow(2, (midi - 48) / 9);
    const count = midi < 60 ? 12 : midi < 72 ? 9 : 6;
    for (let n = 1; n <= count; n++) {
      const pf = f * n * Math.sqrt(1 + stiffness * n * n);
      if (pf > 11000) break;
      const struck = Math.abs(Math.sin((n * Math.PI) / 8.3));
      const amp = (struck * (0.35 + 0.65 * velocity ** (n * 0.18))) / Math.pow(n, 1.15);
      const life = decay / (1 + (n - 1) * 0.42);
      const strings = n <= 3 ? 2 : 1;
      for (let k = 0; k < strings; k++) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = pf;
        if (strings === 2) o.detune.value = k === 0 ? -2.2 : 2.6;
        const g = ctx.createGain();
        const top = (peak * amp) / strings;
        g.gain.value = 0;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(top, t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(top * 0.3, t0 + 0.06 + life * 0.09);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + life);
        o.connect(g).connect(felt);
        nodes.push(g); track(o);
        o.start(t0);
        o.stop(t0 + life + 0.05);
      }
    }

    if (!this.knock) {
      const len = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
      this.knock = buffer;
    }
    /** The key hitting the keybed: an old action is as much wood as it is string. */
    const src = ctx.createBufferSource();
    src.buffer = this.knock;
    const wood = ctx.createBiquadFilter();
    wood.type = 'bandpass';
    wood.frequency.value = 180 + Math.random() * 90;
    wood.Q.value = 1.4;
    const thump = ctx.createGain();
    // A gain left at 1 until its first event lets one sample of a sub-sample start through as a click.
    thump.gain.value = 0;
    thump.gain.setValueAtTime(0.05 * velocity * level, t0);
    thump.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    src.connect(wood).connect(thump).connect(panner);
    /** The hammer itself: a few milliseconds of bright noise on the front of the note, which is most of its bite. */
    const hammer = ctx.createBufferSource();
    hammer.buffer = this.knock;
    const bite = ctx.createBiquadFilter();
    bite.type = 'bandpass';
    bite.frequency.value = Math.min(6000, 1400 + f * 2);
    bite.Q.value = 0.8;
    const click = ctx.createGain();
    click.gain.value = 0;
    click.gain.setValueAtTime(0.09 * velocity * velocity * level, t0);
    click.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    hammer.connect(bite).connect(click).connect(panner);
    nodes.push(wood, thump, bite, click); track(hammer); track(src);
    hammer.start(t0);
    hammer.stop(t0 + 0.05);
    src.start(t0);
    src.stop(t0 + 0.12);
    return sources;
  }
}

/** Firefox has no `cancelAndHoldAtTime`, and every score relies on it; hold the current value instead. */
function holdFallback(): void {
  const param: Partial<AudioParam> = AudioParam.prototype;
  if (param.cancelAndHoldAtTime) return;
  param.cancelAndHoldAtTime = function (this: AudioParam, time: number): AudioParam {
    const value = this.value;
    this.cancelScheduledValues(time);
    return this.setValueAtTime(value, time);
  };
}
