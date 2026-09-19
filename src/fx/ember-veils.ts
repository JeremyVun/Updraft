import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';

const VEILS = 7;
const STEPS = 40;

/** Separate moving surfaces: each veil curls through its own tilted orbit and sheds a tapering end. */
export class EmberVeils {
  readonly mesh: THREE.Mesh;
  private readonly attributes: THREE.InstancedBufferAttribute[];

  constructor(centres: Float32Array, sizes: Float32Array, motion: Float32Array, artwork: THREE.Texture | null) {
    const positions: number[] = [], indices: number[] = [];
    for (let ribbon = 0; ribbon < VEILS; ribbon++) {
      const base = positions.length / 3;
      for (let step = 0; step <= STEPS; step++) {
        for (const side of [-1, 1]) positions.push(step / STEPS, side, ribbon);
        if (step < STEPS) {
          const j = base + step * 2;
          indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
        }
      }
    }
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    this.attributes = [
      new THREE.InstancedBufferAttribute(centres, 4),
      new THREE.InstancedBufferAttribute(sizes, 1),
      new THREE.InstancedBufferAttribute(motion, 4),
    ];
    ['aSpark', 'aSize', 'aMotion'].forEach((name, i) => {
      geometry.setAttribute(name, this.attributes[i].setUsage(THREE.DynamicDrawUsage));
    });
    geometry.instanceCount = sizes.length;
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uEmberArt: { value: artwork } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        ${ATMO_GLSL}
        in vec4 aSpark;
        in float aSize;
        in vec4 aMotion;
        out vec2 vUv;
        out vec3 vWorld;
        out float vAlpha;
        out float vPhase;
        out float vWake;
        vec3 path(float u, float n, float seed) {
          float clock = uTime * (0.30 + n * 0.028);
          float phase = n * 2.39996 + seed;
          float arc = u * (3.9 + 0.4 * sin(n * 1.7)) + clock + phase;
          float radius = 0.065 + u * (0.40 + 0.025 * sin(n * 2.1))
            + 0.028 * sin(clock * 1.4 + u * 8.0 + n) * sin(u * 3.141593);
          float tilt = 0.65 * sin(n * 1.8 + clock * 0.3);
          vec3 p = vec3(cos(arc), sin(arc) * cos(tilt), sin(arc) * sin(tilt)) * radius;
          float turn = phase + 0.18 * sin(clock * 0.7 + n);
          p.xy = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * p.xy;
          // The free end lifts and unfurls independently of the next ribbon.
          p.y += pow(u, 5.0) * (0.08 + 0.08 * sin(clock * 1.7 + n));
          return p;
        }
        void main() {
          float u = position.x, side = position.y, n = position.z;
          float seed = sin(dot(aSpark.xz, vec2(0.17, 0.13))) * 3.0;
          vec3 p = path(u, n, seed);
          vec3 tangent = path(min(1.001, u + 0.002), n, seed) - path(max(-0.001, u - 0.002), n, seed);
          vec2 normal = normalize(vec2(-tangent.y, tangent.x) + vec2(0.00001));
          float taper = pow(max(0.0, sin(u * 3.141593)), 0.85);
          float billow = 0.85 + 0.15 * sin(u * 11.0 - uTime * 1.8 + n);
          p.xy += normal * side * (0.09 + n * 0.004) * taper * billow;
          p.z += side * 0.035 * taper * sin(u * 8.0 - uTime * 1.3 + n);
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
          vec3 air = vec3(aMotion.x, 0.0, aMotion.y);
          vWorld = aSpark.xyz + (right * p.x + up * p.y + back * p.z + air * taper * 0.16) * aSize;
          vUv = vec2(u, side);
          vPhase = n;
          vWake = aMotion.z;
          vAlpha = aSpark.w * (0.78 + p.z * 0.6);
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${ATMO_GLSL}
        uniform sampler2D uEmberArt;
        in vec2 vUv;
        in vec3 vWorld;
        in float vAlpha;
        in float vPhase;
        in float vWake;
        void main() {
          if (vAlpha < 0.004) discard;
          float across = vUv.y;
          float ends = pow(max(0.0, sin(vUv.x * 3.141593)), 0.7);
          float edge = pow(max(0.0, 1.0 - across * across), 1.5);
          // Fine light travels along the surface, independently of its orbit and billow.
          float flow = vUv.x * 18.0 - uTime * (1.3 + vPhase * 0.1);
          float threads = 0.88 + 0.08 * sin(across * 7.0 + flow) + 0.04 * sin(across * 15.0 - flow * 0.6);
          vec3 paint = texture2D(uEmberArt, vec2(0.2 + vUv.x * 0.6, 0.48 + across * 0.13)).rgb;
          float fold = exp(-pow((across + 0.52) / 0.11, 2.0));
          vec3 colour = mix(vec3(1.0, 0.32, 0.07), vec3(1.0, 0.68, 0.28), paint.r * 0.35 + fold * 0.5);
          float a = (edge * 0.70 + fold * 0.40) * ends * threads * vAlpha * (0.23 + vWake * 0.07);
          if (a < 0.003) discard;
          gl_FragColor = vec4(colour * (1.0 - fogOf(vWorld).a * 0.75), a);
        }`,
    }));
    this.mesh.name = 'ember-moving-veils';
    this.mesh.frustumCulled = false;
  }

  update(): void {
    for (const attribute of this.attributes) attribute.needsUpdate = true;
  }
}
