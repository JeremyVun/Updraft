import * as THREE from 'three';
import { params } from '../params';
import { ATMO_GLSL, atmo } from './atmosphere';
import { mainlandCoastZ } from './heightfield';
import { PlanarReflection } from './water/reflection';
import { ShoreBake } from './water/shore';
import { SURF_GLSL, surfUniforms } from './water/surf';
import { rippleTexture } from './water/textures';

const VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${SURF_GLSL}
uniform sampler2D uRipple;
uniform sampler2D uMirror;
uniform mat4 uMirrorMatrix;
uniform vec2 uBreeze;
uniform vec3 uDeep;
uniform vec3 uAbsorb;
uniform vec3 uSand;
uniform vec3 uWetSand;
in vec3 vWorld;

/** The world above the sea seen along reflected ray R; nearby content is taken to lie ~48 units out. */
vec3 mirrored(vec3 R, float lod) {
  vec4 p = uMirrorMatrix * vec4(vWorld + R * 48.0, 1.0);
  return textureLod(uMirror, p.xy / p.w, lod).rgb;
}

/** Ripple slopes carried along by the wind; two phases cross-fade so the drift never stretches the pattern. */
vec3 driftingRipples(vec2 p, vec2 drift, float period) {
  float t = uTime / period;
  float ph0 = fract(t);
  float ph1 = fract(t + 0.5);
  float w = abs(1.0 - 2.0 * ph0);
  vec4 a = texture(uRipple, p - drift * ph0 * period + hash12(vec2(floor(t), 1.7)) * 7.3);
  vec4 b = texture(uRipple, p - drift * ph1 * period + hash12(vec2(floor(t + 0.5), 5.1)) * 7.3);
  vec4 r = mix(a, b, w);
  vec2 slope = (r.rg * 2.0 - 1.0) / sqrt(w * w + (1.0 - w) * (1.0 - w));
  float variance = max(r.b - dot(r.rg * 2.0 - 1.0, r.rg * 2.0 - 1.0), 0.0);
  return vec3(slope, variance);
}

/** Bright web of light the waves focus onto the seabed. */
float caustics(vec2 p, vec2 warp, Footprint fp) {
  vec2 a = p * 0.16 + warp + vec2(uTime * 0.017, uTime * 0.011);
  mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
  vec2 b = turn * p * 0.19 - warp * 0.7 - vec2(uTime * 0.013, -uTime * 0.019);
  float c = min(textureGrad(uLace, a, fp.dx * 0.16, fp.dy * 0.16).g, textureGrad(uLace, b, turn * fp.dx * 0.19, turn * fp.dy * 0.19).g);
  return smoothstep(0.55, 1.0, c);
}

/**
 * Sun glints too small to resolve: world-space cells that flash briefly, as many as the glitter lobe allows.
 * Cells never shrink below a few pixels and two sizes blend, so the sparkle twinkles instead of crawling.
 */
float glintCells(vec2 xz, float cell, float density) {
  vec2 p = xz / cell;
  vec2 id = floor(p);
  float h = hash12(id + cell * 17.3);
  vec2 centre = vec2(hash12(id + 3.1), hash12(id + 8.7)) * 0.5 + 0.25;
  float spot = smoothstep(0.3, 0.0, length(fract(p) - centre));
  float life = fract(uTime * (0.8 + 1.2 * h) + h * 23.0);
  float flash = smoothstep(0.0, 0.06, life) * smoothstep(0.32, 0.06, life);
  return spot * flash * step(1.0 - density, fract(h * 91.7));
}

float glints(vec2 xz, float footprint, float density) {
  float level = log2(max(footprint * 8.0, 0.1));
  float l0 = floor(level);
  float f = level - l0;
  return mix(glintCells(xz, exp2(l0), density), glintCells(xz, exp2(l0 + 1.0), density), f);
}

/** Short-lived whitecaps, stretched along the wind and carried a little way by it; storm is the chance per cell. */
float whitecaps(vec2 xz, vec2 flow, float storm) {
  const float CELL = 4.5;
  const float LIFE = 2.0;
  vec2 dir = flow / max(length(flow), 1e-3);
  float caps = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 shift = vec2(float(k) * 0.5 * CELL);
    vec2 id = floor((xz + shift) / CELL);
    float h = hash12(id + float(k) * 17.3);
    float life = fract(uTime / LIFE + h);
    float wave = floor(uTime / LIFE + h);
    float chance = hash12(id + wave * 3.1);
    if (chance > storm) continue;
    vec2 centre = (id + 0.25 + 0.5 * vec2(hash12(id + wave), hash12(id - wave))) * CELL - shift;
    vec2 d = xz - centre - flow * life * 0.04;
    vec2 local = vec2(dot(d, dir), dot(d, vec2(-dir.y, dir.x))) / (0.6 + 0.5 * h);
    local /= vec2(local.x > 0.0 ? 0.7 : 1.7, 0.4);
    float grow = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.35, life) * smoothstep(chance, chance + 0.25, storm);
    caps = max(caps, (1.0 - smoothstep(0.1, 1.0, length(local))) * grow);
  }
  return caps;
}

float ggx(float nh, float a2) {
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * d * d);
}

float smithVis(float nv, float nl, float a2) {
  float gv = nl * sqrt(nv * nv * (1.0 - a2) + a2);
  float gl = nv * sqrt(nl * nl * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-4);
}

void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 xz = vWorld.xz;
  vec2 uv = domainUv(xz);
  vec2 edge = min(uv, 1.0 - uv);
  float inside = smoothstep(0.0, 0.04, min(edge.x, edge.y));
  Footprint fp = footprintOf(xz);
  float footprint = max(length(fp.dx), length(fp.dy));

  vec4 wind = texture(uWindTex, clamp(uv, 0.0, 1.0));
  vec2 flow = wind.xy;
  if (inside < 1.0) {
    float g = fbm(xz * 0.02 - uBreeze * uTime * 0.02);
    flow = mix(uBreeze * (0.3 + 2.3 * g * g), wind.xy, inside);
  }
  float gust = wind.z * inside;
  float speed = length(flow);
  float rough = max(smoothstep(1.2, 7.5, speed), smoothstep(0.0, 0.5, gust));
  float storm = clamp(smoothstep(7.0, 18.0, speed) + smoothstep(0.1, 0.5, gust), 0.0, 1.0);

  float ground = mix(-12.0, texture(uHeightTex, clamp(uv, 0.0, 1.0)).r, inside);
  float depth = max(-ground, 0.0);
  vec4 bedN = groundAt(xz);
  float offshore = mix(60.0, -shoreDistance(xz), inside);
  float surfBlur = fwidth(offshore) / BORE_SPACING * 1.5;

  vec2 drift = flow * 0.22;
  vec3 r0 = driftingRipples(xz * 0.041, drift * 0.041, 3.1);
  vec3 r1 = driftingRipples(xz * 0.113 + 0.5, drift * 0.113, 2.3);
  vec3 r2 = driftingRipples(xz * 0.31 + 0.25, drift * 0.31, 1.7);
  float calm = 0.2 + 0.8 * uSeaState;
  float a0 = 0.05 * calm + 0.04 * rough + 0.05 * storm;
  float a1 = 0.035 * calm + 0.06 * rough + 0.1 * storm;
  float a2 = 0.045 * calm + 0.08 * rough + 0.16 * storm;
  vec4 sw = texture(uRipple, mat2(0.94, -0.34, 0.34, 0.94) * xz * 0.011 + vec2(uTime * 0.0041, uTime * 0.0013));
  vec3 swell = vec3(sw.rg * 2.0 - 1.0, max(sw.b - dot(sw.rg * 2.0 - 1.0, sw.rg * 2.0 - 1.0), 0.0));
  float A_SWELL = 0.07 * calm;
  vec2 slope = r0.xy * a0 + r1.xy * a1 + r2.xy * a2 + swell.xy * A_SWELL;
  float hidden = r0.z * a0 * a0 + r1.z * a1 * a1 + r2.z * a2 * a2 + swell.z * A_SWELL * A_SWELL;

  vec3 surf = vec3(0.0);
  float swellAmp = 0.0;
  if (offshore < 40.0) {
    surf = surfWaves(xz, offshore, depth, surfBlur, fp);
    swellAmp = 0.13 * uSeaState * smoothstep(4.5, 1.6, depth) * smoothstep(0.0, 1.5, offshore) * smoothstep(17.0, 5.0, offshore);
    vec2 toSea = -vec2(shoreDistance(xz + vec2(0.5, 0.0)) + offshore, shoreDistance(xz + vec2(0.0, 0.5)) + offshore) * 2.0;
    slope += toSea * surf.z * swellAmp;
  }
  slope *= 1.0 - smoothstep(1.5, 0.0, offshore) * 0.7;
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  float unresolved = hidden * 2.0 + 0.004 + 0.02 * rough + 0.05 * storm;
  float alpha2 = 0.0012 + unresolved + footprint * footprint * 0.00002;

  float nv = max(dot(N, V), 0.02);
  vec3 R = reflect(-V, N);
  R = normalize(vec3(R.x, abs(R.y) + sqrt(unresolved) * 1.2 * (1.0 - nv), R.z));
  vec3 sky = skyColor(R);
  // Capped just above the open sky: the mirrored sun disc would bloom, and the glitter draws the sun instead.
  vec3 refl = min(mirrored(R, clamp(log2(1.0 + sqrt(alpha2) * 60.0), 0.0, 6.0)), sky * 1.25 + 0.1);
  refl = mix(sky, refl, smoothstep(0.0, 2.5, offshore)) * (1.0 - 0.3 * rough - 0.25 * storm);
  float roughness = sqrt(sqrt(alpha2));
  float F = 0.02 + (max(1.0 - roughness * 1.4, 0.02) - 0.02) * pow(1.0 - nv, 5.0);

  float sh = cloudShadow(xz) * bedN.w;
  vec3 scatterLight = uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * sh;
  vec3 body = uDeep * scatterLight;
  if (depth < 9.0) {
    vec3 T = refract(-V, N, 0.75);
    float tDown = max(-T.y, 0.25);
    vec2 bedXZ = xz + T.xz / tDown * depth * 0.8;
    float bedDepth = max(-mix(-12.0, texture(uHeightTex, clamp(domainUv(bedXZ), 0.0, 1.0)).r, inside), 0.0);
    float path = bedDepth / tDown;

    float grain = vnoise(bedXZ * 1.7) * 0.5 + vnoise(bedXZ * 6.0) * 0.5;
    float ripples = sin(dot(bedXZ, vec2(0.9, 0.45)) * 2.2 + vnoise(bedXZ * 0.3) * 6.0) * 0.5 + 0.5;
    vec3 sand = uSand * (0.9 + 0.12 * grain) * (0.96 + 0.06 * ripples);
    vec3 bed = mix(uWetSand * (0.92 + 0.12 * grain), sand * 0.92, smoothstep(0.05, 0.9, bedDepth));
    float weed = smoothstep(0.58, 0.72, vnoise(bedXZ * 0.08 + 3.1) * 0.75 + vnoise(bedXZ * 0.27) * 0.25);
    bed = mix(bed, vec3(0.09, 0.12, 0.06), weed * 0.4 * smoothstep(0.9, 1.8, bedDepth) * smoothstep(4.0, 2.5, bedDepth));

    vec3 sunIn = refract(-uSunDir, vec3(0.0, 1.0, 0.0), 0.75);
    float sunDown = max(-sunIn.y, 0.2);
    float sunVis = cloudShadow(bedXZ) * groundAt(bedXZ).w;
    float light = caustics(bedXZ + sunIn.xz / sunDown * bedDepth, slope * 0.6, fp) * smoothstep(0.1, 0.8, bedDepth) * exp(-bedDepth * 0.45);
    light *= smoothstep(220.0, 60.0, dist);
    vec3 sunBed = uSunColor * max(uSunDir.y, 0.0) * 0.8 * exp(-uAbsorb * bedDepth / sunDown) * sunVis * (0.6 + 4.0 * light);
    vec3 skyBed = uSkyAmbient * 1.25 * exp(-uAbsorb * bedDepth * 1.4);
    vec3 seen = bed * (sunBed + skyBed) * exp(-uAbsorb * path);
    body = mix(body, seen, exp(-path * 0.2) * smoothstep(9.0, 6.0, bedDepth));
  }
  float crest = surf.y * swellAmp * 6.0;
  float backlit = pow(max(dot(-V, normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 3.0);
  body += vec3(0.1, 0.55, 0.45) * uSunColor * crest * (0.02 + 0.3 * backlit) * sh;
  body *= 1.0 - rough * 0.15 - storm * 0.25;

  vec3 L = uSunDir;
  vec3 H = normalize(L + V);
  float nl = max(dot(N, L), 0.0);
  float fh = 0.02 + 0.98 * pow(1.0 - max(dot(V, H), 0.0), 5.0);
  float vis = smithVis(nv, nl, alpha2) * nl * fh;
  float facet = min(ggx(max(dot(N, H), 0.0), alpha2) * vis, 5.0);
  float tan2 = (1.0 - H.y * H.y) / max(H.y * H.y, 1e-4);
  float glitter = exp(-tan2 / (0.008 + unresolved));
  float crisp = smoothstep(0.7, 0.1, footprint);
  float sparkle = glints(xz, footprint, glitter) * vis * (8.0 + 10.0 * crisp);
  vec3 sun = uSunColor * (facet * 0.1 + glitter * vis * mix(0.3, 0.08, crisp) + sparkle) * sh;

  vec3 col = mix(body, refl, F) + sun;

  float foam = surf.x;
  if (storm > 0.0) foam = max(foam, foamLace(whitecaps(xz, flow, storm * 0.9), xz * 3.5, Footprint(fp.dx * 3.5, fp.dy * 3.5)));
  col = mix(col, foamColor(V, sh), clamp(foam, 0.0, 1.0));

  col = mix(stillGrey(col) * 1.05, col, 0.35 + 0.65 * uWorldLife);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Far enough inland that the sea is behind the camera or lost in the haze, so its mirror is not drawn. */
const SEA_OUT_OF_SIGHT = 380;

/** The sea: a plane at y = 0 shaded with the seabed, surf, wind-driven ripples, sun glitter and a mirror of the world. */
export class Water {
  readonly mesh: THREE.Mesh;
  private readonly reflection: PlanarReflection;
  private readonly shore: ShoreBake;
  private frame = 0;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, breeze: THREE.Vector2, height: THREE.Texture) {
    this.reflection = new PlanarReflection(renderer, scene, 0.25);
    this.shore = new ShoreBake(renderer, height);
    surfUniforms.uShoreTex.value = this.shore.target.texture;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...atmo.uniforms,
        ...surfUniforms,
        uRipple: { value: rippleTexture() },
        uMirror: { value: this.reflection.target.texture },
        uMirrorMatrix: { value: this.reflection.matrix },
        uBreeze: { value: breeze },
        uDeep: { value: new THREE.Color('#0d4a66') },
        uAbsorb: { value: new THREE.Vector3(0.5, 0.13, 0.1) },
        // The beach's sand (terrain.ts), so the seabed meets it at the waterline without a seam.
        uSand: { value: new THREE.Color('#e6d2a6') },
        uWetSand: { value: new THREE.Color('#a48c66') },
      },
    });
    const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  /** Re-measures the shoreline; call after the window's height bake. */
  bakeShore(windowSize: number): void {
    this.shore.bake(windowSize);
  }

  /**
   * Renders the mirror image on alternate frames (the world is drawn again for it, and a one-frame lag in a
   * reflection under a gliding camera cannot be seen); call after the camera has moved, before the scene is drawn.
   */
  update(camera: THREE.PerspectiveCamera, before?: (mirrorCamera: THREE.PerspectiveCamera) => void, after?: () => void): void {
    if (!params.mirror || camera.position.z < mainlandCoastZ(camera.position.x) - SEA_OUT_OF_SIGHT) return;
    if (this.frame++ % params.mirror) return;
    atmo.uniforms.uMirrorPass.value = 1;
    this.reflection.render(camera, before, after);
    atmo.uniforms.uMirrorPass.value = 0;
  }
}
