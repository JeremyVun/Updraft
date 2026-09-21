import { DOOR_SHORE } from './heightfield';
import * as THREE from 'three';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import { feltWind, Sway, type WindField, type WindSample } from '../wind/field';
import { tuning } from '../tuning';
import { heightAt } from './island';

/** The southern beach stays put; the extra fifteen percent of island is north of it. */
export const LINES_LANDING = new THREE.Vector2(14, -308);
// Rest the bow on the north beach, with dry sand beside the thwart for boarding.
export const LINES_BERTH = new THREE.Vector3(DOOR_SHORE.x, 0, DOOR_SHORE.z - 23.5);
export const LINES_WALK = [
  new THREE.Vector2(12, -320), new THREE.Vector2(0, -330), new THREE.Vector2(0, -340),
  new THREE.Vector2(25, -351), new THREE.Vector2(25, -362),
  new THREE.Vector2(11, -372), new THREE.Vector2(11, -383),
  new THREE.Vector2(11, -398), new THREE.Vector2(14, -422),
];

/** Physical opening of each curtain, shared with its cloth shader. */
export const curtainLift = new THREE.Vector3();

/** A sheet across the walk. Air arriving here lifts it; completed passages remain safely overhead. */
export class WashingCurtain {
  readonly center: THREE.Vector3;
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  readonly before: THREE.Vector3;
  readonly birdBefore: THREE.Vector3;
  readonly after: THREE.Vector3;
  readonly sag = 0.22;
  readonly curtain: number;
  readonly drop: number;
  readonly sway = new Sway();
  charge = 0;
  opening = 0;
  cleared = false;
  private touched = false;
  /** Time since a real cursor/touch sweep reached this sheet; invitation traces never affect it. */
  brushAge = Infinity;
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly point = new THREE.Vector3();

  constructor(index: number, x: number, z: number, readonly width: number, readonly panels: number) {
    this.curtain = index;
    const foot = heightAt(x, z);
    const top = Math.max(foot, heightAt(x - width / 2, z), heightAt(x + width / 2, z)) + 6.1;
    this.drop = top - foot - 0.55;
    this.center = new THREE.Vector3(x, foot + 3.1, z);
    this.a = new THREE.Vector3(x - width / 2 - 0.35, top, z);
    this.b = new THREE.Vector3(x + width / 2 + 0.35, top + 0.08, z);
    this.before = this.ground(x - 1.6, z + 4.7);
    this.birdBefore = this.ground(x + 1.3, z + 1.7);
    this.after = this.ground(x + 1.3, z - 4.5);
  }

  private ground(x: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, heightAt(x, z), z); }

  reset(cleared = false): void {
    this.charge = cleared ? 1 : 0;
    this.opening = cleared ? 1 : 0;
    this.cleared = cleared;
    this.touched = false; this.brushAge = Infinity;
    curtainLift.setComponent(this.curtain, this.opening);
  }

  update(dt: number, wind: WindField, listening: boolean): void {
    const k = tuning.linesPassage;
    this.brushAge += dt;
    let strongest = 0;
    let vx = 0, vz = 0;
    for (const dx of [-this.width * 0.3, 0, this.width * 0.3]) {
      const w = feltWind(wind.sample(this.center.x + dx, this.center.z, this.air), wind.calm);
      const force = THREE.MathUtils.smoothstep(w.energy, k.energyFrom, k.energyFull) *
        THREE.MathUtils.smoothstep(Math.hypot(w.x, w.z), k.speedFrom, k.speedFull);
      if (force > strongest) { strongest = force; vx = w.x; vz = w.z; }
    }
    this.sway.update(vx, vz, dt);
    if (listening && this.touched) {
      // Only air from the player's gesture can complete a passage. Waiting never supplies a breeze.
      this.charge = Math.min(1, this.charge + strongest * dt / k.fillSeconds);
    }
    const billow = THREE.MathUtils.clamp(Math.hypot(this.sway.x, this.sway.z) / k.billowSpeed, 0, 1);
    const want = this.cleared ? 1 : Math.max(this.charge * 0.75, billow * 0.8);
    this.opening += (want - this.opening) * (1 - Math.exp(-dt * (want > this.opening ? k.rise : k.settle)));
    curtainLift.setComponent(this.curtain, this.opening);
  }

  /**
   * Cloth stands above the ground a low camera projects onto. Brush the visible sheet into the SAME wind field,
   * at the sheet, so an ordinary sweep reaches it instead of landing on the hillside behind it.
   */
  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if (input.muted || !input.present || input.gust < tuning.linesPassage.brushFrom || input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    let touch = 0;
    for (const dx of [-0.35, 0, 0.35]) for (const dy of [-1.5, 0, 1.5]) {
      this.point.set(this.center.x + dx * this.width, this.center.y + dy, this.center.z);
      touch = Math.max(touch, screenBrush(camera, this.point, input.prevNdc, input.ndc, tuning.linesPassage.brushRadius));
    }
    if (touch < 0.02) return;
    this.touched = true;
    this.brushAge = 0;
    const speed = input.gust * Math.sqrt(touch);
    wind.addSplat({ source: this, ax: this.a.x, az: this.a.z, bx: this.b.x, bz: this.b.z,
      vx: input.gustDir.x * speed, vz: input.gustDir.y * speed, radius: 3,
      energy: Math.min(0.5, speed / 25), swirl: 0, lift: 0 });
  }


}

export const CURTAINS = [
  new WashingCurtain(0, 0, -335, 9, 1),
  new WashingCurtain(1, 25, -357, 10, 2),
  new WashingCurtain(2, 11, -378, 10.5, 1),
];
export const washingPassage: { active: WashingCurtain | null } = { active: null };
