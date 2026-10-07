import { CREATURE_GLSL } from '../../creatures/shading';
import { ATMO_GLSL } from '../../world/atmosphere';
import { BODY, DORSAL, DORSAL_AT, DORSAL_BASE, FIN, FIN_ROOT, FLUKES, FLUKE_HALF_SPAN, FLUKE_HINGE, LENGTH, SPINE_END } from './anatomy';

export const SPINE_N = 44;
const f = (x: number) => x.toFixed(4);

const RIG_GLSL = /* glsl */ `
uniform vec4 uSpine[${SPINE_N}];
uniform float uWet[${SPINE_N}];
uniform vec3 uHeading;
uniform float uRoll;
uniform vec2 uFin;
uniform float uCurl;
uniform float uScale;
/** A shiver running along the back: where it is (s), how deep, and how long a stretch of skin it moves. */
uniform vec3 uShiver;
/** One flipper lifted on its own: which side, how far it is raised and further swept. */
uniform vec3 uSlap;
/** The flippers, the dorsal fin and the flukes, each scaled about its root. */
uniform vec3 uShape;
in vec4 aRig;
out vec3 vRest;
out vec3 vRestNormal;
out vec4 vRig;
out float vWet;

/** Bends the rest pose along the spine: each point rides the spine frame at its place along the body. */
vec3 rig(vec3 rest, inout vec3 n) {
  float s = aRig.x;
  int part = int(aRig.y + 0.5);
  vec3 off = rest + vec3(0.0, 0.0, s * ${f(LENGTH)});
  if (part == ${FIN}) {
    float side = sign(rest.x);
    vec3 root = vec3(side * ${f(FIN_ROOT.x)}, ${f(FIN_ROOT.y)}, ${f(FIN_ROOT.z)});
    // The one lifted flipper rises in its own outward plane before both are swept, so it lifts however it lies.
    float own = step(0.5, side * uSlap.x);
    float raise = side * (uSlap.y * own - uFin.y);
    float sweep = side * (uFin.x + uSlap.z * own);
    vec3 p = rotY(rotZ((rest - root) * uShape.x, raise), sweep);
    n = rotY(rotZ(n, raise), sweep);
    off = p + root + vec3(0.0, 0.0, s * ${f(LENGTH)});
  }
  if (part == ${FLUKES}) {
    float k = abs(rest.x) / ${f(FLUKE_HALF_SPAN)};
    off.y += uCurl * k * k;
    off.xy *= uShape.z;
    s = ${f(FLUKE_HINGE)} + (s - ${f(FLUKE_HINGE)}) * uShape.z;
  }
  if (part == ${DORSAL}) {
    off.xy = vec2(off.x * uShape.y, ${f(DORSAL_BASE)} + (off.y - ${f(DORSAL_BASE)}) * uShape.y);
    s = ${f(DORSAL_AT)} + (s - ${f(DORSAL_AT)}) * uShape.y;
  }
  if (part == ${BODY} && uShiver.y > 0.0) {
    float d = (s - uShiver.x) / uShiver.z;
    off += normal * uShiver.y * exp(-d * d) * max(normal.y, 0.0);
  }
  off *= uScale;
  float cr = cos(uRoll), sr = sin(uRoll);
  off.xy = vec2(cr * off.x - sr * off.y, sr * off.x + cr * off.y);
  n.xy = vec2(cr * n.x - sr * n.y, sr * n.x + cr * n.y);

  float fi = clamp(s / ${f(SPINE_END)}, 0.0, 1.0) * ${f(SPINE_N - 1)};
  int i = min(int(fi), ${SPINE_N - 2});
  float t = fi - float(i);
  vec4 a = uSpine[i];
  vec4 b = uSpine[i + 1];
  float pitch = mix(a.w, b.w, t);
  vec3 F = uHeading * cos(pitch) + vec3(0.0, sin(pitch), 0.0);
  vec3 U = -uHeading * sin(pitch) + vec3(0.0, cos(pitch), 0.0);
  vec3 S = cross(U, F);
  n = S * n.x + U * n.y + F * n.z;
  vRest = rest;
  vRestNormal = normal;
  vRig = aRig;
  vWet = mix(uWet[i], uWet[i + 1], t);
  return mix(a.xyz, b.xyz, t) + S * off.x + U * off.y + F * off.z;
}
`;

/** Colour of the skin: a dark back, a pale pleated throat and belly, white flippers, the flukes' pale pattern. */
const SKIN_GLSL = /* glsl */ `
uniform vec3 uBack;
uniform vec3 uBelly;
/** 0 the eye shut in a sleeping curve, 1 open. */
uniform float uEye;
/** Where the eye is (s along, height in the rest pose) and how big it is drawn. */
uniform vec3 uEyeAt;
/** Where the open eye looks, across its own disc (along the body, up), -1..1. */
uniform vec2 uGaze;
/**
 * How knobbly the head is, how high the pale of the jaw comes up the head, how many pale barnacle spots, and how
 * pale and sunlit-through the undersides of the flukes are.
 */
uniform vec4 uDetail;
in vec3 vRest;
in vec3 vRestNormal;
in vec4 vRig;
in float vWet;

struct Skin {
  vec3 albedo;
  float thin;
  float bump;
};

/** Rounded knobs scattered on a jittered grid, 0..1. */
float knobs(vec2 p) {
  vec2 id = floor(p);
  vec2 fr = fract(p);
  float h = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = vec2(float(x), float(y));
      vec2 o = vec2(hash12(id + c), hash12(id + c + 17.1)) * 0.6 + 0.2;
      float d = length(c + o - fr) / (0.26 + 0.12 * hash12(id + c + 5.3));
      h = max(h, 1.0 - d * d);
    }
  }
  return h;
}

Skin skin() {
  int part = int(vRig.y + 0.5);
  float s = vRig.x;
  vec3 rn = normalize(vRestNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float mottle = vnoise(vRest.zx * vec2(1.3, 2.1)) * 0.6 + vnoise(vRest.zy * 4.0 + 3.0) * 0.4;
  Skin k = Skin(uBack * (0.9 + 0.2 * mottle), 0.0, 0.0);
  if (part == ${BODY} || part == ${DORSAL}) {
    float jawLift = uDetail.y * (1.0 - smoothstep(0.1, 0.24, s));
    float pale = (1.0 - smoothstep(-0.62, -0.2, rn.y - jawLift + (mottle - 0.5) * 0.5)) * (1.0 - smoothstep(0.55, 0.82, s));
    float pleats = smoothstep(0.06, 0.12, s) * (1.0 - smoothstep(0.38, 0.5, s)) * (1.0 - smoothstep(-0.6, -0.35, rn.y));
    float groove = smoothstep(0.55, 1.0, sin(vRig.z * 6.2832 * 26.0)) * pleats;
    k.albedo = mix(k.albedo, uBelly * (0.88 + 0.16 * mottle), pale) * (1.0 - groove * 0.35);
    float head = (1.0 - smoothstep(0.15, 0.23, s)) * smoothstep(0.1, 0.45, rn.y);
    float jaw = (1.0 - smoothstep(0.18, 0.26, s)) * (1.0 - smoothstep(0.0, 0.25, abs(rn.y + 0.05)));
    k.bump = knobs(vec2(vRest.z * 1.9, vRest.x * 2.2)) * (head + jaw * 0.8) * 0.035 * uDetail.x - groove * 0.015;
    if (uDetail.z > 0.0) {
      vec2 g = vec2(vRest.z * 2.6, vRig.z * 70.0);
      vec2 id = floor(g);
      float spot = 1.0 - smoothstep(0.14, 0.22, length(fract(g) - 0.5 - (vec2(hash12(id), hash12(id + 7.7)) - 0.5) * 0.5));
      float where = step(1.0 - uDetail.z, hash12(id + 3.1)) * smoothstep(0.55, 0.85, rn.y);
      k.albedo = mix(k.albedo, uBelly * 0.95, spot * where);
    }
    // The eye, in units of its radius: an almond under a heavy upper lid that lifts from a slit to tired-open with
    // uEye, a dark iris and pupil turned by uGaze, and a pale reflection that the light, not the eye, makes bright.
    vec2 e = vec2(vRest.z + uEyeAt.x * ${f(LENGTH)}, vRest.y - uEyeAt.y) / (uEyeAt.z * 0.08);
    float side = step(uEyeAt.z > 1.5 ? 0.35 : 0.8, abs(rn.x));
    float span = max(0.0, 1.0 - e.x * e.x);
    float upper = mix(-0.3, 0.2, uEye) * span;
    float lower = -0.45 * span;
    float aa = 0.06;
    float opening = smoothstep(lower, lower + aa, e.y) * (1.0 - smoothstep(upper - aa, upper, e.y)) * step(abs(e.x), 1.0);
    vec2 g = e - uGaze * vec2(sign(rn.x), 1.0) * 0.25 - vec2(0.0, -0.1);
    float iris = 1.0 - smoothstep(0.5, 0.56, length(g));
    float pupil = 1.0 - smoothstep(0.24, 0.3, length(g));
    vec3 eye = mix(vec3(0.62, 0.58, 0.5), mix(vec3(0.24, 0.15, 0.09), vec3(0.03, 0.025, 0.02), pupil), iris);
    float glint = 1.0 - smoothstep(0.08, 0.13, length(g - vec2(sign(rn.x) * 0.2, 0.22)));
    eye = mix(eye, vec3(0.92), glint);
    float crease = (1.0 - smoothstep(0.03, 0.09, abs(e.y - upper - 0.28 * span))) * step(abs(e.x), 1.1);
    float socket = 1.0 - smoothstep(1.0, 1.6, length(e * vec2(1.0, 1.4)));
    k.albedo *= 1.0 - (0.18 * socket + 0.35 * crease) * side * step(1.5, uEyeAt.z);
    k.albedo = mix(k.albedo, eye, opening * side);
  } else if (part == ${FIN}) {
    float top = smoothstep(-0.2, 0.4, rn.y);
    k.albedo = mix(uBelly * (0.92 + 0.12 * mottle), uBack * 1.1, top * (1.0 - smoothstep(0.2, 0.75, vRig.z)) * 0.8);
    k.thin = 0.6;
  } else {
    // Its own marks under the flukes, the same wherever it is met: a ragged dark trailing edge and tips, a dark
    // stroke up from the notch, and two dark commas that do not match.
    float under = (1.0 - smoothstep(-0.15, 0.15, rn.y));
    float t = vRig.z;
    float a = vRig.w;
    float edge = smoothstep(0.66, 0.84, a + 0.07 * sin(t * 23.0) + 0.04 * sin(t * 51.0));
    float stroke = (1.0 - smoothstep(0.05, 0.11, abs(t + 0.03 * sin(a * 9.0)))) * smoothstep(0.2, 0.45, a);
    float left = 1.0 - smoothstep(0.08, 0.12, length(vec2((t + 0.47) * 0.8, a - 0.36 - 0.1 * (t + 0.47))));
    float right = 1.0 - smoothstep(0.05, 0.08, length(vec2(t - 0.6, (a - 0.52) * 1.4)));
    float tips = smoothstep(0.8, 0.95, abs(t));
    float mark = max(max(edge, stroke), max(max(left, right), tips));
    k.albedo = mix(k.albedo, uBelly * 1.08, under * (1.0 - mark) * uDetail.w);
    k.thin = 0.8 * uDetail.w;
  }
  return k;
}
`;

export const WHALE_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${RIG_GLSL}
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec3 n = normal;
  vWorld = rig(position, n);
  vNormal = n;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

export const WHALE_FRAG = /* glsl */ `
${ATMO_GLSL}
${SKIN_GLSL}
uniform vec3 uSeaTint;
/** Soft light the skin holds from the sky, over what the sun gives it. */
uniform vec3 uFill;
uniform vec3 uShiver;
uniform float uScale;
in vec3 vWorld;
in vec3 vNormal;

/** Tilts N by the slope of a height field h over the surface (screen-space surface gradient). */
vec3 bumped(vec3 N, vec3 p, float h) {
  vec3 dpdx = dFdx(p);
  vec3 dpdy = dFdy(p);
  vec3 r1 = cross(dpdy, N);
  vec3 r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * N - grad);
}

void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  Skin k = skin();
  float d = (vRig.x - uShiver.x) / uShiver.z;
  float ripple = uShiver.y * uScale * 0.35 * exp(-d * d) * sin(vRig.x * ${f(LENGTH)} * uScale * 6.0 - uTime * 14.0);
  N = bumped(N, vWorld, k.bump * (1.0 - smoothstep(20.0, 60.0, length(cameraPosition - vWorld))) + ripple);

  float sun = cloudShadow(vWorld.xz);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  float nv = clamp(dot(N, V), 0.0, 1.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 2.0);
  vec3 ambient = mix(uSeaTint * uSkyAmbient, uSkyAmbient * 1.1, N.y * 0.5 + 0.5);
  vec3 col = k.albedo * (ambient + uSunColor * (wrap * wrap * 0.75 + 0.04) * sun);
  col += k.albedo * uSunColor * sun * k.thin * back * max(-ndl, 0.0) * 1.4;
  col += k.albedo * uFill * (0.6 + 0.4 * N.y);

  float dry = smoothstep(0.0, 0.25, vWorld.y);
  int part = int(vRig.y + 0.5);
  float across = part == ${BODY} || part == ${DORSAL} ? vRig.z * 24.0 : dot(vRest.xz, vec2(5.0, 2.0));
  vec2 flow = vec2(across, vWorld.y * 1.1 + uTime * 1.9);
  float streak = smoothstep(0.7, 0.95, vnoise(vec2(flow.x * 2.5, flow.y)) * 0.75 + vnoise(vec2(flow.x * 7.0, flow.y * 3.0)) * 0.25);
  float sheet = vWet * dry;

  vec3 R = reflect(-V, N);
  vec3 env = skyColor(vec3(R.x, max(R.y, 0.02), R.z));
  env = mix(env, uSeaTint * uSkyAmbient * 1.4, (1.0 - smoothstep(-0.3, 0.0, R.y)));
  float F = 0.03 + 0.97 * pow(1.0 - nv, 5.0);
  col = mix(col, env, F * (0.3 + 0.5 * sheet));
  vec3 H = halfVector(uSunDir, V);
  col += uSunColor * pow(max(dot(N, H), 0.0), mix(60.0, 160.0, sheet)) * (0.35 + (0.8 + 3.0 * streak) * sheet) * sun;
  col += vec3(0.85, 0.9, 0.95) * (uSkyAmbient * 0.7 + uSunColor * (0.1 + back * 0.8) * sun) * streak * sheet * 0.45;
  col += uSunColor * pow(1.0 - nv, 6.0) * back * smoothstep(-0.3, 0.5, ndl) * 0.7 * sun;

  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** The submerged body seen through the sea: slid up its view ray to the surface, tinted and faded by the water. */
export const GHOST_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${RIG_GLSL}
out vec3 vSurface;
out float vDepth;
void main() {
  vec3 n = normal;
  vec3 w = rig(position, n);
  vDepth = -w.y;
  if (w.y < 0.04) w = cameraPosition + (w - cameraPosition) * (cameraPosition.y - 0.04) / max(cameraPosition.y - w.y, 1e-3);
  vSurface = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

export const GHOST_FRAG = /* glsl */ `
${ATMO_GLSL}
${SKIN_GLSL}
uniform vec3 uDeep;
uniform vec3 uAbsorb;
in vec3 vSurface;
in float vDepth;
void main() {
  if (vDepth < -0.02) discard;
  Skin k = skin();
  float depth = max(vDepth, 0.0);
  vec3 V = normalize(cameraPosition - vSurface);
  float nv = max(V.y, 0.02);
  float cosT = sqrt(max(1.0 - (1.0 - nv * nv) / 1.77, 0.05));
  float path = depth / cosT;
  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  float sun = cloudShadow(vSurface.xz);
  vec3 light = uSkyAmbient * 1.2 + uSunColor * max(uSunDir.y, 0.0) * 1.1 * sun;
  vec3 deep = uDeep * (uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * sun);
  vec3 seen = k.albedo * light * exp(-uAbsorb * (path + depth));
  float clear = exp(-path * 0.55);
  vec3 col = mix(deep, seen, clear);
  float a = (1.0 - F) * clear * smoothstep(-0.02, 0.06, vDepth) * 0.7;
  if (a < 0.004) discard;
  col = mix(stillGrey(col) * 1.05, col, 0.35 + 0.65 * uWorldLife);
  col = applyFog(col, vSurface);
  gl_FragColor = vec4(col * a, a);
}`;
