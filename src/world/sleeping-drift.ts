import * as THREE from 'three';
import { ATMO_GLSL, NOISE_GRAD_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { SLEEP_PATH, SLEEP_DRIFT_STOP } from './sleeping-layout';
import { mulberry32 } from './noise';
import { glsl, tuning } from '../tuning';

const T = tuning.sleeping;
const point = (i: number) => new THREE.Vector3(SLEEP_PATH[i][0], heightAt(SLEEP_PATH[i][0], SLEEP_PATH[i][1]), SLEEP_PATH[i][1]);
/** The point `metres` further up the route from waypoint `from`, on the ground. */
export function alongRoute(from: number, metres: number): THREE.Vector3 {
  const at = point(from);
  for (let i = from + 1; i < SLEEP_PATH.length; i++) {
    const next = point(i), step = Math.hypot(next.x - at.x, next.z - at.z);
    if (step >= metres) { at.lerp(next, metres / step); break; }
    metres -= step;
    at.copy(next);
  }
  at.y = heightAt(at.x, at.z);
  return at;
}
const FORWARD = point(SLEEP_DRIFT_STOP + 1).sub(point(SLEEP_DRIFT_STOP)).setY(0).normalize();
const RIGHT = new THREE.Vector3(-FORWARD.z, 0, FORWARD.x);
/**
 * The drift packed into the notch a few paces above where the bird stops, banked against the outcrop and carried
 * across the way to a cornice over the drop, far enough that the swept channel keeps a bank on either side.
 */
export const SNOW_AT = alongRoute(SLEEP_DRIFT_STOP, 3.85).addScaledVector(RIGHT, -0.7);
SNOW_AT.y = heightAt(SNOW_AT.x, SNOW_AT.z);

/** Across the way (toward the drop) and along it (uphill), metres from the drift's middle. */
const toLocal = (x: number, z: number): [number, number] => {
  const dx = x - SNOW_AT.x, dz = z - SNOW_AT.z;
  return [dx * RIGHT.x + dz * RIGHT.z, dx * FORWARD.x + dz * FORWARD.z];
};
/** The ground the drift may cover, metres from SNOW_AT: left to right, near to far. */
const LEFT = -3.75, RIGHTMOST = 4, NEAR = -3.9, FAR = 4.4;
const WIDE = RIGHTMOST - LEFT, DEEP = FAR - NEAR;
/** How far the swept channel's floor and its bank tops move out from the path; the wide gap keeps the banks rounded. */
const CHANNEL_WIDEN = .45, CHANNEL_SOFTEN = .9;
/** The route through the drift, rounded at its bends so the channel's banks have no creases. */
const ROUTE = SLEEP_PATH.slice(SLEEP_DRIFT_STOP - 1, SLEEP_DRIFT_STOP + 4).map(([x, z]) => toLocal(x, z));
const ROUTE_ROUND = .6;
const PRINTS = 28;
const SOURCES = 16, PER_SOURCE = 44, KICKS = 40;

const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const smin = (a: number, b: number, k: number) => { const h = Math.min(1, Math.max(0, .5 + .5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
const segment = (u: number, v: number, au: number, av: number, bu: number, bv: number) => {
  const eu = bu - au, ev = bv - av, t = Math.min(1, Math.max(0, ((u - au) * eu + (v - av) * ev) / (eu * eu + ev * ev + 1e-9)));
  return Math.hypot(u - au - eu * t, v - av - ev * t);
};

/*
 * One drift, written twice: here for the walking, the brush and the checks, and in DRIFT_GLSL for the drawing.
 * Keep them in step. The wind comes over the outcrop from the left: it scours a shallow trough, cuts the long
 * windward slope into sastrugi and builds a crest that breaks off steeply over the drop as a lee face.
 * The outline is a rounded square, so no corner peaks, with a long wading ramp all round and pulled back on the near
 * right, where the lens passes on the way out.
 */
function rimAt(u: number, v: number): number {
  const bu = u + .3 * Math.sin(v * 1.2), bv = v + .2 * Math.sin(u * .9 + .5);
  const qu = bu / (bu < 0 ? 3.4 : 5), qv = bv / (bv < 0 ? 3.7 : 4.3);
  const r = (qu ** 4 + qv ** 4) ** .25 + .04 * Math.sin(u * 2.1 + v * .7) * Math.sin(v * 2.6 - u * 1.3 + 1.1)
    + .4 * ss(.3, 2.6, u) * (1 - ss(-3, 2.2, v));
  return ss(0, .62, 1 - r) ** 1.5;
}
const crestLine = (v: number) => 2.3 + .25 * v + .2 * Math.sin(v * 1.3 + .4);
const crestHeight = (v: number) => ss(-1, 2.8, v) * (1 - .4 * ss(2.8, 4, v));
function bodyAt(u: number, v: number): number {
  const uc = crestLine(v), wind = ss(-3.6, uc, u), lee = 1 - ss(uc - .05, uc + .5, u);
  const outcrop = .1 * Math.exp(-((u + 2.4) ** 2)) * ss(-3.3, -1, v) * (1 - ss(1, 3, v));
  const scoop = .14 * Math.exp(-((u - .1) ** 2) / .8) * ss(-2.5, 0, v);
  return Math.max(0, (.44 + .56 * wind * wind * wind * crestHeight(v) + outcrop - scoop) * lee);
}
function routeDistance(u: number, v: number): number {
  let d = 1e3;
  for (let i = 1; i < ROUTE.length; i++) d = smin(d, segment(u, v, ROUTE[i - 1][0], ROUTE[i - 1][1], ROUTE[i][0], ROUTE[i][1]), ROUTE_ROUND);
  return d;
}

const DRIFT_GLSL = /* glsl */ `
uniform float uSwept, uThaw, uTrenchOn;
uniform vec4 uTrench;
float ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0.0, 1.0); return b + (a - b) * h - k * h * (1.0 - h); }
float segment(vec2 p, vec2 a, vec2 b) { vec2 e = b - a; float t = clamp(dot(p - a, e) / (dot(e, e) + 1e-9), 0.0, 1.0); return length(p - a - e * t); }
float rimAt(vec2 p) {
  vec2 b = p + vec2(.3 * sin(p.y * 1.2), .2 * sin(p.x * .9 + .5));
  vec2 q = b / vec2(b.x < 0.0 ? 3.4 : 5.0, b.y < 0.0 ? 3.7 : 4.3);
  q *= q;
  float r = pow(dot(q, q), .25) + .04 * sin(p.x * 2.1 + p.y * .7) * sin(p.y * 2.6 - p.x * 1.3 + 1.1)
    + .4 * ss(.3, 2.6, p.x) * (1.0 - ss(-3.0, 2.2, p.y));
  return pow(ss(0.0, .62, 1.0 - r), 1.5);
}
float crestLine(float v) { return 2.3 + .25 * v + .2 * sin(v * 1.3 + .4); }
float crestHeight(float v) { return ss(-1.0, 2.8, v) * (1.0 - .4 * ss(2.8, 4.0, v)); }
float bodyAt(vec2 p) {
  float uc = crestLine(p.y), wind = ss(-3.6, uc, p.x), lee = 1.0 - ss(uc - .05, uc + .5, p.x);
  float outcrop = .1 * exp(-(p.x + 2.4) * (p.x + 2.4)) * ss(-3.3, -1.0, p.y) * (1.0 - ss(1.0, 3.0, p.y));
  float scoop = .14 * exp(-(p.x - .1) * (p.x - .1) / .8) * ss(-2.5, 0.0, p.y);
  return max(0.0, (.44 + .56 * wind * wind * wind * crestHeight(p.y) + outcrop - scoop) * lee);
}
float routeDistance(vec2 p) {
  float d = 1e3;
  ${ROUTE.slice(1).map((b, i) => `d = smin(d, segment(p, vec2(${glsl(ROUTE[i][0])}, ${glsl(ROUTE[i][1])}), vec2(${glsl(b[0])}, ${glsl(b[1])})), ${glsl(ROUTE_ROUND)});`).join('\n  ')}
  return d;
}
float origAt(vec2 p) {
  float orig = ${glsl(T.snowDepth)} * rimAt(p) * bodyAt(p);
  float t = segment(p, uTrench.xy, uTrench.zw);
  float lip = (t - .25) / .07;
  return orig * (1.0 - .55 * (1.0 - ss(.08, .2, t)) * uTrenchOn) + .03 * exp(-lip * lip) * uTrenchOn * ss(.05, .3, orig);
}
/** The drift's depth before and after the sweeping. */
vec2 driftAt(vec2 p) {
  float orig = origAt(p);
  float channel = 1.0 - ss(.55 + uSwept * ${glsl(CHANNEL_WIDEN)}, 1.25 + uSwept * ${glsl(CHANNEL_SOFTEN)}, routeDistance(p));
  float skin = ${glsl(T.driftSkin)} * uSwept * channel * ss(.08, .35, orig);
  return vec2(orig, max(orig * (1.0 - uSwept * channel), skin) * (1.0 - uThaw));
}
/** How far the top of the lee face leans out over the drop: the cornice, broken where the channel goes through. */
float curlAt(vec2 p, vec2 depth) {
  float uc = crestLine(p.y), lee = 1.0 - ss(uc - .05, uc + .5, p.x);
  return ${glsl(T.driftCornice)} * crestHeight(p.y) * ss(uc - .3, uc + .05, p.x) * ss(.5, .95, lee) * depth.y / max(depth.x, .02);
}
`;

const VERT = /* glsl */ `
${DRIFT_GLSL}
uniform vec3 uRight, uForward;
out vec3 vWorld; out vec3 vNormal; out vec2 vLocal; out vec2 vDepth;
vec3 drawn(vec2 p, vec2 slope) {
  vec2 d = driftAt(p);
  return vec3(p.x + curlAt(p, d), d.y + dot(slope, p), p.y);
}
void main() {
  vec2 p = vec2(${glsl(LEFT)}, ${glsl(NEAR)}) + uv * vec2(${glsl(WIDE)}, ${glsl(DEEP)});
  vDepth = driftAt(p); vLocal = p;
  vec3 g = normal.y < 0.0 ? -normal : normal;
  vec2 slope = -vec2(dot(g, uRight), dot(g, uForward)) / max(g.y, .2);
  float e = .04;
  vec3 du = drawn(p + vec2(e, 0), slope) - drawn(p - vec2(e, 0), slope);
  vec3 dv = drawn(p + vec2(0, e), slope) - drawn(p - vec2(0, e), slope);
  vec3 tu = uRight * du.x + vec3(0, du.y, 0) + uForward * du.z;
  vec3 tv = uRight * dv.x + vec3(0, dv.y, 0) + uForward * dv.z;
  vNormal = normalize(cross(tu, tv));
  vWorld = position + uRight * curlAt(p, vDepth) + vec3(0, vDepth.y, 0);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${NOISE_GRAD_GLSL}
uniform float uGust, uThaw, uSwept;
uniform vec3 uRight, uForward;
uniform vec4 uBird;
uniform vec4 uPrints[${PRINTS}];
in vec3 vWorld; in vec3 vNormal; in vec2 vLocal; in vec2 vDepth;
float sm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
/** Distance outside a webbed print: three toes from a small heel, q across and along its heading. */
float printShape(vec2 q) {
  float d = length((q - vec2(0.0, -.012)) / vec2(.022, .018)) - 1.0;
  d *= .018;
  for (int t = -1; t <= 1; t++) {
    vec2 dir = normalize(vec2(float(t) * .7, 1.0));
    float along = clamp(dot(q, dir), 0.0, .07);
    d = min(d, length(q - dir * along) - .009);
  }
  return d;
}
void main() {
  float depth = vDepth.y;
  if (depth < .004) discard;
  vec2 xz = vWorld.xz, p = vLocal;
  float px = max(length(dFdx(xz)), length(dFdy(xz)));
  // Thin snow lies in patches, so the rim and the swept floor break up instead of tracing an outline.
  float patches = vnoise(p * 1.1 + 3.7) * .45 + vnoise(p * 3.1) * .33 + vnoise(p * 9.0) * .22;
  float cover = depth * (.2 + 1.6 * patches);
  // The swept channel keeps a whole skin: where it thins it is pressed blue, not holed through to the dark turf.
  float skinned = sm(.15, .35, vDepth.x) * sm(0.0, .3, uSwept) * (1.0 - uThaw);
  if (cover + .06 * skinned < .04) discard;
  float pressed = (1.0 - sm(.025, .09, cover)) * skinned;
  float thin = sm(.04, .3, cover);
  float cut = sm(.015, .08, vDepth.x * (1.0 - uThaw) - depth);
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;

  // Sastrugi: wind-cut ridges lying along the wind in broken runs, each a sharp lit edge on its steep upwind face
  // trailing off into a long shaded back; only drawn while a pixel resolves them.
  float phase = (p.y * 7.0 + 2.2 * sin(p.x * .9 + p.y * .4) + 1.1 * sin(p.x * 2.3 - p.y * .7)) / 6.2832;
  float f = fract(phase), fw = fwidth(phase);
  float runs = sm(.35, .7, vnoise(vec2(p.x * .7, p.y * 2.2) + 1.3));
  float ridged = sm(.15, .5, depth) * (1.0 - cut) * (1.0 - sm(.12, .3, fw)) * runs * sm(.65, .88, abs(n.y));
  float face = 1.0 - sm(max(.05, fw), max(.05, fw) + .08, f);
  float ridgeTone = (face * 1.4 - f * .6) * ridged;
  vec3 grain = vnoiseGrad(xz * 5.0) * (1.0 - sm(.015, .05, px));
  n = normalize(n - (uForward * (face - .25) * .35 * ridged + vec3(grain.y, 0.0, grain.z) * .012) * n.y);

  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(n, uSunDir), lit = cloudShadow(xz), sun = max(0.0, ndl) * lit;
  // Light soaks into snow, so faces turned from the moon go a clear blue rather than grey; the hollows bluest.
  vec3 albedo = mix(vec3(.6, .72, 1.0), vec3(1.0, 1.0, 1.02), sm(-.3, .45, ndl)) * ${glsl(T.driftBright)};
  albedo = mix(albedo, albedo * vec3(.84, .9, 1.04), (1.0 - sm(.2, .9, n.y)) * .6);
  albedo *= (1.0 + .12 * ridgeTone) * (.94 + .1 * vnoise(p * vec2(.25, .6) + 5.3));
  // Where a layer has come off, the snow under the crust is softer and bluer.
  albedo *= mix(vec3(1.0), vec3(.9, .94, 1.0), cut);
  vec3 col = albedo * (hemiLight(n) * (.85 + .45 * max(0.0, n.y)) + uSunColor * (sun * .8 + clamp(ndl * .5 + .3, 0.0, 1.0) * .1)
    + lampLight(vWorld, n) + dawnLight(vWorld, n));
  // Against the moon, crests and the cornice's lip glow at their edges, the light coming through the powder.
  float against = pow(max(dot(-V, uSunDir), 0.0), 2.0);
  col += uSunColor * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0) * (.25 + against * .6) * lit * .5;
  // The crust is polished in broad patches that take a soft sheen of moonlight; the cut snow below is matt.
  float crust = sm(.4, .75, vnoise(p * vec2(.35, .8) + 5.3)) * (1.0 - cut);
  col += uSunColor * pow(max(dot(reflect(-uSunDir, n), V), 0.0), 18.0) * crust * .12 * lit;
  // Prints pressed into what is left: small blue dents, their far walls catching the light.
  float dent = 0.0, rim = 0.0;
  for (int i = 0; i < ${PRINTS}; i++) {
    vec4 f = uPrints[i];
    vec2 rel = p - f.xy;
    if (f.w <= 0.0 || dot(rel, rel) > .012) continue;
    vec2 fwd = vec2(sin(f.z), cos(f.z));
    float d = printShape(vec2(dot(rel, vec2(fwd.y, -fwd.x)), dot(rel, fwd)));
    float edge = max(.004, px * .7);
    dent = max(dent, (1.0 - sm(-edge, edge, d)) * f.w);
    float wall = (d - edge * 1.5) / (edge * 1.4);
    rim = max(rim, exp(-wall * wall) * f.w);
  }
  col *= mix(vec3(1.0), vec3(.5, .58, .8), max(dent * .7, pressed));
  col *= 1.0 + rim * .12 * thin;
  // Where the bird stands in the drift, the snow round it is in its shade.
  float near = length(xz - uBird.xz);
  col *= 1.0 - .38 * (1.0 - sm(.07, .34, near)) * uBird.w * sm(-.05, .06, vWorld.y - uBird.y);
  // Spindrift: faint streaks of blown powder crossing the surface on the gusts.
  float blown = sm(.62, .95, vnoise(vec2(p.x * .55 - uTime * (.9 + uGust * 2.5), p.y * 2.6 + grain.x * 1.5)));
  col += hemiLight(vec3(0, 1, 0)) * blown * (.05 + .12 * uGust) * thin;
  // Crystals catch the light one at a time as the eye moves, gathered on the polished crust; never small enough to shimmer.
  vec2 cell = floor(xz * 26.0);
  float facet = hash12(cell + floor(V.xz * 7.0 + V.y * 5.0) * 17.0);
  float polished = max(crust, sm(.45, .85, vnoise(xz * .55 + 9.1)) * .6);
  float fleck = step(mix(.9985, .992, polished), facet) * (1.0 - sm(.13, .34, length(fract(xz * 26.0) - .5))) * (1.0 - sm(.012, .028, px));
  col += (uSunColor * 1.5 + uSkyAmbient * .7) * fleck * (.45 + .55 * hash12(cell + 3.1)) * max(max(.25, sun), against) * thin;
  // Thinning over the turf it takes the ground's shade.
  col *= mix(.8, 1.0, thin);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const POWDER_VERT = /* glsl */ `
${DRIFT_GLSL}
uniform float uClock, uBlow, uKick;
uniform vec2 uStroke;
uniform vec4 uKickAt;
in vec4 aInfo; in vec2 aLocal;
out vec3 vWorld; out float vAlpha, vPuff; out vec2 vStreak;
void main() {
  float seed = aInfo.z; vPuff = aInfo.w;
  vec3 dir = normalize(vec3(uStroke.x, 0.0, uStroke.y) + vec3(1e-4, 0.0, 0.0)), side = vec3(-dir.z, 0.0, dir.x);
  float age;
  if (aInfo.x < 0.0) {
    // Kicked up round the bird as it struggles in the drift.
    age = fract(seed * 5.31 + uClock * (1.1 + .5 * fract(seed * 3.7)));
    float a = seed * 40.0;
    vec3 away = vec3(cos(a), 0.0, sin(a));
    vWorld = uKickAt.xyz + away * (.08 + age * (.25 + .3 * fract(seed * 13.7)));
    vWorld.y += (1.0 - exp(-age * 6.0)) * (.18 + .3 * fract(seed * 5.3)) - age * age * .35;
    vAlpha = ss(0.0, .1, age) * pow(1.0 - age, 1.4) * uKick;
  } else {
    // A layer coming off: powder lifts from the drift's own surface, streams the way the stroke went and settles downwind.
    age = fract(seed + uClock * .55);
    vec2 d = driftAt(aLocal);
    float lifting = 1.0 - ss(.55 + uSwept * ${glsl(CHANNEL_WIDEN)}, 1.25 + uSwept * ${glsl(CHANNEL_SOFTEN)}, aInfo.x);
    float travel = age * (2.6 + 1.4 * fract(seed * 13.7));
    float sway = sin(uClock * 1.7 + aInfo.y * 9.0 + age * 3.0) * .22 * age + (fract(seed * 31.0) - .5) * .12 * (.4 + age);
    vWorld = position + vec3(0.0, d.y, 0.0) + dir * travel + side * sway;
    vWorld.y += (1.0 - exp(-age * 7.0)) * (.3 + .5 * fract(aInfo.y * 7.3)) - age * age * (.3 + d.y + .5 * fract(aInfo.y * 7.3));
    vAlpha = ss(0.0, .06, age) * (1.0 - ss(.6, 1.0, age)) * uBlow * lifting;
  }
  vec4 view = viewMatrix * vec4(vWorld, 1.0);
  gl_Position = projectionMatrix * view;
  vec4 ahead = projectionMatrix * viewMatrix * vec4(vWorld + dir * .2, 1.0);
  vStreak = normalize((ahead.xy / ahead.w - gl_Position.xy / gl_Position.w) * vec2(1.0, -1.0) + vec2(1e-5, 0.0));
  float far = max(1.0, -view.z);
  gl_PointSize = vPuff > .5 ? clamp((.4 + 1.0 * age) * 340.0 / far, 8.0, 80.0) : clamp((70.0 + 50.0 * fract(seed * 3.1)) / far, 2.0, 9.0);
}`;

const POWDER_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld; in float vAlpha, vPuff; in vec2 vStreak;
void main() {
  vec2 c = gl_PointCoord - .5;
  float a;
  if (vPuff > .5) { float r = length(c) * 2.0; a = exp(-r * r * 5.5) * (1.0 - smoothstep(.6, 1.0, r)) * .22; }
  else {
    vec2 q = vec2(dot(c, vStreak), dot(c, vec2(-vStreak.y, vStreak.x))) * vec2(2.2, 7.0);
    a = (1.0 - smoothstep(.35, 1.0, length(q))) * .9;
  }
  a *= vAlpha * nearFade(vWorld, 1.2, 3.0);
  if (a < .004) discard;
  gl_FragColor = vec4(applyFog(hemiLight(vec3(0, 1, 0)) * 1.9 + vec3(.28, .34, .4), vWorld), a);
}`;

/**
 * The drift in the notch: wind-carved snow the bird cannot wade through, taken down a layer a stroke into a channel
 * between rounded banks, and holding the bird's prints in what is left.
 */
export class SleepingDrift {
  readonly objects: THREE.Object3D[] = [];
  readonly swept = { value: 0 };
  readonly thaw = { value: 0 };
  private readonly blow = { value: 0 };
  private readonly kick = { value: 0 };
  private readonly clock = { value: 0 };
  private readonly gust = { value: 0 };
  private readonly trenchOn = { value: 0 };
  private readonly trench = { value: new THREE.Vector4() };
  private readonly stroke = { value: new THREE.Vector2(RIGHT.x, RIGHT.z) };
  private readonly kickAt = { value: new THREE.Vector4() };
  private readonly bird = { value: new THREE.Vector4() };
  private readonly prints = { value: Array.from({ length: PRINTS }, () => new THREE.Vector4()) };
  private readonly printSwept = new Float32Array(PRINTS);
  private nextPrint = 0;
  private deepest = -Infinity;
  private readonly lastAt = new THREE.Vector3();
  private readonly strokeAim = new THREE.Vector2(RIGHT.x, RIGHT.z);
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(SNOW_AT.y + .6));
  private readonly ray = new THREE.Raycaster();
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();

  constructor() {
    const geometry = new THREE.PlaneGeometry(WIDE, DEEP, 128, 132);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const p = SNOW_AT.clone().addScaledVector(RIGHT, vertices.getX(i) + (LEFT + RIGHTMOST) / 2).addScaledVector(FORWARD, vertices.getY(i) + (NEAR + FAR) / 2);
      vertices.setXYZ(i, p.x, heightAt(p.x, p.z) + .015, p.z);
    }
    geometry.computeVertexNormals();
    const state = { uSwept: this.swept, uThaw: this.thaw, uTrench: this.trench, uTrenchOn: this.trenchOn };
    const snow = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...state, uGust: this.gust, uRight: { value: RIGHT }, uForward: { value: FORWARD }, uBird: this.bird, uPrints: this.prints },
      side: THREE.DoubleSide, vertexShader: VERT, fragmentShader: FRAG,
    }));
    snow.frustumCulled = false; this.objects.push(snow);

    const rand = mulberry32(52231), spawn: number[] = [], info: number[] = [], local: number[] = [];
    const sources: [number, number][] = [];
    for (let tries = 0; sources.length < SOURCES && tries < 4000; tries++) {
      const u = LEFT + rand() * WIDE, v = NEAR + rand() * DEEP;
      if (routeDistance(u, v) > 2.1 || this.origAt(u, v) < .35 || sources.some(([a, b]) => Math.hypot(a - u, b - v) < .7)) continue;
      sources.push([u, v]);
    }
    const add = (u: number, v: number, routeAt: number, lane: number, seed: number, puff: number) => {
      const x = SNOW_AT.x + RIGHT.x * u + FORWARD.x * v, z = SNOW_AT.z + RIGHT.z * u + FORWARD.z * v;
      spawn.push(x, heightAt(x, z), z); info.push(routeAt, lane, seed, puff); local.push(u, v);
    };
    sources.forEach(([u, v], s) => {
      for (let i = 0; i < PER_SOURCE; i++) add(u + (rand() - .5) * .25, v + (rand() - .5) * .25, routeDistance(u, v), s / SOURCES, i / PER_SOURCE + rand() * .02, rand() < .1 ? 1 : 0);
    });
    for (let i = 0; i < KICKS; i++) add(0, 0, -1, 0, rand(), rand() < .35 ? 1 : 0);
    const powderGeometry = new THREE.BufferGeometry();
    powderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(spawn, 3));
    powderGeometry.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
    powderGeometry.setAttribute('aLocal', new THREE.Float32BufferAttribute(local, 2));
    const powder = new THREE.Points(powderGeometry, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...state, uClock: this.clock, uBlow: this.blow, uKick: this.kick, uStroke: this.stroke, uKickAt: this.kickAt },
      transparent: true, depthWrite: false, vertexShader: POWDER_VERT, fragmentShader: POWDER_FRAG,
    }));
    powder.frustumCulled = false; this.objects.push(powder);
  }

  private origAt(u: number, v: number): number {
    const orig = T.snowDepth * rimAt(u, v) * bodyAt(u, v);
    if (!this.trenchOn.value) return orig;
    const t = this.trench.value, d = segment(u, v, t.x, t.y, t.z, t.w), on = this.trenchOn.value;
    return orig * (1 - .55 * (1 - ss(.08, .2, d)) * on) + .03 * Math.exp(-(((d - .25) / .07) ** 2)) * on * ss(.05, .3, orig);
  }

  /** The same depth the drift is drawn with. */
  depthAt(x: number, z: number): number {
    const [u, v] = toLocal(x, z), s = this.swept.value;
    const orig = this.origAt(u, v);
    const channel = 1 - ss(.55 + s * CHANNEL_WIDEN, 1.25 + s * CHANNEL_SOFTEN, routeDistance(u, v));
    const skin = T.driftSkin * s * channel * ss(.08, .35, orig);
    return Math.max(orig * (1 - s * channel), skin) * (1 - this.thaw.value);
  }

  /** The way a stroke over the drift went, so the powder it lifts streams after it. */
  strokeOver(camera: THREE.Camera, fromNdc: THREE.Vector2, toNdc: THREE.Vector2): void {
    this.ray.setFromCamera(fromNdc, camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.from)) return;
    this.ray.setFromCamera(toNdc, camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.to)) return;
    const dx = this.to.x - this.from.x, dz = this.to.z - this.from.z, len = Math.hypot(dx, dz);
    if (len > 1e-4 && len < 20) this.strokeAim.set(dx / len, dz / len);
  }

  /** Where the bird is and the feet it put down this frame: its trench, its shade in the snow and its prints. */
  wader(at: THREE.Vector3, footfalls: readonly { x: number; z: number; heading: number }[]): void {
    const depth = this.depthAt(at.x, at.z), [u, v] = toLocal(at.x, at.z);
    const inSnow = ss(.04, .14, depth);
    this.bird.value.set(at.x, at.y, at.z, inSnow);
    const moving = this.lastAt.distanceTo(at);
    this.lastAt.copy(at);
    this.kickAt.value.set(at.x, at.y + Math.min(depth, .3), at.z, 0);
    this.kick.value += ((inSnow > .3 && moving > .002 ? 1 : 0) - this.kick.value) * .15;
    // It ploughs a trench behind it, ending far enough back that the snow is still at its chest where it stands.
    if (this.swept.value < .01 && depth > .06) {
      const t = this.trench.value;
      if (!this.trenchOn.value) { t.set(u, v - .3, u, v - .3); this.trenchOn.value = 1; this.deepest = v; }
      if (v > this.deepest) { this.deepest = v; t.z = u; t.w = Math.max(t.y, v - .3); }
    }
    for (const f of footfalls) {
      const [fu, fv] = toLocal(f.x, f.z);
      if (this.depthAt(f.x, f.z) < .015) continue;
      const along = Math.sin(f.heading) * FORWARD.x + Math.cos(f.heading) * FORWARD.z;
      const across = Math.sin(f.heading) * RIGHT.x + Math.cos(f.heading) * RIGHT.z;
      this.prints.value[this.nextPrint].set(fu, fv, Math.atan2(across, along), 1);
      this.printSwept[this.nextPrint] = this.swept.value;
      this.nextPrint = (this.nextPrint + 1) % PRINTS;
    }
  }

  update(dt: number, time: number, snow: number, thaw: number, gust: number): void {
    this.clock.value = time;
    this.gust.value = gust;
    this.thaw.value = thaw;
    const blowing = Math.min(1, Math.max(0, snow - this.swept.value) * 9);
    this.blow.value += (blowing - this.blow.value) * (1 - Math.exp(-dt * 5));
    this.swept.value += (snow - this.swept.value) * (1 - Math.exp(-dt * T.snowLayerEase));
    const aim = this.stroke.value;
    aim.lerp(this.strokeAim, 1 - Math.exp(-dt * 4)).normalize();
    if (snow === 0 && this.swept.value < .001 && this.trenchOn.value && this.lastAt.distanceTo(SNOW_AT) > 12) this.trenchOn.value = 0;
    // A layer taken from under a print takes the print with it.
    this.prints.value.forEach((p, i) => {
      const taken = this.swept.value - this.printSwept[i] > .02 && routeDistance(p.x, p.y) < .55 + this.swept.value * CHANNEL_WIDEN + .5;
      if (taken || thaw > 0) p.w *= Math.exp(-dt * (taken ? 4 : 3 * thaw));
    });
  }
}
