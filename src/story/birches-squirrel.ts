import * as THREE from 'three';
import type { CameraAttention } from '../camera-direction';
import type { Floor, SquirrelPoint } from '../creatures/squirrel';
import { tuning } from '../tuning';
import { BIRCH_PILES, ROUND_VIEWS } from '../world/birches';
import { heightAt } from '../world/island';
import { FAR_TRUNK, GOODBYE, LEAP, MEETING, PATHS, ROUNDS, TANGLE_PERCHES, onTrunk, route, swingPerch, type PerchSpec, type Step } from './birches-rounds';
import { heapSeam, type HeapSeam } from './birches-heap-seam';
import type { Cast } from './cast';

const ground: Floor = (x, z) => Math.max(0, heightAt(x, z));
const UP = new THREE.Vector3(0, 1, 0);
const between = (a: number, b: number): number => a + Math.random() * (b - a);
const flat = (from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 => new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
const onGround = (p: THREE.Vector3): THREE.Vector3 => p.setY(ground(p.x, p.z));

/** Where it is between rounds, in the order the walk meets them. */
type Station = 'meeting' | 'tangle1' | 'round2' | 'swing' | 'tangle2' | 'round3' | 'farTrunk' | 'tangle3' | 'tangle4' | 'goodbye';

const WAYS: Record<Exclude<Station, 'meeting'>, readonly Step[]> = {
  tangle1: PATHS.toTangle1, round2: PATHS.toRound2, swing: PATHS.toSwing, tangle2: PATHS.toTangle2, round3: PATHS.toRound3,
  farTrunk: PATHS.toFarTrunk, tangle3: PATHS.toTangle3, tangle4: PATHS.toTangle4, goodbye: PATHS.toGoodbye,
};
const ROUND_OF: Partial<Record<Station, number>> = { meeting: 0, round2: 1, round3: 2 };
/** The meeting's log and the ground either side of it, for the dive off it into the heap. */
const OFF_THE_LOG: Floor = (x, z) => Math.max(ground(x, z), MEETING.floor(x, z));
const STUMP = TANGLE_PERCHES[1].action === 'sit' ? TANGLE_PERCHES[1].at : new THREE.Vector3();
/** The broken birch's top, where it sits through the second tangle, and the ground round it. */
const ON_THE_STUMP: Floor = (x, z) => (Math.hypot(x - STUMP.x, z - STUMP.z) < 0.5 ? STUMP.y : ground(x, z));
const floorTo = (station: Station): Floor => (station === 'tangle2' ? ON_THE_STUMP : ground);

/** What the chapter tells it each frame. */
export interface SquirrelCue {
  /** The round she is walking to or playing; −1 between rounds. */
  round: number;
  /** She has reached the round's heaps and is looking. */
  seeking: boolean;
  tangles: number;
  /** The swing has been ridden or passed by. */
  swingOver: boolean;
  /** The scarf is gathered into the boat. */
  gathered: boolean;
  /** They are going down to the boat or aboard. */
  leaving: boolean;
}

interface Hide {
  round: number;
  /** Which of the round's heaps, or −1 for a drift or a trunk. */
  heap: number;
  at: THREE.Vector3;
  /** How far round it the wind counts. */
  reach: number;
  trunk: { at: THREE.Vector3; up: THREE.Vector3; radius: number } | null;
}

type Mode = 'idle' | 'meeting' | 'going' | 'glancing' | 'choosing' | 'hiding' | 'hidden' | 'flushed';
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
  /** Where the drawn sweep shows a stalled player the heap, or null. */
  invitation: THREE.Vector3 | null = null;
  readonly attention: CameraAttention = { point: new THREE.Vector3(), strength: 0, weight: tuning.birches.squirrel.glance };
  /** The floor's depth and bursts: phase 5a's, or the stand-in until they land. */
  readonly leaves: HeapSeam;
  private station: Station = 'meeting';
  private mode: Mode = 'meeting';
  private seen = false;
  private hidden: Hide | null = null;
  private lastHeap = -1;
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
  private lastSeek = -1;
  private seekDone = 0;
  private seekSince = 0;
  private hinting = false;
  private chased = false;
  private lookUntil = 0;
  private cue: SquirrelCue = { round: -1, seeking: false, tangles: 0, swingOver: false, gathered: false, leaving: false };
  private readonly later: { at: number; generation: number | null; run: () => void }[] = [];
  private readonly face = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly heapLook = new THREE.Vector3();
  private readonly inviteAt = new THREE.Vector3();
  private readonly land = new THREE.Vector3();
  private readonly takeOff = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly heapBurstAt = new Map<number, number>();

  constructor(private readonly cast: Cast) {
    this.leaves = heapSeam(cast.birches, cast.squirrel);
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
    this.leapt = rounds >= 3;
    this.leap = 'none';
    this.cue = cue;
    this.hidden = null;
    this.invitation = null;
    this.attention.strength = 0;
    this.cast.squirrel.visible = true;
    this.station = this.stationFor(cue);
    if (this.station === 'meeting') { this.meet(); return; }
    const round = ROUND_OF[this.station];
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
    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i];
      if (l.generation !== null && l.generation !== this.generation) this.later.splice(i, 1);
      else if (time >= l.at) { this.later.splice(i, 1); l.run(); }
    }
    const want = this.stationFor(cue);
    if (want !== this.station && this.mode !== 'flushed' && this.mode !== 'glancing') this.goTo(want);
    if (this.mode === 'meeting') this.meeting();
    else if (this.mode === 'hiding') this.hiding();
    else if (this.mode === 'hidden') this.lying(dt);
    else if (this.mode === 'flushed') this.flushed();
    this.seek(time);
    this.leapStep(dt);
    this.glance(dt);
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
      case 'swing': return swingPerch(this.cast.birches);
      case 'tangle2': return TANGLE_PERCHES[1];
      case 'farTrunk': return FAR_TRUNK;
      case 'tangle3': return TANGLE_PERCHES[2];
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
    this.cast.squirrel.act('sit', { at: MEETING.at, yaw: MEETING.yaw, floor: MEETING.floor, look: null, nut: true });
  }

  /** Off along its way to `station`, from wherever it is; once found, it glances back at her a few metres on. */
  private goTo(station: Station, glanceBack = false): void {
    this.generation++;
    this.station = station;
    this.hidden = null;
    this.invitation = null;
    const s = this.cast.squirrel;
    if (station === 'meeting') { this.meet(); return; }
    let points = route(this.cast.birches, WAYS[station]);
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
    s.follow(points, () => this.arrive(station), { floor: floorTo(station) });
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
    if (round !== undefined) { this.choose(round, false); return; }
    this.mode = 'idle';
    this.settle(this.perchOf(station), false);
  }

  /** It sees her coming up the ride, freezes, and drops into the heap. */
  private meeting(): void {
    const { child, squirrel: s } = this.cast;
    if (this.seen) return;
    if (Math.hypot(child.position.x - MEETING.at.x, child.position.z - MEETING.at.z) > tuning.birches.squirrel.meetAt && this.cue.round !== 0) return;
    this.seen = true;
    s.act('freeze', { yaw: Math.atan2(this.face.x - s.position.x, this.face.z - s.position.z), look: this.face });
    this.after(tuning.birches.squirrel.meetFreeze, () => this.choose(0, false));
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
    void this.leaves.depthAt([...r.hides, ...grid]).then((depths) => {
      if (generation === this.generation) this.hide(this.pick(round, depths, grid), direct);
    });
  }

  private pick(round: number, depths: number[], grid: THREE.Vector3[]): Hide {
    const k = tuning.birches.squirrel;
    const r = ROUNDS[round];
    const deep = r.hides.map((_, i) => i).filter((i) => depths[i] >= k.buryDepth);
    const choices = deep.length > 1 ? deep.filter((i) => i !== this.lastHeap) : deep;
    if (choices.length > 0) {
      const i = choices[Math.floor(Math.random() * choices.length)];
      return { round, heap: i, at: r.hides[i].clone(), reach: BIRCH_PILES[r.heaps[i]].r, trunk: null };
    }
    let best = -1;
    const drift = (i: number) => depths[r.hides.length + i];
    grid.forEach((_, i) => { if (drift(i) >= k.buryDepth && (best < 0 || drift(i) > drift(best))) best = i; });
    if (best >= 0) return { round, heap: -1, at: grid[best].clone(), reach: k.driftReach, trunk: null };
    /** Nothing left to bury itself in: flat to the bark of the tree a heap was banked against, round from her. */
    const heap = BIRCH_PILES[r.heaps[Math.floor(Math.random() * r.heaps.length)]];
    const lens = ROUND_VIEWS[round].from;
    const axis = new THREE.Vector3();
    this.cast.birches.trunkAt(heap.x - lens.x * (heap.r + 0.8), heap.z - lens.z * (heap.r + 0.8), 0.8, axis);
    const turn = 0.7 * (Math.random() < 0.5 ? -1 : 1), c = Math.cos(turn), sn = Math.sin(turn);
    const toward = { x: axis.x - (lens.x * c - lens.z * sn) * 4, z: axis.z - (lens.x * sn + lens.z * c) * 4 };
    const trunk = onTrunk(this.cast.birches, { tree: { x: axis.x, z: axis.z }, height: 0.8, toward });
    return { round, heap: -1, at: trunk.at, reach: k.driftReach, trunk };
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
      if (h.trunk) s.act('climb', { at: h.trunk.at, up: h.trunk.up, forward: UP, radius: h.trunk.radius, look: this.face });
      else s.hide(h.at, { tailOut: this.tailOut, yaw: Math.random() * Math.PI * 2, floor: ground });
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
        s.look(this.face);
      }, { floor: ground });
      return;
    }
    if (this.station === 'meeting' || Math.hypot(h.at.x - from.x, h.at.z - from.z) < 3.5) { this.dive(h); return; }
    const rim = onGround(h.at.clone().addScaledVector(flat(h.at, from), 1.6));
    s.follow([{ at: rim, on: 'ground' }], () => { if (this.hidden === h) this.dive(h); }, { floor: ground });
  }

  private dive(h: Hide): void {
    this.cast.squirrel.act('dive', { at: h.at, tailOut: this.tailOut, floor: this.station === 'meeting' ? OFF_THE_LOG : ground, yaw: Math.random() * Math.PI * 2 });
  }

  private hiding(): void {
    const s = this.cast.squirrel;
    if (!this.hidden?.trunk && s.action === 'buried' && !s.busy) this.mode = 'hidden';
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
   * Lying hidden: a tell now and then while she is looking for it, and the wind on it counted until it bursts out.
   * What counts is each rise of the air over it, so it bursts as the gust arrives, two glancing gusts add up, and a
   * gust's slow dying away adds nothing.
   */
  private lying(dt: number): void {
    const h = this.hidden!;
    const s = this.cast.squirrel;
    const k = tuning.birches.squirrel;
    const rate = this.windOn(h.at, h.reach);
    const rise = rate - this.rate > 0.004 ? rate - this.rate : 0;
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
    if (this.work >= k.findWork[h.round]) { this.flush(); return; }
    const playing = this.cue.round === h.round;
    if (playing && this.now >= this.nextTell && !s.busy) {
      this.nextTell = this.now + between(k.tellFrom, k.tellTo);
      if (h.trunk) {
        s.heard.push({ kind: 'chuck', amount: 0.7 });
      } else {
        this.leaves.burst(h.at.x, h.at.z, k.tellStrength);
        this.cast.leafSound?.('rustle', h.at, 1);
        this.tailOut = Math.random() < k.tailOut[h.round];
        if (Math.random() < k.peekChance) s.act('peek', { for: k.peekFor, tailOut: this.tailOut, look: this.face });
        else s.act('buried', { tailOut: this.tailOut });
      }
    }
    const pile = h.heap >= 0 ? BIRCH_PILES[ROUNDS[h.round].heaps[h.heap]] : null;
    this.invitation = pile && playing && this.cue.seeking && this.quiet >= k.inviteAfter - tuning.wood.inviteAfter
      ? this.inviteAt.set(pile.x, h.at.y + 0.6, pile.z) : null;
  }

  /** Out of the leaves in a spray, up on its haunches facing her, then a good scolding. */
  private flush(): void {
    const h = this.hidden!;
    const { squirrel: s, child } = this.cast;
    this.lastHeap = h.heap;
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
      s.act('burst', { at: onGround(h.at.clone().addScaledVector(toward, reach)), look: this.face, floor: ground });
      this.cast.leafSound?.('burst', h.at, 1);
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
        if (time - (this.heapBurstAt.get(heap) ?? -1e9) < 1.5 || this.windOn(top, p.r) < 0.45) continue;
        this.heapBurstAt.set(heap, time);
        if (this.hidden === null || r.heaps[this.hidden.heap] !== heap) this.cast.leafSound?.('burst', top, 0.7);
        this.lookUntil = time + 2;
        c.lookAt = this.heapLook.set(p.x, top.y + 0.3, p.z);
      }
      if (time > this.lookUntil) c.lookAt = r.face;
    }
    if (carry.busy || bird.seating.move || bird.seating.held || bird.state !== 'following') return;
    if (this.rounds > round) {
      if (!this.chased && this.mode === 'going') {
        this.chased = true;
        bird.stay = false;
        bird.errand = bird.position.clone().addScaledVector(flat(bird.position, this.cast.squirrel.position), k.chaseReach);
        bird.watch(this.eye);
      }
      return;
    }
    const h = this.hidden;
    if (h && h.heap >= 0 && this.cue.seeking && this.quiet >= k.hintAfter) {
      if (!this.hinting) {
        this.hinting = true;
        bird.stay = false;
        bird.errand = h.at.clone().addScaledVector(flat(h.at, c.position), BIRCH_PILES[r.heaps[h.heap]].r * 0.95);
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
    if (bird.errand || time < this.seekDone) return;
    if (this.seekHeap >= 0) {
      bird.mind.perform(Math.random() < 0.6 ? 'delve' : 'peer', 2.2);
      this.after(2.3, () => bird.mind.perform('shake'), false);
      this.seekHeap = -1;
      this.seekDone = time + 3 + between(k.seekFrom, k.seekTo);
      return;
    }
    const choices = r.heaps.filter((heap) => heap !== this.lastSeek || r.heaps.length === 1);
    const heap = choices[Math.floor(Math.random() * choices.length)];
    const p = BIRCH_PILES[heap];
    const side = Math.random() * Math.PI * 2;
    const rim = new THREE.Vector3(p.x + Math.sin(side) * p.r * 0.9, 0, p.z + Math.cos(side) * p.r * 0.9);
    if (heightAt(rim.x, rim.z) < 0.6) return;
    this.lastSeek = this.seekHeap = heap;
    bird.stay = false;
    bird.errand = rim;
    bird.watch(new THREE.Vector3(p.x, ground(p.x, p.z) + 0.2, p.z));
    this.seekSince = time;
    this.seekDone = time + 0.5;
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
    void this.leaves.depthAt(points).then((depths) => {
      if (this.leap !== 'reading') return;
      let best = 0;
      depths.forEach((d, i) => { if (d > depths[best]) best = i; });
      const { child: c, cygnet: bird } = this.cast;
      c.kneeling = 0;
      c.stop();
      bird.stay = false;
      if (depths[best] < tuning.birches.squirrel.leapDepth) {
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
        this.leaves.burst(c.position.x, c.position.z, k.kickStrength);
        this.cast.leafSound?.('rustle', c.position, 0.8);
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
      this.leaves.burst(this.land.x, this.land.z, k.leapBurst);
      this.cast.leafSound?.('leap', this.land, 1);
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

  /** A low-weight look at it when it is worth one: on the log as they come, on its dash down the wool, and at the goodbye. */
  private glance(dt: number): void {
    const k = tuning.birches.squirrel;
    const { child } = this.cast;
    let want = 0;
    if (this.station === 'meeting' && this.cue.round < 0) {
      const d = Math.hypot(child.position.x - MEETING.at.x, child.position.z - MEETING.at.z);
      want = THREE.MathUtils.smoothstep(k.meetAt + 16 - d, 0, 10);
    } else if (this.station === 'round2' && this.mode === 'going' && this.cue.round < 0) want = 1;
    else if (this.station === 'goodbye' && this.cue.leaving) want = 1;
    this.attention.strength += (want - this.attention.strength) * (1 - Math.exp(-dt * k.glanceIn));
    this.attention.point.copy(this.eye);
  }
}
