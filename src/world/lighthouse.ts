import * as THREE from 'three';
import { tuning } from '../tuning';
import { fixInPlace } from '../gl/fixed';
import { atmo, ATMO_GLSL } from './atmosphere';

/** A child's remembered lighthouse: broad at the water, impossibly tall above it. */
export const LIGHTHOUSE_SCALE = new THREE.Vector3(1.85, 2.15, 1.85);
/** The top of the rock it stands on, above the flood. */
export const LIGHTHOUSE_BASE_Y = 4.5;
export const LIGHTHOUSE_LANTERN_Y = LIGHTHOUSE_BASE_Y + 13.85 * LIGHTHOUSE_SCALE.y;
export const LIGHTHOUSE_TOP_Y = LIGHTHOUSE_BASE_Y + 16.6 * LIGHTHOUSE_SCALE.y;

/** How strong the failing light is through its last seconds (0 to 1 of them): sags, a half recovery, a last glow, out. */
const FAILING = [[0, 1], [0.24, 0.42], [0.46, 0.82], [0.7, 0.16], [0.82, 0.3], [1, 0]];

function failing(u: number): number {
  if (u <= 0) return 1;
  if (u >= 1) return 0;
  let i = 1;
  while (FAILING[i][0] < u) i++;
  const [u0, p0] = FAILING[i - 1], [u1, p1] = FAILING[i];
  return THREE.MathUtils.lerp(p0, p1, THREE.MathUtils.smootherstep(u, u0, u1));
}

/** A turning light made visible by rain. In the storm its light fails and goes out, in sight, as they pass it. */
export class LighthouseLight {
  readonly object = new THREE.Group();
  /** Seconds since the storm began, and seconds the beam has been turning. */
  private elapsed = 0;
  private turned = 0;
  private readonly strength = { value: 1 };
  private readonly beam: THREE.Mesh;
  private readonly glow = { value: new THREE.Color('#ffe6ad') };
  /** The lamp itself, seen through whatever weather lies between it and the eye. */
  private readonly lamp = new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uGlow: this.glow },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: `${ATMO_GLSL}
      uniform vec3 uGlow;
      varying vec3 vWorld;
      void main() {
        gl_FragColor = vec4(applyFog(uGlow, vWorld), 1.0);
      }`,
  });

  constructor(position: THREE.Vector3) {
    this.object.position.copy(position).setY(LIGHTHOUSE_LANTERN_Y);
    const cone = new THREE.CylinderGeometry(16, 0.85, 110, 32, 1, true);
    cone.rotateX(Math.PI / 2).translate(0, 0, 55);
    this.beam = new THREE.Mesh(cone, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uStrength: this.strength },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = mat3(modelMatrix) * normal;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
        }`,
      fragmentShader: `${ATMO_GLSL}
        uniform float uStrength;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          float face = pow(abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld))), 0.65);
          float along = (1.0 - smoothstep(0.15, 1.0, vUv.y));
          float rain = 0.7 + 0.3 * vnoise(vWorld.xz * 0.13 + uTime * 0.35);
          float alpha = face * along * rain * uStrength * 0.085 * (1.0 - fogOf(vWorld).a);
          gl_FragColor = vec4(vec3(0.9, 0.82, 0.62), alpha);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    this.beam.rotation.order = 'YXZ';
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 8), this.lamp);
    this.object.add(this.beam, lamp);
    fixInPlace(this.object, lamp);
  }

  update(dt: number, storm: number): void {
    const s = tuning.storm;
    /** A storm already whole (the dark wood) put it out long ago. */
    if (storm >= 1 && this.elapsed === 0) this.elapsed = s.lighthouseOutAt;
    if (storm > 0) this.elapsed += dt;
    else this.elapsed = 0;
    this.turned += dt;
    // Slow sags, never a rapid flicker.
    const left = failing((this.elapsed - s.lighthouseOutAt + s.lighthouseFadeFor) / s.lighthouseFadeFor);
    const power = left < 1e-3 ? 0 : left;
    this.strength.value = power;
    this.glow.value.setRGB(1.8, 1.15, 0.5).multiplyScalar(power);
    this.beam.rotation.set(s.lighthouseDip, this.turned * s.lighthouseSweep + s.lighthouseSweepStart, 0);
    this.beam.visible = power > 0.001;
    atmo.uniforms.uHarbourLight.value.set(this.object.position.x, this.object.position.y, this.object.position.z, power);
    atmo.uniforms.uHarbourDirection.value.set(0, 0, 1).applyEuler(this.beam.rotation);
  }
}
