import * as THREE from 'three';
import { params } from './params';
import { heightAt } from './world/island';
import { CameraDirection, type CameraAttention } from './camera-direction';
import { tuning } from './tuning';
import { sceneryLift } from './camera-obstacles';

const MIN_HFOV = 64;
/** The camera always looks roughly north, from a little east of south, unless a shot says otherwise. */
const FROM = new THREE.Vector3(0.075, 0, 1).normalize();
/** How far above the ground a shot stands unless it says otherwise. */
const GROUND_CLEARANCE = 2.8;
const OCCLUSION_STEPS = [0.3, 0.55];
const AXES = ['x', 'y', 'z'] as const;


export interface Shot {
  /** Cheap static scenery bounds supplied by rooms with foreground buildings or branches. */
  obstacles?: readonly THREE.Box3[];
  /** A meaningful focus to notice from the foreground view, independent of its physical movement. */
  attention?: CameraAttention;
  /** Preserve a staged composition and its approach path while still following its subjects. */
  composition?: 'hold';
  /** The point the camera looks at. */
  target: THREE.Vector3;
  /** Horizontal distance from the target. */
  distance: number;
  /** Height above the target. */
  height: number;
  /** Horizontal direction from the target to the camera. */
  from?: THREE.Vector3;
  /** An exact camera position; overrides distance, height and from. */
  eye?: THREE.Vector3;
  /** Approach a placed eye around the focus, keeping distance through large changes of side. */
  orbit?: boolean;
  /** The camera travels with a steadily moving target (a boat) and only eases the framing, so it never trails. */
  carry?: boolean;
  /** Optional physical anchor: carry its movement, while changes of focus still ease normally. */
  carryAnchor?: THREE.Vector3;
  /** Preserve the landscape composition's horizontal field in narrow viewports by drawing back. */
  fitWidth?: boolean;
  /**
   * How far above the ground the camera is held. The default stands it at a walking child's eye; a room that
   * wants to be seen by something small lowers it, and nothing else in the game changes.
   */
  clearance?: number;
  /** Smooth authored changes of subject coverage instead of jumping to the fit. */
  smoothFit?: number;
  /** QA: the camera goes exactly where it is put, with no ground clearance, no sight-line correction and no breathing. */
  free?: boolean;
  /** An authored continuous threshold move supplies its own easing and ground clearance. */
  exact?: boolean;
  /** Optional playable pair. Fit both within a bounded retreat; the primary always keeps the frame. */
  subjects?: { primary: THREE.Vector3; secondary: THREE.Vector3; tertiary?: THREE.Vector3;
    /** Additional meaningful bounds, such as the returned stars of a constellation. */
    points?: readonly THREE.Vector3[]; margin: number; extra: number };
}

/** Glides between the shots the story asks for, breathing gently, never cutting. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 7000);
  private readonly fixed: boolean;
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly wantEye = new THREE.Vector3();
  private readonly wantLook = new THREE.Vector3();
  private readonly direction = new CameraDirection();
  private turnSpeed = 0;
  private readonly eyeSpeed = new THREE.Vector3();
  private readonly lookSpeed = new THREE.Vector3();
  private readonly orbit = new THREE.Vector3();
  private readonly wantOrbit = new THREE.Vector3();
  private readonly orbitSpeed = new THREE.Vector3();
  private placed = false;
  private carrySource?: THREE.Vector3;
  private lastShot?: Shot;
  private readonly lastTarget = new THREE.Vector3();
  private readonly lastCarryAnchor = new THREE.Vector3();
  private readonly moved = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();
  private lift = 0;
  private sceneryRise = 0;
  private readonly sceneryOffset = new THREE.Vector3();
  private readonly sceneryVelocity = new THREE.Vector3();
  private readonly sceneryWanted = new THREE.Vector3();
  private readonly sceneryEye = new THREE.Vector3();
  private pull = 0;
  private clear = GROUND_CLEARANCE;
  private fitBack = 0;
  private readonly local = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly fitOffset = new THREE.Vector3();
  private readonly fitOrigin = new THREE.Vector3();

  constructor() {
    this.fixed = params.cam !== null;
    if (params.cam) {
      const [x, y, z, tx, ty, tz] = params.cam;
      this.camera.position.set(x, y, z);
      this.camera.lookAt(tx ?? 0, ty ?? 0, tz ?? 0);
    }
  }

  resize(width: number, height: number): void {
    const aspect = width / height;
    this.camera.aspect = aspect;
    const hfov = THREE.MathUtils.degToRad(MIN_HFOV);
    const vfovForWidth = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
    this.camera.fov = THREE.MathUtils.clamp(Math.max(38, vfovForWidth), 38, 62);
    this.camera.updateProjectionMatrix();
  }

  private desired(shot: Shot, out: THREE.Vector3): THREE.Vector3 {
    if (shot.eye) out.copy(shot.eye);
    else out.copy(shot.target)
      .addScaledVector(shot.from ?? FROM, shot.distance)
      .setY(shot.target.y + shot.height);
    this.direction.compose(shot, out, this.wantLook);
    if (shot.fitWidth) {
      const horizontal = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect;
      const back = Math.max(1, Math.tan(THREE.MathUtils.degToRad(MIN_HFOV) / 2) / horizontal);
      out.sub(this.wantLook).multiplyScalar(back).add(this.wantLook);
    }
    return out;
  }

  /** Jumps straight to a shot (used once at the start). */
  cut(shot: Shot): void {
    if (this.fixed) return;
    if (shot.exact && shot.eye) {
      this.eye.copy(shot.eye); this.wantLook.copy(shot.target);
    } else this.desired(shot, this.eye);
    this.look.copy(this.wantLook);
    this.direction.reset();
    this.turnSpeed = 0;
    this.eyeSpeed.set(0, 0, 0); this.lookSpeed.set(0, 0, 0); this.orbitSpeed.set(0, 0, 0);
    this.placed = !!(shot.eye && !shot.orbit || shot.composition === 'hold');
    this.carrySource = shot.carryAnchor;
    this.lastShot = shot;
    this.lastTarget.copy(shot.target);
    this.lastCarryAnchor.copy(shot.carryAnchor ?? shot.target);
    this.lift = 0;
    this.sceneryRise = 0;
    this.sceneryOffset.set(0, 0, 0); this.sceneryVelocity.set(0, 0, 0);
    this.pull = 0;
    this.clear = shot.clearance ?? GROUND_CLEARANCE;
    if (shot.free || shot.exact) {
      this.camera.position.copy(this.eye); this.camera.lookAt(this.look);
      this.fitBack = 0; this.fitOffset.set(0, 0, 0);
      return;
    }
    this.fitBack = 0;
    this.fitOffset.set(0, 0, 0);
    this.place(0, Infinity, shot);
    this.fitSubjects(shot, Infinity);
  }

  update(dt: number, time: number, shot: Shot, pace = 0.6, holdComposition = false): void {
    if (this.fixed) return;
    if (this.lastShot !== shot) {
      this.direction.release();
      this.lastShot = shot;
    }
    if (shot.exact && shot.eye) {
      this.eye.copy(shot.eye); this.look.copy(shot.target); this.lastTarget.copy(shot.target);
      this.lastCarryAnchor.copy(shot.carryAnchor ?? shot.target);
      this.carrySource = shot.carryAnchor;
      this.turnSpeed = 0; this.direction.reset();
      this.eyeSpeed.set(0, 0, 0); this.lookSpeed.set(0, 0, 0); this.orbitSpeed.set(0, 0, 0);
      this.placed = true;
      this.fitBack = 0; this.fitOffset.set(0, 0, 0);
      this.pull = 0; this.lift = 0; this.sceneryRise = 0;
      this.sceneryOffset.set(0, 0, 0); this.sceneryVelocity.set(0, 0, 0);
      this.camera.position.copy(this.eye); this.camera.lookAt(this.look);
      return;
    }
    if (dt <= 0) return;
    const k = 1 - Math.exp(-dt * pace);
    this.moved.subVectors(shot.carryAnchor ?? shot.target, shot.carryAnchor ? this.lastCarryAnchor : this.lastTarget);
    this.lastTarget.copy(shot.target);
    this.lastCarryAnchor.copy(shot.carryAnchor ?? shot.target);
    if (shot.carry && this.carrySource === shot.carryAnchor
      && this.moved.length() <= tuning.cinematography.maxCarrySpeed * dt) {
      this.eye.add(this.moved);
      this.look.add(this.moved);
    }
    this.carrySource = shot.carryAnchor;
    this.desired(shot, this.wantEye);
    if (shot.free) {
      this.eye.lerp(this.wantEye, k); this.look.lerp(this.wantLook, k);
      this.turnSpeed = 0; this.direction.reset();
      this.eyeSpeed.set(0, 0, 0); this.lookSpeed.set(0, 0, 0); this.orbitSpeed.set(0, 0, 0);
      this.placed = !!(shot.eye && !shot.orbit || shot.composition === 'hold');
      this.camera.position.copy(this.eye); this.camera.lookAt(this.look);
      return;
    }
    this.direction.adapt(dt, shot, this.wantEye, this.wantLook, this.camera, holdComposition);
    const motion = tuning.cinematography;
    const response = Math.max(0.01, Math.min(motion.maxResponse, pace * motion.framingResponse));
    const placed = !!(shot.eye && !shot.orbit || shot.composition === 'hold');
    if (placed !== this.placed) {
      // Carry the current velocity between world-space staging and an orbit, as well as its position.
      const x = this.eye.x - this.look.x, z = this.eye.z - this.look.z;
      const radius = Math.max(0.001, Math.hypot(x, z)), sx = x / radius, sz = z / radius;
      if (placed) {
        this.eyeSpeed.set(this.lookSpeed.x + sx * this.orbitSpeed.x + z * this.turnSpeed,
          this.lookSpeed.y + this.orbitSpeed.y,
          this.lookSpeed.z + sz * this.orbitSpeed.x - x * this.turnSpeed);
      } else {
        const vx = this.eyeSpeed.x - this.lookSpeed.x, vz = this.eyeSpeed.z - this.lookSpeed.z;
        this.orbitSpeed.set(vx * sx + vz * sz, this.eyeSpeed.y - this.lookSpeed.y, 0);
        this.turnSpeed = (vx * sz - vz * sx) / radius;
      }
      this.placed = placed;
    }
    if (placed) {
      // A placed eye describes a path through the world (bedside, paper, doorway approach).
      // Preserve that staging; only subject-relative views should orbit their gaze.
      this.ease(this.eye, this.eyeSpeed, this.wantEye, response, dt);
      this.ease(this.look, this.lookSpeed, this.wantLook, response, dt);
      this.turnSpeed = 0;
    } else {
      // Interpolate around the gaze, not across the subject. A large turn must not dolly through the child.
      const x = this.eye.x - this.look.x, z = this.eye.z - this.look.z;
      const dx = this.wantEye.x - this.wantLook.x, dz = this.wantEye.z - this.wantLook.z;
      const bearing = Math.atan2(x, z);
      let error = Math.atan2(Math.sin(Math.atan2(dx, dz) - bearing), Math.cos(Math.atan2(dx, dz) - bearing));
      // Near a reverse angle, tiny route changes must not keep asking for the opposite way around.
      if (Math.abs(error) > Math.PI - tuning.cinematography.reversalBand && Math.abs(this.turnSpeed) > 1e-4)
        error = Math.sign(this.turnSpeed) * Math.abs(error);
      const turnResponse = Math.max(0.01, Math.min(motion.maxResponse, pace * motion.turnResponse));
      const decay = Math.exp(-turnResponse * dt);
      const spring = this.turnSpeed - turnResponse * error;
      const turn = error + (-error + spring * dt) * decay;
      // A placed move can arrive above the orbit limit. Shed that inherited speed instead of braking in one frame.
      const limit = Math.max(motion.maxTurnSpeed, Math.abs(this.turnSpeed) * Math.exp(-motion.maxResponse * dt));
      this.turnSpeed = (this.turnSpeed - turnResponse * spring * dt) * decay;
      this.turnSpeed = THREE.MathUtils.clamp(this.turnSpeed, -limit, limit);
      const angle = bearing + THREE.MathUtils.clamp(turn, -limit * dt, limit * dt);
      this.orbit.set(Math.hypot(x, z), this.eye.y - this.look.y, 0);
      this.wantOrbit.set(Math.hypot(dx, dz), this.wantEye.y - this.wantLook.y, 0);
      this.ease(this.orbit, this.orbitSpeed, this.wantOrbit, response, dt);
      this.ease(this.look, this.lookSpeed, this.wantLook, response, dt);
      this.eye.set(this.look.x + Math.sin(angle) * this.orbit.x,
        this.look.y + this.orbit.y, this.look.z + Math.cos(angle) * this.orbit.x);
    }
    /** Eased like everything else the shot asks for: coming down to a bird's eye is a move, not a cut. */
    this.clear += ((shot.clearance ?? GROUND_CLEARANCE) - this.clear) * k;
    this.place(time, dt, shot);
    this.fitSubjects(shot, dt);
  }

  /** Critically damped motion: a new point of interest builds speed, arrives softly and never rings. */
  private ease(value: THREE.Vector3, velocity: THREE.Vector3, target: THREE.Vector3,
    response: number, dt: number): void {
    const decay = Math.exp(-response * dt);
    for (const axis of AXES) {
      const error = value[axis] - target[axis];
      const spring = velocity[axis] + response * error;
      value[axis] = target[axis] + (error + spring * dt) * decay;
      velocity[axis] = (velocity[axis] - response * spring * dt) * decay;
    }
  }

  /** Use the final camera, after terrain correction, so a hill cannot silently undo the fit. */
  private fitSubjects(shot: Shot, dt: number): void {
    const pair = shot.subjects;
    const camera = this.camera;
    if (!pair) {
      this.fitBack = 0;
      this.fitOffset.multiplyScalar(Math.exp(-dt * 2));
      camera.position.add(this.fitOffset);
      camera.updateMatrixWorld();
      return;
    }
    this.fitOrigin.copy(camera.position);
    camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    this.back.setFromMatrixColumn(camera.matrixWorld, 2);
    const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * pair.margin;
    const horizontal = vertical * camera.aspect;
    let needed = 0;
    for (let i = 0; i < 3 + (pair.points?.length ?? 0); i++) {
      const point = i === 0 ? pair.primary : i === 1 ? pair.secondary : i === 2 ? pair.tertiary : pair.points![i - 3];
      if (!point) continue;
      this.local.copy(point).applyMatrix4(camera.matrixWorldInverse);
      needed = Math.max(needed, Math.abs(this.local.x) / horizontal + this.local.z,
        Math.abs(this.local.y) / vertical + this.local.z);
    }
    needed = Math.min(pair.extra, needed);
    // Respond as an edge approaches; release the extra space slowly when they come together.
    this.fitBack = shot.smoothFit ? THREE.MathUtils.lerp(this.fitBack, Math.max(0,needed),1-Math.exp(-dt*shot.smoothFit)) : Math.max(needed, this.fitBack * Math.exp(-dt * 0.8));
    camera.position.addScaledVector(this.back, this.fitBack);
    camera.updateMatrixWorld();
    this.local.copy(pair.primary).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(1, -this.local.z);
    // Recompose within the available room before asking for any more distance. If an old runaway
    // cannot fit, the child's interval wins until the plane has flown back into reach.
    const primaryLeft = this.local.x - depth * horizontal, primaryRight = this.local.x + depth * horizontal;
    const primaryBottom = this.local.y - depth * vertical, primaryTop = this.local.y + depth * vertical;
    let left = primaryLeft, right = primaryRight, bottom = primaryBottom, top = primaryTop;
    for (let i = 1; i < 3 + (pair.points?.length ?? 0); i++) {
      const point = i === 1 ? pair.secondary : i === 2 ? pair.tertiary : pair.points![i - 3];
      if (!point) continue;
      this.local.copy(point).applyMatrix4(camera.matrixWorldInverse);
      const distance = Math.max(1, -this.local.z);
      left = Math.max(left, this.local.x - distance * horizontal);
      right = Math.min(right, this.local.x + distance * horizontal);
      bottom = Math.max(bottom, this.local.y - distance * vertical);
      top = Math.min(top, this.local.y + distance * vertical);
    }
    const x = left <= right ? THREE.MathUtils.clamp(0, left, right) : THREE.MathUtils.clamp(0, primaryLeft, primaryRight);
    const y = bottom <= top ? THREE.MathUtils.clamp(0, bottom, top) : THREE.MathUtils.clamp(0, primaryBottom, primaryTop);
    camera.position.addScaledVector(this.right, x).addScaledVector(this.up, y);
    camera.position.y = Math.max(camera.position.y, Math.max(heightAt(camera.position.x, camera.position.z), 0) + this.clear);
    if (shot.smoothFit && Number.isFinite(dt)) {
      this.want.subVectors(camera.position,this.fitOrigin);
      this.fitOffset.lerp(this.want,1-Math.exp(-dt*shot.smoothFit));
      camera.position.copy(this.fitOrigin).add(this.fitOffset);
    } else this.fitOffset.subVectors(camera.position, this.fitOrigin);
    camera.updateMatrixWorld();
    if (shot.smoothFit && Number.isFinite(dt)) {
      // Let coverage settle while keeping the primary inside an outer safety frame.
      // New secondary subjects still enter the tighter authored composition gradually.
      this.local.copy(pair.primary).applyMatrix4(camera.matrixWorldInverse);
      const depth = Math.max(1, -this.local.z);
      const safeV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
        * Math.max(pair.margin, tuning.cinematography.primarySafetyMargin);
      const safeH = safeV * camera.aspect;
      const x = this.local.x - THREE.MathUtils.clamp(this.local.x, -depth * safeH, depth * safeH);
      const y = this.local.y - THREE.MathUtils.clamp(this.local.y, -depth * safeV, depth * safeV);
      camera.position.addScaledVector(this.right, x).addScaledVector(this.up, y);
      this.fitOffset.subVectors(camera.position, this.fitOrigin);
      camera.updateMatrixWorld();
    }
  }

  private place(time: number, dt: number, shot: Shot): void {
    const reach = Math.min(this.eye.distanceTo(this.look), 60);
    const want = this.want.copy(this.eye);
    want.x += Math.sin(time * 0.07 + 1.3) * 0.02 * reach;
    want.y += Math.sin(time * 0.11) * 0.012 * reach;
    const clear = Math.max(heightAt(want.x, want.z), heightAt(want.x, want.z - 6), 0) + this.clear;
    if (want.y < clear) want.y = clear;
    /**
     * Whatever else a shot asks for, the subject stays in sight. Ground in the way is answered by coming in
     * closer first and only then by rising, because a camera that solves every hill by climbing ends up looking
     * down on the game from somewhere over it. Losing the child behind a hill is the one failure this game has.
     */
    let pull = 0;
    let lift = this.blocked(want);
    for (const step of OCCLUSION_STEPS) {
      if (lift <= 0.05) break;
      this.probe.lerpVectors(want, this.look, step);
      pull = step;
      lift = this.blocked(this.probe);
    }
    this.pull += (pull - this.pull) * (1 - Math.exp(-dt * (pull > this.pull ? 3 : 0.5)));
    this.lift += (lift - this.lift) * (1 - Math.exp(-dt * (lift > this.lift ? 4 : 0.5)));
    const pos = this.camera.position.lerpVectors(want, this.look, this.pull);
    pos.y += this.lift;
    const floor = Math.max(heightAt(pos.x, pos.z), heightAt(pos.x, pos.z - 6), 0) + this.clear;
    if (pos.y < floor) pos.y = floor;
    const k = tuning.cinematography;
    // A roof should pass beside a low travelling lens, not send it up into an overhead view.
    // Prefer a modest horizontal clearance; compare the current offset too so a safe path persists.
    this.sceneryWanted.set(0, 0, 0);
    if (shot.obstacles && shot.subjects) {
      const subject = shot.subjects.primary;
      this.right.set(pos.z - subject.z, 0, subject.x - pos.x).normalize();
      this.probe.copy(pos).add(this.fitOffset);
      this.sceneryEye.copy(this.probe).add(this.sceneryOffset);
      let best = Math.max(0, sceneryLift(this.sceneryEye, subject, shot.obstacles, k.obstacleAhead))
        + this.sceneryOffset.length() * k.obstacleSideCost;
      this.sceneryWanted.copy(this.sceneryOffset);
      for (const fraction of [0, -0.5, 0.5, -1, 1]) {
        const side = fraction * k.obstacleSide;
        this.sceneryEye.copy(this.probe).addScaledVector(this.right, side);
        const cost = Math.max(0, sceneryLift(this.sceneryEye, subject, shot.obstacles, k.obstacleAhead))
          + Math.abs(side) * k.obstacleSideCost;
        if (cost < best - k.obstacleSideImprovement) { best = cost; this.sceneryWanted.copy(this.right).multiplyScalar(side); }
      }
    }
    if (Number.isFinite(dt)) this.ease(this.sceneryOffset, this.sceneryVelocity, this.sceneryWanted, k.obstacleSideResponse, dt);
    else { this.sceneryOffset.copy(this.sceneryWanted); this.sceneryVelocity.set(0, 0, 0); }
    pos.add(this.sceneryOffset);
    // Include the previous framing offset: portrait fitting can put the eye behind different scenery.
    this.probe.copy(pos).add(this.fitOffset);
    const subject = shot.subjects?.primary;
    const headroom = subject ? Math.max(0, subject.y + Math.hypot(this.probe.x - subject.x,
      this.probe.z - subject.z) * Math.tan(k.obstacleMaxElevation) - this.probe.y) : 0;
    const rise = shot.obstacles && subject
      ? Math.min(k.obstacleMaxRise, headroom, sceneryLift(this.probe, subject, shot.obstacles, k.obstacleAhead)) : 0;
    const change = (rise - this.sceneryRise) * (1 - Math.exp(-dt *
      (rise > this.sceneryRise ? k.obstacleRise : k.obstacleRelease)));
    this.sceneryRise += THREE.MathUtils.clamp(change, -dt * k.obstacleSpeed, dt * k.obstacleSpeed);
    pos.y += this.sceneryRise;
    this.camera.lookAt(this.look);
  }

  /** How far the camera would have to rise for the ground along its line of sight to be out of the way. */
  private blocked(eye: THREE.Vector3): number {
    let worst = 0;
    /** Only the ground in the first two thirds of the way is considered: nearer the subject than that, a lift
     * big enough to see over it would be a lift big enough to lose them anyway. */
    for (let i = 1; i <= 6; i++) {
      const t = i / 9;
      const gap = 1 - t;
      const x = eye.x + (this.look.x - eye.x) * t;
      const z = eye.z + (this.look.z - eye.z) * t;
      const ray = eye.y + (this.look.y - eye.y) * t;
      /** The clearance tapers to nothing at the subject, so a boat low in the water never pulls the camera up. */
      const need = (Math.max(heightAt(x, z), 0) + gap - ray) / gap;
      if (need > worst) worst = need;
    }
    return Math.min(worst, 14);
  }
}
