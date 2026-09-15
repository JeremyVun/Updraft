import { NOISE_GLSL } from '../world/atmosphere';

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

  float base = length(uBreeze);
  vec2 dir = uBreeze / max(base, 1e-4);
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 q = world * 0.02 - uBreeze * uTime * 0.02;
  float gust = fbm(q);
  float veer = (vnoise(q * 0.6 + 11.3) - 0.5) * 0.7;
  vec2 target = base > 1e-3 ? normalize(dir + perp * veer) * base * (0.3 + 2.3 * gust * gust) : vec2(0.0);
  v += (target - v) * (1.0 - exp(-uDt * uRelax));

  for (int i = 0; i < ${MAX_SPLATS}; i++) {
    if (i >= uSplatCount) break;
    vec2 a = uSplatSeg[i].xy;
    vec2 b = uSplatSeg[i].zw;
    vec2 ab = b - a;
    float t = clamp(dot(world - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float d = length(world - (a + ab * t));
    float r = uSplatVel[i].z;
    float w = exp(-d * d / (r * r));

    vec2 pushV = uSplatVel[i].xy;
    float speed = length(pushV);
    if (speed > 1e-3) {
      vec2 n = pushV / speed;
      float along = dot(v, n);
      v += n * max(0.0, speed - along) * w * 0.8;
      v += (pushV - v) * w * 0.12;
    }

    float swirl = uSplatMix[i].y;
    if (swirl > 0.0) {
      vec2 rel = world - b;
      float rl = length(rel);
      vec2 tang = vec2(-rel.y, rel.x) / max(rl, 1e-3);
      float ring = (rl / r) * exp(-rl * rl / (r * r)) * 2.33;
      v += tang * swirl * ring * uDt;
    }

    s.z += uSplatMix[i].x * w;
    s.w += uSplatVel[i].w * exp(-d * d / (r * r * 1.3)) * uDt;
  }

  gl_FragColor = vec4(v, min(s.z, 1.6), min(s.w, 2.5));
}`;

export const CURL_FRAG = /* glsl */ `
uniform sampler2D uVel;
${NEIGHBOURS}
void main() {
  float L = texture(uVel, uvL()).y;
  float R = texture(uVel, uvR()).y;
  float B = texture(uVel, uvB()).x;
  float T = texture(uVel, uvT()).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

export const VORTICITY_FRAG = /* glsl */ `
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform float uStrength;
uniform float uDt;
${NEIGHBOURS}
void main() {
  float L = texture(uCurl, uvL()).x;
  float R = texture(uCurl, uvR()).x;
  float B = texture(uCurl, uvB()).x;
  float T = texture(uCurl, uvT()).x;
  float C = texture(uCurl, vUv).x;
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

export const PRESSURE_FRAG = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
${NEIGHBOURS}
void main() {
  float L = texture(uPressure, uvL()).x;
  float R = texture(uPressure, uvR()).x;
  float B = texture(uPressure, uvB()).x;
  float T = texture(uPressure, uvT()).x;
  float div = texture(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

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

export const SHIFT_FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uOffset;
uniform vec4 uOutside;
in vec2 vUv;
void main() {
  vec2 uv = vUv + uOffset;
  bool inside = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
  gl_FragColor = inside ? texture(uSrc, uv) : uOutside;
}`;

export const SCALE_FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform float uScale;
in vec2 vUv;
void main() {
  gl_FragColor = texture(uSrc, vUv) * uScale;
}`;

export const ADVECT_FRAG = /* glsl */ `
uniform sampler2D uVel;
uniform float uDt;
uniform vec4 uDomain;
uniform float uVelDissipation;
uniform float uEnergyDecay;
uniform float uLiftDecay;
in vec2 vUv;
void main() {
  vec2 coord = vUv - uDt * texture(uVel, vUv).xy * uDomain.zw;
  vec4 s = texture(uVel, coord);
  s.xy /= 1.0 + uVelDissipation * uDt;
  s.z *= exp(-uDt * uEnergyDecay);
  s.w *= exp(-uDt * uLiftDecay);
  gl_FragColor = s;
}`;

/**
 * Grass lean as a damped spring field driven by the wind, so gusts overshoot and settle.
 * Channels: xy lean vector (radians, world XZ), zw lean velocity.
 */
export const BEND_FRAG = /* glsl */ `
uniform sampler2D uBend;
uniform sampler2D uVel;
uniform float uDt;
uniform float uStiffness;
uniform float uDamping;
in vec2 vUv;
void main() {
  vec4 b = texture(uBend, vUv);
  vec4 w = texture(uVel, vUv);
  float sp = length(w.xy);
  vec2 dir = sp > 1e-4 ? w.xy / sp : vec2(0.0);
  float amount = (1.0 - exp(-sp / 8.0)) * 1.3;
  vec2 target = dir * amount;
  vec2 acc = uStiffness * (target - b.xy) - uDamping * b.zw;
  b.zw += acc * uDt;
  b.xy += b.zw * uDt;
  gl_FragColor = b;
}`;
