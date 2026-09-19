import * as THREE from 'three';
import { tuning } from '../tuning';
import { atmo, ATMO_GLSL } from './atmosphere';

/** A turning light made visible by rain. Its last sweep dies before the paper plane is taken. */
export class LighthouseLight {
  readonly object = new THREE.Group();
  private elapsed = 0;
  private readonly strength = { value: 1 };
  private readonly beam: THREE.Mesh;
  private readonly lamp = new THREE.MeshBasicMaterial({ color: '#ffe6ad', toneMapped: false });

  constructor(position: THREE.Vector3) {
    this.object.position.copy(position).setY(11.35);
    const cone = new THREE.CylinderGeometry(12, 0.5, 85, 32, 1, true);
    cone.rotateX(Math.PI / 2).translate(0, 0, 42.5);
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
          float along = smoothstep(1.0, 0.15, vUv.y);
          float rain = 0.7 + 0.3 * vnoise(vWorld.xz * 0.13 + uTime * 0.35);
          float alpha = face * along * rain * uStrength * 0.085 * (1.0 - fogOf(vWorld).a);
          gl_FragColor = vec4(vec3(0.9, 0.82, 0.62), alpha);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    this.beam.rotation.order = 'YXZ';
    this.object.add(this.beam, new THREE.Mesh(new THREE.SphereGeometry(0.68, 12, 8), this.lamp));
  }

  update(dt: number, storm: number): void {
    if (storm > 0) this.elapsed += dt;
    else this.elapsed = 0;
    const s = tuning.storm;
    const dying = THREE.MathUtils.smoothstep(this.elapsed, s.lighthouseOutAt - s.lighthouseFadeFor, s.lighthouseOutAt);
    // One slow sag and recovery, then the lamp goes out; no rapid flicker.
    const falter = 1 - 0.65 * Math.pow(Math.sin(dying * Math.PI), 2);
    const power = (1 - dying) * falter;
    this.strength.value = power;
    this.lamp.color.setRGB(1.8, 1.15, 0.5).multiplyScalar(power);
    this.beam.rotation.set(0.095, this.elapsed * s.lighthouseSweep + s.lighthouseSweepStart, 0);
    this.beam.visible = power > 0.001;
    atmo.uniforms.uHarbourLight.value.set(this.object.position.x, this.object.position.y, this.object.position.z, power);
    atmo.uniforms.uHarbourDirection.value.set(0, 0, 1).applyEuler(this.beam.rotation);
  }
}
