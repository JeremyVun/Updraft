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
 * Passes fused bit for bit: neighbours are clamped one step at a time as each stored texture's sampling clamped them,
 * a value a pass would have stored in a half-float target is cut to half as the store cuts it, toward zero
 * (`storeHalf`), and sums keep the order their own pass computed them in through `pin`, a zero (`uZero`) fast math
 * cannot see through: in a bigger shader it regroups them. On a tiled GPU every pass costs a load and store of its
 * target.
 */
const HALF = /* glsl */ `
float storeHalf(float v) {
  float a = abs(v);
  if (a < 6.103515625e-05) return trunc(v * 16777216.0) * 5.9604644775390625e-08;
  if (a >= 65536.0) return sign(v) * 65504.0;
  return uintBitsToFloat(floatBitsToUint(v) & 0xFFFFE000u);
}
vec4 storeHalf4(vec4 v) { return vec4(storeHalf(v.x), storeHalf(v.y), storeHalf(v.z), storeHalf(v.w)); }
uniform uint uZero;
float pin(float v) { return uintBitsToFloat(floatBitsToUint(v) ^ uZero); }
float nearHalf(float v) {
  if (abs(v) < 6.103515625e-05) return roundEven(v * 16777216.0) * 5.9604644775390625e-08;
  uint b = floatBitsToUint(v);
  uint rest = b & 0x1FFFu;
  b &= 0xFFFFE000u;
  if (rest > 0x1000u || (rest == 0x1000u && (b & 0x2000u) != 0u)) b += 0x2000u;
  return uintBitsToFloat(b);
}
`;

type Cell = [number, number];
const diamond = (r: number): Cell[] => {
  const cells: Cell[] = [];
  for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (Math.abs(a) + Math.abs(b) <= r) cells.push([a, b]);
  return cells;
};
const tag = (a: number, b: number) => `${a < 0 ? 'm' + -a : a}_${b < 0 ? 'm' + -b : b}`;
/** Outside the grid a cell takes the value of the one it clamps to, the nearest inward, already right. */
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

/**
 * Vorticity confinement, with the curl it reads worked out here at the centre and its four neighbours, as stored and
 * in the order its own pass compiled to: right less left, plus bottom, less top.
 */
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
  ${diamond(1).map(([a, b]) => `float c${tag(a, b)} = storeHalf(0.5 * pin(pin(pin(v${tag(a + 1, b)}.y - v${tag(a - 1, b)}.y) + v${tag(a, b - 1)}.x) - v${tag(a, b + 1)}.x));`).join('\n  ')}
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
 * `pairs` pairs of Jacobi relaxations of the pressure in one pass, each pair the arithmetic its own pass compiled to
 * on Chrome's Metal backend, which the field has always run: the four relaxations summed left to right, only the left
 * one rounded to half (to nearest), then the pair's sum taking the divergence before the top neighbour. `scaled`
 * carries the last solve over at `uScale` first.
 */
export function pressureFrag(pairs: number, scaled: boolean): string {
  const depth = pairs * 2;
  const body: string[] = [];
  for (let k = 1; k <= depth; k++) {
    const inner = k % 2 === 1;
    const p = (a: number, b: number) => `p${k - 1}_${tag(a, b)}`;
    const cells = diamond(depth - k);
    body.push(cells.map(([a, b]) => {
      const d = `d${tag(a, b)}`;
      const sum = inner
        ? `pin(pin(pin(pin(${p(a - 1, b)} + ${p(a + 1, b)}) + ${p(a, b - 1)}) + ${p(a, b + 1)}) - ${d}) * 0.25`
        : `pin(pin(pin(pin(nearHalf(${p(a - 1, b)}) + ${p(a + 1, b)}) + ${p(a, b - 1)}) - ${d}) + ${p(a, b + 1)}) * 0.25`;
      return `float p${k}_${tag(a, b)} = ${!inner && k < depth ? `storeHalf(${sum})` : sum};`;
    }).join('\n  '));
    if (k < depth) body.push(clampCells(`p${k}_`, cells));
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
  ${diamond(depth).map(([a, b]) => `float p0_${tag(a, b)} = ${scaled ? `storeHalf(${read(a, b)} * uScale)` : read(a, b)};`).join('\n  ')}
  ${diamond(depth - 1).map(([a, b]) => `float d${tag(a, b)} = ${fetchAt('uDivergence', a, b)}.x;`).join('\n  ')}
  ${body.join('\n  ')}
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
 * Advection, then from the advected wind as stored: the grass lean (xy radians, zw its velocity), a damped spring so
 * gusts overshoot and settle, and the sway hanging things feel (xy, zw its rate), a softer one so they take it late.
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
  vec4 w = storeHalf4(s);

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
