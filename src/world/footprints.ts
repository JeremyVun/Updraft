import * as THREE from 'three';
import { glsl, tuning } from '../tuning';
import { GRASS_LINE, heightAt } from './island';

/** Two rings, the child's boots and the cygnet's webbed feet, each cut into chunks with their own bounds. */
const CHILD = 64;
const BIRD = 32;
const PRINTS = CHILD + BIRD;
const CHUNK = 8;
const CHUNKS = PRINTS / CHUNK;
/** Half the longest print, for the chunks' bounds. */
const REACH = 0.3;
const EMPTY = 1e6;

export const footprintUniforms = {
  /** x, z, heading, birth time. */
  uPrints: { value: Array.from({ length: PRINTS }, () => new THREE.Vector4(EMPTY, EMPTY, 0, -1e4)) },
  /** Bounds of each chunk of eight prints: min x, min z, max x, max z. */
  uPrintChunks: { value: Array.from({ length: CHUNKS }, () => new THREE.Vector4(EMPTY, EMPTY, -EMPTY, -EMPTY)) },
  /** The next slot each ring writes, so the oldest prints in a full ring fade out before they are reused. */
  uPrintHeads: { value: new THREE.Vector2() },
  uPrintsLive: { value: 0 },
};

/**
 * Prints pressed into the sand. Each is a soft dent, darker inside, its walls lit and shaded by the sun, softening
 * as it ages and gone after `tuning.footprints.fadeTo`; any wave that runs over one after it was made wipes it.
 * Needs SURF_GLSL first; `sandy` is how much the ground is bare sand.
 */
export const FOOTPRINT_GLSL = /* glsl */ `
uniform vec4 uPrints[${PRINTS}];
uniform vec4 uPrintChunks[${CHUNKS}];
uniform vec2 uPrintHeads;
uniform float uPrintsLive;

float printEllipse(vec2 q, vec2 c, vec2 r) {
  return (length((q - c) / r) - 1.0) * min(r.x, r.y);
}

float printBlend(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/** Distance outside a print, q across and along its heading: a round-toed boot, or three webbed toes. */
float printShape(vec2 q, bool bird) {
  if (bird) {
    vec2 a = vec2(0.0, -0.035);
    float web = max(printEllipse(q, vec2(0.0, 0.03), vec2(0.06, 0.07)), -printEllipse(q, vec2(0.0, 0.135), vec2(0.07, 0.045)));
    web = max(web, a.y - q.y);
    float toes = 1e3;
    for (int t = -1; t <= 1; t++) {
      vec2 dir = normalize(vec2(float(t) * 0.62, 1.0));
      vec2 p = q - a;
      float along = clamp(dot(p, dir), 0.0, 0.105);
      toes = min(toes, length(p - dir * along) - 0.011);
    }
    return min(web + 0.004, toes);
  }
  float sole = printEllipse(q, vec2(0.0, 0.065), vec2(0.085, 0.14));
  float heel = printEllipse(q, vec2(0.0, -0.13), vec2(0.068, 0.07));
  return printBlend(sole, heel, 0.035);
}

/** The ground's rise across a print's edge: down into the dent, up over the lip of pushed-out sand. */
float printRelief(float d, float s) {
  return -(1.0 - smoothstep(-s, s, d)) + 0.28 * exp(-pow((d - 1.6 * s) / (1.2 * s), 2.0));
}

/** Whether any wave has run up over distance x from the waterline here in the last age seconds. */
bool printWashed(vec2 xz, float x, float age) {
  if (x > 4.6) return false;
  float c = surfCycle(xz);
  float c0 = c - age / SURF_PERIOD;
  float k = floor(c0);
  for (int i = 0; i < 8; i++) {
    if (k > c) break;
    float reach = surfReach(k, xz);
    if (reach > x) {
      float q = sqrt(clamp(1.0 - (x - SURF_LOW) / (reach - SURF_LOW), 0.0, 1.0));
      float covered = k + SURF_UP * (1.0 - q);
      if (covered > c0 && covered <= c) return true;
    }
    k += 1.0;
  }
  return false;
}

/** Shades the prints near xz into lit sand. shore: distance from the waterline; px: world size of a pixel. */
vec3 pressPrints(vec3 col, vec2 xz, float shore, float px, float sunVis) {
  vec2 sunXZ = normalize(uSunDir.xz + 1e-5);
  float shade = 0.0;
  float hollow = 0.0;
  for (int c = 0; c < ${CHUNKS}; c++) {
    vec4 b = uPrintChunks[c];
    if (xz.x < b.x || xz.y < b.y || xz.x > b.z || xz.y > b.w) continue;
    for (int j = 0; j < ${CHUNK}; j++) {
      int i = c * ${CHUNK} + j;
      vec4 p = uPrints[i];
      vec2 rel = xz - p.xy;
      if (dot(rel, rel) > ${glsl(REACH * REACH)}) continue;
      bool bird = i >= ${CHILD};
      float age = uTime - p.w;
      float steps = bird ? mod(uPrintHeads.y - float(i - ${CHILD}) + ${BIRD}.0, ${BIRD}.0) : mod(uPrintHeads.x - float(i) + ${CHILD}.0, ${CHILD}.0);
      float ring = bird ? ${BIRD}.0 : ${CHILD}.0;
      float fade = (1.0 - smoothstep(${glsl(tuning.footprints.fadeFrom)}, ${glsl(tuning.footprints.fadeTo)}, age))
        * (1.0 - smoothstep(ring * 0.6, ring, steps));
      if (fade <= 0.0 || printWashed(xz, shore, age)) continue;
      vec2 fwd = vec2(sin(p.z), cos(p.z));
      vec2 q = vec2(dot(rel, vec2(fwd.y, -fwd.x)), dot(rel, fwd));
      float s = max(bird ? 0.006 : 0.012, px * 0.7) * (1.0 + age * 0.05);
      float d = printShape(q, bird);
      float e = 0.006;
      vec2 g = vec2(printShape(q + vec2(e, 0.0), bird) - d, printShape(q + vec2(0.0, e), bird) - d) / e;
      g = g.x * vec2(fwd.y, -fwd.x) + g.y * fwd;
      float slope = (printRelief(d + e, s) - printRelief(d - e, s)) / (2.0 * e);
      float depth = (1.0 - smoothstep(-s, s, d)) * fade;
      shade += -slope * dot(g, sunXZ) * s * fade;
      hollow = max(hollow, depth);
    }
  }
  float relief = clamp(shade, -1.0, 1.0) * ${glsl(tuning.footprints.relief)} * (0.35 + 0.65 * sunVis);
  vec3 cool = mix(vec3(1.0), vec3(0.8, 0.86, 0.95), hollow * ${glsl(tuning.footprints.depth)} * 2.5);
  return col * cool * (1.0 - hollow * ${glsl(tuning.footprints.depth)}) * (1.0 + relief);
}
`;

/** Keeps the rings of prints and hands them to the terrain shader; nothing is drawn while none are live. */
export class Footprints {
  private readonly heads = [0, 0];
  private readonly births = new Float32Array(PRINTS).fill(-1e4);
  private readonly stale = new Set<number>();
  private live = 0;

  /** A foot set down on bare sand above the sea leaves a print; anywhere else nothing. kind 0 child, 1 cygnet. */
  press(x: number, z: number, heading: number, kind: 0 | 1, time: number): void {
    const h = heightAt(x, z);
    if (h < -0.1 || h > GRASS_LINE + 0.9) return;
    const size = kind === 0 ? CHILD : BIRD;
    const slot = (kind === 0 ? 0 : CHILD) + this.heads[kind];
    this.heads[kind] = (this.heads[kind] + 1) % size;
    footprintUniforms.uPrints.value[slot].set(x, z, heading, time);
    if (this.births[slot] < 0) this.live++;
    this.births[slot] = time;
    footprintUniforms.uPrintHeads.value.set(this.heads[0], this.heads[1]);
    this.stale.add(Math.floor(slot / CHUNK));
  }

  update(time: number): void {
    for (let i = 0; i < PRINTS; i++) {
      if (this.births[i] >= 0 && time - this.births[i] > tuning.footprints.fadeTo) {
        this.births[i] = -1e4;
        footprintUniforms.uPrints.value[i].set(EMPTY, EMPTY, 0, -1e4);
        this.live--;
        this.stale.add(Math.floor(i / CHUNK));
      }
    }
    for (const c of this.stale) {
      const box = footprintUniforms.uPrintChunks.value[c].set(EMPTY, EMPTY, -EMPTY, -EMPTY);
      for (let i = c * CHUNK; i < (c + 1) * CHUNK; i++) {
        if (this.births[i] < 0) continue;
        const p = footprintUniforms.uPrints.value[i];
        box.set(Math.min(box.x, p.x - REACH), Math.min(box.y, p.y - REACH), Math.max(box.z, p.x + REACH), Math.max(box.w, p.y + REACH));
      }
    }
    this.stale.clear();
    footprintUniforms.uPrintsLive.value = this.live > 0 ? 1 : 0;
  }
}
