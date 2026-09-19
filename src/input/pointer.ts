import * as THREE from 'three';
import type { WindField } from '../wind/field';
import { heightAt } from '../world/island';
import { tuning } from '../tuning';

const T = tuning.pointer;

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
  private readonly prev = new THREE.Vector3();
  private hasPrev = false;
  private readonly vel = new THREE.Vector2();
  private readonly instVel = new THREE.Vector2();
  private readonly ray = new THREE.Raycaster();
  private heading: number | null = null;
  private readonly anchorNdc = new THREE.Vector3();
  private spin = 0;
  private sinceHeading = 0;
  private listeners: ((kind: 'down' | 'up') => void)[] = [];

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerdown', (e) => {
      this.down = true;
      this.present = true;
      if (e.pointerType !== 'mouse') this.hasPrev = false;
      this.move(e);
      el.setPointerCapture(e.pointerId);
      this.listeners.forEach((l) => l('down'));
    });
    const up = (e: PointerEvent) => {
      this.down = false;
      if (e.pointerType !== 'mouse') this.present = false;
      this.listeners.forEach((l) => l('up'));
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !this.down) this.present = false;
    });
  }

  onButton(listener: (kind: 'down' | 'up') => void): void {
    this.listeners.push(listener);
  }

  private move(e: PointerEvent): void {
    const rect = this.el.getBoundingClientRect();
    this.eventNdc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (!this.present) this.hasPrev = false;
    this.present = true;
  }

  private pick(camera: THREE.Camera, ndc: THREE.Vector2, out: THREE.Vector3): void {
    this.ray.setFromCamera(ndc, camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    const ground = (t: number) => o.y + d.y * t - Math.max(heightAt(o.x + d.x * t, o.z + d.z * t), 0);
    let prevT = 0;
    for (let t = 2; t < 700; t += 2) {
      if (ground(t) <= 0) {
        let lo = prevT;
        let hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          if (ground(mid) > 0) lo = mid;
          else hi = mid;
        }
        out.copy(d).multiplyScalar(hi).add(o);
        return;
      }
      prevT = t;
    }
    out.copy(d).multiplyScalar(700).add(o);
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

  update(dt: number, camera: THREE.Camera, wind: WindField): void {
    if (!this.present || this.muted) {
      this.hasPrev = false;
      this.vel.set(0, 0);
      this.heading = null;
      this.spin = 0;
      this.gust *= Math.exp(-dt * 6);
      this.charge = Math.max(0, this.charge - dt * 1.5);
      return;
    }
    this.prevNdc.copy(this.ndc);
    this.ndc.copy(this.eventNdc);
    if (!this.hasPrev) {
      this.pick(camera, this.ndc, this.world);
      this.prev.copy(this.world);
      this.prevNdc.copy(this.ndc);
      this.vel.set(0, 0);
      this.gust = 0;
      this.hasPrev = true;
      return;
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
    const raw = this.vel.length() * (this.down ? T.pressedGain : T.hoverGain);
    const speed = T.maxGust * Math.tanh(raw / T.maxGust);
    this.gust = speed;
    if (speed > T.minGust) {
      const nx = this.vel.x / this.vel.length();
      const nz = this.vel.y / this.vel.length();
      this.gustDir.set(nx, nz);
      wind.addSplat({
        ax: this.prev.x,
        az: this.prev.z,
        bx: this.world.x,
        bz: this.world.z,
        vx: nx * speed,
        vz: nz * speed,
        radius: 3.4 + speed * 0.14,
        energy: Math.min(1, speed / 20) * 0.5,
        swirl: 0,
        lift: 0,
      });
    }

    this.twirl(dt, camera);
    if (this.charge > 0.01) {
      /** No swirl of its own: the strokes going round it are already turning the air, the way the player drew it. */
      wind.addSplat({
        ax: this.updraftAt.x,
        az: this.updraftAt.z,
        bx: this.updraftAt.x,
        bz: this.updraftAt.z,
        vx: 0,
        vz: 0,
        radius: 5 + this.charge * 4,
        energy: 0,
        swirl: 0,
        lift: 1.0 + this.charge * 2.2,
      });
    }
    this.prev.copy(this.world);
  }
}
