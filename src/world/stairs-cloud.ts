import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { CloudWake } from './stairs-wake';
import { BELOW_CLOUD, CLOUD, CLOUD_BERTH, CLOUD_ROUTE, DESCENT_END, STAIRS_ISLE, flight } from './stairs-layout';

/** How many points of the boat's way over the cloud, and of its fresh furrow, the cloud's top is told about. */
const ROUTE_POINTS = CLOUD_ROUTE.length + 2;
const TRAIL_POINTS = 16;

/** The top of the cloud as a surface: heaped up and lit gold on the sunward side, lilac in its folds. */
const TOP_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform vec2 uRoute[${ROUTE_POINTS}];
uniform vec4 uTrail[${TRAIL_POINTS}];
uniform float uSurface;
out vec3 vWorld;
out float vRing;
BILLOW
void main() {
  vec2 xz = position.xz + uCentre;
  vRing = length(position.xz);
  vWorld = vec3(xz.x, uSurface + billow(xz), xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const TOP_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform vec2 uRoute[${ROUTE_POINTS}];
uniform vec4 uTrail[${TRAIL_POINTS}];
uniform float uReach;
uniform float uHole;
uniform float uSurface;
in vec3 vWorld;
in float vRing;
BILLOW
void main() {
  if (vRing > uReach) discard;
  vec2 xz = vWorld.xz;
  if (uCloudBubble.w > 0.0 && uHole > 0.5) {
    float hole = length(xz - uCloudBubble.xz) - uCloudBubble.w * (0.75 + 0.35 * vnoise(xz * 0.8 + uTime * 0.1));
    if (hole < 0.0 && uCloudBubble.y < uSurface + 0.5) discard;
  }
  float e = 0.6;
  float h = billow(xz);
  vec3 N = normalize(vec3(h - billow(xz + vec2(e, 0.0)), e, h - billow(xz + vec2(0.0, e))));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunDir + vec3(0.0, 0.08, 0.0));
  // Lit hard from the side by the low sun: gold on every flank that faces it, lilac in the folds that do not.
  float wrap = clamp(dot(N, L) * 0.85 + 0.2, 0.0, 1.0);
  float toward = pow(max(0.0, dot(-V, L)), 6.0);
  float rim = pow(1.0 - max(0.0, dot(N, V)), 3.0);
  float crest = smoothstep(0.0, 4.0, h);
  float fold = vnoise(xz * 0.21) * 0.5 + vnoise(xz * 0.63) * 0.25;
  vec3 shade = mix(vec3(0.54, 0.52, 0.76), vec3(0.76, 0.74, 0.88), crest) * (uSkyAmbient * 0.85 + vec3(0.1));
  vec3 sunlit = uSunColor * (0.95 + 0.4 * toward) * wrap * wrap * 1.25;
  vec3 col = shade * (0.85 + 0.3 * fold) + sunlit * (0.7 + 0.3 * crest);
  col += uSunColor * rim * (0.25 + 1.4 * toward) * wrap;
  col *= 0.94 + 0.12 * vnoise(xz * 2.3);
  float cover = uCloudDeck.w;
  gl_FragColor = vec4(applyFog(col, vWorld), cover);
}`;

/**
 * Round heaps of cloud: cellular domes in three sizes. Low and gentle round the top landing and all along the way
 * the boat goes, so it sails down a valley between them; and where the hull has just been, a furrow that closes
 * up again behind it, with a soft lip either side.
 */
const BILLOW_GLSL = /* glsl */ `
float domes(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float best = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash12(i + g), hash12(i + g + 17.3)) * 0.8 + 0.1;
    float r = 0.55 + 0.35 * hash12(i + g + 41.7);
    float d = length(g + o - f) / r;
    best = max(best, sqrt(max(0.0, 1.0 - d * d)) * r);
  }
  return best;
}
float toSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  return length(p - a - ab * t);
}
float fromRoute(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < ${ROUTE_POINTS - 1}; i++) d = min(d, toSegment(p, uRoute[i], uRoute[i + 1]));
  return d;
}
float furrow(vec2 p) {
  float g = 0.0;
  for (int i = 0; i < ${TRAIL_POINTS - 1}; i++) {
    vec4 a = uTrail[i];
    vec4 b = uTrail[i + 1];
    vec2 ab = b.xy - a.xy;
    float t = clamp(dot(p - a.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float d = length(p - a.xy - ab * t);
    float fresh = mix(a.z, b.z, t);
    g = max(g, fresh * (exp(-d * d / 1.1) - 0.3 * exp(-(d - 1.9) * (d - 1.9) / 0.4)));
  }
  return g;
}
float billow(vec2 xz) {
  vec2 p = xz + uCloudShift * 0.6;
  float calm = min(smoothstep(uCalmAt.z * 0.35, uCalmAt.z, length(xz - uCalmAt.xy)), smoothstep(5.0, 28.0, fromRoute(xz)));
  float swell = (domes(p * 0.09) * 1.1 + domes(p * 0.23 + 3.1) * 0.35 + domes(p * 0.55 + 7.7) * 0.12) * (0.7 + 0.3 * calm);
  float heaps = domes(p * 0.028 + 9.7) * 7.5 + domes(p * 0.07 + 5.3) * 2.2;
  return mix(swell, swell + heaps, calm) - furrow(xz) * 0.6;
}`;

/**
 * The underside of the cloud seen from below: heavy bellies hanging out of it, lilac in their hollows and lit
 * gold on the flanks the low sun reaches under the edge of the deck. Flat and high round the stair, so it goes
 * up into the white through a level ceiling and there is room under it to work on the loose flights.
 */
const BELLY_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform vec2 uStairAt;
out vec3 vWorld;
out float vRing;
BILLOW
void main() {
  vec2 xz = position.xz + uCentre;
  vRing = length(position.xz);
  vWorld = vec3(xz.x, uCloudDeckY.x + 0.6 - belly(xz), xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const BELLY_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform vec2 uStairAt;
uniform float uReach;
in vec3 vWorld;
in float vRing;
BILLOW
void main() {
  if (vRing > uReach) discard;
  vec2 xz = vWorld.xz;
  float e = 0.8;
  float h = belly(xz);
  // Hanging down, so the surface faces down and its normal is the slope of the bellies seen from below.
  vec3 N = normalize(vec3(belly(xz + vec2(e, 0.0)) - h, -e, belly(xz + vec2(0.0, e)) - h));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(vec3(uSunDir.x, max(uSunDir.y, 0.0) * 0.4 + 0.02, uSunDir.z));
  float wrap = clamp(dot(N, L) * 0.85 + 0.25, 0.0, 1.0);
  vec2 away = xz - cameraPosition.xz;
  float reach = length(away);
  float sunward = reach > 1.0 ? pow(max(0.0, dot(away / reach, normalize(uSunDir.xz + 1e-5))), 2.0) : 0.0;
  float rim = pow(1.0 - abs(dot(N, V)), 2.5);
  // The lowest parts of the bellies catch the sun coming in under the deck; the hollows between stay lilac.
  float low = smoothstep(0.5, 6.0, h);
  vec3 shade = mix(uSkyAmbient * 0.55 + uGroundBounce * 0.2, uSkyAmbient * 0.72 + uGroundBounce * 0.12, low);
  float far = smoothstep(15.0, 350.0, reach);
  vec3 sunlit = uSunColor * wrap * wrap * (0.25 + 0.9 * low + 1.1 * sunward * far);
  vec3 col = shade * (0.92 + 0.16 * vnoise(xz * 0.11)) + sunlit + uSunColor * rim * wrap * (0.15 + 0.7 * sunward) * low;
  float edge = 1.0 - smoothstep(0.55, 0.98, length(xz - uCloudDeck.xy) / uCloudDeck.z);
  // Seen from just under it, a ceiling is a line; the fringe of the deck takes over there.
  float under = smoothstep(1.0, 4.5, uCloudDeckY.x - cameraPosition.y);
  gl_FragColor = vec4(applyFog(col, vWorld), uCloudDeck.w * edge * under);
}`;

/** Bellies of cloud hanging from the deck: big slow heaps with smaller ones on them, none near the stair. */
const BELLY_GLSL = /* glsl */ `
float belly(vec2 xz) {
  vec2 p = xz + uCloudShift * 0.6;
  float calm = smoothstep(uCalmAt.z * 0.45, uCalmAt.z, length(xz - uCalmAt.xy));
  float big = vnoise(p * 0.024 + 2.3);
  float heaps = big * big * 7.0 + vnoise(p * 0.07 + 7.1) * 2.2 + vnoise(p * 0.19 + 1.7) * 0.6;
  // Round the stair it hangs down in a belly of its own, and the stair goes up into it.
  vec2 fromStair = xz - uStairAt;
  float swallow = 2.8 * exp(-dot(fromStair, fromStair) / 60.0) * (0.85 + 0.3 * vnoise(xz * 0.5 + uTime * 0.05));
  return heaps * (0.1 + 0.9 * calm) + swallow;
}`;

/**
 * The cloud deck as the stairs room sees it from outside: its underside hanging over the island, heavy and lit by
 * the low sun, and its top lying to the horizon under the sunset with a furrow where the hull has been. Inside it,
 * the shared analytic deck in the fog takes over.
 */
export class StairsCloud {
  readonly group = new THREE.Group();
  readonly top: THREE.Mesh;
  readonly belly: THREE.Mesh;
  readonly wake = new CloudWake();
  private readonly topUniforms: { uCentre: { value: THREE.Vector2 }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number };
    uRoute: { value: THREE.Vector2[] }; uTrail: { value: THREE.Vector4[] }; uHole: { value: number }; uSurface: { value: number } };
  private readonly bellyUniforms: { uCentre: { value: THREE.Vector2 }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number }; uStairAt: { value: THREE.Vector2 } };
  /** The furrow behind the hull: where it has been, newest first, and how fresh each point is. */
  private readonly trail: THREE.Vector4[] = Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector4(0, 0, 0, 0));
  private trailFrom = new THREE.Vector2(1e5, 1e5);

  constructor() {
    this.group.name = 'stairs-cloud';
    this.topUniforms = {
      uCentre: { value: new THREE.Vector2(STAIRS_ISLE.x, STAIRS_ISLE.z) },
      uCalmAt: { value: new THREE.Vector3(CLOUD_BERTH.x, CLOUD_BERTH.z, 45) },
      uReach: { value: 1500 },
      uRoute: { value: [new THREE.Vector2(CLOUD_BERTH.x, CLOUD_BERTH.z), ...CLOUD_ROUTE.map(p => p.clone()), DESCENT_END.clone()] },
      uTrail: { value: this.trail },
      uHole: { value: 1 },
      // The surface stays where the cloud's top is, even while the deck swells above it into fog.
      uSurface: { value: CLOUD.top },
    };
    this.group.add(this.wake.mesh);
    const rings = 150, spokes = 160, reach = 1500;
    const pos: number[] = [];
    const index: number[] = [];
    for (let r = 0; r <= rings; r++) {
      const radius = reach * Math.pow(r / rings, 2.2);
      for (let a = 0; a < spokes; a++) {
        const t = (a / spokes) * Math.PI * 2;
        pos.push(Math.cos(t) * radius, 0, Math.sin(t) * radius);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let a = 0; a < spokes; a++) {
        const i0 = r * spokes + a, i1 = r * spokes + (a + 1) % spokes;
        const j0 = i0 + spokes, j1 = i1 + spokes;
        index.push(i0, j0, i1, i1, j0, j1);
      }
    }
    const disc = new THREE.BufferGeometry();
    disc.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    disc.setIndex(index);
    this.top = new THREE.Mesh(disc, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...this.topUniforms },
      vertexShader: TOP_VERT.replace('BILLOW', BILLOW_GLSL),
      fragmentShader: TOP_FRAG.replace('BILLOW', BILLOW_GLSL),
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    }));
    this.top.name = 'cloud-deck-top';
    this.top.frustumCulled = false;
    this.top.renderOrder = -2;
    this.top.visible = false;
    this.group.add(this.top);

    this.bellyUniforms = {
      uCentre: { value: new THREE.Vector2(STAIRS_ISLE.x, STAIRS_ISLE.z) },
      uCalmAt: { value: new THREE.Vector3(flight(BELOW_CLOUD).bottom.x, flight(BELOW_CLOUD).bottom.z + 8, 55) },
      uReach: { value: 1500 },
      uStairAt: { value: new THREE.Vector2(flight(BELOW_CLOUD + 1).landing.x, flight(BELOW_CLOUD + 1).landing.z) },
    };
    this.belly = new THREE.Mesh(disc, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...this.bellyUniforms },
      vertexShader: BELLY_VERT.replace('BILLOW', BELLY_GLSL),
      fragmentShader: BELLY_FRAG.replace('BILLOW', BELLY_GLSL),
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    }));
    this.belly.name = 'cloud-deck-belly';
    this.belly.frustumCulled = false;
    this.belly.renderOrder = -2;
    this.belly.visible = false;
    this.group.add(this.belly);
  }

  /**
   * The hull going through the top of the cloud: it leaves a furrow that closes up behind it, and throws up puffs
   * at the bow and off the quarters that curl away and thin out. `hull` is null when it is not on the cloud.
   */
  sailing(hull: { position: THREE.Vector3; yaw: number; speed: number } | null, dt: number): void {
    for (const t of this.trail) t.z = Math.max(0, t.z - dt / 14);
    this.wake.emit(hull, dt);
    if (!hull) return;
    const p = hull.position;
    if (Math.hypot(p.x - this.trailFrom.x, p.z - this.trailFrom.y) > 1.3) {
      for (let i = TRAIL_POINTS - 1; i > 0; i--) this.trail[i].copy(this.trail[i - 1]);
      this.trailFrom.set(p.x, p.z);
    }
    this.trail[0].set(p.x, p.z, Math.min(1, hull.speed / 2.5), 0);
  }

  update(dt: number, camera: THREE.Camera): void {
    const deck = atmo.uniforms.uCloudDeck.value;
    this.top.visible = deck.w > 0.01 && camera.position.y > CLOUD.top - 0.4;
    this.topUniforms.uCentre.value.set(Math.round(camera.position.x / 8) * 8, Math.round(camera.position.z / 8) * 8);
    this.wake.update(dt);
    this.belly.visible = deck.w > 0.01 && camera.position.y < atmo.uniforms.uCloudDeckY.value.x - 1;
    this.bellyUniforms.uCentre.value.copy(this.topUniforms.uCentre.value);
  }

  /** Whether the pocket round a climber opens a hole in the top of the cloud; not while the cloud is swelling up round a hull. */
  set hole(open: boolean) {
    this.topUniforms.uHole.value = open ? 1 : 0;
  }
}
