import { CREATURE_GLSL } from '../../creatures/shading';
import { ATMO_GLSL } from '../../world/atmosphere';
import { tuning } from '../../tuning';
import { BLOWHOLE, BODY, DORSAL, DORSAL_AT, DORSAL_BASE, FIN, FIN_DIR, FIN_ROOT, FLUKES, FLUKE_HALF_SPAN, FLUKE_HINGE, JAW_CORNER, KNOBS, LENGTH, MOUTH, SPINE_END } from './anatomy';

export const SPINE_N = 44;
const f = (x: number) => x.toFixed(4);
const L = tuning.whaleLook;
const MOUTH_N = 32;

const HEAD_GLSL = /* glsl */ `
const float MOUTH_Y[${MOUTH_N}] = float[](${Array.from({ length: MOUTH_N }, (_, i) => f(MOUTH((i / (MOUTH_N - 1)) * JAW_CORNER))).join(', ')});
const vec4 KNOBS[${KNOBS.length}] = vec4[](${KNOBS.map((k, i) => `vec4(${f(k.x)}, ${f(k.y)}, ${f(k.z)}, ${f(i < KNOBS.length - 3 ? 0.11 : 0.2)})`).join(', ')});

/** The mouth line's height in the rest pose at s, held level past its corner. */
float mouthAt(float s) {
  float x = clamp(s / ${f(JAW_CORNER)}, 0.0, 1.0) * ${f(MOUTH_N - 1)};
  int i = min(int(x), ${MOUTH_N - 2});
  return mix(MOUTH_Y[i], MOUTH_Y[i + 1], x - float(i));
}

/** Rest units below the mouth line on the lower jaw, fading out at its corner (0 elsewhere). */
float jawBelow(vec3 r) {
  return mouthAt(-r.z / ${f(LENGTH)}) - r.y;
}

/** The knobs on the head, mirrored: their height over the skin at r, in rest units. */
float knobs(vec3 r) {
  if (r.z < ${f(-0.15 * LENGTH)}) return 0.0;
  vec3 m = vec3(abs(r.x), r.y, r.z);
  float h = 0.0;
  for (int i = 0; i < ${KNOBS.length}; i++) {
    // Those along the top are broad and low: seen edge on against the sun, a small one draws a porthole of light.
    vec3 d = m - KNOBS[i].xyz;
    float r = KNOBS[i].w;
    float q = dot(d, d) / (r * r);
    if (q < 1.0) h += (1.0 - q) * (1.0 - q) * (1.0 - q) * 0.011 / r;
  }
  return h * 0.15;
}
`;

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

/** v turned by angle a about the unit axis k. */
vec3 alongFin(vec3 v, vec3 k, float a) {
  return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a));
}

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
    // Lifted, it also turns over a little along its length, its broad top toward the boat.
    vec3 axis = vec3(side * ${f(FIN_DIR.x)}, ${f(FIN_DIR.y)}, ${f(FIN_DIR.z)});
    float turn = -side * uSlap.y * own * ${f(L.finTurn)};
    vec3 p = alongFin((rest - root) * uShape.x, axis, turn);
    p = rotY(rotZ(p, raise), sweep);
    n = rotY(rotZ(alongFin(n, axis, turn), raise), sweep);
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
 * blowhole's two slits, white flippers, the flukes' pale pattern.
 */
const SKIN_GLSL = /* glsl */ `
${HEAD_GLSL}
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
  /** 1 along the wet rim of the lower lid. */
  float rim;
  /** Where on the iris, from its centre (units of the eye's radius), for the bulge of the cornea over it. */
  vec2 iris;
};

/** The eye's lids, in units of its radius (x toward the snout): where its corners lie, and the lower and upper lid. */
vec3 lids(vec2 e) {
  float span = max(0.0, 1.0 - e.x * e.x);
  float corner = -0.04 + 0.06 * e.x;
  return vec3(corner, corner - (0.12 + 0.12 * uEye) * pow(span, 0.8),
    corner + (0.06 + 0.21 * uEye) * pow(span, 0.5) * (1.0 + 0.15 * e.x));
}

/**
 * The skin round the eye at e (units of its radius) with its lids l: a heavy upper lid rolled over it with two folds
 * above, a sill and two folds below, fading out past its corners. Height in units of the radius, and how deep in a
 * crease it is (0..1).
 */
vec2 eyeFolds(vec2 e, vec3 l) {
  float span = max(0.0, 1.0 - e.x * e.x * 0.8);
  float up = e.y - (l.x + (0.06 + 0.21 * uEye) * span);
  float down = l.y - e.y;
  float wide = 1.0 - smoothstep(0.6, 1.5, abs(e.x));
  float roll = 0.32 * smoothstep(-0.1, 0.1, up) * (1.0 - smoothstep(0.08, 0.6, up));
  float sill = 0.1 * smoothstep(-0.1, 0.08, down) * (1.0 - smoothstep(0.08, 0.36, down));
  // Folds arch over the lid and sag under the eye, drawn out behind it toward the tail, each fading along its length.
  float x2 = e.x * e.x;
  float wave = vnoise(vec2(e.x * 1.7, 3.1));
  float fold1 = 0.7 * exp(-pow((up + 0.16 * x2 - 0.52) / 0.07, 2.0)) * (1.0 - smoothstep(0.6, 1.3, abs(e.x + 0.2)));
  float fold2 = exp(-pow((up + 0.22 * x2 - 0.86) / 0.07, 2.0)) * (1.0 - smoothstep(0.3, 1.1, abs(e.x + 0.3))) * (0.4 + 0.6 * wave);
  float fold3 = exp(-pow((down + 0.18 * x2 - 0.36) / 0.05, 2.0)) * (1.0 - smoothstep(0.5, 1.1, abs(e.x + 0.2)));
  float fold4 = exp(-pow((down + 0.2 * x2 - 0.62) / 0.06, 2.0)) * (1.0 - smoothstep(0.2, 0.85, abs(e.x + 0.35))) * (1.0 - 0.5 * wave);
  float crease = max(max(fold1, fold2 * 0.75), max(fold3 * 0.8, fold4 * 0.55));
  return vec2((roll + sill) * wide - 0.07 * crease, crease);
}

/**
 * Height in metres of the skin's small forms over the rest pose at r: the eye on its mound under a heavy lid, the
 * mouth line and the grooves of the throat, the knobs, the blowhole; fine fades the forms smaller than a pixel.
 */
float form(vec3 r, float flank, float fine) {
  // Broad soft swells over the skin, metres across, so the light on it is never that of moulded plastic.
  float swell = vnoise(r.zy * 2.6 + r.x) + 0.6 * vnoise(r.zx * 4.3 + 5.0);
  float h = (knobs(r) + 0.01 * swell) * uScale * fine;
  float below = jawBelow(r);
  float corner = 1.0 - smoothstep(${f(JAW_CORNER - 0.008)}, ${f(JAW_CORNER + 0.004)}, -r.z / ${f(LENGTH)});
  if (corner > 0.0 && flank > 0.0) {
    float gape = -0.02 * exp(-pow((below + 0.003) / 0.011, 2.0));
    float rim = 0.01 * smoothstep(0.0, 0.025, below) * (1.0 - smoothstep(0.03, 0.1, below));
    float g = max(below - 0.035, 0.0) / (0.045 + 0.25 * max(below - 0.035, 0.0));
    float groove = -0.005 * smoothstep(0.0, 0.5, g) * pow(0.5 + 0.5 * cos(6.2832 * g), 4.0);
    h += uScale * flank * corner * fine * (gape + rim + groove);
  }
  float R = uEyeAt.z * 0.08;
  vec2 e = vec2(r.z + uEyeAt.x * ${f(LENGTH)}, r.y - uEyeAt.y) / R;
  if (flank > 0.0 && length(e * vec2(0.62, 1.0)) < 2.8) {
    vec3 l = lids(e);
    float open = smoothstep(l.y - 0.04, l.y + 0.04, e.y) * (1.0 - smoothstep(l.z - 0.04, l.z + 0.04, e.y))
      * (1.0 - smoothstep(0.94, 1.0, abs(e.x)));
    vec2 lidForm = eyeFolds(e, l);
    float mound = 0.24 * (1.0 - smoothstep(0.0, 2.8, length(e * vec2(0.62, 1.0))));
    vec2 c = e - vec2(0.0, l.x);
    float ball = 0.45 * sqrt(max(0.0, 1.3 - dot(c, c))) - 0.43;
    h += R * uScale * flank * (mound + mix(lidForm.x, ball, open));
  }
  vec2 b = vec2(abs(r.x), r.z + ${f(BLOWHOLE * LENGTH)});
  if (b.x < 0.3 && abs(b.y) < 0.3) {
    vec2 slit = vec2(b.x - 0.07 - 0.04 * clamp(b.y / 0.2, -1.0, 1.0), b.y) / vec2(0.045, 0.2);
    h -= 0.03 * uScale * (1.0 - smoothstep(0.5, 1.1, length(slit)));
  }
  return h;
}

/** The skin at this fragment; far is 0 near and 1 where it is far enough off to lose its small marks. */
Skin skin(float far) {
  int part = int(vRig.y + 0.5);
  float s = vRig.x;
  vec3 rn = normalize(vRestNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float mottle = vnoise(vRest.zx * vec2(0.9, 1.6)) * 0.5 + vnoise(vRest.zy * 2.5 + 3.0) * 0.3 + vnoise(vRest.zy * 9.0 + 7.0) * 0.2;
  Skin k = Skin(uBack * (0.8 + 0.38 * mottle), 0.0, vec3(0.0), 0.0, 0.0, 0.0, 0.0, vec2(0.0));
  // A few old pale scratches drawn out along the body, lost in the distance.
  float scar = smoothstep(0.8, 0.88, vnoise(vec2(vRest.z * 1.8 + 11.0, (vRest.y + abs(vRest.x) * 0.5) * 26.0)))
    * (1.0 - far) * (1.0 - smoothstep(0.02, 0.05, fwidth(vRest.y * 26.0)));
  k.albedo = mix(k.albedo, uBelly * 0.85, scar * 0.2 * float(part == ${BODY}));
  if (part == ${BODY} || part == ${DORSAL}) {
    float h = part == ${BODY} ? vRig.w : 1.0;
    float below = jawBelow(vRest);
    float px = fwidth(vRest.y) + 0.002;
    float onJaw = (1.0 - smoothstep(${f(JAW_CORNER - 0.004)}, ${f(JAW_CORNER + 0.006)}, s)) * float(part == ${BODY});
    // The pale lip narrows to a point at the corner of the mouth, the cheek behind and under it slate.
    float taper = (${f(JAW_CORNER)} - s) * 16.0;
    float lip = smoothstep(-px, px, below + 0.002) * smoothstep(-px, px, taper - below) * onJaw;
    // Behind the jaw the throat and belly are a paler slate, so rolled over it is not a white hull.
    float throat = (1.0 - smoothstep(-0.62, -0.48, h + (mottle - 0.5) * 0.08)) * smoothstep(${f(JAW_CORNER)}, ${f(JAW_CORNER + 0.05)}, s)
      * (1.0 - smoothstep(0.55, 0.85, s));
    float pleat = max(below - 0.035, 0.0) / (0.045 + 0.25 * max(below - 0.035, 0.0));
    float groove = smoothstep(0.0, 0.5, pleat) * pow(0.5 + 0.5 * cos(6.2832 * pleat), 4.0) * (1.0 - smoothstep(0.3, 0.6, fwidth(pleat)));
    vec3 jawTone = uBelly * (0.92 + 0.1 * mottle) * (1.0 - 0.18 * groove) * mix(0.72, 1.0, smoothstep(0.0, 0.05, below))
      * mix(1.0, 0.72, smoothstep(0.06, 0.2, below));
    vec3 paleTone = mix(mix(uBack, uBelly, 0.45) * (0.92 + 0.1 * mottle), jawTone, lip);
    // Far off the lip greys into the slate, so the first sight of it is a long low shape before it is a jaw.
    paleTone = mix(paleTone, mix(uBack, uBelly, 0.3), far);
    k.albedo = mix(k.albedo, paleTone, max(lip, throat)) * (1.0 - 2.5 * knobs(vRest));
    k.albedo *= 1.0 - 0.45 * onJaw * (1.0 - 0.6 * far) * exp(-pow((below + 0.003) / max(0.008, px), 2.0));
    vec2 b = vec2(abs(vRest.x), vRest.z + ${f(BLOWHOLE * LENGTH)});
    vec2 slit = vec2(b.x - 0.07 - 0.04 * clamp(b.y / 0.2, -1.0, 1.0), b.y) / vec2(0.045, 0.2);
    k.albedo *= 1.0 - 0.75 * (1.0 - smoothstep(0.6, 1.0, length(slit))) * smoothstep(0.4, 0.7, rn.y);

    // Never emissive: its warmth is the light on the iris and the gloss of the glass.
    float R = uEyeAt.z * 0.08;
    vec2 e = vec2(vRest.z + uEyeAt.x * ${f(LENGTH)}, vRest.y - uEyeAt.y) / R;
    float flank = smoothstep(0.25, 0.45, abs(rn.x));
    vec3 l = lids(e);
    float aa = fwidth(e.y) + 0.015;
    float opening = smoothstep(l.y - aa, l.y + aa, e.y) * (1.0 - smoothstep(l.z - aa, l.z + aa, e.y))
      * (1.0 - smoothstep(1.0 - aa, 1.0, abs(e.x))) * flank;
    vec2 g = e - vec2(uGaze.x * 0.25, l.x + 0.03 + uGaze.y * 0.06);
    float rr = length(g);
    float iris = 1.0 - smoothstep(0.5 - aa, 0.5 + aa, rr);
    float pupil = 1.0 - smoothstep(0.19 - aa, 0.19 + aa, length(g * vec2(0.85, 1.15)));
    // A little wet white shows at its corners, greyed where the lids shade it.
    vec3 white = vec3(0.24, 0.19, 0.18) * mix(0.35, 1.0, smoothstep(0.98, 0.6, abs(e.x)));
    float fibres = 0.82 + 0.36 * vnoise(vec2(atan(g.y, g.x) * 9.0, rr * 5.0));
    vec3 amber = uIris * fibres * mix(1.2, 0.45, smoothstep(0.32, 0.5, rr)) * mix(0.6, 1.0, smoothstep(0.19, 0.27, rr));
    vec3 eye = mix(mix(white, amber, iris), vec3(0.014, 0.011, 0.01), pupil);
    float under = smoothstep(l.z - 0.4, l.z, e.y);
    eye *= 1.0 - 0.7 * under;
    vec2 folds = eyeFolds(e, l);
    k.albedo *= 1.0 - 0.32 * folds.y * flank * (1.0 - far);
    k.albedo = mix(k.albedo, eye, opening);
    k.gloss = opening;
    // The wet rim of the lower lid catches the sky.
    k.rim = (1.0 - smoothstep(0.0, 0.05, abs(e.y - l.y - 0.02))) * (1.0 - smoothstep(0.6, 0.9, abs(e.x))) * flank * uEye * (1.0 - far);
    // The top of the lower lip faces the sun, but a gold line along it would draw a mouth.
    float ledge = onJaw * (1.0 - smoothstep(0.0, 0.06, abs(below - 0.02)));
    k.near = max((1.0 - smoothstep(1.0, 1.6, length(e * vec2(0.8, 1.0)))) * flank, ledge);
    k.caustic = opening * iris * (1.0 - pupil) * smoothstep(0.1, -0.35, g.y) * (1.0 - under);
    k.iris = g * iris * opening;
    if (part == ${BODY}) {
      float d = 0.006;
      float fine = 1.0 - smoothstep(0.006, 0.02, fwidth(vRest.y) + fwidth(vRest.z));
      float f0 = form(vRest, flank, fine);
      k.slope = vec3(form(vRest + vec3(d, 0.0, 0.0), flank, fine) - f0, form(vRest + vec3(0.0, d, 0.0), flank, fine) - f0,
        form(vRest + vec3(0.0, 0.0, d), flank, fine) - f0) / d;
    }
  } else if (part == ${FIN}) {
    // The back's own slate, a little paler beneath, along the knobs of its leading edge and in a few blotches toward
    // the tip: lifted and turned it is still the whale's flipper, never a pale thing of its own.
    float top = smoothstep(-0.3, 0.3, rn.y);
    vec3 pale = mix(uBack, uBelly, 0.4) * (0.92 + 0.1 * mottle);
    float blotch = smoothstep(0.58, 0.78, vnoise(vRest.xz * 2.6 + 7.0)) * smoothstep(0.45, 0.85, vRig.z);
    float lead = 1.0 - smoothstep(0.0, 0.1, vRig.w);
    k.albedo = mix(uBack * (0.95 + 0.1 * mottle), pale, max(max((1.0 - top) * 0.55, lead * 0.45), blotch * 0.5));
    k.thin = 0.05;
  } else {
    // Its own marks under the flukes, the same wherever it is met: a ragged dark trailing edge and tips, a dark
    // stroke up from the notch, and two dark commas that do not match.
    float under = (1.0 - smoothstep(-0.15, 0.15, rn.y));
    float t = vRig.z;
    float a = vRig.w;
    float edge = smoothstep(0.6, 0.78, a + 0.07 * sin(t * 23.0) + 0.04 * sin(t * 51.0));
    float stroke = (1.0 - smoothstep(0.05, 0.11, abs(t + 0.03 * sin(a * 9.0)))) * smoothstep(0.2, 0.45, a);
    float left = 1.0 - smoothstep(0.08, 0.12, length(vec2((t + 0.47) * 0.8, a - 0.36 - 0.1 * (t + 0.47))));
    float right = 1.0 - smoothstep(0.05, 0.08, length(vec2(t - 0.6, (a - 0.52) * 1.4)));
    float tips = smoothstep(0.8, 0.95, abs(t));
    float lead = 1.0 - smoothstep(0.04, 0.12, a);
    float mark = max(max(max(edge, stroke), max(max(left, right), tips)), lead);
    k.albedo = mix(k.albedo * 0.8, uBelly * 1.08 * mix(0.78, 1.0, smoothstep(0.0, 0.5, abs(t))) * (0.9 + 0.15 * mottle), under * (1.0 - mark));
    k.thin = 0.12;
  }
  return k;
}
`;

/**
 * Its far length low on the sea melts into the morning: wet and glancing, it mirrors the dawn as the sea round it
 * does, so only the head and what stands clear of the water are crisp.
 */
const HAZE_GLSL = /* glsl */ `
uniform float uHaze;
vec3 hazed(vec3 col, vec3 world, float s) {
  vec3 V = normalize(cameraPosition - world);
  float far = smoothstep(${f(L.hazeFrom)}, ${f(L.hazeTo)}, distance(cameraPosition, world));
  float haze = uHaze * smoothstep(0.24, 0.72, s) * far * (1.0 - smoothstep(2.0, 9.0, world.y)) * ${f(L.haze)};
  vec3 sky = skyColor(vec3(-V.x, max(V.y, 0.02), -V.z));
  vec3 sea = mix(vec3(0.05, 0.29, 0.4) * uSkyAmbient * 1.1, sky, 0.02 + 0.4 * pow(1.0 - max(V.y, 0.0), 5.0));
  return applyFog(mix(col, sea, haze), world);
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
${HAZE_GLSL}
uniform vec3 uSeaTint;
uniform vec3 uShiver;
uniform vec3 uSlap;
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
  Skin k = skin(smoothstep(70.0, 140.0, distance(cameraPosition, vWorld)));
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
  // Cool sky fill keeps the shadowed flank slate rather than black against a low sun.
  float sky = dot(uSkyAmbient, vec3(0.3, 0.5, 0.2));
  int part = int(vRig.y + 0.5);
  // The flipper's broad top faces the open sky and the low sun more squarely than the flank it hangs from.
  vec3 fill = vec3(0.8, 0.88, 1.05) * sky * ${f(L.fill)} * (0.55 + 0.45 * N.y) * (part == ${FIN} ? 0.6 : 1.0);
  vec3 bounce = mix(uSkyHorizon, uSeaTint * sky * 3.0, 0.5) * ${f(L.bounce)} * sky * max(-N.y + 0.15, 0.0);
  vec3 col = k.albedo * (fill + bounce + uSunColor * (wrap * wrap * wrap * ${f(L.key)} * (part == ${FIN} ? 0.5 : 1.0) + 0.02) * sun);
  // Low on the flank the sea shades it, so the skin darkens down to the waterline.
  col *= mix(${f(L.waterline)}, 1.0, smoothstep(-0.5, 3.5, vWorld.y));
  col += k.albedo * uSunColor * sun * k.thin * back * max(-ndl, 0.0) * 1.4;
  col += uIris * uSunColor * sun * k.caustic * ${f(L.caustic)};

  float dry = smoothstep(0.0, 0.25, vWorld.y);
  float across = part == ${BODY} || part == ${DORSAL} ? vRig.z * 24.0 : dot(vRest.xz, vec2(5.0, 2.0));
  vec2 flow = vec2(across, vWorld.y * 1.1 + uTime * 1.9);
  float streak = smoothstep(0.7, 0.95, vnoise(vec2(flow.x * 2.5, flow.y)) * 0.75 + vnoise(vec2(flow.x * 7.0, flow.y * 3.0)) * 0.25);
  // Lifted out of the sea, the flipper streams with it.
  float sheet = max(vWet, part == ${FIN} ? clamp(uSlap.y * 30.0, 0.0, 1.0) : 0.0) * dry;

  vec3 R = reflect(-V, N);
  vec3 env = skyColor(vec3(R.x, max(R.y, 0.02), R.z));
  env = mix(env, uSeaTint * uSkyAmbient * 1.4, (1.0 - smoothstep(-0.3, 0.0, R.y)));
  float F = 0.03 + 0.97 * pow(1.0 - nv, 5.0);
  // Its back is wet from the sea it lies in: darker, and a mirror of the dawn at a glancing look.
  float wet = part == ${BODY} ? smoothstep(0.25, 0.8, N.y) * (1.0 - k.gloss) * (1.0 - k.near) : 0.0;
  col *= 1.0 - 0.25 * wet;
  col = mix(col, env, F * (0.25 + 0.5 * sheet + ${f(L.wet)} * wet + 0.6 * k.gloss) * (part == ${FIN} ? 0.45 : 1.0));
  vec3 H = halfVector(uSunDir, V);
  float nh = max(dot(N, H), 0.0);
  // Lying awash the flipper's blade faces the sky, and a sheen on it as broad as the back's would make it a pale thing.
  float sheen = part == ${FIN} ? ${f(L.sheen)} * 0.3 : ${f(L.sheen)};
  col += uSunColor * pow(nh, mix(mix(24.0, 70.0, wet), 160.0, sheet)) * (sheen * (1.0 + wet) + (0.8 + 3.0 * streak) * sheet) * sun * (1.0 - k.gloss) * (1.0 - 0.7 * k.near);
  col += vec3(0.85, 0.9, 0.95) * (uSkyAmbient * 0.7 + uSunColor * (0.1 + back * 0.8) * sun) * streak * sheet * 0.45;
  // A flipper lying flat is seen edge on all over, so only the body takes the rim along its silhouette.
  float rim = pow(1.0 - nv, ${f(L.rimPower)}) * smoothstep(-0.2, 0.5, N.y + ndl) * (part == ${FIN} ? 0.2 : 1.0);
  col += uSunColor * mix(vec3(1.0), k.albedo * 2.0, 0.35) * rim * (0.2 + back) * ${f(L.rim)} * sun * (1.0 - k.near);
  // Where the back turns away toward the low sun at its edge it draws one crisp gold line against the sea.
  float sunward = dot(N, normalize(vec3(uSunDir.x, 0.0, uSunDir.z)));
  float ridge = pow(1.0 - nv, ${f(L.ridgePower)}) * smoothstep(-0.05, 0.35, sunward + 0.3 * N.y) * float(part == ${BODY} || part == ${DORSAL});
  col += uSunColor * vec3(1.0, 0.82, 0.55) * ridge * back * ${f(L.ridge)} * sun * (1.0 - k.near);
  // The cornea bulges over the iris, so the sky it mirrors moves across it; the gold in it is the dawn behind.
  vec3 Nc = normalize(N + (vAxisZ * k.iris.x + vAxisY * k.iris.y) * 1.3);
  vec3 Rc = reflect(-V, Nc);
  vec3 seen = skyColor(vec3(Rc.x, max(Rc.y, 0.02), Rc.z));
  col += seen * k.gloss * (1.0 - k.caustic) * ${f(L.cornea)};
  col = mix(col, seen + uSkyAmbient, k.rim * 0.22);
  // The sun's own reflection would sit under the heavy lid, so the catchlight is the sky above.
  float glint = pow(max(dot(Nc, normalize(V + vec3(0.0, 0.55, 0.0) + vAxisZ * 0.25)), 0.0), 900.0);
  col += (uSunColor * 0.5 + uSkyHorizonSun) * glint * ${f(L.catchlight)} * k.gloss;

  gl_FragColor = vec4(hazed(col, vWorld, vRig.x), 1.0);
}`;

/** The submerged body seen through the sea: slid up its view ray to the surface, tinted and faded by the water. */
export const GHOST_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${RIG_GLSL}
out vec3 vSurface;
out float vDepth;
out vec3 vFacing;
void main() {
  vec3 n = normal;
  vec3 w = rig(position, n);
  vDepth = -w.y;
  vFacing = n;
  if (w.y < 0.04) w = cameraPosition + (w - cameraPosition) * (cameraPosition.y - 0.04) / max(cameraPosition.y - w.y, 1e-3);
  vSurface = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

export const GHOST_FRAG = /* glsl */ `
${ATMO_GLSL}
${SKIN_GLSL}
${HAZE_GLSL}
uniform vec3 uDeep;
uniform vec3 uAbsorb;
in vec3 vSurface;
in float vDepth;
in vec3 vFacing;
void main() {
  if (vDepth < -0.02) discard;
  float dist = distance(cameraPosition, vSurface);
  Skin k = skin(smoothstep(70.0, 140.0, dist));
  float depth = max(vDepth, 0.0);
  vec3 V = normalize(cameraPosition - vSurface);
  float nv = max(V.y, 0.02);
  float cosT = sqrt(max(1.0 - (1.0 - nv * nv) / 1.77, 0.05));
  float path = depth / cosT;
  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  float sun = cloudShadow(vSurface.xz);
  float sky = dot(uSkyAmbient, vec3(0.3, 0.5, 0.2));
  // The dawn comes down through the glass warm, so however deep it lies its shape is a soft warm shade, never a hole.
  vec3 light = max(uSkyAmbient * 1.2, vec3(0.78, 0.9, 1.08) * sky * ${f(L.glass)}) + uSunColor * max(uSunDir.y, 0.0) * 1.1 * sun
    + uSkyHorizonSun * sky * ${f(L.glassWarm)};
  vec3 deep = uDeep * (uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * sun);
  // Under the glass it is one soft shape: its pale jaw and the flipper just under would each show as a pale slab.
  vec3 seen = mix(k.albedo, uBack, 0.5) * light * exp(-uAbsorb * (path + depth)) * (int(vRig.y + 0.5) == ${FIN} ? 0.45 : 1.0);
  float clear = exp(-path * ${f(L.clarity)});
  vec3 col = mix(deep, seen, clear);
  // Its outline softens with depth, as the sea blurs a shape far down.
  float soft = smoothstep(0.0, mix(1.0, 0.2, clear), abs(dot(normalize(vFacing), V)));
  float deepShows = ${f(L.glassDeep)} * (1.0 - smoothstep(${f(L.glassFrom)}, ${f(L.glassFrom)} * 2.0, dist));
  float a = (1.0 - F) * soft * smoothstep(-0.02, 0.06, vDepth) * mix(deepShows, 0.75, clear)
    * (1.0 - 0.85 * smoothstep(${f(L.glassFrom)}, ${f(L.glassTo)}, dist));
  if (a < 0.004) discard;
  col = mix(stillGrey(col) * 1.05, col, 0.35 + 0.65 * uWorldLife);
  col = hazed(col, vSurface, vRig.x);
  gl_FragColor = vec4(col * a, a);
}`;
