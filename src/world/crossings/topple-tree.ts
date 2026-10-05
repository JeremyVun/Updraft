import * as THREE from 'three';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../atmosphere';
import { mulberry32 } from '../noise';
import { REFLECTION_LAYER } from '../water/reflection';
import type { Deck } from '../decks';
import type { PointerInput } from '../../input/pointer';
import type { WindField } from '../../wind/field';
import { Spray, DROP, MIST, SPLASH } from '../../fx/sealife/spray';
import { Marks, FOAM, RING } from '../../fx/sealife/marks';
import { BARK, EARTH, ROOT, merged, segmentGap, tagged, tube } from './shapes';

const TREE_VERT = /* glsl */ `
${ATMO_GLSL}
uniform float uShiver;
uniform float uFlex;
uniform float uShudder;
uniform float uHeight;
uniform vec2 uSpan;
in float aShake;
in float aKind;
in float aPhase;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vKind;
void main() {
  vec3 p = position;
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
  float gloss = 0.0;
  if (kind == ${EARTH}) {
    float lumps = vnoise(vLocal.xz * 3.1 + vLocal.y) * 0.6 + vnoise(vLocal.xz * 9.0) * 0.4;
    alb = mix(vec3(0.026, 0.02, 0.016), vec3(0.05, 0.04, 0.03), lumps);
    alb = mix(alb, vec3(0.035, 0.045, 0.025), smoothstep(0.62, 0.8, vnoise(vLocal.xz * 2.0 + 9.0)) * 0.6);
  } else if (kind == ${ROOT}) {
    alb = vec3(0.05, 0.038, 0.028) * (0.8 + 0.4 * vnoise(vLocal.xz * 7.0 + vLocal.y * 3.0));
  } else {
    float fissures = smoothstep(0.35, 0.75, vnoise(vec2(around * 4.0, vLocal.y * 0.8)) * 0.7 + vnoise(vec2(around * 12.0, vLocal.y * 3.0)) * 0.3);
    alb = mix(vec3(0.04, 0.034, 0.03), vec3(0.1, 0.086, 0.072), fissures);
    /** Where the bark has fallen away the dead wood shows through, bleached silver by the weather. */
    float bare = smoothstep(0.56, 0.68, vnoise(vec2(around * 1.6, vLocal.y * 0.32) + 4.0));
    float grain = vnoise(vec2(around * 26.0, vLocal.y * 1.4));
    alb = mix(alb, vec3(0.19, 0.18, 0.165) * (0.8 + 0.35 * grain), bare * 0.85);
    alb = mix(alb, vec3(0.05, 0.075, 0.035), smoothstep(0.66, 0.82, vnoise(vLocal.xy * vec2(2.0, 0.6) + 2.0)) * 0.5);
  }
  /** What stood in the flood is dark, green and slick, with the tide mark the water kept washing. */
  float under = 1.0 - smoothstep(-0.1, 0.35, vLocal.y - uWater);
  alb = mix(alb, alb * vec3(0.32, 0.4, 0.3), under * 0.9);
  alb += vec3(0.02, 0.024, 0.014) * (1.0 - smoothstep(0.0, 0.18, abs(vLocal.y - uWater - 0.35)));
  /** Torn up out of it, everything that was under is running wet. */
  float wet = under * uSoak;
  alb *= 1.0 - 0.35 * wet;
  gloss = 0.04 + 0.16 * wet;

  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  vec3 col = alb * (hemiLight(n) + uSunColor * mix(ndl, wrap * wrap, 0.2) * sun);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.5);
  col += uSunColor * rim * sun * (kind == ${EARTH} ? 0.04 : 0.14);
  /** A wet sheen, broken up: earth and roots running with water glint in places, never all over. */
  float sheen = pow(max(dot(reflect(-uSunDir, n), V), 0.0), 40.0) * smoothstep(0.45, 0.8, vnoise(vLocal.xz * 6.0 + vLocal.y * 4.0));
  col += uSunColor * sheen * sun * gloss;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
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

export type TreeEvent = 'creak' | 'tear' | 'impact';

const SPINE = 0.86;
const R_FOOT = 0.4;
const R_TOP = 0.13;

/**
 * A dead tree rotted at its roots, standing in a flooded garden beside a gap. Strokes across it on screen rock it
 * a beat late and it springs back, creaking, its twigs shivering; strokes toward the gap loosen its roots, and a firm
 * push takes it past the point where its own weight wins. Then it goes, slowly and then faster, tearing its roots up
 * out of the bed, and comes down across the gap, where its trunk is a deck to walk over.
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
  /** How far the rotten roots have given, 0 to 1: it stays given, ebbing only slowly. */
  loose = 0;
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
    const mesh = new THREE.Mesh(growDeadTree(this.height, spot.seed ?? 4417), this.material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.group.rotation.order = 'YXZ';
    this.spray = new Spray(wind);
    this.objects = [this.group, this.spray.mesh, this.marks.mesh];
    for (const o of this.objects) o.layers.enable(REFLECTION_LAYER);
    this.reset();
  }

  reset(): void {
    this.state = 'standing';
    this.lean = tuning.crossings.tree.restLean;
    this.leanV = this.side = this.sideV = this.press = this.incoming = this.sideIncoming = 0;
    this.loose = this.tear = this.soak = this.shudder = this.shiver = this.dripFor = 0;
    this.sinceDown = 0;
    this.base.copy(this.spot.root);
    this.pose();
  }

  get down(): boolean {
    return this.state === 'down';
  }

  /** How near it is to going over, 0 to 1: what counts as progress. */
  get progress(): number {
    if (this.state !== 'standing') return 1;
    const k = tuning.crossings.tree;
    return Math.max(this.loose * 0.7, (this.lean - k.restLean) / (k.tipAt - k.restLean) * 0.9);
  }

  /** A point a share of the way up the standing trunk, in the world. */
  trunkAt(share: number, out: THREE.Vector3): THREE.Vector3 {
    return this.group.localToWorld(out.set(0, this.height * share, 0));
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
      this.leanV += (-k.stiffness * (this.lean - rest - this.press) - k.damping * this.leanV) * dt;
      this.lean += this.leanV * dt;
      const over = this.lean - rest - k.loosenFrom;
      if (over > 0) this.loose = Math.min(1, this.loose + over * k.loosenRate * dt);
      this.loose = Math.max(0, this.loose - k.ebb * dt);
      if (this.lastLeanV * this.leanV < 0 && Math.abs(this.lean - rest) > 0.035) {
        const strength = Math.min(1, Math.abs(this.lean - rest) * 6);
        this.onEvent?.('creak', this.trunkAt(0.3, this.tmp), strength);
        this.ring(0.6 * strength, time);
      }
      if (this.lean > k.tipAt) {
        /** However hard the push, the roots hold it a moment before it goes. */
        this.state = 'falling';
        this.leanV = THREE.MathUtils.clamp(this.leanV, 0.1, 0.16);
      }
    } else if (this.state === 'falling') {
      const torn = THREE.MathUtils.clamp((this.lean - k.tipAt) / k.tearOver, 0, 1);
      const hold = THREE.MathUtils.lerp(k.tearHold, 1, THREE.MathUtils.smoothstep(torn, 0.2, 1));
      this.leanV += k.fallPull * Math.sin(this.lean) * hold * dt;
      this.lean += this.leanV * dt;
      if (this.tear === 0 && torn > 0.15) this.tearUp(time);
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
      const torn = THREE.MathUtils.clamp((this.lean - k.tipAt) / (this.downLean - k.tipAt), 0, 1);
      this.tear = Math.max(this.tear, torn);
      const heave = THREE.MathUtils.smootherstep(this.tear, 0.05, 1);
      this.base.lerpVectors(this.spot.root, this.baseDown, heave);
      this.soak = Math.max(this.soak, heave);
    }
    this.soak = Math.max(0, this.soak - dt * 0.01);
    this.shudder = Math.max(0, this.shudder - dt / k.shudderFor);
    const motion = Math.abs(this.leanV) + Math.abs(this.sideV);
    this.shiver += (Math.min(1.4, motion * 3 + this.shudder * 1.5) - this.shiver) * (1 - Math.exp(-dt * 5));
    this.drip(dt, time);
    this.pose();
    this.spray.update(dt);
    this.marks.update(time);
  }

  private tearUp(time: number): void {
    this.tear = 0.001;
    this.dripFor = 4.5;
    const at = this.spot.root;
    this.onEvent?.('tear', this.tmp.set(at.x, 0, at.z), 1);
    this.spray.splash(at.x, at.z, 1.3, 0.9);
    this.marks.add(FOAM, at.x, at.z, 1.4, 4, time, 0.9, 0.6);
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
    this.spray.splash(root.x, root.z, 1.6, 1);
    this.marks.add(FOAM, root.x, root.z, 1.8, 5, time, 1, 0.5);
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
    const at = this.trunkAt(Math.min(0.9, -this.spot.root.y / this.height), this.tmp);
    this.marks.add(RING, at.x, at.z, 0.45, 2.4, time, strength, 1.4);
    if (this.loose > 0.25) this.spray.plip(at.x, at.z, 0.3 * this.loose);
  }

  /** The root plate pours as it comes up out of the water, and drips for a while after. */
  private drip(dt: number, time: number): void {
    if (this.dripFor <= 0) return;
    this.dripFor -= dt;
    const rate = Math.min(1, this.dripFor / 2) * (this.state === 'falling' ? 90 : 26);
    const count = Math.floor(rate * dt + Math.random());
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 1.0;
      const p = this.group.localToWorld(this.tmp.set(Math.cos(a) * r, -0.35 - Math.random() * 0.3, Math.sin(a) * r));
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
      uSpan: { value: new THREE.Vector2(0, 1) }, uWater: { value: water }, uSoak: { value: 0 },
    },
    side: THREE.DoubleSide,
  });
}

function radiusAt(s: number, height: number): number {
  return THREE.MathUtils.lerp(R_FOOT, R_TOP, Math.pow(THREE.MathUtils.clamp(s / (height * SPINE), 0, 1), 0.8));
}

/**
 * The dead tree in its own frame, its foot at the origin and up along y: a long bole with the bark coming away,
 * stubs of limbs long broken off, a few bare limbs at the top with their twigs, and under the bed the plate of
 * earth and roots it will tear up as it goes.
 */
function growDeadTree(height: number, seed: number): THREE.BufferGeometry {
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

  /** A torn plate of earth: flat, ragged at the rim, roots out of its edge and hanging from its underside. */
  const plate = new THREE.CylinderGeometry(1.25, 0.95, 0.55, 18, 2);
  const p = plate.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const rag = 1 + 0.16 * Math.sin(a * 5 + 0.7) + 0.09 * Math.sin(a * 11 + 2.1) + 0.05 * Math.sin(a * 23);
    const r = Math.hypot(x, z) > 0.01 ? rag : 1;
    p.setXYZ(i, x * r, y - 0.32 + 0.08 * Math.sin(a * 7) * (y < 0 ? 1 : 0.3), z * r);
  }
  plate.computeVertexNormals();
  parts.push(tagged(plate, EARTH, 0, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + range(-0.15, 0.15);
    const reach = range(1.3, 2.2);
    const from = new THREE.Vector3(Math.cos(a) * 0.3, -0.08, Math.sin(a) * 0.3);
    const mid = new THREE.Vector3(Math.cos(a) * reach * 0.6, -0.2 - range(0, 0.15), Math.sin(a) * reach * 0.6);
    const b = a + range(-0.35, 0.35);
    const end = new THREE.Vector3(Math.cos(b) * reach, -0.35 - range(0, 0.5), Math.sin(b) * reach);
    parts.push(tube([from, mid, end], range(0.1, 0.17), 0.02, 5, ROOT, 0, 0.2, rand()));
  }
  for (let i = 0; i < 12; i++) {
    const a = range(0, Math.PI * 2), r = range(0.15, 1.0);
    const from = new THREE.Vector3(Math.cos(a) * r, -0.58, Math.sin(a) * r);
    const end = from.clone().add(new THREE.Vector3(range(-0.35, 0.35), -range(0.35, 0.9), range(-0.35, 0.35)));
    parts.push(tube([from, from.clone().lerp(end, 0.5).add(new THREE.Vector3(range(-0.1, 0.1), 0, range(-0.1, 0.1))), end],
      range(0.04, 0.08), 0.01, 4, ROOT, 0.05, 0.4, rand()));
  }
  return merged(parts);
}
