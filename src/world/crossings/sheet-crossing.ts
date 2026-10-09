import * as THREE from 'three';
import { tuning } from '../../tuning';
import type { MaterialSound } from '../../audio/foley';
import type { CatStep } from './cat-way';
import type { CrossingCast } from './tree-crossing';
import { HOLD_DROP, SHEET, WashSheet, type SheetSound, type SheetSpot } from './wash-sheet';

/** Where she waits under the sheet's trailing edge, where her feet come down on the far roof, and where she goes on to. */
export interface SheetWay {
  /** At the end of her ridge, a stride short of the trailing edge. */
  wait: THREE.Vector3;
  /** On the far ridge, just past where the sheet sets her down. */
  stepOff: THREE.Vector3;
  onward: THREE.Vector3;
}

export type SheetEvent = SheetSound | 'land';

/** The sheet filling with a soft whump, settling, flapping; her boots on the far slates. */
export const SHEET_SOUNDS = { fill: 'sail', sag: 'sail-settle', flap: 'linen-flap', land: 'slate-land' } as const satisfies Record<SheetEvent, MaterialSound>;

/**
 * Hanging from the middle of the hem, her mittens close in front of her face (higher, the big hood swallows them): how
 * far below them her feet are, and how far behind them, along the way she faces, her body hangs (m). Waiting under it,
 * the slack hem hangs just over her hood, `REACH` over her feet, for her to reach up to.
 */
export const HANG = 1.93;
export const UNDER = 0.2;
const REACH = 2.25;

/**
 * Where her mittens close on the middle of the hem at the start of the ride, just short of her gable, the sheet hanging
 * out over the lane; and where they are at its end, past the far gable (m).
 */
const TAKE_FROM = -0.3;
const LET_GO = 0.62;
/** Where she waits, a reach short of the trailing edge at her gable; and where her feet come down past the far one (m). */
export const SHEET_WAIT = TAKE_FROM - UNDER;
export const SHEET_OFF = 0.36;
/** Her mittens either side of the gathered hem, and the highest she reaches for it standing, over her feet (m). */
const GRIP = 0.07;
const STRETCH = 2.12;

/**
 * A sheet's line over a lane, laid level along `along` from `edge` (the end of her ridge at its gable, at the ridge's
 * height) to a ridge at height `far` beyond a lane `lane` wide: tied round her chimney `back` behind her gable and run
 * over the far chimney's pulley `beyond` past its gable. Solved from where her mittens are at the start of the ride
 * (the trailing edge where she reaches standing, her weight sagging it onto her heels) and at its end (her feet just
 * over the far ridge), each sag made up.
 */
export function sheetLine(edge: THREE.Vector3, along: THREE.Vector2, lane: number, far: number, back: number, beyond: number):
  { from: THREE.Vector3; to: THREE.Vector3; start: number; stop: number } {
  const k = tuning.crossings.sheet;
  const at = (u: number, y: number) => new THREE.Vector3(edge.x + along.x * u, y, edge.z + along.y * u);
  let from = new THREE.Vector3(), to = new THREE.Vector3(), start = 0, stop = 0;
  let sagS = 0.07, sagE = 0.05;
  for (let i = 0; i < 4; i++) {
    const s = at(TAKE_FROM, edge.y + REACH + HOLD_DROP + sagS);
    const e = at(lane + LET_GO, far + 0.28 + HANG + HOLD_DROP + k.holdDip + sagE);
    const rise = (e.y - s.y) / (lane + LET_GO - TAKE_FROM);
    from = at(-back, s.y + rise * (-back - TAKE_FROM));
    to = at(lane + beyond, s.y + rise * (lane + beyond - TAKE_FROM));
    const L = from.distanceTo(to);
    start = from.distanceTo(s) - SHEET.length / 2;
    stop = L - from.distanceTo(e) - ((SHEET.rings - 1) / 2) * SHEET.bunch;
    const sag = (d: number) => k.slack * L * 4 * (d / L) * (1 - d / L);
    sagS = sag(from.distanceTo(s));
    sagE = sag(from.distanceTo(e));
  }
  return { from, to, start, stop };
}

/**
 * The sheet crossing: a big sheet on a washing line from her chimney over a lane to a higher roof's. The player's
 * strokes up the line across it fill it; a gust that dies lets it sag back. Once it is full she takes hold of its
 * trailing edge, and while it stays full it runs up the line with her hanging from it, her feet off the slates, over
 * the water, until its rings bunch at the far end and she drops onto the high roof. If the player stops it sags and
 * she hangs where she is, waiting; nothing is timed and nothing fails.
 */
export class SheetCrossing {
  readonly sheet: WashSheet;
  phase: 'off' | 'waiting' | 'taking' | 'carried' | 'landing' | 'landed' | 'leaving' | 'over' = 'off';
  /** Where the drawn gust goes while the player has not found it, and its screen angle. */
  invitation: THREE.Vector3 | null = null;
  heading = 0;
  /** Seconds in the current phase. */
  t = 0;
  /** False while the cat is still on the line: she will not take hold until it is off. Whoever drives the cat sets it. */
  clear = true;
  onEvent: ((kind: SheetEvent, at: THREE.Vector3, strength: number) => void) | null = null;
  private full = 0;
  private stalled = 0;
  private best = 0;
  private valveClock = 0;
  private valveOn = false;
  private speed = 0;
  private lastSpeed = 0;
  /** Her body's swing under her hands, radians, feet forward positive. */
  private swing = 0;
  private swingSpeed = 0;
  private swungForward = false;
  private lift = 0;
  /** The fresh air of the last strokes, which is what carries her: it ebbs faster than the cloth sags. */
  private gust = 0;
  private endFor = 0;
  private readonly from = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly hands = new THREE.Vector3();
  private readonly lens = new THREE.Vector3();
  private readonly landAt = new THREE.Vector3();
  /** Hanging, how far she has turned from up the line toward the lens, so her face is seen. */
  private turn = 0;

  constructor(spot: SheetSpot | WashSheet, readonly way: SheetWay, private readonly cast: CrossingCast) {
    this.sheet = spot instanceof WashSheet ? spot : new WashSheet(spot);
    this.sheet.onSound = (kind, where, strength) => this.onEvent?.(kind, where, strength);
  }

  get objects(): THREE.Object3D[] {
    return this.sheet.objects;
  }

  get done(): boolean {
    return this.phase === 'over';
  }

  /** The way along the line, as a yaw. */
  get facing(): number {
    return Math.atan2(this.sheet.along.x, this.sheet.along.z);
  }

  /** Once the world's own gusts have taken over they keep on until she is across. */
  get valving(): boolean {
    if (this.stalled > tuning.crossings.sheet.valveAfter) this.valveOn = true;
    return this.valveOn;
  }

  /** Off her feet and in the sheet's keeping: from the moment it takes her weight. */
  get hanging(): boolean {
    return this.phase === 'carried' || (this.phase === 'taking' && this.sheet.held);
  }

  reset(): void {
    this.sheet.reset();
    this.phase = 'off';
    this.invitation = null;
    this.t = this.full = this.stalled = this.best = this.valveClock = this.speed = this.lastSpeed = 0;
    this.swing = this.swingSpeed = this.lift = this.turn = this.gust = 0;
    this.valveOn = this.swungForward = false;
    this.clear = true;
    const c = this.cast.child;
    c.hang = 0;
    c.reachFor(0, null);
    c.reachFor(1, null);
  }

  /** She is at the wait point under the trailing edge: from here it is hers to wait for. */
  begin(): void {
    this.to('waiting');
    this.best = 0;
    this.sheet.quiet = 0;
  }

  /**
   * The cat's own way over: up onto the line from beside her (`near`, on her roof), along it over the rings, and down
   * onto the far roof (`far`). Tell the piece where it is while it is on the line (`catAt`), and set `clear` once it
   * is off.
   */
  catWay(near: THREE.Vector3, far: THREE.Vector3): CatStep[] {
    const s = this.sheet;
    const along = (p: THREE.Vector3) => ((p.x - s.from.x) * s.along.x + (p.z - s.from.z) * s.along.z)
      / Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z) * s.length;
    const on = s.lineAt(along(near) + 0.5, new THREE.Vector3());
    const off = s.lineAt(Math.min(s.length - s.stop - 0.1, along(far)), new THREE.Vector3());
    return [{ hop: on }, { run: [off], narrow: true, floor: (x, z) => s.floor(x, z) }, { hop: far.clone() }];
  }

  /** Where the cat is while it is on the line, so the line dips under it; null once it is off. */
  catAt(at: THREE.Vector3 | null): void {
    this.sheet.cat = at;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const k = tuning.crossings.sheet;
    const { child: c, input, wind } = this.cast;
    this.t += dt;
    this.lens.copy(camera.position);
    const playing = this.phase === 'waiting' || this.phase === 'taking' || this.phase === 'carried';
    if (playing) {
      const push = this.sheet.brush(camera, input, wind, dt);
      this.gust = Math.min(1.2, Math.max(0, this.gust * Math.exp(-dt / k.gustFor) + Math.max(0, push) * k.push));
      const progress = this.phase === 'carried' ? 1 + this.sheet.travel : Math.min(1, this.sheet.fill);
      if (progress > this.best + 0.02) {
        this.best = progress;
        this.stalled = 0;
      } else this.stalled += dt;
      if (this.valving) this.blow(dt);
    }
    if (this.phase === 'landed') c.lookAt = this.look.copy(this.way.stepOff).addScaledVector(this.sheet.along, 3).setY(this.way.stepOff.y + 1.1);
    this.sheet.update(dt, camera, wind);

    const asking = (this.phase === 'waiting' || this.phase === 'carried') && this.sheet.quiet > k.inviteAfter && !this.valving;
    this.invitation = asking ? this.sheet.middle(this.at).clone() : null;
    if (asking) this.heading = this.sheet.heading(camera);

    if (this.phase === 'waiting') {
      c.lookAt = this.sheet.middle(this.look).setY(this.look.y + 0.3 * Math.sin(this.t * 0.5));
      this.full = this.sheet.fill >= k.takeAt ? this.full + dt : 0;
      if (this.full >= k.takeFor && this.clear && !c.busy) this.take();
    } else if (this.phase === 'taking') {
      const turn = Math.atan2(Math.sin(this.facing - c.yaw), Math.cos(this.facing - c.yaw));
      c.yaw += turn * Math.min(1, this.t * 6);
      if (this.sheet.held) this.hang(dt);
      else {
        this.reach();
        if (this.t >= k.reachFor && Math.min(c.reached(0), c.reached(1)) > 0.97) {
          this.sheet.held = true;
          this.from.copy(c.position);
          c.stop();
        }
      }
      if (this.lift >= 1) this.to('carried');
    } else if (this.phase === 'carried') {
      this.carry(dt);
    }
  }

  /**
   * Round to face up the line, and both mittens up onto the middle of the hem over her head; once she has it, the sheet
   * takes her weight and lifts her off her feet before it runs.
   */
  private take(): void {
    const c = this.cast.child;
    this.to('taking');
    this.lift = 0;
    c.stop();
    c.lookAt = null;
    this.reach();
  }

  /** Her mittens either side of the middle of the hem, as high as she can reach while she still stands; the hem gathered into them. */
  private reach(): void {
    const c = this.cast.child;
    this.sheet.hold(this.hands);
    if (!this.sheet.held) this.hands.y = Math.min(this.hands.y, c.position.y + STRETCH);
    const lx = Math.cos(c.yaw) * GRIP, lz = -Math.sin(c.yaw) * GRIP;
    c.reachFor(0, this.at.set(this.hands.x + lx, this.hands.y, this.hands.z + lz));
    c.reachFor(1, this.at.set(this.hands.x - lx, this.hands.y, this.hands.z - lz));
    for (const hand of [0, 1] as const) c.mitten(hand, this.sheet.grips[hand]);
  }

  /**
   * Full, the sheet runs up the line and her body swings under her hands as it starts and stops; slack, it holds
   * where it is and she hangs there. At the far end the swing of her stopping carries her feet over the high roof.
   */
  private carry(dt: number): void {
    const k = tuning.crossings.sheet;
    const s = this.sheet;
    const want = s.travel >= s.end ? 0 : k.carry * THREE.MathUtils.smoothstep(Math.min(s.fill, this.gust), k.carryFrom, 1);
    this.speed += (want - this.speed) * (1 - Math.exp(-dt / k.coast));
    s.travel = Math.min(s.end, s.travel + this.speed * dt);
    if (s.travel >= s.end) this.speed = 0;
    const accel = (this.speed - this.lastSpeed) / Math.max(dt, 1e-4);
    this.lastSpeed = this.speed;
    this.swingSpeed += (-k.swingPull * Math.sin(this.swing) - accel / HANG - k.swingDamping * this.swingSpeed) * dt;
    this.swing += this.swingSpeed * dt;
    this.hang(dt);

    if (s.travel < s.end) {
      this.endFor = 0;
      return;
    }
    this.endFor += dt;
    if (this.swingSpeed > 0.05) this.swungForward = true;
    if ((this.swungForward && this.swingSpeed <= 0) || this.endFor > 1.2) this.letGo();
  }

  /**
   * Under the middle of the hem, in front of the sheet on the side it is seen from, swinging under her hands; lifted
   * there off her feet as it takes her, and turned partly toward the lens so her face is seen side on.
   */
  private hang(dt: number): void {
    const k = tuning.crossings.sheet;
    const c = this.cast.child;
    const s = this.sheet;
    this.lift = Math.min(1, this.lift + dt / k.liftFor);
    c.hang = 1;
    const toLens = Math.atan2(this.lens.x - c.position.x, this.lens.z - c.position.z) - this.facing;
    /** Coming in to the far roof she turns back to face where she is going, so she lands looking at it. */
    const coming = THREE.MathUtils.smoothstep(s.end - s.travel, 0.4, 2.4);
    const turn = THREE.MathUtils.clamp(Math.atan2(Math.sin(toLens), Math.cos(toLens)), -1, 1) * k.turnToLens * coming;
    this.turn += (turn - this.turn) * (1 - Math.exp(-dt * 2.5));
    c.yaw = this.facing + this.turn;
    this.reach();
    const a = s.along;
    s.hold(this.hands);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), swing = HANG * Math.sin(this.swing);
    this.at.set(this.hands.x - fx * UNDER + a.x * swing, this.hands.y - HANG * Math.cos(this.swing), this.hands.z - fz * UNDER + a.z * swing);
    /** Until the climbing line lifts her off the end of her ridge, her heels drag on it. */
    if (Math.hypot(this.at.x - this.way.wait.x, this.at.z - this.way.wait.z) < 0.7) this.at.y = Math.max(this.at.y, this.way.wait.y);
    const lift = THREE.MathUtils.smootherstep(this.lift, 0, 1);
    c.position.lerpVectors(this.from, this.at, lift);
    c.lookAt = s.travel < s.end - 1.2 ? s.middle(this.look) : this.look.copy(this.hands).addScaledVector(s.along, 2.5).setY(this.hands.y - 0.6);
  }

  /** Her mittens open at the top of the swing and she drops the last step onto the high roof. */
  private letGo(): void {
    const c = this.cast.child;
    this.sheet.held = false;
    c.hang = 0;
    c.reachFor(0, null);
    c.reachFor(1, null);
    c.lookAt = null;
    this.to('landing');
    /** She drops forward, never back: if her swing has carried her past the step-off she comes down a little beyond it. */
    const a = this.sheet.along;
    const ahead = (this.way.stepOff.x - c.position.x) * a.x + (this.way.stepOff.z - c.position.z) * a.z;
    const off = this.landAt.copy(this.way.stepOff).addScaledVector(a, Math.max(0, 0.2 - ahead));
    const v = this.at.set(off.x - c.position.x, 0.6, off.z - c.position.z);
    c.leap(v, off, 9.81, () => {
      this.to('landed');
      this.onEvent?.('land', off, 0.7);
    }, () => {
      c.walkTo(this.way.onward.x, this.way.onward.z, false, () => this.to('over'), 0.3);
      if (this.phase === 'landed') this.phase = 'leaving';
    }, true);
  }

  /** The world's own gust up the line across the sheet, drawn and pushing as a firm stroke would. */
  private blow(dt: number): void {
    const k = tuning.crossings.sheet;
    this.valveClock -= dt;
    if (this.valveClock > 0) return;
    this.valveClock = k.valveEvery;
    const a = this.sheet.along;
    const mid = this.sheet.middle(this.at);
    this.cast.lines.gust(mid.x - a.x * 2.5, mid.z - a.z * 2.5, a.x, a.z, 6, 9);
    this.cast.wind.addSplat({ source: this, impulse: true, ax: mid.x - a.x * 4, az: mid.z - a.z * 4, bx: mid.x + a.x * 2, bz: mid.z + a.z * 2,
      vx: a.x * 9, vz: a.z * 9, radius: 3.5, energy: 0.8, lift: 0, swirl: 0 });
    this.sheet.nudge(k.valvePush);
    this.gust = Math.min(1.2, this.gust + k.valvePush * k.push);
  }

  private to(phase: SheetCrossing['phase']): void {
    this.phase = phase;
    this.t = 0;
  }
}
