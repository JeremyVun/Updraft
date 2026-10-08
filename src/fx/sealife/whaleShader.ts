import * as THREE from 'three';
import { CREATURE_GLSL } from '../../creatures/shading';
import { ATMO_GLSL } from '../../world/atmosphere';
import { tuning } from '../../tuning';
import { BLOWHOLE, BODY, DORSAL, DORSAL_AT, DORSAL_BASE, FIN, FIN_DIR, FIN_ROOT, FLUKES, FLUKE_HALF_SPAN, FLUKE_HINGE, JAW_CORNER, KNOBS, LENGTH, MOUTH, SPINE_END, STOCK_TURN } from './anatomy';
import { curve } from './curve';

export const SPINE_N = 44;
const f = (x: number) => x.toFixed(4);
const L = tuning.whaleLook;
const MOUTH_N = 32;
/** The open sea's deep colour, as the water has it. */
const SEA_DEEP = new THREE.Color('#0d4a66');
const rgb = (hex: string) => {
  const c = new THREE.Color(hex);
  return `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
};
/**
 * Where the sea meets it as the sleeper lays it at rest, in rest units up from the spine along its length (measured
 * at its middle; the roll tilts it across), so its growth stays on the skin wherever it swims.
 */
const REST_SEA = curve([
  [0, -0.255], [0.02, -0.232], [0.06, -0.186], [0.1, -0.141], [0.15, -0.086], [0.2, -0.041], [0.3, -0.01],
  [0.4, -0.016], [0.6, -0.017], [0.7, -0.011], [0.8, 0.026], [0.9, 0.102], [1, 0.2],
]);
const REST_SEA_N = 21;

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
/** How far the tail stock has turned its flukes about its own line. */
uniform float uTurn;
uniform vec2 uFin;
uniform float uCurl;
uniform float uScale;
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
  off *= uScale;
  float roll = uRoll + uTurn * smoothstep(${f(STOCK_TURN[0])}, ${f(STOCK_TURN[1])}, s);
  float cr = cos(roll), sr = sin(roll);
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
uniform vec3 uSlap;
uniform vec3 uShape;
in vec3 vRest;
in vec3 vRestNormal;
in vec4 vRig;
in float vWet;

/** How far the near flipper is lifted out of the sea, 0..1. */
float finRaised() {
  return step(0.5, sign(vRest.x) * uSlap.x) * clamp(uSlap.y / ${f(tuning.netWhale.finLift)}, 0.0, 1.0);
}

const float REST_SEA[${REST_SEA_N}] = float[](${Array.from({ length: REST_SEA_N }, (_, i) => f(REST_SEA(i / (REST_SEA_N - 1)))).join(', ')});

/** Metres above the sea at rest point r, s along, as it lies at rest. */
float overRestSea(vec3 r, float s) {
  float x = clamp(s, 0.0, 1.0) * ${f(REST_SEA_N - 1)};
  int i = min(int(x), ${REST_SEA_N - 2});
  return (r.y - mix(REST_SEA[i], REST_SEA[i + 1], x - float(i)) + ${f(Math.tan(tuning.netWhale.roll))} * r.x) * uScale;
}

/** Metres over the skin at rest point r: along the body toward the tail, and up its flank and over its back. */
vec2 overSkin(vec3 r) {
  return vec2(-r.z, r.y - abs(r.x)) * uScale;
}

/** How much of a mark size metres across still shows where a pixel spans px metres: none once it is under a pixel. */
float shows(float size, float px) {
  return smoothstep(1.0, 3.0, size / px);
}

/**
 * The sea pouring off it after a breath, m metres over the skin and h metres above the sea, its front come down to
 * \`front\` m above the sea, as much of it as \`amount\` (0..1): broad falls over the ridge and down the flank, each
 * wandering a little, that part into threads as they near the waterline and narrow to their middles as they drain.
 * As much as \`full\` (0..1) pours in those falls; the rest runs off as a faint sheen streaming down the whole skin.
 * Gives how much a fall covers here, how full it runs there, the water streaming down it, and where a drop in it glints.
 */
vec4 falls(vec2 m, float h, float front, float amount, float px, float full) {
  float x = m.x + (vnoise(vec2(m.x * 0.18, m.y * 0.3 + 4.0)) - 0.5) * 2.4;
  float lane = vnoise(vec2(x * 0.42, 2.7)) * 0.7 + vnoise(vec2(x * 1.3, 8.1 + m.y * 0.1)) * 0.3;
  float low = 1.0 - smoothstep(0.4, 2.4, h);
  float parted = mix(1.0, 0.45 + 0.85 * vnoise(vec2(x * 2.6, m.y * 0.2 + 5.0)), low * shows(0.4, px));
  float inside = lane * parted - mix(0.74, 0.5, amount * 1.25);
  // Each fall's front comes down at its own pace.
  float tongue = front + (vnoise(vec2(x * 0.55, 9.0)) - 0.5) * 1.4;
  float reached = smoothstep(tongue - 0.3, tongue + 0.35, h);
  float run = vnoise(vec2(x * 5.0, m.y * 0.45 + uTime * 2.4)) * 0.65 + vnoise(vec2(x * 12.0, m.y * 1.1 + uTime * 3.8)) * 0.35 * shows(0.12, px);
  float lead = 1.0 - smoothstep(0.0, 0.9, h - tongue);
  float glint = smoothstep(0.86, 0.97, vnoise(vec2(x * 11.0, m.y * 1.3 + uTime * 5.0))) * shows(0.08, px);
  float cover = smoothstep(0.0, 0.12, inside) * reached;
  float sheen = reached * (0.6 + 0.4 * lane) * ${f(tuning.netWhale.sheen)};
  return vec4(mix(sheen, cover, full), smoothstep(0.02, 0.3, inside) * full, clamp(run + 0.4 * lead, 0.0, 1.0), glint * cover * full);
}

/**
 * One scatter of shells where \`where\` (0..1) calls for them, m metres over the skin, in cells \`cell\` metres across:
 * how much a shell covers here, its light (pale on top, shaded under), and the soft shade it casts on the skin below.
 */
vec3 shells(vec2 m, float where, float cell, float px) {
  vec2 c = m / cell;
  vec2 id = floor(c);
  if (hash12(id + 17.3) > where) return vec3(0.0, 1.0, 0.0);
  float r = min(0.5, (0.16 + 0.26 * hash12(id + 4.1)) * (0.8 + 0.4 * where));
  vec2 d = (fract(c) - 0.5 - (vec2(hash12(id + 9.7), hash12(id + 2.9)) - 0.5) * (1.0 - 2.0 * r)) / r;
  float q = dot(d, d) * (1.0 + 0.14 * sin(3.0 * atan(d.y, d.x) + 6.2832 * hash12(id + 5.3)));
  float aa = 2.0 * px / (r * cell) + 0.12;
  float seen = smoothstep(3.0, 7.0, 2.0 * r * cell / px);
  vec2 below = d + vec2(0.0, 0.45);
  float under = smoothstep(0.9, 1.1, q) * (1.0 - smoothstep(0.8, 1.6, dot(below, below))) * seen;
  return vec3((1.0 - smoothstep(1.0 - aa, 1.0, q)) * seen, (0.78 + 0.2 * d.y - 0.12 * q) * (0.88 + 0.2 * hash12(id + 1.3)), under);
}

/** Barnacles: three scatters of shells of their own sizes, so no grid shows; soft domes, never pits. */
vec3 barnacles(vec2 m, float where, float px) {
  vec3 a = shells(m, where, 0.62, px);
  vec3 b = shells(m + vec2(0.13, 0.27), where * 0.9, 0.38, px);
  vec3 c = shells(m + vec2(0.41, 0.07), where * 0.8, 0.22, px);
  vec3 ab = a.x > b.x ? vec3(a.xy, max(a.z, b.z * (1.0 - a.x))) : vec3(b.xy, max(b.z, a.z * (1.0 - b.x)));
  return ab.x > c.x ? vec3(ab.xy, max(ab.z, c.z * (1.0 - ab.x))) : vec3(c.xy, max(c.z, ab.z * (1.0 - c.x)));
}

const vec2 SCAR_CELL = vec2(5.0, 2.6);

/**
 * The scar whose cell is id, if that cell has one (a share of them do): a soft pale mark drawn out along the body,
 * fading out at its ends and across it into the skin, the old healed skin a little paler. How pale it is at m. Too
 * small on the screen to be seen as skin it would read as a drawn stroke, so it is only there close enough.
 */
float scarIn(vec2 m, vec2 id, float share, float px) {
  if (hash12(id + 41.0) > share) return 0.0;
  float len = 0.9 + 1.0 * hash12(id + 8.0);
  vec2 p = m - (id + vec2(hash12(id + 11.0), hash12(id + 13.0))) * SCAR_CELL;
  float a = (hash12(id + 5.0) - 0.5) * 0.5;
  p = vec2(cos(a) * p.x + sin(a) * p.y, cos(a) * p.y - sin(a) * p.x);
  float h = hash12(id + 2.0);
  p.y -= (h - 0.5) * 0.15 * p.x * p.x / len + 0.05 * sin(p.x * 1.6 + h * 6.0);
  float along = abs(p.x) / len;
  float w = (0.2 + 0.12 * hash12(id + 29.0)) * (1.0 - smoothstep(0.3, 1.0, along));
  float mark = exp(-pow(p.y / max(w, 1e-3), 2.0)) * (1.0 - smoothstep(0.4, 1.0, along));
  return mark * (0.7 + 0.3 * hash12(id + 31.0)) * smoothstep(${f(L.scarSeen[0])}, ${f(L.scarSeen[1])}, 0.26 / px);
}

/** Old healed scars, m metres over the skin, in a share of the cells: the strongest of the nine cells round m. */
float scars(vec2 m, float share, float px) {
  vec2 i0 = floor(m / SCAR_CELL);
  float s = 0.0;
  for (int i = 0; i < 9; i++) s = max(s, scarIn(m, i0 + vec2(float(i % 3) - 1.0, float(i / 3) - 1.0), share, px));
  return s;
}

/**
 * The lichen rosette in cell id of a scatter \`cell\` metres across, if it has one (more where \`where\` is high, and
 * larger): its cover at m, round with a lobed edge, paler at its rim than its heart.
 */
float rosette(vec2 m, vec2 id, float cell, float where, float px) {
  if (hash12(id + 91.0) > where) return 0.0;
  vec2 d = m - (id + 0.25 + 0.5 * vec2(hash12(id + 95.0), hash12(id + 97.0))) * cell;
  float r = cell * (0.16 + 0.24 * hash12(id + 93.0)) * (0.7 + 0.4 * where);
  float q = length(d * vec2(1.0, 0.8 + 0.4 * hash12(id + 98.0))) / r;
  float edge = 1.0 + 0.5 * (vnoise(d / r * 1.6 + id * 7.31) - 0.5) + 0.2 * (vnoise(d / r * 4.0 + id * 3.7) - 0.5);
  float aa = px / r;
  return (1.0 - smoothstep(edge - aa, edge + aa, q)) * (0.85 + 0.15 * smoothstep(0.3, 0.9, q / edge));
}

/** The strongest of the four rosettes round m in a scatter \`cell\` metres across. */
float rosettes(vec2 m, float cell, float where, float px) {
  vec2 i0 = floor(m / cell - 0.5);
  return max(max(rosette(m, i0, cell, where, px), rosette(m, i0 + vec2(1.0, 0.0), cell, where, px)),
    max(rosette(m, i0 + vec2(0.0, 1.0), cell, where, px), rosette(m, i0 + vec2(1.0, 1.0), cell, where, px)));
}

/**
 * Lichen as on an old rock, m metres over the skin, in colonies covering about \`cover\` (0..1) of it: rosettes with
 * lobed, painted edges, each its own size, crowding and merging at a colony's heart and scattering into small flecks
 * at its edges. How much covers here, and a tone that varies patch to patch (0..1).
 */
vec2 lichen(vec2 m, float cover, float px) {
  float colony = smoothstep(0.3, 0.75, vnoise(m * 0.2 + 41.0) * 0.7 + vnoise(m * 0.55 + 7.0) * 0.3 + cover - 0.3);
  float tone = vnoise(m * 0.4 + 17.0);
  if (colony <= 0.0) return vec2(0.0, tone);
  float big = rosettes(m, 1.3, colony * 0.9, px) * shows(0.5, px);
  float small = rosettes(m + 0.31, 0.45, colony * 0.75 + 0.1 * cover, px) * shows(0.3, px);
  float far = colony * 0.3 * (1.0 - shows(0.5, px));
  return vec2(max(max(big, small), far), tone);
}

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
  /** 1 on a barnacle, which is dry and matte. */
  float crust;
  /** 1 along a wet run down from the top. */
  float run;
};

/** The eye's lids, in units of its radius (x toward the snout): where its corners lie, and the lower and upper lid. */
vec3 lids(vec2 e) {
  float span = max(0.0, 1.0 - e.x * e.x);
  float corner = -0.04 + 0.06 * e.x;
  return vec3(corner, corner - (0.12 + 0.15 * uEye) * pow(span, 0.6),
    corner + (0.06 + 0.26 * uEye) * pow(span, 0.42) * (1.0 + 0.12 * e.x));
}

/**
 * The skin round the eye at e (units of its radius) with its lids l: a heavy upper lid rolled over it with two folds
 * above, a sill and two folds below, fading out past its corners. Height in units of the radius, and how deep in a
 * crease it is (0..1).
 */
vec2 eyeFolds(vec2 e, vec3 l) {
  float span = max(0.0, 1.0 - e.x * e.x * 0.8);
  float up = e.y - (l.x + (0.06 + 0.26 * uEye) * span);
  float down = l.y - e.y;
  float wide = 1.0 - smoothstep(0.6, 1.5, abs(e.x));
  // An old lid is layers of skin rather than one smooth roll, which would read as a person's.
  float wave = vnoise(vec2(e.x * 1.7, 3.1));
  float roll = (0.14 + 0.08 * wave) * smoothstep(-0.1, 0.1, up) * (1.0 - smoothstep(0.08, 0.45, up));
  float sill = 0.1 * smoothstep(-0.1, 0.08, down) * (1.0 - smoothstep(0.08, 0.36, down));
  // Folds arch over the lid and sag under the eye, drawn out behind it toward the tail, each fading along its length.
  float x2 = e.x * e.x;
  float fold0 = 0.6 * exp(-pow((up + 0.1 * x2 - 0.28) / 0.05, 2.0)) * (1.0 - smoothstep(0.7, 1.2, abs(e.x + 0.1)));
  float fold1 = 0.7 * exp(-pow((up + 0.16 * x2 - 0.52) / 0.07, 2.0)) * (1.0 - smoothstep(0.6, 1.3, abs(e.x + 0.2)));
  float fold2 = exp(-pow((up + 0.22 * x2 - 0.86) / 0.07, 2.0)) * (1.0 - smoothstep(0.3, 1.1, abs(e.x + 0.3))) * (0.4 + 0.6 * wave);
  float fold3 = exp(-pow((down + 0.18 * x2 - 0.36) / 0.05, 2.0)) * (1.0 - smoothstep(0.5, 1.1, abs(e.x + 0.2)));
  float fold4 = exp(-pow((down + 0.2 * x2 - 0.62) / 0.06, 2.0)) * (1.0 - smoothstep(0.2, 0.85, abs(e.x + 0.35))) * (1.0 - 0.5 * wave);
  float crease = max(max(max(fold0, fold1), fold2 * 0.75), max(fold3 * 0.8, fold4 * 0.55));
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

/**
 * The skin at this fragment; far is 0 near and 1 where it is far enough off to lose its small marks, dry 1 in the air
 * and less under the glass, where the sea softens its marks.
 */
Skin skin(float far, float dry) {
  int part = int(vRig.y + 0.5);
  float s = vRig.x;
  vec3 rn = normalize(vRestNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float mottle = vnoise(vRest.zx * vec2(0.9, 1.6)) * 0.5 + vnoise(vRest.zy * 2.5 + 3.0) * 0.3 + vnoise(vRest.zy * 9.0 + 7.0) * 0.2;
  vec2 m = part == ${FIN} ? vRest.xz * uScale * uShape.x : overSkin(vRest);
  float px = length(fwidth(m)) + 1e-4;
  float n0 = vnoise(m * 0.06 + 5.3);
  float n1 = vnoise(m * 0.8 + 31.0);
  float n2 = vnoise(m * 2.3 + 7.0);
  float R = uEyeAt.z * 0.08;
  vec2 e = vec2(vRest.z + uEyeAt.x * ${f(LENGTH)}, vRest.y - uEyeAt.y) / R;
  float flank = smoothstep(0.25, 0.45, abs(rn.x));
  // How far out from the eye and the folds round it, 1 at their edge.
  float face = length(e * vec2(0.62, 0.87));
  // Broad soft patches of tone, as a painter lays in a great rock, a soft grain over them, and lichen, thick in some
  // places and bare in others, thicker about the eye but clear of it.
  vec3 base = uBack * (0.94 + 0.12 * mottle) * (${f(1 - L.tone)} + ${f(2 * L.tone)} * smoothstep(0.2, 0.8, n0));
  float grain = (vnoise(m * 6.0 + 1.7) - 0.5) * shows(0.16, px) + 0.6 * (vnoise(m * 15.0 + 4.1) - 0.5) * shows(0.07, px);
  base *= 1.0 + ${f(L.grain)} * grain;
  // It gathers on the head and along the top of the back, as on the top of an old rock, and thins down the flank; the
  // flukes carry only a little, on top.
  float up = part == ${BODY} ? vRig.w : part == ${FLUKES} ? 0.0 : 1.0;
  float gather = mix(${f(L.lichenFlank)}, 1.0, smoothstep(0.45, 0.9, up + 0.25 * (1.0 - smoothstep(0.2, 0.32, s))));
  float thick = ${f(L.lichenCover)} * gather * (0.3 + 1.1 * smoothstep(0.25, 0.75, n0 + 0.3 * (n1 - 0.5)))
    + 0.22 * (1.0 - smoothstep(1.2, 3.0, face)) * flank;
  vec2 lich = lichen(m, thick, px);
  vec3 lichTone = mix(${rgb(L.lichen)}, ${rgb(L.lichenWarm)}, smoothstep(0.62, 0.85, lich.y)) * (0.9 + 0.2 * lich.y);
  // Low on its flanks the sea's weed has it rather than lichen.
  float onBody = float(part == ${BODY});
  float lichOn = ${f(L.lichenAmount)} * mix(0.5, 1.0, dry) * (1.0 - 0.85 * (1.0 - smoothstep(0.8, 1.1, face)) * flank * onBody)
    * (1.0 - onBody * (1.0 - smoothstep(0.6, 1.8, overRestSea(vRest, s))));
  base = mix(base, lichTone, lich.x * lichOn);
  Skin k = Skin(base, 0.0, vec3(0.0), 0.0, 0.0, 0.0, 0.0, vec2(0.0), 0.0, 0.0);
  if (part == ${BODY} || part == ${DORSAL}) {
    float h = part == ${BODY} ? vRig.w : 1.0;
    float below = jawBelow(vRest);
    float pr = fwidth(vRest.y) + 0.002;
    float onJaw = (1.0 - smoothstep(${f(JAW_CORNER - 0.004)}, ${f(JAW_CORNER + 0.006)}, s)) * float(part == ${BODY});
    // The pale lip narrows to a point at the corner of the mouth, the cheek behind and under it slate.
    float taper = (${f(JAW_CORNER)} - s) * 16.0;
    float lip = smoothstep(-pr, pr, below + 0.002) * smoothstep(-pr, pr, taper - below) * onJaw;
    // Behind the jaw the throat and belly are a paler slate, so rolled over it is not a white hull.
    float throat = (1.0 - smoothstep(-0.62, -0.48, h + (mottle - 0.5) * 0.08)) * smoothstep(${f(JAW_CORNER)}, ${f(JAW_CORNER + 0.05)}, s)
      * (1.0 - smoothstep(0.5, 0.7, s));
    float pleat = max(below - 0.035, 0.0) / (0.045 + 0.25 * max(below - 0.035, 0.0));
    float groove = smoothstep(0.0, 0.5, pleat) * pow(0.5 + 0.5 * cos(6.2832 * pleat), 4.0) * (1.0 - smoothstep(0.3, 0.6, fwidth(pleat)));
    vec3 jawTone = uBelly * (0.92 + 0.1 * mottle) * (1.0 - 0.18 * groove) * mix(0.72, 1.0, smoothstep(0.0, 0.05, below))
      * mix(1.0, 0.72, smoothstep(0.06, 0.2, below));
    vec3 paleTone = mix(mix(uBack, uBelly, 0.45) * (0.92 + 0.1 * mottle), jawTone, lip);
    // Far off the lip greys into the slate, so the first sight of it is a long low shape before it is a jaw.
    paleTone = mix(paleTone, mix(uBack, uBelly, 0.3), far);
    float knobbed = knobs(vRest);
    k.albedo = mix(k.albedo, paleTone, max(lip, throat)) * (1.0 - 2.5 * knobbed);
    k.albedo *= 1.0 - 0.45 * onJaw * (1.0 - 0.6 * far) * exp(-pow((below + 0.003) / max(0.008, pr), 2.0));
    vec2 b = vec2(abs(vRest.x), vRest.z + ${f(BLOWHOLE * LENGTH)});
    vec2 slit = vec2(b.x - 0.07 - 0.04 * clamp(b.y / 0.2, -1.0, 1.0), b.y) / vec2(0.045, 0.2);
    k.albedo *= 1.0 - 0.75 * (1.0 - smoothstep(0.6, 1.0, length(slit))) * smoothstep(0.4, 0.7, rn.y);

    float clear = 1.0 - (1.0 - smoothstep(1.05, 1.4, face)) * flank;
    if (part == ${BODY}) {
      float above = overRestSea(vRest, s);
      // Its old scars are thicker about the head and down its flanks, where it is seen close.
      float scar = scars(m, ${f(L.scars)} * (1.0 + smoothstep(0.45, 0.2, s)) * (0.2 + flank), px) * clear * dry;
      k.albedo = mix(k.albedo, ${rgb(L.scar)} * (0.92 + 0.16 * n2), scar * ${f(L.scarAmount)});
      // Barnacles crust the head in small tight patches, along the chin and the lip, round its knobs and about the eye,
      // but never on the eye or in its folds; a few stray ones about each patch.
      float head = (1.0 - smoothstep(0.2, 0.3, s)) * dry;
      if (head > 0.0) {
        float eyeClear = 1.0 - (1.0 - smoothstep(0.95, 1.15, face)) * flank;
        float chin = smoothstep(0.0, 0.02, below) * onJaw;
        float lipLine = exp(-pow((below + 0.015) / 0.035, 2.0)) * (1.0 - smoothstep(${f(JAW_CORNER)}, ${f(JAW_CORNER + 0.03)}, s));
        float nearEye = (1.0 - smoothstep(1.6, 2.8, face)) * flank;
        float bias = max(max(0.24 * smoothstep(0.0, 0.004, knobbed), 0.14 * chin), max(0.16 * lipLine, 0.1 * nearEye));
        float crustAt = vnoise(m * 0.9 + 11.0) * 0.6 + vnoise(m * 2.4 + 4.0) * 0.4;
        float near = head * eyeClear * smoothstep(0.52, 0.68, crustAt + bias);
        if (near > 0.0) {
          float where = near * smoothstep(0.71, 0.74, crustAt + bias);
          // The crust stands a little proud, so it shades the skin just under its lower edge.
          vec2 up = m + vec2(0.0, 0.14);
          float overhang = vnoise(up * 0.9 + 11.0) * 0.6 + vnoise(up * 2.4 + 4.0) * 0.4 + bias;
          k.albedo *= 1.0 - 0.35 * near * smoothstep(0.71, 0.74, overhang) * (1.0 - where) * shows(0.14, px);
          vec3 crust = barnacles(m, max(where * ${f(L.crustShells)}, 0.12 * near), px);
          // A patch is one pale lumpy crust, its shells the light and shade over it; strays about it stand on the skin.
          vec3 crustTone = mix(${rgb(L.crust)}, mix(${rgb(L.crust)}, uBack, 0.4), lip);
          float lumpy = 0.85 + 0.3 * vnoise(m * 3.0 + 3.0);
          k.albedo = mix(k.albedo, crustTone * 0.75 * lumpy, where * mix(0.32, 0.4, 1.0 - shows(0.2, px)));
          k.albedo *= 1.0 - mix(0.3, 0.5, lip) * crust.z;
          k.albedo = mix(k.albedo, crustTone * crust.y, crust.x * (1.0 - 0.5 * where));
          k.albedo *= mix(1.0, 0.75 + 0.4 * crust.y, crust.x * where);
          k.crust = max(crust.x, where);
        }
      }
      // Weed where the sea lies on it at rest, ragged along its top and dark and mossy by turns, and above it in places
      // the faint yellow film old whales carry; kept off the pale lip.
      float top = ${f(L.growthReach)} * (0.4 + 0.9 * vnoise(vec2(m.x * 0.3, 1.3)))
        + 0.35 * (vnoise(m * vec2(1.4, 2.0) + 7.7) - 0.5) + 0.18 * (vnoise(m * 4.5 + 3.3) - 0.5) * shows(0.12, px);
      // The tail stock stands up out of the sea as it dives, one old surface without the weed of the waterline.
      float stock = 1.0 - smoothstep(0.74, 0.84, s);
      float grown = (1.0 - smoothstep(top - 0.02 - px, top + 0.02 + px, above)) * smoothstep(-1.6, -0.4, above) * (1.0 - 0.7 * lip) * stock;
      float moss = smoothstep(0.45, 0.6, vnoise(m * vec2(1.1, 1.6) + 4.0)) * smoothstep(-0.4, 0.2, above);
      vec3 weed = mix(${rgb(L.growth)}, ${rgb(L.moss)}, moss) * (0.85 + 0.3 * n2);
      float film = stock * smoothstep(0.5, 0.72, vnoise(m * vec2(0.22, 0.5) + 13.0)) * smoothstep(top - 0.1, top + 0.1, above)
        * (1.0 - smoothstep(top, top + 1.6 * ${f(L.growthReach)} + 0.6, above));
      k.albedo = mix(k.albedo, ${rgb(L.film)}, film * 0.25 * clear * (1.0 - lip));
      k.albedo = mix(k.albedo, weed, grown * 0.85 * clear);
      k.run = smoothstep(0.7, 0.85, vnoise(vec2(m.x * 0.45, m.y * 0.12 + 3.0))) * smoothstep(1.5, 3.5, above) * (1.0 - k.crust);
    }

    // Never emissive: its warmth is the light on the iris and the gloss of the glass.
    vec3 l = lids(e);
    float aa = fwidth(e.y) + 0.015;
    float opening = smoothstep(l.y - aa, l.y + aa, e.y) * (1.0 - smoothstep(l.z - aa, l.z + aa, e.y))
      * (1.0 - smoothstep(1.0 - aa, 1.0, abs(e.x))) * flank;
    vec2 g = e - vec2(uGaze.x * 0.25, l.x + 0.03 + uGaze.y * 0.06);
    float rr = length(g);
    float iris = 1.0 - smoothstep(0.5 - aa, 0.5 + aa, rr);
    float pupil = 1.0 - smoothstep(0.19 - aa, 0.19 + aa, length(g * vec2(0.85, 1.15)));
    // At its corners only a dark wet rim, never a white: a white makes it a person's eye.
    vec3 white = vec3(0.1, 0.06, 0.045) * mix(0.35, 1.0, smoothstep(0.98, 0.6, abs(e.x)));
    float fibres = 0.8 + 0.4 * vnoise(vec2(atan(g.y, g.x) * 9.0, rr * 5.0));
    // Deep warm brown, lighter in a ring round the pupil and darkening to its edge.
    vec3 brown = uIris * fibres * (1.0 + 0.9 * (1.0 - smoothstep(0.2, 0.38, rr))) * (1.0 - 0.6 * smoothstep(0.38, 0.5, rr));
    vec3 eye = mix(mix(white, brown, iris), vec3(0.014, 0.011, 0.01), pupil);
    float under = smoothstep(l.z - 0.4, l.z, e.y);
    eye *= 1.0 - 0.7 * under;
    vec2 folds = eyeFolds(e, l);
    // Lines of age fan back from its rear corner: an old face that has smiled, never a stern one.
    float lines = 0.0;
    vec2 c = e - vec2(-1.02, -0.02);
    if (c.x < 0.0 && c.x > -1.2) {
      float fan = atan(c.y, -c.x);
      float reach = length(c * vec2(1.0, 1.4));
      lines = pow(abs(cos(fan * 4.2 + 0.5 * vnoise(vec2(reach * 2.5, fan * 2.0)))), 24.0)
        * smoothstep(0.1, 0.25, reach) * (1.0 - smoothstep(0.45, 1.05, reach)) * (1.0 - smoothstep(0.75, 1.1, abs(fan)));
    }
    // Beyond its folds a few long soft creases arch over it and sweep back toward the tail, the skin worn into lines.
    float crease = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float x = e.x + 0.4 + 0.25 * fi;
      float arc = 1.28 + 0.3 * fi - (0.12 - 0.02 * fi) * x * x + 0.04 * sin(e.x * 3.0 + fi * 2.0);
      float reach = (1.0 - smoothstep(1.0 + 0.3 * fi, 2.0 + 0.4 * fi, abs(x + 0.3))) * (1.0 - 0.3 * fi);
      crease = max(crease, (1.0 - smoothstep(0.02, 0.04 + aa, abs(e.y - arc))) * reach);
    }
    k.albedo *= (1.0 - 0.32 * folds.y * flank * (1.0 - far)) * (1.0 - 0.3 * lines * flank * (1.0 - far))
      * (1.0 - ${f(L.creases)} * crease * flank * (1.0 - far) * shows(0.06 * R * uScale, px));
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
    k.albedo = mix(k.albedo, pale, max(max((1.0 - top) * 0.25, lead * 0.25), blotch * 0.3));
    // Lifted out of the sea it is one long pale paddle, wet and full of the sky.
    k.albedo = mix(k.albedo, mix(uBelly, vec3(0.92, 0.94, 0.96), 0.3) * (0.95 + 0.08 * mottle), 0.8 * finRaised());
    // Barnacles along its knobbly leading edge and round its tip, and a few along the trailing edge.
    float edges = max(max(1.0 - smoothstep(0.0, 0.2, vRig.w), smoothstep(0.8, 0.96, vRig.z)), 0.4 * smoothstep(0.85, 1.0, vRig.w));
    float where = edges * smoothstep(0.08, 0.2, vRig.z) * (0.3 + 0.6 * smoothstep(0.4, 0.6, n1 * 0.7 + n2 * 0.3)) * dry;
    vec3 crust = barnacles(m, where, px);
    k.albedo *= 1.0 - 0.35 * crust.z;
    k.albedo = mix(k.albedo, ${rgb(L.crust)} * crust.y, crust.x);
    k.crust = crust.x;
    k.thin = 0.05;
  } else {
    // Under the flukes, pale with a dark margin, and its own few old marks, the same wherever it is met: the leading
    // edge, the scalloped trailing edge and the tips dark, a dark wedge up from the notch into the tail stock, a dark
    // comma on the left fluke, a round spot on the right that does not match it, and a few specks. Barnacles sit
    // along the edges, most toward the tips. Above, they are the back's own slate.
    float under = 1.0 - smoothstep(-0.2, 0.2, rn.y);
    float t = vRig.z;
    float at = abs(t);
    float a = vRig.w;
    vec2 fm = vRest.xz * uScale * uShape.z;
    float fpx = length(fwidth(fm)) + 1e-4;
    float wob = vnoise(fm * 0.35 + 3.0) - 0.5;
    float wob2 = vnoise(fm * 1.1 + 9.0) - 0.5;
    float soft = 0.025 + fwidth(a);
    // The dark of the trailing edge reaches into the pale in a few soft tongues, as a painted margin does.
    float tongues = smoothstep(0.55, 0.85, vnoise(vec2(t * 9.0, 2.0))) * 0.07 + 0.03 * wob2;
    float trailing = smoothstep(0.87 - soft, 0.87 + soft, a + 0.05 * wob + tongues + 0.04 * smoothstep(0.55, 0.9, at));
    float leading = 1.0 - smoothstep(0.07 - soft, 0.07 + soft, a + 0.04 * wob - 0.03 * smoothstep(0.6, 0.95, at));
    float tips = smoothstep(0.86, 0.93, at + 0.04 * wob);
    float wedge = 1.0 - smoothstep(0.0, 0.03 + fwidth(at), at - 0.04 - 0.15 * (1.0 - a) * (1.0 - a) - 0.03 * wob2);
    // The comma: a round head and a tail that tapers as it curls away toward the trailing edge (span stretched to
    // about the chord's scale, so it keeps its shape).
    vec2 cp = vec2((t + 0.45) * 2.4, a - 0.4);
    float comma = length(cp) - 0.08;
    const vec2 TAIL[4] = vec2[](vec2(0.0), vec2(0.03, 0.1), vec2(0.0, 0.19), vec2(-0.08, 0.24));
    for (int i = 0; i < 3; i++) {
      vec2 d = TAIL[i + 1] - TAIL[i];
      float h = clamp(dot(cp - TAIL[i], d) / dot(d, d), 0.0, 1.0);
      comma = min(comma, length(cp - TAIL[i] - d * h) - 0.07 * (1.0 - (float(i) + h) / 3.0));
    }
    comma = 1.0 - smoothstep(0.0, 0.01 + fwidth(a) * 1.5, comma + 0.01 * wob2);
    vec2 sp = vec2((t - 0.6) * 2.4, a - 0.52);
    float spot = 1.0 - smoothstep(0.06, 0.075 + fwidth(a) * 2.0, length(sp * vec2(1.0, 1.2)) + 0.015 * wob2);
    vec2 cell = floor(fm / 2.2);
    vec2 fc = fract(fm / 2.2) - 0.5 - (vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5) * 0.6;
    float speck = (1.0 - smoothstep(0.08, 0.13, length(fc))) * step(0.9, hash12(cell + 1.9)) * smoothstep(0.25, 0.4, a) * (1.0 - smoothstep(0.7, 0.78, a));
    float mark = max(max(max(trailing, leading), max(tips, wedge)), max(max(comma, spot), speck));
    // Old pale skin rather than paint: soft grey clouding, greyer toward the root, and a few faint old scratches.
    float clouds = smoothstep(0.35, 0.8, vnoise(fm * 0.3 + 5.0)) * 0.1 + 0.06 * (1.0 - smoothstep(0.1, 0.45, at));
    float scratch = (1.0 - smoothstep(0.0, 0.012 + fwidth(t), abs(fract(t * 6.0 + 0.4 * a + 0.2 * wob) - 0.5) - 0.48))
      * step(0.55, hash12(vec2(floor(t * 6.0 + 0.4 * a + 0.2 * wob), 4.0))) * smoothstep(0.2, 0.35, a) * (1.0 - smoothstep(0.6, 0.75, a));
    vec3 pale = uBelly * ${f(L.flukePale)} * (0.95 + 0.06 * mottle + 0.04 * wob) * (1.0 - clouds) * (1.0 - 0.12 * scratch);
    vec3 dark = uBack * 0.7 * (0.9 + 0.15 * mottle);
    k.albedo = mix(k.albedo * 0.85, mix(pale, dark, mark), under);
    float edges = max(smoothstep(0.86, 0.97, a) * (0.35 + 0.65 * smoothstep(0.3, 0.85, at)), (1.0 - smoothstep(0.0, 0.07, a)) * smoothstep(0.45, 0.85, at));
    float where = edges * smoothstep(0.45, 0.7, vnoise(fm * 0.25 + 21.0) * 0.7 + wob2 * 0.6 + 0.3) * ${f(L.flukeShells)} * dry;
    vec3 crust = barnacles(fm, where, fpx);
    k.albedo *= 1.0 - 0.35 * crust.z;
    k.albedo = mix(k.albedo, ${rgb(L.crust)} * crust.y, crust.x);
    k.crust = crust.x;
    k.thin = 0.12;
  }
  return k;
}
`;

/**
 * How lost in the morning haze it is from far off, 0..1, and the haze it is lost in: the low sky beyond it over the
 * sea's own colour, so it stays a shade darker than the sky, as an island far off in a haze does.
 */
export const LOST_GLSL = /* glsl */ `
uniform float uLost;
vec3 lost(vec3 col, vec3 world) {
  vec3 d = world - cameraPosition;
  vec3 low = skyColor(normalize(vec3(d.x, 0.03 * length(d.xz), d.z)));
  vec3 under = low * vec3(0.62, 0.55, 0.6);
  return mix(col, mix(under, low, smoothstep(0.0, 6.0, world.y) * 0.5 + 0.2), uLost);
}
`;

/**
 * Its far length low on the sea melts into the morning: wet and glancing, it mirrors the dawn as the sea round it
 * does, so only the head and what stands clear of the water are crisp.
 */
export const HAZE_GLSL = /* glsl */ `
uniform float uHaze;
${LOST_GLSL}
/** The open sea's own colour seen at world, as the water draws it: its deep body under a rough mirror of the dawn. */
vec3 seaLook(vec3 world) {
  vec3 V = normalize(cameraPosition - world);
  float nv = max(V.y, 0.02);
  vec3 R = normalize(vec3(-V.x, nv + 0.1 * (1.0 - nv), -V.z));
  vec3 body = vec3(${f(SEA_DEEP.r)}, ${f(SEA_DEEP.g)}, ${f(SEA_DEEP.b)}) * (uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6);
  return mix(body, skyColor(R), 0.02 + 0.58 * pow(1.0 - nv, 5.0));
}
/** How far the morning has taken it at world: its far length, and its low back where the sea films over it. */
float hazeAt(vec3 world, float s, float filmed) {
  float far = smoothstep(${f(L.hazeFrom)}, ${f(L.hazeTo)}, distance(cameraPosition, world));
  float awash = filmed * (1.0 - smoothstep(0.0, ${f(L.awash)}, world.y)) * smoothstep(0.36, 0.55, s);
  return uHaze * max(smoothstep(0.24, 0.72, s) * far * (1.0 - smoothstep(2.0, 9.0, world.y)) * ${f(L.haze)}, awash * ${f(L.awashHaze)});
}
vec3 hazed(vec3 col, vec3 world, float s, float filmed) {
  return lost(applyFog(mix(col, seaLook(world), hazeAt(world, s, filmed)), world), world);
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
/**
 * How far down the sea pouring off its back has come (m above the sea), how much the bared head streams, and how much
 * of the breath's sea pours off in falls rather than a sheen.
 */
uniform vec3 uPour;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vAxisX;
in vec3 vAxisY;
in vec3 vAxisZ;

void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  Skin k = skin(smoothstep(70.0, 140.0, distance(cameraPosition, vWorld)), 1.0);
  vec3 slope = (k.slope.x * vAxisX + k.slope.y * vAxisY + k.slope.z * vAxisZ) / uScale;
  N = normalize(N - (slope - N * dot(slope, N)));

  float sun = cloudShadow(vWorld.xz);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  float nv = clamp(dot(N, V), 0.0, 1.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 2.0);
  // Cool sky fill keeps the shadowed flank slate rather than black against a low sun.
  float sky = dot(uSkyAmbient, vec3(0.3, 0.5, 0.2));
  int part = int(vRig.y + 0.5);
  // The flipper's broad top faces the open sky and the low sun more squarely than the flank it hangs from.
  float raised = part == ${FIN} ? finRaised() : 0.0;
  vec3 fill = vec3(0.8, 0.88, 1.05) * sky * ${f(L.fill)} * (0.55 + 0.45 * N.y) * (part == ${FIN} ? mix(0.6, 1.1, raised) : 1.0);
  vec3 bounce = mix(uSkyHorizon, uSeaTint * sky * 3.0, 0.5) * ${f(L.bounce)} * sky * max(-N.y + 0.15, 0.0);
  vec3 col = k.albedo * (fill + bounce + uSunColor * (wrap * wrap * wrap * ${f(L.key)} * (part == ${FIN} ? mix(0.5, 0.9, raised) : 1.0) + 0.02) * sun);
  // Low on the flank the sea shades it, so the skin darkens down to the waterline.
  col *= mix(${f(L.waterline)}, 1.0, smoothstep(-0.5, 3.5, vWorld.y));
  col += k.albedo * uSunColor * sun * k.thin * back * max(-ndl, 0.0) * 1.4;
  // Its hue stays the iris's own: the dawn's orange on it read as a lit amber lamp.
  col += uIris * dot(uSunColor, vec3(0.3, 0.5, 0.2)) * sun * k.caustic * ${f(L.caustic)};

  float dry = smoothstep(0.0, 0.25, vWorld.y);
  vec2 flow = vec2(dot(vRest.xz, vec2(5.0, 2.0)), vWorld.y * 1.1 + uTime * 1.9);
  float streak = smoothstep(0.7, 0.95, vnoise(vec2(flow.x * 2.5, flow.y)) * 0.75 + vnoise(vec2(flow.x * 7.0, flow.y * 3.0)) * 0.25);
  // Over its back and flanks the sea pours off in broad falls; the head, bared at the haul, streams with them.
  vec4 pour = vec4(0.0);
  if (part == ${BODY} && vWet > 0.01) {
    vec2 m = overSkin(vRest);
    float head = uPour.y * (1.0 - smoothstep(0.24, 0.34, vRig.x));
    pour = falls(m, vWorld.y, mix(uPour.x, -2.0, head), vWet, length(fwidth(m)) + 1e-4, max(uPour.z, head)) * (1.0 - k.near);
    pour.x *= smoothstep(0.0, 0.25, vWet);
    streak = 0.5 * pour.x * pour.z;
  }
  // Lifted out of the sea, the flipper streams with it.
  float sheet = max(pour.x, part == ${FIN} ? clamp(uSlap.y * 30.0, 0.0, 1.0) : 0.0) * dry;

  vec3 R = reflect(-V, N);
  vec3 env = skyColor(vec3(R.x, max(R.y, 0.02), R.z));
  env = mix(env, uSeaTint * uSkyAmbient * 1.4, (1.0 - smoothstep(-0.3, 0.0, R.y)));
  // Its back is wet from the sea it lies in: darker, and a mirror of the dawn at a glancing look, no brighter than
  // the sea's own; seen glancing, the long low back would otherwise draw a pale band across the water.
  float wet = part == ${BODY} ? max(smoothstep(0.25, 0.8, N.y), k.run * ${f(L.runs)}) * (1.0 - k.gloss) * (1.0 - k.near) * (1.0 - k.crust) : 0.0;
  float F = 0.03 + mix(0.97, 0.58, wet) * pow(1.0 - nv, 5.0);
  float low = (1.0 - smoothstep(0.0, 2.5, vWorld.y)) * smoothstep(0.3, 0.45, vRig.x) * float(part == ${BODY});
  col *= (1.0 - 0.25 * wet) * (1.0 - 0.3 * ${f(L.runs)} * k.run);
  col = mix(col, env, F * (0.25 + (part == ${FIN} ? 0.5 : 0.15) * sheet + ${f(L.wet)} * wet + 0.6 * k.gloss) * (part == ${FIN} ? 0.45 : 1.0));
  // A fall is a clear sheet of the dawn it mirrors, streaming down, lit through gold where it pours over the ridge
  // toward the sun; the skin shows through it but where it runs full.
  float streaming = smoothstep(0.45, 0.9, pour.z);
  vec3 water = env * (0.75 + 0.5 * streaming) + uSkyAmbient * 0.5 + uSkyHorizonSun * 0.2 * streaming
    + uSunColor * sun * (0.04 + 0.5 * back * smoothstep(0.55, 0.9, vRig.w)) * (0.5 + streaming);
  // Where it pours back into the sea it churns white.
  float churn = pour.x * (1.0 - smoothstep(0.05, 0.6, vWorld.y)) * smoothstep(0.35, 0.7, vnoise(vec2(overSkin(vRest).x * 2.0, uTime * 1.5)));
  water = mix(water, vec3(0.9, 0.92, 0.95) * (lumaOf(uSkyHorizon) * 1.6 + uSunColor * 0.25 * sun), churn * 0.7);
  col = mix(col, water, pour.x * (0.2 + 0.35 * pour.y + 0.45 * streaming * (0.4 + 0.6 * pour.y)) * (0.65 + 0.35 * vWet) * dry * ${f(tuning.netWhale.falls)});
  vec3 H = halfVector(uSunDir, V);
  float nh = max(dot(N, H), 0.0);
  // Lying awash the flipper's blade faces the sky, and a sheen on it as broad as the back's would make it a pale thing.
  float sheen = (part == ${FIN} ? ${f(L.sheen)} * 0.3 : ${f(L.sheen)}) * (1.0 - k.crust);
  col += uSunColor * pow(nh, mix(mix(24.0, 70.0, wet), 160.0, sheet)) * (sheen * (1.0 + wet) * (1.0 - 0.7 * low) + (0.8 + 3.0 * streak) * sheet) * sun * (1.0 - k.gloss) * (1.0 - 0.7 * k.near);
  col += vec3(0.85, 0.9, 0.95) * (uSkyAmbient * 0.7 + uSunColor * (0.1 + back * 0.8) * sun) * streak * sheet * 0.45;
  col += (uSunColor * vec3(1.0, 0.9, 0.7) + uSkyHorizon) * pour.w * dry * ${f(tuning.netWhale.glints)} * (0.3 + 0.7 * sun);
  // A flipper lying flat is seen edge on all over, so only the body takes the rim along its silhouette.
  float rim = pow(1.0 - nv, ${f(L.rimPower)}) * smoothstep(-0.2, 0.5, N.y + ndl) * (part == ${FIN} ? 0.2 : 1.0) * (1.0 - low);
  col += uSunColor * mix(vec3(1.0), k.albedo * 2.0, 0.35) * rim * (0.2 + back) * ${f(L.rim)} * sun * (1.0 - k.near);
  // Where the back turns away toward the low sun at its edge it draws one crisp gold line against the sea.
  float sunward = dot(N, normalize(vec3(uSunDir.x, 0.0, uSunDir.z)));
  float ridge = pow(1.0 - nv, ${f(L.ridgePower)}) * (1.0 - smoothstep(0.02, 0.08, nv)) * smoothstep(-0.05, 0.35, sunward + 0.3 * N.y)
    * float(part == ${BODY} || part == ${DORSAL});
  vec3 gold = uSunColor * vec3(1.0, 0.82, 0.55) * ridge * back * ${f(L.ridge)} * sun * (1.0 - k.near);
  // The cornea bulges over the iris, so the sky it mirrors moves across it; the gold in it is the dawn behind.
  vec3 Nc = normalize(N + (vAxisZ * k.iris.x + vAxisY * k.iris.y) * 1.3);
  vec3 Rc = reflect(-V, Nc);
  vec3 seen = skyColor(vec3(Rc.x, max(Rc.y, 0.02), Rc.z));
  col += seen * k.gloss * (1.0 - k.caustic) * ${f(L.cornea)};
  col = mix(col, seen + uSkyAmbient, k.rim * 0.22);
  // The sun's own reflection would sit under the heavy lid, so the catchlight is the sky above.
  float glint = pow(max(dot(Nc, normalize(V + vec3(0.0, 0.55, 0.0) + vAxisZ * 0.25)), 0.0), 700.0);
  // And a soft second light low in it, the bright sea, so it reads wet and gentle rather than glassy.
  float sea = pow(max(dot(Nc, normalize(V - vec3(0.0, 0.4, 0.0) - vAxisZ * 0.3)), 0.0), 90.0);
  vec3 bright = vec3(1.0, 0.95, 0.86) * dot(uSunColor * 0.5 + uSkyHorizonSun, vec3(0.3, 0.5, 0.2));
  // Under the tired lid only a dim glint, so the shut eye never reads as watching.
  col += bright * (glint * ${f(L.catchlight)} * mix(0.25, 1.0, uEye) + sea * 0.06) * k.gloss;

  // The gold line stays crisp over the haze, so the back goes on into the morning as one thin line.
  float filmed = float(part == ${BODY});
  gl_FragColor = vec4(hazed(col, vWorld, vRig.x, filmed) + gold * (1.0 - fogOf(vWorld).a) * (1.0 - ${f(L.ridgeHazed)} * hazeAt(vWorld, vRig.x, filmed)) * (1.0 - uLost), 1.0);
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
  Skin k = skin(smoothstep(70.0, 140.0, dist), 0.3);
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
  col = hazed(col, vSurface, vRig.x, 0.0);
  gl_FragColor = vec4(col * a, a);
}`;
