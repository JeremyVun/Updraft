import * as THREE from 'three';
import { atmo, ATMO_GLSL } from './atmosphere';
import { boatsWaterHeight } from './little-boats-layout';

/** A few drops kicked backwards by each alternating paddle, born in world space and left behind. */
export class PaddleSpray {
  private readonly positions = new THREE.BufferAttribute(new Float32Array(24 * 3), 3);
  private readonly velocities = new THREE.BufferAttribute(new Float32Array(24 * 3), 3);
  private readonly births = new THREE.BufferAttribute(new Float32Array(24).fill(-100), 1);
  private next = 0;
  private kick = -1;
  readonly points: THREE.Points;

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions);
    geometry.setAttribute('velocity', this.velocities);
    geometry.setAttribute('born', this.births);
    this.points = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { ...atmo.uniforms },
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec3 velocity;
        attribute float born;
        varying vec3 vWorld;
        varying float vLife;
        void main() {
          float age = max(0.0, uTime - born);
          vLife = 1.0 - smoothstep(0.18, 0.42, age);
          vWorld = position + velocity * age;
          vWorld.y -= 2.8 * age * age;
          vec4 p = viewMatrix * vec4(vWorld, 1.0);
          gl_Position = projectionMatrix * p;
          gl_PointSize = clamp(100.0 / max(1.0, -p.z), 1.0, 5.0) * vLife;
        }`,
        fragmentShader: /* glsl */ `
        ${ATMO_GLSL}
        varying vec3 vWorld;
        varying float vLife;
        void main() {
          float dot = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5));
          if (vLife < 0.01 || dot < 0.01) discard;
          vec3 colour = vec3(0.75, 0.85, 0.8) * (uSkyAmbient + uSunColor * 0.75);
          gl_FragColor = vec4(applyFog(colour, vWorld), dot * vLife * 0.65);
        }`,
      }),
    );
    this.points.frustumCulled = false;
  }

  update(at: THREE.Vector3 | null, yaw: number, stride: number, play: number, time: number): void {
    const kick = Math.floor(stride / Math.PI);
    if (!at) {
      this.kick = -1;
      return;
    }
    if (kick === this.kick || play < 0.1) return;
    this.kick = kick;
    const side = kick % 2 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const n = this.next++ % 24;
      const x = at.x + Math.cos(yaw) * side * 0.23 - Math.sin(yaw) * 0.12;
      const z = at.z - Math.sin(yaw) * side * 0.23 - Math.cos(yaw) * 0.12;
      this.positions.setXYZ(n, x, boatsWaterHeight(x, z, time) + 0.03, z);
      const spread = side * (0.3 + i * 0.17);
      this.velocities.setXYZ(
        n,
        -Math.sin(yaw) * 0.9 + Math.cos(yaw) * spread,
        0.65 + play * 0.5 + i * 0.09,
        -Math.cos(yaw) * 0.9 - Math.sin(yaw) * spread,
      );
      this.births.setX(n, time);
    }
    this.positions.needsUpdate = this.velocities.needsUpdate = this.births.needsUpdate = true;
  }
}
