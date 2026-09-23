import type { CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { heightAt } from '../world/island';
import { LITTLE_BOATS as L, BOATS_BERTH, BOATS_LANDING, boatsX, boatsWidth, boatsLevel, boatsWaterHeight } from '../world/little-boats-layout';
import type { Cast, Chapter } from './cast';
import { cue, completeObjective } from './cues';

const POOLS = [
  { enter: 4, leave: 30 },
  { enter: 34, leave: 65 },
  { enter: 69, leave: 94 },
];

type Beat =
  | 'arrival'
  | 'setDown'
  | 'notice'
  | 'pickup'
  | 'holdToy'
  | 'carryToy'
  | 'launch'
  | 'sailing'
  | 'reveal'
  | 'gather'
  | 'boarding'
  | 'aboard';
/** Follow a toy fleet along its bank; the same wind will carry the travellers away at the end. */
export class LittleBoatsChapter implements Chapter {
  beat: Beat = 'arrival';
  readonly breeze = 0.5;
  readonly worldLife = 1;
  readonly dusk = 0.08;
  readonly season = 0.23;
  get haze(): number {
    return 1.105 - 0.055 * THREE.MathUtils.smoothstep(this.cast.littleBoats.progress, 68, 85);
  }
  readonly music = 'boats' as const;
  readonly hush = 0.28;
  readonly pace = 0.65;
  readonly focus = new THREE.Vector3();
  readonly shot: Shot = {
    target: new THREE.Vector3(),
    distance: 22,
    height: 8,
    from: new THREE.Vector3(0.48, 0, 0.88).normalize(),
    fitWidth: true,
  };
  private elapsed = 0;
  private boatMoved = false;
  private savedPool = 0;
  private nextBirdLook = 0;
  private pool = 0;
  private swim: 'bank' | 'approach' | 'water' | 'out' = 'bank';
  private swimEntry = 0;
  private dryUntil = 0;
  private readonly swimAim = new THREE.Vector3();
  private readonly bank = new THREE.Vector3();
  private readonly birdBank = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly gripFrom = [new THREE.Vector3(), new THREE.Vector3()];

  constructor(private readonly cast: Cast) {
    const { child: c, plane: p, cygnet: k, littleBoats: room } = cast;
    room.active = true;
    k.mayFly = false;
    k.stay = false;
    c.stowPlane(true, true);
    p.hold(c);
    p.visible = true;
    c.dismount();
    this.bankAt(3, this.bank);
    const arrive = () =>
      c.walkTo(
        this.bank.x,
        this.bank.z,
        false,
        () => {
          this.to('setDown');
          c.faceToward(c.position.x, c.position.z - 3, 1);
          cast.carry.setDown(() => {
            this.to('notice');
            c.engaged = true;
            k.stay = true;
            k.watch(room.focus);
            c.faceToward(room.stranded.x, room.stranded.z, 1);
          });
        },
        0.35,
      );
    // Approach outside the first pool even when the incoming boat grounds off-centre.
    c.walkTo(BOATS_LANDING.x, BOATS_LANDING.z - 5, false, arrive, 0.6);
    this.frame();
  }
  get departureKite(): boolean { return this.cast.littleBoats.progress >= tuning.linesToys.boatKiteRevealAt; }

  get done(): boolean {
    return this.beat === 'aboard';
  }
  get scripted(): boolean {
    return !['sailing', 'reveal'].includes(this.beat);
  }
  get windInvitation(): THREE.Vector3 | null {
    const r = this.cast.littleBoats;
    return this.beat === 'sailing' && r.idle > tuning.littleBoats.inviteAfter ? r.invitation : null;
  }
  get checkpoint(): string | null {
    if (this.beat !== 'sailing') return null;
    return this.savedPool ? `pool-${this.savedPool}` : null;
  }
  saveCheckpoint(): CheckpointPayload<'boats'> {
    return [this.cast.littleBoats.progress];
  }
  restoreCheckpoint(point: string, data: number[]): void {
    const { child, cygnet, plane, littleBoats: room } = this.cast;
    this.savedPool = point === 'pool-2' ? 2 : 1;
    this.pool = this.savedPool;
    this.swim = 'bank';
    room.restore(Math.max(this.savedPool === 2 ? 68 : 32, Math.min(95, data[0])));
    child.stop();
    child.kneeling = 0;
    child.lean = 0;
    child.engaged = false;
    child.reachFor(0, null);
    child.reachFor(1, null);
    this.bankAt(room.progress - 1, this.bank);
    child.place(this.bank.x, this.bank.z, Math.PI);
    this.bankAt(room.progress, this.birdBank, 1.3);
    cygnet.release(this.birdBank);
    cygnet.stay = false;
    this.to('sailing');
    child.stowPlane(true, true);
    plane.hold(child);
    plane.visible = true;
    if (room.progress > 32) this.moveBoat();
    this.frame();
  }
  private to(beat: Beat): void {
    this.beat = beat;
    this.elapsed = 0;
  }
  private bankAt(s: number, out: THREE.Vector3, extra = 0): THREE.Vector3 {
    const x = boatsX(s) + boatsWidth(s) + tuning.littleBoats.bankOffset + extra,
      z = L.startZ - s;
    return out.set(x, heightAt(x, z), z);
  }
  private moveBoat(): void {
    if (this.boatMoved) return;
    this.cast.boat.beach(BOATS_BERTH.x, BOATS_BERTH.z, Math.PI);
    this.boatMoved = true;
  }
  update(dt: number, time: number): void {
    this.elapsed += dt;
    const { child: c, plane: p, cygnet: k, littleBoats: room, wind, boat } = this.cast;
    const childS = L.startZ - c.position.z;
    let limit = Math.max(3, childS + tuning.littleBoats.childLead);
    const pool = POOLS[this.pool];
    if (this.swim === 'approach') limit = Math.min(limit, this.swimEntry + 5);
    if (this.swim === 'water') limit = Math.min(limit, L.startZ - k.position.z + tuning.littleBoats.swimLead);
    if (this.swim === 'out' && pool) limit = Math.min(limit, pool.leave + 3);
    room.update(dt, time, wind, limit);
    if (this.beat === 'notice') {
      c.lookAt = room.focus;
      if (this.elapsed > 1.2) {
        // Stand close enough that the mittens can actually reach the stranded hull.
        c.walkTo(
          room.stranded.x + 1.5,
          room.stranded.z,
          false,
          () => {
            c.faceToward(c.position.x - 3, c.position.z, 1);
            this.to('pickup');
          },
          0.08,
        );
      }
    } else if (this.beat === 'pickup') {
      c.kneeling = 1;
      c.lean = 1.4;
      c.lookAt = room.focus;
      this.grip(room.stranded);
      if (this.elapsed > 2.4) {
        for (const hand of [0, 1] as const) c.toBody(c.mitten(hand, this.hand), this.gripFrom[hand]);
        room.held = true;
        this.to('holdToy');
      }
    } else if (this.beat === 'holdToy' || this.beat === 'carryToy') {
      c.kneeling = 0;
      c.lean = 0;
      c.lookAt = room.focus;
      const lift = this.beat === 'carryToy' ? 1 : THREE.MathUtils.smootherstep(this.elapsed, 0, 1.4);
      for (const hand of [0, 1] as const) {
        this.hand.set(hand === 0 ? 0.2 : -0.2, 0.5, 0.5).lerp(this.gripFrom[hand], 1 - lift);
        c.reachLocal(hand, this.hand);
      }
      if (this.beat === 'holdToy' && this.elapsed > 2.4) {
        this.to('carryToy');
        c.walkTo(
          boatsX(3) + boatsWidth(3) * 0.99,
          L.startZ - 3,
          false,
          () => {
            c.faceToward(c.position.x - 3, c.position.z, 1);
            for (const hand of [0, 1] as const) c.mitten(hand, this.gripFrom[hand]);
            this.to('launch');
          },
          0.08,
        );
      }
    } else if (this.beat === 'launch') {
      c.lookAt = room.focus;
      c.kneeling = 1;
      c.lean = 1.4;
      if (!room.released) {
        const x = boatsX(3) + boatsWidth(3) * 0.7;
        this.hand.set(x, boatsWaterHeight(x, L.startZ - 3, time) + tuning.littleBoats.toyDraft, L.startZ - 3);
        const y = this.hand.y,
          z = this.hand.z;
        const lower = THREE.MathUtils.smootherstep(this.elapsed, 0, 1.8);
        for (const hand of [0, 1] as const) {
          this.hand.set(x + 0.3, y + 0.18, z + (hand === 0 ? 0.22 : -0.22)).lerp(this.gripFrom[hand], 1 - lower);
          c.reachFor(hand, this.hand);
        }
        if (this.elapsed > 2.5) room.releaseToy();
      } else {
        c.reachFor(0, null);
        c.reachFor(1, null);
        room.launch = THREE.MathUtils.smootherstep(this.elapsed, 2.5, 4.8);
        if (this.elapsed > 5) {
          c.kneeling = 0;
          c.lean = 0;
          c.engaged = false;
          k.stay = false;
          room.launched = true;
          room.idle = 0;
          this.to('sailing');
          cue('delight');
        }
      }
    } else if (this.beat === 'sailing') {
      const s = room.progress;
      // Short goals follow the curved bank rather than cutting across the pools.
      const targetS = Math.min(s - 0.8, childS + 2.5);
      c.stroll = 1 + tuning.littleBoats.childHurry * THREE.MathUtils.smoothstep(s - childS, 1.5, 4);
      this.bankAt(Math.max(3, targetS), this.bank);
      if (c.position.distanceTo(this.bank) > 0.75) c.walkTo(this.bank.x, this.bank.z, false, undefined, 0.3);
      c.lookAt = room.focus;
      if (s > 32) {
        this.savedPool = 1;
        this.moveBoat();
      }
      if (s > 68) this.savedPool = 2;
      if (!k.carried && !this.cast.carry.busy && !this.paddle(time)) {
        const birdS = L.startZ - k.position.z;
        this.bankAt(Math.max(3, Math.min(s + 0.5, birdS + 2)), this.birdBank, 0.7);
        if (k.position.distanceTo(this.birdBank) > 0.7) k.errand = this.birdBank;
        k.watch(room.focus);
        if (time > this.nextBirdLook && room.idle > 1.5 && k.position.distanceTo(c.position) < 4) {
          k.mind.perform('nibble');
          this.nextBirdLook = time + 8;
        }
      }
      if (s >= L.length && childS > 94 && this.pool === POOLS.length) {
        this.to('reveal');
        c.stop();
        c.stroll = 1;
        c.lookAt = boat.position;
        completeObjective();
      }
    } else if (this.beat === 'reveal' && this.elapsed > tuning.littleBoats.revealFor) {
      this.to('gather');
      k.errand = null;
      k.stay = false;
      k.watch(null);
      this.cast.carry.gatherUp(() => this.cast.carry.stow(() => this.board()));
    }
    room.swimmer(k.state === 'swimming' && !k.seating.move ? k.position : null, k.yaw, k.paddlePhase, k.swimPlay);
    if (p.held) p.hold(c);
    p.visible = true;
    this.frame();
  }
  private grip(at: THREE.Vector3): void {
    const x = at.x + 0.3,
      y = at.y + 0.18,
      z = at.z;
    this.cast.child.reachFor(0, this.hand.set(x, y, z + 0.22));
    this.cast.child.reachFor(1, this.hand.set(x, y, z - 0.22));
  }

  /** Long paddles through the pools and their shallows, with brief dry-bank pauses between them. */
  private paddle(time: number): boolean {
    const { cygnet: bird, littleBoats: room } = this.cast;
    const pool = POOLS[this.pool];
    if (time < this.dryUntil) {
      bird.errand = null;
      bird.stay = true;
      return true;
    }
    bird.stay = false;
    bird.pace = 1;
    if (!pool || (this.swim === 'bank' && room.progress < pool.enter)) return false;
    if (this.swim === 'bank') {
      this.swim = 'approach';
      this.swimEntry = Math.max(pool.enter, Math.min(pool.leave - 8, L.startZ - bird.position.z + 1));
    }
    if (this.swim === 'approach') {
      bird.pace = 0.4;
      // The low lip is less than one short hop from the water; never jump from the high bank.
      const s = this.swimEntry;
      this.birdBank.set(boatsX(s) + boatsWidth(s) * 1.05, 0, L.startZ - s);
      this.birdBank.y = heightAt(this.birdBank.x, this.birdBank.z);
      bird.errand = this.birdBank;
      bird.watch(room.focus);
      if (Math.hypot(bird.position.x - this.birdBank.x, bird.position.z - this.birdBank.z) < 0.8 && !bird.seating.move) {
        bird.errand = null;
        bird.swimLevel = boatsWaterHeight(bird.position.x, bird.position.z, time);
        this.swimAim.set(boatsX(s) + boatsWidth(s) * 0.7, bird.swimLevel, L.startZ - s);
        bird.swimTo(this.swimAim);
        this.swim = 'water';
      }
      return true;
    }
    const s = L.startZ - bird.position.z;
    bird.swimLevel = boatsWaterHeight(bird.position.x, bird.position.z, time);
    if (this.swim === 'water') {
      const ahead = Math.min(pool.leave - 2, s + 3, room.progress + 0.4);
      const joy = tuning.littleBoats.swimPlay * (0.45 + 0.55 * room.toys[0].fill);
      bird.swimPlay = joy;
      const weave =
        Math.sin(time * 1.15) *
        tuning.littleBoats.swimWeave *
        joy *
        THREE.MathUtils.smoothstep(s, pool.enter, pool.enter + 3) *
        (1 - THREE.MathUtils.smoothstep(s, pool.leave - 6, pool.leave - 3));
      this.swimAim.set(boatsX(ahead) + boatsWidth(ahead) * (0.48 + weave), boatsLevel(ahead), L.startZ - ahead);
      bird.swimTo(this.swimAim);
      bird.watch(Math.sin(time * 0.7) > 0.8 ? this.cast.child.position : room.focus);
      if (room.progress >= pool.leave - 1 && s > pool.leave - 4) this.swim = 'out';
      return true;
    }
    bird.swimPlay = 0;
    const outS = Math.min(pool.leave, s + 1.5);
    const outLane = 0.5 + 0.15 * THREE.MathUtils.smoothstep(s, pool.leave - 2, pool.leave);
    this.swimAim.set(boatsX(outS) + boatsWidth(outS) * outLane, boatsLevel(outS), L.startZ - outS);
    bird.swimTo(this.swimAim);
    if (s > pool.leave - 0.7 && bird.position.distanceTo(this.swimAim) < 0.8 && !bird.seating.move) {
      const x = boatsX(pool.leave) + boatsWidth(pool.leave) + 0.8;
      bird.ashore(x, L.startZ - pool.leave, Math.PI * 0.5);
      bird.bind(0.025);
      this.pool++;
      this.swim = 'bank';
      this.dryUntil = time + 1.2;
    }
    return true;
  }

  private board(): void {
    const { child: c, boat, cygnet: k, plane: p, littleBoats: room } = this.cast;
    this.to('boarding');
    c.lookAt = null;
    k.mayFly = true;
    k.errand = null;
    k.watch(null);
    const at = boat.boardingPoint(this.bank);
    c.walkTo(
      at.x,
      at.z,
      false,
      () => {
        c.board(boat, () => {
          room.active = false;
          c.stowPlane(false);
          p.visible = true;
          p.hold(c);
          this.to('aboard');
        });
      },
      0.4,
    );
  }
  private frame(): void {
    const { child: c, littleBoats: room, boat } = this.cast;
    const s = this.shot;
    const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    const ending = ['reveal', 'gather', 'boarding', 'aboard'].includes(this.beat);
    const toy = ending ? boat.position : room.focus;
    s.target.copy(c.position).lerp(toy, ending ? 0.5 : portrait ? 0.4 : 0.62);
    s.target.y = Math.max(c.position.y, toy.y) + 1.05;
    s.target.z -= ending ? 0 : 2;
    const handling = ['notice', 'pickup', 'holdToy', 'carryToy', 'launch'].includes(this.beat);
    s.distance = ending ? 25 : handling ? 13 : 23;
    s.height = ending ? 8 : handling ? 6 : 9;
    if (handling) s.target.z += 2;
    s.from!.set(handling ? -0.6 : 0.48, 0, handling ? 0.8 : 0.88).normalize();
    // Keep the child and the swimmer readable on a phone rather than preserving the whole landscape.
    s.fitWidth = !portrait;
    if (portrait) s.distance += 4;
    this.focus.copy(s.target);
  }
}
