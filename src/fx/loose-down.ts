import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';
import type { WindSample } from '../wind/field';

/** A few soft body feathers shed in a startled scramble, then carried away by the same air as the bird. */
export class LooseDown {
  readonly mesh: THREE.InstancedMesh;
  private age = 10;
  private readonly fade = { value: 0 };
  private readonly card = new THREE.Object3D();
  private readonly particles = Array.from({ length: 11 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3() }));

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.15, 0.3, 1, 4), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { ...atmo.uniforms, uFade: this.fade },
      vertexShader: `${ATMO_GLSL}
        out vec2 vUv; out vec3 vWorld; out vec3 vNormal;
        void main() {
          vUv = uv;
          vec3 p = position; p.z += sin(uv.y * 3.14159) * 0.035;
          vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
          vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `${ATMO_GLSL}
        uniform float uFade; in vec2 vUv; in vec3 vWorld; in vec3 vNormal;
        void main() {
          float width = pow(sin(vUv.y * 3.14159), 0.65);
          float edge = abs(vUv.x * 2.0 - 1.0) / max(0.02, width);
          float alpha = (1.0 - smoothstep(0.6, 1.0, edge)) * uFade;
          if (alpha < 0.02) discard;
          vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 col = vec3(0.78, 0.75, 0.66) * (hemiLight(n) + uSunColor * (0.3 + abs(dot(n, uSunDir))) + emberLight(vWorld, n));
          gl_FragColor = vec4(applyFog(col, vWorld), alpha);
        }`,
    }), this.particles.length);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  burst(at: THREE.Vector3, heading: number): void {
    this.age = 0;
    this.fade.value = 1;
    this.mesh.visible = true;
    this.particles.forEach((p, i) => {
      const angle = i * 2.4;
      p.p.copy(at).add(new THREE.Vector3(Math.cos(angle) * 0.24, 0.12 + i * 0.018, Math.sin(angle) * 0.24));
      p.v.set(Math.cos(angle) * 1.1 + Math.sin(heading) * 1.3, 0.6 + (i % 4) * 0.22, Math.sin(angle) * 1.1 + Math.cos(heading) * 1.3);
    });
    this.update(0, { x: 0, z: 0, energy: 0, lift: 0 });
  }

  update(dt: number, wind: WindSample): void {
    if (!this.mesh.visible) return;
    this.age += dt;
    this.fade.value = Math.min(1, Math.max(0, (5 - this.age) / 1.5));
    this.mesh.visible = this.age < 5;
    this.particles.forEach((p, i) => {
      p.v.x += (wind.x * 0.12 - p.v.x) * (1 - Math.exp(-dt));
      p.v.z += (wind.z * 0.12 - p.v.z) * (1 - Math.exp(-dt));
      p.v.y = Math.max(-0.45, p.v.y - dt * 1.3);
      p.p.addScaledVector(p.v, dt);
      p.p.y = Math.max(p.p.y, heightAt(p.p.x, p.p.z) + 0.035);
      this.card.position.copy(p.p);
      this.card.rotation.set(this.age * (1.3 + i * 0.08) + i, i * 2.4, Math.sin(this.age * 3 + i) * 0.8);
      this.card.scale.setScalar(0.65 + (i % 4) * 0.15);
      this.card.updateMatrix(); this.mesh.setMatrixAt(i, this.card.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
