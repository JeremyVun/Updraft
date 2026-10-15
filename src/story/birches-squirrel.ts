import * as THREE from 'three';
import { verticalFov, type Shot } from '../camera';
import type { CameraAttention } from '../camera-direction';
import type { Floor, SquirrelPoint } from '../creatures/squirrel';
import type { Coax } from '../fx/swirl';
import { tuning } from '../tuning';
import { SCARF_OVER } from '../world/birch-scarf';
import { BIRCH_PILES, ROUND_VIEWS } from '../world/birches';
import { heightAt } from '../world/island';
import { FAR_TRUNK, GOODBYE, LEAP, MEETING, ON_THE_STUMP, PATHS, ROUNDS, frameShot, SWING_PERCH, TANGLE_3_WIDE, TANGLE_PERCHES, onTrunk, route, type PerchSpec, type Step } from './birches-rounds';
import type { Cast } from './cast';

const ground: Floor = (x, z) => Math.max(0, heightAt(x, z));
const UP = new THREE.Vector3(0, 1, 0);
const between = (a: number, b: number): number => a + Math.random() * (b - a);
type Spot = { x: number; z: number };
const flat = (from: Spot, to: Spot): THREE.Vector3 => new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
const onGround = (p: THREE.Vector3): THREE.Vector3 => p.setY(ground(p.x, p.z));

/** Where it is between rounds, in the order the walk meets them. */
type Station = 'meeting' | 'tangle1' | 'round2' | 'swing' | 'tangle2' | 'round3' | 'farTrunk' | 'tangle3' | 'tangle4' | 'goodbye';

const WAYS: Record<Exclude<Station, 'meeting'>, readonly Step[]> = {
  tangle1: PATHS.toTangle1, round2: PATHS.toRound2, swing: PATHS.toSwing, tangle2: PATHS.toTangle2, round3: PATHS.toRound3,
  farTrunk: PATHS.toFarTrunk, tangle3: PATHS.toTangle3, tangle4: PATHS.toTangle4, goodbye: PATHS.toGoodbye,
};
const ROUND_OF: Partial<Record<Station, number>> = { meeting: 0, round2: 1, round3: 2 };
const wide = (): boolean => window.innerWidth >= window.innerHeight;
/** Its way to a station; landscape's third tangle has a perch of its own, nearer the lens. */
const wayTo = (station: Exclude<Station, 'meeting'>): readonly Step[] =>
  station === 'tangle3' && wide() ? PATHS.toTangle3Wide : station === 'tangle4' && wide() ? PATHS.toTangle4Wide : WAYS[station];
/** The meeting's log and the ground either side of it, for the dive off it into the heap. */
const OFF_THE_LOG: Floor = (x, z) => Math.max(ground(x, z), MEETING.floor(x, z));
const floorTo = (station: Station): Floor => (station === 'tangle2' ? ON_THE_STUMP : ground);

export interface SquirrelCue {
  /** The round she is walking to or playing; −1 between rounds. */
  round: number;
  /** She has come to the round's heaps and stopped there. */
  standing: boolean;
  /** She has reached the round's heaps and is looking. */
  seeking: boolean;
  tangles: number;
  /** The swing has been ridden or passed by. */
  swingOver: boolean;
  /** The scarf is gathered into the boat. */
  gathered: boolean;
  /** They are going down to the boat or aboard. */
  leaving: boolean;
  /** She is at a tangle, working it or counting there; on her way to the swing or on it. */
  atTangle: boolean;
  atSwing: boolean;
}

interface Hide {
  round: number;
  /** Which of the round's heaps, or −1 for a drift or a trunk. */
  heap: number;
  at: THREE.Vector3;
  /** How far above the ground its paws are set in the leaves there (`AutumnBirches.buryDepth`), or below it. */
  sink: number;
  /** How far round it the wind counts. */
  reach: number;
  trunk: { at: THREE.Vector3; up: THREE.Vector3; radius: number } | null;
}

type Mode = 'idle' | 'meeting' | 'going' | 'glancing' | 'choosing' | 'hiding' | 'hidden' | 'exposed' | 'flushed' | 'waiting' | 'shuffling';
type ShuffleStep = 'dare' | 'dive' | 'rest' | 'burst' | 'bound' | 'burrow' | 'settle';

/**
 * Its shuffle at a round with no counting: the heaps it goes through in order (the round's own indices), the first
 * dived into from where it sat; how many of the last moves are under the leaves; the move under way and its step.
 */
interface Shuffle {
  round: number;
  order: number[];
  under: number;
  move: number;
  step: ShuffleStep;
  until: number;
  /** How far above the ground its paws are set in each heap's leaves. */
  sinks: number[];
  /** Under the leaves: from where to where, how far along (m), and when the leaves are next stirred and heard. */
  from: THREE.Vector3;
  to: THREE.Vector3;
  along: number;
  nextStir: number;
  nextRustle: number;
}
type Leap = 'none' | 'reading' | 'waiting' | 'running' | 'flying' | 'sitting' | 'kicking' | 'done';

/**
 * The red squirrel's hide-and-seek, played through the birches between the scarf's tangles. It sits on the fallen
 * birch until the child comes, drops into the heap and is found by blowing the heap apart; then it runs on to the
 * next tangle's tree, waits there while the scarf is worked, and goes on ahead to hide again, in one of two heaps
 * and then one of three. Wherever the leaves are still deep enough it buries itself; where the wind has left none,
 * it hides behind a trunk. The cygnet seeks with them by its own lights. After the third round the child jumps into
 * the deepest leaves left in the hollow, and at the far beach the squirrel sees them off.
 */
export class BirchesSquirrel {
  /** Rounds found. */
  rounds = 0;
  /** The updraft drawn turning over the heap it is in, for a stalled player, or null. */
  invitation: Coax | null = null;
  readonly attention: CameraAttention = { point: new THREE.Vector3(), strength: 0, weight: tuning.birches.squirrel.glance };
  /** Where it is, and how much the depth blur keeps it sharp along with her (0..1, eased in and out). */
  readonly sharpness = { at: new THREE.Vector3(), weight: 0 };
  private station: Station = 'meeting';
  private mode: Mode = 'meeting';
  private seen = false;
  private stoodSince = -1;
  private hidden: Hide | null = null;
  /** The last round it has gone into hiding in: until it is in, that round's heaps stand against the wind. */
  private wentIn = -1;
  private readonly holding: number[] = [];
  /** A readback of the leaves over its back is on its way, and when the next is due. */
  private feeling = false;
  private nextFeel = 0;
  /** At the second tangle: none, startled under the coils closing over it, or indignant at the wool gone past. */
  private coiled: 'none' | 'startled' | 'indignant' = 'none';
  private readonly woolGone = new THREE.Vector3();
  private readonly overBack: THREE.Vector3[] = Array.from({ length: 5 }, () => new THREE.Vector3());
  /** The heap it was last turned out of, in its round, so it hides in another while there is one. */
  private readonly lastHide = { round: -1, heap: -1 };
  private shuffle: Shuffle | null = null;
  /** What she and the cygnet follow with their eyes while it shuffles: it, or the hump of leaves it heaves along. */
  private readonly tracked = new THREE.Vector3();
  private nextAnswer = 0;
  private greeted = false;
  private generation = 0;
  private now = 0;
  private setOffAt = -1e9;
  private sitAt = -1;
  private scoldAt = -1;
  private work = 0;
  private rate = 0;
  private gust = 0;
  private calm = 0;
  private quiet = 0;
  private nextTell = 0;
  private tailOut = false;
  private leapt = false;
  private leap: Leap = 'none';
  private leapAt = 0;
  private delved = false;
  private nextKick = 0;
  private glanceRest: SquirrelPoint[] = [];
  private seekHeap = -1;
  private seekRound = -1;
  private lastSeek = -1;
  private seekDone = 0;
  private seekSince = 0;
  private hinting = false;
  private chased = false;
  private lookUntil = 0;
  private cue: SquirrelCue = { round: -1, standing: false, seeking: false, tangles: 0, swingOver: false, gathered: false, leaving: false, atTangle: false, atSwing: false };
  private readonly later: { at: number; generation: number | null; run: () => void }[] = [];
  private readonly face = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly heapLook = new THREE.Vector3();
  private readonly asking: Coax = { at: new THREE.Vector3(), urgency: 0 };
  private readonly lifts: number[] = [];
  private readonly land = new THREE.Vector3();
  private readonly takeOff = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly bank = new THREE.Vector3();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly heapBurstAt = new Map<number, number>();
  private readonly lens = new THREE.PerspectiveCamera();
  private readonly lensShot: Shot = { target: new THREE.Vector3(), distance: 0, height: 0 };

  constructor(private readonly cast: Cast) {
    cast.squirrel.visible = true;
    this.meet();
  }

  /** Rounds found, and the squirrel off long enough for her to follow. */
  over(round: number): boolean {
    return this.rounds > round && this.now - this.setOffAt >= tuning.birches.squirrel.walkOnAfter;
  }

  /** Where it lies hidden, and in which of the round's heaps (−1 a drift or a trunk); null while it is not. */
  get hideout(): { at: THREE.Vector3; heap: number; trunk: boolean } | null {
    const h = this.mode === 'hidden' ? this.hidden : null;
    return h && { at: h.at, heap: h.heap, trunk: h.trunk !== null };
  }

  /** Hidden in round `round`, so she may come and look; in the first, it is seen going in. */
  ready(round: number): boolean {
    if (round === 0) return true;
    if (ROUNDS[round].shuffle) return this.rounds === round;
    return this.rounds === round && this.mode === 'hidden';
  }

  get leaping(): boolean {
    return this.leap !== 'none' && this.leap !== 'done';
  }

  get leapOver(): boolean {
    return this.leap === 'done';
  }

  /** Where the story so far has it, for a resumed save: `rounds` found, the scarf freed as far as `cue` says. */
  restore(rounds: number, cue: SquirrelCue): void {
    this.generation++;
    this.later.length = 0;
    this.rounds = rounds;
    this.wentIn = rounds - 1;
    this.coiled = 'none';
    this.endShuffle();
    this.leapt = rounds >= 3;
    this.leap = 'none';
    this.cue = cue;
    this.hidden = null;
    this.invitation = null;
    this.seekRound = -1;
    this.attention.strength = 0;
    this.cast.squirrel.visible = true;
    this.station = this.stationFor(cue);
    if (this.station === 'meeting') { this.meet(); return; }
    const round = ROUND_OF[this.station];
    if (round !== undefined && ROUNDS[round].shuffle) {
      this.wait(round, true);
      return;
    }
    if (round !== undefined) {
      this.cast.squirrel.visible = false;
      this.choose(round, true);
      return;
    }
    this.mode = 'idle';
    this.settle(this.perchOf(this.station), true);
  }

  /** A round she has been put past without playing it, as only a check's jump can. */
  passed(round: number, cue: SquirrelCue): void {
    if (this.rounds <= round) this.restore(round + 1, cue);
  }

  update(dt: number, time: number, cue: SquirrelCue): void {
    this.now = time;
    this.cue = cue;
    const { child, squirrel } = this.cast;
    child.face(this.face);
    squirrel.eye(this.eye);
    if (this.shuffle?.step !== 'burrow') this.tracked.copy(this.eye);
    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i];
      if (l.generation !== null && l.generation !== this.generation) this.later.splice(i, 1);
      else if (time >= l.at) { this.later.splice(i, 1); l.run(); }
    }
    const want = this.stationFor(cue);
    const scolding = this.coiled === 'indignant' && this.station === 'tangle2' && this.cast.squirrel.busy;
    if (want !== this.station && this.mode !== 'flushed' && this.mode !== 'glancing' && !scolding) this.goTo(want);
    if (this.mode === 'meeting') this.meeting();
    else if (this.mode === 'waiting') this.waiting();
    else if (this.mode === 'shuffling') this.shuffling(dt);
    else if (this.mode === 'hiding') this.hiding();
    else if (this.mode === 'hidden') this.lying(dt);
    else if (this.mode === 'flushed') this.flushed();
    this.seek(time);
    this.leapStep(dt);
    this.underCoils();
    this.greet(cue);
    this.glance(dt);
    this.holdHeaps();
  }

  /**
   * On the broken birch's top while she frees the second tangle: the coils close in over it as they rise, and it
   * jolts down with a squeak; once they have lifted clear and slid off, it shakes itself and scolds the wool.
   */
  private underCoils(): void {
    if (this.station !== 'tangle2' || this.mode !== 'idle') return;
    const { birches, squirrel: s } = this.cast;
    const work = birches.scarf.snags[1].work;
    if (this.coiled === 'none' && work >= THREE.MathUtils.lerp(SCARF_OVER.from, SCARF_OVER.to, 0.25)) {
      this.coiled = 'startled';
      s.act('startle', { look: this.face });
    } else if (this.coiled === 'startled' && (work >= SCARF_OVER.to + 0.06 || birches.scarf.snags[1].freed)) {
      this.coiled = 'indignant';
      this.woolGone.copy(s.position).add(this.v.set(2.6, 0.6, 0));
      s.act('indignant', { look: this.woolGone });
    }
  }

  /** She has come to the knot it waits by: it chatters at her once, so that it is found there by the eye and the ear. */
  private greet(cue: SquirrelCue): void {
    const was = this.greeted;
    this.greeted = cue.atTangle;
    const s = this.cast.squirrel;
    if (was || !cue.atTangle || this.mode !== 'idle' || s.busy || this.station === 'tangle2' || ROUND_OF[this.station] !== undefined) return;
    const perch = this.perchOf(this.station);
    if (perch.action === 'climb') { s.tell(); return; }
    s.act('scold', { look: this.face });
    const station = this.station;
    this.after(tuning.birches.squirrel.scoldFor, () => { if (this.station === station && this.mode === 'idle') this.settle(perch, false); });
  }

  /** Each round's heaps stand against the wind until it has gone into hiding in one of them, and has done shuffling. */
  private holdHeaps(): void {
    this.holding.length = 0;
    ROUNDS.forEach((r, round) => { if (this.rounds <= round && this.wentIn < round) this.holding.push(...r.heaps); });
    this.cast.birches.hold(this.holding);
  }

  /** The round is over: the cygnet goes back to its own play and she gets up. */
  release(): void {
    const { cygnet: bird, child } = this.cast;
    bird.stay = false;
    bird.errand = null;
    bird.watch(null);
    child.kneeling = 0;
    this.seekHeap = -1;
    this.hinting = false;
    this.invitation = null;
  }

  private stationFor(cue: SquirrelCue): Station {
    if (this.rounds === 0) return 'meeting';
    if (this.rounds === 1) return cue.tangles === 0 ? 'tangle1' : 'round2';
    if (this.rounds === 2) return cue.tangles >= 2 ? 'round3' : cue.swingOver ? 'tangle2' : 'swing';
    if (!this.leapt) return 'farTrunk';
    if (cue.tangles <= 2) return 'tangle3';
    return cue.tangles >= 4 && cue.gathered ? 'goodbye' : 'tangle4';
  }

  private perchOf(station: Station): PerchSpec {
    switch (station) {
      case 'tangle1': return TANGLE_PERCHES[0];
      case 'swing': return SWING_PERCH;
      case 'tangle2': return TANGLE_PERCHES[1];
      case 'farTrunk': return FAR_TRUNK;
      case 'tangle3': return wide() ? TANGLE_3_WIDE : TANGLE_PERCHES[2];
      case 'tangle4': return TANGLE_PERCHES[3];
      case 'goodbye': return GOODBYE;
      default: return MEETING;
    }
  }

  /** Holding still at a place: put there, or settling where its way ended. */
  private settle(spec: PerchSpec, put: boolean): void {
    const s = this.cast.squirrel;
    if (spec.action === 'climb') {
      const { at, up, radius } = onTrunk(this.cast.birches, spec.trunk);
      s.act('climb', put ? { at, up, forward: UP, radius, look: this.face } : { look: this.face });
    } else if (put) {
      s.act(spec.action, { at: spec.at, yaw: spec.yaw, floor: spec.floor ?? ground, radius: spec.action === 'perch' ? spec.radius : undefined, look: this.face, nut: false });
    } else s.act(spec.action, { yaw: spec.yaw, look: this.face, nut: false });
  }

  /** `run` in `seconds`; `own` ties it to what the squirrel is doing now, so a change of plan drops it. */
  private after(seconds: number, run: () => void, own = true): void {
    this.later.push({ at: this.now + seconds, generation: own ? this.generation : null, run });
  }

  private meet(): void {
    this.station = 'meeting';
    this.mode = 'meeting';
    this.seen = false;
    this.stoodSince = -1;
    this.cast.squirrel.act('sit', { at: MEETING.at, yaw: MEETING.yaw, floor: MEETING.floor, look: null, nut: true });
  }

  /** Off along its way to `station`, from wherever it is; once found, it glances back at her a few metres on. */
  private goTo(station: Station, glanceBack = false): void {
    this.generation++;
    this.station = station;
    this.hidden = null;
    this.invitation = null;
    this.endShuffle();
    const s = this.cast.squirrel;
    if (station === 'meeting') { this.meet(); return; }
    let points = route(this.cast.birches, wayTo(station));
    /** Sent on before it got where it was going, it cuts in at the nearest point of its new way. */
    if (points[0].at.distanceTo(s.position) > 1.5) {
      let near = 0;
      points.forEach((p, i) => { if (p.at.distanceTo(s.position) < points[near].at.distanceTo(s.position)) near = i; });
      points = points.slice(near);
    }
    const perch = ROUND_OF[station] === undefined ? this.perchOf(station) : null;
    if (perch && perch.action !== 'climb' && perch.at.distanceTo(points[points.length - 1].at) > 0.1) points.push({ at: perch.at.clone(), on: 'ground' });
    this.mode = 'going';
    if (glanceBack) {
      let run = 0;
      for (let i = 1; i < points.length - 1; i++) {
        run += points[i].at.distanceTo(points[i - 1].at);
        if (run > tuning.birches.squirrel.glanceAfter && points[i].on === 'ground') {
          this.glanceRest = points.slice(i);
          s.follow(points.slice(0, i + 1), () => this.lookBack(station), { floor: floorTo(station) });
          return;
        }
      }
    }
    /** On ahead to hide, it dashes, so it is under the leaves before she gets there; to wait for her, it only runs. */
    const round = ROUND_OF[station], k = tuning.birches.squirrel;
    const pace = round === undefined ? 1 : ROUNDS[round].shuffle ? k.shuffleRunOn : k.dash;
    s.follow(points, () => this.arrive(station), { floor: floorTo(station), pace });
  }

  /** It stops, sits up and looks back at her once: come on, then. */
  private lookBack(station: Station): void {
    if (station !== this.station) return;
    const s = this.cast.squirrel;
    this.mode = 'glancing';
    s.act('freeze', { yaw: Math.atan2(this.face.x - s.position.x, this.face.z - s.position.z), look: this.face });
    this.after(tuning.birches.squirrel.glanceFor, () => {
      this.mode = 'going';
      s.follow(this.glanceRest, () => this.arrive(station), { floor: floorTo(station) });
    });
  }

  private arrive(station: Station): void {
    if (station !== this.station) return;
    const round = ROUND_OF[station];
    if (round !== undefined && ROUNDS[round].shuffle) { this.wait(round, false); return; }
    if (round !== undefined) { this.choose(round, false); return; }
    this.mode = 'idle';
    this.settle(this.perchOf(station), false);
  }

  /**
   * Once she has come up to the heap and stands looking at it on its log, it sees her and freezes, sits up and
   * chatters at her while she and the cygnet look straight at it, then dives into the heap.
   */
  private meeting(): void {
    const s = this.cast.squirrel, k = tuning.birches.squirrel;
    if (this.seen) return;
    if (!this.cue.standing) { this.stoodSince = -1; return; }
    if (this.stoodSince < 0) this.stoodSince = this.now;
    if (this.now - this.stoodSince < k.meetPause) return;
    this.seen = true;
    const yaw = Math.atan2(this.face.x - s.position.x, this.face.z - s.position.z);
    s.act('freeze', { yaw, look: this.face });
    this.cast.cygnet.watch(this.eye, true);
    this.after(k.meetFreeze, () => {
      s.act('scold', { yaw, look: this.face });
      s.call('chitter', 1);
    });
    this.after(k.meetFreeze + k.meetHold, () => {
      this.cast.cygnet.watch(null);
      this.choose(0, false);
    });
  }

  /** Sitting up in plain view at a round with no counting, nut in paws, waiting for her to come and watch. */
  private wait(round: number, put: boolean): void {
    const { at, yaw } = ROUNDS[round].shuffle!;
    this.mode = 'waiting';
    this.stoodSince = -1;
    this.cast.squirrel.visible = true;
    this.cast.squirrel.act('sit', { ...(put ? { at, floor: ground } : {}), yaw, look: this.face, nut: true });
  }

  /**
   * Once she has come and stands watching, it sees her, sits up and chatters (watch this), and the shuffle begins:
   * one readback of how deep each heap lies, then the dive into the first heap in plain view.
   */
  private waiting(): void {
    const round = ROUND_OF[this.station]!, k = tuning.birches.squirrel, s = this.cast.squirrel;
    if (this.cue.round !== round || !this.cue.standing) { this.stoodSince = -1; return; }
    if (this.stoodSince < 0) this.stoodSince = this.now;
    if (this.now - this.stoodSince < k.shuffleLook || s.busy) return;
    const generation = ++this.generation;
    this.mode = 'shuffling';
    s.act('freeze', { yaw: Math.atan2(this.face.x - s.position.x, this.face.z - s.position.z), look: this.face });
    this.after(k.meetFreeze, () => { s.act('scold', { look: this.face }); s.call('chitter', 1); });
    const r = ROUNDS[round];
    void this.cast.birches.depthAt(r.hides).then((depths) => {
      if (generation !== this.generation) return;
      if (depths.some((d) => d < k.buryDepth)) { this.choose(round, false); return; }
      this.shuffle = this.plan(round, depths);
      this.after(k.shuffleDare, () => this.diveInto(0));
    });
  }

  /**
   * The heaps it goes through: three or four moves, only ever to a heap beside the one it is in, so it doubles back
   * from either end. It goes in nearer her than the far heap; the last one or two moves are under the leaves.
   */
  private plan(round: number, depths: number[]): Shuffle {
    const r = ROUNDS[round], k = tuning.birches.squirrel, from = r.shuffle!.at;
    const near = r.heaps.map((_, i) => i).filter((i) => {
      const p = BIRCH_PILES[r.heaps[i]];
      return Math.hypot(p.x - from.x, p.z - from.z) < p.r + k.shuffleNear;
    });
    const order = [near[Math.floor(Math.random() * near.length)] ?? 0];
    const moves = Math.random() < 0.5 ? 3 : 4;
    while (order.length <= moves) {
      const here = order[order.length - 1];
      const beside = [here - 1, here + 1].filter((i) => i >= 0 && i < r.heaps.length);
      order.push(beside[Math.floor(Math.random() * beside.length)]);
    }
    const sinks = r.hides.map((h, i) => depths[i] - this.cast.birches.buryDepth(h.x, h.z, depths[i]));
    return { round, order, under: moves - 2, move: 0, step: 'dare', until: 0, sinks, from: new THREE.Vector3(), to: new THREE.Vector3(), along: 0, nextStir: 0, nextRustle: 0 };
  }

  private hideAt(sh: Shuffle, i: number): Hide {
    const heap = sh.order[i], r = ROUNDS[sh.round];
    return { round: sh.round, heap, at: r.hides[heap].clone(), sink: sh.sinks[heap], reach: BIRCH_PILES[r.heaps[heap]].r, trunk: null };
  }

  /** Into the heap of move `i`: a pounce from close enough, or a bound to its rim first. */
  private diveInto(i: number): void {
    const sh = this.shuffle, s = this.cast.squirrel;
    if (!sh || this.mode !== 'shuffling') return;
    sh.move = i;
    sh.step = 'dive';
    const h = this.hideAt(sh, i), k = tuning.birches.squirrel;
    this.tailOut = false;
    const into = () => s.act('dive', { at: h.at.clone().setY(this.inLeaves(h)(h.at.x, h.at.z)), tailOut: false, floor: this.inLeaves(h), yaw: Math.random() * Math.PI * 2 });
    if (Math.hypot(h.at.x - s.position.x, h.at.z - s.position.z) < k.pounceFrom + 0.6) { into(); return; }
    const rim = onGround(h.at.clone().addScaledVector(flat(h.at, s.position), k.pounceFrom + BIRCH_PILES[ROUNDS[sh.round].heaps[h.heap]].r * 0.35));
    s.follow([{ at: rim, on: 'ground' }], () => { if (this.shuffle === sh && sh.step === 'dive') into(); }, { floor: ground, pace: k.shufflePace[Math.min(i, k.shufflePace.length - 1)] });
  }

  /**
   * Polled while it shuffles. Landed in a heap, the leaves go up round it and it rests a moment, a shorter one each
   * time; then it bursts out toward the heap beside it and bounds across, or, for the last one or two moves, goes on
   * under the leaves: a hump of them heaving along the floor, the loose ones popping up over it, heard as it goes.
   */
  private shuffling(dt: number): void {
    const sh = this.shuffle, s = this.cast.squirrel, k = tuning.birches.squirrel;
    if (!sh) return;
    const last = sh.order.length - 1;
    if (sh.step === 'dive' && s.action === 'buried' && !s.busy) {
      const h = this.hideAt(sh, sh.move), strength = sh.move === 0 ? k.splash : k.shuffleSplash;
      this.cast.leafSound?.('dive', h.at, strength);
      this.cast.birches.splash(h.at.x, h.at.z, strength);
      sh.step = 'rest';
      sh.until = this.now + k.shuffleRest[Math.min(sh.move, k.shuffleRest.length - 1)];
    } else if (sh.step === 'rest' && this.now >= sh.until) {
      if (sh.move === last) {
        sh.step = 'settle';
        sh.until = this.now + k.shuffleSettle;
        const h = this.hideAt(sh, last);
        this.cast.leafSound?.('rustle', h.at, 1);
        this.cast.birches.shiver(h.at.x, h.at.z, k.tellStrength);
      } else if (sh.move + 1 > last - sh.under) this.burrowFrom(sh);
      else {
        const from = this.hideAt(sh, sh.move), to = this.hideAt(sh, sh.move + 1);
        const out = onGround(from.at.clone().addScaledVector(flat(from.at, to.at), from.reach * 0.75));
        sh.step = 'burst';
        this.cast.leafSound?.('burst', from.at, k.shuffleBurst);
        s.act('burst', { at: out, look: to.at, floor: this.inLeaves(from) });
      }
    } else if (sh.step === 'burst' && !s.busy) {
      sh.step = 'bound';
      this.diveInto(sh.move + 1);
    } else if (sh.step === 'burrow') this.burrowing(sh, dt);
    else if (sh.step === 'settle' && this.now >= sh.until) {
      const h = this.hideAt(sh, last);
      this.endShuffle();
      this.hide(h, true);
    }
  }

  /** Under the leaves from the heap it is in to the one beside it: it goes out of sight, and the hump sets off. */
  private burrowFrom(sh: Shuffle): void {
    const s = this.cast.squirrel, k = tuning.birches.squirrel;
    const from = this.hideAt(sh, sh.move), to = this.hideAt(sh, sh.move + 1);
    sh.step = 'burrow';
    sh.from.copy(from.at);
    sh.to.copy(to.at);
    sh.along = 0;
    sh.nextStir = sh.nextRustle = this.now;
    this.cast.leafSound?.('rustle', from.at, 1);
    this.cast.birches.shiver(from.at.x, from.at.z, k.tellStrength);
    s.visible = false;
  }

  private burrowing(sh: Shuffle, dt: number): void {
    const k = tuning.birches.squirrel, birches = this.cast.birches;
    const span = sh.from.distanceTo(sh.to), under = sh.move + 1 - (sh.order.length - 1 - sh.under);
    sh.along = Math.min(span, sh.along + k.shuffleUnder[Math.min(under - 1, k.shuffleUnder.length - 1)] * dt);
    const t = sh.along / span, eased = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
    const at = this.v.lerpVectors(sh.from, sh.to, eased);
    onGround(at);
    /** It heaves the floor up between the heaps; inside one the heap is already over it. */
    const rise = THREE.MathUtils.smoothstep(Math.min(t, 1 - t) * span, 0.4, 2);
    birches.burrow(at, rise);
    this.tracked.copy(at).setY(at.y + 0.25);
    if (this.now >= sh.nextStir) {
      sh.nextStir = this.now + k.burrowStirEvery;
      birches.shiver(at.x, at.z, k.burrowStir);
    }
    if (this.now >= sh.nextRustle) {
      sh.nextRustle = this.now + k.burrowRustleEvery;
      this.cast.leafSound?.('rustle', at, 1);
    }
    if (sh.along < span) return;
    birches.burrow(null);
    const h = this.hideAt(sh, sh.move + 1), s = this.cast.squirrel;
    s.visible = true;
    s.hide(h.at, { tailOut: false, yaw: Math.random() * Math.PI * 2, floor: this.inLeaves(h) });
    this.cast.leafSound?.('rustle', h.at, 1);
    birches.shiver(h.at.x, h.at.z, k.tellStrength);
    sh.move++;
    sh.step = 'rest';
    sh.until = this.now + k.shuffleRest[Math.min(sh.move, k.shuffleRest.length - 1)];
  }

  private endShuffle(): void {
    if (!this.shuffle) return;
    this.shuffle = null;
    this.seekRound = -1;
    this.cast.birches.burrow(null);
    this.cast.squirrel.visible = true;
  }

  /**
   * One readback of the leaves over the round's ground: one of its heaps still deep enough to bury it (not the one
   * it was just turned out of, while there is another), else the deepest drift, else the trunk behind a heap.
   */
  private choose(round: number, direct: boolean): void {
    const generation = ++this.generation;
    this.mode = 'choosing';
    const r = ROUNDS[round];
    const grid: THREE.Vector3[] = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const x = r.area.x + i * r.area.r * 0.4, z = r.area.z + j * r.area.r * 0.4;
      if (heightAt(x, z) > 0.4) grid.push(new THREE.Vector3(x, ground(x, z), z));
    }
    void this.cast.birches.depthAt([...r.hides, ...grid]).then((depths) => {
      if (generation === this.generation) this.hide(this.pick(round, depths, grid), direct);
    });
  }

  /** Whether `p` stands well inside round `round`'s frame on this screen, so a hide there stays in the picture. */
  private inView(round: number, p: THREE.Vector3): boolean {
    const aspect = window.innerWidth / window.innerHeight;
    const shot = frameShot(ROUNDS[round].frames, aspect, this.lensShot);
    const cam = this.lens;
    cam.aspect = aspect;
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(verticalFov(aspect)) / 2) / (shot.zoom ?? 1)));
    cam.position.copy(shot.target).addScaledVector(shot.from!, shot.distance).setY(shot.target.y + shot.height);
    cam.lookAt(shot.target);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const v = this.v.copy(p).setY(p.y + 0.3).project(cam);
    return Math.abs(v.x) < 0.78 && v.y > -0.75 && v.y < 0.75 && v.z < 1;
  }

  private pick(round: number, depths: number[], grid: THREE.Vector3[]): Hide {
    const k = tuning.birches.squirrel;
    const r = ROUNDS[round];
    const deep = r.hides.map((_, i) => i).filter((i) => depths[i] >= k.buryDepth);
    const turnedOut = this.lastHide.round === round ? this.lastHide.heap : -1;
    const choices = deep.length > 1 ? deep.filter((i) => i !== turnedOut) : deep;
    const sunk = (at: THREE.Vector3, depth: number) => depth - this.cast.birches.buryDepth(at.x, at.z, depth);
    if (choices.length > 0) {
      const i = choices[Math.floor(Math.random() * choices.length)];
      return { round, heap: i, at: r.hides[i].clone(), sink: sunk(r.hides[i], depths[i]), reach: BIRCH_PILES[r.heaps[i]].r, trunk: null };
    }
    let best = -1;
    const drift = (i: number) => depths[r.hides.length + i];
    grid.forEach((p, i) => { if (drift(i) >= k.buryDepth && (best < 0 || drift(i) > drift(best)) && this.inView(round, p)) best = i; });
    if (best >= 0) return { round, heap: -1, at: grid[best].clone(), sink: sunk(grid[best], drift(best)), reach: k.driftReach, trunk: null };
    /** Nothing left to bury itself in: flat to the bark of the tree a heap was banked against, round from her. */
    const lens = ROUND_VIEWS[round].from;
    const bankOf = (i: number, out: THREE.Vector3): THREE.Vector3 => {
      const heap = BIRCH_PILES[i];
      this.cast.birches.trunkAt(heap.x - lens.x * (heap.r + 0.8), heap.z - lens.z * (heap.r + 0.8), 0.8, out);
      return out;
    };
    const seen = r.heaps.filter((i) => this.inView(round, bankOf(i, this.bank)));
    const banks = seen.length ? seen : r.heaps;
    const axis = bankOf(banks[Math.floor(Math.random() * banks.length)], new THREE.Vector3());
    const turn = 0.7 * (Math.random() < 0.5 ? -1 : 1), c = Math.cos(turn), sn = Math.sin(turn);
    const toward = { x: axis.x - (lens.x * c - lens.z * sn) * 4, z: axis.z - (lens.x * sn + lens.z * c) * 4 };
    const trunk = onTrunk(this.cast.birches, { tree: { x: axis.x, z: axis.z }, height: 0.8, toward });
    return { round, heap: -1, at: trunk.at, sink: 0, reach: k.trunkReach, trunk };
  }

  private hide(h: Hide, direct: boolean): void {
    const s = this.cast.squirrel;
    const k = tuning.birches.squirrel;
    this.hidden = h;
    this.work = this.rate = this.gust = this.calm = this.quiet = 0;
    this.hinting = false;
    this.tailOut = Math.random() < k.tailOut[h.round];
    this.nextTell = this.now + between(k.tellFrom, k.tellTo);
    s.visible = true;
    if (direct) {
      this.mode = 'hidden';
      this.wentIn = Math.max(this.wentIn, h.round);
      if (h.trunk) s.act('climb', { at: h.trunk.at, up: h.trunk.up, forward: UP, radius: h.trunk.radius, look: this.face });
      else s.hide(h.at, { tailOut: this.tailOut, yaw: Math.random() * Math.PI * 2, floor: this.inLeaves(h) });
      return;
    }
    this.mode = 'hiding';
    const from = s.position.clone();
    if (h.trunk) {
      const { at, up, radius } = h.trunk;
      const axis = at.clone().addScaledVector(up, -radius);
      const toSquirrel = flat(axis, from);
      const foot = onGround(axis.clone().addScaledVector(toSquirrel, radius + 0.4));
      const side = up.clone().add(toSquirrel);
      if (side.lengthSq() < 0.01) side.set(-up.z, 0, up.x);
      side.normalize();
      s.follow([
        { at: foot, on: 'ground' },
        { at: axis.clone().addScaledVector(side, radius).setY(at.y - 0.1), on: 'trunk', up: side, radius },
        { at: at.clone(), on: 'trunk', up: up.clone(), radius },
      ], () => {
        if (this.hidden !== h) return;
        this.mode = 'hidden';
        this.wentIn = Math.max(this.wentIn, h.round);
        s.look(this.face);
      }, { floor: ground, pace: tuning.birches.squirrel.dash });
      return;
    }
    if (this.station === 'meeting' || Math.hypot(h.at.x - from.x, h.at.z - from.z) < 3.5) { this.dive(h); return; }
    const rim = onGround(h.at.clone().addScaledVector(flat(h.at, from), tuning.birches.squirrel.pounceFrom));
    s.follow([{ at: rim, on: 'ground' }], () => { if (this.hidden === h) this.dive(h); }, { floor: ground, pace: tuning.birches.squirrel.dash });
  }

  /** The ground, and toward the hide the level its paws are set at in the leaves there, eased so it never steps. */
  private inLeaves(h: Hide, from: Floor = ground): Floor {
    return (x, z) => from(x, z) + h.sink * (1 - THREE.MathUtils.smoothstep(Math.hypot(x - h.at.x, z - h.at.z), 0.3, 1.6));
  }

  private dive(h: Hide): void {
    const floor = this.inLeaves(h, this.station === 'meeting' ? OFF_THE_LOG : ground);
    this.cast.squirrel.act('dive', { at: h.at.clone().setY(floor(h.at.x, h.at.z)), tailOut: this.tailOut, floor, yaw: Math.random() * Math.PI * 2 });
  }

  /** Landed in the leaves: they go up high round it with a crunching whumph, and the heap stays whole. */
  private hiding(): void {
    const s = this.cast.squirrel, h = this.hidden;
    if (!h || h.trunk || s.action !== 'buried' || s.busy) return;
    this.mode = 'hidden';
    this.wentIn = Math.max(this.wentIn, h.round);
    const k = tuning.birches.squirrel, strength = this.station === 'meeting' ? k.meetSplash : k.splash;
    this.cast.leafSound?.('dive', h.at, strength);
    this.cast.birches.splash(h.at.x, h.at.z, strength);
  }

  /**
   * How hard the air is working over `at` and `reach` round it, as the birches feel it when they shed. A stroke's air
   * is 3.4 m wide and more, so one that passes a metre or two outside a heap still reaches into it.
   */
  private windOn(at: THREE.Vector3, reach: number): number {
    const { gripSpeed, stripSpeed } = tuning.birches;
    let most = 0;
    for (let ring = 0; ring < 3; ring++) {
      const r = reach * ring * 0.5, n = ring === 0 ? 1 : 6, weight = 1 - ring * 0.15;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.5;
        const w = this.cast.wind.sample(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, this.air);
        const gust = Math.min(1, w.energy * 0.85) + Math.min(1, Math.max(0, (Math.hypot(w.x, w.z) - gripSpeed) / (stripSpeed - gripSpeed)));
        most = Math.max(most, gust * weight);
      }
    }
    return most;
  }

  /**
   * How much more updraft stands over `at` than over any other heap of round `round`, as air on it. A column is wider
   * than the gaps between the heaps, so it is the heap it stands over that counts, never the one beside it.
   */
  private liftOn(round: number, at: Spot): number {
    this.lifts.length = 0;
    for (const heap of ROUNDS[round].heaps) {
      const p = BIRCH_PILES[heap];
      if (Math.hypot(p.x - at.x, p.z - at.z) > p.r) this.lifts.push(this.cast.wind.sample(p.x, p.z, this.air).lift);
    }
    const over = this.cast.wind.sample(at.x, at.z, this.air).lift - Math.max(0, ...this.lifts);
    return THREE.MathUtils.clamp(over * tuning.birches.squirrel.liftWork, 0, 1);
  }

  /**
   * Circles wound over another heap of round `round` are that heap's: how much of their gusts, which spill metres
   * past the loop, still count on `at` (1 when the player is not circling over another heap).
   */
  private notCircledElsewhere(round: number, at: Spot): number {
    const { charge, updraftAt: u } = this.cast.input;
    if (charge <= 0) return 1;
    for (const heap of ROUNDS[round].heaps) {
      const p = BIRCH_PILES[heap];
      if (Math.hypot(p.x - at.x, p.z - at.z) > p.r && Math.hypot(p.x - u.x, p.z - u.z) < p.r) {
        return 1 - THREE.MathUtils.smoothstep(charge, 0, tuning.birches.squirrel.circledBy);
      }
    }
    return 1;
  }

  /**
   * Lying hidden: a tell now and then while she is looking for it, until it is found. In the leaves, it is found when
   * the wind has taken enough of them off its back that it shows; behind a trunk, by the wind on it, counted as each
   * rise of the air there, so two glancing gusts add up and a gust's slow dying away adds nothing. Either way a gust
   * that only shaves it makes it peek, as a "nearly". Circles over another heap count only there.
   */
  private lying(dt: number): void {
    const h = this.hidden!;
    const s = this.cast.squirrel;
    const k = tuning.birches.squirrel;
    const rate = this.windOn(h.at, h.reach) + this.liftOn(h.round, h.at);
    const rise = (rate - this.rate > 0.004 ? rate - this.rate : 0) * this.notCircledElsewhere(h.round, h.at);
    this.rate = rate;
    this.work = Math.max(0, this.work + rise - k.findForget * dt);
    if (rate > 0.05) {
      this.gust += rise;
      this.calm = 0;
      this.quiet = 0;
    } else {
      this.calm += dt;
      if (this.cue.seeking) this.quiet += dt;
      /** A gust that only shaved it: a nose up out of the leaves to see what that was. */
      if (this.calm > 0.35 && this.gust > 0) {
        if (this.gust >= k.nearlyWork && !h.trunk && !s.busy) s.act('peek', { for: k.peekFor * 0.8, look: this.face });
        this.gust = 0;
      }
    }
    if (h.trunk && this.work >= k.findWork[h.round]) { this.flush(); return; }
    if (!h.trunk) this.feel(h);
    const playing = this.cue.round === h.round;
    if (playing && this.now >= this.nextTell && !s.busy) {
      this.nextTell = this.now + between(k.tellFrom, k.tellTo);
      if (h.trunk) {
        if (!s.tell()) s.call('chuck', 0.7);
      } else {
        this.cast.leafSound?.('rustle', h.at, 1);
        this.tailOut = Math.random() < k.tailOut[h.round];
        const told = s.tell({ tailOut: this.tailOut });
        if (!told) s.act('buried', { tailOut: this.tailOut });
        this.cast.birches.shiver(h.at.x, h.at.z, told ? k.tailTellStrength : k.tellStrength);
      }
    }
    const pile = h.heap >= 0 ? BIRCH_PILES[ROUNDS[h.round].heaps[h.heap]] : null;
    const asking = pile !== null && playing && this.cue.seeking && this.quiet >= k.inviteAfter;
    if (asking) {
      this.asking.at.set(pile.x, h.at.y + k.inviteLift, pile.z);
      this.asking.radius = pile.r * k.inviteRadius;
      this.asking.urgency = THREE.MathUtils.smoothstep(this.quiet, k.inviteAfter, k.inviteAfter + k.inviteRamp);
    }
    this.invitation = asking ? this.asking : null;
  }

  /**
   * A few times a second, how deep the leaves still lie over its back, read from the live floor over it and round it.
   * Once they are thin enough that it shows, it is uncovered: it starts, sits up in what is left of them with a
   * squeak, and bursts out.
   */
  private feel(h: Hide): void {
    const k = tuning.birches.squirrel;
    if (this.feeling || this.now < this.nextFeel) return;
    this.feeling = true;
    this.nextFeel = this.now + k.feelEvery;
    const across = k.feelAcross;
    this.overBack.forEach((p, i) => p.copy(h.at).add(this.v.set(i === 1 ? across : i === 2 ? -across : 0, 0, i === 3 ? across : i === 4 ? -across : 0)));
    void this.cast.birches.depthAt(this.overBack).then((depths) => {
      this.feeling = false;
      if (this.hidden !== h || this.mode !== 'hidden') return;
      const cover = depths.reduce((a, b) => a + b, 0) / depths.length - h.sink;
      if (cover < k.uncovered) this.uncover();
    });
  }

  private uncover(): void {
    const k = tuning.birches.squirrel;
    const s = this.cast.squirrel;
    this.mode = 'exposed';
    this.invitation = null;
    s.act('freeze', { look: this.face });
    s.call('squeak', 1);
    this.after(k.startledFor, () => this.flush());
  }

  /** Out of the leaves in a spray, up on its haunches facing her, then a good scolding. */
  private flush(): void {
    const h = this.hidden!;
    const { squirrel: s, child } = this.cast;
    this.lastHide.round = h.round;
    this.lastHide.heap = h.heap;
    this.hidden = null;
    this.invitation = null;
    this.mode = 'flushed';
    this.sitAt = this.scoldAt = -1;
    const toward = flat(h.at, child.position);
    if (h.trunk) {
      const out = onGround(h.trunk.at.clone().addScaledVector(toward, 0.9));
      s.follow([{ at: out, on: 'ground' }], undefined, { floor: ground });
    } else {
      const reach = h.heap >= 0 ? BIRCH_PILES[ROUNDS[h.round].heaps[h.heap]].r * 0.55 : 0.8;
      this.cast.leafSound?.('burst', h.at, 1);
      s.act('burst', { at: onGround(h.at.clone().addScaledVector(toward, reach)), look: this.face, floor: this.inLeaves(h) });
    }
    if (this.cue.round !== h.round) return;
    this.chased = false;
    child.kneeling = 0;
    child.lookAt = this.eye;
    this.after(0.45, () => child.cheer(), false);
  }

  private flushed(): void {
    const s = this.cast.squirrel;
    const k = tuning.birches.squirrel;
    if (s.busy) return;
    const facing = Math.atan2(this.face.x - s.position.x, this.face.z - s.position.z);
    if (this.sitAt < 0) {
      s.act('sit', { yaw: facing, look: this.face, nut: false });
      this.sitAt = this.now;
      return;
    }
    if (this.scoldAt < 0) {
      if (this.now - this.sitAt > k.sitFor) {
        s.act('scold', { yaw: facing, look: this.face });
        this.scoldAt = this.now;
      }
      return;
    }
    if (this.now - this.scoldAt < k.scoldFor) return;
    const round = ROUND_OF[this.station] ?? -1;
    if (this.cue.round !== round) { this.choose(round, false); return; }
    this.rounds = round + 1;
    this.setOffAt = this.now;
    this.goTo(this.stationFor(this.cue), true);
  }

  /**
   * She kneels at the heaps' edge and looks at each one the wind bursts. The cygnet seeks too, heap to heap, as
   * often right as wrong; when the wind has left the right heap alone a while, it goes and peers into that one.
   */
  private seek(time: number): void {
    const { child: c, cygnet: bird, carry } = this.cast;
    const k = tuning.birches.squirrel;
    const round = this.cue.round;
    if (round < 0 || this.leaping) return;
    const r = ROUNDS[round];
    if (this.cue.seeking && this.mode !== 'flushed' && this.rounds <= round) {
      c.kneeling = k.kneel;
      for (const heap of r.heaps) {
        const p = BIRCH_PILES[heap];
        const top = this.v.set(p.x, ground(p.x, p.z), p.z);
        if (time - (this.heapBurstAt.get(heap) ?? -1e9) < 1.5 || this.windOn(top, p.r) + this.liftOn(round, top) < 0.45) continue;
        this.heapBurstAt.set(heap, time);
        this.lookUntil = time + 2;
        c.lookAt = this.heapLook.set(p.x, top.y + 0.3, p.z);
        if (this.hidden === null || r.heaps[this.hidden.heap] !== heap) {
          this.cast.leafSound?.('burst', top, 0.7);
          this.answer(time);
        }
      }
      if (time > this.lookUntil) c.lookAt = r.face;
    }
    /** While it waits for her and shuffles, she stands watching it and the cygnet stands by her watching too. */
    const shuffling = (this.mode === 'waiting' || this.mode === 'shuffling') && this.cue.round === round && ROUNDS[round].shuffle;
    if (shuffling && this.cue.standing) c.lookAt = this.tracked;
    if (carry.busy || bird.seating.move || bird.seating.held || bird.state !== 'following') return;
    if (shuffling) {
      if (this.seekRound !== round) {
        this.seekRound = round;
        bird.stay = false;
        bird.errand = r.cygnet[0].clone();
      } else if (!bird.errand) bird.stay = true;
      bird.watch(this.tracked, true);
      return;
    }
    if (this.rounds > round) {
      if (!this.chased && this.mode === 'going') {
        this.chased = true;
        bird.stay = false;
        bird.errand = bird.position.clone().addScaledVector(flat(bird.position, this.cast.squirrel.position), k.chaseReach);
        bird.watch(this.eye);
      }
      return;
    }
    if (!this.cue.seeking) return;
    const h = this.hidden;
    if (h && h.heap >= 0 && this.cue.seeking && this.quiet >= k.hintAfter) {
      if (!this.hinting) {
        this.hinting = true;
        bird.stay = false;
        bird.errand = r.cygnet[1 + h.heap].clone();
        bird.watch(h.at);
        this.seekDone = time;
      } else if (!bird.errand && time > this.seekDone) {
        bird.stay = true;
        bird.mind.perform('peer', 2.4);
        this.seekDone = time + 2.6;
      }
      return;
    }
    if (this.hinting) {
      this.hinting = false;
      bird.stay = false;
    }
    if (bird.errand && time - this.seekSince > 6) bird.errand = null;
    /** At first it stays by her, as she kneels, before it goes looking for itself. */
    if (this.seekRound !== round) {
      this.seekRound = round;
      if (round > 0) {
        bird.stay = false;
        bird.errand = r.cygnet[0].clone();
        bird.watch(r.face);
        this.seekSince = time;
        this.seekDone = time + between(k.seekFrom, k.seekTo) + 1.5;
        return;
      }
    }
    if (bird.errand || time < this.seekDone) return;
    if (this.seekHeap >= 0) {
      bird.mind.perform(Math.random() < 0.6 ? 'delve' : 'peer', 2.2);
      this.after(2.3, () => bird.mind.perform('shake'), false);
      this.seekHeap = -1;
      this.seekDone = time + 3 + between(k.seekFrom, k.seekTo);
      return;
    }
    /** It looks into each from the side nearest her, a step either way along the rim, where the lens can see it. */
    const choices = r.heaps.filter((heap) => heap !== this.lastSeek || r.heaps.length === 1);
    const heap = choices[Math.floor(Math.random() * choices.length)];
    const p = BIRCH_PILES[heap];
    const near = r.cygnet[1 + r.heaps.indexOf(heap)];
    const along = flat(p, near).applyAxisAngle(UP, Math.PI / 2).multiplyScalar((Math.random() - 0.5) * 1.6);
    const rim = near.clone().add(along);
    if (heightAt(rim.x, rim.z) < 0.6) return;
    this.lastSeek = this.seekHeap = heap;
    bird.stay = false;
    bird.errand = rim;
    bird.watch(new THREE.Vector3(p.x, ground(p.x, p.z) + 0.2, p.z));
    this.seekSince = time;
    this.seekDone = time + 0.5;
  }

  /**
   * Wind on a heap it is not in, while it lies hidden in the leaves: the one it is in answers a moment later, its tail
   * up and waving with a chitter, so a child who has lost track of it is told where it went. She turns to look.
   */
  private answer(time: number): void {
    const h = this.hidden, k = tuning.birches.squirrel;
    if (!h || h.trunk || this.mode !== 'hidden' || time < this.nextAnswer) return;
    this.nextAnswer = time + k.answerEvery;
    this.after(k.answerAfter, () => {
      const s = this.cast.squirrel;
      if (this.hidden !== h || this.mode !== 'hidden' || s.busy) return;
      this.nextTell = this.now + between(k.tellFrom, k.tellTo);
      this.tailOut = Math.random() < k.tailOut[h.round];
      if (!s.tell({ tailOut: this.tailOut })) return;
      this.cast.leafSound?.('rustle', h.at, 1);
      this.cast.birches.shiver(h.at.x, h.at.z, k.tailTellStrength);
      this.lookUntil = this.now + 1.6;
      this.cast.child.lookAt = this.heapLook.set(h.at.x, h.at.y + 0.4, h.at.z);
    });
  }

  /**
   * After the third round she takes a run at the deepest leaves left in the hollow (one readback), the cygnet already
   * in them, and lands sitting in a burst of gold; with nothing left to jump into she runs through the hollow
   * kicking up what there is.
   */
  startLeap(): void {
    this.leap = 'reading';
    this.leapAt = this.now;
    const r = ROUNDS[2];
    const piles = r.heaps.map((i) => BIRCH_PILES[i]);
    const points = piles.map((p) => new THREE.Vector3(p.x, ground(p.x, p.z), p.z));
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const x = r.area.x + i * r.area.r * 0.35, z = r.area.z + j * r.area.r * 0.35;
      if (heightAt(x, z) > 0.4) points.push(new THREE.Vector3(x, ground(x, z), z));
    }
    void this.cast.birches.depthAt(points).then((depths) => {
      if (this.leap !== 'reading') return;
      /** Only leaves the lens can see, so she lands in the round's frame; of those deep enough, the nearest, so the run is short. */
      const { child: c, cygnet: bird } = this.cast, k = tuning.birches.squirrel;
      const seen = points.map((p, i) => i).filter((i) => this.inView(2, points[i]));
      const deep = seen.filter((i) => depths[i] >= k.leapDepth * 1.6);
      const by = (score: (i: number) => number) => (deep.length ? deep : seen).reduce((a, i) => (a < 0 || score(i) < score(a) ? i : a), -1);
      const best = deep.length ? by((i) => points[i].distanceTo(c.position)) : by((i) => -depths[i]);
      c.kneeling = 0;
      c.stop();
      bird.stay = false;
      if (best < 0 || depths[best] < tuning.birches.squirrel.leapDepth) {
        const through = onGround(LEAP.land.clone());
        const end = c.position.clone().addScaledVector(flat(c.position, through), Math.max(8, through.distanceTo(c.position) + 4));
        this.leap = 'kicking';
        bird.errand = null;
        c.walkTo(end.x, end.z, true, () => this.landed(), 0.6);
        return;
      }
      const centre = points[best];
      const reach = best < piles.length ? piles[best].r : 1.2;
      const way = flat(c.position, centre);
      this.takeOff.copy(centre).addScaledVector(way, -reach * 1.15);
      if (this.takeOff.distanceTo(c.position) < 1.2) this.takeOff.copy(c.position).addScaledVector(way, 0.2);
      onGround(this.land.copy(centre).addScaledVector(way, -reach * 0.15));
      bird.errand = new THREE.Vector3(-way.z, 0, way.x).multiplyScalar(0.9).add(this.land);
      bird.watch(this.land);
      c.lookAt = this.land;
      this.leap = 'waiting';
      this.leapAt = this.now;
      this.delved = false;
    });
  }

  private leapStep(dt: number): void {
    const { child: c, cygnet: bird } = this.cast;
    const k = tuning.birches.squirrel;
    if (this.leap === 'waiting') {
      if (!bird.errand && !this.delved) {
        this.delved = true;
        bird.mind.perform('delve', 3.5);
      }
      if ((this.delved || this.now - this.leapAt > 3) && this.now - this.leapAt > 0.8) {
        this.leap = 'running';
        c.walkTo(this.takeOff.x, this.takeOff.z, true, () => this.jump(), 0.35);
      }
    } else if (this.leap === 'kicking') {
      this.nextKick -= dt;
      if (this.nextKick <= 0) {
        this.nextKick = k.kickEvery;
        this.cast.leafSound?.('rustle', c.position, 0.8);
        this.cast.birches.burst(c.position.x, c.position.z, k.kickStrength);
      }
    }
  }

  private jump(): void {
    const { child: c, cygnet: bird } = this.cast;
    const k = tuning.birches.squirrel;
    if (this.leap !== 'running') return;
    this.leap = 'flying';
    const way = flat(c.position, this.land);
    c.leap(new THREE.Vector3(way.x * k.leapRun, k.leapUp, way.z * k.leapRun), this.land, 9.81, () => {
      this.cast.leafSound?.('leap', this.land, 1);
      this.cast.birches.burst(this.land.x, this.land.z, k.leapBurst);
      c.lookAt = bird.position;
      this.after(0.5, () => { bird.mind.perform('shake'); bird.watch(this.face); }, false);
    }, () => {
      this.leap = 'sitting';
      this.after(k.leapSitFor, () => {
        c.standUp();
        this.after(0.6, () => this.landed(), false);
      }, false);
    }, false, true);
  }

  private landed(): void {
    this.leap = 'done';
    this.leapt = true;
    this.cast.cygnet.watch(null);
  }

  /**
   * A low-weight look at it when it is worth one: on the log as they come, found and scolding her, running on ahead
   * of her to wait at the next tangle or the swing and waiting there as she comes, and at the goodbye. Never on its
   * dash to hide (she is counting, and where it goes is the game), and never inside a tangle's or the swing's own
   * frame. The depth blur keeps it sharp with her at the meeting, through a round, and at its perch while she works.
   */
  private glance(dt: number): void {
    const k = tuning.birches.squirrel;
    const { child } = this.cast;
    const cue = this.cue;
    const nearing = THREE.MathUtils.smoothstep(k.meetGlance - Math.hypot(child.position.x - this.eye.x, child.position.z - this.eye.z), 0, 10);
    const perched = ROUND_OF[this.station] === undefined && this.station !== 'meeting' && this.station !== 'goodbye' && this.station !== 'farTrunk';
    const ahead = perched && !cue.atTangle && !cue.atSwing;
    let want = 0;
    if (this.station === 'meeting' && this.seen && (this.mode === 'meeting' || this.mode === 'choosing')) want = 1;
    else if ((this.station === 'meeting' || this.mode === 'waiting') && cue.round < 0) want = nearing;
    else if (this.mode === 'flushed') want = 1;
    else if (this.station === 'tangle2' && this.coiled !== 'none' && (this.cast.squirrel.busy || this.coiled === 'startled')) want = 1;
    else if (ahead) want = nearing;
    else if (this.station === 'goodbye' && cue.leaving) want = 1;
    this.attention.strength += (want - this.attention.strength) * (1 - Math.exp(-dt * k.glanceIn));
    this.attention.point.copy(this.eye);

    const playing = this.hidden !== null && cue.round === this.hidden.round;
    const waiting = perched && this.mode === 'idle' && (cue.atTangle || cue.atSwing);
    const shuffling = (this.mode === 'waiting' || this.mode === 'shuffling') && cue.round >= 0;
    const sharp = (this.station === 'meeting' && cue.round >= 0) || playing || this.mode === 'flushed' || waiting || shuffling ? 1 : want;
    this.sharpness.weight += (sharp - this.sharpness.weight) * (1 - Math.exp(-dt * k.sharpIn));
    this.sharpness.at.copy(this.tracked);
  }
}
