import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { FLIGHT_RUN, landingOf, onLanding, type Flight } from './stairs-layout';

/** A ball of cloud: where it is, how big, and how much of it there is. */
export interface Puff { x: number; y: number; z: number; r: number; a: number }

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aCentre;
in vec2 aCorner;
in float aRadius;
in float aAlpha;
out vec2 vCorner;
out vec3 vWorld;
out vec3 vCentre;
out float vAlpha;
void main() {
  vec3 c = (modelMatrix * vec4(aCentre, 1.0)).xyz;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // Each one breathes a little, out of step with the rest.
  float r = aRadius * (1.0 + 0.07 * sin(uTime * 0.6 + aCentre.x * 3.1 + aCentre.z * 2.3));
  vCorner = aCorner * 1.3;
  vWorld = c + (right * vCorner.x + up * vCorner.y) * r;
  vCentre = c;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/** Lit like the top of the cloud deck: gold where the low sun reaches it, glowing at the rim against the light, lilac underneath. */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uPuffs;
in vec2 vCorner;
in vec3 vWorld;
in vec3 vCentre;
in float vAlpha;
void main() {
  float d = length(vCorner);
  float around = atan(vCorner.y, vCorner.x);
  float lump = vnoise(vec2(around * 1.9 + vCentre.x * 4.0, vCentre.z * 4.0 + uTime * 0.12))
    + 0.5 * vnoise(vec2(around * 4.3 - vCentre.y * 3.0, uTime * 0.2));
  // Soft all the way from the middle, so overlapping balls add up to mist rather than show as a bunch of balls.
  float body = 1.0 - smoothstep(0.0, 0.8 + 0.3 * lump, d);
  float a = body * body * vAlpha * uPuffs * smoothstep(0.8, 3.0, distance(vCentre, cameraPosition));
  if (a <= 0.004) discard;
  float k = min(d, 1.0);
  vec3 nv = vec3(vCorner / max(d, 1.0), sqrt(max(0.0, 1.0 - k * k)));
  vec3 N = normalize(transpose(mat3(viewMatrix)) * nv);
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  float wrap = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float toward = pow(max(0.0, dot(-V, uSunDir)), 4.0);
  vec3 shade = mix(vec3(0.66, 0.62, 0.76), vec3(0.84, 0.8, 0.88), N.y * 0.5 + 0.5) * (uSkyAmbient * 0.9 + vec3(0.12));
  vec3 col = shade + uSunColor * (wrap * 0.55 + toward * 0.35) * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), a);
}`;

export function puffMaterial(amount = { value: 1 }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uPuffs: amount },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** One camera-facing card per puff, shaded as a soft ball. */
export function puffGeometry(puffs: readonly Puff[], offset = new THREE.Vector3()): THREE.BufferGeometry {
  const n = puffs.length;
  const centre = new Float32Array(n * 12);
  const corner = new Float32Array(n * 8);
  const radius = new Float32Array(n * 4);
  const alpha = new Float32Array(n * 4);
  const index: number[] = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  puffs.forEach((p, i) => {
    for (let c = 0; c < 4; c++) {
      centre.set([p.x - offset.x, p.y - offset.y, p.z - offset.z], (i * 4 + c) * 3);
      corner.set(corners[c], (i * 4 + c) * 2);
      radius[i * 4 + c] = p.r;
      alpha[i * 4 + c] = p.a;
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const g = new THREE.BufferGeometry();
  // Three wants a position; the cards are placed in the shader from their centres.
  g.setAttribute('position', new THREE.BufferAttribute(centre.slice(), 3));
  g.setAttribute('aCentre', new THREE.BufferAttribute(centre, 3));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  g.setIndex(index);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}

/** A small repeatable scatter, so the cloud under each flight is the same every time the room is built. */
function scatter(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * The cloud a flight and its landing rest on: a row of puffs down each side of its underside and a few wisps
 * trailing under that. `amount` 0 leaves it bare; past 1 the puffs grow up round its sides as well.
 */
export function flightPuffs(f: Flight, amount: number): Puff[] {
  if (amount <= 0) return [];
  const rnd = scatter(f.index * 31 + 7);
  const out: Puff[] = [];
  const along = new THREE.Vector3().subVectors(f.top, f.bottom).setY(0).normalize();
  const across = new THREE.Vector3(-along.z, 0, along.x);
  const walk = new THREE.Vector3();
  const size = 0.8 + 0.3 * Math.min(amount, 1.4);
  for (let s = 0.3; s < FLIGHT_RUN - 0.1; s += 0.7 / Math.min(1.3, amount)) {
    walk.lerpVectors(f.bottom, f.top, s / FLIGHT_RUN);
    for (const side of [-1, 1]) {
      const x = side * (0.32 + rnd() * 0.2);
      out.push({ x: walk.x + across.x * x + along.x * (rnd() - 0.5) * 0.3, y: walk.y - 0.95 - rnd() * 0.15,
        z: walk.z + across.z * x + along.z * (rnd() - 0.5) * 0.3, r: (0.6 + rnd() * 0.2) * size, a: 0.75 });
    }
    if (rnd() < 0.4 * amount) {
      out.push({ x: walk.x + across.x * (rnd() - 0.5) * 0.9, y: walk.y - 1.3 - rnd() * 0.6,
        z: walk.z + across.z * (rnd() - 0.5) * 0.9, r: (0.45 + rnd() * 0.2) * size, a: 0.45 });
    }
    if (amount > 1) {
      for (const side of [-1, 1]) {
        if (rnd() > (amount - 1) * 1.6) continue;
        out.push({ x: walk.x + across.x * side * (0.95 + rnd() * 0.2), y: walk.y - 0.45 + rnd() * 0.2,
          z: walk.z + across.z * side * (0.95 + rnd() * 0.2), r: (0.4 + rnd() * 0.15) * size, a: 0.4 });
      }
    }
  }
  const L = landingOf(f.index);
  const p = new THREE.Vector3();
  for (let x = L.x0 + 0.45; x < L.x1 - 0.3; x += 0.85) {
    for (let z = L.z0 + 0.45; z < L.z1 - 0.3; z += 0.85) {
      onLanding(L, x + (rnd() - 0.5) * 0.3, z + (rnd() - 0.5) * 0.3, p);
      out.push({ x: p.x, y: L.centre.y - 0.72 - rnd() * 0.1, z: p.z, r: (0.56 + rnd() * 0.16) * size, a: 0.75 });
      if (rnd() < 0.3 * amount) {
        onLanding(L, x + (rnd() - 0.5) * 0.5, z + (rnd() - 0.5) * 0.5, p);
        out.push({ x: p.x, y: L.centre.y - 1.2 - rnd() * 0.6, z: p.z, r: (0.42 + rnd() * 0.16) * size, a: 0.42 });
      }
    }
  }
  return out;
}
