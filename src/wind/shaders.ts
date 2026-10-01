import { FELT_GLSL, NOISE_GLSL } from '../world/atmosphere';

export const MAX_SPLATS = 8;

const NEIGHBOURS = /* glsl */ `
uniform vec2 uTexel;
in vec2 vUv;
vec2 uvL() { return vUv - vec2(uTexel.x, 0.0); }
vec2 uvR() { return vUv + vec2(uTexel.x, 0.0); }
vec2 uvB() { return vUv - vec2(0.0, uTexel.y); }
vec2 uvT() { return vUv + vec2(0.0, uTexel.y); }
`;

/** Relaxes toward the ambient breeze and applies the player's splats. Channels: xy velocity, z gust energy, w updraft. */
export const FORCE_FRAG = /* glsl */ `
uniform sampler2D uVel;
uniform float uDt;
uniform float uTime;
uniform vec4 uDomain;
uniform vec2 uBreeze;
uniform float uRelax;
uniform float uAmbient;
uniform int uSplatCount;
uniform vec4 uSplatSeg[${MAX_SPLATS}];
uniform vec4 uSplatVel[${MAX_SPLATS}];
uniform vec4 uSplatMix[${MAX_SPLATS}];
in vec2 vUv;
${NOISE_GLSL}

void main() {
  vec2 world = vUv / uDomain.zw + uDomain.xy;
  vec4 s = texture(uVel, vUv);
  vec2 v = s.xy;

  if (uAmbient > 0.5) {
    float base = length(uBreeze);
    vec2 dir = uBreeze / max(base, 1e-4);
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 q = world * 0.02 - uBreeze * uTime * 0.02;
    float gust = fbm(q);
    float veer = (vnoise(q * 0.6 + 11.3) - 0.5) * 0.7;
    vec2 target = base > 1e-3 ? normalize(dir + perp * veer) * base * (0.3 + 2.3 * gust * gust) : vec2(0.0);
    v += (target - v) * (1.0 - exp(-uDt * uRelax));
  }

  for (int i = 0; i < ${MAX_SPLATS}; i++) {
    if (i >= uSplatCount) break;
    vec2 a = uSplatSeg[i].xy;
    vec2 b = uSplatSeg[i].zw;
    vec2 ab = b - a;
    float t = clamp(dot(world - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float d = length(world - (a + ab * t));
    float r = uSplatVel[i].z;
    float w = exp(-d * d / (r * r));

    float exposure = uSplatMix[i].z;
    vec2 pushV = uSplatVel[i].xy;
    float speed = length(pushV);
    if (speed > 1e-3) {
      vec2 n = pushV / speed;
      float along = dot(v, n);
      if (exposure == 1.0) {
        // Keep the established 60 Hz push, without powers in the common case.
        v += n * max(0.0, speed - along) * w * 0.8;
        v += (pushV - v) * w * 0.12;
      } else {
        // A force starting or ending partway through a tick receives fractional exposure.
        float blend = 1.0 - pow(1.0 - w * 0.12, exposure);
        float catchUp = 1.0 - pow((1.0 - w * 0.8) * (1.0 - w * 0.12), exposure);
        v += n * (speed - along) * (along < speed ? catchUp : blend);
        v -= (v - n * dot(v, n)) * blend;
      }
    }

    float swirl = uSplatMix[i].y;
    if (swirl > 0.0) {
      vec2 rel = world - b;
      float rl = length(rel);
      vec2 tang = vec2(-rel.y, rel.x) / max(rl, 1e-3);
      float ring = (rl / r) * exp(-rl * rl / (r * r)) * 2.33;
      v += tang * swirl * ring * uDt * exposure;
    }

    s.z += uSplatMix[i].x * w * exposure;
    s.w += uSplatVel[i].w * exp(-d * d / (r * r * 1.3)) * uDt * exposure;
  }

  gl_FragColor = vec4(v, min(s.z, 1.6), min(s.w, 2.5));
}`;

/**
 * Several passes fused into one, bit for bit: a value an earlier pass would have stored in a half-float target is
 * rounded to half here, and neighbours are taken at grid positions clamped one step at a time, as sampling each
 * intermediate texture would have clamped them. Each pass on a tiled GPU costs a fixed load and store on top of its
 * pixels.
 */
const HALF = /* glsl */ `
float half1(float v) { return unpackHalf2x16(packHalf2x16(vec2(v, 0.0))).x; }
vec4 half4(vec4 v) { return vec4(unpackHalf2x16(packHalf2x16(v.xy)), unpackHalf2x16(packHalf2x16(v.zw))); }
`;

type Cell = [number, number];
const diamond = (r: number): Cell[] => {
  const cells: Cell[] = [];
  for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (Math.abs(a) + Math.abs(b) <= r) cells.push([a, b]);
  return cells;
};
const tag = (a: number, b: number) => `${a < 0 ? 'm' + -a : a}_${b < 0 ? 'm' + -b : b}`;
/**
 * A cell computed from its neighbours is wrong where it lies outside the grid: there it takes the value of the cell
 * it clamps to, the nearest one inward, which (working outward) is already right.
 */
const clampCells = (name: string, cells: Cell[]): string => {
  const lines: string[] = [];
  const order = [...cells].sort((p, q) => Math.abs(p[0]) - Math.abs(q[0]));
  for (const [a, b] of order) {
    if (a < 0) lines.push(`if (at.x + ${a} < 0) ${name}${tag(a, b)} = ${name}${tag(a + 1, b)};`);
    if (a > 0) lines.push(`if (at.x + ${a} > last.x) ${name}${tag(a, b)} = ${name}${tag(a - 1, b)};`);
  }
  for (const [a, b] of [...cells].sort((p, q) => Math.abs(p[1]) - Math.abs(q[1]))) {
    if (b < 0) lines.push(`if (at.y + ${b} < 0) ${name}${tag(a, b)} = ${name}${tag(a, b + 1)};`);
    if (b > 0) lines.push(`if (at.y + ${b} > last.y) ${name}${tag(a, b)} = ${name}${tag(a, b - 1)};`);
  }
  return lines.join('\n  ');
};
const fetchAt = (sampler: string, a: number, b: number) => `texelFetch(${sampler}, clamp(at + ivec2(${a}, ${b}), ivec2(0), last), 0)`;

/** The curl pass folded into the vorticity pass: CURL_FRAG at the centre and its four neighbours, as stored. */
export const CURL_VORTICITY_FRAG = /* glsl */ `
uniform sampler2D uVel;
uniform float uStrength;
uniform float uDt;
in vec2 vUv;
${HALF}
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  ivec2 last = textureSize(uVel, 0) - 1;
  ${diamond(2).map(([a, b]) => `vec2 v${tag(a, b)} = ${fetchAt('uVel', a, b)}.xy;`).join('\n  ')}
  ${diamond(1).map(([a, b]) => `float c${tag(a, b)} = half1(0.5 * (v${tag(a + 1, b)}.y - v${tag(a - 1, b)}.y - v${tag(a, b + 1)}.x + v${tag(a, b - 1)}.x));`).join('\n  ')}
  ${clampCells('c', diamond(1))}
  float L = c${tag(-1, 0)};
  float R = c${tag(1, 0)};
  float B = c${tag(0, -1)};
  float T = c${tag(0, 1)};
  float C = c${tag(0, 0)};
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 1e-4;
  force *= uStrength * C;
  force.y *= -1.0;
  vec4 s = texture(uVel, vUv);
  s.xy += force * uDt;
  s.xy = clamp(s.xy, vec2(-60.0), vec2(60.0));
  gl_FragColor = s;
}`;

export const DIVERGENCE_FRAG = /* glsl */ `
uniform sampler2D uVel;
${NEIGHBOURS}
void main() {
  float L = texture(uVel, uvL()).x;
  float R = texture(uVel, uvR()).x;
  float B = texture(uVel, uvB()).y;
  float T = texture(uVel, uvT()).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

/**
 * `depth` Jacobi relaxations of PRESSURE in one pass (two passes of it once read `(L + R + B + T - div) * 0.25`);
 * `scaled` folds in the pass that carries the last solve over at `uScale` as the first guess.
 */
export function pressureFrag(depth: number, scaled: boolean): string {
  const levels: string[] = [];
  for (let k = 1; k <= depth; k++) {
    const cells = diamond(depth - k);
    const p = (a: number, b: number) => `p${k - 1}_${tag(a, b)}`;
    levels.push(cells.map(([a, b]) => {
      const sum = `(${p(a - 1, b)} + ${p(a + 1, b)} + ${p(a, b - 1)} + ${p(a, b + 1)} - d${tag(a, b)}) * 0.25`;
      return `float p${k}_${tag(a, b)} = ${k < depth ? `half1(${sum})` : sum};`;
    }).join('\n  '));
    if (k < depth) levels.push(clampCells(`p${k}_`, cells));
  }
  const read = (a: number, b: number) => `${fetchAt('uPressure', a, b)}.x`;
  return /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform float uScale;
${HALF}
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  ivec2 last = textureSize(uPressure, 0) - 1;
  ${diamond(depth).map(([a, b]) => `float p0_${tag(a, b)} = ${scaled ? `half1(${read(a, b)} * uScale)` : read(a, b)};`).join('\n  ')}
  ${diamond(depth - 1).map(([a, b]) => `float d${tag(a, b)} = ${fetchAt('uDivergence', a, b)}.x;`).join('\n  ')}
  ${levels.join('\n  ')}
  gl_FragColor = vec4(p${depth}_${tag(0, 0)}, 0.0, 0.0, 1.0);
}`;
}

export const GRADIENT_FRAG = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uVel;
${NEIGHBOURS}
void main() {
  float L = texture(uPressure, uvL()).x;
  float R = texture(uPressure, uvR()).x;
  float B = texture(uPressure, uvB()).x;
  float T = texture(uPressure, uvT()).x;
  vec4 s = texture(uVel, vUv);
  s.xy -= 0.5 * vec2(R - L, T - B);
  gl_FragColor = s;
}`;

/** Moves the wind, the grass lean and the sway together; outside the old window each takes its own still value. */
export const SHIFT_FRAG = /* glsl */ `
uniform sampler2D uVel;
uniform sampler2D uBend;
uniform sampler2D uSway;
uniform vec2 uOffset;
uniform vec4 uOutside;
in vec2 vUv;
layout(location = 1) out highp vec4 fragBend;
layout(location = 2) out highp vec4 fragSway;
void main() {
  vec2 uv = vUv + uOffset;
  bool inside = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
  gl_FragColor = inside ? texture(uVel, uv) : uOutside;
  fragBend = inside ? texture(uBend, uv) : vec4(0.0);
  fragSway = inside ? texture(uSway, uv) : vec4(0.0);
}`;

export const SCALE_FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform float uScale;
in vec2 vUv;
void main() {
  gl_FragColor = texture(uSrc, vUv) * uScale;
}`;

/**
 * Advection, then the grass lean and the sway driven by the advected wind as it is stored. Channels: the wind xy
 * velocity, z gust energy, w updraft; the lean xy (radians, world XZ) and its velocity zw, a damped spring so gusts
 * overshoot and settle; the sway xy, the wind hanging things feel on a softer spring (world units per second), and
 * its rate of change zw, so cloth and leaves take the gust late, overshoot and swing back.
 */
export const ADVECT_FRAG = /* glsl */ `
uniform sampler2D uVel;
uniform sampler2D uBend;
uniform sampler2D uSway;
uniform float uDt;
uniform vec4 uDomain;
uniform float uVelDissipation;
uniform float uEnergyDecay;
uniform float uLiftDecay;
uniform float uBendStiffness;
uniform float uBendDamping;
uniform float uSwayStiffness;
uniform float uSwayDamping;
uniform float uCalm;
in vec2 vUv;
layout(location = 1) out highp vec4 fragBend;
layout(location = 2) out highp vec4 fragSway;
${HALF}
${FELT_GLSL}
void main() {
  vec2 coord = vUv - uDt * texture(uVel, vUv).xy * uDomain.zw;
  vec4 s = texture(uVel, coord);
  s.xy /= 1.0 + uVelDissipation * uDt;
  s.z *= exp(-uDt * uEnergyDecay);
  s.w *= exp(-uDt * uLiftDecay);
  gl_FragColor = s;
  vec4 w = half4(s);

  vec4 b = texture(uBend, vUv);
  float sp = length(w.xy);
  vec2 dir = sp > 1e-4 ? w.xy / sp : vec2(0.0);
  float amount = (1.0 - exp(-sp / 8.0)) * 1.3;
  vec2 target = dir * amount;
  vec2 acc = uBendStiffness * (target - b.xy) - uBendDamping * b.zw;
  b.zw += acc * uDt;
  b.xy += b.zw * uDt;
  fragBend = b;

  vec4 h = texture(uSway, vUv);
  vec2 felt = feltWind(w, uCalm);
  vec2 pull = uSwayStiffness * (felt - h.xy) - uSwayDamping * h.zw;
  h.zw += pull * uDt;
  h.xy += h.zw * uDt;
  fragSway = h;
}`;
