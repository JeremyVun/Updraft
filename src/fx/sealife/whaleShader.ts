import { CREATURE_GLSL } from '../../creatures/shading';
import { ATMO_GLSL } from '../../world/atmosphere';
import { tuning } from '../../tuning';
import { BLOWHOLE, BODY, DORSAL, DORSAL_AT, DORSAL_BASE, FIN, FIN_ROOT, FLUKES, FLUKE_HALF_SPAN, FLUKE_HINGE, JAW_CORNER, LENGTH, SPINE_END } from './anatomy';

export const SPINE_N = 44;
const f = (x: number) => x.toFixed(4);
const L = tuning.whaleLook;

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
/** The rest pose's axes in the world, for the light to model the skin's small forms. */
out vec3 vAxisX;
out vec3 vAxisY;
out vec3 vAxisZ;

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
  vAxisX = S * cr + U * sr;
  vAxisY = U * cr - S * sr;
  vAxisZ = F;
  return mix(a.xyz, b.xyz, t) + S * off.x + U * off.y + F * off.z;
}
`;

/**
 * Colour and form of the skin: a slate back over a pale lower jaw and belly, the eye under its heavy lid, the
 * blowhole's two slits, white flippers, the flukes' pale pattern. `form` is a height in metres the light models.
 */
const SKIN_GLSL = /* glsl */ `
uniform vec3 uBack;
uniform vec3 uBelly;
uniform vec3 uIris;
uniform float uScale;
/** 0 the eye a tired slit under its lid, 1 open. */
uniform float uEye;
/** Where the eye is (s along, height in the rest pose) and how big it is drawn. */
uniform vec3 uEyeAt;
/** Where the open eye looks, across its own disc (along the body, up), -1..1. */
uniform vec2 uGaze;
in vec3 vRest;
in vec3 vRestNormal;
in vec4 vRig;
in float vWet;

struct Skin {
  vec3 albedo;
  float thin;
  /** Slope of the skin's small forms (eye, lids, blowhole) along the rest pose's axes, metres per rest unit. */
  vec3 slope;
  /** 1 on the wet glass of the eye. */
  float gloss;
  /** Where light coming in through the eye falls on the iris. */
  float caustic;
  /** 1 round the eye, where the light is kept soft. */
  float near;
};

/** The eye's lids, in units of its radius (x toward the snout): where its corners lie, and the lower and upper lid. */
vec3 lids(vec2 e) {
  float span = max(0.0, 1.0 - e.x * e.x);
  float corner = -0.04 + 0.06 * e.x;
  return vec3(corner, corner - (0.12 + 0.1 * uEye) * pow(span, 0.8),
    corner + (0.06 + 0.42 * uEye) * pow(span, 0.55) * (1.0 + 0.18 * e.x));
}

/** Height in metres of the skin's small forms over the rest pose at r: the eye on its mound under a heavy lid, the blowhole. */
float form(vec3 r, float flank) {
  float h = 0.0;
  float R = uEyeAt.z * 0.08;
  vec2 e = vec2(r.z + uEyeAt.x * ${f(LENGTH)}, r.y - uEyeAt.y) / R;
  if (flank > 0.0 && length(e * vec2(0.62, 1.0)) < 2.6) {
    vec3 l = lids(e);
    float open = smoothstep(l.y - 0.04, l.y + 0.04, e.y) * (1.0 - smoothstep(l.z - 0.04, l.z + 0.04, e.y))
      * (1.0 - smoothstep(0.94, 1.0, abs(e.x)));
    // The lids' swellings follow rounder curves than their edges, so they ease out past the corners.
    float span = max(0.0, 1.0 - e.x * e.x * 0.8);
    float top = l.x + (0.06 + 0.42 * uEye) * span;
    float wide = 1.0 - smoothstep(0.4, 1.3, abs(e.x));
    float lid = 0.22 * smoothstep(-0.08, 0.14, e.y - top) * (1.0 - smoothstep(0.1, 1.3, e.y - top));
    float sill = 0.08 * smoothstep(-0.1, 0.14, l.y - e.y) * (1.0 - smoothstep(0.1, 0.7, l.y - e.y));
    float mound = 0.24 * (1.0 - smoothstep(0.0, 2.6, length(e * vec2(0.62, 1.0))));
    vec2 c = e - vec2(0.0, l.x);
    float ball = 0.45 * sqrt(max(0.0, 1.3 - dot(c, c))) - 0.43;
    h += R * uScale * flank * (mound + mix((lid + sill) * wide, ball, open));
  }
  vec2 b = vec2(abs(r.x), r.z + ${f(BLOWHOLE * LENGTH)});
  if (b.x < 0.3 && abs(b.y) < 0.3) {
    vec2 slit = vec2(b.x - 0.07 - 0.04 * clamp(b.y / 0.2, -1.0, 1.0), b.y) / vec2(0.045, 0.2);
    h -= 0.03 * uScale * (1.0 - smoothstep(0.5, 1.1, length(slit)));
  }
  return h;
}

Skin skin() {
  int part = int(vRig.y + 0.5);
  float s = vRig.x;
  vec3 rn = normalize(vRestNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float mottle = vnoise(vRest.zx * vec2(0.9, 1.6)) * 0.6 + vnoise(vRest.zy * 2.5 + 3.0) * 0.4;
  Skin k = Skin(uBack * (0.94 + 0.12 * mottle), 0.0, vec3(0.0), 0.0, 0.0, 0.0);
  if (part == ${BODY} || part == ${DORSAL}) {
    // The lower jaw's line runs back from the snout to just under the eye, then falls away to the belly.
    float h = part == ${BODY} ? vRig.w : 1.0;
    float jaw = mix(0.72, 0.45, smoothstep(0.0, ${f(JAW_CORNER)}, s));
    float turn = smoothstep(${f(JAW_CORNER)}, ${f(JAW_CORNER + 0.06)}, s);
    float line = mix(jaw, -0.55, 1.0 - sqrt(max(0.0, 1.0 - turn * turn)));
    float onHead = 1.0 - smoothstep(${f(JAW_CORNER)}, ${f(JAW_CORNER + 0.04)}, s);
    float soft = mix(0.07, 0.018, onHead) + fwidth(h);
    float pale = (1.0 - smoothstep(line - soft, line + soft, h + (mottle - 0.5) * 0.08 * (1.0 - onHead)))
      * (1.0 - smoothstep(0.55, 0.85, s));
    float pleats = smoothstep(0.08, 0.14, s) * (1.0 - smoothstep(0.36, 0.48, s)) * (1.0 - smoothstep(-0.75, -0.45, h));
    float groove = smoothstep(0.6, 1.0, sin(vRig.z * 6.2832 * 30.0)) * pleats * (1.0 - smoothstep(0.0, 0.02, fwidth(vRig.z * 30.0)));
    vec3 jawTone = uBelly * (0.92 + 0.1 * mottle) * mix(0.62, 1.0, smoothstep(line - 0.6, line - 0.04, h));
    // Behind the jaw the belly is a paler slate, so rolled over it is not a white hull.
    jawTone = mix(jawTone, mix(uBack, uBelly, 0.45), smoothstep(${f(JAW_CORNER + 0.03)}, ${f(JAW_CORNER + 0.12)}, s));
    k.albedo = mix(k.albedo, jawTone, pale) * (1.0 - groove * 0.12);
    // A soft shadow under the snout's lip along the jaw line.
    k.albedo *= 1.0 - 0.3 * onHead * smoothstep(line, line + soft + 0.01, h) * (1.0 - smoothstep(line + 0.02, line + 0.08, h));
    vec2 b = vec2(abs(vRest.x), vRest.z + ${f(BLOWHOLE * LENGTH)});
    vec2 slit = vec2(b.x - 0.07 - 0.04 * clamp(b.y / 0.2, -1.0, 1.0), b.y) / vec2(0.045, 0.2);
    k.albedo *= 1.0 - 0.75 * (1.0 - smoothstep(0.6, 1.0, length(slit))) * smoothstep(0.4, 0.7, rn.y);

    // The eye: a tired almond under a heavy upper lid, its outer corner low, a dark amber iris and a dark pupil
    // turned by uGaze. Its gloss and catchlight come from the light.
    float R = uEyeAt.z * 0.08;
    vec2 e = vec2(vRest.z + uEyeAt.x * ${f(LENGTH)}, vRest.y - uEyeAt.y) / R;
    float flank = smoothstep(0.25, 0.45, abs(rn.x));
    vec3 l = lids(e);
    float aa = fwidth(e.y) + 0.015;
    float opening = smoothstep(l.y - aa, l.y + aa, e.y) * (1.0 - smoothstep(l.z - aa, l.z + aa, e.y))
      * (1.0 - smoothstep(1.0 - aa, 1.0, abs(e.x))) * flank;
    vec2 g = e - vec2(uGaze.x * 0.3, l.x + 0.05 + uGaze.y * 0.08);
    float iris = 1.0 - smoothstep(0.42 - aa, 0.42 + aa, length(g));
    float pupil = 1.0 - smoothstep(0.17 - aa, 0.17 + aa, length(g * vec2(0.72, 1.35)));
    float under = smoothstep(l.z - 0.3, l.z, e.y);
    vec3 ring = mix(uIris * 0.25, uIris, smoothstep(0.2, -0.38, g.y)) * (0.85 + 0.3 * vnoise(vec2(atan(g.y, g.x) * 7.0, 0.5)));
    vec3 eye = mix(vec3(0.06, 0.045, 0.04), ring, iris);
    eye = mix(eye, vec3(0.012, 0.01, 0.01), pupil) * (1.0 - 0.7 * under);
    k.albedo = mix(k.albedo, eye, opening);
    k.gloss = opening;
    k.near = (1.0 - smoothstep(1.0, 1.6, length(e * vec2(0.8, 1.0)))) * flank;
    k.caustic = opening * iris * (1.0 - pupil) * smoothstep(0.1, -0.35, g.y) * (1.0 - under);
    if (part == ${BODY}) {
      float d = 0.012;
      float f0 = form(vRest, flank);
      k.slope = vec3(form(vRest + vec3(d, 0.0, 0.0), flank) - f0, form(vRest + vec3(0.0, d, 0.0), flank) - f0,
        form(vRest + vec3(0.0, 0.0, d), flank) - f0) / d;
    }
  } else if (part == ${FIN}) {
    float top = smoothstep(-0.2, 0.4, rn.y);
    k.albedo = mix(uBelly * (0.92 + 0.1 * mottle), uBack * 1.05, top * (1.0 - smoothstep(0.15, 0.7, vRig.z)) * 0.85);
    k.thin = 0.15;
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
    float lead = 1.0 - smoothstep(0.04, 0.12, a);
    float mark = max(max(max(edge, stroke), max(max(left, right), tips)), lead);
    k.albedo = mix(k.albedo, uBelly * mix(0.78, 1.0, smoothstep(0.0, 0.5, abs(t))) * (0.9 + 0.15 * mottle), under * (1.0 - mark));
    k.thin = 0.12;
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
uniform vec3 uShiver;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vAxisX;
in vec3 vAxisY;
in vec3 vAxisZ;

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
  vec3 slope = (k.slope.x * vAxisX + k.slope.y * vAxisY + k.slope.z * vAxisZ) / uScale;
  N = normalize(N - (slope - N * dot(slope, N)));
  N = bumped(N, vWorld, ripple);

  float sun = cloudShadow(vWorld.xz);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  float nv = clamp(dot(N, V), 0.0, 1.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 2.0);
  // Broad cool light from the open sky, strongest from above, and the sea's warm light thrown up under it.
  float sky = dot(uSkyAmbient, vec3(0.3, 0.5, 0.2));
  vec3 fill = vec3(0.78, 0.9, 1.08) * sky * ${f(L.fill)} * (0.62 + 0.38 * N.y);
  vec3 bounce = mix(uSkyHorizon, uSeaTint * sky * 3.0, 0.5) * ${f(L.bounce)} * sky * max(-N.y + 0.15, 0.0);
  vec3 col = k.albedo * (fill + bounce + uSunColor * (wrap * wrap * wrap * ${f(L.key)} + 0.02) * sun);
  col += k.albedo * uSunColor * sun * k.thin * back * max(-ndl, 0.0) * 1.4;
  col += uIris * uSunColor * sun * k.caustic * ${f(L.caustic)};

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
  col = mix(col, env, F * (0.25 + 0.5 * sheet + 0.6 * k.gloss));
  vec3 H = halfVector(uSunDir, V);
  float nh = max(dot(N, H), 0.0);
  // The low sun along its top and rim: a broad wet sheen, and a gold edge where the skin turns away.
  col += uSunColor * pow(nh, mix(24.0, 160.0, sheet)) * (${f(L.sheen)} + (0.8 + 3.0 * streak) * sheet) * sun * (1.0 - k.gloss);
  col += vec3(0.85, 0.9, 0.95) * (uSkyAmbient * 0.7 + uSunColor * (0.1 + back * 0.8) * sun) * streak * sheet * 0.45;
  float rim = pow(1.0 - nv, 3.0) * smoothstep(-0.2, 0.5, N.y + ndl);
  col += uSunColor * mix(vec3(1.0), k.albedo * 2.0, 0.35) * rim * (0.2 + back) * ${f(L.rim)} * sun * (1.0 - k.near);
  // Its catchlight is the bright sky over it, held in the upper glass of the eye.
  float glint = pow(max(dot(N, normalize(V + vec3(0.0, 0.55, 0.0) + vAxisZ * 0.25)), 0.0), 500.0);
  col += (uSunColor * 0.5 + uSkyHorizon) * glint * ${f(L.catchlight)} * k.gloss;

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
  // The same cool sky light as on its skin above, so the pale flippers still show under the glass at dawn.
  float sky = dot(uSkyAmbient, vec3(0.3, 0.5, 0.2));
  vec3 light = max(uSkyAmbient * 1.2, vec3(0.78, 0.9, 1.08) * sky * ${f(L.fill)}) + uSunColor * max(uSunDir.y, 0.0) * 1.1 * sun;
  vec3 deep = uDeep * (uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * sun);
  vec3 seen = k.albedo * light * exp(-uAbsorb * (path + depth));
  float clear = exp(-path * ${f(L.clarity)});
  vec3 col = mix(deep, seen, clear);
  float a = (1.0 - F) * clear * smoothstep(-0.02, 0.06, vDepth) * 0.7;
  if (a < 0.004) discard;
  col = mix(stillGrey(col) * 1.05, col, 0.35 + 0.65 * uWorldLife);
  col = applyFog(col, vSurface);
  gl_FragColor = vec4(col * a, a);
}`;
