import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fixInPlace } from '../gl/fixed';
import { screenBrush } from '../creatures/motion';
import { WindGesture } from '../fx/wind-gesture';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import { feltWind, type WindField, type WindSample } from '../wind/field';
import { atmo } from './atmosphere';
import { heightAt } from './island';
import { Cord } from './kite';
import { PAINT_FRAG, PEG_VERT, WOOD_FRAG, WOOD_VERT, passagePegGeometry } from './lines';
import { LINES_BERTH } from './lines-passage';
import { SECTOR, WHEEL_FRAG, WHEEL_VERT, wheelGeometry } from './pinwheels';
import { REFLECTION_LAYER } from './water/reflection';

const K = tuning.shorePulley;
const UP = new THREE.Vector3(0, 1, 0);
/** Outward along the line, from the bank to the piling. */
const OUT = new THREE.Vector3(Math.sin(K.bearing), 0, -Math.cos(K.bearing));
/** Across the line, toward the side the play camera looks from. */
const ACROSS = new THREE.Vector3(Math.cos(K.bearing), 0, Math.sin(K.bearing));
/** Where the boat lies on the sand once it is in, and where it waits out on the water. */
export const SHORE_BERTH = new THREE.Vector3(LINES_BERTH.x, 0, LINES_BERTH.z);
export const SHORE_MOORING = SHORE_BERTH.clone().addScaledVector(OUT, K.reach);
const YAW_IN = Math.atan2(-OUT.x, -OUT.z);
// The bank post stands inland of the berth, so the boat comes to rest beside the pinwheel rather than behind it.
const NEAR = SHORE_BERTH.clone().addScaledVector(ACROSS, K.side).addScaledVector(OUT, -K.bankBack);
NEAR.y = heightAt(NEAR.x, NEAR.z) + K.bankHeight;
const FAR = NEAR.clone().addScaledVector(OUT, K.bankBack + K.reach + K.farBeyond);
FAR.y = K.farHeight;
/** The top of the piling out in the water, where the departure kite is tied off. */
export const SHORE_PILING = FAR.clone().addScaledVector(ACROSS, -0.18).setY(FAR.y + 0.32);
const POST_TOP = NEAR.clone().addScaledVector(ACROSS, -0.16).setY(NEAR.y + 0.3);
const SPAN = Math.hypot(FAR.x - NEAR.x, FAR.z - NEAR.z);
/** The painter's knot runs along the line from abeam of the moored bow to abeam of the bow on the sand. */
const KNOT_FROM = K.bankBack + K.reach - 1.9;
const KNOT_TO = K.bankBack - 1.9;
const RUN = KNOT_FROM - KNOT_TO;
/** The pinwheel, on the camera's side of the bank wheel, on the same axle. */
export const SHORE_PINWHEEL = NEAR.clone().addScaledVector(ACROSS, K.pinwheelOut);
/** Where the child stands to watch the boat: down the bank from the post, under the line, clear of the pinwheel. */
export const SHORE_STAND = (() => {
  const p = NEAR.clone().addScaledVector(ACROSS, 0.8).addScaledVector(OUT, 2.6);
  return p.setY(heightAt(p.x, p.z));
})();
/** Where the little bird waits beside her, toward the water and the camera, so neither hides the other. */
export const SHORE_BIRD = (() => {
  const p = SHORE_STAND.clone().addScaledVector(OUT, 1.2).addScaledVector(ACROSS, 0.5);
  return p.setY(heightAt(p.x, p.z));
})();
/** The haul is watched from one place: the stand, the pinwheel and the whole of the boat's way in. */
export const SHORE_STAGE = SHORE_STAND.clone().lerp(SHORE_MOORING, 0.45).setY(Math.max(heightAt(NEAR.x, NEAR.z), 0) + 1.2);
const LOOP = 2 * SPAN + 2 * Math.PI * K.wheelRadius;
const SPARES = 12;
const SPARE_SCALE = 0.75;

/** A point `t` (0 bank, 1 piling) along the lower run, which is the one carrying the boat toward the bank. */
function lowerRun(t: number, out: THREE.Vector3): THREE.Vector3 {
  out.lerpVectors(NEAR, FAR, t);
  out.y -= K.wheelRadius + Math.sin(t * Math.PI) * K.sag;
  return out;
}

/** Where a point `s` metres round the loop is, from the piling's foot in the direction the line runs. */
function aroundLoop(s: number, out: THREE.Vector3): THREE.Vector3 {
  const r = K.wheelRadius, bend = Math.PI * r;
  s = ((s % LOOP) + LOOP) % LOOP;
  if (s < SPAN) {
    return lowerRun(1 - s / SPAN, out);
  }
  if (s < SPAN + bend) {
    const a = -Math.PI / 2 - (s - SPAN) / r;
    return out.copy(NEAR).addScaledVector(OUT, Math.cos(a) * r).addScaledVector(UP, Math.sin(a) * r);
  }
  if (s < 2 * SPAN + bend) {
    const t = (s - SPAN - bend) / SPAN;
    out.lerpVectors(NEAR, FAR, t);
    out.y += r - Math.sin(t * Math.PI) * K.sag * 0.8;
    return out;
  }
  const a = Math.PI / 2 - (s - 2 * SPAN - bend) / r;
  return out.copy(FAR).addScaledVector(OUT, Math.cos(a) * r).addScaledVector(UP, Math.sin(a) * r);
}

/**
 * What the player does on the shore. Only a sweep across the pinwheel spins it up; the line runs with the wheel,
 * one way only, and the boat comes in on its painter behind the knot: taken up when the painter tightens,
 * gliding on when it slackens, slowed by the water and stopped by the sand. Nothing ever runs back out.
 */
export class ShoreHaul {
  /** While the child waits by the pinwheel, sweeps count. */
  active = false;
  spin = 0;
  turned = 0;
  /** Metres of line run in, and how far the boat has come in, with its way. */
  run = 0;
  boatAt = 0;
  boatSpeed = 0;
  /** Seconds since a sweep last crossed the pinwheel. */
  driveAge = Infinity;
  rock = 0;
  /** The painter is let go as the child pushes off, and hangs from the knot. */
  loose = false;
  readonly knot = new THREE.Vector3();
  private push = 0;
  private time = 0;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly point = new THREE.Vector3();
  private readonly edge = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  constructor() { this.reset(); }

  reset(done = false): void {
    this.spin = 0; this.push = 0; this.driveAge = Infinity; this.active = false; this.loose = false;
    this.run = done ? RUN : 0;
    this.boatAt = done ? K.reach : 0;
    this.boatSpeed = 0;
    this.knotAt();
  }

  get progress(): number { return this.run / RUN; }
  get arrived(): boolean { return this.boatAt > K.reach - 0.03 && this.boatSpeed < 0.05; }
  /** The line has started to come in, so the player has found the pinwheel. */
  get started(): boolean { return this.run > 0.4; }

  /** A stroke that crosses the pinwheel on screen blows through it. */
  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if (!this.active || input.muted || !input.present || input.gust < tuning.linesPassage.brushFrom
      || input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    const hub = SHORE_PINWHEEL;
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    const centre = this.point.copy(hub).project(camera);
    const rim = this.edge.copy(hub).addScaledVector(this.right, K.pinwheelRadius).project(camera);
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1;
    const radius = Math.max(0.06, Math.abs(rim.x - centre.x) * aspect * K.brushReach);
    const touch = screenBrush(camera, hub, input.prevNdc, input.ndc, radius);
    if (touch < 0.02) return;
    this.driveAge = 0;
    const speed = input.gust * Math.sqrt(touch);
    this.push = Math.max(this.push, THREE.MathUtils.smoothstep(speed, K.pushFrom, K.pushFull));
    wind.addSplat({ source: this, ax: hub.x - 0.5, az: hub.z, bx: hub.x + 0.5, bz: hub.z,
      vx: input.gustDir.x * speed, vz: input.gustDir.y * speed, radius: 2.5,
      energy: Math.min(0.5, speed / 25), swirl: 0, lift: 0 });
  }

  update(dt: number, wind: WindField): void {
    const p = tuning.linesPassage;
    this.time += dt;
    this.driveAge += dt;
    const w = feltWind(wind.sample(SHORE_PINWHEEL.x, SHORE_PINWHEEL.z, this.sample), wind.calm);
    const breeze = Math.hypot(w.x, w.z);
    // Gust energy is only ever the player's: the breeze has none, and only rocks the wheel against its line.
    const force = THREE.MathUtils.smoothstep(w.energy, p.energyFrom, p.energyFull) * THREE.MathUtils.smoothstep(breeze, p.speedFrom, p.speedFull);
    this.rock = Math.min(1, breeze / 4) * (Math.sin(this.time * 1.9) * 0.1 + Math.sin(this.time * 3.1 + 1) * 0.05);
    this.push *= Math.exp(-dt * K.pushFade);
    const full = this.run >= RUN;
    const want = this.active && !full ? Math.min(1, force * K.spill + this.push) * K.spinFull : 0;
    this.spin += (want - this.spin) * (1 - Math.exp(-dt * (want > this.spin ? K.spinUp : full ? 4 : K.spinDown)));
    if (this.spin < 0.02) this.spin = 0;
    this.turned += this.spin * dt;
    if (!full) this.run = Math.min(RUN, this.run + this.spin * K.wheelRadius * dt);

    // The painter takes the boat up once the knot has drawn ahead of it by more than its slack.
    // The last of the line takes up the slack too, so the bow is drawn right up onto the sand.
    const goal = this.run / RUN * (K.reach + K.slack + 0.3);
    const ahead = goal - this.boatAt - K.slack;
    if (ahead > 0) this.boatSpeed += ahead * K.pull * dt;
    this.boatSpeed *= Math.exp(-dt * (K.drag + (this.boatAt > K.reach - 1 ? K.beachGrip : 0)));
    this.boatAt += this.boatSpeed * dt;
    if (this.boatAt > Math.min(K.reach, goal + 0.6)) {
      this.boatAt = Math.min(K.reach, goal + 0.6);
      this.boatSpeed = Math.min(this.boatSpeed, 0.1);
    }
    if (this.boatAt >= K.reach) { this.boatAt = K.reach; this.boatSpeed = 0; }
    this.knotAt();
  }

  /** How taut the painter is, 0 slack to 1 pulling. */
  get taut(): number {
    return THREE.MathUtils.smoothstep(this.run / RUN * (K.reach + K.slack + 0.3) - this.boatAt - K.slack, -0.4, 0.2);
  }

  /** The boat's place on its way in, and its heading: it swings a little on its mooring and toward the pull. */
  boatPose(out: THREE.Vector3): number {
    const k = this.boatAt / K.reach;
    out.lerpVectors(SHORE_MOORING, SHORE_BERTH, k);
    const settle = THREE.MathUtils.smoothstep(this.boatAt, K.reach - 5, K.reach);
    const yaw = THREE.MathUtils.lerp(YAW_IN, K.berthYaw, settle);
    const swing = (1 - settle) * (Math.sin(this.time * 0.37) * 0.07 + this.taut * 0.12);
    return yaw + swing;
  }

  private knotAt(): void {
    lowerRun((KNOT_FROM - this.run) / SPAN, this.knot);
  }
}

export const shoreHaul = new ShoreHaul();

/** The walk's faded red and paper, one colour to each pair of opposite sails, so its turning shows. */
const PINWHEEL_TINTS = ['#c4695c', '#e6dac2'];

/** A grooved wooden wheel with four spokes, turning about its local z. */
function pulleyWheel(r: number): THREE.BufferGeometry {
  const rim = new THREE.TorusGeometry(r, 0.04, 6, 20);
  const spokes = [0, 1].map(i => new THREE.BoxGeometry(r * 2, 0.045, 0.03).rotateZ(i * Math.PI / 2));
  const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8).rotateX(Math.PI / 2);
  return mergeGeometries([rim, ...spokes, hub]);
}

/**
 * The rig on the shore: the bank post with its wheel and the pinwheel on the wheel's axle, the piling out in the
 * water with the other wheel, the loop of line between them with spare pegs riding it, and the boat's painter.
 * It draws whatever `shoreHaul` says, and shows a stalled player a sweep across the pinwheel.
 */
export class ShorePulleyRig {
  readonly group = new THREE.Group();
  private readonly gesture = new WindGesture('shore-invitation');
  readonly invitation = this.gesture.batch.mesh;
  private readonly wheels: THREE.Object3D[] = [];
  private readonly pegs: THREE.InstancedMesh;
  private readonly state = new Float32Array(4);
  private readonly stateAttr: THREE.InstancedBufferAttribute;
  private readonly painter = new Cord(10, 0.014, new THREE.Color(0.62, 0.55, 0.44));
  private readonly painterPoints = Array.from({ length: 10 }, () => new THREE.Vector3());
  private readonly matrix = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion();
  private readonly basis = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly bow = new THREE.Vector3();
  private readonly stern = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 0, 1);
  private invited = 0;
  private alpha = 0;

  constructor() {
    const r = K.wheelRadius;
    const wood = new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: WOOD_VERT, fragmentShader: WOOD_FRAG });
    // Wheels and pinwheel face back along the line's normal, so turning them forward runs the lower line in.
    const face = ACROSS.clone().negate();
    const side = new THREE.Vector3().crossVectors(UP, face);
    this.basis.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, UP, face));

    const fixed: THREE.BufferGeometry[] = [];
    const bankFoot = heightAt(NEAR.x, NEAR.z);
    const postAt = POST_TOP;
    const bankTall = POST_TOP.y - bankFoot;
    fixed.push(new THREE.CylinderGeometry(0.075, 0.1, bankTall + 0.3, 7).translate(postAt.x, bankFoot + bankTall / 2 - 0.15, postAt.z));
    const pileAt = SHORE_PILING;
    const seabed = Math.min(heightAt(pileAt.x, pileAt.z), -1);
    const pileTall = FAR.y + 0.32 - seabed;
    fixed.push(new THREE.CylinderGeometry(0.11, 0.14, pileTall, 7).translate(pileAt.x, seabed + pileTall / 2, pileAt.z));
    for (const [hub, length] of [[NEAR, K.pinwheelOut + 0.2], [FAR, 0.3]] as const) {
      const mid = hub.clone().addScaledVector(ACROSS, length / 2 - 0.18);
      const axle = new THREE.CylinderGeometry(0.03, 0.03, length + 0.18, 6);
      axle.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, ACROSS));
      fixed.push(axle.translate(mid.x, mid.y, mid.z));
    }
    const rig = new THREE.Mesh(mergeGeometries(fixed.map(g => g.index ? g.toNonIndexed() : g)), wood);
    this.group.add(rig);
    fixInPlace(rig);

    for (const hub of [NEAR, FAR]) {
      const wheel = new THREE.Mesh(pulleyWheel(r), wood);
      wheel.position.copy(hub);
      wheel.quaternion.copy(this.basis);
      this.wheels.push(wheel);
      this.group.add(wheel);
    }

    const lower: THREE.Vector3[] = [], upper: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      lower.push(lowerRun(t, new THREE.Vector3()));
      const u = new THREE.Vector3().lerpVectors(NEAR, FAR, t);
      u.y += r - Math.sin(t * Math.PI) * K.sag * 0.8;
      upper.push(u);
    }
    for (const run of [lower, upper]) {
      const cord = new Cord(run.length, 0.012, new THREE.Color(0.86, 0.82, 0.74));
      cord.update(run);
      this.group.add(cord.mesh);
    }
    this.group.add(this.painter.mesh);

    const pinwheel = wheelGeometry(1, 0.42);
    const index = pinwheel.index!.array;
    const perSail = (index.length - 8 * 3) / 4;
    this.state.set([0, 0, Math.atan2(face.x, face.z), K.pinwheelRadius]);
    this.stateAttr = new THREE.InstancedBufferAttribute(this.state, 4).setUsage(THREE.DynamicDrawUsage);
    const material = new THREE.ShaderMaterial({ uniforms: { ...atmo.uniforms, uFrontTint: { value: 0.75 } },
      vertexShader: WHEEL_VERT, fragmentShader: WHEEL_FRAG, side: THREE.DoubleSide });
    PINWHEEL_TINTS.forEach((colour, n) => {
      const geo = new THREE.InstancedBufferGeometry();
      const own: number[] = [];
      for (const s of [n, n + 2]) for (let i = 0; i < perSail; i++) own.push(index[s * perSail + i]);
      if (n === 0) for (let i = perSail * 4; i < index.length; i++) own.push(index[i]);
      geo.setIndex(own);
      for (const name of ['position', 'normal', 'aSweep', 'aTone']) geo.setAttribute(name, pinwheel.getAttribute(name));
      geo.instanceCount = 1;
      geo.setAttribute('aState', this.stateAttr);
      geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(SHORE_PINWHEEL.toArray()), 3));
      const tint = new THREE.Color(colour);
      geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array([tint.r, tint.g, tint.b]), 3));
      geo.boundingSphere = new THREE.Sphere(SHORE_PINWHEEL.clone(), 3);
      this.group.add(new THREE.Mesh(geo, material));
    });

    this.pegs = new THREE.InstancedMesh(passagePegGeometry(), new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uPaint: { value: new THREE.Color('#d9c29b') } },
      vertexShader: PEG_VERT, fragmentShader: PAINT_FRAG,
    }), SPARES);
    this.pegs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pegs.frustumCulled = false;
    this.group.add(this.pegs);
    this.group.traverse(o => o.layers.enable(REFLECTION_LAYER));
    this.update(0, null, null);
  }

  /** `boat` is the hull to tie the painter to, or null once nobody needs to see it. */
  update(dt: number, camera: THREE.Camera | null, boat: { hullEnds(bow: THREE.Vector3, stern: THREE.Vector3): void } | null): void {
    const h = shoreHaul;
    const angle = h.run / K.wheelRadius + h.rock;
    this.state[0] = angle;
    this.state[1] = THREE.MathUtils.clamp(h.spin * tuning.linesToys.smearSeconds - 0.14, 0, SECTOR);
    this.stateAttr.needsUpdate = true;
    for (const wheel of this.wheels) wheel.quaternion.copy(this.basis).multiply(this.turn.setFromAxisAngle(this.axis, angle));
    for (let i = 0; i < SPARES; i++) {
      const s = i * LOOP / SPARES + h.run;
      aroundLoop(s, this.p);
      // Clipped on like any peg on a line, whichever run it is riding.
      this.pegs.setMatrixAt(i, this.matrix.compose(this.p, this.basis, this.scale.setScalar(SPARE_SCALE)));
    }
    this.pegs.instanceMatrix.needsUpdate = true;

    this.painter.mesh.visible = !!boat || h.loose;
    if (boat && !h.loose) {
      boat.hullEnds(this.bow, this.stern);
      this.bow.y += 0.3;
      const sag = THREE.MathUtils.lerp(0.55, 0.05, h.taut);
      for (let i = 0; i < this.painterPoints.length; i++) {
        const t = i / (this.painterPoints.length - 1);
        this.painterPoints[i].lerpVectors(this.bow, h.knot, t).y -= Math.sin(t * Math.PI) * sag;
      }
      this.painter.update(this.painterPoints);
    } else if (h.loose) {
      for (let i = 0; i < this.painterPoints.length; i++) {
        const t = i / (this.painterPoints.length - 1);
        this.painterPoints[i].copy(h.knot).y -= t * 1.1;
        this.painterPoints[i].x += Math.sin(t * 2) * 0.05;
      }
      this.painter.update(this.painterPoints);
    }

    this.gesture.hide();
    if (!camera) return;
    const offered = h.active && h.driveAge > K.inviteAfter && h.spin < 0.5;
    this.invited = offered ? this.invited + dt : 0;
    this.alpha += ((offered ? tuning.linesPassage.inviteAlpha : 0) - this.alpha)
      * (1 - Math.exp(-dt * (offered ? 6 : tuning.invitation.handover)));
    if (this.alpha < 0.01) return;
    const k = tuning.linesPassage;
    const cycle = k.inviteSweep + k.invitePause;
    this.gesture.draw(camera, SHORE_PINWHEEL, (this.invited % cycle) / k.inviteSweep, K.inviteSpan,
      this.alpha, K.inviteWidth, 'across', Math.floor(this.invited / cycle) % 2 === 0 ? 1 : -1);
  }
}
