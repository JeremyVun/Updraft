import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { INSET, LOOP_GAP, OPENING, RAIL_HEIGHT, STEP, STEP_BLOCK, STRING, type Flight, type Landing } from './stairs-layout';
import { LOOP_EYE, LOOP_SHRINK } from './stairs-penrose';

/** A ball of cloud: where it is, how big, and how much of it there is. */
export interface Puff { x: number; y: number; z: number; r: number; a: number }

/** How far short of the stair a puff thins away to nothing, so its card never shows where it passes through. */
export const SOLID_FADE = 0.55;
/** Up to this many solids, flights of the stair or figures on it, are near enough each puff to thin it. */
export const SOLIDS_PER_PUFF = 8;

/** How far toward the lens a puff's card stands, in its radius: halfway keeps the veil over the stair as it was on the whole. */
export const FRONT = 0.5;
/** How many cells each card is cut into across, so the distance to a solid is found at its corners and blended between. */
const GRID = 4;
/** Blending the distance across a cell overstates it near a solid's edges by up to this much, so the thinning starts this far out. */
const BLEND = 0.1;
const SLOPE = STEP.rise / STEP.going;
const ACROSS_SLOPE = STEP.going / Math.hypot(STEP.going, STEP.rise);
const SIDE = STEP.width / 2 + STRING.thick / 2 - 0.01;
const POST = { radius: 0.16, below: 0.3, above: 1.3 } as const;
const f = (n: number) => n.toFixed(4);
const v3 = (v: THREE.Vector3) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;

/**
 * How far a point is from what a puff thins against, near enough: a figure as a capsule; a flight of the stair and the
 * landing it arrives on, their blocks, rails and newels as boxes round them; or the loop's last flight as drawn in,
 * taken back to where it is built. A flight is sheared so its nosings lie level, its distances across the slope
 * shrunk to true.
 */
const SOLID_GLSL = /* glsl */ `
float boxDistance(vec3 p, vec3 lo, vec3 hi) {
  vec3 q = abs(p - (lo + hi) * 0.5) - (hi - lo) * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float postDistance(vec2 across, float y) {
  return max(length(across) - ${f(POST.radius)}, abs(y - ${f((POST.above - POST.below) / 2)}) - ${f((POST.above + POST.below) / 2)});
}
float flightDistance(vec3 l, float run, float top) {
  vec3 s = vec3(l.x, (l.y - l.z * ${f(SLOPE)}) * ${f(ACROSS_SLOPE)}, l.z);
  float d = boxDistance(s, vec3(${f(-SIDE - STRING.thick / 2)}, ${f(-(STEP_BLOCK + 0.03) * ACROSS_SLOPE)}, -0.27),
    vec3(${f(SIDE + STRING.thick / 2)}, ${f((STEP.rise + 0.03) * ACROSS_SLOPE)}, run + 0.12));
  s.x = abs(s.x);
  d = min(d, boxDistance(s, vec3(${f(SIDE - 0.1)}, ${f((STEP.rise - 0.05) * ACROSS_SLOPE)}, ${f(-INSET)}),
    vec3(${f(SIDE + 0.1)}, ${f((STEP.rise + RAIL_HEIGHT - 0.02) * ACROSS_SLOPE)}, run + ${f(INSET)})));
  bool foot = l.z < run * 0.5;
  return min(d, postDistance(vec2(abs(l.x) - ${f(OPENING)}, l.z - (foot ? ${f(-INSET)} : run + ${f(INSET)})), l.y - (foot ? 0.0 : top)));
}
float landingDistance(vec3 l, vec4 c) {
  float d = boxDistance(l, vec3(c.x, -0.34, c.z), vec3(c.y, 0.03, c.w));
  vec2 mid = vec2(c.x + c.y, c.z + c.w) * 0.5;
  vec2 extent = vec2(c.y - c.x, c.w - c.z) * 0.5 - ${f(INSET)};
  vec2 q = abs(l.xz - mid) - extent;
  vec2 rim = vec2(abs(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0)) - 0.1, abs(l.y - ${f((RAIL_HEIGHT + 0.1) / 2)}) - ${f((RAIL_HEIGHT + 0.1) / 2)});
  d = min(d, length(max(rim, 0.0)) + min(max(rim.x, rim.y), 0.0));
  return min(d, postDistance(abs(l.xz - mid) - extent, l.y));
}
float solidDistance(vec3 p, int i) {
  vec4 a = uSolids[i * 3], b = uSolids[i * 3 + 1], c = uSolids[i * 3 + 2];
  if (a.w > 0.5 && a.w < 1.5) {
    vec3 ab = b.xyz - a.xyz;
    return length(p - a.xyz - ab * clamp(dot(p - a.xyz, ab) / dot(ab, ab), 0.0, 1.0)) - b.w;
  }
  float scale = 1.0;
  if (a.w > 1.5) {
    // Drawn in toward the copy of the corner, and depth-tested as if it stood where it seems to from the eye.
    vec3 eye = ${v3(LOOP_EYE)}, toward = eye * ${f(1 - LOOP_SHRINK)} - ${v3(LOOP_GAP)} * ${f(LOOP_SHRINK)};
    vec3 built = p;
    for (int n = 0; n < 3; n++) {
      float s = clamp(dot(built.xz - a.xz, b.yx) / b.z, 0.0, 1.0);
      float drawn = s * (1.0 - uTrick.x);
      float shrink = 1.0 - drawn * ${f(1 - LOOP_SHRINK)};
      float seems = mix(1.0 / (1.0 - s * ${f(1 - LOOP_SHRINK)}), 1.0, uTrick.y);
      built = ((p - eye) / seems + eye - toward * drawn) / shrink;
      scale = shrink * seems;
    }
    p = built;
  }
  vec3 d = p - a.xyz;
  vec3 l = vec3(dot(d.xz, vec2(b.x, -b.y)), d.y, dot(d.xz, b.yx));
  // Most of a puff is well clear of a flight it can reach somewhere; the box round all of it says so cheaply.
  float bound = boxDistance(l, vec3(min(c.x, -1.05), -0.7, -0.4), vec3(max(c.y, 1.05), b.w + 1.35, c.w)) * scale;
  if (bound > ${f(BLEND + SOLID_FADE)}) return bound;
  float flight = flightDistance(l, b.z, b.w) * scale;
  if (a.w > 1.5) return flight;
  return min(flight, landingDistance(l - vec3(0.0, b.w, 0.0), c));
}`;

/** A capsule, placed as it moves: its ends in the first two vec4s and its radius in the second's w. */
export function figureSolid(): THREE.Vector4[] {
  return [new THREE.Vector4(0, -1e4, 0, 1), new THREE.Vector4(0, -1e4, 0, 0), new THREE.Vector4()];
}

/** A flight and the landing it arrives on: where it starts, its turn, run and rise, and the landing's extent in its frame; or, with no landing, the loop's last flight as drawn in. */
export function flightSolid(fl: Flight, L: Landing | null): THREE.Vector4[] {
  const run = STEP.going * (fl.risers - 1);
  return [new THREE.Vector4(fl.bottom.x, fl.bottom.y, fl.bottom.z, L ? 0 : 2),
    new THREE.Vector4(Math.cos(fl.yaw), Math.sin(fl.yaw), run, fl.risers * STEP.rise),
    L ? new THREE.Vector4(L.x0, L.x1, run, run + L.z1 - L.z0) : new THREE.Vector4(-1.05, 1.05, run, run + 0.35)];
}

const VERT = (solids: number) => /* glsl */ `
${ATMO_GLSL}
uniform vec4 uSolids[${solids * 3}];
uniform vec2 uTrick;
in vec3 aCentre;
in vec2 aCorner;
in float aRadius;
in float aAlpha;
in vec4 aSolids;
in vec4 aMoreSolids;
in float aSoft;
out vec2 vCorner;
out vec3 vWorld;
out vec3 vCentre;
out float vAlpha;
out vec4 vFog;
out float vSun;
out float vClear;
${SOLID_GLSL}
void main() {
  vec3 c = (modelMatrix * vec4(aCentre, 1.0)).xyz;
  // Right at the lens a card would fill the screen for nothing, it has faded out by then: it is not drawn at all.
  float near = distance(c, cameraPosition);
  float fade = smoothstep(1.2, 3.4, near);
  if (fade <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  // The haze and the light change little across one ball, so they are found once for the whole of it.
  vFog = fogOf(c);
  vSun = cloudShadow(c.xz);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // Each one breathes a little, out of step with the rest.
  float r = aRadius * (1.0 + 0.07 * sin(uTime * 0.6 + aCentre.x * 3.1 + aCentre.z * 2.3));
  vCorner = aCorner * 1.3;
  vWorld = c + (right * vCorner.x + up * vCorner.y) * r;
  vCentre = c;
  vAlpha = aAlpha * fade;
  // Through its middle the card would cut whatever stands in the ball, veiled behind and bare in front; drawn
  // nearer, the same on screen, what is in the ball is behind it, and where something reaches the card it thins away.
  float depth = -(viewMatrix * vec4(c, 1.0)).z;
  vec3 drawn = cameraPosition + (vWorld - cameraPosition) * max(depth - r * ${f(FRONT)}, min(depth, 0.6)) / depth;
  gl_Position = projectionMatrix * viewMatrix * vec4(drawn, 1.0);
  vClear = ${f(BLEND + SOLID_FADE)};
  for (int k = 0; k < ${SOLIDS_PER_PUFF}; k++) {
    float id = k < 4 ? aSolids[k] : aMoreSolids[k - 4];
    if (id < 0.0) break;
    vClear = min(vClear, solidDistance(drawn, int(id)));
  }
  vClear = mix(${f(BLEND + SOLID_FADE)}, vClear, aSoft);
}`;

/** Lit like the top of the cloud deck: gold where the low sun reaches it, glowing at the rim against the light, lilac underneath. */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uPuffs;
in vec2 vCorner;
in vec3 vWorld;
in vec3 vCentre;
in float vAlpha;
in vec4 vFog;
in float vSun;
in float vClear;
void main() {
  float d = length(vCorner);
  // The lumps reach at most 1.25 out; beyond that the ball has no body, so skip its noise.
  if (d >= 1.25) discard;
  float around = atan(vCorner.y, vCorner.x);
  float lump = vnoise(vec2(around * 1.9 + vCentre.x * 4.0, vCentre.z * 4.0 + uTime * 0.12))
    + 0.5 * vnoise(vec2(around * 4.3 - vCentre.y * 3.0, uTime * 0.2));
  // Soft all the way from the middle, so overlapping balls add up to mist rather than show as a bunch of balls.
  float body = 1.0 - smoothstep(0.0, 0.8 + 0.3 * lump, d);
  float a = body * body * vAlpha * uPuffs;
  a *= smoothstep(${f(BLEND)}, ${f(BLEND + SOLID_FADE)}, vClear);
  if (a <= 0.004) discard;
  float k = min(d, 1.0);
  vec3 nv = vec3(vCorner / max(d, 1.0), sqrt(max(0.0, 1.0 - k * k)));
  vec3 N = normalize(transpose(mat3(viewMatrix)) * nv);
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = vSun;
  float wrap = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float toward = pow(max(0.0, dot(-V, uSunDir)), 4.0);
  vec3 shade = mix(vec3(0.66, 0.62, 0.76), vec3(0.84, 0.8, 0.88), N.y * 0.5 + 0.5) * (uSkyAmbient * 0.9 + vec3(0.12));
  vec3 col = shade + uSunColor * (wrap * 0.55 + toward * 0.35) * sun;
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), a);
}`;

/**
 * `solids` are what a puff thins against, three vec4s each (`flightSolid`, `figureSolid`); `trick` is how far the loop's
 * last flight is let go back to where it is built, and how far its depth is true.
 */
export function puffMaterial(amount: { value: number }, solids: THREE.Vector4[], trick: { value: THREE.Vector2 }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uPuffs: amount, uSolids: { value: solids }, uTrick: trick },
    vertexShader: VERT(solids.length / 3),
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** One camera-facing card per puff, shaded as a soft ball: a grid drawn once for each, placed from its centre in the shader. */
export function puffGeometry(puffs: readonly Puff[]): THREE.InstancedBufferGeometry {
  const n = puffs.length, side = GRID + 1;
  const corner = new Float32Array(side * side * 2);
  const index: number[] = [];
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) corner.set([x / GRID * 2 - 1, y / GRID * 2 - 1], (y * side + x) * 2);
  }
  const reach = 1.25 / 1.3;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      // Cells wholly beyond the ball's lumps would draw nothing.
      const nearest = (k: number) => Math.max(0, Math.abs((k + 0.5) / GRID * 2 - 1) - 1 / GRID);
      if (Math.hypot(nearest(x), nearest(y)) >= reach) continue;
      const i = y * side + x;
      index.push(i, i + 1, i + side + 1, i, i + side + 1, i + side);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  // Three wants a position; the cards are placed in the shader from their centres.
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(side * side * 3), 3));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setIndex(index);
  const each = (size: number, value: (p: Puff) => number[]) =>
    new THREE.InstancedBufferAttribute(Float32Array.from(puffs.flatMap(value)), size);
  g.setAttribute('aCentre', each(3, p => [p.x, p.y, p.z]));
  g.setAttribute('aRadius', each(1, p => [p.r]));
  g.setAttribute('aAlpha', each(1, p => [p.a]));
  g.setAttribute('aSolids', each(4, () => [-1, -1, -1, -1]));
  g.setAttribute('aMoreSolids', each(4, () => [-1, -1, -1, -1]));
  g.setAttribute('aSoft', each(1, () => [1]));
  g.instanceCount = n;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}
