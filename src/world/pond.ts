import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { HEIGHTFIELD_GLSL, POND, POND_LEVEL, pondOut, worldHeight } from './heightfield';

/** How many reed clumps stand round the margin, and how far in and out of the waterline they grow. */
const REEDS = 1100;
const REED_BAND = { inner: -0.7, outer: 1.2 };

const WATER_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * Still water: peat-dark, with the afternoon sky lying on it. It is the sea's idea of water with everything the
 * sea needs taken out — no swell, no surf, no seabed, no mirror — because it is a puddle in a field seen from
 * twenty units away, and it has to cost almost nothing.
 */
const WATER_FRAG = /* glsl */ `
${ATMO_GLSL}
${HEIGHTFIELD_GLSL}
uniform float uLevel;
uniform vec3 uDeep;
uniform vec3 uShallow;
in vec3 vWorld;

/** Two crossing sheets of noise slid over each other: enough slope to break the sky up, and nothing more. */
vec2 ripple(vec2 p, float speed) {
  float a = fbm(p * 0.9 + vec2(uTime * speed, uTime * speed * 0.4));
  float b = fbm(p * 0.9 + vec2(11.3 - uTime * speed * 0.7, 4.1 + uTime * speed * 0.3));
  float c = fbm(p * 2.6 - vec2(uTime * speed * 1.7, 0.0));
  return vec2(a - b, b - c);
}

void main() {
  vec2 xz = vWorld.xz;
  vec2 uv = domainUv(xz);
  float groundH = texture(uHeightTex, clamp(uv, 0.0, 1.0)).r;
  float depth = uLevel - groundH;
  /** The waterline is where the bed comes up to meet it, so the shore is drawn by the ground and never by an edge. */
  /** Held strictly inside the bowl's rim as well as to where the bed is under it, so no film of it can spill out
      over the hollow the pond was dug in. */
  float alpha = smoothstep(0.03, 0.45, depth) * (1.0 - smoothstep(0.88, 1.0, pondOut(xz)));
  if (alpha < 0.01) discard;

  vec2 flow = texture(uWindTex, clamp(uv, 0.0, 1.0)).xy;
  float gust = texture(uWindTex, clamp(uv, 0.0, 1.0)).z;
  /** The player only ruffles it: a pond in a hollow is sheltered, and a gust is a cat's paw and nothing else. */
  float stir = 0.35 + 0.5 * smoothstep(0.5, 6.0, length(flow)) + 0.5 * smoothstep(0.1, 0.9, gust);
  vec2 slope = (ripple(xz + flow * uTime * 0.05, 0.05) * 0.06 + ripple(xz * 3.1, 0.12) * 0.03) * stir;
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));

  vec3 V = normalize(cameraPosition - vWorld);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y) + 0.02;
  float nv = clamp(dot(N, V), 0.02, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);

  float sh = cloudShadow(xz);
  /** Held off the floor by the sky, or a cloud crossing the hollow puts a hole of a different colour in the pond. */
  vec3 light = uSkyAmbient * 1.15 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * sh;
  /** Peat water: almost all of what you see is the sky, and the little that is not is the bottom of a field. */
  vec3 body = mix(uShallow, uDeep, smoothstep(0.1, 1.4, depth)) * light;
  vec3 sky = skyColor(R);
  /** Peat water takes more out of the sky than the sea does: what comes back off it is dimmer and greener. */
  vec3 col = mix(body, sky * vec3(0.78, 0.82, 0.8), clamp(F * 1.2, 0.0, 0.88));

  vec3 H = halfVector(uSunDir, V);
  col += uSunColor * pow(max(dot(N, H), 0.0), 220.0) * 1.6 * sh;
  col = mix(stillGrey(col) * 1.05, col, 0.35 + 0.65 * uWorldLife);
  gl_FragColor = vec4(applyFog(col, vWorld), alpha);
}`;

const REED_VERT = /* glsl */ `
${ATMO_GLSL}
in vec4 iReed;
in vec4 iLook;
out vec3 vWorld;
out float vSeed;
out float vUp;
void main() {
  vec2 root = iReed.xy;
  float up = position.y;
  float lean = iLook.w;
  vec2 flow = texture(uWindTex, clamp(domainUv(root), 0.0, 1.0)).xy;
  /** A reed is stiff low down and whippy at the tip, and never lets go of the mud it is standing in. */
  float bend = up * up;
  vec2 sway = flow * 0.045 + vec2(sin(uTime * 1.9 + iReed.w), cos(uTime * 1.5 + iReed.w * 1.7)) * 0.05;
  float c = cos(iReed.z), s = sin(iReed.z);
  float across = position.x * iLook.z;
  vec3 w = vec3(root.x + c * across, iLook.x + up * iLook.y, root.y - s * across);
  w.xz += (sway + vec2(s, c) * lean) * bend * iLook.y;
  vWorld = w;
  vUp = up;
  vSeed = iReed.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const REED_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uReedRoot;
uniform vec3 uReedTip;
in vec3 vWorld;
in float vSeed;
in float vUp;
void main() {
  vec3 col = mix(uReedRoot, uReedTip, vUp * (0.6 + 0.6 * fract(vSeed)));
  /** Backlit: the low sun comes through a rush rather than off it, which is what makes a reed bed glow. */
  vec3 V = normalize(cameraPosition - vWorld);
  float through = pow(max(dot(-V, uSunDir), 0.0), 3.0);
  col *= uSkyAmbient * 1.2 + uSunColor * (0.55 + 0.9 * through) * cloudShadow(vWorld.xz);
  col = mix(stillGrey(col) * 1.05, col, 0.35 + 0.65 * uWorldLife);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** One reed: a tapered strip of a few segments, standing on the origin. */
function reedBlade(segments: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const w = (1 - t * t) * 0.5;
    pos.push(-w, t, 0, w, t, 0);
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

/**
 * The pond beyond the crest: a sheet of still water lying in the bowl the heightfield digs for it, with rushes
 * round its margin. Nothing about it moves except the sky on it and the reeds in the player's wind.
 */
export class Pond {
  readonly objects: THREE.Object3D[];
  /** The height of the water, for anything that floats on it. */
  readonly level = POND_LEVEL;
  readonly centre = new THREE.Vector3(POND.x, POND_LEVEL, POND.z);

  constructor() {
    const disc = new THREE.CircleGeometry(1, 64);
    disc.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(
      disc,
      new THREE.ShaderMaterial({
        uniforms: {
          ...atmo.uniforms,
          uLevel: { value: POND_LEVEL },
          uDeep: { value: new THREE.Color('#0b1a18') },
          uShallow: { value: new THREE.Color('#2e3a22') },
        },
        vertexShader: WATER_VERT,
        fragmentShader: WATER_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    );
    water.position.set(POND.x, POND_LEVEL, POND.z);
    water.scale.set(POND.rx * 1.2, 1, POND.rz * 1.2);
    water.renderOrder = 2;

    const reeds = new THREE.InstancedBufferGeometry();
    const blade = reedBlade(4);
    reeds.setAttribute('position', blade.getAttribute('position'));
    reeds.setIndex(blade.getIndex());
    const at = new Float32Array(REEDS * 4);
    const look = new Float32Array(REEDS * 4);
    let n = 0;
    for (let tries = 0; tries < REEDS * 40 && n < REEDS; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 0.78 + Math.random() * 0.4;
      const x = POND.x + Math.cos(a) * POND.rx * d;
      const z = POND.z + Math.sin(a) * POND.rz * d;
      /** The southern shore is open where the family rests and the child offers the water. */
      const south = (z - POND.z) / Math.hypot(x - POND.x, z - POND.z);
      const opening = THREE.MathUtils.smoothstep(south, 0.45, 0.8);
      if (Math.random() < opening) continue;
      const ground = worldHeight(x, z);
      const above = ground - POND_LEVEL;
      if (above < REED_BAND.inner || above > REED_BAND.outer) continue;
      if (pondOut(x, z) > 1.2) continue;
      /** Thickest right on the waterline and thinning both ways, the way a reed bed actually stands in a pond. */
      if (Math.random() > 1 - Math.abs(above) / 1.3) continue;
      at.set([x, z, Math.random() * Math.PI, Math.random() * 100], n * 4);
      look.set([Math.max(ground, POND_LEVEL - 0.25), 1.0 + Math.random() * 1.4, 0.05 + Math.random() * 0.055, (Math.random() - 0.5) * 0.5], n * 4);
      n++;
    }
    reeds.setAttribute('iReed', new THREE.InstancedBufferAttribute(at, 4));
    reeds.setAttribute('iLook', new THREE.InstancedBufferAttribute(look, 4));
    reeds.instanceCount = n;
    // Include full height and generous wind bend beyond the field's vorticity clamp.
    reeds.boundingSphere = new THREE.Sphere(this.centre.clone(), Math.max(POND.rx, POND.rz) * 1.2 + 45);
    const bed = new THREE.Mesh(
      reeds,
      new THREE.ShaderMaterial({
        uniforms: { ...atmo.uniforms, uReedRoot: { value: new THREE.Color('#2f3a1b') }, uReedTip: { value: new THREE.Color('#7e8a42') } },
        vertexShader: REED_VERT,
        fragmentShader: REED_FRAG,
        side: THREE.DoubleSide,
      }),
    );
    this.objects = [water, bed];
  }
}
