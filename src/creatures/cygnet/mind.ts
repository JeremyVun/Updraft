import * as THREE from 'three';

/** What reaches it this frame. Whoever owns the world fills this in; the mind never looks anything up for itself. */
export interface Senses {
  /** Its own eye, and the child's face and how fast they are moving. */
  eye: THREE.Vector3;
  face: THREE.Vector3;
  childSpeed: number;
  /** How far it is from the child over the ground. */
  gap: number;
  /** The child's hands, when they are coming toward it. */
  hands: THREE.Vector3 | null;
  plane: THREE.Vector3 | null;
  creature: THREE.Vector3 | null;
  flock: THREE.Vector3 | null;
  /** Light the player has made in the dark. */
  light: THREE.Vector3 | null;
  /** The air where it is: velocity over the ground, how much of it is a gust the player made, and how much is lifting. */
  wind: { x: number; z: number; energy: number; lift: number };
  cold: number;
  rain: number;
  dark: number;
  /** On the ground on its own feet, riding on the child, or in the air. */
  where: 'afoot' | 'riding' | 'airborne' | 'down';
  /** It is doing something it should not wander off from of its own accord. */
  busy: boolean;
  /** It is in the middle of something physical (a hop, a landing, being handed over) that not even a fright may cut across. */
  locked: boolean;
}

export type Act =
  | 'preen-breast'
  | 'preen-wing'
  | 'preen-back'
  | 'nibble'
  | 'stretch'
  | 'yawn'
  | 'shake'
  | 'wag'
  | 'look-about'
  | 'snap'
  | 'flinch'
  | 'brace'
  | 'bowled'
  | 'into-wind'
  | 'ask'
  | 'nuzzle'
  | 'peer'
  | 'delve'
  | 'tug'
  | 'nudge'
  | 'look-back'
  | 'shiver';

interface ActSpec {
  dur: number;
  /** Seconds before it will do the same thing again. */
  rest: number;
  where: Senses['where'][];
  /** How much it feels like doing this right now; 0 rules it out. */
  urge: (m: Mind, s: Senses) => number;
}

const afoot: Senses['where'][] = ['afoot'];
const anywhere: Senses['where'][] = ['afoot', 'riding'];
const riding: Senses['where'][] = ['riding'];

/** The things it does of its own accord. Reactions (flinch, brace, bowled, into-wind, ask) are started by events, not chosen. */
const IDLE: Partial<Record<Act, ActSpec>> = {
  'preen-breast': { dur: 2.2, rest: 14, where: anywhere, urge: (m) => 0.8 * m.ease },
  'preen-wing': { dur: 2.6, rest: 16, where: anywhere, urge: (m) => 0.9 * m.ease },
  'preen-back': { dur: 2.4, rest: 22, where: afoot, urge: (m) => 0.6 * m.ease },
  nibble: { dur: 1.6, rest: 7, where: afoot, urge: (m, s) => (s.childSpeed < 0.5 ? 1.1 : 0.2) * m.ease * (1 - s.dark) },
  stretch: { dur: 2.8, rest: 40, where: afoot, urge: (m) => 0.5 * m.ease + m.feel.tired * 0.6 },
  yawn: { dur: 1.7, rest: 30, where: anywhere, urge: (m) => m.feel.tired * 1.4 },
  shake: { dur: 0.9, rest: 18, where: anywhere, urge: (m, s) => 0.25 + s.rain * 2 + m.wet * 3 },
  wag: { dur: 0.7, rest: 6, where: anywhere, urge: (m) => m.feel.content * 0.9 },
  /** Riding is most of the game, so a passenger looks about oftener than a bird with the grass to get on with. */
  'look-about': { dur: 2.4, rest: 4.5, where: anywhere, urge: (m, s) => (0.5 + m.feel.curious * 0.8 + m.feel.fear * 0.6) * (s.where === 'riding' ? 1.5 : 1) },
  nuzzle: { dur: 2.2, rest: 26, where: riding, urge: (m) => m.bond * m.feel.content * 1.2 },
  peer: { dur: 2.6, rest: 9, where: riding, urge: (m, s) => (s.childSpeed > 0.5 ? 1.1 : 0.35) * m.feel.curious },
  /**
   * Head down into something loose and rummaging about in it, with its whole back end going. Nothing chooses this
   * for itself: it is what a heap of leaves is for, and the birches ask for it by name.
   */
  delve: { dur: 2.4, rest: 0.8, where: afoot, urge: () => 0 },
  /**
   * The three things it does at the bed, and the two it does on the hill. None of them is ever chosen: they are
   * what one room asks for by name, because none of them means anything anywhere else.
   */
  tug: { dur: 2.6, rest: 0.5, where: afoot, urge: () => 0 },
  nudge: { dur: 2.4, rest: 0.5, where: afoot, urge: () => 0 },
  'look-back': { dur: 2.2, rest: 0.4, where: afoot, urge: () => 0 },
  shiver: { dur: 6, rest: 0.4, where: afoot, urge: () => 0 },
};

const REACTIONS: Record<'flinch' | 'brace' | 'bowled' | 'into-wind' | 'ask' | 'snap', number> = {
  flinch: 0.7,
  brace: 1.6,
  bowled: 1.5,
  'into-wind': 2.6,
  ask: 2.4,
  snap: 0.55,
};

export type Interest = 'child' | 'hands' | 'plane' | 'creature' | 'flock' | 'light' | 'wind' | 'told' | 'nothing';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const toward = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));

/**
 * What it notices, what it feels, and what it decides to do about it. Everything it does on screen starts here, in
 * this order: something gets its attention, that changes how it feels, and how it feels decides what it does next.
 * It is that order, more than any one animation, that reads as somebody being in there.
 */
export class Mind {
  /** With the child: only rises. Owned by the cygnet, mirrored here so urges can read it. */
  bond = 0;
  /** With the wind, which is the player: only rises. Afraid of it, then curious about it, then asking for it. */
  windTrust = 0;
  readonly feel = { fear: 0, curious: 0.3, content: 0.2, tired: 0, cold: 0, longing: 0 };
  wet = 0;

  /** What it is looking at and why; `gaze` is null when it is looking at nothing in particular. */
  interest: Interest = 'nothing';
  readonly gaze = new THREE.Vector3();
  hasGaze = false;
  /** A point the story has told it to watch, which outranks anything it finds for itself. */
  told: THREE.Vector3 | null = null;

  /** What it is doing, how far through (0..1), and a 0-1-0 envelope over it for poses to ride. */
  act: Act | null = null;
  actK = 0;
  actEnv = 0;
  /** Which side a one-sided act is on: 1 its left, -1 its right. */
  actSide = 1;
  /** Where a reaction is aimed (the wind it is facing, the petal it snaps at). */
  readonly actAt = new THREE.Vector3();

  /** It wants to be at the child's feet, now: the story of every fright. */
  seeking = false;
  /** Unit vector the last gust came from, for looking into it. */
  readonly gustFrom = new THREE.Vector3();

  private actT = 0;
  private actDur = 1;
  private readonly rested = new Map<Act, number>();
  private time = 0;
  private nextIdle = 3;
  private dwell = 0;
  private energyWas = 0;
  private gustSpent = 0;
  private checkBack = 0;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  /** How at ease it is: what every idle thing it does is scaled by. */
  get ease(): number {
    return clamp01(1 - this.feel.fear * 1.6) * (1 - this.feel.tired * 0.4);
  }

  /** Something frightening happened. The first thing it will do afterwards is look at the child. */
  startle(amount: number): void {
    this.feel.fear = Math.min(1, this.feel.fear + amount);
    this.checkBack = 0.45;
  }

  trust(floor: number): void {
    this.windTrust = Math.max(this.windTrust, Math.min(1, floor));
  }

  /** Told to do something by whoever is running it: a shake after a landing, say. It will not interrupt a reaction. */
  perform(act: Act, dur = 0.9): void {
    if (this.act === 'flinch' || this.act === 'brace' || this.act === 'bowled') return;
    this.begin(act, Number.isNaN(dur) ? (IDLE[act]?.dur ?? REACTIONS[act as keyof typeof REACTIONS] ?? 1) : dur);
  }

  /** A reaction takes over from whatever it was idly doing; a stronger one takes over from a weaker. */
  react(act: keyof typeof REACTIONS, at?: THREE.Vector3): void {
    const rank = (a: Act | null) => (a === 'bowled' ? 3 : a === 'flinch' || a === 'brace' ? 2 : a === 'into-wind' || a === 'ask' || a === 'snap' ? 1 : 0);
    if (this.act && rank(this.act) >= rank(act) && this.actK < 0.85) return;
    this.begin(act, REACTIONS[act]);
    if (at) this.actAt.copy(at);
  }

  update(dt: number, s: Senses): void {
    this.time += dt;
    this.feelings(dt, s);
    this.weather(dt, s);
    this.attend(dt, s);
    this.behave(dt, s);
  }

  private feelings(dt: number, s: Senses): void {
    const f = this.feel;
    /** Fear only really goes when the child is there: near them it drains, away from them it lingers. */
    const near = s.where === 'riding' ? 1 : clamp01(1 - (s.gap - 1.5) / 4);
    f.fear = Math.max(0, f.fear - dt * (0.02 + 0.22 * near * (0.4 + this.bond)));
    f.fear = Math.max(f.fear, s.dark * (s.where === 'riding' ? 0.15 : 0.55) * (1 - (s.light ? 0.6 : 0)));
    f.cold = toward(f.cold, s.cold * (s.where === 'riding' ? 0.5 : 1) + this.wet * 0.4, 0.3, dt);
    f.tired = clamp01(f.tired + dt * (s.where === 'afoot' && s.childSpeed > 1 ? 0.012 : s.where === 'riding' ? -0.006 : -0.002));
    f.content = toward(f.content, clamp01(0.25 + this.bond * 0.6 - f.fear - f.cold * 0.4 + (s.where === 'riding' ? 0.2 : 0)), 0.5, dt);
    f.curious = toward(f.curious, clamp01(0.35 + this.bond * 0.3 - f.fear * 0.8 - f.tired * 0.5), 0.4, dt);
    f.longing = toward(f.longing, s.flock ? 1 : 0, s.flock ? 1.2 : 0.08, dt);
    this.wet = Math.max(0, this.wet + dt * (s.rain * 0.25 - 0.03));
    this.wet = Math.min(1, this.wet);
  }

  /** The wind, which is somebody. How it takes a gust is the whole of its second bond. */
  private weather(dt: number, s: Senses): void {
    const speed = Math.hypot(s.wind.x, s.wind.z);
    const rising = dt > 0 ? (s.wind.energy - this.energyWas) / dt : 0;
    this.energyWas = s.wind.energy;
    this.gustSpent = Math.max(0, this.gustSpent - dt);
    const hit = s.wind.energy > 0.22 && rising > 0.4 && this.gustSpent <= 0 && !s.locked && s.where !== 'airborne';
    if (hit) {
      this.gustSpent = 2.2;
      if (speed > 0.3) this.gustFrom.set(-s.wind.x / speed, 0, -s.wind.z / speed);
      const hard = clamp01((s.wind.energy - 0.3) / 0.5);
      if (this.windTrust < 0.3) {
        /** Afraid of it. Capped, and spent once per gust: a player who keeps blowing gets a bird that hides, not one that suffers. */
        this.startle(Math.min(0.35, 0.6 - this.feel.fear) * (0.5 + 0.5 * hard) * (s.where === 'riding' ? 0.4 : 1));
        this.react(hard > 0.75 && s.where === 'afoot' ? 'bowled' : 'flinch');
        this.seeking = s.where === 'afoot';
        this.windTrust = Math.min(0.3, this.windTrust + 0.03);
      } else if (this.windTrust < 0.65) {
        this.react(hard > 0.85 && s.where === 'afoot' ? 'bowled' : hard > 0.4 ? 'brace' : 'into-wind');
        this.feel.curious = Math.min(1, this.feel.curious + 0.2);
        this.windTrust = Math.min(0.65, this.windTrust + 0.015);
      } else {
        this.react(hard > 0.9 && s.where === 'afoot' ? 'bowled' : 'into-wind');
        this.feel.content = Math.min(1, this.feel.content + 0.15);
      }
    }
    /** Once it is no longer afraid of it, what the wind carries past is worth a snap. */
    if (this.windTrust >= 0.3 && !this.act && !s.busy && s.where !== 'airborne' && s.wind.energy > 0.06 && rising > 0.12 && this.random() < dt * 4) {
      this.react('snap', this.actAt.copy(s.eye).addScaledVector(this.gustFrom, -0.6));
    }
    /** Once it trusts the wind and the air has been still a while, it asks for some. */
    if (this.windTrust >= 0.65 && s.where === 'afoot' && !this.act && !s.busy && s.wind.energy < 0.05 && this.random() < dt * 0.035) this.react('ask');
    if (this.seeking && (s.gap < 1.1 || s.where !== 'afoot')) this.seeking = false;
  }

  private attend(dt: number, s: Senses): void {
    this.dwell -= dt;
    this.checkBack -= dt;
    const before = this.interest;
    if (this.told) this.look('told', this.told, 0.2);
    else if (this.checkBack > 0 && this.checkBack < 0.3) this.look('child', s.face, 1.4);
    else if (this.act === 'into-wind' || this.act === 'ask' || this.act === 'brace') {
      /** Into the wind and up, to where it came from, as if someone were there. */
      this.gaze.copy(s.eye).addScaledVector(this.gustFrom, 3).setY(s.eye.y + 1.6);
      this.interest = 'wind';
      this.hasGaze = true;
    } else if (this.dwell <= 0) this.choose(s);
    else this.follow(s);
    if (this.interest !== before) this.dwell = Math.max(this.dwell, 0.5);
  }

  /** Something new and near wins; nothing wins for long; and it keeps coming back to the child, more the more it trusts them. */
  private choose(s: Senses): void {
    const f = this.feel;
    const near = (p: THREE.Vector3 | null, reach: number) => (p ? clamp01(1 - p.distanceTo(s.eye) / reach) : 0);
    const options: [Interest, number, THREE.Vector3 | null][] = [
      ['hands', near(s.hands, 2.5) * 2.2, s.hands],
      ['flock', s.flock ? 1.6 + f.longing : 0, s.flock],
      ['light', near(s.light, 14) * (0.6 + s.dark), s.light],
      ['plane', near(s.plane, 16) * (0.5 + f.curious), s.plane],
      ['creature', near(s.creature, 7) * (0.4 + f.curious * 1.2), s.creature],
      ['child', 0.35 + this.bond * 0.7 + f.fear * 0.9, s.face],
      ['nothing', 0.45 + f.tired * 0.5, null],
    ];
    let best = options[options.length - 1];
    let score = -1;
    for (const o of options) {
      const v = o[1] * (0.6 + 0.8 * this.random()) * (o[0] === this.interest ? 0.55 : 1);
      if (v > score && (o[2] || o[0] === 'nothing')) {
        score = v;
        best = o;
      }
    }
    if (best[2]) this.look(best[0], best[2], 0.8 + this.random() * 2.2);
    else {
      this.interest = 'nothing';
      this.hasGaze = false;
      this.dwell = 0.8 + this.random() * 2;
    }
  }

  private follow(s: Senses): void {
    const at =
      this.interest === 'child' ? s.face : this.interest === 'hands' ? s.hands : this.interest === 'plane' ? s.plane : this.interest === 'creature' ? s.creature : this.interest === 'flock' ? s.flock : this.interest === 'light' ? s.light : null;
    if (at) this.gaze.copy(at);
    else if (this.interest !== 'nothing' && this.interest !== 'told' && this.interest !== 'wind') this.dwell = 0;
  }

  private look(interest: Interest, at: THREE.Vector3, dwell: number): void {
    this.interest = interest;
    this.gaze.copy(at);
    this.hasGaze = true;
    this.dwell = dwell;
  }

  private behave(dt: number, s: Senses): void {
    if (this.act) {
      this.actT += dt;
      this.actK = Math.min(1, this.actT / this.actDur);
      /**
       * Every act has a beginning, a middle and an end rather than being one swell: it goes into the pose quickly,
       * holds it long enough to be read at game distance, and comes out of it more slowly than it went in.
       */
      this.actEnv = smooth(Math.min(1, this.actK / 0.17)) * (1 - smooth(clamp01((this.actK - 0.66) / 0.34)));
      if (this.actK >= 1) {
        const was = this.act;
        this.rested.set(was, this.time);
        this.act = null;
        this.actEnv = 0;
        /** Every shake ends in a wag, and every knock-down in a shake: follow-through is half of being alive. */
        if (was === 'shake') this.begin('wag', 0.7);
        else if (was === 'bowled') this.begin('shake', 0.9);
        this.nextIdle = this.time + 1.2 + this.random() * 3.5 * (1.4 - this.feel.curious);
      }
      return;
    }
    if (s.busy || s.where === 'airborne' || s.where === 'down' || this.time < this.nextIdle) return;
    let pick: Act | null = null;
    let total = 0;
    for (const [name, spec] of Object.entries(IDLE) as [Act, ActSpec][]) {
      if (!spec.where.includes(s.where)) continue;
      if (this.time - (this.rested.get(name) ?? -1e3) < spec.rest) continue;
      const urge = spec.urge(this, s);
      if (urge <= 0) continue;
      total += urge;
      if (this.random() * total < urge) pick = name;
    }
    if (pick) this.begin(pick, IDLE[pick]!.dur);
    else this.nextIdle = this.time + 1;
  }

  private begin(act: Act, dur: number): void {
    this.act = act;
    this.actT = 0;
    this.actK = 0;
    this.actEnv = 0;
    this.actDur = dur;
    this.actSide = this.random() < 0.5 ? 1 : -1;
  }
}
