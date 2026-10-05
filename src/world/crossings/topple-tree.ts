import * as THREE from 'three';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../atmosphere';
import { SWELL_GLSL, swellUniforms } from '../water/swell';
import { mulberry32 } from '../noise';
import { REFLECTION_LAYER } from '../water/reflection';
import type { Deck } from '../decks';
import type { PointerInput } from '../../input/pointer';
import type { WindField } from '../../wind/field';
import { Spray, DROP, MIST, SPLASH } from '../../fx/sealife/spray';
import { Marks, FOAM, RING } from '../../fx/sealife/marks';
import { BARK, EARTH, ROOT, merged, segmentGap, tagged, tube } from './shapes';

/** How far the heel of the root plate heaves up when the roots have all but gone, and the plate's radius. */
const HEAVE = 0.45;
const PLATE_R = 1.15;

const TREE_VERT = /* glsl */ `
${ATMO_GLSL}
uniform float uShiver;
uniform float uFlex;
uniform float uShudder;
uniform float uHeight;
uniform vec2 uSpan;
uniform float uHeave;
in float aShake;
in float aKind;
in float aPhase;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vKind;
void main() {
  vec3 p = position;
  if (aKind > ${ROOT - 0.5} && aKind < ${EARTH + 0.5}) {
    /** The side of the plate away from the fall breaks up out of the bed as the roots give. */
    float heel = smoothstep(0.1, -0.9, p.z) * smoothstep(0.3, 0.8, length(p.xz)) * smoothstep(-0.5, 0.0, p.y);
    p.y += uHeave * heel * ${HEAVE};
    p.z -= uHeave * heel * 0.08;
  }
  float up = clamp(p.y / uHeight, 0.0, 1.0);
  float span = sin(clamp((p.y - uSpan.x) / (uSpan.y - uSpan.x), 0.0, 1.0) * 3.14159);
  p.z += uFlex * up * up * uHeight * 0.3 + uShudder * span * sin(uTime * 29.0) * 0.09;
  float t = uTime * (6.0 + 6.0 * fract(aPhase * 3.17)) + aPhase * 6.2832;
  p += vec3(sin(t), 0.45 * sin(t * 1.37 + 1.1), cos(t * 0.83 + 0.4)) * aShake * (0.008 + 0.075 * uShiver);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vLocal = position;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const TREE_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uWater;
uniform float uSoak;
uniform float uHeave;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  int kind = int(vKind + 0.5);
  float around = atan(vLocal.z, vLocal.x);
  vec3 alb;
  float wet;
  if (kind == ${EARTH}) {
    /** Wet garden mud: lumps of it drier and lighter on top, stones and old roots through it, cracking where it heaves. */
    float lumps = vnoise(vLocal.xz * 3.1 + vLocal.y) * 0.6 + vnoise(vLocal.xz * 9.0) * 0.4;
    alb = mix(vec3(0.062, 0.045, 0.031), vec3(0.12, 0.092, 0.064), smoothstep(0.3, 0.8, lumps) * smoothstep(-0.25, 0.05, vLocal.y));
    alb = mix(alb, vec3(0.13, 0.12, 0.105), smoothstep(0.8, 0.86, vnoise(vLocal.xz * 7.0 + 3.0)) * 0.7);
    float heel = smoothstep(0.1, -0.9, vLocal.z) * smoothstep(0.3, 0.8, length(vLocal.xz));
    float crack = abs(vnoise(vec2(around * 3.0, length(vLocal.xz) * 2.2) + 7.0) - 0.5);
    alb *= 1.0 - 0.85 * (1.0 - smoothstep(0.0, 0.03 * uHeave * heel + 0.001, crack));
    wet = 0.75 + 0.25 * (1.0 - smoothstep(-0.2, 0.05, vLocal.y));
  } else if (kind == ${ROOT}) {
    /** Torn roots: pale where the skin is stripped, dark bark between. */
    float strip = smoothstep(0.45, 0.7, vnoise(vec2(around * 2.0, (vLocal.x + vLocal.z) * 5.0) + vLocal.y * 3.0));
    alb = mix(vec3(0.05, 0.038, 0.028), vec3(0.15, 0.12, 0.085), strip);
    wet = 0.7;
  } else {
    float fissures = smoothstep(0.35, 0.75, vnoise(vec2(around * 4.0, vLocal.y * 0.8)) * 0.7 + vnoise(vec2(around * 12.0, vLocal.y * 3.0)) * 0.3);
    alb = mix(vec3(0.04, 0.034, 0.03), vec3(0.1, 0.086, 0.072), fissures);
    /** Where the bark has fallen away the dead wood shows through, bleached silver by the weather. */
    float bare = smoothstep(0.56, 0.68, vnoise(vec2(around * 1.6, vLocal.y * 0.32) + 4.0));
    float grain = vnoise(vec2(around * 26.0, vLocal.y * 1.4));
    alb = mix(alb, vec3(0.19, 0.18, 0.165) * (0.8 + 0.35 * grain), bare * 0.85);
    alb = mix(alb, vec3(0.05, 0.075, 0.035), smoothstep(0.66, 0.82, vnoise(vLocal.xy * vec2(2.0, 0.6) + 2.0)) * 0.5);
    /** What stood in the flood is dark, green and slick, with the tide mark the water kept washing. */
    float under = 1.0 - smoothstep(-0.1, 0.35, vLocal.y - uWater);
    alb = mix(alb, alb * vec3(0.32, 0.4, 0.3), under * 0.9);
    alb += vec3(0.02, 0.024, 0.014) * (1.0 - smoothstep(0.0, 0.18, abs(vLocal.y - uWater - 0.35)));
    /** Torn up out of it, everything that was under is running wet. */
    wet = under * uSoak;
  }
  alb *= 1.0 - 0.35 * wet;
  float gloss = 0.04 + 0.2 * wet;

  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  vec3 col = alb * (hemiLight(n) + uSunColor * mix(ndl, wrap * wrap, 0.2) * sun);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.5);
  col += uSunColor * rim * sun * (kind == ${EARTH} ? 0.06 : 0.14);
  /** A wet sheen, broken up: mud and roots running with water glint in places, never all over. */
  float sheen = pow(max(dot(reflect(-uSunDir, n), V), 0.0), 40.0) * smoothstep(0.45, 0.8, vnoise(vLocal.xz * 6.0 + vLocal.y * 4.0));
  col += uSunColor * sheen * sun * gloss;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** Mud stirred up off the bed, clouding the water round the foot: it shows less the flatter the water is seen. */
const SILT_VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
out vec2 vQ;
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = vec3(w.x, seaSurfaceY(w.xz) + 0.03, w.z);
  vQ = position.xy;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const SILT_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uSilt;
uniform float uSeed;
in vec2 vQ;
in vec3 vWorld;
void main() {
  float r = length(vQ);
  float body = 1.0 - smoothstep(0.45, 1.0, r + (vnoise(vQ * 2.2 + uSeed + uTime * 0.05) - 0.5) * 0.5);
  body *= 0.7 + 0.3 * vnoise(vQ * 5.0 - uSeed - uTime * 0.08);
  vec3 V = normalize(cameraPosition - vWorld);
  float F = 0.02 + 0.98 * pow(1.0 - max(V.y, 0.02), 5.0);
  float a = body * uSilt * (1.0 - 0.6 * F) * 0.85;
  if (a < 0.004) discard;
  vec3 col = vec3(0.1, 0.075, 0.045) * (uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.5 * cloudShadow(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld) * a, a);
}`;

/** Where a dead tree stands and what it will lie across once it is down. */
export interface TreeSpot {
  /** The foot of the trunk, on the bed under the water. */
  root: THREE.Vector3;
  /** The near end of the gap, on what it comes down on (the end of a ridge): it falls toward here. */
  rest: THREE.Vector3;
  /** Where its trunk passes over the far side (the foot of a garden wall), at the height of what it rests on there. */
  over: THREE.Vector3;
  height?: number;
  seed?: number;
}

export type TreeEvent = 'creak' | 'loosen' | 'tear' | 'impact';

const SPINE = 0.86;
const R_FOOT = 0.4;
const R_TOP = 0.13;

/**
 * A dead tree rotted at its roots, standing in a flooded garden beside a gap. Strokes across it on screen rock it
 * a beat late and it springs back, creaking, its twigs shivering. Only a firm push toward the gap gets past what the
 * roots allow, and each one tears them a step: the water boils and clouds round the foot, the far side of the plate
 * heaves up cracked out of the water, and it stands leaning further. The second or third such push takes it. Then
 * it goes, slowly and then faster, tilting its plate of earth up out of the bed, and comes down across the gap,
 * where its trunk is a deck to walk over.
 */
export class ToppleTree {
  readonly group = new THREE.Group();
  readonly objects: THREE.Object3D[];
  readonly height: number;
  /** Level, the way it falls: from its root toward the near end of the gap. */
  readonly fall = new THREE.Vector2();
  state: 'standing' | 'falling' | 'down' = 'standing';
  /** Radians toward the gap; and sideways, positive to the right of the way it falls. */
  lean = 0;
  side = 0;
  /** How far the rotten roots have given, 0 to 1, a step for each firm push: at 1 it goes. */
  loose = 0;
  /** How many times the roots have given. */
  gives = 0;
  /** Seconds since it came down. */
  sinceDown = 0;
  /** The way over once it is down: from the near end down to where it passes over the far side. */
  readonly deck: Deck;
  onEvent: ((kind: TreeEvent, at: THREE.Vector3, strength: number) => void) | null = null;
  private leanV = 0;
  private sideV = 0;
  private press = 0;
  private incoming = 0;
  private sideIncoming = 0;
  /** The most the push has pressed since the roots last gave; ready again once that push has ebbed. */
  private pushPeak = 0;
  private armed = true;
  private settle = 0;
  private fellFrom = 0;
  private tornUp = false;
  private heave = 0;
  private bubbling = 0;
  private silt = 0;
  private siltAge = 0;
  private shiver = 0;
  private shudder = 0;
  private tear = 0;
  private soak = 0;
  private dripFor = 0;
  private lastLeanV = 0;
  private readonly yaw: number;
  private readonly base = new THREE.Vector3();
  private readonly baseDown = new THREE.Vector3();
  readonly downLean: number;
  private readonly material: THREE.ShaderMaterial;
  private readonly siltMesh: THREE.Mesh;
  private readonly spray: Spray;
  private readonly marks = new Marks(0.8);
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly sa = new THREE.Vector2();
  private readonly sb = new THREE.Vector2();
  private readonly sc = new THREE.Vector2();
  private readonly sd = new THREE.Vector2();
  private readonly projected = new THREE.Vector3();
  /** Along the trunk from its foot, where it rests on the far side and on the near end once down. */
  private readonly spanOver: number;
  private readonly spanRest: number;

  constructor(readonly spot: TreeSpot, wind: WindField) {
    const k = tuning.crossings.tree;
    this.fall.set(spot.rest.x - spot.root.x, spot.rest.z - spot.root.z).normalize();
    this.yaw = Math.atan2(this.fall.x, this.fall.y);
    this.base.copy(spot.root);

    const along = (p: THREE.Vector3) => (p.x - spot.root.x) * this.fall.x + (p.z - spot.root.z) * this.fall.y;
    const uRest = along(spot.rest), uOver = along(spot.over);
    let rRest = 0.18, rOver = 0.33, slope = 0, footY = 0, cos = 1;
    const shift = k.rootShift;
    let sRest = uRest, sOver = uOver;
    for (let i = 0; i < 4; i++) {
      const yRest = spot.rest.y + rRest / cos, yOver = spot.over.y + rOver / cos;
      slope = (yRest - yOver) / (uRest - uOver);
      footY = yOver + slope * (shift - uOver);
      cos = 1 / Math.hypot(1, slope);
      sRest = (uRest - shift) / cos;
      sOver = (uOver - shift) / cos;
      this.height = Math.max(spot.height ?? 9, sRest + 1.4);
      rRest = radiusAt(sRest, this.height);
      rOver = radiusAt(sOver, this.height);
    }
    this.height = Math.max(spot.height ?? 9, sRest + 1.4);
    this.spanOver = sOver;
    this.spanRest = sRest;
    this.downLean = Math.PI / 2 - Math.atan(slope);
    this.baseDown.set(spot.root.x + this.fall.x * shift, footY, spot.root.z + this.fall.y * shift);

    const top = (s: number) => {
      const r = radiusAt(s, this.height);
      const level = Math.cos(this.downLean), rise = Math.sin(this.downLean);
      return new THREE.Vector3(
        this.baseDown.x + this.fall.x * (s * rise - r * level),
        this.baseDown.y + s * level + r * rise,
        this.baseDown.z + this.fall.y * (s * rise - r * level));
    };
    const near = top(sRest), far = top(sOver);
    this.deck = { x0: near.x, z0: near.z, x1: far.x, z1: far.z, halfWidth: 0.28, height: near.y, height1: far.y };

    this.material = barkMaterial(this.height, -spot.root.y);
    this.material.uniforms.uSpan.value.set(sOver, sRest);
    const mesh = new THREE.Mesh(growDeadTree(this.height, spot.seed ?? 4417, this.downLean), this.material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.group.rotation.order = 'YXZ';
    this.siltMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.ShaderMaterial({
      vertexShader: SILT_VERT, fragmentShader: SILT_FRAG,
      uniforms: { ...atmo.uniforms, ...swellUniforms, uSilt: { value: 0 }, uSeed: { value: (spot.seed ?? 4417) % 97 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    }));
    this.siltMesh.rotation.x = -Math.PI / 2;
    this.siltMesh.frustumCulled = false;
    this.siltMesh.renderOrder = 2;
    this.spray = new Spray(wind);
    this.objects = [this.group, this.spray.mesh, this.marks.mesh, this.siltMesh];
    for (const o of [this.group, this.spray.mesh, this.marks.mesh]) o.layers.enable(REFLECTION_LAYER);
    this.reset();
  }

  reset(): void {
    this.state = 'standing';
    this.lean = tuning.crossings.tree.restLean;
    this.leanV = this.side = this.sideV = this.press = this.incoming = this.sideIncoming = 0;
    this.loose = this.tear = this.soak = this.shudder = this.shiver = this.dripFor = 0;
    this.gives = this.pushPeak = this.settle = this.heave = this.bubbling = this.silt = this.siltAge = 0;
    this.armed = true;
    this.tornUp = false;
    this.sinceDown = 0;
    this.base.copy(this.spot.root);
    this.pose();
  }

  get down(): boolean {
    return this.state === 'down';
  }

  /** How near it is to going over, 0 to 1: what counts as progress. */
  get progress(): number {
    return this.state === 'standing' ? this.loose * 0.95 : 1;
  }

  /** A point a share of the way up the standing trunk, in the world. */
  trunkAt(share: number, out: THREE.Vector3): THREE.Vector3 {
    return this.group.localToWorld(out.set(0, this.height * share, 0));
  }

  /** Where the trunk meets the water, in the world. */
  footAt(out: THREE.Vector3): THREE.Vector3 {
    return this.trunkAt(Math.min(0.9, -this.spot.root.y / this.height), out);
  }

  /** The screen angle (radians anticlockwise from the right) of a push that would take it over. */
  fallHeading(camera: THREE.PerspectiveCamera): number {
    const a = this.trunkAt(0.55, this.tmp).project(camera);
    this.tmp2.set(this.fall.x, 0, this.fall.y).multiplyScalar(2).add(this.trunkAt(0.55, this.projected)).project(camera);
    return Math.atan2(this.tmp2.y - a.y, (this.tmp2.x - a.x) * camera.aspect);
  }

  /** A stroke across it on screen: toward the gap pushes it over, against it and sideways only rock it. */
  brush(camera: THREE.PerspectiveCamera, input: PointerInput, dt: number): number {
    if (this.state !== 'standing' || !input.present || input.muted || dt <= 0) return 0;
    const k = tuning.crossings.tree;
    const aspect = camera.aspect;
    const sx = (input.ndc.x - input.prevNdc.x) * aspect * 0.5, sy = (input.ndc.y - input.prevNdc.y) * 0.5;
    const travel = Math.hypot(sx, sy);
    if (travel < 1e-5) return 0;
    const screen = (p: THREE.Vector3, out: THREE.Vector2) => {
      this.projected.copy(p).project(camera);
      return out.set(this.projected.x * aspect * 0.5, this.projected.y * 0.5);
    };
    const foot = screen(this.trunkAt(Math.min(0.9, (-this.spot.root.y + 0.2) / this.height), this.tmp), this.sa);
    const crown = screen(this.trunkAt(0.92, this.tmp), this.sb);
    this.sc.set(input.prevNdc.x * aspect * 0.5, input.prevNdc.y * 0.5);
    this.sd.set(input.ndc.x * aspect * 0.5, input.ndc.y * 0.5);
    const gap = segmentGap(this.sc, this.sd, foot, crown);
    const hit = gap < k.reach ? Math.min(1, 1.4 * (1 - gap / k.reach)) : 0;
    if (hit <= 0) return 0;
    const heading = this.fallHeading(camera);
    const along = (sx * Math.cos(heading) + sy * Math.sin(heading));
    const across = (-sx * Math.sin(heading) + sy * Math.cos(heading));
    const firm = THREE.MathUtils.lerp(k.soft, 1, THREE.MathUtils.smoothstep(travel / dt, k.gentle, k.firm));
    const push = along * hit * firm;
    this.incoming += push * (push > 0 ? k.push : k.against);
    this.sideIncoming += across * hit * firm * k.side;
    return push;
  }

  /** A push of the world's own, as a stroke of `amount` screen heights toward the gap would give. */
  nudge(amount: number): void {
    if (this.state === 'standing') this.incoming += amount * tuning.crossings.tree.push;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const k = tuning.crossings.tree;
    const time = atmo.uniforms.uTime.value;
    const take = 1 - Math.exp(-dt / k.lag);
    const rest = k.restLean + this.loose * k.looseLean;
    if (this.state === 'standing') {
      this.press += this.incoming * take;
      this.incoming -= this.incoming * take;
      this.press = THREE.MathUtils.clamp(this.press * Math.exp(-dt / k.hold), -k.backMax, k.pressMax);
      this.settle = Math.max(0, this.settle - dt);
      if (!this.armed && this.settle <= 0 && this.press < k.giveAt * 0.4) {
        this.armed = true;
        this.pushPeak = 0;
      }
      if (this.armed) this.pushPeak = Math.max(this.pushPeak, this.press + Math.max(0, this.incoming));
      /** The roots let it lean so far and hold hard beyond. */
      const strain = Math.max(0, this.lean - rest - k.holdAt);
      this.leanV += (-k.stiffness * (this.lean - rest - this.press) - k.rootStiffness * strain - k.damping * this.leanV) * dt;
      this.lean += this.leanV * dt;
      if (this.lastLeanV * this.leanV < 0 && Math.abs(this.lean - rest) > 0.035 && this.settle <= 0) {
        const strength = Math.min(1, Math.abs(this.lean - rest) * 6);
        this.onEvent?.('creak', this.trunkAt(0.3, this.tmp), strength);
        this.ring(0.6 * strength, time);
      }
      if (this.armed && strain > 0 && this.pushPeak >= k.giveAt) this.give(time);
    } else if (this.state === 'falling') {
      const torn = THREE.MathUtils.clamp((this.lean - this.fellFrom) / k.tearOver, 0, 1);
      const hold = THREE.MathUtils.lerp(k.tearHold, 1, THREE.MathUtils.smoothstep(torn, 0.2, 1));
      this.leanV += k.fallPull * Math.sin(this.lean) * hold * dt;
      this.lean += this.leanV * dt;
      if (!this.tornUp && torn > 0.15) this.tearUp(time);
      if (this.lean >= this.downLean) this.land(time);
    } else {
      this.sinceDown += dt;
      this.leanV += (-k.settle * (this.lean - this.downLean) - k.settleDamping * this.leanV) * dt;
      this.lean += this.leanV * dt;
      if (this.lean > this.downLean) {
        this.lean = this.downLean;
        this.leanV = -Math.abs(this.leanV) * k.bounce;
      }
    }
    this.sideIncoming *= 1 - take;
    this.sideV += (-k.stiffness * 1.3 * this.side - k.damping * this.sideV + this.sideIncoming * 8) * dt;
    this.side = THREE.MathUtils.clamp(this.side + this.sideV * dt, -0.12, 0.12);
    if (this.state !== 'standing') this.side *= Math.exp(-dt * 3);
    this.lastLeanV = this.leanV;

    if (this.state !== 'standing') {
      const torn = THREE.MathUtils.clamp((this.lean - this.fellFrom) / (this.downLean - this.fellFrom), 0, 1);
      this.tear = Math.max(this.tear, torn);
      const heave = THREE.MathUtils.smootherstep(this.tear, 0.05, 1);
      this.base.lerpVectors(this.spot.root, this.baseDown, heave);
      this.soak = Math.max(this.soak, heave);
    }
    /** The heel comes up in a lurch as the roots let go, and stays up. */
    this.heave += (Math.min(1, this.loose * 1.6) - this.heave) * (1 - Math.exp(-dt / 0.18));
    this.soak = Math.max(0, this.soak - dt * 0.01);
    this.shudder = Math.max(0, this.shudder - dt / k.shudderFor);
    const motion = Math.abs(this.leanV) + Math.abs(this.sideV);
    this.shiver += (Math.min(1.4, motion * 3 + this.shudder * 1.5) - this.shiver) * (1 - Math.exp(-dt * 5));
    this.bubble(dt, time);
    this.drip(dt, time);
    this.pose();
    this.spray.update(dt);
    this.marks.update(time);
  }

  /** The roots tear a step: the push is spent on them, it lurches over, and the water round the foot boils with mud. */
  private give(time: number): void {
    const k = tuning.crossings.tree;
    const step = THREE.MathUtils.lerp(k.giveMin, k.giveMax, THREE.MathUtils.smoothstep(this.pushPeak, k.giveAt, k.pressMax));
    this.loose = Math.min(1, this.loose + step);
    this.gives++;
    this.armed = false;
    this.settle = k.settleFor;
    this.press *= 0.3;
    this.incoming *= 0.3;
    if (this.loose >= 0.95) {
      /** However hard the push, the roots hold it a moment before it goes. */
      this.state = 'falling';
      this.fellFrom = this.lean;
      this.leanV = THREE.MathUtils.clamp(this.leanV, 0.1, 0.16);
      return;
    }
    this.leanV += k.lurch;
    this.shudder = Math.max(this.shudder, 0.5);
    this.bubbling = k.bubbleFor;
    this.siltAge = 0;
    this.silt = Math.min(1, this.silt + 0.45 + 0.4 * step);
    this.dripFor = Math.max(this.dripFor, 1.6);
    const at = this.footAt(this.tmp);
    this.onEvent?.('loosen', at, step / k.giveMax);
    const hx = at.x - this.fall.x * 0.6, hz = at.z - this.fall.y * 0.6;
    this.marks.add(FOAM, hx, hz, 0.7, 2.5, time, 0.55, 0.5);
    for (let i = 0; i < 3; i++) this.marks.add(RING, at.x, at.z, 0.5 + i * 0.3, 2.6 + i * 0.6, time + i * 0.22, 0.8, 1.6);
    for (let i = 0; i < 4; i++) this.spray.plip(hx + (Math.random() - 0.5) * 1.2, hz + (Math.random() - 0.5) * 1.2, 0.35);
  }

  private tearUp(time: number): void {
    this.tornUp = true;
    this.dripFor = 4.5;
    this.bubbling = Math.max(this.bubbling, 2);
    this.siltAge = 0;
    this.silt = 1;
    const at = this.spot.root;
    this.onEvent?.('tear', this.tmp.set(at.x, 0, at.z), 1);
    this.spray.splash(at.x, at.z, 1.1, 0.7);
    this.marks.add(FOAM, at.x, at.z, 1.2, 4, time, 0.9, 0.6);
    for (let i = 0; i < 3; i++) this.marks.add(RING, at.x, at.z, 0.8 + i * 0.4, 3 + i, time + i * 0.25, 1, 2.2);
  }

  private land(time: number): void {
    const k = tuning.crossings.tree;
    const speed = this.leanV;
    this.lean = this.downLean;
    this.leanV = -speed * k.bounce;
    this.state = 'down';
    this.sinceDown = 0;
    this.shudder = 1;
    this.tear = 1;
    this.base.copy(this.baseDown);
    const crown = this.trunkAt(this.spanRest / this.height, this.tmp2);
    this.onEvent?.('impact', crown, Math.min(1, speed / 1.5));
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, out = 0.6 + Math.random() * 1.6;
      this.spray.emit(MIST, crown.x, crown.y + 0.1, crown.z, Math.cos(a) * out, 0.6 + Math.random() * 1.4, Math.sin(a) * out, 0.25, 1.4 + Math.random(), 0.5, 0.06);
    }
    const root = this.baseDown;
    this.spray.splash(root.x, root.z, 1.3, 0.8);
    this.marks.add(FOAM, root.x, root.z, 1.5, 5, time, 1, 0.5);
    for (let i = 0; i < 3; i++) this.marks.add(RING, root.x, root.z, 1 + i * 0.5, 3.5 + i, time + i * 0.3, 1, 2.6);
    const lane = this.trunkAt((this.spanOver + this.spanRest) * 0.5 / this.height, this.tmp2);
    for (let i = 0; i < 4; i++) {
      const s = this.spanOver + (this.spanRest - this.spanOver) * Math.random();
      const p = this.trunkAt(s / this.height, this.tmp);
      this.spray.plip(p.x + (Math.random() - 0.5) * 0.8, p.z + (Math.random() - 0.5) * 0.8, 0.8);
    }
    this.marks.add(RING, lane.x, lane.z, 0.6, 3, time + 0.2, 0.6, 1.6);
  }

  /** Rings off the trunk where it stands in the water as it rocks. */
  private ring(strength: number, time: number): void {
    const at = this.footAt(this.tmp);
    this.marks.add(RING, at.x, at.z, 0.45, 2.4, time, strength, 1.4);
    if (this.loose > 0.25) this.spray.plip(at.x, at.z, 0.3 * this.loose);
  }

  /** Bubbles coming up through the water round the foot after the roots give, most on the side that heaved. */
  private bubble(dt: number, time: number): void {
    this.siltAge += dt;
    this.silt = Math.max(0, this.silt - dt * 0.035);
    const u = this.siltMesh.material as THREE.ShaderMaterial;
    u.uniforms.uSilt.value = this.silt;
    this.siltMesh.visible = this.silt > 0.01;
    if (this.siltMesh.visible) {
      const r = 1.6 + 1.8 * (1 - Math.exp(-this.siltAge / 5)) + this.tear * 1.2;
      this.siltMesh.position.set(this.base.x - this.fall.x * 0.5, 0, this.base.z - this.fall.y * 0.5);
      this.siltMesh.scale.setScalar(r);
    }
    if (this.bubbling <= 0) return;
    this.bubbling -= dt;
    const left = Math.max(0, this.bubbling / tuning.crossings.tree.bubbleFor);
    const count = Math.floor(16 * left * Math.sqrt(left) * dt + Math.random());
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 1.1;
      const x = this.base.x + Math.cos(a) * r - this.fall.x * 0.45, z = this.base.z + Math.sin(a) * r - this.fall.y * 0.45;
      this.marks.add(RING, x, z, 0.04 + Math.random() * 0.06, 0.9 + Math.random() * 0.6, time, 0.5 + Math.random() * 0.4, 0.45);
      if (Math.random() < 0.35) this.spray.emit(DROP, x, 0.03, z, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3, 0.012 + Math.random() * 0.008, 0.6, 0, 0.6);
    }
  }

  /** Water pours off what comes up out of it, and drips for a while after. */
  private drip(dt: number, time: number): void {
    if (this.dripFor <= 0) return;
    this.dripFor -= dt;
    const rate = Math.min(1, this.dripFor / 2) * (this.state === 'falling' ? 90 : 26);
    const count = Math.floor(rate * dt + Math.random());
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * (PLATE_R - 0.3);
      const y = -0.05 - Math.random() * 0.25;
      const heel = THREE.MathUtils.smoothstep(-Math.sin(a) * r, -0.1, 0.9) * THREE.MathUtils.smoothstep(r, 0.3, 0.8);
      const p = this.group.localToWorld(this.tmp.set(Math.cos(a) * r, y + this.heave * heel * HEAVE, Math.sin(a) * r));
      if (p.y < 0.05) continue;
      this.spray.emit(DROP, p.x, p.y, p.z, (Math.random() - 0.5) * 0.4, -0.2, (Math.random() - 0.5) * 0.4, 0.02 + Math.random() * 0.018, 1.2, 0, 0.7);
      if (Math.random() < 0.08) this.spray.emit(SPLASH, p.x, p.y, p.z, 0, -0.5, 0, 0.06, 0.5, 0.2, 0.25);
    }
    if (Math.random() < dt * 3) this.marks.add(RING, this.base.x + (Math.random() - 0.5) * 1.6, this.base.z + (Math.random() - 0.5) * 1.6, 0.25, 1.8, time, 0.5, 1.1);
  }

  private pose(): void {
    const u = this.material.uniforms;
    this.group.position.copy(this.base);
    this.group.rotation.set(this.lean, this.yaw, this.side);
    this.group.updateMatrixWorld(true);
    const k = tuning.crossings.tree;
    const rest = k.restLean + this.loose * k.looseLean;
    /** Rocking, the top comes a beat after the foot; falling, it trails, whipping through as it lands. */
    u.uFlex.value = this.state === 'standing' ? THREE.MathUtils.clamp((this.press - (this.lean - rest)) * 0.25 - this.leanV * 0.04, -0.06, 0.06)
      : this.state === 'falling' ? -Math.min(0.1, this.leanV * 0.09) : 0;
    u.uShiver.value = this.shiver;
    u.uShudder.value = this.shudder * this.shudder;
    u.uSoak.value = this.soak;
    u.uHeave.value = this.heave;
  }
}

/**
 * Old bark in the flood: fissured, coming away to bleached dead wood, dark and slick below the line the water
 * stood at (`water` up from its foot). Its twigs shiver with `uShiver`.
 */
export function barkMaterial(height: number, water: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: TREE_VERT,
    fragmentShader: TREE_FRAG,
    uniforms: {
      ...atmo.uniforms,
      uShiver: { value: 0 }, uFlex: { value: 0 }, uShudder: { value: 0 }, uHeight: { value: height },
      uSpan: { value: new THREE.Vector2(0, 1) }, uWater: { value: water }, uSoak: { value: 0 }, uHeave: { value: 0 },
    },
    side: THREE.DoubleSide,
  });
}

function radiusAt(s: number, height: number): number {
  return THREE.MathUtils.lerp(R_FOOT, R_TOP, Math.pow(THREE.MathUtils.clamp(s / (height * SPINE), 0, 1), 0.8));
}

/**
 * The dead tree in its own frame, its foot at the origin and up along y: a long bole with the bark coming away,
 * stubs of limbs long broken off, a few bare limbs at the top with their twigs, and under the water the plate of
 * earth and roots it will tear up as it goes.
 */
function growDeadTree(height: number, seed: number, downLean: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const range = (a: number, b: number) => a + (b - a) * rand();
  const parts: THREE.BufferGeometry[] = [];
  const top = height * SPINE;
  const spine: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const y = -0.4 + (top + 0.4) * (i / 6);
    const wander = Math.sin(i * 1.3 + seed) * 0.12 * (i / 6);
    spine.push(new THREE.Vector3(wander, y, Math.cos(i * 0.9 + seed) * 0.06 * (i / 6) - 0.05 * (i / 6) ** 2));
  }
  parts.push(tube(spine, R_FOOT * 1.05, R_TOP, 11, BARK, 0, 0.12, 0.1, 0.45));
  const along = (y: number) => {
    const i = Math.min(5, Math.floor(((y + 0.4) / (top + 0.4)) * 6));
    const f = ((y + 0.4) / (top + 0.4)) * 6 - i;
    return spine[i].clone().lerp(spine[i + 1], f);
  };

  for (const [y, len] of [[height * 0.27, 0.45], [height * 0.41, 0.6], [height * 0.55, 0.38]] as const) {
    const a = range(0, Math.PI * 2);
    const from = along(y);
    const to = from.clone().add(new THREE.Vector3(Math.cos(a) * len, len * 0.55, Math.sin(a) * len));
    parts.push(tube([from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.04, 0)), to], 0.12, 0.06, 6, BARK, 0, 0.05, rand()));
  }

  const leader = [along(top), along(top).add(new THREE.Vector3(0.12, (height - top) * 0.55, -0.05)), new THREE.Vector3(0.2, height, 0.05)];
  parts.push(tube(leader, R_TOP, 0.035, 7, BARK, 0.12, 0.7, rand()));
  for (let i = 0; i < 4; i++) {
    const y = top * range(0.74, 0.97);
    const a = (i / 4) * Math.PI * 2 + range(-0.4, 0.4);
    const len = range(1.3, 2.1);
    const from = along(y);
    const lift = range(0.55, 0.9);
    const mid = from.clone().add(new THREE.Vector3(Math.cos(a) * len * 0.5, len * lift * 0.45, Math.sin(a) * len * 0.5));
    const tip = from.clone().add(new THREE.Vector3(Math.cos(a) * len, len * lift, Math.sin(a) * len));
    const phase = rand();
    parts.push(tube([from, mid, tip], 0.085, 0.03, 6, BARK, 0.15, 0.75, phase));
    for (let j = 0; j < 3; j++) {
      const at = from.clone().lerp(tip, range(0.45, 1));
      const b = a + range(-1.4, 1.4);
      const twig = range(0.45, 0.9);
      const end = at.clone().add(new THREE.Vector3(Math.cos(b) * twig, twig * range(0.2, 0.8), Math.sin(b) * twig));
      parts.push(tube([at, at.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.05, 0)), end], 0.026, 0.007, 4, BARK, 0.6, 1, phase + 0.3 * j));
    }
  }

  /** A flat plate of garden earth, ragged at the rim, thinning to its edge, with a little dome where the trunk stands. */
  const plate = new THREE.CylinderGeometry(PLATE_R, PLATE_R * 0.9, 1, 26, 1);
  const p = plate.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const a = Math.atan2(z, x), r = Math.hypot(x, z) / PLATE_R;
    const rag = 1 + 0.11 * Math.sin(a * 5 + 0.7) + 0.07 * Math.sin(a * 11 + 2.1) + 0.04 * Math.sin(a * 23);
    const lump = 0.03 * Math.sin(a * 7 + r * 5) + 0.02 * Math.sin(a * 13 - r * 9);
    const y = p.getY(i) > 0 ? 0.07 * (1 - r * r) + lump : -0.34 + 0.2 * r * r + lump;
    const k = r > 0.01 ? rag : 1;
    p.setXYZ(i, x * k, y, z * k);
  }
  plate.computeVertexNormals();
  parts.push(tagged(plate, EARTH, 0, 0));
  /** The trunk's flare going out into the earth as thick roots, knuckled along the top of the plate. */
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + range(-0.25, 0.25);
    const out = PLATE_R * range(0.78, 0.95);
    const c = Math.cos(a), sn = Math.sin(a);
    parts.push(tube([new THREE.Vector3(c * 0.22, 0.5, sn * 0.22), new THREE.Vector3(c * 0.5, 0.16, sn * 0.5),
      new THREE.Vector3(c * out * 0.75, 0.1, sn * out * 0.75), new THREE.Vector3(c * out, 0.0, sn * out)], range(0.15, 0.2), 0.05, 6, ROOT, 0, 0, rand()));
  }
  /** Short broken stubs where roots snapped off at the rim. */
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + range(-0.2, 0.2);
    const r0 = PLATE_R * 0.9, r1 = PLATE_R + range(0.15, 0.35);
    parts.push(tube([new THREE.Vector3(Math.cos(a) * r0, -0.08, Math.sin(a) * r0),
      new THREE.Vector3(Math.cos(a + 0.08) * r1, -0.14 - range(0, 0.08), Math.sin(a + 0.08) * r1)], range(0.05, 0.08), 0.03, 5, ROOT, 0, 0, rand()));
  }
  /**
   * Long thin roots out of the underside and the lower rim. They are laid out for the tree lying down, where the
   * plate stands on edge and they hang straight down off it; standing, they run out under the bed toward the fall.
   */
  const hang = new THREE.Vector3(0, -Math.cos(downLean), Math.sin(downLean));
  for (let i = 0; i < 18; i++) {
    const a = range(0, Math.PI * 2), r = PLATE_R * Math.sqrt(range(0.05, 0.95));
    const from = new THREE.Vector3(Math.cos(a) * r, -0.3 + 0.15 * (r / PLATE_R) ** 2, Math.sin(a) * r);
    const len = range(0.45, 1.25);
    const sway = new THREE.Vector3(range(-0.2, 0.2), 0, range(-0.1, 0.1));
    const mid = from.clone().addScaledVector(hang, len * 0.5).add(sway).addScaledVector(new THREE.Vector3(0, -1, 0), 0.06);
    const end = from.clone().addScaledVector(hang, len).add(sway.multiplyScalar(1.8));
    parts.push(tube([from, mid, end], range(0.03, 0.055), 0.006, 4, ROOT, 0, 0, rand()));
  }
  return merged(parts);
}
