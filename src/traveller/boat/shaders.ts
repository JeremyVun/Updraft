import * as THREE from 'three';
import { glsl, tuning } from '../../tuning';
import { ATMO_GLSL } from '../../world/atmosphere';
import {
  BOW_Z, FLOOR_Y, LENGTH, MAST_TOP, MAST_Z, PAINT, SAIL_HOIST, SAIL_RISE, SAIL_SPAN, SAIL_TACK, SAIL_TAPER, STERN_Z, STRAKES,
  gunwale, gunwaleHalf,
} from './form';
import { KIND } from './parts';

export const HULL_VERT = /* glsl */ `
uniform mat4 uHullFrame;
in vec3 color;
in vec4 aGrain;
in vec3 aTan;
out vec3 vColor;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out vec4 vGrain;
out vec3 vTan;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vColor = color;
  vWorld = w.xyz;
  vLocal = (uHullFrame * w).xyz;
  vGrain = aGrain;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vTan = mat3(modelMatrix) * aTan;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** The hull's form from `form.ts` again, sampled along its length, for the shade its sides cast inside it. */
const STATIONS = 32;
const sampled = (f: (u: number) => number) => Array.from({ length: STATIONS + 1 }, (_, i) => glsl(f(i / STATIONS))).join(', ');
const FORM_GLSL = /* glsl */ `
const float HULL_TOP[${STATIONS + 1}] = float[](${sampled(gunwale)});
const float HULL_HALF[${STATIONS + 1}] = float[](${sampled(gunwaleHalf)});
float hullTop(float u) {
  float x = clamp(u, 0.0, 1.0) * ${glsl(STATIONS)};
  int i = min(int(x), ${STATIONS - 1});
  return mix(HULL_TOP[i], HULL_TOP[i + 1], x - float(i));
}
float hullHalfWidth(float u) {
  float x = clamp(u, 0.0, 1.0) * ${glsl(STATIONS)};
  int i = min(int(x), ${STATIONS - 1});
  return mix(HULL_HALF[i], HULL_HALF[i + 1], x - float(i));
}
float stationOf(float z) { return clamp(z / ${glsl(LENGTH)} + 0.45, 0.0, 1.0); }
`;

/**
 * Warm clinker-built wood under the painted light: soft wrap, cool bounce, a low varnish sheen. Planks, boards
 * and grain are drawn here rather than modelled, and every fine line gives way to its average tone as it
 * shrinks below a pixel, so nothing shimmers at a distance.
 */
export const HULL_FRAG = /* glsl */ `
${ATMO_GLSL}
${FORM_GLSL}
uniform mat4 uHullFrame;
in vec3 vColor;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in vec4 vGrain;
in vec3 vTan;

/** How much of the key light gets in over the gunwale to a point inside the hull. */
float overTheSide(vec3 p, vec3 L) {
  if (L.y < 0.01) return 0.0;
  float top = hullTop(stationOf(p.z)) + 0.01;
  vec3 q = p + L * (max(top - p.y, 0.0) / L.y);
  top = hullTop(stationOf(q.z)) + 0.01;
  q = p + L * (max(top - p.y, 0.0) / L.y);
  float room = min(hullHalfWidth(stationOf(q.z)) - abs(q.x), min(q.z - ${glsl(STERN_Z)}, ${glsl(BOW_Z)} - q.z));
  return smoothstep(-0.05, 0.05, room);
}

/** A line of the given half-width (in its own units) at every integer of x, fading to its coverage when too fine to draw. */
float lines(float x, float halfWidth) {
  float fw = fwidth(x);
  float d = abs(fract(x + 0.5) - 0.5);
  float drawn = 1.0 - smoothstep(halfWidth - fw * 0.5, halfWidth + fw * 0.5, d);
  return mix(drawn, 2.0 * halfWidth, smoothstep(0.2, 0.5, fw));
}

void main() {
  float kind = vGrain.x;
  float along = vGrain.y;
  float across = vGrain.z;
  bool outside = gl_FrontFacing;
  vec3 N = normalize(vNormal) * (outside ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = vColor;

  if (kind < ${glsl(KIND.planks + 0.5)}) {
    /**
     * Clinker: each strake's lower edge laps over the one below. Outside, a lit bevel runs along every lap with a
     * shadow tucked under it; inside it is the other way up. Each plank also catches a little more light toward
     * its lapping edge, which is what still reads the strakes from far off once the lines themselves are gone.
     */
    float g = vGrain.w * ${glsl(STRAKES)};
    float k = floor(g);
    ${PAINT ? `if (outside && k > ${glsl(STRAKES - 1.5)}) alb = vec3(${new THREE.Color(PAINT).toArray().map(glsl).join(', ')});` : ''}
    float f = g - k;
    float fw = fwidth(g);
    float sharp = 1.0 - smoothstep(0.18, 0.45, fw);
    float edge = outside ? f : 1.0 - f;
    float bevel = 1.0 - smoothstep(0.0, 0.06 + fw, edge);
    float under = smoothstep(0.72 - fw, 0.99, edge);
    float crevice = smoothstep(0.955 - fw, 0.985, edge);
    vec3 upSide = vTan - N * dot(vTan, N);
    vec3 T = dot(upSide, upSide) > 1e-8 ? normalize(upSide) : vec3(0.0);
    N = normalize(N + T * (0.42 * (0.5 - edge) * sharp) * (outside ? 1.0 : -1.0));
    float side = vLocal.x > 0.0 ? 1.0 : 0.0;
    alb *= 1.0 + (hash12(vec2(k, side * 5.0 + 3.0)) - 0.5) * 0.16 * sharp;
    alb *= mix(0.92, (1.0 - under * 0.38) * (1.0 - crevice * 0.45) + bevel * 0.22, sharp);
    float grain = vnoise(vec2(along * 1.4 + k * 7.3, across * 24.0));
    alb *= 0.94 + 0.12 * mix(0.5, grain, 1.0 - smoothstep(0.1, 0.4, fwidth(across * 24.0)));
    /** Below the waterline the wood is darker, wet, and a little green. */
    float wet = outside ? 1.0 - smoothstep(-0.45, -0.33, vLocal.y) : 0.0;
    alb *= mix(vec3(1.0), vec3(0.7, 0.73, 0.66), wet);
  } else if (kind < ${glsl(KIND.boards + 0.5)}) {
    float b = across / 0.135 + 0.5;
    float bk = floor(b);
    alb *= 1.0 + (hash12(vec2(bk, 11.0)) - 0.5) * 0.12 * (1.0 - smoothstep(0.2, 0.5, fwidth(b)));
    alb *= 1.0 - lines(b, 0.035) * 0.45;
    float grain = vnoise(vec2(along * 1.3 + bk * 5.1, across * 30.0));
    alb *= 0.94 + 0.12 * mix(0.5, grain, 1.0 - smoothstep(0.1, 0.4, fwidth(across * 30.0)));
  } else if (kind < ${glsl(KIND.wood + 0.5)}) {
    float grain = vnoise(vec2(along * 1.6, across * 34.0));
    alb *= 0.94 + 0.12 * mix(0.5, grain, 1.0 - smoothstep(0.1, 0.4, fwidth(across * 34.0)));
  } else if (kind < ${glsl(KIND.paint + 0.5)}) {
    alb *= 0.96 + 0.07 * vnoise(vec2(along, across) * 14.0);
    /** Worn through to the wood along the bottom, where it drags. */
    float worn = (1.0 - smoothstep(-0.52, -0.36, vLocal.y)) * smoothstep(0.35, 0.7, vnoise(vec2(along, across) * 9.0));
    alb = mix(alb, vec3(0.42, 0.24, 0.12), worn * 0.6);
  } else if (kind < ${glsl(KIND.transom + 0.5)}) {
    float b = (vLocal.y - ${glsl(FLOOR_Y)}) / 0.19;
    alb *= 1.0 + (hash12(vec2(floor(b), 23.0)) - 0.5) * 0.1 * (1.0 - smoothstep(0.2, 0.5, fwidth(b)));
    alb *= 1.0 - lines(b, 0.03) * 0.4;
    float grain = vnoise(vec2(along * 1.4, vLocal.y * 30.0));
    alb *= 0.94 + 0.12 * mix(0.5, grain, 1.0 - smoothstep(0.1, 0.4, fwidth(vLocal.y * 30.0)));
  }

  /** Inside the hull the sides shade the low sun and the floor sees less of the sky. */
  float u = stationOf(vLocal.z);
  float top = hullTop(u);
  float room = hullHalfWidth(u) - abs(vLocal.x);
  bool within = (kind < ${glsl(KIND.planks + 0.5)} || kind > ${glsl(KIND.paint + 0.5)})
    ? !outside
    : room > 0.003 && vLocal.z > ${glsl(STERN_Z + 0.004)} && vLocal.y < top;
  vec3 L = normalize(mat3(uHullFrame) * uSunDir);
  float shade = within ? overTheSide(vLocal, L) : 1.0;
  float deep = clamp((top - vLocal.y) / (top - ${glsl(FLOOR_Y)}), 0.0, 1.0);
  float ao = within ? mix(1.0, 0.64, deep) * mix(0.82, 1.0, smoothstep(0.0, 0.16, room)) : mix(0.8, 1.0, smoothstep(-0.5, 0.05, vLocal.y));

  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
  float sun = cloudShadow(vWorld.xz) * shade;
  vec3 col = alb * (harbourLight(vWorld) + hemiLight(N) * ao + uSunColor * wrap * wrap * sun * 0.95);
  /** Where the sides shade it, the inside still glows with the sun thrown off the planking opposite. */
  if (within) col += alb * uSunColor * (1.0 - shade) * cloudShadow(vWorld.xz) * max(L.y, 0.0) * 0.55;
  /** A soft varnish sheen; paint takes less of it. */
  float sheen = pow(max(dot(N, halfVector(uSunDir, V)), 0.0), 18.0) * (kind > ${glsl(KIND.wood + 0.5)} && kind < ${glsl(KIND.paint + 0.5)} ? 0.05 : 0.09);
  col += uSunColor * sheen * sun;
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0) * max(dot(-V, uSunDir), 0.0);
  col += uSunColor * rim * 0.12 * sun;
  col += alb * (emberLight(vWorld, N) + lampLight(vWorld, N) + dawnLight(vWorld, N));
  if (kind > ${glsl(KIND.transom + 0.5)}) {
    /** The lantern's glass: dull amber by day, lit from within as the sun goes down and through the night. */
    float lit = max(uNight, 1.0 - smoothstep(0.04, 0.28, uSunDir.y));
    vec3 flame = vec3(1.9, 1.2, 0.55) * (0.9 + 0.1 * sin(uTime * 7.0) * sin(uTime * 3.1));
    col = mix(col * 0.8 + uSunColor * sheen * 2.0, flame, lit);
  }
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * Where a point of the cloth is, across the sail from the mast (s) and up it from the boom (t). With wind in it
 * the sail bellies and a ripple travels out to the leech; with none the leech falls in toward the mast and the
 * cloth it gives up hangs in slow vertical folds.
 */
const CLOTH_GLSL = /* glsl */ `
uniform float uFill;
uniform float uFlutter;
uniform float uRipplePhase;
uniform float uLuff;
uniform float uDroop;
uniform float uShelter;
uniform float uTime;
vec3 cloth(vec2 st) {
  float s = st.x;
  float t = st.y;
  float cut = s * (1.0 - uDroop * s * mix(${glsl(tuning.sail.gather)}, ${glsl(tuning.opening.sailGather)}, uShelter));
  vec3 p = vec3(
    -cut * ${glsl(SAIL_SPAN)} * (1.0 - t * ${glsl(SAIL_TAPER)}),
    ${glsl(SAIL_TACK)} + t * ${glsl(SAIL_HOIST)} + cut * ${glsl(SAIL_RISE)},
    0.0);
  p.y -= uDroop * s * (0.4 + 0.6 * sin(t * 3.14159)) * mix(${glsl(tuning.sail.sag)}, ${glsl(tuning.opening.sailSag)}, uShelter);
  float folds = sin(s * ${glsl(tuning.sail.folds)} * 6.28318 + 1.1 + t * 0.7) * smoothstep(0.0, 0.2, s) * (0.3 + 0.7 * sin(t * 3.14159));
  float breathe = 0.7 + 0.3 * sin(uTime * 0.55 + t * 1.5);
  p.z += uDroop * (folds * breathe * ${glsl(tuning.sail.fold)} + s * sin(uTime * 0.4) * 0.08);
  /** A gust crossing the sail breaks along the free edge first: the leech shakes, then the belly fills again. */
  float leech = smoothstep(0.15, 1.0, s) * (0.4 + 0.6 * t);
  float belly = sin(s * 3.14159) * sin(t * 3.14159 * 0.9) * (1.0 - 0.3 * uLuff * leech);
  float ripple = sin(uRipplePhase - s * 6.5 + t * 3.0) * uFlutter * (0.25 + 0.75 * s * s);
  float shake = (uLuff + uFlutter * 0.35) * leech;
  p.z += belly * uFill + ripple * ${glsl(tuning.sail.ripple)} + sin(uTime * 19.0 - s * 12.0 + t * 4.0) * shake * ${glsl(tuning.sail.shake)};
  return p;
}`;

/** The patchwork sail: quilt squares in faded colours, stitched, billowing with the wind and glowing when backlit. */
export const SAIL_VERT = /* glsl */ `
${CLOTH_GLSL}
out vec2 vUv;
out vec2 vCut;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vAcross;
out vec3 vUp;

void main() {
  vec3 p = cloth(uv);
  /** The cloth is what it is doing, so the light on it is taken from the shape itself rather than guessed at. */
  vec3 pu = cloth(uv + vec2(0.012, 0.0));
  vec3 pv = cloth(uv + vec2(0.0, 0.012));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vUv = uv;
  /** The flat cloth in metres: across from the luff, up from the foot. */
  vCut = vec2(uv.x * ${glsl(SAIL_SPAN)} * (1.0 - uv.y * ${glsl(SAIL_TAPER)}), uv.y * ${glsl(SAIL_HOIST)} + uv.x * ${glsl(SAIL_RISE)});
  vWorld = w.xyz;
  vAcross = normalize(mat3(modelMatrix) * (pu - p));
  vUp = normalize(mat3(modelMatrix) * (pv - p));
  vNormal = normalize(mat3(modelMatrix) * normalize(cross(pv - p, pu - p)));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** The cloth's colour and make, shared by the sail and the pennant cut from the same quilt. */
const QUILT_GLSL = /* glsl */ `
vec3 patchColour(vec2 cell) {
  float pick = hash12(cell + 7.0);
  return pick < 0.3 ? vec3(0.93, 0.88, 0.76) : pick < 0.52 ? vec3(0.82, 0.38, 0.3) : pick < 0.74 ? vec3(0.9, 0.7, 0.3) : pick < 0.9 ? vec3(0.5, 0.66, 0.78) : vec3(0.62, 0.74, 0.5);
}
/**
 * The scarf's red wool, wound across the sail in courses: faded by weather where it has been out longest, each
 * course a little different, the knitting's ribs running along it close to.
 */
const float WOOL_COURSE = 0.37;
vec3 woolColour(vec2 cut, float aa) {
  vec3 wool = vec3(0.57, 0.023, 0.036);
  float course = floor(cut.y / WOOL_COURSE);
  float weather = smoothstep(0.35, 0.8, vnoise(cut * vec2(0.9, 1.4) + 4.0)) * 0.5 + smoothstep(1.2, 3.8, cut.y) * 0.3 + hash12(vec2(course, 5.0)) * 0.2;
  wool = mix(wool, vec3(0.64, 0.12, 0.095), 0.1 + 0.26 * weather);
  float rib = 0.5 + 0.5 * sin(cut.y * 6.28318 / 0.024);
  wool *= 1.0 - 0.08 * mix(rib, 0.5, smoothstep(0.003, 0.009, aa));
  return wool;
}
`;

export const SAIL_FRAG = /* glsl */ `
${ATMO_GLSL}
${QUILT_GLSL}
uniform float uScarf;
uniform float uFill;
uniform float uDroop;
uniform vec4 uSubject;
/** Where the cloth hangs between the camera and the child it thins, so the child is never lost behind the sail. */
float givesWay(vec3 world) {
  if (uSubject.w < 0.5 || uMirrorPass > 0.5) return 1.0;
  vec3 toSubject = uSubject.xyz - cameraPosition;
  float reach = length(toSubject);
  vec3 dir = toSubject / max(reach, 0.001);
  vec3 toHere = world - cameraPosition;
  float along = dot(toHere, dir);
  if (along <= 0.4 || along >= reach - 0.6) return 1.0;
  return mix(0.3, 1.0, smoothstep(0.9, 2.2, length(toHere - dir * along)));
}
in vec2 vUv;
in vec2 vCut;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vAcross;
in vec3 vUp;

/** A stitched line at distance d (metres), with dashes along a; fades to a faint tone once smaller than a pixel. */
float stitch(float d, float a, float aa) {
  float line = 1.0 - smoothstep(0.0022, 0.0022 + aa, abs(d));
  float dash = mix(step(0.4, fract(a / 0.022)), 0.6, smoothstep(0.003, 0.007, aa));
  return line * dash * (1.0 - smoothstep(0.004, 0.011, aa));
}

void main() {
  float aa = max(length(fwidth(vCut)), 1e-4);
  float width = ${glsl(SAIL_SPAN)} * (1.0 - vUv.y * ${glsl(SAIL_TAPER)});
  vec2 grid = vec2(4.0, 5.0);
  vec2 cell = floor(vUv * grid);
  vec2 f = fract(vUv * grid);
  /** Metres to the nearest seam across and up, and to the sail's own edges. */
  vec2 toSeam = vec2(min(f.x, 1.0 - f.x) * width / grid.x, min(f.y, 1.0 - f.y) * ${glsl(SAIL_HOIST)} / grid.y);
  float luff = vUv.x * width;
  float leech = (1.0 - vUv.x) * width;
  float foot = vUv.y * ${glsl(SAIL_HOIST)};
  float head = (1.0 - vUv.y) * ${glsl(SAIL_HOIST)};
  float toEdge = min(min(luff, leech), min(foot, head));
  bool vertical = toSeam.x < toSeam.y;
  float seamD = min(toSeam.x, toSeam.y);
  float seamAlong = vertical ? vCut.y : vCut.x;

  // The impossible scarf gathers into the sail, its red wool carried into the colder chapters.
  float woven = smoothstep(vUv.y * 0.75, vUv.y * 0.75 + 0.25, uScarf);
  vec3 cloth = mix(patchColour(cell), woolColour(vCut, aa), woven);
  if (woven > 0.5) {
    /** Wool has no quilt squares: only the joins between its courses. */
    seamD = abs(fract(vCut.y / WOOL_COURSE + 0.5) - 0.5) * WOOL_COURSE;
    seamAlong = vCut.x;
  }

  /** Weather: slubs in the weave, a little staining low down, and colour bleached toward the free edges. */
  float slub = vnoise(vCut * vec2(2.5, 16.0));
  cloth *= 0.95 + 0.08 * slub;
  float bleach = smoothstep(0.3, 0.75, vnoise(vCut * 0.8 + 11.0)) * 0.5 + (1.0 - smoothstep(0.0, 1.0, leech)) * 0.3 + smoothstep(2.4, 3.7, foot) * 0.2;
  cloth = mix(cloth, vec3(dot(cloth, vec3(0.3, 0.55, 0.15))) * vec3(1.05, 1.0, 0.92) + 0.03, bleach * 0.2);
  cloth *= 1.0 - 0.07 * smoothstep(0.55, 0.9, vnoise(vCut * 2.2 + 3.0)) * (1.0 - smoothstep(0.0, 1.1, foot));

  /** Flat-felled seams between the panels, a doubled hem round the edges and reinforcing patches at the corners. */
  float seamBand = (1.0 - smoothstep(0.013, 0.013 + aa, seamD)) * step(0.02, toEdge);
  float hem = 1.0 - smoothstep(0.05, 0.05 + aa, toEdge);
  float corner = min(min(luff + foot, leech + foot), min(luff + head, leech + head));
  float reinforced = 1.0 - smoothstep(0.42, 0.42 + aa, corner);
  float doubled = max(max(seamBand, hem), reinforced);
  float stitches = stitch(seamD - 0.007, seamAlong, aa) * step(0.03, toEdge);
  stitches = max(stitches, stitch(toEdge - 0.036, luff < leech ? vCut.y : vCut.x, aa));
  stitches = max(stitches, stitch(corner - 0.42, vCut.x + vCut.y, aa) * step(0.05, toEdge));
  cloth *= 1.0 - doubled * 0.07;
  cloth = mix(cloth, cloth * 0.68, stitches * 0.6);

  /**
   * The cloth never lies quite flat: long soft folds down the sail that ease out as it fills, and tension creases
   * fanning in to the clew. They only bend the light; the shape itself is the wind's.
   */
  float full = clamp(abs(uFill) / 0.6, 0.0, 1.0);
  float fold = 0.017 * (0.35 + 0.65 * (1.0 - full)) * smoothstep(0.1, 0.6, luff) * (1.0 - smoothstep(0.35, 0.9, aa * 12.0));
  float phase = vCut.x * 6.28318 / 0.5 + 0.9 * sin(vCut.y * 1.7) + 2.0 * vnoise(vCut * vec2(0.6, 0.25));
  vec2 slope = vec2(cos(phase) * 6.28318 / 0.5, cos(phase) * 1.5 * cos(vCut.y * 1.7)) * fold;
  vec2 fromClew = vec2(leech, foot);
  float clewD = length(fromClew);
  float crease = 0.004 * (1.0 - smoothstep(0.2, 1.3, clewD)) * smoothstep(0.1, 0.35, clewD) * (0.4 + 0.6 * full) * (1.0 - smoothstep(0.35, 0.9, aa * 20.0));
  float angle = atan(fromClew.y, fromClew.x) + 0.25 * vnoise(vCut * 3.0);
  slope += vec2(-sin(angle), cos(angle)) * cos(angle * 9.0 + clewD * 3.0) * 9.0 / max(clewD, 0.2) * crease;
  vec3 N = normalize(vNormal - vAcross * slope.x + vUp * slope.y) * (gl_FrontFacing ? 1.0 : -1.0);

  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  /** Light comes through where the cloth is single; seams, hems and patches are doubled and hold it back. */
  float through = (max(-ndl, 0.0) * 0.45 + pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.25) * (1.0 - doubled * 0.45);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = cloth * (harbourLight(vWorld) + hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.6 + through * 0.6) * sun);
  col += cloth * cloth * uSunColor * through * 0.35 * sun;
  col += cloth * emberLight(vWorld, N);
  gl_FragColor = vec4(applyFog(col, vWorld), nearFade(vWorld, 1.0, 3.5) * givesWay(vWorld));
}`;

/**
 * The masthead pennant, cut from the same quilt: it streams the way the air in the sail is going, lifts out as it
 * freshens and hangs down the mast in a calm, flicking all the while.
 */
export const PENNANT_VERT = /* glsl */ `
uniform vec4 uPennant;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;
vec3 flag(vec2 ab) {
  float a = ab.x;
  float b = ab.y;
  float lift = uPennant.z;
  vec3 d = vec3(uPennant.x, 0.0, uPennant.y);
  vec3 side = vec3(-d.z, 0.0, d.x);
  float len = 0.85;
  float bend = (1.0 - lift) * 1.35 + 0.08;
  float droop = bend * a;
  float out_ = len * sin(droop) / bend;
  float down = len * (1.0 - cos(droop)) / bend;
  float hoist = 0.15 * (1.0 - 0.85 * a);
  float wave = sin(uPennant.w - a * 8.5) * a * (0.045 + 0.05 * lift) + sin(uPennant.w * 1.7 - a * 13.0) * a * a * 0.02;
  vec3 p = vec3(0.0, ${glsl(MAST_TOP - 0.035)}, ${glsl(MAST_Z)}) + d * out_ - vec3(0.0, down, 0.0);
  p += (d * -sin(droop) - vec3(0.0, cos(droop), 0.0)) * b * hoist;
  p += side * wave;
  return p;
}
void main() {
  vec3 p = flag(uv);
  vec3 pa = flag(uv + vec2(0.02, 0.0));
  vec3 pb = flag(uv + vec2(0.0, 0.2));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vUv = uv;
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normalize(cross(pa - p, pb - p)));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const PENNANT_FRAG = /* glsl */ `
${ATMO_GLSL}
${QUILT_GLSL}
uniform float uScarf;
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 cloth = mix(vec3(0.82, 0.38, 0.3), vec3(0.93, 0.88, 0.76), step(0.62, vUv.x));
  cloth = mix(cloth, woolColour(vUv * vec2(0.6, 0.13) + vec2(0.0, 3.5), 0.02), smoothstep(0.75, 1.0, uScarf));
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float through = max(-ndl, 0.0) * 0.45 + pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.25;
  float sun = cloudShadow(vWorld.xz);
  vec3 col = cloth * (harbourLight(vWorld) + hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.6 + through * 0.6) * sun);
  col += cloth * cloth * uSunColor * through * 0.35 * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;
