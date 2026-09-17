import * as THREE from 'three';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import { surfaceHeight } from '../world/island';
import { RibbonBatch, type Ribbon } from './ribbons';

const T = tuning.swirl;

/** Where the story is waiting for an updraft, and how insistently it is asking, 0 not yet to 1 as plain as it gets. */
export interface Coax {
  at: THREE.Vector3;
  urgency: number;
}

/** Lengths of ribbon in one column, and the radians of turn drawn before the next length is laid down. */
const MAX_WISPS = 80;
const LAY_TURN = 0.3;
/**
 * Two ribbons wind up every column: the second runs narrower and fainter just above the first, which along a
 * climbing coil is the same as running half a turn behind it, so a column reads as air wound rather than a drawn ring.
 */
const STRANDS = [
  { radius: 1, lift: 0, width: 1, alpha: 1 },
  { radius: 0.7, lift: 0.4, width: 0.6, alpha: 0.4 },
];

interface Wisp {
  /** The axis this length was laid around, the ground under it, and its offset from the axis. */
  cx: number;
  cy: number;
  cz: number;
  ox: number;
  oy: number;
  oz: number;
  rad: number;
  rad0: number;
  /** How far it has climbed since it was laid down, and how long ago that was. */
  y: number;
  age: number;
}

/** A column of air being wound up: lengths of ribbon laid turn by turn, each climbing and drawing in as it ages. */
class Coil {
  readonly strands: Ribbon[] = STRANDS.map(() => ({ points: [], alpha: 0, width: 0 }));
  private readonly wisps: Wisp[] = [];
  private readonly spare: Wisp[] = [];
  private readonly store: THREE.Vector3[][] = STRANDS.map(() => []);
  private wobble = 0;

  /** Lays a length of ribbon at `off` times `rad` around the axis at (cx, cz), `base` above the ground there. */
  lay(cx: number, cz: number, off: THREE.Vector3, rad: number, base: number): void {
    const w = this.spare.pop() ?? { cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, rad: 0, rad0: 0, y: 0, age: 0 };
    /** The loops wander a little as they are drawn, so that nothing in this ever comes out as a clean circle. */
    this.wobble = THREE.MathUtils.clamp(this.wobble + (Math.random() - 0.5) * 0.09, -0.12, 0.12);
    rad *= 1 + this.wobble;
    w.cx = cx;
    w.cz = cz;
    w.ox = off.x;
    w.oy = off.y;
    w.oz = off.z;
    w.rad = rad;
    w.rad0 = rad;
    w.cy = surfaceHeight(cx + off.x * rad, cz + off.z * rad) + base;
    w.y = 0;
    w.age = 0;
    this.wisps.push(w);
    if (this.wisps.length > MAX_WISPS) this.spare.push(this.wisps.shift()!);
  }

  /** Climbs and draws in everything already in the air, and lets go of what has been up too long. */
  drift(dt: number, rise: number, draw: number, life: number): void {
    while (this.wisps.length > 0 && this.wisps[0].age > life) this.spare.push(this.wisps.shift()!);
    const pull = 1 - Math.exp(-dt * 1.1);
    for (const w of this.wisps) {
      w.age += dt;
      /** It climbs faster the higher it is, so a wound-up column stretches instead of stacking into rings. */
      w.y += rise * dt * (1 + w.y * 0.05);
      w.rad += (w.rad0 * draw - w.rad) * pull;
    }
  }

  build(alpha: number, width: number): void {
    for (let i = 0; i < STRANDS.length; i++) {
      const conf = STRANDS[i];
      const strand = this.strands[i];
      const store = this.store[i];
      strand.alpha = alpha * conf.alpha;
      strand.width = width * conf.width;
      strand.points.length = 0;
      if (strand.alpha < 0.002) continue;
      /** Newest end first: a ribbon fades along its length, and the end to lose is the one dissolving up top. */
      for (let k = this.wisps.length - 1; k >= 0; k--) {
        const w = this.wisps[k];
        const p = store[strand.points.length] ?? (store[strand.points.length] = new THREE.Vector3());
        const r = w.rad * conf.radius;
        p.set(w.cx + w.ox * r, w.cy + w.oy * r + w.y + conf.lift, w.cz + w.oz * r);
        strand.points.push(p);
      }
    }
  }
}

/**
 * The wind the player draws with their hand. While they circle the cursor, the loops they are drawing are laid into
 * the air and climb out of the grass, so the updraft they are winding up is something they can watch themselves
 * make. Where the story is waiting for that gesture, the same loops turn over by themselves, pale, until the player
 * takes them over. The loops stand tilted toward the camera, because a ring lying flat on the ground reads as a
 * mark on the field and a ring stood up reads as a circle drawn in the air.
 */
export class Swirl {
  readonly batch = new RibbonBatch(STRANDS.length * MAX_WISPS * 2, '#fffaf0');
  private readonly trace = new Coil();
  private readonly ghost = new Coil();
  private readonly ribbons = [...this.trace.strands, ...this.ghost.strands];
  private readonly onScreen = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly over = new THREE.Vector3();
  private readonly off = new THREE.Vector3();
  /** The cursor's bearing around the middle of the circles last frame, and the turn it has run up since. */
  private bearing = 0;
  private turned = 0;
  private laid = 0;
  /** How fast it is going round, radians a second, smoothed, and how long since the bearing last changed. */
  private rate = 0;
  private since = 0;
  private tracking = false;
  private shown = 0;
  private slow = 0;
  private slowLaid = 0;
  private cycle = 0;
  private glow = 0;
  private ghostPen = 0.1;
  private handover = 0;

  update(dt: number, camera: THREE.PerspectiveCamera, input: PointerInput, coax: Coax | null): void {
    this.plane(camera);
    const charge = input.present && !input.muted ? input.charge : 0;
    const away = camera.position.distanceTo(input.updraftAt);
    /** How far a half screen height reaches at the column, so a circle drawn on screen is drawn in the world. */
    const reach = away * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    if (charge > 0.01) this.draw(dt, camera, input, charge, reach);
    else {
      this.tracking = false;
      this.rate = 0;
    }
    const want = charge > 0.01 ? T.alpha * (0.45 + 0.55 * charge) : 0;
    this.shown += (want - this.shown) * (1 - Math.exp(-dt * (want > this.shown ? 9 : 4)));
    /** It rises by the turn of their hand and sinks once that stops: the air only holds while they keep winding it. */
    const rise = (T.pitch * this.rate) / (Math.PI * 2) - T.sink * (1 - THREE.MathUtils.smoothstep(this.rate, 1.5, 5));
    this.trace.drift(dt, rise, THREE.MathUtils.lerp(T.flare, T.tighten, charge), T.life);
    /** The player's own wind is drawn with a bolder stroke than the invitation: theirs is the air that is real. */
    this.trace.build(this.shown, Math.min(away * T.pen * 1.6, 1.2) * (0.85 + 0.35 * charge));

    const urgency = coax ? THREE.MathUtils.clamp(coax.urgency, 0, 1) : 0;
    /** As the player's own trace comes up near the invitation, the invitation gives way to it by the same amount. */
    const near = coax !== null && input.updraftAt.distanceTo(coax.at) < T.coaxNear;
    const taken = near ? THREE.MathUtils.smoothstep(charge, 0.05, 0.45) : 0;
    this.handover += (taken - this.handover) * (1 - Math.exp(-dt * (taken > this.handover ? 6 : 1.1)));
    this.invite(dt, camera, coax, urgency);
    /** Nothing in the air is nothing to draw: an empty batch still costs a draw call on a phone. */
    this.batch.mesh.visible = this.shown > 0.002 || this.glow > 0.002;
    if (this.batch.mesh.visible) this.batch.update(this.ribbons);
  }

  /** The plane the loops are drawn on: across the camera, and tilted back from the ground toward it. */
  private plane(camera: THREE.Camera): void {
    camera.getWorldDirection(this.over);
    this.over.y = 0;
    if (this.over.lengthSq() < 1e-6) this.over.set(0, 0, -1);
    this.over.normalize();
    this.right.set(-this.over.z, 0, this.over.x);
    const tilt = THREE.MathUtils.degToRad(T.tilt);
    this.over.multiplyScalar(Math.cos(tilt)).setY(Math.sin(tilt));
  }

  /** Where on that plane a length of ribbon laid at bearing `a` sits, as an offset from the axis. */
  private at(a: number): THREE.Vector3 {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return this.off.set(this.right.x * c + this.over.x * s, this.over.y * s, this.right.z * c + this.over.z * s);
  }

  /**
   * Lays the player's path into the air. It goes by the bearing of the cursor around the middle of its circles on
   * screen, so what climbs is the shape their hand is making, and a column stands where they are circling however
   * the camera happens to be looking at the ground.
   */
  private draw(dt: number, camera: THREE.PerspectiveCamera, input: PointerInput, charge: number, reach: number): void {
    this.onScreen.copy(input.updraftAt).project(camera);
    const dx = (input.ndc.x - this.onScreen.x) * camera.aspect;
    const dy = input.ndc.y - this.onScreen.y;
    const screen = Math.hypot(dx, dy);
    if (screen < 0.03) return;
    const bearing = Math.atan2(dy, dx);
    /** Pointer events do not arrive every frame, so the turn is timed from the last frame that had one. */
    this.since += dt;
    const turn = this.tracking ? Math.atan2(Math.sin(bearing - this.bearing), Math.cos(bearing - this.bearing)) : 0;
    if (turn !== 0 && Math.abs(turn) < 1.2) {
      this.turned += turn;
      this.rate += (Math.abs(turn) / this.since - this.rate) * (1 - Math.exp(-this.since * 5));
      this.since = 0;
    } else if (this.since > 0.15) {
      this.rate *= Math.exp(-dt * 5);
    }
    this.bearing = bearing;
    this.tracking = true;
    if (Math.abs(this.turned - this.laid) < LAY_TURN) return;
    this.laid = this.turned;
    /** The column stands as wide as the circles were drawn on screen, within reason: small hand, small column. */
    const rad = THREE.MathUtils.clamp(screen * reach, T.radiusMin, T.radiusMax) * (0.78 + 0.22 * charge);
    /** Laid where they drew it and no higher, so the low side of the first loop is still down in the grass. */
    this.trace.lay(input.updraftAt.x, input.updraftAt.z, this.at(this.turned), rad, rad * this.over.y * 0.2);
  }

  /** The loops the story turns over by itself where it wants an updraft: they wind up, rise, fade, and come again. */
  private invite(dt: number, camera: THREE.PerspectiveCamera, coax: Coax | null, urgency: number): void {
    let winding = false;
    let want = 0;
    if (coax && urgency > 0.001) {
      const period = T.coaxWind + T.coaxGap * (1 - 0.65 * urgency);
      this.cycle += dt;
      if (this.cycle > period) this.cycle = 0;
      winding = this.cycle < T.coaxWind;
      this.slow += dt * T.coaxLoops * (1 + 0.6 * urgency) * Math.PI * 2;
      if (winding && this.handover < 0.4 && this.slow - this.slowLaid > LAY_TURN) {
        this.slowLaid = this.slow;
        const rad = T.coaxRadius * (0.9 + 0.2 * urgency);
        /** Stood almost clear of the ground, so the whole loop can be seen going round whatever stands there. */
        this.ghost.lay(coax.at.x, coax.at.z, this.at(this.slow), rad, rad * this.over.y * 0.8);
      }
      /** It comes in over a breath, holds while it winds, and blows out with its last loops still climbing. */
      const env = Math.min(1, this.cycle / 0.7) * (1 - THREE.MathUtils.smoothstep(this.cycle, T.coaxWind, T.coaxWind + 1.1));
      want = T.coaxAlpha * (0.5 + 0.5 * urgency) * env;
      this.ghostPen = Math.min(camera.position.distanceTo(coax.at) * T.pen, 0.8);
    } else {
      this.cycle = 0;
    }
    /** Eased rather than taken, so that a chapter dropping the invitation mid-loop lets go of it instead of cutting. */
    this.glow += (want - this.glow) * (1 - Math.exp(-dt * (want > this.glow ? 6 : 3)));
    this.ghost.drift(dt, T.coaxHeight / T.coaxWind, winding ? 0.92 : 1.3, T.coaxWind);
    this.ghost.build(this.glow * (1 - this.handover), this.ghostPen);
  }
}
