import * as THREE from 'three';
import type { Splat, WindField } from '../wind/field';
import { heightAt } from '../world/island';
import { ROOMS } from '../world/journey-rooms';
import { tuning } from '../tuning';

const T = tuning.pointer;
const PICK_STEP = 2;
const PICK_RANGE = 700;
/**
 * Every island lies inside this multiple of its room's ellipse (at most 1.16 when measured; the drowned village
 * and the sky mirror never rise above the water), and no ground stands above the ceiling (at most 65). Beyond
 * them the ground is the sea at 0, found without a height lookup: a ray over open water or high above the land
 * would otherwise evaluate the procedural terrain hundreds of times. `tools/pointer-pick-check.mjs` re-measures
 * both bounds and compares every pick with the plain march.
 */
export const LAND_REACH = 1.3;
export const TERRAIN_CEILING = 80;
export const LAND_ROOMS = Object.entries(ROOMS).filter(([name]) => name !== 'drowned' && name !== 'mirror').map(([, c]) => c);
const LAND = LAND_ROOMS.map(c => ({ x: c.x, z: c.z, sx: 1 / (c.rx * LAND_REACH), sz: 1 / (c.rz * LAND_REACH) }));

/** Height of the ground above the sea at (x, z): `max(heightAt, 0)`, without a lookup over open water. */
export function groundAt(x: number, z: number): number {
  for (const c of LAND) {
    const ex = (x - c.x) * c.sx;
    const ez = (z - c.z) * c.sz;
    if (ex * ex + ez * ez < 1) return Math.max(heightAt(x, z), 0);
  }
  return 0;
}

/** Turns pointer motion into wind: gusts along the path, and an updraft in the middle of circles traced with it. */
export class PointerInput {
  readonly world = new THREE.Vector3();
  /** Pointer in normalised device coordinates this frame and last frame. */
  readonly ndc = new THREE.Vector2();
  readonly prevNdc = new THREE.Vector2();
  /** Current gust speed in world units/s after shaping (0 when idle), and its direction on the ground. */
  gust = 0;
  readonly gustDir = new THREE.Vector2(1, 0);
  /** Updraft charge, 0..1: wound up by tracing circles, and running down as soon as the circling stops. */
  charge = 0;
  /** The middle of the circles being traced, where the air rises. */
  readonly updraftAt = new THREE.Vector3();
  /**
   * Something the story is asking the player to lift. Circles drawn round it on screen stand their column there,
   * because a circle on the screen is a long ellipse on the ground under a low camera and the air would rise
   * anywhere along it but under the bird.
   */
  anchor: THREE.Vector3 | null = null;
  /** Chapter-local sensitivity for slow, deliberate circles. */
  twirlGain = 1;
  present = false;
  /**
   * Set while the story is playing a beat out on its own. The pointer still tracks, but it puts nothing into the
   * wind, so a scripted moment is not undercut by the player's own gusts whooshing and rippling the water.
   */
  muted = false;
  down = false;

  private readonly eventNdc = new THREE.Vector2();
  private readonly frameFrom = new THREE.Vector2();
  private readonly frameTo = new THREE.Vector2();
  private readonly framePoint = new THREE.Vector2();
  private readonly prev = new THREE.Vector3();
  private hasPrev = false;
  private strokeSource = {};
  private readonly vel = new THREE.Vector2();
  private readonly instVel = new THREE.Vector2();
  private readonly ray = new THREE.Raycaster();
  private heading: number | null = null;
  private readonly anchorNdc = new THREE.Vector3();
  private spin = 0;
  private sinceHeading = 0;
  private activePointer: number | null = null;
  private listeners: ((kind: 'down' | 'up') => void)[] = [];
  /**
   * A touch stroke keeps where the finger landed and its last segment after lifting until a rendered frame has
   * used them, so a flick made between two frames is wind rather than nothing.
   */
  private landed = false;
  private released = false;
  private frameLanded = false;
  private frameReleased = false;
  private readonly landedNdc = new THREE.Vector2();
  private readonly gustSplat: Splat = { source: {}, trail: true, ax: 0, az: 0, bx: 0, bz: 0, vx: 0, vz: 0, radius: 0, energy: 0, swirl: 0, lift: 0 };
  private readonly liftSplat: Splat = { source: 'pointer-lift', ax: 0, az: 0, bx: 0, bz: 0, vx: 0, vz: 0, radius: 0, energy: 0, swirl: 0, lift: 0 };

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || (this.activePointer !== null && e.pointerId !== this.activePointer)) return;
      this.activePointer = e.pointerId;
      this.down = true;
      this.present = true;
      this.released = this.frameReleased = false;
      if (e.pointerType !== 'mouse') this.hasPrev = false;
      this.move(e);
      if (e.pointerType !== 'mouse') {
        this.landed = true;
        this.landedNdc.copy(this.eventNdc);
      }
      el.setPointerCapture(e.pointerId);
      this.listeners.forEach((l) => l('down'));
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointer) return;
      this.activePointer = null;
      this.down = false;
      if (e.pointerType !== 'mouse') this.released = true;
      this.listeners.forEach((l) => l('up'));
    };
    el.addEventListener('pointerup', up);
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === this.activePointer) this.cancel();
    };
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', cancel);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !this.down) this.present = false;
    });
    const doc = el.ownerDocument;
    doc?.addEventListener('visibilitychange', () => { if (doc.hidden) this.cancel(); });
    doc?.defaultView?.addEventListener('blur', () => this.cancel());
    doc?.defaultView?.addEventListener('pagehide', () => this.cancel());
    doc?.defaultView?.addEventListener('resize', () => this.cancel());
  }

  onButton(listener: (kind: 'down' | 'up') => void): void {
    this.listeners.push(listener);
  }

  private move(e: PointerEvent): void {
    if (!e.isPrimary || (this.activePointer !== null && e.pointerId !== this.activePointer)) return;
    if (e.pointerType === 'touch' && this.activePointer === null) return;
    if (this.activePointer === null && this.released) return;
    const rect = this.el.getBoundingClientRect();
    this.eventNdc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (!this.present) this.hasPrev = false;
    this.present = true;
  }

  /** A browser-owned gesture or suspended page ends contact without replaying its last stroke. */
  private cancel(): void {
    const wasDown = this.down;
    this.activePointer = null;
    this.down = this.present = this.hasPrev = false;
    this.landed = this.released = this.frameLanded = this.frameReleased = false;
    this.ndc.copy(this.eventNdc);
    this.prevNdc.copy(this.ndc);
    this.vel.set(0, 0);
    this.gust = this.charge = this.spin = this.sinceHeading = 0;
    this.heading = null;
    if (wasDown) this.listeners.forEach(l => l('up'));
  }

  /** Where the ray through `ndc` first meets the ground, marching 2 m at a time to 700 m; a miss lies on the sea. */
  private pick(camera: THREE.Camera, ndc: THREE.Vector2, out: THREE.Vector3): void {
    this.ray.setFromCamera(ndc, camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    let prevT = 0;
    for (let t = PICK_STEP; t < PICK_RANGE; t += PICK_STEP) {
      const y = o.y + d.y * t;
      if (y > TERRAIN_CEILING) {
        if (d.y >= 0) break;
      } else if (y - groundAt(o.x + d.x * t, o.z + d.z * t) <= 0) {
        let lo = prevT;
        let hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          if (o.y + d.y * mid - groundAt(o.x + d.x * mid, o.z + d.z * mid) > 0) lo = mid;
          else hi = mid;
        }
        out.copy(d).multiplyScalar(hi).add(o);
        return;
      }
      prevT = t;
    }
    out.copy(d).multiplyScalar(PICK_RANGE).add(o);
    out.y = 0;
  }

  /**
   * Winds the updraft up while the cursor goes round and round. It reads how fast the stroke's heading is turning on
   * screen, so the size of the circles does not matter, a straight stroke counts for nothing, and scribbling back
   * and forth (a heading that flips rather than turns) counts for nothing either.
   */
  private twirl(dt: number, camera: THREE.Camera): void {
    const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
    const dx = (this.ndc.x - this.prevNdc.x) * aspect;
    const dy = this.ndc.y - this.prevNdc.y;
    /** Pointer events do not arrive every frame, so the turn is timed from the last frame that had one. */
    this.sinceHeading += dt;
    if (Math.hypot(dx, dy) > 0.002) {
      const heading = Math.atan2(dy, dx);
      let turning = 0;
      if (this.heading !== null) {
        const turned = Math.atan2(Math.sin(heading - this.heading), Math.cos(heading - this.heading));
        if (Math.abs(turned) < 1.2) turning = turned / this.sinceHeading;
      }
      this.spin += (turning - this.spin) * (1 - Math.exp(-this.sinceHeading * 5));
      this.heading = heading;
      this.sinceHeading = 0;
    } else if (this.sinceHeading > 0.15) {
      this.spin *= Math.exp(-dt * 5);
    }
    const want = THREE.MathUtils.smoothstep(Math.abs(this.spin) * this.twirlGain, T.twirlFrom, T.twirlFull);
    if (want > this.charge) this.charge = Math.min(want, this.charge + dt * T.chargeRate * want);
    else this.charge = Math.max(want, this.charge - dt * T.dischargeRate);
    const settle = this.charge < 0.05 ? 1 : 1 - Math.exp(-dt * 2);
    this.updraftAt.lerp(this.anchored(camera) ?? this.world, settle);
  }

  private anchored(camera: THREE.Camera): THREE.Vector3 | null {
    if (!this.anchor) return null;
    const a = this.anchorNdc.copy(this.anchor).project(camera);
    if (a.z > 1) return null;
    const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
    return Math.hypot((this.ndc.x - a.x) * aspect, this.ndc.y - a.y) < T.anchorNear ? this.anchor : null;
  }

  /** Snapshot one rendered frame's gesture before the game divides it into simulation steps. */
  beginFrame(): void {
    // The previous frame used a lifted stroke's last segment; the contact has now ended.
    if (this.frameReleased) this.present = false;
    this.frameReleased = this.released;
    this.frameLanded = this.landed;
    this.released = this.landed = false;
    this.frameFrom.copy(this.frameLanded ? this.landedNdc : this.hasPrev && this.present && !this.muted ? this.ndc : this.eventNdc);
    this.frameTo.copy(this.eventNdc);
  }

  update(dt: number, camera: THREE.Camera, wind: WindField, frameFraction?: number): void {
    const target = frameFraction === undefined ? this.eventNdc
      : this.framePoint.copy(this.frameFrom).lerp(this.frameTo, frameFraction);
    if (!this.present || this.muted) {
      // Consumers also brush visible objects directly from these values. A muted
      // frame must not replay the last stroke or retain an updraft over the plane.
      this.ndc.copy(target);
      this.prevNdc.copy(this.ndc);
      this.hasPrev = false;
      this.vel.set(0, 0);
      this.heading = null;
      this.spin = 0;
      this.sinceHeading = 0;
      this.gust = this.muted ? 0 : this.gust * Math.exp(-dt * 6);
      this.charge = this.muted ? 0 : Math.max(0, this.charge - dt * 1.5);
      return;
    }
    this.prevNdc.copy(this.ndc);
    this.ndc.copy(target);
    if (!this.hasPrev) {
      this.strokeSource = {};
      this.vel.set(0, 0);
      this.gust = 0;
      this.hasPrev = true;
      // A touch stroke begins where the finger landed, so its first frame of movement is wind too.
      this.prevNdc.copy(this.frameLanded ? this.frameFrom : this.ndc);
      if (this.ndc.equals(this.prevNdc)) {
        this.pick(camera, this.ndc, this.world);
        this.prev.copy(this.world);
      }
      if (!this.frameLanded) return;
    }

    this.instVel.set(0, 0);
    if (!this.ndc.equals(this.prevNdc)) {
      /** Both ends of a stroke use this frame's camera: moving the camera cannot supply any of the wind. */
      this.pick(camera, this.prevNdc, this.prev);
      this.pick(camera, this.ndc, this.world);
      this.instVel.set((this.world.x - this.prev.x) / dt, (this.world.z - this.prev.z) / dt);
    }
    /** With no new gesture, its last gust settles where it was made; no ground picking is needed. */
    this.vel.lerp(this.instVel, 1 - Math.exp(-dt * 30));
    const raw = this.vel.length() * (this.down || this.frameReleased ? T.pressedGain : T.hoverGain);
    const speed = T.maxGust * Math.tanh(raw / T.maxGust);
    this.gust = speed;
    if (speed > T.minGust) {
      const nx = this.vel.x / this.vel.length();
      const nz = this.vel.y / this.vel.length();
      this.gustDir.set(nx, nz);
      const g = this.gustSplat;
      g.source = this.strokeSource;
      g.ax = this.prev.x;
      g.az = this.prev.z;
      g.bx = this.world.x;
      g.bz = this.world.z;
      g.vx = nx * speed;
      g.vz = nz * speed;
      g.radius = 3.4 + speed * 0.14;
      g.energy = Math.min(1, speed / 20) * 0.5;
      wind.addSplat(g);
    }

    this.twirl(dt, camera);
    if (this.charge > T.minLift) {
      /** No swirl of its own: the strokes going round it are already turning the air, the way the player drew it. */
      const l = this.liftSplat;
      l.ax = l.bx = this.updraftAt.x;
      l.az = l.bz = this.updraftAt.z;
      l.radius = 5 + this.charge * 4;
      l.lift = 1.0 + this.charge * 2.2;
      wind.addSplat(l);
    }
    this.prev.copy(this.world);
  }
}
