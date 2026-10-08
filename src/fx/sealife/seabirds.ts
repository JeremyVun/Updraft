import * as THREE from 'three';
import { CREATURE_GLSL } from '../../creatures/shading';
import {
  BEAK, BILL, EYE, EYE_MAT, GULL_LOOK, HEAD, INNER_L, INNER_R, INNER_SPAN, OUTER_L, OUTER_R, SHOULDER, TAIL, WHITE, WING,
  gullGeometry,
} from '../../creatures/gulls';
import { ease, wrapAngle } from '../../creatures/motion';
import { Instances, blob, merge, mirrored, type BlobSpec } from '../../creatures/shapes';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { mulberry32 } from '../../world/noise';
import { ringPoint } from './anatomy';
import type { WhaleRig } from './whale';
import { HAZE_GLSL } from './whaleShader';

const K = tuning.netWhale;
const FOLDED_L = 9;
const FOLDED_R = 10;
const LEG = 11;
/** From the body's middle down to its feet, in the gull's own units. */
const STANDS = 0.3;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uSize;
in float aPart;
in vec2 aMat;
in vec4 iPos;
in vec4 iAtt;
in vec4 iWing;
in vec4 iFade;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out float vUnder;
out vec2 vFade;

void main() {
  int part = int(aPart + 0.5);
  vec3 p = position;
  vec3 n = normal;
  vUnder = 1.0 - smoothstep(-0.4, 0.1, normal.y);
  float fold = iAtt.z;
  float side = (part == ${INNER_L} || part == ${OUTER_L} || part == ${FOLDED_L}) ? 1.0 : -1.0;
  vec3 shoulder = vec3(${SHOULDER[0]} * side, ${SHOULDER[1]}, ${SHOULDER[2]});
  bool outer = part == ${OUTER_L} || part == ${OUTER_R};
  bool inner = part == ${INNER_L} || part == ${INNER_R};
  if (inner || outer) {
    vec3 wrist = shoulder + vec3(${INNER_SPAN} * side, 0.0, -0.02);
    float sweep = iWing.z;
    if (outer) {
      p -= wrist;
      p = rotY(rotZ(p, side * iWing.y), side * sweep * 0.9);
      n = rotY(rotZ(n, side * iWing.y), side * sweep * 0.9);
      p += wrist;
    }
    p -= shoulder;
    p = rotY(rotZ(p, side * iWing.x), side * sweep * 0.35);
    n = rotY(rotZ(n, side * iWing.x), side * sweep * 0.35);
    // Standing, the open wing is drawn in to the shoulder and the folded one lies along its side instead.
    p = shoulder + p * (1.0 - fold);
  }
  if (part == ${FOLDED_L} || part == ${FOLDED_R}) p = shoulder + (p - shoulder) * fold;
  if (part == ${LEG}) p.y = -0.08 + (p.y + 0.08) * fold;
  if (part == ${HEAD} || part == ${BEAK} || part == ${EYE}) {
    vec3 neck = vec3(0.0, 0.06, 0.3);
    p -= neck;
    p = rotY(p, iWing.w);
    n = rotY(n, iWing.w);
    p += neck + vec3(0.0, 0.07, -0.05) * fold;
  }
  if (part == ${TAIL}) p.x *= 1.0 + max(-iAtt.x, 0.0) * 1.2;
  p = rotZ(rotX(p, iAtt.x), iAtt.y);
  n = rotZ(rotX(n, iAtt.x), iAtt.y);
  vec3 world = rotY(p * uSize, iPos.w) + iPos.xyz;
  vWorld = world;
  vNormal = rotY(n, iPos.w);
  vMat = aMat;
  vFade = iFade.xy;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${HAZE_GLSL}
uniform vec3 uWhite;
uniform vec3 uMantle;
uniform vec3 uTip;
uniform vec3 uBill;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in float vUnder;
in vec2 vFade;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  int mat = int(vMat.x + 0.5);
  vec3 alb = uWhite;
  float thin = 0.25;
  float fuzz = 0.7;
  if (mat == ${BILL}) { alb = uBill; thin = 0.0; }
  else if (mat == ${EYE_MAT}) { alb = vec3(0.02); fuzz = 0.0; thin = 0.0; }
  else if (mat == ${WING}) {
    float s = vMat.y;
    alb = mix(uMantle, uWhite * 0.92, vUnder * 0.85);
    alb = mix(alb, uTip, smoothstep(0.72, 0.8, s) * (1.0 - vUnder * 0.35));
    thin = 0.8;
  } else if (mat == ${WHITE} && vMat.y > 0.0) {
    alb = mix(uWhite, uMantle, vMat.y);
  }
  vec3 col = shadeCreature(alb, N, vWorld, 1.0, fuzz, thin, 1.0);
  // Standing on its back they melt into the morning as it does; flown far off, into the sky behind them.
  col = hazed(col, vWorld, vFade.x, 0.0);
  col = mix(col, skyColor(normalize(vWorld - cameraPosition)), vFade.y);
  gl_FragColor = vec4(col, 1.0);
}`;

function seabirdGeometry(): THREE.BufferGeometry {
  const folded: BlobSpec = {
    part: FOLDED_L,
    mat: WING,
    at: [SHOULDER[0] + 0.01, SHOULDER[1], SHOULDER[2]],
    offset: [0, 0, -0.3],
    size: [0.045, 0.085, 0.4],
    rot: [-0.08, 0.07, 0],
    blend: (u) => 0.45 - 0.55 * u.z,
  };
  const leg: BlobSpec = { part: LEG, mat: BILL, at: [0.05, -0.2, 0.03], size: [0.017, 0.1, 0.017], detail: 1 };
  return merge([gullGeometry(), ...[folded, mirrored(folded, FOLDED_R), leg, mirrored(leg, LEG)].map(blob)]);
}

interface Bird {
  /** Where it stands on the back: along it (s), round from the top of its ring (radians), and facing (radians from its heading). */
  s: number;
  round: number;
  facing: number;
  /** Seconds after the free spout when it goes up. */
  liftAt: number;
  rand: () => number;
  yaw: number;
  turn: number;
  headYaw: number;
  headGoal: number;
  nextLook: number;
  nextTurn: number;
  stretch: number;
  nextStretch: number;
  /** Its way up and off, laid as it goes, and seconds along it. */
  way: THREE.Vector3[] | null;
  flown: number;
  flapPhase: number;
  flapAmp: number;
  bank: number;
  pitch: number;
  gone: boolean;
}

/**
 * A few seabirds standing far along the whale's back as on a rock, riding its breath. They turn their heads, shift
 * their feet and now and then stretch their wings; as it spouts free they go up off it together, wheel past the spout
 * and away into the morning, gone before it dives.
 */
export class Seabirds {
  readonly mesh: THREE.Mesh;
  /** The first of them going up, so it can be heard. */
  onLift: ((at: THREE.Vector3) => void) | null = null;
  private readonly instances: Instances;
  private readonly birds: Bird[];
  private readonly at = new THREE.Vector3();
  private readonly ring = { x: 0, y: 0 };
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private lifted = false;

  constructor(haze: { uHaze: { value: number }; uLost: { value: number } }) {
    const perches = K.seabirdPerches;
    this.instances = new Instances(seabirdGeometry(), perches.length, ['iPos', 'iAtt', 'iWing', 'iFade']);
    this.mesh = new THREE.Mesh(
      this.instances.geometry,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          ...atmo.uniforms,
          uHaze: haze.uHaze,
          uLost: haze.uLost,
          uSize: { value: K.seabirdSize },
          uWhite: { value: new THREE.Color(GULL_LOOK.white) },
          uMantle: { value: new THREE.Color(GULL_LOOK.mantle) },
          uTip: { value: new THREE.Color(GULL_LOOK.tip) },
          uBill: { value: new THREE.Color(GULL_LOOK.bill) },
        },
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.birds = perches.map(([s, round, facing], i) => {
      const rand = mulberry32(17 + i * 101);
      return {
        s, round, facing, liftAt: 0, rand, yaw: 0, turn: 0, headYaw: 0, headGoal: 0, nextLook: 0, nextTurn: 0, stretch: -1,
        nextStretch: 0, way: null, flown: 0, flapPhase: 0, flapAmp: 0, bank: 0, pitch: 0, gone: false,
      };
    });
  }

  /** Stood on its back again, as it lies resting. */
  settle(): void {
    this.lifted = false;
    this.birds.forEach((b, i) => {
      const r = b.rand;
      b.liftAt = K.seabirdsAfter + i * 0.2 + r() * 0.25;
      b.turn = 0;
      b.headYaw = b.headGoal = 0;
      b.nextLook = 0.5 + r() * 3;
      b.nextTurn = 6 + r() * 14;
      b.stretch = -1;
      b.nextStretch = 12 + r() * 30;
      b.way = null;
      b.flapAmp = b.bank = b.pitch = 0;
      b.gone = false;
    });
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  /**
   * `spout` is seconds since its free spout (negative before it); `blowhole` where the spout stands and `away` the way
   * from the boat across it, toward the low sun.
   */
  update(dt: number, whale: WhaleRig, spout: number, blowhole: THREE.Vector3, away: THREE.Vector3): void {
    if (!this.mesh.visible) return;
    const h = whale.heading;
    let shown = 0;
    for (const b of this.birds) {
      if (b.gone) continue;
      if (!b.way) {
        this.stand(b, dt, whale);
        if (spout >= b.liftAt) this.layWay(b, blowhole, away, h);
      }
      const fade = b.way ? this.fly(b, dt, spout - b.liftAt) : 0;
      if (fade >= 1) {
        b.gone = true;
        continue;
      }
      const crouch = b.way ? 0 : THREE.MathUtils.smoothstep(spout, b.liftAt - 0.3, b.liftAt);
      this.write(shown++, b, crouch, fade);
    }
    this.instances.commit(shown);
    if (shown === 0 && spout > 0) this.mesh.visible = false;
  }

  /** Standing on its perch on the back, which rises and settles with each breath. */
  private stand(b: Bird, dt: number, whale: WhaleRig): void {
    const r = b.rand;
    ringPoint(b.s, b.round, this.ring);
    whale.point(this.ring.x, this.ring.y, b.s, this.at);
    this.at.y += STANDS * K.seabirdSize;
    b.nextLook -= dt;
    if (b.nextLook <= 0) {
      b.nextLook = 1.2 + r() * 3.8;
      b.headGoal = (r() - 0.5) * 1.6;
    }
    b.headYaw = ease(b.headYaw, b.headGoal, 5, dt);
    b.nextTurn -= dt;
    if (b.nextTurn <= 0) {
      b.nextTurn = 8 + r() * 14;
      b.turn = THREE.MathUtils.clamp(b.turn + (r() - 0.5) * 1.4, -0.8, 0.8);
    }
    const yaw = Math.atan2(whale.heading.x, whale.heading.z) + b.facing + b.turn;
    b.yaw += wrapAngle(yaw - b.yaw) * (1 - Math.exp(-dt * 2.5));
    b.nextStretch -= dt;
    if (b.nextStretch <= 0 && b.stretch < 0) {
      b.stretch = 0;
      b.nextStretch = 25 + r() * 30;
    }
    if (b.stretch >= 0) b.stretch += dt;
    if (b.stretch > K.seabirdStretch) b.stretch = -1;
  }

  /** Up off the back: a few hard strokes clear of it, round past its spout and away into the morning. */
  private layWay(b: Bird, blowhole: THREE.Vector3, away: THREE.Vector3, h: THREE.Vector3): void {
    const r = b.rand;
    const from = this.at.clone();
    const up = from.clone().addScaledVector(h, 2 + r() * 2).addScaledVector(away, 1 + r() * 2);
    up.y += 5 + r() * 2;
    const past = blowhole.clone().addScaledVector(away, K.seabirdPast + r() * 6).addScaledVector(h, (r() - 0.5) * 8);
    past.y = blowhole.y + K.seabirdHeight + r() * 4;
    const off = past.clone().addScaledVector(away, 40 + r() * 15).addScaledVector(h, 6 + r() * 10);
    off.y += 14 + r() * 6;
    b.way = [from, up, past, off];
    b.flapPhase = r() * 6;
    if (!this.lifted) {
      this.lifted = true;
      this.onLift?.(from);
    }
  }

  /** Its way at `t` seconds since it went up; how far it has faded into the sky. */
  private fly(b: Bird, dt: number, t: number): number {
    b.flown = t;
    const k = Math.min(1, t / K.seabirdFlight);
    // Slow off the back, then steady.
    const u = k * k * (2 - k);
    const [p0, p1, p2, p3] = b.way!;
    bezier(p0, p1, p2, p3, u, this.at);
    bezier(p0, p1, p2, p3, Math.min(1, u + 0.01), this.a);
    this.b.subVectors(this.a, this.at);
    if (k >= 1) this.b.subVectors(p3, p2);
    const yaw = Math.atan2(this.b.x, this.b.z);
    const turning = wrapAngle(yaw - b.yaw);
    b.yaw += turning * (1 - Math.exp(-dt * (t < 0.6 ? 3 : 5)));
    b.bank = ease(b.bank, THREE.MathUtils.clamp(-turning * 2.5, -0.6, 0.6), 2.5, dt);
    const climb = Math.atan2(this.b.y, Math.hypot(this.b.x, this.b.z));
    b.pitch = ease(b.pitch, THREE.MathUtils.clamp(-climb * 0.7, -0.5, 0.25), 3, dt);
    // Hard strokes off the back, then the long glides of a gull with a few strokes between.
    const flapping = t < 2.2 || Math.sin(t * 0.9 + b.liftAt * 7) > 0.35;
    b.flapAmp = ease(b.flapAmp, flapping ? 1 : 0, 4, dt);
    b.flapPhase += dt * Math.PI * 2 * (t < 2.2 ? 2.6 : 2.1) * (flapping ? 1 : b.flapAmp);
    if (k >= 1) this.at.addScaledVector(this.b.normalize(), (t - K.seabirdFlight) * 9);
    return THREE.MathUtils.smoothstep(t, K.seabirdFlight - K.seabirdFade, K.seabirdFlight);
  }

  private write(i: number, b: Bird, crouch: number, fade: number): void {
    const flying = b.way !== null;
    const unfold = 1 - THREE.MathUtils.smoothstep(b.flown, 0, 0.3);
    const stretch = b.stretch < 0 ? 0 : Math.sin(Math.PI * Math.min(1, b.stretch / K.seabirdStretch)) ** 0.7;
    const fold = flying ? unfold : 1 - 0.6 * stretch;
    const beat = Math.sin(b.flapPhase);
    const inner = flying ? 0.12 + beat * 0.55 * b.flapAmp : 1.1 * stretch;
    const outer = flying ? -0.2 + Math.sin(b.flapPhase - 0.7) * 0.45 * b.flapAmp : 0.3 * stretch;
    this.instances.set(0, i, this.at.x, this.at.y - crouch * 0.06 * K.seabirdSize, this.at.z, b.yaw);
    this.instances.set(1, i, flying ? b.pitch : -0.08 + 0.18 * crouch, flying ? b.bank : 0, fold, 0);
    this.instances.set(2, i, inner, outer, flying ? 0.1 : 0, flying ? 0 : b.headYaw);
    this.instances.set(3, i, b.s, fade, 0, 0);
  }
}

/** A point `t` of the way along the cubic from `a` to `d` drawn toward `b` and `c`. */
function bezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  return out.copy(a).multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
}
