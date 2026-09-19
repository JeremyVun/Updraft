import * as THREE from 'three';
import { atmo, ATMO_GLSL } from './atmosphere';
import { heightAt } from './island';
import { DOOR_SHORE } from './heightfield';

/** A little, closely cropped shore. Fixed roots let both cameras see the same grass without a second wind bake. */
export function createDoorShoreGrass(): THREE.Mesh {
  const roots: number[] = [], traits: number[] = [];
  let seed = 92841;
  const rand = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  for (let i = 0; i < 36000; i++) {
    const x = DOOR_SHORE.x + (rand() - 0.5) * 44;
    const z = DOOR_SHORE.z + (rand() - 0.5) * 57;
    const y = heightAt(x, z);
    if (y < 0.9 || rand() > THREE.MathUtils.smoothstep(y, 0.9, 2.4)) continue;
    roots.push(x, y, z); traits.push(rand(), rand(), rand());
  }
  const blade = new THREE.PlaneGeometry(1, 1, 1, 3).translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = blade.index; geo.attributes.position = blade.attributes.position;
  geo.setAttribute('aRoot', new THREE.InstancedBufferAttribute(new Float32Array(roots), 3));
  geo.setAttribute('aTrait', new THREE.InstancedBufferAttribute(new Float32Array(traits), 3));
  geo.instanceCount = roots.length / 3;
  const mat = new THREE.ShaderMaterial({
    uniforms: atmo.uniforms, side: THREE.DoubleSide,
    vertexShader: `${ATMO_GLSL}
      in vec3 aRoot; in vec3 aTrait;
      out vec3 vWorld; out vec3 vNormal; out vec3 vColour;
      void main() {
        float t = position.y;
        float angle = aTrait.x * 6.28318;
        vec3 across = vec3(cos(angle), 0.0, sin(angle));
        float h = 0.34 + aTrait.y * 0.48;
        vec2 wind = swayAt(aRoot.xz).xy;
        vec2 bend = (vec2(sin(uTime * 1.7 + aRoot.x * 0.8 + aRoot.z * 0.45), 0.4) * 0.055 + wind * 0.009) * t * t;
        vWorld = aRoot + across * position.x * (1.0 - t) * 0.13 + vec3(bend.x, t * h, bend.y);
        vNormal = normalize(vec3(-sin(angle), 0.5, cos(angle)));
        vec3 alb = mix(vec3(0.025, 0.065, 0.012), vec3(0.21, 0.32, 0.042), t);
        float sun = groundAt(aRoot.xz).w * cloudShadow(aRoot.xz);
        vColour = alb * (hemiLight(vNormal) + uSunColor * (0.45 + 0.5 * abs(dot(vNormal, uSunDir))) * sun) * (0.65 + 0.3 * aTrait.z + 0.15 * t);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: `${ATMO_GLSL}
      in vec3 vWorld; in vec3 vNormal; in vec3 vColour;
      void main() { gl_FragColor = vec4(applyFog(vColour, vWorld), 1.0); }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  return mesh;
}
